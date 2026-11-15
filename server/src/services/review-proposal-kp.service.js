import { createNotifikasi, reviewerRecipients, studentRecipient } from './notifikasi.service.js';
import { createHash, randomUUID } from 'node:crypto';
import {
  readPrivateDocument, removePrivateDocument, validatePdfDocument, writePrivateDocument,
} from './data-diri.service.js';
import { serializable } from './pengajuan-kp.service.js';
import { PENUGASAN_REVIEWER_KP } from './penugasan-reviewer-kp.service.js';
import { publishReviewChanges } from './realtime.service.js';
import { getBucketName, getSupabaseClient, isSupabaseStorageConfigured } from './storage.service.js';

export class ReviewKpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const HASIL_REVIEW_KP = Object.freeze({
  LAYAK: 'LAYAK', TIDAK_LAYAK: 'TIDAK_LAYAK', BELUM_DIREVIEW: 'BELUM_DIREVIEW',
});
const { LAYAK, TIDAK_LAYAK, BELUM_DIREVIEW } = HASIL_REVIEW_KP;
const MAX_ZIP_FILES = 50;
const MAX_ZIP_BYTES = 100 * 1024 * 1024;
const context = { jenis_pengajuan: 'REGULER', pilihan_topik: 'BARU',
  tahap_akademik: { kode_tahap: 'KP' } };
const activeReviewer = { jenis_penugasan: PENUGASAN_REVIEWER_KP.JENIS,
  status_penugasan: PENUGASAN_REVIEWER_KP.AKTIF };

async function reviewerProfile(prisma, userId) {
  const dosen = await prisma.dosen.findFirst({ where: { user_id: userId,
    status_data: 'AKTIF', user: { status_akun: 'AKTIF',
      user_roles_diperoleh: { some: { role: { kode_peran: 'REVIEWER' } } } },
  }, select: { id: true, program_studi_id: true } });
  if (!dosen) throw new ReviewKpError(403, 'REVIEWER_UNAVAILABLE', 'Profil Reviewer tidak tersedia.');
  return dosen;
}

async function ownedStudent(prisma, userId) {
  const student = await prisma.mahasiswa.findFirst({ where: { user_id: userId,
    status_data: 'AKTIF', user: { status_akun: 'AKTIF' } },
  select: { id: true } });
  if (!student) throw new ReviewKpError(404, 'STUDENT_NOT_FOUND', 'Mahasiswa tidak ditemukan.');
  return student;
}

async function reviewerAssignment(prisma, userId, applicationId) {
  const dosen = await reviewerProfile(prisma, userId);
  const row = await prisma.penugasanDosen.findFirst({ where: {
    pengajuan_id: applicationId, dosen_id: dosen.id, ...activeReviewer,
    pengajuan: { ...context, mahasiswa: { program_studi_id: dosen.program_studi_id } },
  }, select: { id: true, pengajuan_id: true, dosen_id: true } });
  if (!row) throw new ReviewKpError(403, 'ASSIGNMENT_REQUIRED', 'Penugasan Reviewer aktif diperlukan.');
  return row;
}

async function studentApplication(prisma, userId, applicationId) {
  const student = await ownedStudent(prisma, userId);
  const item = await prisma.pengajuan.findFirst({ where: { id: applicationId,
    mahasiswa_id: student.id, ...context },
  select: { id: true, status_pengajuan: true, versi_topik_id: true,
    status_pemeriksaan_berkas: true, status_pemeriksaan_akademik: true } });
  if (!item) throw new ReviewKpError(404, 'APPLICATION_NOT_FOUND', 'Pengajuan tidak ditemukan.');
  return item;
}

async function currentProposal(prisma, applicationId) {
  const proposal = await prisma.dokumenPengajuan.findFirst({ where: {
    pengajuan_id: applicationId, is_terkini: true,
    persyaratan_pengajuan: { jenis_dokumen: { kode_jenis: 'PROPOSAL_KP' } },
  }, select: { id: true, nomor_versi: true, persyaratan_pengajuan_id: true,
    created_at: true, dokumen: { select: { storage_key: true, nama_file_asli: true,
      mime_type: true, ukuran_bytes: true } } } });
  if (!proposal) throw new ReviewKpError(409, 'PROPOSAL_UNAVAILABLE', 'Proposal terkini tidak tersedia.');
  return proposal;
}

