import {
  assignKpReviewerBulk, assignKpReviewers, deactivateKpReviewer,
  downloadKpForReviewer, getKpForReviewer, listKpForReviewer,
  listKpReviewers, listReviewerAssignments, listReviewerCandidates,
  replaceKpReviewer,
  PENUGASAN_REVIEWER_KP,
} from '../services/penugasan-reviewer-kp.service.js';

function invalid(response) {
  response.status(400).json({ success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Input penugasan tidak valid.' } });
}

function failure(error, response, next) {
  if (!Number.isInteger(error?.status) || typeof error?.code !== 'string') return next(error);
  response.status(error.status).json({ success: false,
    error: { code: error.code, message: error.message,
      ...(error.details ? { details: error.details } : {}) } });
}

function id(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2147483647 ? parsed : null;
}

function ids(value, limit) {
  if (!Array.isArray(value) || !value.length || value.length > limit ||
    value.some((item) => !Number.isSafeInteger(item) || item <= 0 || item > 2147483647) ||
    new Set(value).size !== value.length) return null;
  return value;
}

function body(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
}

function reason(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 2000 &&
    !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(trimmed) ? trimmed : null;
}

function query(request, kind) {
  const allowed = kind === 'applications'
    ? ['periode', 'status_pengajuan', 'status_penugasan_reviewer', 'q', 'page', 'limit', 'sort']
    : kind === 'candidates' ? ['q', 'page', 'limit', 'pengajuan_id']
      : ['dosen_id', 'periode', 'status', 'q', 'page', 'limit'];
  const input = request.query;
  if (Object.keys(input).some((key) => !allowed.includes(key))) return null;
  const page = input.page === undefined ? 1 : id(input.page);
  const limit = input.limit === undefined ? 20 : id(input.limit);
  const q = input.q === undefined ? '' : input.q;
  if (!page || !limit || limit > 100 || typeof q !== 'string' || q.trim().length > 100 ||
    input.periode !== undefined && !id(input.periode) ||
    input.pengajuan_id !== undefined && !id(input.pengajuan_id) ||
    input.dosen_id !== undefined && !id(input.dosen_id) ||
    input.status_pengajuan !== undefined && !['DIAJUKAN', 'ACC', 'TIDAK_ACC'].includes(input.status_pengajuan) ||
    input.status_penugasan_reviewer !== undefined &&
      !['BELUM_ADA', 'SUDAH_ADA'].includes(input.status_penugasan_reviewer) ||
    input.status !== undefined && ![
      PENUGASAN_REVIEWER_KP.AKTIF, PENUGASAN_REVIEWER_KP.NONAKTIF,
    ].includes(input.status) ||
    input.sort !== undefined && !['baru', 'lama'].includes(input.sort)) return null;
  return { page, limit, q: q.trim(), sort: input.sort || 'baru',
    periode: input.periode ? id(input.periode) : null,
    pengajuan_id: input.pengajuan_id ? id(input.pengajuan_id) : null,
    dosen_id: input.dosen_id ? id(input.dosen_id) : null,
    status_pengajuan: input.status_pengajuan || null,
    status_penugasan_reviewer: input.status_penugasan_reviewer || null,
    status: input.status || null };
}

function handler(prisma, service, parse, successStatus = 200) {
  return async (request, response, next) => {
    const args = parse(request, response);
    if (!args) return invalid(response);
    try { response.status(successStatus).json({ success: true,
      data: await service(prisma, ...args) }); }
    catch (error) { failure(error, response, next); }
  };
}

export function listKpForReviewerController(prisma) {
  return handler(prisma, listKpForReviewer, (request) => {
    const parsed = query(request, 'applications');
    return parsed ? [parsed] : null;
  });
}

export function getKpForReviewerController(prisma) {
  return handler(prisma, getKpForReviewer, (request) => {
    const parsed = id(request.params.id);
    return parsed ? [parsed] : null;
  });
}

export function downloadKpForReviewerController(prisma) {
  return async (request, response, next) => {
    const applicationId = id(request.params.id);
    const documentId = id(request.params.dokumenId);
    if (!applicationId || !documentId) return invalid(response);
    try {
      const file = await downloadKpForReviewer(prisma, applicationId, documentId);
      response.set({ 'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename="${file.filename.replace(/["\\\r\n]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
      response.status(200).send(file.bytes);
    } catch (error) { failure(error, response, next); }
  };
}

export function listReviewerCandidatesController(prisma) {
  return handler(prisma, listReviewerCandidates, (request) => {
    const parsed = query(request, 'candidates');
    return parsed ? [parsed] : null;
  });
}

export function listKpReviewersController(prisma) {
  return handler(prisma, listKpReviewers, (request) => {
    const parsed = id(request.params.id);
    return parsed ? [parsed] : null;
  });
}

export function listReviewerAssignmentsController(prisma) {
  return handler(prisma, listReviewerAssignments, (request) => {
    const parsed = query(request, 'assignments');
    return parsed ? [parsed] : null;
  });
}

export function assignKpReviewersController(prisma) {
  return handler(prisma, assignKpReviewers, (request) => {
    const applicationId = id(request.params.id);
    const dosenIds = body(request.body, ['dosen_ids']) && ids(request.body.dosen_ids, 20);
    return applicationId && dosenIds ? [applicationId, dosenIds, request.auth.user.id] : null;
  });
}

export function assignKpReviewerBulkController(prisma) {
  return handler(prisma, assignKpReviewerBulk, (request) => {
    const applicationIds = body(request.body, ['pengajuan_ids', 'dosen_id']) &&
      ids(request.body.pengajuan_ids, 100);
    const dosenId = request.body?.dosen_id;
    return applicationIds && Number.isSafeInteger(dosenId) && dosenId > 0 && dosenId <= 2147483647
      ? [applicationIds, dosenId, request.auth.user.id] : null;
  });
}

export function deactivateKpReviewerController(prisma) {
  return handler(prisma, deactivateKpReviewer, (request) => {
    const assignmentId = id(request.params.id);
    const why = body(request.body, ['alasan']) && reason(request.body.alasan);
    return assignmentId && why ? [assignmentId, why, request.auth.user.id] : null;
  });
}

export function replaceKpReviewerController(prisma) {
  return handler(prisma, replaceKpReviewer, (request) => {
    const assignmentId = id(request.params.id);
    const why = body(request.body, ['dosen_id_baru', 'alasan']) && reason(request.body.alasan);
    const dosenId = request.body?.dosen_id_baru;
    return assignmentId && why && Number.isSafeInteger(dosenId) && dosenId > 0 && dosenId <= 2147483647
      ? [assignmentId, dosenId, why, request.auth.user.id] : null;
  });
}
