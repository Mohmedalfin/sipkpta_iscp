import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import {
  BIMBINGAN, BimbinganError, attachment, bulkValidate, createDraft, decision,
  detailStudent, detailSupervisor, historyStudent, listStudent, listSupervisor,
  progress, submit, updateDraft,
} from '../services/bimbingan.service.js';

const upload = multer({ storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3, fields: 2, parts: 5 } }).array('files', 3);

export const bimbinganUploadRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30,
  keyGenerator: (request) => String(request.auth.user.id), standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ success: false,
    error: { code: 'RATE_LIMITED', message: 'Terlalu banyak unggahan bimbingan.' } }) });

function fail(error, response, next) {
  if (!Number.isInteger(error?.status) || typeof error?.code !== 'string') return next(error);
  response.status(error.status).json({ success: false,
    error: { code: error.code, message: error.message } });
}

function invalid(response) {
  response.status(400).json({ success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Input bimbingan tidak valid.' } });
}

function id(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2147483647 ? parsed : null;
}

function hasKeys(value, allowed, required = []) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key)) &&
    required.every((key) => Object.hasOwn(value, key));
}

function input(value, create = false) {
  if (!hasKeys(value, ['jenis_bimbingan', 'tanggal_bimbingan', 'ringkasan'],
    create ? ['jenis_bimbingan'] : []) ||
    (create && ![BIMBINGAN.OFFLINE, BIMBINGAN.ONLINE].includes(value.jenis_bimbingan)) ||
    (!create && (!Object.keys(value).length || Object.hasOwn(value, 'jenis_bimbingan')))) return null;
  return value;
}

function filters(query, supervisor = false) {
  const allowed = ['page', 'limit', 'jenis_bimbingan', 'status_bimbingan',
    ...(supervisor ? ['pengajuan_id', 'mahasiswa_id', 'periode_id', 'q'] : [])];
  if (Object.keys(query).some((key) => !allowed.includes(key))) return null;
  const page = query.page === undefined ? 1 : id(query.page);
  const limit = query.limit === undefined ? 20 : id(query.limit);
  if (!page || !limit || limit > 100 ||
    query.jenis_bimbingan && ![BIMBINGAN.OFFLINE, BIMBINGAN.ONLINE].includes(query.jenis_bimbingan) ||
    query.status_bimbingan && ![BIMBINGAN.DRAFT, BIMBINGAN.MENUNGGU, BIMBINGAN.VALID,
      BIMBINGAN.REVISI, BIMBINGAN.DITOLAK].includes(query.status_bimbingan) ||
    ['pengajuan_id', 'mahasiswa_id', 'periode_id'].some((key) => query[key] !== undefined && !id(query[key])) ||
    query.q !== undefined && (typeof query.q !== 'string' || query.q.trim().length > 100)) return null;
  return { page, limit, jenis_bimbingan: query.jenis_bimbingan || null,
    status_bimbingan: query.status_bimbingan || null,
    pengajuan_id: query.pengajuan_id ? id(query.pengajuan_id) : null,
    mahasiswa_id: query.mahasiswa_id ? id(query.mahasiswa_id) : null,
    periode_id: query.periode_id ? id(query.periode_id) : null, q: query.q?.trim() || null };
}

function handler(service, parse, status = 200) {
  return async (request, response, next) => {
    const args = parse(request);
    if (!args) return invalid(response);
    try { response.status(status).json({ success: true,
      data: await service(request.app.locals.prisma, request.auth.user.id, ...args) }); }
    catch (error) { fail(error, response, next); }
  };
}

