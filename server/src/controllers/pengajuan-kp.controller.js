import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import {
  PengajuanKpError,
  createKpDraft,
  downloadKpDocument,
  getKpFormOptions,
  getOwnKpApplication,
  listOwnKpApplications,
  reviseOwnKpApplication,
  sendOwnKpRevision,
  submitKpApplication,
  updateKpDraft,
  uploadKpDocument,
} from '../services/pengajuan-kp.service.js';

const FORM_FIELDS = [
  'tema_penelitian_id',
  'judul_penelitian',
  'objek_penelitian',
  'lokasi_penelitian',
  'usulan_pembimbing_id',
  'ipk_saat_pengajuan',
  'jumlah_sks_saat_pengajuan',
  'memiliki_nilai_de',
  'daftar_mk_nilai_de',
  'sudah_bayar_spp_variabel',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, parts: 2 },
}).single('file');

export const pengajuanUploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (request) => String(request.auth.user.id),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Terlalu banyak unggahan dokumen.' },
  }),
});

function failure(error, response, next) {
  if (!(error instanceof PengajuanKpError)) return next(error);
  response.status(error.status).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  });
}

function invalid(response, message = 'Data pengajuan tidak valid.') {
  response.status(400).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message },
  });
}

function positiveId(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function trimmedString(value, { required = false, max }) {
  if (value === null && !required) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(normalized)) {
    return undefined;
  }
  return normalized || null;
}

export function parseKpForm(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if ((!partial && !keys.length) || (partial && !keys.length) || keys.some((key) => !FORM_FIELDS.includes(key))) {
    return null;
  }
  if (!partial && (!Object.hasOwn(body, 'tema_penelitian_id') || !Object.hasOwn(body, 'judul_penelitian'))) {
    return null;
  }
  const parsed = {};
  if (Object.hasOwn(body, 'tema_penelitian_id')) {
    const value = positiveId(body.tema_penelitian_id);
    if (!value) return null;
    parsed.tema_penelitian_id = value;
  }
  if (Object.hasOwn(body, 'judul_penelitian')) {
    const value = trimmedString(body.judul_penelitian, { required: true, max: 255 });
    if (value === undefined || value === null) return null;
    parsed.judul_penelitian = value;
  }
  for (const [field, max] of [['objek_penelitian', 255], ['lokasi_penelitian', 5000], ['daftar_mk_nilai_de', 5000]]) {
    if (Object.hasOwn(body, field)) {
      const value = trimmedString(body[field], { max });
      if (value === undefined) return null;
      parsed[field] = value;
    }
  }
  if (Object.hasOwn(body, 'usulan_pembimbing_id')) {
    if (body.usulan_pembimbing_id === null) parsed.usulan_pembimbing_id = null;
    else {
      const value = positiveId(body.usulan_pembimbing_id);
      if (!value) return null;
      parsed.usulan_pembimbing_id = value;
    }
  }
  if (Object.hasOwn(body, 'ipk_saat_pengajuan')) {
    const value = body.ipk_saat_pengajuan;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 4)) return null;
    parsed.ipk_saat_pengajuan = value;
  }
  if (Object.hasOwn(body, 'jumlah_sks_saat_pengajuan')) {
    const value = body.jumlah_sks_saat_pengajuan;
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 32767)) return null;
    parsed.jumlah_sks_saat_pengajuan = value;
  }
  for (const field of ['memiliki_nilai_de', 'sudah_bayar_spp_variabel']) {
    if (Object.hasOwn(body, field)) {
      const value = body[field];
      if (value !== null && typeof value !== 'boolean') return null;
      parsed[field] = value;
    }
  }
  return parsed;
}

function parsedApplicationId(request, response) {
  const id = positiveId(request.params.id);
  if (!id) invalid(response, 'ID pengajuan tidak valid.');
  return id;
}

export function getKpFormOptionsController(prisma) {
  return async (request, response, next) => {
    if (Object.keys(request.query).some((key) => key !== 'tahap') || typeof request.query.tahap !== 'string') {
      return invalid(response, 'Query tahap wajib diisi.');
    }
    try {
      response.status(200).json({
        success: true,
        data: await getKpFormOptions(prisma, request.auth.user.id, request.query.tahap),
      });
    } catch (error) { failure(error, response, next); }
  };
}

export function listOwnKpApplicationsController(prisma) {
  return async (request, response, next) => {
    if (Object.keys(request.query).some((key) => !['page', 'limit', 'status'].includes(key))) return invalid(response);
    const page = request.query.page === undefined ? 1 : positiveId(request.query.page);
    const limit = request.query.limit === undefined ? 20 : positiveId(request.query.limit);
    const status = request.query.status;
    if (!page || !limit || limit > 100 || (status !== undefined && !['DRAFT', 'DIAJUKAN'].includes(status))) {
      return invalid(response);
    }
    try {
      response.status(200).json({
        success: true,
        data: await listOwnKpApplications(prisma, request.auth.user.id, { page, limit, status }),
      });
    } catch (error) { failure(error, response, next); }
  };
}

