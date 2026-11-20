import { afterKpChange } from './realtime.service.js';
import { createNotifikasi, studentRecipient } from './notifikasi.service.js';
import { authorizedProdiId } from './mahasiswa.service.js';
import { serializable } from './pengajuan-kp.service.js';

export class FinalisasiKpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const PENUGASAN_PEMBIMBING_KP = Object.freeze({
  JENIS: 'PEMBIMBING', SUMBER: 'KAPRODI', AKTIF: 'AKTIF', NONAKTIF: 'NONAKTIF',
});
const activeSupervisor = { jenis_penugasan: 'PEMBIMBING', status_penugasan: 'AKTIF' };
const activeReviewer = { jenis_penugasan: 'REVIEWER', status_penugasan: 'AKTIF' };
const context = { jenis_pengajuan: 'REGULER', pilihan_topik: 'BARU',
  tahap_akademik: { kode_tahap: 'KP' } };

async function prodiScope(prisma, actorUserId) {
  const profile = await prisma.dosen.findUnique({ where: { user_id: actorUserId },
    select: { program_studi_id: true, status_data: true } });
  if (profile) {
    if (profile.status_data !== 'AKTIF') throw new FinalisasiKpError(403, 'PRODI_SCOPE_UNAVAILABLE', 'Cakupan prodi tidak tersedia.');
    return profile.program_studi_id;
  }
  // Akun Kaprodi tanpa profil dosen hanya aman pada instalasi satu Prodi.
  try { return await authorizedProdiId(prisma); }
  catch (error) {
    if (error?.code === 'PRODI_SCOPE_UNAVAILABLE') throw new FinalisasiKpError(403,
      'PRODI_SCOPE_UNAVAILABLE', 'Cakupan prodi tidak tersedia.');
    throw error;
  }
}

function whereApplication(prodiId) {
  return { ...context, mahasiswa: { program_studi_id: prodiId } };
}

const assignmentSelect = { id: true, dosen_id: true, status_penugasan: true,
  sumber_penugasan: true, asal_penugasan_id: true, ditetapkan_oleh_user_id: true,
  mulai_at: true, berakhir_at: true, alasan_perubahan: true,
  dosen: { select: { id: true, kode_dosen: true, nama_lengkap: true } } };

const detailSelect = {
  id: true, nomor_pengajuan: true, periode_akademik_id: true, status_pengajuan: true,
  status_pemeriksaan_berkas: true, status_pemeriksaan_akademik: true,
  diajukan_at: true, usulan_pembimbing_id: true,
  mahasiswa: { select: { id: true, nim: true, nama_lengkap: true, program_studi_id: true,
    verifikasi_data_diri: { select: { status_verifikasi: true } } } },
  periode_akademik: { select: { id: true, tahun_ajaran: true, semester: true } },
  versi_topik: { select: { id: true, nomor_versi: true, judul_penelitian: true } },
  usulan_pembimbing: { select: { id: true, nama_lengkap: true } },
  bimbingan: { select: { id: true }, take: 1 },
  dokumen_pengajuan: { where: { is_terkini: true,
    persyaratan_pengajuan: { jenis_dokumen: { kode_jenis: 'PROPOSAL_KP' } } },
  select: { id: true, nomor_versi: true, created_at: true } },
  penugasan_dosen: { where: { OR: [activeReviewer, activeSupervisor] },
    select: { ...assignmentSelect, jenis_penugasan: true,
      review_proposal: { select: { riwayat_review: { orderBy: [
        { putaran_ke: 'desc' }, { id: 'desc' }], select: {
        dokumen_pengajuan_id: true, versi_topik_id: true, hasil_review: true,
        reviewed_at: true } } } } } },
};

async function scopedApplication(prisma, id, prodiId) {
  const item = await prisma.pengajuan.findFirst({ where: { id, ...whereApplication(prodiId) },
    select: detailSelect });
  if (!item) throw new FinalisasiKpError(404, 'APPLICATION_NOT_FOUND', 'Pengajuan tidak ditemukan.');
  return item;
}

