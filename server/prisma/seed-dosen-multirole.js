import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { getPrisma, disconnectPrisma } from '../src/config/prisma.js';
import { hashPassword, verifyPassword } from '../src/security/password.js';

const fixtures = Object.freeze({
  'reviewer-pembimbing': Object.freeze({
    login_id: '0999999901',
    email: 'dev.dosen-multirole-01@sipkita.test',
    kode_dosen: 'DSN-DEMO-MULTI-01',
    nidn: '0999999901',
    nama_lengkap: 'Dosen Reviewer Pembimbing Demo',
    tanggal_lahir: new Date('1984-04-12T00:00:00.000Z'),
    roleCodes: ['REVIEWER', 'PEMBIMBING'],
  }),
  'kaprodi-pembimbing': Object.freeze({
    login_id: '0999999902',
    email: 'dev.kaprodi-pembimbing-01@sipkita.test',
    kode_dosen: 'DSN-DEMO-KAPRODI-01',
    nidn: '0999999902',
    nama_lengkap: 'Kaprodi Pembimbing Demo',
    tanggal_lahir: new Date('1981-08-19T00:00:00.000Z'),
    roleCodes: ['KAPRODI', 'PEMBIMBING'],
  }),
});

function expectedDatabase() {
  const args = process.argv.slice(2);
  const name = args[1];
  const fixtureKey = args[2] ?? 'reviewer-pembimbing';
  if ((args.length !== 2 && args.length !== 3) || args[0] !== 'apply' ||
    !Object.hasOwn(fixtures, fixtureKey) ||
    !/^sipkita_(?:dev|test(?:_[a-zA-Z0-9_]+)?)$/.test(name)) {
    throw new Error('Gunakan apply sipkita_dev [reviewer-pembimbing|kaprodi-pembimbing].');
  }
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
    decodeURIComponent(url.pathname.slice(1)) !== name) {
    throw new Error('Target DATABASE_URL bukan database lokal yang diharapkan.');
  }
  return { name, fixtureKey };
}

function matchesFixture(user, dosen, roles, prodi, fixture) {
  return user?.id === dosen?.user_id &&
    user.login_id === fixture.login_id &&
    user.email === fixture.email &&
    user.status_akun === 'AKTIF' &&
    dosen.kode_dosen === fixture.kode_dosen &&
    dosen.nidn === fixture.nidn &&
    dosen.nama_lengkap === fixture.nama_lengkap &&
    dosen.tanggal_lahir.getTime() === fixture.tanggal_lahir.getTime() &&
    dosen.program_studi_id === prodi.id &&
    dosen.status_data === 'AKTIF' &&
    roles.length === fixture.roleCodes.length &&
    fixture.roleCodes.every((code) => roles.some((item) => item.role.kode_peran === code));
}

async function seedDosen(prisma, fixture) {
  const password = randomBytes(18).toString('base64url');
  const passwordHash = await hashPassword(password);
  const result = await prisma.$transaction(async (tx) => {
    const prodi = await tx.programStudi.findUnique({ where: { kode_prodi: 'SI' } });
    if (!prodi || prodi.nama_prodi !== 'Sistem Informasi') {
      throw new Error('Program Studi Sistem Informasi belum tersedia.');
    }
    const roles = await tx.role.findMany({ where: { kode_peran: { in: fixture.roleCodes } } });
    if (roles.length !== fixture.roleCodes.length) {
      throw new Error(`Role ${fixture.roleCodes.join(' dan ')} harus tersedia.`);
    }

    const users = await tx.user.findMany({
      where: { OR: [{ login_id: fixture.login_id }, { email: fixture.email }] },
      include: { user_roles_diperoleh: { include: { role: true } } },
    });
    const dosenRecords = await tx.dosen.findMany({
      where: { OR: [{ nidn: fixture.nidn }, { kode_dosen: fixture.kode_dosen }] },
    });
    if (users.length || dosenRecords.length) {
      if (users.length === 1 && dosenRecords.length === 1 &&
        matchesFixture(users[0], dosenRecords[0], users[0].user_roles_diperoleh, prodi, fixture)) {
        return { created: false };
      }
      throw new Error('Akun atau profil dosen dengan kunci fixture ini bentrok. Tidak ada data yang diubah.');
    }

    const user = await tx.user.create({
      data: {
        login_id: fixture.login_id,
        email: fixture.email,
        password_hash: passwordHash,
        status_akun: 'AKTIF',
      },
    });
    await tx.dosen.create({
      data: {
        user_id: user.id,
        program_studi_id: prodi.id,
        kode_dosen: fixture.kode_dosen,
        nidn: fixture.nidn,
        nama_lengkap: fixture.nama_lengkap,
        tanggal_lahir: fixture.tanggal_lahir,
        is_homebase_si: true,
        status_data: 'AKTIF',
      },
    });
    for (const role of roles) {
      await tx.userRole.create({ data: { user_id: user.id, role_id: role.id } });
    }
    return { created: true };
  }, { isolationLevel: 'Serializable' });

  if (result.created && !await verifyPassword(password, passwordHash)) {
    throw new Error('Verifikasi hash password gagal.');
  }
  return { ...result, password: result.created ? password : null };
}

async function main() {
  const { name: expected, fixtureKey } = expectedDatabase();
  const fixture = fixtures[fixtureKey];
  const prisma = getPrisma();
  if (!prisma) throw new Error('Koneksi database tidak tersedia.');
  try {
    const [database] = await prisma.$queryRaw`SELECT current_database() AS name`;
    if (database.name !== expected) throw new Error('Database aktif tidak sesuai target.');
    const result = await seedDosen(prisma, fixture);
    console.log(JSON.stringify({
      database: expected,
      nidn: fixture.nidn,
      login_id: fixture.login_id,
      roles: fixture.roleCodes,
      ...result,
    }));
  } finally {
    await disconnectPrisma();
  }
}

main().catch((error) => {
  console.error('[Seed Dosen Multi-Role Gagal]', error.message);
  process.exitCode = 1;
});
