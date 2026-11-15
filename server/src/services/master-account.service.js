const ADMIN_ROLES = ['ADMIN_SISTEM', 'ADMIN_PRODI', 'KAPRODI'];

// Relasi User selain profil target dan membership miliknya sendiri. Semuanya
// dipertahankan sebagai bukti aktivitas; FK Restrict tetap menjadi pengaman akhir.
const USER_DEPENDENCIES = [
  'user_roles_diberikan', 'password_reset_tokens', 'auth_sessions', 'import_diunggah',
  'import_dikonfirmasi', 'audit_logs', 'jadwal_proses_dibuat',
  'verifikasi_diri_diperiksa', 'dokumen_diri_diperiksa',
  'pengajuan_akademik_diperiksa', 'pengajuan_diputuskan',
  'riwayat_status_pengajuan_diubah', 'dokumen_diunggah',
  'dokumen_pengajuan_diperiksa', 'penugasan_ditetapkan',
  'riwayat_review_dilakukan', 'bimbingan_diperiksa',
  'riwayat_bimbingan_dilakukan', 'keputusan_perubahan_judul_diperiksa',
  'penyelesaian_disetujui', 'jadwal_seminar_dibuat',
  'riwayat_seminar_dilakukan', 'notifikasi_dibuat', 'notifikasi_diterima',
  'template_dokumen_dibuat', 'aturan_penyelesaian_ditetapkan',
];

const PROFILE_DEPENDENCIES = {
  mahasiswa: ['pengajuan', 'topik_penelitian'],
  dosen: ['pengajuan_diusulkan', 'penugasan_dosen'],
};

function countSelection(names) {
  return Object.fromEntries(names.map((name) => [name, true]));
}

function hasDependencies(counts) {
  return Object.values(counts).some((count) => count > 0);
}

export async function changeMasterAccountStatus(prisma, {
  model, id, prodiId, actorUserId, status, ErrorType,
}) {
  return prisma.$transaction(async (tx) => {
    const record = await tx[model].findFirst({
      where: { id, program_studi_id: prodiId },
      select: { id: true, user_id: true, status_data: true, user: { select: { status_akun: true } } },
    });
    if (!record) throw new ErrorType(404, `${model.toUpperCase()}_NOT_FOUND`, 'Data tidak ditemukan.');
    const administrative = await tx.userRole.findFirst({
      where: { user_id: record.user_id, role: { kode_peran: { in: ADMIN_ROLES } } },
      select: { user_id: true },
    });
    if (administrative) throw new ErrorType(403, 'ADMIN_ACCOUNT_PROTECTED', 'Akun administratif dilindungi.');

    // Cabut sesi juga saat aktivasi agar sesi yang dibuat oleh request login
    // bersamaan dengan penonaktifan tidak dapat hidup kembali.
    const now = new Date();
    await tx.user.update({ where: { id: record.user_id }, data: { status_akun: status } });
    await tx.authSession.updateMany({
      where: { user_id: record.user_id, revoked_at: null },
      data: { revoked_at: now },
    });
    await tx.auditLog.create({
      data: {
        aktor_user_id: actorUserId, aksi: 'UBAH_STATUS_AKUN',
        entitas: model === 'mahasiswa' ? 'Mahasiswa' : 'Dosen', entitas_id: BigInt(id),
        data_sebelum: { status_akun: record.user.status_akun },
        data_sesudah: { status_akun: status },
      },
    });
    return { id, user_id: record.user_id, status_akun: status, status_data: record.status_data };
  });
}

export async function deleteMasterAccount(prisma, {
  model, id, prodiId, actorUserId, ErrorType,
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const record = await tx[model].findFirst({
        where: { id, program_studi_id: prodiId },
        select: {
          id: true, user_id: true,
          _count: { select: countSelection(PROFILE_DEPENDENCIES[model]) },
          ...(model === 'mahasiswa' ? { verifikasi_data_diri: { select: { id: true } } } : {}),
        },
      });
      if (!record) throw new ErrorType(404, `${model.toUpperCase()}_NOT_FOUND`, 'Data tidak ditemukan.');
      const administrative = await tx.userRole.findFirst({
        where: { user_id: record.user_id, role: { kode_peran: { in: ADMIN_ROLES } } },
        select: { user_id: true },
      });
      if (administrative) throw new ErrorType(403, 'ADMIN_ACCOUNT_PROTECTED', 'Akun administratif dilindungi.');
      const user = await tx.user.findUnique({
        where: { id: record.user_id },
        select: { _count: { select: countSelection(USER_DEPENDENCIES) } },
      });
      if (!user || record.verifikasi_data_diri ||
          hasDependencies(record._count) || hasDependencies(user._count)) {
        throw new ErrorType(409, 'MASTER_HAS_REFERENCES', 'Data memiliki riwayat atau relasi penting.');
      }

      await tx.userRole.deleteMany({ where: { user_id: record.user_id } });
      await tx[model].delete({ where: { id } });
      await tx.user.delete({ where: { id: record.user_id } });
      await tx.auditLog.create({
        data: {
          aktor_user_id: actorUserId, aksi: 'HAPUS_MASTER',
          entitas: model === 'mahasiswa' ? 'Mahasiswa' : 'Dosen', entitas_id: BigInt(id),
          data_sebelum: { user_id: record.user_id },
        },
      });
      return { id };
    });
  } catch (error) {
    if (error?.code === 'P2003' || error?.code === 'P2014') {
      throw new ErrorType(409, 'MASTER_HAS_REFERENCES', 'Data memiliki riwayat atau relasi penting.');
    }
    throw error;
  }
}
