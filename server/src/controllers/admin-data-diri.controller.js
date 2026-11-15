import {
  VERIFICATION_FILTERS,
  decideAdminDataDiriDocument,
  downloadAdminDataDiriDocument,
  getAdminDataDiriDetail,
  listAdminDataDiri,
  verifyAllAdminDataDiri,
} from '../services/admin-data-diri.service.js';
import { REQUIRED_DOCUMENT_CODES } from '../services/data-diri.service.js';

function failure(error, response, next) {
  if (!Number.isInteger(error?.status) || typeof error?.code !== 'string') return next(error);
  response.status(error.status).json({
    success: false,
    error: { code: error.code, message: error.message },
  });
}

function invalid(response) {
  response.status(400).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Data verifikasi tidak valid.' },
  });
}

export function parsePositiveId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2147483647 ? parsed : null;
}

export function parseAdminDataDiriQuery(query) {
  if (!query || Object.keys(query).some((key) =>
    !['page', 'limit', 'search', 'status', 'lengkap'].includes(key))) return null;
  const page = query.page === undefined ? 1 : parsePositiveId(query.page);
  const limit = query.limit === undefined ? 20 : parsePositiveId(query.limit);
  const search = query.search === undefined ? '' :
    (typeof query.search === 'string' ? query.search.trim() : null);
  const status = query.status === undefined ? '' : query.status;
  let lengkap = null;
  if (query.lengkap !== undefined) {
    if (!['true', 'false'].includes(query.lengkap)) return null;
    lengkap = query.lengkap === 'true';
  }
  if (!page || !limit || limit > 100 || search === null || search.length > 100 ||
      typeof status !== 'string' || status && !VERIFICATION_FILTERS.has(status)) return null;
  return { page, limit, search, status, lengkap };
}

function parseNote(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const note = value.trim();
  if (note.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(note)) return undefined;
  return note || null;
}

export function parseDecisionBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !['status', 'catatan', 'expectedVersion'].includes(key)) ||
      !Object.hasOwn(body, 'status') || !Object.hasOwn(body, 'expectedVersion')) return null;
  if (!['TERVERIFIKASI', 'PERLU_PERBAIKAN'].includes(body.status) ||
      !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) return null;
  const note = parseNote(body.catatan);
  if (note === undefined || body.status === 'PERLU_PERBAIKAN' && !note) return null;
  return { status: body.status, note, expectedVersion: body.expectedVersion };
}

export function parseVerifyAllBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, 'expectedVersions')) return null;
  const versions = body.expectedVersions;
  if (!versions || typeof versions !== 'object' || Array.isArray(versions) ||
      Object.keys(versions).length !== REQUIRED_DOCUMENT_CODES.length ||
      Object.keys(versions).some((code) => !REQUIRED_DOCUMENT_CODES.includes(code)) ||
      REQUIRED_DOCUMENT_CODES.some((code) =>
        !Number.isSafeInteger(versions[code]) || versions[code] < 1)) return null;
  return { expectedVersions: { ...versions } };
}

export function listAdminDataDiriController(prisma) {
  return async (request, response, next) => {
    const query = parseAdminDataDiriQuery(request.query);
    if (!query) return invalid(response);
    try {
      const result = await listAdminDataDiri(prisma, query);
      response.status(200).json({
        success: true,
        data: result.data,
        meta: { pagination: result.pagination, summary: result.summary },
      });
    } catch (error) { failure(error, response, next); }
  };
}

export function getAdminDataDiriDetailController(prisma) {
  return async (request, response, next) => {
    const mahasiswaId = parsePositiveId(request.params.mahasiswaId);
    if (!mahasiswaId) return invalid(response);
    try {
      response.status(200).json({ success: true, data: await getAdminDataDiriDetail(prisma, mahasiswaId) });
    } catch (error) { failure(error, response, next); }
  };
}

export function downloadAdminDataDiriDocumentController(prisma) {
  return async (request, response, next) => {
    const mahasiswaId = parsePositiveId(request.params.mahasiswaId);
    if (!mahasiswaId) return invalid(response);
    try {
      const file = await downloadAdminDataDiriDocument(prisma, mahasiswaId, request.params.kodeJenis);
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

export function decideAdminDataDiriDocumentController(prisma) {
  return async (request, response, next) => {
    const mahasiswaId = parsePositiveId(request.params.mahasiswaId);
    const input = parseDecisionBody(request.body);
    if (!mahasiswaId || !input) return invalid(response);
    try {
      const data = await decideAdminDataDiriDocument(prisma, {
        mahasiswaId,
        code: request.params.kodeJenis,
        ...input,
        actorUserId: request.auth.user.id,
      });
      response.status(200).json({ success: true, data });
    } catch (error) { failure(error, response, next); }
  };
}

export function verifyAllAdminDataDiriController(prisma) {
  return async (request, response, next) => {
    const mahasiswaId = parsePositiveId(request.params.mahasiswaId);
    const input = parseVerifyAllBody(request.body);
    if (!mahasiswaId || !input) return invalid(response);
    try {
      const data = await verifyAllAdminDataDiri(prisma, {
        mahasiswaId,
        ...input,
        actorUserId: request.auth.user.id,
      });
      response.status(200).json({ success: true, data });
    } catch (error) { failure(error, response, next); }
  };
}
