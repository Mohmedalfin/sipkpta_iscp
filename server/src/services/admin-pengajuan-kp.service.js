import { createNotifikasi, studentRecipient } from './notifikasi.service.js';
import { createHash } from 'node:crypto';
import { afterKpChange } from './realtime.service.js';
import { authorizedProdiId } from './mahasiswa.service.js';
import { readPrivateDocument, REQUIRED_DOCUMENT_CODES } from './data-diri.service.js';
import { serializable } from './pengajuan-kp.service.js';

export class AdminPengajuanKpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const contextWhere = {
  jenis_pengajuan: 'REGULER', pilihan_topik: 'BARU',
  tahap_akademik: { kode_tahap: 'KP' },
};
const requiredCodes = ['BUKTI_BAYAR_PROPOSAL_KP', 'PROPOSAL_KP'];
const socialCodes = ['SERTIFIKAT_SOSIALISASI_KP', 'SURAT_PERNYATAAN_SOSIALISASI_KP'];

async function scope(prisma) {
  try { return await authorizedProdiId(prisma); }
  catch (error) {
    if (error?.code === 'PRODI_SCOPE_UNAVAILABLE') {
      throw new AdminPengajuanKpError(403, error.code, error.message);
    }
    throw error;
  }
}

function detailSelect() {
  return {
    id: true, mahasiswa_id: true, periode_akademik_id: true, tahap_akademik_id: true,
    jenis_pengajuan: true, pilihan_topik: true,
    status_pengajuan: true, status_pemeriksaan_berkas: true,
    catatan_pemeriksaan_berkas: true, diperiksa_berkas_oleh_user_id: true,
    diperiksa_berkas_at: true, status_pemeriksaan_akademik: true,
    catatan_pemeriksaan_akademik: true, akademik_diperiksa_oleh_user_id: true,
    akademik_diperiksa_at: true, catatan_keputusan: true, diputuskan_oleh_user_id: true,
    diputuskan_at: true, diajukan_at: true, updated_at: true,
    ipk_saat_pengajuan: true, jumlah_sks_saat_pengajuan: true,
    memiliki_nilai_de: true, daftar_mk_nilai_de: true, sudah_bayar_spp_variabel: true,
    mahasiswa: { select: {
      id: true, nim: true, nama_lengkap: true, program_studi_id: true,
      program_studi: { select: { id: true, kode_prodi: true, nama_prodi: true } },
      verifikasi_data_diri: { select: {
        status_verifikasi: true,
        dokumen_data_diri: { where: { is_terkini: true }, select: {
          jenis_dokumen: { select: { kode_jenis: true } },
        } },
      } },
    } },
    periode_akademik: { select: { id: true, tahun_ajaran: true, semester: true } },
    topik_penelitian: { select: { tema_penelitian: {
      select: { id: true, kode_tema: true, nama_tema: true },
    } } },
    versi_topik: { select: { id: true, nomor_versi: true, judul_penelitian: true,
      objek_penelitian: true, lokasi_penelitian: true } },
    usulan_pembimbing: { select: { id: true, kode_dosen: true, nama_lengkap: true } },
    dokumen_pengajuan: { where: { is_terkini: true }, orderBy: { id: 'asc' }, select: {
      id: true, nomor_versi: true, status_pemeriksaan: true, created_at: true,
      persyaratan_pengajuan_id: true,
      persyaratan_pengajuan: { select: { is_wajib: true,
        jenis_dokumen: { select: { kode_jenis: true, nama_jenis: true } },
      } },
      dokumen: { select: { nama_file_asli: true, mime_type: true,
        ukuran_bytes: true, checksum_sha256: true } },
    } },
    riwayat_status: { orderBy: [{ created_at: 'asc' }, { id: 'asc' }], select: {
      id: true, jenis_status: true, status_sebelum: true, status_sesudah: true,
      catatan: true, diubah_oleh_user_id: true, created_at: true,
    } },
  };
}

async function scopedApplication(prisma, id) {
  const prodiId = await scope(prisma);
  const item = await prisma.pengajuan.findFirst({
    where: { id, status_pengajuan: { not: 'DRAFT' },
      mahasiswa: { program_studi_id: prodiId }, ...contextWhere },
    select: detailSelect(),
  });
  if (!item) throw new AdminPengajuanKpError(404, 'APPLICATION_NOT_FOUND', 'Pengajuan tidak ditemukan.');
  return item;
}

