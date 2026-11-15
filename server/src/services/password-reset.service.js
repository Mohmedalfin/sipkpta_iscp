import { hashPassword } from '../security/password.js';
import { createPasswordResetToken, hashPasswordResetToken } from '../security/resetToken.js';

const ACTIVE_STATUS = 'AKTIF';
const DEFAULT_EXPIRES_MINUTES = 15;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const emailLocks = new Map();

export function getResetTokenExpiresMinutes(environment = process.env) {
  const rawValue = environment.RESET_TOKEN_EXPIRES_MINUTES ?? String(DEFAULT_EXPIRES_MINUTES);
  const minutes = Number(rawValue);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error('RESET_TOKEN_EXPIRES_MINUTES harus berupa bilangan bulat 1 sampai 1440.');
  }
  return minutes;
}

async function withEmailLock(email, action) {
  const previous = emailLocks.get(email) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const queued = previous.catch(() => {}).then(() => current);
  emailLocks.set(email, queued);
  await previous.catch(() => {});
  try {
    return await action();
  } finally {
    release();
    if (emailLocks.get(email) === queued) {
      emailLocks.delete(email);
    }
  }
}

async function cancelUnsentToken(prisma, id, now) {
  try {
    await prisma.passwordResetToken.deleteMany({ where: { id, used_at: null } });
  } catch {
    try {
      await prisma.passwordResetToken.updateMany({
        where: { id, used_at: null },
        data: { used_at: now },
      });
    } catch {
      console.error('Password reset token cleanup failed.');
    }
  }
}

export async function requestPasswordReset(prisma, mailService, email) {
  if (!prisma || !mailService) {
    throw new Error('Layanan reset password tidak dikonfigurasi.');
  }

  return withEmailLock(email, async () => {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status_akun: true },
    });
    if (!user || user.status_akun !== ACTIVE_STATUS) {
      return;
    }

    const now = new Date();
    const cooldownSince = new Date(now.getTime() - REQUEST_COOLDOWN_MS);
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: { user_id: user.id, created_at: { gt: cooldownSince } },
      select: { id: true },
    });
    if (recentToken) {
      return;
    }

    const expiresMinutes = getResetTokenExpiresMinutes();
    const rawToken = createPasswordResetToken();
    const created = await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: hashPasswordResetToken(rawToken),
        expires_at: new Date(now.getTime() + expiresMinutes * 60 * 1000),
      },
      select: { id: true },
    });

    try {
      await mailService.sendPasswordReset({
        to: user.email,
        token: rawToken,
        expiresMinutes,
      });
      await prisma.passwordResetToken.updateMany({
        where: { user_id: user.id, id: { not: created.id }, used_at: null },
        data: { used_at: new Date() },
      });
    } catch {
      await cancelUnsentToken(prisma, created.id, new Date());
      console.error('Password reset email delivery failed.');
    }
  });
}

function datePasswordVariants(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return [];
  }
  const year = String(value.getUTCFullYear()).padStart(4, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return [
    `${year}${month}${day}`,
    `${day}${month}${year}`,
    `${year}-${month}-${day}`,
    `${day}-${month}-${year}`,
    `${year}/${month}/${day}`,
    `${day}/${month}/${year}`,
  ];
}

function usesBirthDate(password, user) {
  const birthDates = [user.mahasiswa?.tanggal_lahir, user.dosen?.tanggal_lahir];
  return birthDates.some((birthDate) => datePasswordVariants(birthDate).includes(password));
}

export async function resetPassword(prisma, rawToken, newPassword) {
  if (!prisma) {
    throw new Error('Database tidak dikonfigurasi.');
  }

  const tokenHash = hashPasswordResetToken(rawToken);
  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({
      where: { token_hash: tokenHash },
      select: {
        id: true,
        user_id: true,
        expires_at: true,
        used_at: true,
        user: {
          select: {
            status_akun: true,
            mahasiswa: { select: { tanggal_lahir: true } },
            dosen: { select: { tanggal_lahir: true } },
          },
        },
      },
    });

    if (!resetToken || resetToken.used_at || resetToken.expires_at <= now ||
        resetToken.user.status_akun !== ACTIVE_STATUS) {
      return { status: 'invalid' };
    }
    if (usesBirthDate(newPassword, resetToken.user)) {
      return { status: 'birth_date' };
    }

    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, used_at: null, expires_at: { gt: now } },
      data: { used_at: now },
    });
    if (consumed.count !== 1) {
      return { status: 'invalid' };
    }

    await tx.user.update({
      where: { id: resetToken.user_id },
      data: { password_hash: passwordHash, password_changed_at: now },
    });
    await tx.passwordResetToken.updateMany({
      where: { user_id: resetToken.user_id, used_at: null },
      data: { used_at: now },
    });
    await tx.authSession.updateMany({
      where: { user_id: resetToken.user_id, revoked_at: null },
      data: { revoked_at: now },
    });

    return { status: 'ok' };
  });
}
