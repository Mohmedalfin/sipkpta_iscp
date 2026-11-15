import { createNotifikasi } from './notifikasi.service.js';
import { authorizedProdiId } from './mahasiswa.service.js';
import { readPrivateDocument } from './data-diri.service.js';
import { serializable } from './pengajuan-kp.service.js';
import { afterKpChange } from './realtime.service.js';

export class PenugasanReviewerKpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const PENUGASAN_REVIEWER_KP = Object.freeze({
  JENIS: 'REVIEWER',
  SUMBER: 'KAPRODI',
  AKTIF: 'AKTIF',
  NONAKTIF: 'NONAKTIF',
});
const { JENIS, SUMBER, AKTIF, NONAKTIF } = PENUGASAN_REVIEWER_KP;
const reviewerWhere = { jenis_penugasan: JENIS, status_penugasan: AKTIF };
const context = { jenis_pengajuan: 'REGULER', pilihan_topik: 'BARU',
  tahap_akademik: { kode_tahap: 'KP' } };

async function scope(prisma) {
  try { return await authorizedProdiId(prisma); }
  catch (error) {
    if (error?.code === 'PRODI_SCOPE_UNAVAILABLE') {
      throw new PenugasanReviewerKpError(403, error.code, error.message);
    }
    throw error;
  }
}

function applicationWhere(prodiId) {
  return { ...context, mahasiswa: { program_studi_id: prodiId } };
}

function assignmentSelect() {
  return { id: true, pengajuan_id: true, dosen_id: true, jenis_penugasan: true,
    status_penugasan: true, sumber_penugasan: true, asal_penugasan_id: true,
    ditetapkan_oleh_user_id: true, mulai_at: true, berakhir_at: true,
    alasan_perubahan: true, created_at: true,
    dosen: { select: { id: true, kode_dosen: true, nama_lengkap: true } } };
}

async function application(prisma, id, prodiId) {
  const item = await prisma.pengajuan.findFirst({ where: { id, ...applicationWhere(prodiId) },
    select: { id: true, status_pengajuan: true, mahasiswa_id: true } });
  if (!item) throw new PenugasanReviewerKpError(404, 'APPLICATION_NOT_FOUND', 'Pengajuan tidak ditemukan.');
  return item;
}

function assignable(item) {
  return ['DIAJUKAN', 'ACC'].includes(item.status_pengajuan);
}

async function candidate(prisma, id, prodiId) {
  const dosen = await prisma.dosen.findFirst({ where: {
    id, program_studi_id: prodiId, status_data: AKTIF,
    user: { status_akun: AKTIF, user_roles_diperoleh: { some: {
      role: { kode_peran: JENIS },
    } } },
  }, select: { id: true, kode_dosen: true, nama_lengkap: true } });
  if (!dosen) throw new PenugasanReviewerKpError(422, 'INVALID_REVIEWER', 'Dosen bukan kandidat Reviewer aktif pada Prodi ini.');
  return dosen;
}

function pagination(query, total) {
  return { page: query.page, limit: query.limit, total,
    total_pages: Math.ceil(total / query.limit) };
}

