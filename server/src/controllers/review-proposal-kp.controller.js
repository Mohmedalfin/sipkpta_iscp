import archiver from 'archiver';
import multer from 'multer';
import {
  HASIL_REVIEW_KP, bulkLayakReviewerKp, downloadReviewerKpProposal,
  getOwnKpReviews, getReviewerKpHistory, getReviewerKpTask,
  listReviewerKpTasks, prepareReviewerKpZip, reviseOwnKpProposal,
  submitReviewerKpReview,
} from '../services/review-proposal-kp.service.js';

const upload = multer({ storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2, parts: 3 },
}).single('file');

function invalid(response) {
  response.status(400).json({ success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Input review tidak valid.' } });
}

function failure(error, response, next) {
  if (!Number.isInteger(error?.status) || typeof error?.code !== 'string') return next(error);
  response.status(error.status).json({ success: false, error: {
    code: error.code, message: error.message,
    ...(error.details ? { details: error.details } : {}),
  } });
}

function id(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2147483647 ? parsed : null;
}

function exact(body, keys) {
  return body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === keys.length &&
    Object.keys(body).every((key) => keys.includes(key));
}

function note(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 5000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(trimmed)) return undefined;
  return trimmed || null;
}

function query(request) {
  const input = request.query;
  if (Object.keys(input).some((key) => !['page', 'limit', 'q', 'status_review', 'periode'].includes(key))) return null;
  const page = input.page === undefined ? 1 : id(input.page);
  const limit = input.limit === undefined ? 20 : id(input.limit);
  const q = input.q === undefined ? '' : input.q;
  if (!page || !limit || limit > 100 || typeof q !== 'string' || q.length > 100 ||
    input.periode !== undefined && !id(input.periode) ||
    input.status_review !== undefined && !Object.values(HASIL_REVIEW_KP).includes(input.status_review)) return null;
  return { page, limit, q: q.trim(), status_review: input.status_review || null,
    periode: input.periode ? id(input.periode) : null };
}

function handler(prisma, service, parser) {
  return async (request, response, next) => {
    const args = parser(request);
    if (!args) return invalid(response);
    try { response.status(200).json({ success: true, data: await service(prisma, ...args) }); }
    catch (error) { failure(error, response, next); }
  };
}

export function listReviewerKpTasksController(prisma) {
  return handler(prisma, listReviewerKpTasks, (request) => {
    const parsed = query(request);
    return parsed ? [request.auth.user.id, parsed] : null;
  });
}

export function getReviewerKpTaskController(prisma) {
  return handler(prisma, getReviewerKpTask, (request) => {
    const applicationId = id(request.params.id);
    return applicationId ? [request.auth.user.id, applicationId] : null;
  });
}

export function getReviewerKpHistoryController(prisma) {
  return handler(prisma, getReviewerKpHistory, (request) => {
    const applicationId = id(request.params.id);
    return applicationId ? [request.auth.user.id, applicationId] : null;
  });
}

export function downloadReviewerKpProposalController(prisma) {
  return async (request, response, next) => {
    const applicationId = id(request.params.id);
    if (!applicationId) return invalid(response);
    try {
      const file = await downloadReviewerKpProposal(prisma, request.auth.user.id, applicationId);
      response.set({ 'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${file.filename.replace(/["\\\r\n]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
      response.status(200).send(file.bytes);
    } catch (error) { failure(error, response, next); }
  };
}

export function submitReviewerKpReviewController(prisma) {
  return handler(prisma, submitReviewerKpReview, (request) => {
    const applicationId = id(request.params.id);
    const body = request.body;
    if (!applicationId || !body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['hasil_review', 'catatan_reviewer',
        'expected_dokumen_pengajuan_id', 'expected_versi_topik_id'].includes(key))) return null;
    const parsedNote = note(body.catatan_reviewer);
    if (!Object.hasOwn(body, 'hasil_review') ||
      ![HASIL_REVIEW_KP.LAYAK, HASIL_REVIEW_KP.TIDAK_LAYAK].includes(body.hasil_review) ||
      !id(body.expected_dokumen_pengajuan_id) || !id(body.expected_versi_topik_id) ||
      parsedNote === undefined || body.hasil_review === HASIL_REVIEW_KP.TIDAK_LAYAK && !parsedNote) return null;
    return [request.auth.user.id, applicationId, {
      hasil_review: body.hasil_review, catatan_reviewer: parsedNote,
      expected_dokumen_pengajuan_id: id(body.expected_dokumen_pengajuan_id),
      expected_versi_topik_id: id(body.expected_versi_topik_id),
    }];
  });
}

export function bulkLayakReviewerKpController(prisma) {
  return handler(prisma, bulkLayakReviewerKp, (request) => {
    const body = request.body;
    if (!exact(body, ['items', 'konfirmasi']) || body.konfirmasi !== true ||
      !Array.isArray(body.items) || !body.items.length || body.items.length > 50 ||
      body.items.some((item) => !exact(item, ['pengajuan_id', 'expected_dokumen_pengajuan_id']) ||
        !id(item.pengajuan_id) || !id(item.expected_dokumen_pengajuan_id)) ||
      new Set(body.items.map((item) => id(item.pengajuan_id))).size !== body.items.length) return null;
    return [request.auth.user.id, body.items.map((item) => ({
      pengajuan_id: id(item.pengajuan_id),
      expected_dokumen_pengajuan_id: id(item.expected_dokumen_pengajuan_id),
    }))];
  });
}

export function downloadReviewerKpZipController(prisma) {
  return async (request, response, next) => {
    const body = request.body;
    const selected = exact(body, ['scope', 'pengajuan_ids']) && body.scope === 'SELECTED' &&
      Array.isArray(body.pengajuan_ids) && body.pengajuan_ids.length > 0 &&
      body.pengajuan_ids.length <= 50 && body.pengajuan_ids.every((value) => id(value)) &&
      new Set(body.pengajuan_ids.map(id)).size === body.pengajuan_ids.length;
    const all = exact(body, ['scope']) && body.scope === 'ALL_ASSIGNED';
    if (!selected && !all) return invalid(response);
    try {
      const entries = await prepareReviewerKpZip(prisma, request.auth.user.id,
        body.scope, selected ? body.pengajuan_ids.map(id) : []);
      response.set({ 'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="Proposal_KP_Reviewer.zip"',
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('error', (error) => {
        if (response.headersSent) response.destroy(error);
        else next(error);
      });
      archive.pipe(response);
      for (const entry of entries) archive.append(entry.bytes, { name: entry.name });
      await archive.finalize();
    } catch (error) { failure(error, response, next); }
  };
}

export function getOwnKpReviewsController(prisma) {
  return handler(prisma, getOwnKpReviews, (request) => {
    const applicationId = id(request.params.id);
    return applicationId ? [request.auth.user.id, applicationId] : null;
  });
}

export function reviseOwnKpProposalController(prisma) {
  return (request, response, next) => {
    const applicationId = id(request.params.id);
    if (!applicationId) return invalid(response);
    if (!request.is('multipart/form-data')) return response.status(415).json({ success: false,
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Gunakan multipart/form-data.' } });
    upload(request, response, async (error) => {
      if (error) return response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
        success: false, error: { code: 'INVALID_DOCUMENT', message: 'PDF tidak valid.' },
      });
      const expected = id(request.body?.expected_dokumen_pengajuan_id);
      const body = request.body;
      const revisionNote = note(body?.catatan_perbaikan);
      if (!expected || !request.file || !body ||
        Object.keys(body).some((key) => !['expected_dokumen_pengajuan_id', 'catatan_perbaikan'].includes(key)) ||
        revisionNote === undefined) return invalid(response);
      try { response.status(201).json({ success: true,
        data: await reviseOwnKpProposal(prisma, request.auth.user.id,
          applicationId, expected, request.file, revisionNote) }); }
      catch (uploadError) { failure(uploadError, response, next); }
    });
  };
}
