import 'dotenv/config';
import { getPrisma, disconnectPrisma } from '../src/config/prisma.js';
import { validateSeedEnvironment } from './seed/config.js';
import { seedProdi } from './seed/prodi.js';
import { seedRoles } from './seed/roles.js';
import { seedUsers } from './seed/users.js';
import { seedProfiles } from './seed/profiles.js';

async function main() {
  const envInfo = validateSeedEnvironment();

  console.log('--- SIPKITA Database Seeder ---');
  console.log(`Target database: ${envInfo.dbHost}/${envInfo.dbName} (development)`);

  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('Gagal menginisialisasi Prisma Client.');
  }

  try {
    // 1. Program Studi
    const { prodi, created: prodiCreated } = await seedProdi(prisma);
    console.log(
      `[Prodi] ${prodiCreated ? 'Dibuat baru:' : 'Menggunakan eksisting:'} ${prodi.nama_prodi} (ID: ${prodi.id})`
    );

    // 2. Roles
    const { roleMap, createdCount: rolesCreated } = await seedRoles(prisma);
    console.log(
      `[Roles] Selesai. Total role target: ${roleMap.size} (Dibuat baru: ${rolesCreated}, Eksisting: ${
        roleMap.size - rolesCreated
      })`
    );

    // 3. Users dan User Roles
    const { userMap, createdUsersCount, createdUserRolesCount } = await seedUsers(
      prisma,
      roleMap,
      envInfo.seedPassword
    );
    console.log(
      `[Users] Selesai. Total akun fixture: ${userMap.size} (Dibuat baru: ${createdUsersCount}, Eksisting: ${
        userMap.size - createdUsersCount
      })`
    );
    console.log(`[UserRoles] Relasi dibuat baru: ${createdUserRolesCount}`);

    // 4. Profiles (Mahasiswa & Dosen)
    const { createdMahasiswaCount, createdDosenCount } = await seedProfiles(
      prisma,
      prodi,
      userMap
    );
    console.log(`[Profiles] Mahasiswa dibuat baru: ${createdMahasiswaCount}`);
    console.log(`[Profiles] Dosen dibuat baru: ${createdDosenCount}`);

    console.log('--- Seeding Selesai dengan Sukses ---');
  } finally {
    await disconnectPrisma();
  }
}

main().catch((err) => {
  console.error('[Seeder Gagal]:', err.message);
  process.exit(1);
});

