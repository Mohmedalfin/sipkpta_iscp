import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { parseMahasiswaBody } from './mahasiswa.controller.js';
import { parseDosenBody } from './dosen.controller.js';
import {
  IMPORT_MAX_BYTES, MasterImportError, confirmImport, errorWorkbook, previewImport,
} from '../services/master-import.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_MAX_BYTES, files: 1, fields: 0, parts: 1 },
  fileFilter: (_request, file, callback) => callback(null, /\.csv$/i.test(file.originalname)),
}).single('file');

export const importRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan impor.' },
  }),
});

function validationError(response) {
  return response.status(400).json({
    success: false, error: { code: 'VALIDATION_ERROR', message: 'Permintaan impor tidak valid.' },
  });
}

function respondError(error, response, next) {
  if (error instanceof MasterImportError || (error?.status && error?.code)) {
    response.status(error.status).json({
      success: false, error: { code: error.code, message: error.message },
    });
    return;
  }
  next(error);
}

function validator(kind) {
  return kind === 'mahasiswa' ? parseMahasiswaBody : parseDosenBody;
}

function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function previewImportController(prisma, kind) {
  return (request, response, next) => {
    upload(request, response, async (uploadError) => {
      if (uploadError || !request.file) return validationError(response);
      try {
        const data = await previewImport(prisma, kind, request.auth.user.id, request.file, validator(kind));
        response.status(200).json({ success: true, data });
      } catch (error) {
        respondError(error, response, next);
      }
    });
  };
}

export function confirmImportController(prisma, kind) {
  return async (request, response, next) => {
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 2 || !isUuid(body.previewId) || body.confirmValidOnly !== true) {
      return validationError(response);
    }
    try {
      const data = await confirmImport(prisma, kind, request.auth.user.id, body.previewId, validator(kind));
      response.status(200).json({ success: true, data });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function importErrorsController(prisma, kind) {
  return async (request, response, next) => {
    if (!isUuid(request.params.previewId)) return validationError(response);
    try {
      const buffer = await errorWorkbook(prisma, kind, request.auth.user.id, request.params.previewId);
      response.status(200)
        .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .set('Content-Disposition', `attachment; filename="${kind}-import-errors.xlsx"`)
        .send(Buffer.from(buffer));
    } catch (error) {
      respondError(error, response, next);
    }
  };
}
