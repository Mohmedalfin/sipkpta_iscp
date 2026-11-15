import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from '../security/password.js';
import { signAccessToken } from '../security/jwt.js';
import { createRefreshToken, hashRefreshToken, REFRESH_TOKEN_LIFETIME_MS } from '../security/refreshToken.js';

const ACTIVE_STATUS = 'AKTIF';
const DUMMY_HASH = hashPassword(randomBytes(32).toString('base64url'));

const userSelect = {
  id: true,
  login_id: true,
  status_akun: true,
  user_roles_diperoleh: {
    select: { role: { select: { id: true, kode_peran: true } } },
  },
};

function toPublicUser(user, activeRole = null) {
  return {
    id: user.id,
    login_id: user.login_id,
    roles: [...new Set(user.user_roles_diperoleh.map((item) => item.role.kode_peran))].sort(),
    activeRole,
  };
}

export async function findActiveUser(prisma, id, activeRole = null) {
  if (!prisma) {
    throw new Error('Database tidak dikonfigurasi.');
  }

  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user || user.status_akun !== ACTIVE_STATUS) {
    return null;
  }

  const publicUser = toPublicUser(user, activeRole);
  if (publicUser.roles.length === 0 || (activeRole !== null && !publicUser.roles.includes(activeRole))) {
    return null;
  }
  return publicUser;
}

export async function login(prisma, loginId, password) {
  if (!prisma) {
    throw new Error('Database tidak dikonfigurasi.');
  }

  const user = await prisma.user.findUnique({
    where: { login_id: loginId },
    select: { ...userSelect, password_hash: true },
  });

  // Akun tak dikenal tetap melewati verifikasi Argon2id untuk mengurangi enumerasi.
  const passwordMatches = await verifyPassword(password, user?.password_hash ?? (await DUMMY_HASH));
  if (!user || user.status_akun !== ACTIVE_STATUS || !passwordMatches) {
    return null;
  }

  const roleMemberships = user.user_roles_diperoleh;
  const activeMembership = roleMemberships.length === 1 ? roleMemberships[0] : null;
  const activeRole = activeMembership?.role.kode_peran ?? null;
  const publicUser = toPublicUser(user, activeRole);
  if (publicUser.roles.length === 0) {
    return null;
  }

  const sessionId = randomUUID();
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS);
  const { token, expiresIn } = await signAccessToken(user.id, sessionId, activeRole, 0);
  await prisma.$transaction(async (tx) => {
    await tx.authSession.create({
      data: {
        id: sessionId,
        user_id: user.id,
        active_role_id: activeMembership?.role.id ?? null,
        role_version: 0,
        expires_at: expiresAt,
      },
    });
    await tx.refreshToken.create({
      data: {
        id: randomUUID(),
        session_id: sessionId,
        token_hash: hashRefreshToken(refreshToken),
        expires_at: expiresAt,
      },
    });
  });
  return { accessToken: token, refreshToken, tokenType: 'Bearer', expiresIn, user: publicUser };
}

export async function refresh(prisma, rawToken) {
  if (!prisma) {
    throw new Error('Database tidak dikonfigurasi.');
  }

  const tokenHash = hashRefreshToken(rawToken);
  const nextRefreshToken = createRefreshToken();
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const current = await tx.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        session: {
          include: { active_role: { select: { kode_peran: true } } },
        },
      },
    });
    if (!current || current.session.revoked_at || current.session.expires_at <= now) {
      return { status: 'invalid' };
    }
    if (current.used_at) {
      await tx.authSession.updateMany({
        where: { id: current.session_id, revoked_at: null },
        data: { revoked_at: now },
      });
      return { status: 'reused' };
    }
    if (current.expires_at <= now) {
      return { status: 'invalid' };
    }

    const activeRole = current.session.active_role?.kode_peran ?? null;
    const user = await findActiveUser(tx, current.session.user_id, activeRole);
    if (!user) {
      await tx.authSession.updateMany({
        where: { id: current.session_id, revoked_at: null },
        data: { revoked_at: now },
      });
      return { status: 'invalid' };
    }

    const consumed = await tx.refreshToken.updateMany({
      where: { id: current.id, used_at: null },
      data: { used_at: now },
    });
    if (consumed.count !== 1) {
      await tx.authSession.updateMany({
        where: { id: current.session_id, revoked_at: null },
        data: { revoked_at: now },
      });
      return { status: 'reused' };
    }

    const { token, expiresIn } = await signAccessToken(
      user.id,
      current.session_id,
      activeRole,
      current.session.role_version
    );
    await tx.refreshToken.create({
      data: {
        id: randomUUID(),
        session_id: current.session_id,
        token_hash: hashRefreshToken(nextRefreshToken),
        expires_at: current.session.expires_at,
      },
    });
    return {
      status: 'ok',
      data: { accessToken: token, refreshToken: nextRefreshToken, tokenType: 'Bearer', expiresIn, user },
    };
  });
}

export async function selectActiveRole(prisma, userId, sessionId, roleCode) {
  if (!prisma) {
    throw new Error('Database tidak dikonfigurasi.');
  }

  const membership = await prisma.userRole.findFirst({
    where: { user_id: userId, role: { kode_peran: roleCode } },
    select: { role: { select: { id: true, kode_peran: true } } },
  });
  if (!membership) {
    return null;
  }

  const [updatedSession] = await prisma.authSession.updateManyAndReturn({
    where: {
      id: sessionId,
      user_id: userId,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    data: {
      active_role_id: membership.role.id,
      role_version: { increment: 1 },
    },
    select: { role_version: true },
  });
  if (!updatedSession) {
    return null;
  }

  const user = await findActiveUser(prisma, userId, membership.role.kode_peran);
  if (!user) {
    return null;
  }
  const { token, expiresIn } = await signAccessToken(
    userId,
    sessionId,
    membership.role.kode_peran,
    updatedSession.role_version
  );
  return { accessToken: token, tokenType: 'Bearer', expiresIn, user };
}

export async function logout(prisma, userId, sessionId) {
  if (!prisma) {
    throw new Error('Database tidak dikonfigurasi.');
  }
  await prisma.authSession.updateMany({
    where: { id: sessionId, user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}