async function latestOnVersion(prisma, assignmentId, proposalId, topicVersionId) {
  return prisma.riwayatReview.findFirst({ where: {
    review_proposal: { penugasan_dosen_id: assignmentId },
    dokumen_pengajuan_id: proposalId, versi_topik_id: topicVersionId,
  }, orderBy: [{ putaran_ke: 'desc' }, { id: 'desc' }], select: {
    id: true, hasil_review: true, catatan_reviewer: true, reviewed_at: true,
    dokumen_pengajuan_id: true, versi_topik_id: true,
  } });
}

function publicHistory(row) {
  return { ...row, id: row.id.toString() };
}

async function proposalRevisionNotes(prisma, proposalIds) {
  if (!proposalIds.length) return [];
  const rows = await prisma.auditLog.findMany({ where: {
    aksi: 'KP_REVISI_PROPOSAL', entitas: 'DokumenPengajuan',
    entitas_id: { in: proposalIds.map((id) => BigInt(id)) },
  }, orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
  select: { entitas_id: true, keterangan: true, created_at: true, data_sesudah: true } });
  return rows.map((row) => ({
    dokumen_pengajuan_id: Number(row.entitas_id),
    nomor_versi: row.data_sesudah?.nomor_versi ?? null,
    catatan_perbaikan: row.keterangan,
    created_at: row.created_at,
  }));
}

async function statusFor(prisma, assignmentId, proposalId, topicVersionId) {
  const latest = await latestOnVersion(prisma, assignmentId, proposalId, topicVersionId);
  return latest?.hasil_review ?? BELUM_DIREVIEW;
}

async function task(prisma, assignmentId) {
  const row = await prisma.penugasanDosen.findUnique({ where: { id: assignmentId }, select: {
    id: true, pengajuan_id: true, pengajuan: { select: {
      id: true, status_pengajuan: true, diajukan_at: true, versi_topik_id: true,
      mahasiswa: { select: { nim: true, nama_lengkap: true } },
      periode_akademik: { select: { id: true, tahun_ajaran: true, semester: true } },
      versi_topik: { select: { judul_penelitian: true } },
    } },
  } });
  const proposal = await currentProposal(prisma, row.pengajuan_id);
  const review = await latestOnVersion(prisma, row.id, proposal.id,
    row.pengajuan.versi_topik_id);
  return taskSummary(row, proposal, review);
}

function taskSummary(row, proposal, review) {
  return { pengajuan_id: row.pengajuan_id, mahasiswa: row.pengajuan.mahasiswa,
    judul: row.pengajuan.versi_topik?.judul_penelitian ?? null,
    periode: row.pengajuan.periode_akademik,
    status_pengajuan: row.pengajuan.status_pengajuan,
    diajukan_at: row.pengajuan.diajukan_at,
    versi_proposal: { id: proposal.id, nomor_versi: proposal.nomor_versi,
      versi_topik_id: row.pengajuan.versi_topik_id },
    proposal_updated_at: proposal.created_at,
    review_saya: review?.hasil_review ?? BELUM_DIREVIEW,
    eligible_layak_bulk: !review && ['DIAJUKAN', 'ACC'].includes(row.pengajuan.status_pengajuan),
    alasan_tidak_eligible: review ? 'Sudah dinilai pada versi ini.'
      : ['DIAJUKAN', 'ACC'].includes(row.pengajuan.status_pengajuan)
        ? null : 'Pengajuan tidak dapat direview.' };
}