export const listStudentController = handler(listStudent, (r) => {
  const pengajuanId = id(r.params.pengajuanId);
  const query = filters(r.query);
  return pengajuanId && query ? [pengajuanId, query] : null;
});
export const createDraftController = handler(createDraft, (r) => {
  const pengajuanId = id(r.params.pengajuanId);
  const body = input(r.body, true);
  return pengajuanId && body ? [pengajuanId, body] : null;
}, 201);
export const detailStudentController = handler(detailStudent, (r) => {
  const pengajuanId = id(r.params.pengajuanId); const itemId = id(r.params.id);
  return pengajuanId && itemId ? [pengajuanId, itemId] : null;
});
export const updateDraftController = handler(updateDraft, (r) => {
  const pengajuanId = id(r.params.pengajuanId); const itemId = id(r.params.id);
  const body = input(r.body);
  return pengajuanId && itemId && body ? [pengajuanId, itemId, body] : null;
});
export const historyStudentController = handler(historyStudent, (r) => {
  const pengajuanId = id(r.params.pengajuanId); const itemId = id(r.params.id);
  return pengajuanId && itemId ? [pengajuanId, itemId] : null;
});
export const progressController = handler(progress, (r) => {
  const pengajuanId = id(r.params.pengajuanId);
  return pengajuanId ? [pengajuanId] : null;
});
export const listSupervisorController = handler(listSupervisor, (r) => {
  const query = filters(r.query, true);
  return query ? [query] : null;
});
export const detailSupervisorController = handler(detailSupervisor, (r) => {
  const itemId = id(r.params.id);
  return itemId ? [itemId] : null;
});

function decisionInput(value) {
  if (!hasKeys(value, ['expected_versi_pengiriman', 'hasil', 'catatan'],
    ['expected_versi_pengiriman', 'hasil']) ||
    !Number.isSafeInteger(value.expected_versi_pengiriman) || value.expected_versi_pengiriman < 1 ||
    ![BIMBINGAN.VALID, BIMBINGAN.REVISI, BIMBINGAN.DITOLAK].includes(value.hasil) ||
    value.catatan !== undefined && (typeof value.catatan !== 'string' || value.catatan.length > 10000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.catatan)) ||
    value.hasil !== BIMBINGAN.VALID && !value.catatan?.trim()) return null;
  return { ...value, catatan: value.catatan?.trim() || null };
}

export const decisionController = handler(decision, (r) => {
  const itemId = id(r.params.id); const body = decisionInput(r.body);
  return itemId && body ? [itemId, body] : null;
});
export const bulkController = handler(bulkValidate, (r) => {
  const body = r.body;
  if (!hasKeys(body, ['konfirmasi_sudah_diperiksa', 'items'], ['konfirmasi_sudah_diperiksa', 'items']) ||
    body.konfirmasi_sudah_diperiksa !== true || !Array.isArray(body.items) ||
    body.items.length < 1 || body.items.length > 20 ||
    body.items.some((item) => !hasKeys(item, ['bimbingan_id', 'expected_versi_pengiriman'],
      ['bimbingan_id', 'expected_versi_pengiriman']) ||
      !Number.isSafeInteger(item.bimbingan_id) || item.bimbingan_id < 1 ||
      !Number.isSafeInteger(item.expected_versi_pengiriman) || item.expected_versi_pengiriman < 1) ||
    new Set(body.items.map((item) => item.bimbingan_id)).size !== body.items.length) return null;
  return [body.items];
});

export function submitController(revision = false) {
  return (request, response, next) => {
    const pengajuanId = id(request.params.pengajuanId); const itemId = id(request.params.id);
    if (!pengajuanId || !itemId) return invalid(response);
    if (request.is('multipart/form-data')) {
      upload(request, response, async (error) => {
        if (error) return fail(new BimbinganError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
          'INVALID_DOCUMENT', 'Lampiran PDF tidak valid atau melebihi batas.'), response, next);
        await run();
      });
    } else if (request.is('application/json')) {
      request.files = [];
      void run();
    } else response.status(415).json({ success: false,
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Gunakan JSON atau multipart/form-data.' } });

    async function run() {
      const body = request.body;
      if (!hasKeys(body, ['ringkasan', 'tanggal_bimbingan'])) return invalid(response);
      try { response.status(200).json({ success: true,
        data: await submit(request.app.locals.prisma, request.auth.user.id,
          pengajuanId, itemId, body, request.files || [], revision) }); }
      catch (error) { fail(error, response, next); }
    }
  };
}

export function attachmentController(actor) {
  return async (request, response, next) => {
    const itemId = id(request.params.id); const fileId = id(request.params.lampiranId);
    const pengajuanId = actor === 'student' ? id(request.params.pengajuanId) : null;
    if (!itemId || !fileId || actor === 'student' && !pengajuanId) return invalid(response);
    try {
      const file = await attachment(request.app.locals.prisma, request.auth.user.id,
        itemId, fileId, actor, pengajuanId);
      response.set({ 'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${file.filename.replace(/["\\\r\n]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
      response.status(200).send(file.bytes);
    } catch (error) { fail(error, response, next); }
  };
}