export async function listKpForReviewer(prisma, query) {
  const prodiId = await scope(prisma);
  const activeFilter = query.status_penugasan_reviewer === 'BELUM_ADA'
    ? { none: reviewerWhere } : { some: reviewerWhere };
  const where = { ...applicationWhere(prodiId), status_pengajuan: query.status_pengajuan || { not: 'DRAFT' },
    ...(query.periode ? { periode_akademik_id: query.periode } : {}),
    ...(query.status_penugasan_reviewer ? { penugasan_dosen: activeFilter } : {}),
    ...(query.q ? { OR: [
      { mahasiswa: { nim: { contains: query.q, mode: 'insensitive' } } },
      { mahasiswa: { nama_lengkap: { contains: query.q, mode: 'insensitive' } } },
      { versi_topik: { judul_penelitian: { contains: query.q, mode: 'insensitive' } } },
    ] } : {}),
  };
  const orderBy = query.sort === 'lama' ? [{ diajukan_at: 'asc' }, { id: 'asc' }]
    : [{ diajukan_at: 'desc' }, { id: 'desc' }];
  const [items, total] = await Promise.all([
    prisma.pengajuan.findMany({ where, orderBy, skip: (query.page - 1) * query.limit,
      take: query.limit, select: { id: true, status_pengajuan: true,
        status_pemeriksaan_berkas: true, status_pemeriksaan_akademik: true,
        diajukan_at: true, mahasiswa: { select: { nim: true, nama_lengkap: true } },
        periode_akademik: { select: { id: true, tahun_ajaran: true, semester: true } },
        versi_topik: { select: { judul_penelitian: true } },
        _count: { select: { penugasan_dosen: { where: reviewerWhere } } },
      } }),
    prisma.pengajuan.count({ where }),
  ]);
  return { items: items.map(({ _count, ...item }) => ({ ...item,
    jumlah_reviewer_aktif: _count.penugasan_dosen })), pagination: pagination(query, total) };
}

export async function getKpForReviewer(prisma, id) {
  const prodiId = await scope(prisma);
  await application(prisma, id, prodiId);
  const item = await prisma.pengajuan.findUnique({ where: { id }, select: {
    id: true, status_pengajuan: true, status_pemeriksaan_berkas: true,
    status_pemeriksaan_akademik: true, diajukan_at: true,
    mahasiswa: { select: { nim: true, nama_lengkap: true } },
    periode_akademik: { select: { id: true, tahun_ajaran: true, semester: true } },
    topik_penelitian: { select: { tema_penelitian: { select: { nama_tema: true } } } },
    versi_topik: { select: { id: true, nomor_versi: true, judul_penelitian: true,
      objek_penelitian: true, lokasi_penelitian: true } },
    usulan_pembimbing: { select: { id: true, nama_lengkap: true } },
    dokumen_pengajuan: { where: { is_terkini: true,
      persyaratan_pengajuan: { jenis_dokumen: { kode_jenis: 'PROPOSAL_KP' } } },
    select: { id: true, nomor_versi: true, dokumen: { select: {
      nama_file_asli: true, mime_type: true, ukuran_bytes: true } } } },
    penugasan_dosen: { where: { jenis_penugasan: JENIS },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }], select: assignmentSelect() },
  } });
  return { ...item, dokumen_pengajuan: item.dokumen_pengajuan.map((doc) => ({ ...doc,
    dokumen: { ...doc.dokumen, ukuran_bytes: Number(doc.dokumen.ukuran_bytes) } })),
  jumlah_reviewer_aktif: item.penugasan_dosen.filter((row) => row.status_penugasan === AKTIF).length };
}

export async function downloadKpForReviewer(prisma, id, documentId) {
  const prodiId = await scope(prisma);
  await application(prisma, id, prodiId);
  const linked = await prisma.dokumenPengajuan.findFirst({ where: { id: documentId,
    pengajuan_id: id }, select: { dokumen: { select: {
      storage_key: true, nama_file_asli: true, mime_type: true } } } });
  if (!linked) throw new PenugasanReviewerKpError(404, 'DOCUMENT_NOT_FOUND', 'Dokumen tidak ditemukan.');
  try { return { bytes: await readPrivateDocument(linked.dokumen.storage_key),
    filename: linked.dokumen.nama_file_asli, mimeType: linked.dokumen.mime_type }; }
  catch (error) {
    if (error?.code === 'DOCUMENT_NOT_FOUND') {
      throw new PenugasanReviewerKpError(404, error.code, error.message);
    }
    throw error;
  }
}