export async function listReviewerKpTasks(prisma, userId, query) {
  const dosen = await reviewerProfile(prisma, userId);
  const assignments = await prisma.penugasanDosen.findMany({ where: {
    dosen_id: dosen.id, ...activeReviewer,
    pengajuan: { ...context, mahasiswa: { program_studi_id: dosen.program_studi_id },
      status_pengajuan: { not: 'DRAFT' },
      ...(query.periode ? { periode_akademik_id: query.periode } : {}) },
  }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], select: {
    id: true, pengajuan_id: true, pengajuan: { select: {
      id: true, status_pengajuan: true, diajukan_at: true, versi_topik_id: true,
      mahasiswa: { select: { nim: true, nama_lengkap: true } },
      periode_akademik: { select: { id: true, tahun_ajaran: true, semester: true } },
      versi_topik: { select: { judul_penelitian: true } },
    } },
  } });
  const applicationIds = [...new Set(assignments.map((row) => row.pengajuan_id))];
  const proposals = applicationIds.length ? await prisma.dokumenPengajuan.findMany({ where: {
    pengajuan_id: { in: applicationIds }, is_terkini: true,
    persyaratan_pengajuan: { jenis_dokumen: { kode_jenis: 'PROPOSAL_KP' } },
  }, orderBy: { id: 'asc' }, select: { id: true, pengajuan_id: true,
    nomor_versi: true, created_at: true } }) : [];
  const proposalByApplication = new Map(proposals.map((row) => [row.pengajuan_id, row]));
  const reviews = proposals.length ? await prisma.riwayatReview.findMany({ where: {
    review_proposal: { penugasan_dosen_id: { in: assignments.map((row) => row.id) } },
    dokumen_pengajuan_id: { in: proposals.map((row) => row.id) },
  }, orderBy: [{ putaran_ke: 'desc' }, { id: 'desc' }], select: {
    id: true, hasil_review: true, dokumen_pengajuan_id: true, versi_topik_id: true,
    review_proposal: { select: { penugasan_dosen_id: true } },
  } }) : [];
  const reviewByAssignment = new Map();
  const assignmentById = new Map(assignments.map((row) => [row.id, row]));
  for (const review of reviews) {
    const assignmentId = review.review_proposal.penugasan_dosen_id;
    const assignment = assignmentById.get(assignmentId);
    if (!assignment || reviewByAssignment.has(assignmentId) ||
      review.dokumen_pengajuan_id !== proposalByApplication.get(assignment.pengajuan_id)?.id ||
      review.versi_topik_id !== assignment.pengajuan.versi_topik_id) continue;
    reviewByAssignment.set(assignmentId, review);
  }
  const tasks = assignments.map((row) => {
    const proposal = proposalByApplication.get(row.pengajuan_id);
    if (!proposal) throw new ReviewKpError(409, 'PROPOSAL_UNAVAILABLE',
      'Proposal terkini tidak tersedia.');
    return taskSummary(row, proposal, reviewByAssignment.get(row.id));
  });
  const filtered = tasks.filter((item) => (!query.q || [item.mahasiswa.nim,
    item.mahasiswa.nama_lengkap, item.judul].some((value) =>
    value?.toLowerCase().includes(query.q.toLowerCase()))) &&
    (!query.status_review || item.review_saya === query.status_review));
  return { items: filtered.slice((query.page - 1) * query.limit, query.page * query.limit),
    pagination: { page: query.page, limit: query.limit, total: filtered.length,
      total_pages: Math.ceil(filtered.length / query.limit) },
    jumlah_eligible_bulk: filtered.filter((item) => item.eligible_layak_bulk).length };
}

async function reviewHistory(prisma, assignmentId) {
  const rows = await prisma.riwayatReview.findMany({ where: {
    review_proposal: { penugasan_dosen_id: assignmentId },
  }, orderBy: [{ putaran_ke: 'asc' }, { id: 'asc' }], select: {
    id: true, putaran_ke: true, dokumen_pengajuan_id: true, versi_topik_id: true,
    hasil_review: true, catatan_reviewer: true, reviewed_at: true,
  } });
  return rows.map(publicHistory);
}

export async function getReviewerKpTask(prisma, userId, applicationId) {
  const assignment = await reviewerAssignment(prisma, userId, applicationId);
  const item = await task(prisma, assignment.id);
  const proposal = await currentProposal(prisma, applicationId);
  const [history, active, revisionNotes] = await Promise.all([
    reviewHistory(prisma, assignment.id),
    prisma.penugasanDosen.findMany({ where: { pengajuan_id: applicationId,
      ...activeReviewer }, select: { id: true } }),
    proposalRevisionNotes(prisma, [proposal.id]),
  ]);
  const results = await Promise.all(active.map((row) => statusFor(prisma, row.id,
    proposal.id, item.versi_proposal.versi_topik_id)));
  return { ...item, proposal: { id: proposal.id, nomor_versi: proposal.nomor_versi,
    nama_file_asli: proposal.dokumen.nama_file_asli,
    ukuran_bytes: Number(proposal.dokumen.ukuran_bytes),
    catatan_perbaikan: revisionNotes[0]?.catatan_perbaikan ?? null },
    riwayat_saya: history, rekap: { jumlah_reviewer_aktif: active.length,
      jumlah_layak_versi_terkini: results.filter((value) => value === LAYAK).length,
      review_selesai: active.length > 0 && results.every((value) => value === LAYAK) } };
}

