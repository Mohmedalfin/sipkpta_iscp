/**
 * Pastikan Program Studi Sistem Informasi tersedia (create-if-missing).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function seedProdi(prisma) {
  let prodi = await prisma.programStudi.findFirst({
    where: {
      OR: [
        { nama_prodi: 'Sistem Informasi' },
        { kode_prodi: 'SI' },
      ],
    },
  });

  if (prodi) {
    return { prodi, created: false };
  }

  prodi = await prisma.programStudi.create({
    data: {
      kode_prodi: 'SI',
      nama_prodi: 'Sistem Informasi',
      jenjang: 'S1',
      nama_fakultas: 'Fakultas Ilmu Komputer',
      nama_perguruan_tinggi: 'Universitas Demo',
    },
  });

  return { prodi, created: true };
}

