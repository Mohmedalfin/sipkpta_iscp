import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import {
  DataDiriError, downloadOwnDocument, getDataDiri, updateOwnProfile, uploadOwnDocument,
} from '../services/data-diri.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
}).single('file');

export const dataDiriUploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (request) => String(request.auth.user.id),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({
    success: false, error: { code: 'RATE_LIMITED', message: 'Terlalu banyak unggahan dokumen.' },
  }),
});

function failure(error, response, next) {
  if (!(error instanceof DataDiriError)) return next(error);
  response.status(error.status).json({
    success: false, error: { code: error.code, message: error.message },
  });
}

function invalid(response) {
  response.status(400).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Data profil tidak valid.' },
  });
}

export function parseOwnProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !['no_telepon', 'alamat'].includes(key))) return null;
  const parsed = {};
  if (Object.hasOwn(body, 'no_telepon')) {
    const value = body.no_telepon;
    if (value !== null && typeof value !== 'string') return null;
    const normalized = typeof value === 'string' ? value.trim().replace(/[\s()-]/g, '') : '';
    if (normalized && (normalized.length > 20 || !/^\+?\d{8,20}$/.test(normalized))) return null;
    parsed.no_telepon = normalized || null;
  }
  if (Object.hasOwn(body, 'alamat')) {
    const value = body.alamat;
    if (value !== null && typeof value !== 'string') return null;
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (normalized.length > 5000 || /[<>\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(normalized)) return null;
    parsed.alamat = normalized || null;
  }
  return parsed;
}

export function getDataDiriController(prisma) {
  return async (request, response, next) => {
    try {
      response.status(200).json({ success: true, data: await getDataDiri(prisma, request.auth.user.id) });
    } catch (error) { failure(error, response, next); }
  };
}

export function updateOwnProfileController(prisma) {
  return async (request, response, next) => {
    const input = parseOwnProfile(request.body);
    if (!input) return invalid(response);
    try {
      response.status(200).json({ success: true, data: await updateOwnProfile(prisma, request.auth.user.id, input) });
    } catch (error) { failure(error, response, next); }
  };
}

export function uploadOwnDocumentController(prisma) {
  return (request, response, next) => {
    if (!request.is('multipart/form-data')) {
      response.status(415).json({ success: false, error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Gunakan multipart/form-data.' } });
      return;
    }
    upload(request, response, async (error) => {
      if (error) {
        response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
          success: false, error: { code: 'INVALID_DOCUMENT', message: 'Berkas PDF tidak valid atau melebihi batas.' },
        });
        return;
      }
      if (!request.file) return invalid(response);
      try {
        const result = await uploadOwnDocument(prisma, request.auth.user.id, request.params.kodeJenis, request.file);
        response.status(201).json({ success: true, data: result });
      } catch (uploadError) { failure(uploadError, response, next); }
    });
  };
}

export function downloadOwnDocumentController(prisma) {
  return async (request, response, next) => {
    try {
      const file = await downloadOwnDocument(prisma, request.auth.user.id, request.params.kodeJenis);
      response.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      });
      response.status(200).send(file.bytes);
    } catch (error) { failure(error, response, next); }
  };
}