export async function getReviewerKpHistory(prisma, userId, applicationId) {
  const assignment = await reviewerAssignment(prisma, userId, applicationId);
  return { items: await reviewHistory(prisma, assignment.id) };
}

export async function downloadReviewerKpProposal(prisma, userId, applicationId) {
  await reviewerAssignment(prisma, userId, applicationId);
  const proposal = await currentProposal(prisma, applicationId);
  try { return { bytes: await readPrivateDocument(proposal.dokumen.storage_key),
    filename: proposal.dokumen.nama_file_asli }; }
  catch (error) {
    if (error?.code === 'DOCUMENT_NOT_FOUND') {
      throw new ReviewKpError(404, error.code, error.message);
    }
    throw error;
  }
}

async function lock(prisma, id) {
  await prisma.$queryRaw`SELECT pg_advisory_xact_lock(20261108, ${id}::int) IS NULL AS locked`;
}

async function requireReviewMutable(tx, id) {
  const assigned = await tx.penugasanDosen.findFirst({ where: {
    pengajuan_id: id, jenis_penugasan: 'PEMBIMBING', status_penugasan: 'AKTIF',
  }, select: { id: true } });
  if (assigned) throw new ReviewKpError(409, 'APPLICATION_FINALIZED',
    'Pembimbing sudah ditetapkan; review proposal awal terkunci.');
}

async function reviewOne(tx, userId, id, expectedProposalId, expectedTopicId, result, note) {
  await requireReviewMutable(tx, id);
  const assignment = await reviewerAssignment(tx, userId, id);
  const application = await tx.pengajuan.findUnique({ where: { id },
    select: { status_pengajuan: true, versi_topik_id: true } });
  if (!['DIAJUKAN', 'ACC'].includes(application.status_pengajuan)) {
    throw new ReviewKpError(409, 'APPLICATION_LOCKED', 'Pengajuan tidak dapat direview.');
  }
  const proposal = await currentProposal(tx, id);
  if (proposal.dokumen.mime_type !== 'application/pdf') {
    throw new ReviewKpError(409, 'INVALID_PROPOSAL', 'Dokumen proposal bukan PDF yang sah.');
  }
  if (proposal.id !== expectedProposalId || application.versi_topik_id !== expectedTopicId) {
    throw new ReviewKpError(409, 'STALE_PROPOSAL', 'Versi proposal berubah. Muat ulang detail.');
  }
  const existing = await latestOnVersion(tx, assignment.id, proposal.id,
    application.versi_topik_id);
  if (existing) {
    if (existing.hasil_review === result && existing.catatan_reviewer === note) {
      return { pengajuan_id: id, result: 'already_reviewed', hasil_review: result };
    }
    throw new ReviewKpError(409, 'REVIEW_ALREADY_FINAL', 'Hasil pada versi ini sudah final.');
  }
  const review = await tx.reviewProposal.upsert({ where: {
    penugasan_dosen_id: assignment.id,
  }, create: { penugasan_dosen_id: assignment.id, status_review: result,
    hasil_review: result, catatan_akhir: note, mulai_review_at: new Date(),
    selesai_review_at: new Date() },
  update: { status_review: result, hasil_review: result, catatan_akhir: note,
    selesai_review_at: new Date() }, select: { id: true } });
  const count = await tx.riwayatReview.count({ where: { review_proposal_id: review.id } });
  if (count >= 32767) throw new ReviewKpError(409, 'REVIEW_LIMIT', 'Batas putaran review tercapai.');
  const history = await tx.riwayatReview.create({ data: {
    review_proposal_id: review.id, putaran_ke: count + 1,
    dokumen_pengajuan_id: proposal.id, versi_topik_id: application.versi_topik_id,
    hasil_review: result, catatan_reviewer: note, direview_oleh_user_id: userId,
    reviewed_at: new Date(),
  }, select: { id: true, putaran_ke: true } });
  await createNotifikasi(tx, { kategori: 'REVIEW_PROPOSAL_KP',
    judul: 'Hasil review proposal KP',
    pesan: result === 'LAYAK' ? 'Proposal KP dinyatakan layak oleh Reviewer.'
      : 'Proposal KP memerlukan revisi.',
    route: '/mahasiswa/pengajuan/kp', actorUserId: userId,
    recipientIds: [await studentRecipient(tx, id)],
  });
  return { pengajuan_id: id, result: 'created', hasil_review: result,
    riwayat_id: history.id.toString(), putaran_ke: history.putaran_ke };
}