function snapshot(item) {
  const value = {
    id: item.id, updated_at: item.updated_at,
    status_pengajuan: item.status_pengajuan,
    status_pemeriksaan_berkas: item.status_pemeriksaan_berkas,
    status_pemeriksaan_akademik: item.status_pemeriksaan_akademik,
    data_diri: item.mahasiswa.verifikasi_data_diri?.status_verifikasi ?? null,
    versi_topik_id: item.versi_topik?.id ?? null,
    ipk: item.ipk_saat_pengajuan?.toString() ?? null,
    sks: item.jumlah_sks_saat_pengajuan,
    de: item.memiliki_nilai_de,
    daftar_de: item.daftar_mk_nilai_de,
    spp: item.sudah_bayar_spp_variabel,
    dokumen: item.dokumen_pengajuan.map((doc) => [doc.id, doc.nomor_versi,
      doc.persyaratan_pengajuan_id, doc.dokumen.checksum_sha256]),
  };
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function publicDetail(item) {
  return {
    ...item,
    snapshot: snapshot(item),
    ipk_saat_pengajuan: item.ipk_saat_pengajuan === null ? null : Number(item.ipk_saat_pengajuan),
    mahasiswa: { ...item.mahasiswa,
      verifikasi_data_diri: item.mahasiswa.verifikasi_data_diri
        ? { status_verifikasi: item.mahasiswa.verifikasi_data_diri.status_verifikasi,
          jumlah_terunggah: REQUIRED_DOCUMENT_CODES.filter((code) =>
            item.mahasiswa.verifikasi_data_diri.dokumen_data_diri.some((doc) =>
              doc.jenis_dokumen.kode_jenis === code)).length }
        : null },
    dokumen_pengajuan: item.dokumen_pengajuan.map((doc) => ({
      ...doc, dokumen: { nama_file_asli: doc.dokumen.nama_file_asli,
        mime_type: doc.dokumen.mime_type, ukuran_bytes: Number(doc.dokumen.ukuran_bytes) },
    })),
    riwayat_status: item.riwayat_status.map((event) => ({ ...event, id: event.id.toString() })),
  };
}

export async function listAdminKpApplications(prisma, query) {
  const prodiId = await scope(prisma);
  const where = {
    ...contextWhere,
    mahasiswa: { program_studi_id: prodiId,
      ...(query.search ? { OR: [
        { nim: { contains: query.search } },
        { nama_lengkap: { contains: query.search, mode: 'insensitive' } },
      ] } : {}) },
    status_pengajuan: query.status_pengajuan || { not: 'DRAFT' },
    ...(query.status_berkas ? { status_pemeriksaan_berkas: query.status_berkas } : {}),
    ...(query.status_nilai ? { status_pemeriksaan_akademik: query.status_nilai } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.pengajuan.findMany({ where, orderBy: [{ diajukan_at: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit, take: query.limit,
      select: { id: true, status_pengajuan: true, status_pemeriksaan_berkas: true,
        status_pemeriksaan_akademik: true, diajukan_at: true,
        mahasiswa: { select: { nim: true, nama_lengkap: true } },
        periode_akademik: { select: { tahun_ajaran: true, semester: true } },
        versi_topik: { select: { judul_penelitian: true } },
      } }),
    prisma.pengajuan.count({ where }),
  ]);
  return { items, pagination: { page: query.page, limit: query.limit, total,
    total_pages: Math.ceil(total / query.limit) } };
}

export async function getAdminKpApplication(prisma, id) {
  return publicDetail(await scopedApplication(prisma, id));
}

export async function downloadAdminKpDocument(prisma, id, documentId) {
  await scopedApplication(prisma, id);
  const linked = await prisma.dokumenPengajuan.findFirst({
    where: { id: documentId, pengajuan_id: id },
    select: { dokumen: { select: { storage_key: true, nama_file_asli: true } } },
  });
  if (!linked) throw new AdminPengajuanKpError(404, 'DOCUMENT_NOT_FOUND', 'Dokumen tidak ditemukan.');
  try {
    return { bytes: await readPrivateDocument(linked.dokumen.storage_key),
      filename: linked.dokumen.nama_file_asli };
  } catch (error) {
    if (error?.code === 'DOCUMENT_NOT_FOUND') {
      throw new AdminPengajuanKpError(404, error.code, error.message);
    }
    throw error;
  }
}

async function locked(prisma, id, expectedSnapshot) {
  await prisma.$queryRaw`SELECT pg_advisory_xact_lock(20261108, ${id}::int) IS NULL AS locked`;
  const item = await scopedApplication(prisma, id);
  if (item.status_pengajuan !== 'DIAJUKAN') {
    throw new AdminPengajuanKpError(409, 'APPLICATION_LOCKED', 'Pengajuan sudah diputuskan.');
  }
  if (snapshot(item) !== expectedSnapshot) {
    throw new AdminPengajuanKpError(409, 'STALE_SNAPSHOT', 'Data berubah. Muat ulang detail pengajuan.');
  }
  return item;
}

async function history(prisma, item, category, before, after, actorUserId, note, at) {
  await prisma.riwayatStatusPengajuan.create({ data: {
    pengajuan_id: item.id, jenis_status: category, status_sebelum: before,
    status_sesudah: after, diubah_oleh_user_id: actorUserId,
    catatan: note, created_at: at,
  } });
}

export function examineAdminKpCategory(prisma, input) {
  return afterKpChange(prisma, 'pengajuan.administration.updated', () => examineCategory(prisma, input), [input.id]);
}

export function decideAdminKpApplication(prisma, input) {
  return afterKpChange(prisma, 'pengajuan.administration.updated', () => decideApplication(prisma, input), [input.id]);
}

export function approveAllAdminKp(prisma, input) {
  return afterKpChange(prisma, 'pengajuan.administration.updated', () => approveAll(prisma, input), [input.id]);
}

async function examineCategory(prisma, { id, category, status, note, expectedSnapshot, actorUserId }) {
  return serializable(prisma, async (tx) => {
    const item = await locked(tx, id, expectedSnapshot);
    const berkas = category === 'BERKAS';
    const oldStatus = berkas ? item.status_pemeriksaan_berkas : item.status_pemeriksaan_akademik;
    if (oldStatus === 'BELUM_OK') {
      throw new AdminPengajuanKpError(409, 'REVISION_PENDING', 'Mahasiswa harus mengirim perbaikan sebelum pemeriksaan ulang.');
    }
    if (oldStatus === status) {
      throw new AdminPengajuanKpError(409, 'NO_STATUS_CHANGE', 'Status kategori sudah sama.');
    }
    const now = new Date();
    await tx.pengajuan.update({ where: { id }, data: berkas
      ? { status_pemeriksaan_berkas: status, catatan_pemeriksaan_berkas: note,
        diperiksa_berkas_oleh_user_id: actorUserId, diperiksa_berkas_at: now }
      : { status_pemeriksaan_akademik: status, catatan_pemeriksaan_akademik: note,
        akademik_diperiksa_oleh_user_id: actorUserId, akademik_diperiksa_at: now } });
    await history(tx, item, category, oldStatus, status, actorUserId, note, now);
    if (status === 'BELUM_OK') await createNotifikasi(tx, {
      kategori: 'ADMINISTRASI_KP', judul: 'Perbaikan administrasi KP',
      pesan: 'Pemeriksaan administrasi KP meminta perbaikan.',
      route: '/mahasiswa/pengajuan/kp', actorUserId,
      recipientIds: [await studentRecipient(tx, id)],
    });
    return { id, kategori: category, status, diperiksa_at: now };
  });
}

async function requireApprovalReady(prisma, item) {
  if (item.mahasiswa.verifikasi_data_diri?.status_verifikasi !== 'TERVERIFIKASI') {
    throw new AdminPengajuanKpError(409, 'PERSONAL_DATA_NOT_VERIFIED', 'Data Diri belum terverifikasi.');
  }
  const requirements = await prisma.persyaratanPengajuan.findMany({ where: {
    periode_akademik_id: item.periode_akademik_id,
    tahap_akademik_id: item.tahap_akademik_id,
    jenis_pengajuan: item.jenis_pengajuan, pilihan_topik: item.pilihan_topik,
    is_aktif: true, jenis_dokumen: { is_aktif: true },
  }, select: { is_wajib: true, jenis_dokumen: { select: { kode_jenis: true } } } });
  const configured = new Set(requirements.map((req) => req.jenis_dokumen.kode_jenis));
  const codes = new Set(item.dokumen_pengajuan.map((doc) => doc.persyaratan_pengajuan.jenis_dokumen.kode_jenis));
  if (requirements.length !== 5 || [...requiredCodes, 'BUKTI_SPP_VARIABEL_KP', ...socialCodes]
    .some((code) => !configured.has(code)) ||
    requirements.some((req) => req.is_wajib && !codes.has(req.jenis_dokumen.kode_jenis)) ||
    requiredCodes.some((code) => !codes.has(code)) ||
    !socialCodes.some((code) => codes.has(code)) ||
    item.sudah_bayar_spp_variabel === null ||
    (item.sudah_bayar_spp_variabel !== codes.has('BUKTI_SPP_VARIABEL_KP'))) {
    throw new AdminPengajuanKpError(409, 'INCOMPLETE_DOCUMENTS', 'Dokumen KP belum lengkap atau tidak konsisten.');
  }
  const ipk = item.ipk_saat_pengajuan === null ? null : Number(item.ipk_saat_pengajuan);
  if (ipk === null || ipk < 0 || ipk > 4 ||
    !Number.isInteger(item.jumlah_sks_saat_pengajuan) || item.jumlah_sks_saat_pengajuan < 0 ||
    typeof item.memiliki_nilai_de !== 'boolean' ||
    item.memiliki_nilai_de && !item.daftar_mk_nilai_de?.trim()) {
    throw new AdminPengajuanKpError(409, 'INCOMPLETE_ACADEMIC_DATA', 'Data akademik belum lengkap.');
  }
}

async function decideApplication(prisma, { id, status, note, expectedSnapshot, actorUserId }) {
  return serializable(prisma, async (tx) => {
    const item = await locked(tx, id, expectedSnapshot);
    if (status === 'ACC') {
      if (item.status_pemeriksaan_berkas !== 'OK_LENGKAP' ||
          item.status_pemeriksaan_akademik !== 'OK_LENGKAP') {
        throw new AdminPengajuanKpError(409, 'CATEGORIES_NOT_APPROVED', 'Berkas dan Nilai harus OK lengkap.');
      }
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261103, ${item.mahasiswa_id}::int) IS NULL AS locked`;
      await requireApprovalReady(tx, await scopedApplication(tx, id));
    }
    const now = new Date();
    await tx.pengajuan.update({ where: { id }, data: {
      status_pengajuan: status, catatan_keputusan: note,
      diputuskan_oleh_user_id: actorUserId, diputuskan_at: now,
    } });
    await history(tx, item, 'PENGAJUAN', 'DIAJUKAN', status, actorUserId, note, now);
    await createNotifikasi(tx, { kategori: 'ADMINISTRASI_KP',
      judul: status === 'ACC' ? 'Administrasi KP disetujui' : 'Pengajuan KP tidak disetujui',
      pesan: status === 'ACC' ? 'Pemeriksaan administrasi pengajuan KP selesai.'
        : 'Keputusan administrasi pengajuan KP tersedia.',
      route: '/mahasiswa/pengajuan/kp', actorUserId,
      recipientIds: [await studentRecipient(tx, id)],
    });
    return { id, status_pengajuan: status, diputuskan_at: now };
  });
}

async function approveAll(prisma, { id, expectedSnapshot, actorUserId }) {
  return serializable(prisma, async (tx) => {
    const item = await locked(tx, id, expectedSnapshot);
    if (item.status_pemeriksaan_berkas === 'BELUM_OK' ||
        item.status_pemeriksaan_akademik === 'BELUM_OK') {
      throw new AdminPengajuanKpError(409, 'REVISION_PENDING', 'Kategori BELUM_OK harus diperbaiki dahulu.');
    }
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261103, ${item.mahasiswa_id}::int) IS NULL AS locked`;
    await requireApprovalReady(tx, await scopedApplication(tx, id));
    const now = new Date();
    const berkasChanged = item.status_pemeriksaan_berkas !== 'OK_LENGKAP';
    const nilaiChanged = item.status_pemeriksaan_akademik !== 'OK_LENGKAP';
    await tx.pengajuan.update({ where: { id }, data: {
      ...(berkasChanged ? { status_pemeriksaan_berkas: 'OK_LENGKAP',
        diperiksa_berkas_oleh_user_id: actorUserId, diperiksa_berkas_at: now } : {}),
      ...(nilaiChanged ? { status_pemeriksaan_akademik: 'OK_LENGKAP',
        akademik_diperiksa_oleh_user_id: actorUserId, akademik_diperiksa_at: now } : {}),
      status_pengajuan: 'ACC', diputuskan_oleh_user_id: actorUserId, diputuskan_at: now,
    } });
    if (berkasChanged) await history(tx, item, 'BERKAS', item.status_pemeriksaan_berkas,
      'OK_LENGKAP', actorUserId, null, now);
    if (nilaiChanged) await history(tx, item, 'NILAI', item.status_pemeriksaan_akademik,
      'OK_LENGKAP', actorUserId, null, now);
    await history(tx, item, 'PENGAJUAN', 'DIAJUKAN', 'ACC', actorUserId, null, now);
    await createNotifikasi(tx, { kategori: 'ADMINISTRASI_KP',
      judul: 'Administrasi KP disetujui', pesan: 'Pemeriksaan administrasi pengajuan KP selesai.',
      route: '/mahasiswa/pengajuan/kp', actorUserId,
      recipientIds: [await studentRecipient(tx, id)],
    });
    return { id, status_pemeriksaan_berkas: 'OK_LENGKAP',
      status_pemeriksaan_akademik: 'OK_LENGKAP', status_pengajuan: 'ACC', diputuskan_at: now };
  });
}
