import {
  MasterDosenError,
  createDosen,
  getDosen,
  listDosen,
  updateDosen,
  changeDosenStatus,
  deleteDosen,
} from '../services/dosen.service.js';

const PROFILE_FIELDS = new Set([
  'email', 'nidn', 'nama_lengkap', 'no_telepon',
  'tanggal_lahir', 'jabatan_fungsional', 'is_homebase_si',
]);
const CREATE_FIELDS = new Set([...PROFILE_FIELDS, 'kode_dosen', 'program_studi_id']);

function respondError(error, response, next) {
  if (error instanceof MasterDosenError) {
    response.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message },
    });
    return;
  }
  next(error);
}

function validationError(response) {
  response.status(400).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Data dosen tidak valid.' },
  });
}

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

function isEmail(value) {
  return typeof value === 'string' && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function optionalText(value, maximum) {
  return value === null ||
    (typeof value === 'string' && value.length > 0 && value.length <= maximum);
}

export function parseDosenBody(body, isCreate) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  const allowed = isCreate ? CREATE_FIELDS : PROFILE_FIELDS;
  if (keys.length === 0 || keys.some((key) => !allowed.has(key))) return null;
  if (isCreate && !['kode_dosen', 'program_studi_id', 'email', 'nama_lengkap', 'tanggal_lahir']
    .every((field) => Object.hasOwn(body, field))) return null;
  if (Object.hasOwn(body, 'kode_dosen') &&
      (typeof body.kode_dosen !== 'string' || !/^[A-Za-z0-9._-]{3,25}$/.test(body.kode_dosen))) return null;
  if (Object.hasOwn(body, 'program_studi_id') &&
      (!Number.isSafeInteger(body.program_studi_id) || body.program_studi_id < 1)) return null;
  if (Object.hasOwn(body, 'email') && !isEmail(body.email)) return null;
  if (Object.hasOwn(body, 'nidn') && body.nidn !== null &&
      (typeof body.nidn !== 'string' || !/^\d{1,20}$/.test(body.nidn))) return null;
  if (Object.hasOwn(body, 'nama_lengkap') &&
      (typeof body.nama_lengkap !== 'string' || body.nama_lengkap.trim().length === 0 ||
       body.nama_lengkap.length > 150)) return null;
  if (Object.hasOwn(body, 'tanggal_lahir') && !dateOnly(body.tanggal_lahir)) return null;
  if (Object.hasOwn(body, 'no_telepon') && !optionalText(body.no_telepon, 20)) return null;
  if (Object.hasOwn(body, 'jabatan_fungsional') && !optionalText(body.jabatan_fungsional, 100)) return null;
  if (Object.hasOwn(body, 'is_homebase_si') && typeof body.is_homebase_si !== 'boolean') return null;

  const parsed = { ...body };
  if (Object.hasOwn(parsed, 'email')) parsed.email = parsed.email.toLowerCase();
  if (Object.hasOwn(parsed, 'nama_lengkap')) parsed.nama_lengkap = parsed.nama_lengkap.trim();
  if (Object.hasOwn(parsed, 'tanggal_lahir')) parsed.tanggal_lahir = dateOnly(parsed.tanggal_lahir);
  return parsed;
}

function parseId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

export function listDosenController(prisma) {
  return async (request, response, next) => {
    const query = request.query;
    if (Object.keys(query).some((key) => !['page', 'limit', 'search'].includes(key))) {
      validationError(response);
      return;
    }
    const page = query.page === undefined ? 1 : parseId(query.page);
    const limit = query.limit === undefined ? 20 : parseId(query.limit);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (!page || !limit || limit > 100 || typeof query.search !== 'undefined' &&
        (typeof query.search !== 'string' || search.length > 100)) {
      validationError(response);
      return;
    }
    try {
      const result = await listDosen(prisma, { page, limit, search });
      response.status(200).json({ success: true, data: result.data,
        meta: { pagination: result.pagination, summary: result.summary } });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function getDosenController(prisma) {
  return async (request, response, next) => {
    const id = parseId(request.params.id);
    if (!id) return validationError(response);
    try {
      response.status(200).json({ success: true, data: await getDosen(prisma, id) });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function createDosenController(prisma) {
  return async (request, response, next) => {
    const input = parseDosenBody(request.body, true);
    if (!input) return validationError(response);
    try {
      response.status(201).json({ success: true, data: await createDosen(prisma, input) });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function updateDosenController(prisma) {
  return async (request, response, next) => {
    const id = parseId(request.params.id);
    const input = parseDosenBody(request.body, false);
    if (!id || !input) return validationError(response);
    try {
      response.status(200).json({ success: true, data: await updateDosen(prisma, id, input) });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function changeDosenStatusController(prisma) {
  return async (request, response, next) => {
    const id = parseId(request.params.id);
    const body = request.body;
    if (!id || !body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !['AKTIF', 'NONAKTIF'].includes(body.status_akun)) {
      return validationError(response);
    }
    try {
      const data = await changeDosenStatus(prisma, id, request.auth.user.id, body.status_akun);
      response.status(200).json({ success: true, data });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function deleteDosenController(prisma) {
  return async (request, response, next) => {
    const id = parseId(request.params.id);
    if (!id) return validationError(response);
    try {
      await deleteDosen(prisma, id, request.auth.user.id);
      response.status(204).end();
    } catch (error) {
      respondError(error, response, next);
    }
  };
}