export async function submitReviewerKpReview(prisma, userId, id, input) {
  const result = await serializable(prisma, async (tx) => {
    await lock(tx, id);
    return reviewOne(tx, userId, id, input.expected_dokumen_pengajuan_id,
      input.expected_versi_topik_id, input.hasil_review, input.catatan_reviewer);
  });
  if (result.result === 'created') await publishReviewChanges(prisma, [id]);
  return result;
}

export async function bulkLayakReviewerKp(prisma, userId, items) {
  const result = await serializable(prisma, async (tx) => {
    const results = [];
    for (const item of [...items].sort((a, b) => a.pengajuan_id - b.pengajuan_id)) {
      await lock(tx, item.pengajuan_id);
      const application = await tx.pengajuan.findUnique({ where: { id: item.pengajuan_id },
        select: { versi_topik_id: true } });
      if (!application) throw new ReviewKpError(403, 'ASSIGNMENT_REQUIRED',
        'Penugasan Reviewer aktif diperlukan.', [{ pengajuan_id: item.pengajuan_id,
          code: 'ASSIGNMENT_REQUIRED' }]);
      try {
        results.push(await reviewOne(tx, userId, item.pengajuan_id,
          item.expected_dokumen_pengajuan_id, application.versi_topik_id, LAYAK, null));
      } catch (error) {
        if (error instanceof ReviewKpError) error.details = [{ pengajuan_id: item.pengajuan_id,
          code: error.code }];
        throw error;
      }
    }
    return { created: results.filter((row) => row.result === 'created').length,
      already_layak: results.filter((row) => row.result === 'already_reviewed').length,
      total: results.length };
  });
  if (result.created) await publishReviewChanges(prisma, items.map((item) => item.pengajuan_id));
  return result;
}

export async function getOwnKpReviews(prisma, userId, id) {
  const application = await studentApplication(prisma, userId, id);
  const proposal = await currentProposal(prisma, id);
  const [assignments, proposalVersions] = await Promise.all([
    prisma.penugasanDosen.findMany({ where: {
    pengajuan_id: id, jenis_penugasan: PENUGASAN_REVIEWER_KP.JENIS,
  }, select: { id: true, status_penugasan: true,
    dosen: { select: { id: true, nama_lengkap: true } },
    review_proposal: { select: { riwayat_review: { orderBy: { putaran_ke: 'asc' },
      select: { id: true, putaran_ke: true, dokumen_pengajuan_id: true,
        versi_topik_id: true, hasil_review: true, catatan_reviewer: true,
        reviewed_at: true } } } },
  } }),
    prisma.dokumenPengajuan.findMany({ where: { pengajuan_id: id,
      persyaratan_pengajuan: { jenis_dokumen: { kode_jenis: 'PROPOSAL_KP' } },
    }, select: { id: true } }),
  ]);
  const revisionNotes = await proposalRevisionNotes(prisma, proposalVersions.map((row) => row.id));
  const items = assignments.map((row) => {
    const history = row.review_proposal?.riwayat_review ?? [];
    const current = history.find((event) => event.dokumen_pengajuan_id === proposal.id &&
      event.versi_topik_id === application.versi_topik_id);
    return { penugasan_id: row.id, reviewer: row.dosen,
      status_penugasan: row.status_penugasan,
      hasil_versi_terkini: row.status_penugasan === PENUGASAN_REVIEWER_KP.AKTIF
        ? current?.hasil_review ?? BELUM_DIREVIEW : null,
      riwayat: history.map(publicHistory) };
  });
  const active = items.filter((row) => row.status_penugasan === PENUGASAN_REVIEWER_KP.AKTIF);
  return { pengajuan_id: id, versi_proposal: proposal.nomor_versi,
    dokumen_pengajuan_id: proposal.id, items, riwayat_revisi: revisionNotes,
    rekap: { jumlah_reviewer_aktif: active.length,
      jumlah_layak_versi_terkini: active.filter((row) => row.hasil_versi_terkini === LAYAK).length,
      review_selesai: active.length > 0 && active.every((row) => row.hasil_versi_terkini === LAYAK) } };
}

