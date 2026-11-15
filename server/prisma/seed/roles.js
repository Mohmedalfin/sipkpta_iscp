export const TARGET_ROLES = [
  {
    kode_peran: 'ADMIN_SISTEM',
    nama_peran: 'Admin Sistem',
    deskripsi: 'Pengelola akun pengguna, master data, dan konfigurasi sistem SIPKITA.',
  },
  {
    kode_peran: 'ADMIN_PRODI',
    nama_peran: 'Admin Program Studi',
    deskripsi: 'Pengelola administrasi akademik dan verifikasi data diri mahasiswa.',
  },
  {
    kode_peran: 'KAPRODI',
    nama_peran: 'Ketua Program Studi',
    deskripsi: 'Pengambil keputusan akhir pengajuan dan penetapan reviewer/pembimbing.',
  },
  {
    kode_peran: 'MAHASISWA',
    nama_peran: 'Mahasiswa',
    deskripsi: 'Mahasiswa peserta Kerja Praktik, ISCP, atau Tugas Akhir.',
  },
  {
    kode_peran: 'REVIEWER',
    nama_peran: 'Dosen Reviewer',
    deskripsi: 'Dosen yang ditugaskan menelaah proposal pengajuan mahasiswa.',
  },
  {
    kode_peran: 'PEMBIMBING',
    nama_peran: 'Dosen Pembimbing',
    deskripsi: 'Dosen pembimbing pelaksanaan KP, ISCP, atau Tugas Akhir mahasiswa.',
  },
];

/**
 * Pastikan 6 role target tersedia (create-if-missing).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function seedRoles(prisma) {
  const roleMap = new Map();
  let createdCount = 0;

  for (const roleData of TARGET_ROLES) {
    let role = await prisma.role.findUnique({
      where: { kode_peran: roleData.kode_peran },
    });

    if (!role) {
      role = await prisma.role.create({
        data: roleData,
      });
      createdCount++;
    }

    roleMap.set(role.kode_peran, role);
  }

  return { roleMap, createdCount };
}

