import { hashPassword } from './hash.js';

export const USER_FIXTURES = [
  {
    kode_fixture: 'DEV_SYS_ADMIN',
    login_id: 'admin.sistem',
    nama_tampilan: 'Admin Sistem Demo',
    email: 'dev.admin-sistem@sipkita.test',
    roles: ['ADMIN_SISTEM'],
  },
  {
    kode_fixture: 'DEV_PRODI_ADMIN',
    login_id: 'admin.prodi',
    nama_tampilan: 'Admin Prodi Demo',
    email: 'dev.admin-prodi@sipkita.test',
    roles: ['ADMIN_PRODI'],
  },
  {
    kode_fixture: 'DEV_KAPRODI',
    login_id: '0000000004',
    nama_tampilan: 'Kaprodi Demo',
    email: 'dev.kaprodi@sipkita.test',
    roles: ['KAPRODI'],
  },
  {
    kode_fixture: 'DEV_MHS_A',
    login_id: '522001001',
    nama_tampilan: 'Ahmad Demo',
    email: 'dev.mahasiswa-a@sipkita.test',
    roles: ['MAHASISWA'],
  },
  {
    kode_fixture: 'DEV_MHS_B',
    login_id: '522001002',
    nama_tampilan: 'Budi Demo',
    email: 'dev.mahasiswa-b@sipkita.test',
    roles: ['MAHASISWA'],
  },
  {
    kode_fixture: 'DEV_DOSEN_A',
    login_id: '0000000001',
    nama_tampilan: 'Dosen Reviewer Demo',
    email: 'dev.reviewer@sipkita.test',
    roles: ['REVIEWER'],
  },
  {
    kode_fixture: 'DEV_DOSEN_B',
    login_id: '0000000002',
    nama_tampilan: 'Dosen Pembimbing Demo',
    email: 'dev.pembimbing@sipkita.test',
    roles: ['PEMBIMBING'],
  },
  {
    kode_fixture: 'DEV_DOSEN_C',
    login_id: '0000000003',
    nama_tampilan: 'Dosen Multi-Role Demo',
    email: 'dev.dosen-multi@sipkita.test',
    roles: ['REVIEWER', 'PEMBIMBING'],
  },
];

/**
 * Pastikan 8 akun dummy dan 9 relasi UserRole tersedia.
 * Pola create-if-missing: jika user sudah ada, tidak menimpa password_hash atau record pengguna lain.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {Map<string, import('@prisma/client').Role>} roleMap
 * @param {string} seedPassword
 */
export async function seedUsers(prisma, roleMap, seedPassword) {
  const userMap = new Map();
  let createdUsersCount = 0;
  let createdUserRolesCount = 0;

  for (const fixture of USER_FIXTURES) {
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: fixture.email },
          { login_id: fixture.login_id },
        ],
      },
    });

    if (!user) {
      const passwordHash = await hashPassword(seedPassword);

      user = await prisma.user.create({
        data: {
          login_id: fixture.login_id,
          email: fixture.email,
          password_hash: passwordHash,
          status_akun: 'AKTIF',
        },
      });
      createdUsersCount++;
    }

    userMap.set(fixture.kode_fixture, user);

    // Pastikan relasi UserRole untuk setiap role pada fixture
    for (const kodePeran of fixture.roles) {
      const role = roleMap.get(kodePeran);
      if (!role) {
        throw new Error(`Role ${kodePeran} tidak ditemukan dalam roleMap.`);
      }

      const existingUserRole = await prisma.userRole.findUnique({
        where: {
          user_id_role_id: {
            user_id: user.id,
            role_id: role.id,
          },
        },
      });

      if (!existingUserRole) {
        await prisma.userRole.create({
          data: {
            user_id: user.id,
            role_id: role.id,
          },
        });
        createdUserRolesCount++;
      }
    }
  }

  return { userMap, createdUsersCount, createdUserRolesCount };
}