export async function reviseOwnKpProposal(prisma, userId, id, expectedProposalId, file, revisionNote = null) {
  await studentApplication(prisma, userId, id);
  const initial = await currentProposal(prisma, id);
  if (initial.id !== expectedProposalId) {
    throw new ReviewKpError(409, 'STALE_PROPOSAL', 'Versi proposal berubah.');
  }
  const requirement = await prisma.persyaratanPengajuan.findUnique({
    where: { id: initial.persyaratan_pengajuan_id },
    select: { id: true, is_aktif: true, jenis_dokumen: { select: {
      is_aktif: true, kode_jenis: true, format_diizinkan: true, maks_ukuran_mb: true } } },
  });
  if (!requirement?.is_aktif || !requirement.jenis_dokumen.is_aktif ||
      requirement.jenis_dokumen.kode_jenis !== 'PROPOSAL_KP') {
    throw new ReviewKpError(409, 'REQUIREMENT_CHANGED', 'Persyaratan proposal berubah.');
  }
  let originalName;
  try { originalName = await validatePdfDocument(file, requirement.jenis_dokumen, 10 * 1024 * 1024); }
  catch (error) {
    if (Number.isInteger(error?.status)) throw new ReviewKpError(error.status, error.code, error.message);
    throw error;
  }
  const storageKey = `pengajuan/${randomUUID()}.pdf`;
  if (isSupabaseStorageConfigured()) {
    const { data: bucket, error } = await getSupabaseClient().storage.getBucket(getBucketName());
    if (error || bucket?.public !== false) {
      throw new ReviewKpError(503, 'PRIVATE_STORAGE_UNAVAILABLE', 'Penyimpanan proposal privat tidak tersedia.');
    }
  }
  try {
    await writePrivateDocument(storageKey, file.buffer);
    const result = await serializable(prisma, async (tx) => {
      await lock(tx, id);
      await requireReviewMutable(tx, id);
      const application = await studentApplication(tx, userId, id);
      if (!['DIAJUKAN', 'ACC'].includes(application.status_pengajuan)) {
        throw new ReviewKpError(409, 'APPLICATION_LOCKED', 'Pengajuan tidak dapat direvisi.');
      }
      const current = await currentProposal(tx, id);
      if (current.id !== expectedProposalId) {
        throw new ReviewKpError(409, 'STALE_PROPOSAL', 'Versi proposal berubah.');
      }
      const active = await tx.penugasanDosen.findMany({ where: {
        pengajuan_id: id, ...activeReviewer,
      }, select: { id: true } });
      const results = await Promise.all(active.map((row) => statusFor(tx, row.id,
        current.id, application.versi_topik_id)));
      if (!results.includes(TIDAK_LAYAK)) {
        throw new ReviewKpError(409, 'REVISION_NOT_ALLOWED',
          'Belum ada hasil TIDAK_LAYAK pada proposal terkini.');
      }
      await tx.dokumenPengajuan.update({ where: { id: current.id }, data: { is_terkini: false } });
      const document = await tx.dokumen.create({ data: {
        diunggah_oleh_user_id: userId, nama_file_asli: originalName,
        storage_key: storageKey, mime_type: 'application/pdf',
        ukuran_bytes: BigInt(file.buffer.length),
        checksum_sha256: createHash('sha256').update(file.buffer).digest('hex'),
      }, select: { id: true } });
      const next = await tx.dokumenPengajuan.create({ data: {
        pengajuan_id: id, persyaratan_pengajuan_id: current.persyaratan_pengajuan_id,
        dokumen_id: document.id, nomor_versi: current.nomor_versi + 1,
      }, select: { id: true, nomor_versi: true } });
      await tx.auditLog.create({ data: {
        aktor_user_id: userId, aksi: 'KP_REVISI_PROPOSAL',
        entitas: 'DokumenPengajuan', entitas_id: BigInt(next.id),
        data_sebelum: { dokumen_pengajuan_id: current.id, nomor_versi: current.nomor_versi },
        data_sesudah: { dokumen_pengajuan_id: next.id, nomor_versi: next.nomor_versi,
          pengajuan_id: id },
        keterangan: revisionNote,
      } });
      await createNotifikasi(tx, { kategori: 'REVISI_PROPOSAL_KP',
        judul: 'Revisi proposal KP baru',
        pesan: 'Mahasiswa telah mengirim revisi proposal KP.',
        route: '/reviewer/review-kp', actorUserId: userId,
        recipientIds: await reviewerRecipients(tx, id),
      });
      return { pengajuan_id: id, dokumen_pengajuan_id: next.id,
        nomor_versi: next.nomor_versi, catatan_perbaikan: revisionNote };
    });
    await publishReviewChanges(prisma, [id]);
    return result;
  } catch (error) {
    try { await removePrivateDocument(storageKey, { strict: true }); }
    catch { console.error('Gagal membersihkan revisi proposal setelah transaksi gagal.'); }
    throw error;
  }
}

