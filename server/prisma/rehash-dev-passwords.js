import { disconnectPrisma, getPrisma } from '../src/config/prisma.js';
import {
  hashPassword,
  isArgon2idHash,
  passwordHashNeedsRehash,
  verifyPassword,
} from '../src/security/password.js';
import { validateSeedEnvironment } from './seed/config.js';
import { verifyLegacyScryptPassword } from './seed/legacy-scrypt.js';
import { USER_FIXTURES } from './seed/users.js';

const PASSWORD_HASH_MAX_LENGTH = 255;
const SCRYPT_PREFIX = '$scrypt$';

class RehashError extends Error {}

function parseArguments(args) {
  const allowedArguments = new Set(['--apply', '--reset']);
  const unknownArguments = args.filter((argument) => !allowedArguments.has(argument));
  const duplicateArguments = args.filter((argument, index) => args.indexOf(argument) !== index);

  if (unknownArguments.length > 0 || duplicateArguments.length > 0) {
    throw new RehashError('Argumen tidak valid. Gunakan hanya --reset dan/atau --apply.');
  }

  return {
    apply: args.includes('--apply'),
    reset: args.includes('--reset'),
  };
}

function classifyHash(storedHash) {
  if (isArgon2idHash(storedHash)) {
    return 'argon2id';
  }

  if (typeof storedHash === 'string' && storedHash.startsWith(SCRYPT_PREFIX)) {
    return 'scrypt';
  }

  return 'unknown';
}

async function loadExactTargets(prisma) {
  const loginIds = USER_FIXTURES.map((fixture) => fixture.login_id);
  const emails = USER_FIXTURES.map((fixture) => fixture.email);
  const candidates = await prisma.user.findMany({
    where: {
      OR: [{ login_id: { in: loginIds } }, { email: { in: emails } }],
    },
    select: {
      id: true,
      login_id: true,
      email: true,
      password_hash: true,
    },
  });

  const mismatchedCandidates = candidates.filter(
    (candidate) =>
      !USER_FIXTURES.some(
        (fixture) =>
          fixture.login_id === candidate.login_id && fixture.email === candidate.email
      )
  );
  const targets = USER_FIXTURES.map((fixture) => ({
    fixture,
    user: candidates.find(
      (candidate) =>
        candidate.login_id === fixture.login_id && candidate.email === fixture.email
    ),
  }));

  if (
    candidates.length !== USER_FIXTURES.length ||
    mismatchedCandidates.length > 0 ||
    targets.some((target) => !target.user)
  ) {
    throw new RehashError(
      'Pasangan login_id dan email fixture tidak cocok tepat delapan akun. Operasi dibatalkan.'
    );
  }

  return targets;
}

async function inspectTargets(targets, password, reset) {
  const inspections = [];

  for (const target of targets) {
    const algorithm = classifyHash(target.user.password_hash);

    if (algorithm === 'unknown') {
      throw new RehashError(
        `Algoritma hash fixture ${target.fixture.kode_fixture} tidak dikenali. Operasi dibatalkan.`
      );
    }

    if (algorithm === 'scrypt') {
      const legacyMatches = verifyLegacyScryptPassword(password, target.user.password_hash);
      if (!legacyMatches && !reset) {
        throw new RehashError(
          `Password development tidak cocok dengan fixture ${target.fixture.kode_fixture}. Gunakan --reset hanya setelah persetujuan eksplisit.`
        );
      }

      inspections.push({
        ...target,
        algorithm,
        action: 'UPDATE',
        reason: legacyMatches ? 'MIGRATE' : 'APPROVED_RESET',
      });
      continue;
    }

    const matches = await verifyPassword(password, target.user.password_hash);
    if (!matches) {
      throw new RehashError(
        `Hash Argon2id fixture ${target.fixture.kode_fixture} tidak cocok dengan password development. Operasi dibatalkan.`
      );
    }

    const needsRehash = passwordHashNeedsRehash(target.user.password_hash);
    inspections.push({
      ...target,
      algorithm,
      action: needsRehash ? 'UPDATE' : 'NO_OP',
      reason: needsRehash ? 'PARAMETER_UPGRADE' : 'ALREADY_MATCHED',
    });
  }

  return inspections;
}