export function getKelayakanPenetapan(item) {
  const proposal = item.dokumen_pengajuan[0] ?? null;
  const reviewers = item.penugasan_dosen.filter((row) => row.jenis_penugasan === 'REVIEWER');
  const supervisor = item.penugasan_dosen.find((row) => row.jenis_penugasan === 'PEMBIMBING') ?? null;
  const reviewItems = reviewers.map((row) => {
    const latest = row.review_proposal?.riwayat_review.find((event) =>
      event.dokumen_pengajuan_id === proposal?.id &&
      event.versi_topik_id === item.versi_topik?.id);
    return { penugasan_id: row.id, reviewer: row.dosen,
      hasil_versi_terkini: latest?.hasil_review ?? 'BELUM_DIREVIEW',
      reviewed_at: latest?.reviewed_at ?? null };
  });
  const reasons = [];
  if (item.status_pengajuan !== 'ACC' || !item.diajukan_at) reasons.push('ACC_ADMIN_BELUM_TERSEDIA');
  if (item.status_pemeriksaan_berkas !== 'OK_LENGKAP') reasons.push('BERKAS_BELUM_LENGKAP');
  if (item.status_pemeriksaan_akademik !== 'OK_LENGKAP') reasons.push('NILAI_BELUM_LENGKAP');
  if (item.mahasiswa.verifikasi_data_diri?.status_verifikasi !== 'TERVERIFIKASI') reasons.push('DATA_DIRI_BELUM_TERVERIFIKASI');
  if (!proposal || !item.versi_topik) reasons.push('PROPOSAL_TERKINI_TIDAK_TERSEDIA');
  if (!reviewers.length) reasons.push('REVIEWER_AKTIF_BELUM_ADA');
  if (reviewItems.some((row) => row.hasil_versi_terkini !== 'LAYAK')) reasons.push('REVIEW_TERKINI_BELUM_LAYAK');
  return { status_finalisasi: supervisor ? 'SUDAH_DITETAPKAN'
    : reasons.length ? 'BELUM_SIAP' : 'SIAP_DITETAPKAN',
  is_eligible: !supervisor && reasons.length === 0, alasan: reasons,
  jumlah_reviewer_aktif: reviewers.length,
  jumlah_layak_versi_terkini: reviewItems.filter((row) => row.hasil_versi_terkini === 'LAYAK').length,
  proposal_terkini: proposal, reviewer: reviewItems, pembimbing: supervisor };
}

function publicDetail(item) {
  const { dokumen_pengajuan, penugasan_dosen, bimbingan, ...base } = item;
  return { ...base, ...getKelayakanPenetapan(item),
    status_bimbingan: bimbingan.length ? 'SUDAH_DIMULAI' : 'BELUM_DIMULAI' };
}

export async function listFinalisasiKp(prisma, actorUserId, query) {
  const prodiId = await prodiScope(prisma, actorUserId);
  const where = { ...whereApplication(prodiId), status_pengajuan: { not: 'DRAFT' },
    ...(query.periode ? { periode_akademik_id: query.periode } : {}),
    ...(query.q ? { OR: [
      { mahasiswa: { nim: { contains: query.q, mode: 'insensitive' } } },
      { mahasiswa: { nama_lengkap: { contains: query.q, mode: 'insensitive' } } },
      { versi_topik: { judul_penelitian: { contains: query.q, mode: 'insensitive' } } },
    ] } : {}),
    ...(query.pembimbing_id ? { penugasan_dosen: { some: {
      ...activeSupervisor, dosen_id: query.pembimbing_id } } } : {}),
  };
  // Satu query terbatasi Prodi; status turunan difilter sebelum pagination.
  const rows = await prisma.pengajuan.findMany({ where,
    orderBy: query.sort === 'lama' ? [{ diajukan_at: 'asc' }, { id: 'asc' }]
      : [{ diajukan_at: 'desc' }, { id: 'desc' }], select: detailSelect });
  const mapped = rows.map(publicDetail);
  const filtered = query.status_finalisasi ? mapped.filter((row) =>
    row.status_finalisasi === query.status_finalisasi) : mapped;
  const total = filtered.length;
  const summary = { total: mapped.length, belumSiap: 0, siapDitetapkan: 0, sudahDitetapkan: 0 };
  const counters = { BELUM_SIAP: 'belumSiap', SIAP_DITETAPKAN: 'siapDitetapkan', SUDAH_DITETAPKAN: 'sudahDitetapkan' };
  for (const row of mapped) summary[counters[row.status_finalisasi]]++;
  return { summary, items: filtered.slice((query.page - 1) * query.limit, query.page * query.limit),
    pagination: { page: query.page, limit: query.limit, total,
      total_pages: Math.ceil(total / query.limit) } };
}

export async function getFinalisasiKp(prisma, actorUserId, id) {
  const prodiId = await prodiScope(prisma, actorUserId);
  return publicDetail(await scopedApplication(prisma, id, prodiId));
}

function candidateWhere(prodiId) {
  return { program_studi_id: prodiId, status_data: 'AKTIF',
    user: { status_akun: 'AKTIF', user_roles_diperoleh: { some: {
      role: { kode_peran: 'PEMBIMBING' } } } } };
}