export async function prepareReviewerKpZip(prisma, userId, scope, selectedIds) {
  const dosen = await reviewerProfile(prisma, userId);
  const ids = scope === 'ALL_ASSIGNED'
    ? (await prisma.penugasanDosen.findMany({ where: { dosen_id: dosen.id,
      ...activeReviewer, pengajuan: { ...context,
        mahasiswa: { program_studi_id: dosen.program_studi_id } } },
    select: { pengajuan_id: true }, orderBy: { pengajuan_id: 'asc' },
    take: MAX_ZIP_FILES + 1 })).map((row) => row.pengajuan_id)
    : selectedIds;
  if (!ids.length) throw new ReviewKpError(422, 'NO_PROPOSALS', 'Tidak ada proposal untuk diunduh.');
  if (ids.length > MAX_ZIP_FILES) throw new ReviewKpError(413, 'ZIP_LIMIT', 'Maksimal 50 proposal per ZIP.');
  const entries = [];
  let totalBytes = 0;
  let actualBytes = 0;
  for (const id of ids) {
    await reviewerAssignment(prisma, userId, id);
    const proposal = await currentProposal(prisma, id);
    if (proposal.dokumen.mime_type !== 'application/pdf') {
      throw new ReviewKpError(409, 'INVALID_PROPOSAL', 'Dokumen proposal bukan PDF yang sah.');
    }
    totalBytes += Number(proposal.dokumen.ukuran_bytes);
    if (totalBytes > MAX_ZIP_BYTES) {
      throw new ReviewKpError(413, 'ZIP_LIMIT', 'Total proposal melebihi 100 MB.');
    }
    const student = await prisma.pengajuan.findUnique({ where: { id },
      select: { mahasiswa: { select: { nim: true } } } });
    const safeNim = student.mahasiswa.nim.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
    let bytes;
    try { bytes = await readPrivateDocument(proposal.dokumen.storage_key); }
    catch (error) {
      if (error?.code === 'DOCUMENT_NOT_FOUND') {
        throw new ReviewKpError(404, error.code, error.message);
      }
      throw error;
    }
    actualBytes += bytes.length;
    if (actualBytes > MAX_ZIP_BYTES) {
      throw new ReviewKpError(413, 'ZIP_LIMIT', 'Total proposal melebihi 100 MB.');
    }
    entries.push({ applicationId: id, proposalId: proposal.id,
      name: `Proposal_KP_${safeNim}_${id}_V${proposal.nomor_versi}.pdf`, bytes });
  }
  for (const entry of entries) {
    await reviewerAssignment(prisma, userId, entry.applicationId);
    if ((await currentProposal(prisma, entry.applicationId)).id !== entry.proposalId) {
      throw new ReviewKpError(409, 'STALE_PROPOSAL', 'Versi proposal berubah saat ZIP disiapkan.');
    }
  }
  return entries;
}