async function loadIntegritySnapshot(prisma, targetIds) {
  // Query di dalam interactive transaction harus sekuensial agar satu koneksi pg
  // tidak menjalankan client.query() secara bersamaan.
  const programStudi = await prisma.programStudi.count();
  const role = await prisma.role.count();
  const user = await prisma.user.count();
  const userRole = await prisma.userRole.count();
  const mahasiswa = await prisma.mahasiswa.count();
  const dosen = await prisma.dosen.count();
  const users = await prisma.user.findMany({
    select: { id: true, password_hash: true },
    orderBy: { id: 'asc' },
  });
  const targetDetails = await prisma.user.findMany({
    where: { id: { in: targetIds } },
    select: {
      id: true,
      login_id: true,
      email: true,
      status_akun: true,
      last_login_at: true,
      password_changed_at: true,
      created_at: true,
      updated_at: true,
      user_roles_diperoleh: {
        select: { role_id: true },
        orderBy: { role_id: 'asc' },
      },
      mahasiswa: { select: { id: true } },
      dosen: { select: { id: true } },
    },
    orderBy: { id: 'asc' },
  });

  const targetIdSet = new Set(targetIds);

  return {
    counts: { programStudi, role, user, userRole, mahasiswa, dosen },
    nonFixtureHashes: users
      .filter((record) => !targetIdSet.has(record.id))
      .map((record) => [record.id, record.password_hash]),
    targetDetails,
  };
}

function assertIntegrityUnchanged(before, after) {
  if (JSON.stringify(before.counts) !== JSON.stringify(after.counts)) {
    throw new RehashError('Jumlah record atau relasi berubah. Transaksi dibatalkan.');
  }

  if (JSON.stringify(before.nonFixtureHashes) !== JSON.stringify(after.nonFixtureHashes)) {
    throw new RehashError('Hash akun non-fixture berubah. Transaksi dibatalkan.');
  }

  if (JSON.stringify(before.targetDetails) !== JSON.stringify(after.targetDetails)) {
    throw new RehashError(
      'Identitas, status, timestamp, profil, atau role fixture berubah. Transaksi dibatalkan.'
    );
  }
}

async function prepareUpdates(inspections, password) {
  const updates = [];
  const wrongPassword = `${password}\u0000SIPKITA_WRONG_PASSWORD_CHECK`;

  for (const inspection of inspections.filter((item) => item.action === 'UPDATE')) {
    const passwordHash = await hashPassword(password);

    if (passwordHash.length > PASSWORD_HASH_MAX_LENGTH) {
      throw new RehashError('Hash Argon2id melebihi kapasitas kolom password_hash.');
    }

    if (
      !(await verifyPassword(password, passwordHash)) ||
      (await verifyPassword(wrongPassword, passwordHash)) ||
      passwordHashNeedsRehash(passwordHash)
    ) {
      throw new RehashError('Validasi hash Argon2id baru gagal. Database belum diubah.');
    }

    updates.push({ inspection, passwordHash });
  }

  if (new Set(updates.map((update) => update.passwordHash)).size !== updates.length) {
    throw new RehashError(
      'Salt/hash baru tidak unik untuk setiap fixture. Database belum diubah.'
    );
  }

  return updates;
}