async function candidate(prisma, id, prodiId) {
  const row = await prisma.dosen.findFirst({ where: { id, ...candidateWhere(prodiId) },
    select: { id: true, nama_lengkap: true, kode_dosen: true } });
  if (!row) throw new FinalisasiKpError(422, 'INVALID_SUPERVISOR', 'Dosen bukan kandidat Pembimbing aktif pada Prodi ini.');
  return row;
}

export async function listKandidatPembimbingKp(prisma, actorUserId, query) {
  const prodiId = await prodiScope(prisma, actorUserId);
  let application = null;
  if (query.pengajuan_id) application = await scopedApplication(prisma, query.pengajuan_id, prodiId);
  const where = { ...candidateWhere(prodiId), ...(query.q ? { OR: [
    { nama_lengkap: { contains: query.q, mode: 'insensitive' } },
    { kode_dosen: { contains: query.q, mode: 'insensitive' } },
  ] } : {}) };
  const [items, total] = await Promise.all([
    prisma.dosen.findMany({ where, orderBy: [{ nama_lengkap: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit, take: query.limit,
      select: { id: true, kode_dosen: true, nama_lengkap: true,
        _count: { select: { penugasan_dosen: { where: activeSupervisor } } } } }),
    prisma.dosen.count({ where }),
  ]);
  return { items: items.map(({ _count, ...row }) => ({ ...row,
    jumlah_penugasan_pembimbing_aktif: _count.penugasan_dosen,
    is_usulan: row.id === application?.usulan_pembimbing_id })),
  pagination: { page: query.page, limit: query.limit, total,
    total_pages: Math.ceil(total / query.limit) } };
}

async function lock(tx, id) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261108, ${id}::int) IS NULL AS locked`;
}

export function assignPembimbingKpBulk(prisma, actorUserId, assignments) {
  return afterKpChange(prisma, 'pengajuan.assignment.updated',
    () => assignPembimbingBulk(prisma, actorUserId, assignments),
    (result) => result.items.filter((item) => item.result === 'created').map((item) => item.pengajuan_id));
}

async function assignPembimbingBulk(prisma, actorUserId, assignments) {
  return serializable(prisma, async (tx) => {
    const prodiId = await prodiScope(tx, actorUserId);
    const results = [];
    for (const mapping of [...assignments].sort((a, b) => a.pengajuan_id - b.pengajuan_id)) {
      const { pengajuan_id: id, dosen_id: dosenId, expected_dokumen_pengajuan_id: expected } = mapping;
      await lock(tx, id);
      const item = await scopedApplication(tx, id, prodiId);
      const readiness = getKelayakanPenetapan(item);
      if (readiness.pembimbing) {
        if (readiness.pembimbing.dosen_id !== dosenId) throw new FinalisasiKpError(409,
          'SUPERVISOR_ALREADY_ASSIGNED', 'Pembimbing berbeda sudah aktif; gunakan penggantian.',
          [{ pengajuan_id: id, code: 'SUPERVISOR_ALREADY_ASSIGNED' }]);
        results.push({ pengajuan_id: id, dosen_id: dosenId,
          penugasan_id: readiness.pembimbing.id, result: 'already_assigned' });
        continue;
      }
      if (readiness.proposal_terkini?.id !== expected) throw new FinalisasiKpError(409,
        'STALE_PROPOSAL', 'Versi proposal berubah; muat ulang.',
        [{ pengajuan_id: id, code: 'STALE_PROPOSAL' }]);
      if (!readiness.is_eligible) throw new FinalisasiKpError(409,
        'APPLICATION_NOT_READY', 'Pengajuan belum siap ditetapkan.',
        [{ pengajuan_id: id, code: 'APPLICATION_NOT_READY', alasan: readiness.alasan }]);
      await candidate(tx, dosenId, prodiId);
      const created = await tx.penugasanDosen.create({ data: {
        pengajuan_id: id, dosen_id: dosenId, jenis_penugasan: 'PEMBIMBING',
        sumber_penugasan: 'KAPRODI', status_penugasan: 'AKTIF',
        ditetapkan_oleh_user_id: actorUserId, mulai_at: new Date(),
      }, select: { id: true } });
      await createNotifikasi(tx, { kategori: 'KEPUTUSAN_KP',
        judul: 'Pembimbing KP ditetapkan',
        pesan: 'Kaprodi telah menetapkan Dosen Pembimbing KP Anda.',
        route: '/mahasiswa/pengajuan/kp', actorUserId,
        recipientIds: [await studentRecipient(tx, id)],
      });
      results.push({ pengajuan_id: id, dosen_id: dosenId,
        penugasan_id: created.id, result: 'created' });
    }
    return { created: results.filter((row) => row.result === 'created').length,
      already_assigned: results.filter((row) => row.result === 'already_assigned').length,
      items: results };
  });
}

export async function assignPembimbingKp(prisma, actorUserId, id, input) {
  const result = await assignPembimbingKpBulk(prisma, actorUserId, [{ pengajuan_id: id, ...input }]);
  return result.items[0];
}

export async function listPenugasanPembimbingKp(prisma, actorUserId, query) {
  const prodiId = await prodiScope(prisma, actorUserId);
  const where = { jenis_penugasan: 'PEMBIMBING',
    pengajuan: { ...whereApplication(prodiId),
      ...(query.periode ? { periode_akademik_id: query.periode } : {}) },
    ...(query.dosen_id ? { dosen_id: query.dosen_id } : {}),
    ...(query.status ? { status_penugasan: query.status } : {}) };
  const [items, total] = await Promise.all([
    prisma.penugasanDosen.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit, take: query.limit,
      select: { ...assignmentSelect, pengajuan: { select: { id: true,
        mahasiswa: { select: { nim: true, nama_lengkap: true } },
        periode_akademik: { select: { tahun_ajaran: true, semester: true } },
        versi_topik: { select: { judul_penelitian: true } },
        _count: { select: { bimbingan: true } } } } } }),
    prisma.penugasanDosen.count({ where }),
  ]);
  return { items: items.map(({ pengajuan, ...row }) => ({ ...row,
    pengajuan: { id: pengajuan.id, mahasiswa: pengajuan.mahasiswa,
      periode_akademik: pengajuan.periode_akademik, versi_topik: pengajuan.versi_topik },
    status_bimbingan: pengajuan._count.bimbingan > 0 ? 'SUDAH_DIMULAI' : 'BELUM_DIMULAI',
  })), pagination: { page: query.page, limit: query.limit, total,
    total_pages: Math.ceil(total / query.limit) } };
}

export function replacePembimbingKp(prisma, actorUserId, id, newDosenId, reason) {
  return afterKpChange(prisma, 'pengajuan.assignment.updated',
    () => replacePembimbing(prisma, actorUserId, id, newDosenId, reason), [id]);
}

async function replacePembimbing(prisma, actorUserId, id, newDosenId, reason) {
  return serializable(prisma, async (tx) => {
    const prodiId = await prodiScope(tx, actorUserId);
    await lock(tx, id);
    const item = await scopedApplication(tx, id, prodiId);
    const old = getKelayakanPenetapan(item).pembimbing;
    if (!old) throw new FinalisasiKpError(409, 'SUPERVISOR_NOT_ASSIGNED', 'Pembimbing aktif tidak ditemukan.');
    if (old.dosen_id === newDosenId) throw new FinalisasiKpError(409, 'SAME_SUPERVISOR', 'Pembimbing pengganti harus berbeda.');
    // Semua record bimbingan, termasuk draft/offline, dianggap aktivitas; fail closed.
    if (await tx.bimbingan.count({ where: { pengajuan_id: id } }) > 0) throw new FinalisasiKpError(409,
      'SUPERVISION_STARTED', 'Bimbingan sudah dimulai; penggantian tidak tersedia.');
    await candidate(tx, newDosenId, prodiId);
    const now = new Date();
    await tx.penugasanDosen.update({ where: { id: old.id }, data: {
      status_penugasan: 'NONAKTIF', berakhir_at: now, alasan_perubahan: reason } });
    const created = await tx.penugasanDosen.create({ data: {
      pengajuan_id: id, dosen_id: newDosenId, jenis_penugasan: 'PEMBIMBING',
      sumber_penugasan: 'KAPRODI', status_penugasan: 'AKTIF',
      asal_penugasan_id: old.id, ditetapkan_oleh_user_id: actorUserId, mulai_at: now,
    }, select: { id: true } });
    await tx.auditLog.create({ data: { aktor_user_id: actorUserId,
      aksi: 'KP_PEMBIMBING_GANTI', entitas: 'PenugasanDosen', entitas_id: BigInt(created.id),
      data_sebelum: { penugasan_id: old.id, dosen_id: old.dosen_id },
      data_sesudah: { penugasan_id: created.id, dosen_id: newDosenId }, keterangan: reason } });
    await createNotifikasi(tx, { kategori: 'KEPUTUSAN_KP',
      judul: 'Pembimbing KP diperbarui',
      pesan: 'Kaprodi telah mengganti Dosen Pembimbing KP Anda.',
      route: '/mahasiswa/pengajuan/kp', actorUserId,
      recipientIds: [await studentRecipient(tx, id)],
    });
    return { pengajuan_id: id, penugasan_lama_id: old.id,
      penugasan_baru_id: created.id, dosen_id_baru: newDosenId };
  });
}
