export const MAHASISWA_FIXTURES = [
  {
    fixture_user: 'DEV_MHS_A',
    nim: '522001001',
    nama_lengkap: 'Ahmad Demo',
    tanggal_lahir: new Date('2004-01-15'),
    tempat_lahir: 'Jakarta',
    no_telepon: '081200000001',
    alamat: 'Jl. Mahasiswa Demo No. 1, Jakarta',
    tahun_angkatan: 2022,
    status_data: 'AKTIF',
  },
  {
    fixture_user: 'DEV_MHS_B',
    nim: '522001002',
    nama_lengkap: 'Budi Demo',
    tanggal_lahir: new Date('2004-05-20'),
    tempat_lahir: 'Bandung',
    no_telepon: '081200000002',
    alamat: 'Jl. Mahasiswa Demo No. 2, Bandung',
    tahun_angkatan: 2022,
    status_data: 'AKTIF',
  },
];

export const DOSEN_FIXTURES = [
  {
    fixture_user: 'DEV_DOSEN_A',
    kode_dosen: 'DSN001',
    nidn: '0000000001',
    nama_lengkap: 'Dosen Reviewer Demo',
    tanggal_lahir: new Date('1985-03-10'),
    no_telepon: '081300000001',
    jabatan_fungsional: 'Lektor',
    is_homebase_si: true,
    status_data: 'AKTIF',
  },
  {
    fixture_user: 'DEV_DOSEN_B',
    kode_dosen: 'DSN002',
    nidn: '0000000002',
    nama_lengkap: 'Dosen Pembimbing Demo',
    tanggal_lahir: new Date('1982-07-22'),
    no_telepon: '081300000002',
    jabatan_fungsional: 'Lektor Kepala',
    is_homebase_si: true,
    status_data: 'AKTIF',
  },
  {
    fixture_user: 'DEV_DOSEN_C',
    kode_dosen: 'DSN003',
    nidn: '0000000003',
    nama_lengkap: 'Dosen Multi-Role Demo',
    tanggal_lahir: new Date('1980-11-14'),
    no_telepon: '081300000003',
    jabatan_fungsional: 'Lektor Kepala',
    is_homebase_si: true,
    status_data: 'AKTIF',
  },
  {
    fixture_user: 'DEV_KAPRODI',
    kode_dosen: 'DSN004',
    nidn: '0000000004',
    nama_lengkap: 'Kaprodi Demo',
    tanggal_lahir: new Date('1978-09-05'),
    no_telepon: '081300000004',
    jabatan_fungsional: 'Lektor Kepala',
    is_homebase_si: true,
    status_data: 'AKTIF',
  },
];

/**
 * Pastikan 2 profil Mahasiswa dan 4 profil Dosen tersedia dan terhubung ke User & Prodi.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {import('@prisma/client').ProgramStudi} prodi
 * @param {Map<string, import('@prisma/client').User>} userMap
 */
export async function seedProfiles(prisma, prodi, userMap) {
  let createdMahasiswaCount = 0;
  let createdDosenCount = 0;

  // Mahasiswa
  for (const mhsData of MAHASISWA_FIXTURES) {
    const user = userMap.get(mhsData.fixture_user);
    if (!user) {
      throw new Error(`User fixture ${mhsData.fixture_user} tidak ditemukan.`);
    }

    let mhs = await prisma.mahasiswa.findFirst({
      where: {
        OR: [
          { user_id: user.id },
          { nim: mhsData.nim },
        ],
      },
    });

    if (!mhs) {
      await prisma.mahasiswa.create({
        data: {
          user_id: user.id,
          program_studi_id: prodi.id,
          nim: mhsData.nim,
          nama_lengkap: mhsData.nama_lengkap,
          tanggal_lahir: mhsData.tanggal_lahir,
          tempat_lahir: mhsData.tempat_lahir,
          no_telepon: mhsData.no_telepon,
          alamat: mhsData.alamat,
          tahun_angkatan: mhsData.tahun_angkatan,
          status_data: mhsData.status_data,
        },
      });
      createdMahasiswaCount++;
    }
  }

  // Dosen
  for (const dsnData of DOSEN_FIXTURES) {
    const user = userMap.get(dsnData.fixture_user);
    if (!user) {
      throw new Error(`User fixture ${dsnData.fixture_user} tidak ditemukan.`);
    }

    let dsn = await prisma.dosen.findFirst({
      where: {
        OR: [
          { user_id: user.id },
          { kode_dosen: dsnData.kode_dosen },
          { nidn: dsnData.nidn },
        ],
      },
    });

    if (!dsn) {
      await prisma.dosen.create({
        data: {
          user_id: user.id,
          program_studi_id: prodi.id,
          kode_dosen: dsnData.kode_dosen,
          nidn: dsnData.nidn,
          nama_lengkap: dsnData.nama_lengkap,
          tanggal_lahir: dsnData.tanggal_lahir,
          no_telepon: dsnData.no_telepon,
          jabatan_fungsional: dsnData.jabatan_fungsional,
          is_homebase_si: dsnData.is_homebase_si,
          status_data: dsnData.status_data,
        },
      });
      createdDosenCount++;
    }
  }

  return { createdMahasiswaCount, createdDosenCount };
}