export function createKpDraftController(prisma) {
  return async (request, response, next) => {
    const input = parseKpForm(request.body);
    if (!input) return invalid(response);
    try {
      response.status(201).json({ success: true, data: await createKpDraft(prisma, request.auth.user.id, input) });
    } catch (error) { failure(error, response, next); }
  };
}

export function getOwnKpApplicationController(prisma) {
  return async (request, response, next) => {
    const id = parsedApplicationId(request, response);
    if (!id) return;
    try {
      response.status(200).json({ success: true, data: await getOwnKpApplication(prisma, request.auth.user.id, id) });
    } catch (error) { failure(error, response, next); }
  };
}

export function updateKpDraftController(prisma) {
  return async (request, response, next) => {
    const id = parsedApplicationId(request, response);
    if (!id) return;
    const input = parseKpForm(request.body, { partial: true });
    if (!input) return invalid(response);
    try {
      response.status(200).json({ success: true, data: await updateKpDraft(prisma, request.auth.user.id, id, input) });
    } catch (error) { failure(error, response, next); }
  };
}

export function uploadKpDocumentController(prisma) {
  return (request, response, next) => {
    const id = parsedApplicationId(request, response);
    if (!id) return;
    if (!request.is('multipart/form-data')) {
      response.status(415).json({
        success: false,
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Gunakan multipart/form-data.' },
      });
      return;
    }
    upload(request, response, async (error) => {
      if (error) {
        response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
          success: false,
          error: { code: 'INVALID_DOCUMENT', message: 'Berkas PDF tidak valid atau melebihi batas.' },
        });
        return;
      }
      const code = typeof request.body?.kode_jenis === 'string' ? request.body.kode_jenis.trim() : '';
      if (!request.file || !/^[A-Z0-9_]{1,50}$/.test(code)) return invalid(response);
      try {
        response.status(201).json({
          success: true,
          data: await uploadKpDocument(prisma, request.auth.user.id, id, code, request.file),
        });
      } catch (uploadError) { failure(uploadError, response, next); }
    });
  };
}

export function downloadKpDocumentController(prisma) {
  return async (request, response, next) => {
    const id = parsedApplicationId(request, response);
    const documentId = positiveId(request.params.dokumenId);
    if (!id || !documentId) {
      if (id) invalid(response, 'ID dokumen tidak valid.');
      return;
    }
    try {
      const file = await downloadKpDocument(prisma, request.auth.user.id, id, documentId);
      response.set({
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename="${file.filename.replace(/["\\\r\n]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      });
      response.status(200).send(file.bytes);
    } catch (error) { failure(error, response, next); }
  };
}

export function submitKpApplicationController(prisma) {
  return async (request, response, next) => {
    const id = parsedApplicationId(request, response);
    if (!id) return;
    if (
      !request.body ||
      typeof request.body !== 'object' ||
      Array.isArray(request.body) ||
      Object.keys(request.body).length !== 1 ||
      request.body.setuju_pernyataan !== true
    ) {
      return invalid(response, 'Pernyataan kebenaran data wajib disetujui.');
    }
    try {
      response.status(200).json({
        success: true,
        data: await submitKpApplication(prisma, request.auth.user.id, id, true),
      });
    } catch (error) { failure(error, response, next); }
  };
}

export function reviseOwnKpController(prisma) {
  return async (request, response, next) => {
    const id = parsedApplicationId(request, response);
    if (!id) return;
    const input = parseKpForm(request.body, { partial: true });
    const allowed = ['judul_penelitian', 'objek_penelitian', 'lokasi_penelitian',
      'ipk_saat_pengajuan', 'jumlah_sks_saat_pengajuan', 'memiliki_nilai_de', 'daftar_mk_nilai_de'];
    if (!input || Object.keys(input).some((field) => !allowed.includes(field))) return invalid(response);
    try { response.status(200).json({ success: true,
      data: await reviseOwnKpApplication(prisma, request.auth.user.id, id, input) }); }
    catch (error) { failure(error, response, next); }
  };
}

export function sendOwnKpRevisionController(prisma) {
  return async (request, response, next) => {
    const id = parsedApplicationId(request, response);
    if (!id) return;
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !Array.isArray(body.kategori) ||
        body.kategori.length < 1 || body.kategori.length > 2 ||
        new Set(body.kategori).size !== body.kategori.length ||
        body.kategori.some((category) => !['BERKAS', 'NILAI'].includes(category))) return invalid(response);
    try { response.status(200).json({ success: true,
      data: await sendOwnKpRevision(prisma, request.auth.user.id, id, body.kategori) }); }
    catch (error) { failure(error, response, next); }
  };
}