export async function listReviewerCandidates(prisma, query) {
  const prodiId = await scope(prisma);
  if (query.pengajuan_id) await application(prisma, query.pengajuan_id, prodiId);
  const where = { program_studi_id: prodiId, status_data: AKTIF,
    user: { status_akun: AKTIF, user_roles_diperoleh: { some: {
      role: { kode_peran: JENIS } } } },
    ...(query.q ? { OR: [{ nama_lengkap: { contains: query.q, mode: 'insensitive' } },
      { kode_dosen: { contains: query.q, mode: 'insensitive' } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.dosen.findMany({ where, orderBy: [{ nama_lengkap: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit, take: query.limit,
      select: { id: true, kode_dosen: true, nama_lengkap: true,
        ...(query.pengajuan_id ? { penugasan_dosen: { where: {
          ...reviewerWhere, pengajuan_id: query.pengajuan_id,
        }, select: { pengajuan_id: true } } } : {}),
        _count: { select: { penugasan_dosen: { where: reviewerWhere } } },
      } }),
    prisma.dosen.count({ where }),
  ]);
  return { items: items.map(({ _count, penugasan_dosen, ...item }) => ({ ...item,
    jumlah_penugasan_reviewer_aktif: _count.penugasan_dosen,
    ...(query.pengajuan_id ? { sudah_ditugaskan: penugasan_dosen.length > 0 } : {}) })),
  pagination: pagination(query, total) };
}

export async function listKpReviewers(prisma, id) {
  const prodiId = await scope(prisma);
  await application(prisma, id, prodiId);
  const items = await prisma.penugasanDosen.findMany({ where: { pengajuan_id: id,
    jenis_penugasan: JENIS }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  select: assignmentSelect() });
  return { items, jumlah_reviewer_aktif: items.filter((row) => row.status_penugasan === AKTIF).length };
}

export async function listReviewerAssignments(prisma, query) {
  const prodiId = await scope(prisma);
  const where = { jenis_penugasan: JENIS,
    pengajuan: { ...applicationWhere(prodiId),
      ...(query.periode ? { periode_akademik_id: query.periode } : {}),
      ...(query.q ? { OR: [
        { mahasiswa: { nim: { contains: query.q, mode: 'insensitive' } } },
        { mahasiswa: { nama_lengkap: { contains: query.q, mode: 'insensitive' } } },
      ] } : {}) },
    ...(query.dosen_id ? { dosen_id: query.dosen_id } : {}),
    ...(query.status ? { status_penugasan: query.status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.penugasanDosen.findMany({ where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit, take: query.limit,
      select: { ...assignmentSelect(), pengajuan: { select: { id: true,
        status_pengajuan: true, mahasiswa: { select: { nim: true, nama_lengkap: true } },
        periode_akademik: { select: { tahun_ajaran: true, semester: true } },
        versi_topik: { select: { judul_penelitian: true } },
      } } } }),
    prisma.penugasanDosen.count({ where }),
  ]);
  return { items, pagination: pagination(query, total) };
}

async function lockApplication(tx, id) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261108, ${id}::int) IS NULL AS locked`;
}

async function requireReviewerMutable(tx, id) {
  const assigned = await tx.penugasanDosen.findFirst({ where: {
    pengajuan_id: id, jenis_penugasan: 'PEMBIMBING', status_penugasan: AKTIF,
  }, select: { id: true } });
  if (assigned) throw new PenugasanReviewerKpError(409, 'APPLICATION_FINALIZED',
    'Pembimbing sudah ditetapkan; penugasan Reviewer terkunci.');
}

async function createAssignments(tx, applicationIds, dosenIds, actorUserId, prodiId) {
  const results = [];
  const errors = [];
  for (const id of applicationIds) {
    await lockApplication(tx, id);
    await requireReviewerMutable(tx, id);
    const item = await tx.pengajuan.findFirst({ where: { id, ...applicationWhere(prodiId) },
      select: { id: true, status_pengajuan: true } });
    if (!item) errors.push({ pengajuan_id: id, code: 'APPLICATION_NOT_FOUND' });
    else if (!assignable(item)) errors.push({ pengajuan_id: id, code: 'APPLICATION_NOT_ASSIGNABLE' });
  }
  if (errors.length) throw new PenugasanReviewerKpError(422, 'INVALID_APPLICATIONS',
    'Satu atau lebih pengajuan tidak dapat ditugaskan.', errors);
  for (const dosenId of dosenIds) await candidate(tx, dosenId, prodiId);
  for (const id of applicationIds) {
    for (const dosenId of dosenIds) {
      const existing = await tx.penugasanDosen.findFirst({ where: { pengajuan_id: id,
        dosen_id: dosenId, ...reviewerWhere }, select: { id: true } });
      if (existing) {
        results.push({ pengajuan_id: id, dosen_id: dosenId,
          penugasan_id: existing.id, result: 'already_assigned' });
        continue;
      }
      const created = await tx.penugasanDosen.create({ data: {
        pengajuan_id: id, dosen_id: dosenId, jenis_penugasan: JENIS,
        sumber_penugasan: SUMBER, ditetapkan_oleh_user_id: actorUserId,
      }, select: { id: true } });
      const reviewer = await tx.dosen.findUnique({ where: { id: dosenId },
        select: { user_id: true } });
      await createNotifikasi(tx, { kategori: 'PENUGASAN_REVIEWER_KP',
        judul: 'Penugasan Reviewer KP', pesan: 'Anda mendapat penugasan review proposal KP.',
        route: '/reviewer/review-kp', actorUserId,
        recipientIds: [reviewer.user_id],
      });
      results.push({ pengajuan_id: id, dosen_id: dosenId,
        penugasan_id: created.id, result: 'created' });
    }
  }
  return { created: results.filter((row) => row.result === 'created').length,
    already_assigned: results.filter((row) => row.result === 'already_assigned').length,
    items: results };
}

export function assignKpReviewers(prisma, id, dosenIds, actorUserId) {
  return afterKpChange(prisma, 'pengajuan.assignment.updated',
    () => assignReviewers(prisma, id, dosenIds, actorUserId), (result) => result.created ? [id] : []);
}

export function assignKpReviewerBulk(prisma, ids, dosenId, actorUserId) {
  return afterKpChange(prisma, 'pengajuan.assignment.updated',
    () => assignBulk(prisma, ids, dosenId, actorUserId),
    (result) => result.items.filter((item) => item.result === 'created').map((item) => item.pengajuan_id));
}

export function deactivateKpReviewer(prisma, id, reason, actorUserId) {
  return afterKpChange(prisma, 'pengajuan.assignment.updated',
    () => deactivateReviewer(prisma, id, reason, actorUserId), async () => {
      const row = await prisma.penugasanDosen.findUnique({ where: { id }, select: { pengajuan_id: true } });
      return row ? [row.pengajuan_id] : [];
    });
}

export function replaceKpReviewer(prisma, id, newDosenId, reason, actorUserId) {
  return afterKpChange(prisma, 'pengajuan.assignment.updated',
    () => replaceReviewer(prisma, id, newDosenId, reason, actorUserId), (result) => [result.pengajuan_id]);
}

async function assignReviewers(prisma, id, dosenIds, actorUserId) {
  return serializable(prisma, async (tx) => {
    const prodiId = await scope(tx);
    return createAssignments(tx, [id], dosenIds, actorUserId, prodiId);
  });
}

async function assignBulk(prisma, ids, dosenId, actorUserId) {
  return serializable(prisma, async (tx) => {
    const prodiId = await scope(tx);
    return createAssignments(tx, [...ids].sort((a, b) => a - b), [dosenId], actorUserId, prodiId);
  });
}

async function activeAssignment(tx, id, prodiId) {
  const row = await tx.penugasanDosen.findFirst({ where: { id, ...reviewerWhere,
    pengajuan: applicationWhere(prodiId) }, select: {
    id: true, pengajuan_id: true, dosen_id: true,
  } });
  if (!row) throw new PenugasanReviewerKpError(404, 'ASSIGNMENT_NOT_FOUND', 'Penugasan aktif tidak ditemukan.');
  return row;
}

async function endAssignment(tx, row, reason, actorUserId) {
  const now = new Date();
  await tx.penugasanDosen.update({ where: { id: row.id }, data: {
    status_penugasan: NONAKTIF, berakhir_at: now, alasan_perubahan: reason,
  } });
  await tx.auditLog.create({ data: { aktor_user_id: actorUserId,
    aksi: 'KP_REVIEWER_NONAKTIF', entitas: 'PenugasanDosen', entitas_id: BigInt(row.id),
    data_sebelum: { status_penugasan: AKTIF, dosen_id: row.dosen_id },
    data_sesudah: { status_penugasan: NONAKTIF, berakhir_at: now.toISOString() },
    keterangan: reason,
  } });
}

async function deactivateReviewer(prisma, id, reason, actorUserId) {
  return serializable(prisma, async (tx) => {
    const prodiId = await scope(tx);
    const initial = await activeAssignment(tx, id, prodiId);
    await lockApplication(tx, initial.pengajuan_id);
    await requireReviewerMutable(tx, initial.pengajuan_id);
    const row = await activeAssignment(tx, id, prodiId);
    await endAssignment(tx, row, reason, actorUserId);
    return { id: row.id, status_penugasan: NONAKTIF };
  });
}

async function replaceReviewer(prisma, id, newDosenId, reason, actorUserId) {
  return serializable(prisma, async (tx) => {
    const prodiId = await scope(tx);
    const initial = await activeAssignment(tx, id, prodiId);
    await lockApplication(tx, initial.pengajuan_id);
    await requireReviewerMutable(tx, initial.pengajuan_id);
    const row = await activeAssignment(tx, id, prodiId);
    const item = await application(tx, row.pengajuan_id, prodiId);
    if (!assignable(item)) throw new PenugasanReviewerKpError(409, 'APPLICATION_NOT_ASSIGNABLE',
      'Pengajuan tidak menerima Reviewer baru.');
    if (row.dosen_id === newDosenId) throw new PenugasanReviewerKpError(409,
      'SAME_REVIEWER', 'Reviewer pengganti harus berbeda.');
    await candidate(tx, newDosenId, prodiId);
    const existing = await tx.penugasanDosen.findFirst({ where: {
      pengajuan_id: row.pengajuan_id, dosen_id: newDosenId, ...reviewerWhere,
    }, select: { id: true } });
    if (existing) throw new PenugasanReviewerKpError(409, 'REVIEWER_ALREADY_ASSIGNED',
      'Reviewer pengganti sudah aktif pada pengajuan ini.');
    await endAssignment(tx, row, reason, actorUserId);
    const created = await tx.penugasanDosen.create({ data: {
      pengajuan_id: row.pengajuan_id, dosen_id: newDosenId,
      jenis_penugasan: JENIS, sumber_penugasan: SUMBER,
      asal_penugasan_id: row.id, ditetapkan_oleh_user_id: actorUserId,
    }, select: { id: true } });
    await tx.auditLog.create({ data: { aktor_user_id: actorUserId,
      aksi: 'KP_REVIEWER_GANTI', entitas: 'PenugasanDosen', entitas_id: BigInt(created.id),
      data_sebelum: { penugasan_id: row.id, dosen_id: row.dosen_id },
      data_sesudah: { penugasan_id: created.id, dosen_id: newDosenId }, keterangan: reason,
    } });
    const reviewer = await tx.dosen.findUnique({ where: { id: newDosenId },
      select: { user_id: true } });
    await createNotifikasi(tx, { kategori: 'PENUGASAN_REVIEWER_KP',
      judul: 'Penugasan Reviewer KP', pesan: 'Anda mendapat penugasan review proposal KP.',
      route: '/reviewer/review-kp', actorUserId, recipientIds: [reviewer.user_id],
    });
    return { penugasan_lama_id: row.id, penugasan_baru_id: created.id,
      pengajuan_id: row.pengajuan_id, dosen_id_baru: newDosenId };
  });
}