function printPlan(inspections, apply, reset) {
  const updateCount = inspections.filter((inspection) => inspection.action === 'UPDATE').length;
  const noOpCount = inspections.length - updateCount;

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}${reset ? ' / APPROVED RESET' : ''}`);
  console.log(`Fixture cocok: ${inspections.length}`);
  console.log(`Akan diperbarui: ${updateCount}`);
  console.log(`No-op: ${noOpCount}`);

  for (const inspection of inspections) {
    console.log(
      `- ${inspection.fixture.kode_fixture}: id=${inspection.user.id}, ${inspection.algorithm}, ${inspection.action}`
    );
  }
}

async function main() {
  const { apply, reset } = parseArguments(process.argv.slice(2));
  let seedConfiguration;
  try {
    seedConfiguration = validateSeedEnvironment();
  } catch (error) {
    throw new RehashError(error.message);
  }

  const { seedPassword, dbHost, dbName } = seedConfiguration;
  const prisma = getPrisma();

  if (!prisma) {
    throw new RehashError('Prisma tidak tersedia karena DATABASE_URL belum disetel.');
  }

  console.log(`Target terverifikasi: ${dbHost}/${dbName}`);

  const targets = await loadExactTargets(prisma);
  const inspections = await inspectTargets(targets, seedPassword, reset);
  printPlan(inspections, apply, reset);

  if (!apply) {
    console.log('Dry-run selesai. Database tidak diubah.');
    return;
  }

  const updates = await prepareUpdates(inspections, seedPassword);
  if (updates.length === 0) {
    console.log('Tidak ada perubahan yang diperlukan. Database tetap tidak diubah.');
    return;
  }

  const targetIds = targets.map((target) => target.user.id);
  const before = await loadIntegritySnapshot(prisma, targetIds);

  await prisma.$transaction(async (transaction) => {
    for (const update of updates) {
      const changedRows = await transaction.$executeRaw`
        UPDATE "users"
        SET "password_hash" = ${update.passwordHash}
        WHERE "id" = ${update.inspection.user.id}
          AND "login_id" = ${update.inspection.user.login_id}
          AND "email" = ${update.inspection.user.email}
          AND "password_hash" = ${update.inspection.user.password_hash}
      `;

      if (changedRows !== 1) {
        throw new RehashError(
          `Fixture ${update.inspection.fixture.kode_fixture} berubah sejak dry-run internal. Transaksi dibatalkan.`
        );
      }
    }

    const storedTargets = await transaction.user.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, password_hash: true },
      orderBy: { id: 'asc' },
    });
    const expectedHashes = new Map(
      updates.map((update) => [update.inspection.user.id, update.passwordHash])
    );

    if (
      storedTargets.length !== USER_FIXTURES.length ||
      storedTargets.some((target) => {
        const expectedHash = expectedHashes.get(target.id);
        return expectedHash ? target.password_hash !== expectedHash : false;
      })
    ) {
      throw new RehashError('Verifikasi hash tersimpan gagal. Transaksi dibatalkan.');
    }

    const after = await loadIntegritySnapshot(transaction, targetIds);
    assertIntegrityUnchanged(before, after);
  });

  const verifiedTargets = await loadExactTargets(prisma);
  const verificationResults = await Promise.all(
    verifiedTargets.map(async (target) => ({
      valid:
        isArgon2idHash(target.user.password_hash) &&
        !passwordHashNeedsRehash(target.user.password_hash) &&
        (await verifyPassword(seedPassword, target.user.password_hash)) &&
        !(await verifyPassword(
          `${seedPassword}\u0000SIPKITA_WRONG_PASSWORD_CHECK`,
          target.user.password_hash
        )),
      hash: target.user.password_hash,
    }))
  );

  if (
    verificationResults.some((result) => !result.valid) ||
    new Set(verificationResults.map((result) => result.hash)).size !== USER_FIXTURES.length
  ) {
    throw new RehashError(
      'Verifikasi pascatransaksi gagal. Segera periksa database development.'
    );
  }

  console.log(`Pembaruan berhasil: ${updates.length} fixture.`);
  console.log('Seluruh fixture memakai Argon2id, password benar diterima, dan password salah ditolak.');
}

main()
  .catch((error) => {
    if (error instanceof RehashError) {
      console.error(`Rehash dibatalkan: ${error.message}`);
    } else {
      console.error('Rehash dibatalkan karena kesalahan internal. Detail sensitif tidak ditampilkan.');
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
