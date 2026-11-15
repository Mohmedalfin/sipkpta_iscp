import {
  MasterMahasiswaError,
  createMahasiswa,
  getMahasiswa,
  listMahasiswa,
  updateMahasiswa,
  changeMahasiswaStatus,
  deleteMahasiswa,
} from '../services/mahasiswa.service.js';

const PROFILE_FIELDS = new Set([
  'email', 'nama_lengkap', 'tanggal_lahir', 'nik_kependudukan',
  'tempat_lahir', 'no_telepon', 'alamat', 'tahun_angkatan',
]);
const CREATE_FIELDS = new Set([...PROFILE_FIELDS, 'nim', 'program_studi_id']);

function respondError(error, response, next) {
  if (error instanceof MasterMahasiswaError) {
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
    error: { code: 'VALIDATION_ERROR', message: 'Data mahasiswa tidak valid.' },
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

export function parseMahasiswaBody(body, isCreate) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  const allowed = isCreate ? CREATE_FIELDS : PROFILE_FIELDS;
  if (keys.length === 0 || keys.some((key) => !allowed.has(key))) return null;
  if (isCreate && !['nim', 'program_studi_id', 'email', 'nama_lengkap', 'tanggal_lahir']
    .every((field) => Object.hasOwn(body, field))) return null;
  if (Object.hasOwn(body, 'nim') &&
      (typeof body.nim !== 'string' || !/^\d{8,25}$/.test(body.nim))) return null;
  if (Object.hasOwn(body, 'program_studi_id') &&
      (!Number.isSafeInteger(body.program_studi_id) || body.program_studi_id < 1)) return null;
  if (Object.hasOwn(body, 'email') && !isEmail(body.email)) return null;
  if (Object.hasOwn(body, 'nama_lengkap') &&
      (typeof body.nama_lengkap !== 'string' || body.nama_lengkap.trim().length === 0 ||
       body.nama_lengkap.length > 150)) return null;
  if (Object.hasOwn(body, 'tanggal_lahir') && !dateOnly(body.tanggal_lahir)) return null;
  if (Object.hasOwn(body, 'nik_kependudukan') && body.nik_kependudukan !== null &&
      (typeof body.nik_kependudukan !== 'string' || !/^\d{16}$/.test(body.nik_kependudukan))) return null;
  if (Object.hasOwn(body, 'tempat_lahir') && !optionalText(body.tempat_lahir, 100)) return null;
  if (Object.hasOwn(body, 'no_telepon') && !optionalText(body.no_telepon, 20)) return null;
  if (Object.hasOwn(body, 'alamat') && !optionalText(body.alamat, 5000)) return null;
  if (Object.hasOwn(body, 'tahun_angkatan') && body.tahun_angkatan !== null &&
      (!Number.isInteger(body.tahun_angkatan) || body.tahun_angkatan < 1900 ||
       body.tahun_angkatan > new Date().getUTCFullYear() + 1)) return null;

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

function parseYear(value) {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  const maxYear = new Date().getUTCFullYear() + 1;
  return Number.isSafeInteger(year) && year >= 1900 && year <= maxYear ? year : null;
}

export function listMahasiswaController(prisma) {
  return async (request, response, next) => {
    const query = request.query;
    if (Object.keys(query).some((key) => !['page', 'limit', 'search', 'tahun_angkatan', 'angkatan'].includes(key))) {
      validationError(response);
      return;
    }
    const page = query.page === undefined ? 1 : parseId(query.page);
    const limit = query.limit === undefined ? 20 : parseId(query.limit);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const rawAngkatan = query.tahun_angkatan ?? query.angkatan;
    const tahun_angkatan = rawAngkatan === undefined ? null : parseYear(rawAngkatan);

    if (!page || !limit || limit > 100 || typeof query.search !== 'undefined' &&
        (typeof query.search !== 'string' || search.length > 100) ||
        (rawAngkatan !== undefined && tahun_angkatan === null)) {
      validationError(response);
      return;
    }
    try {
      const result = await listMahasiswa(prisma, { page, limit, search, tahun_angkatan });
      response.status(200).json({ success: true, data: result.data,
        meta: { pagination: result.pagination, summary: result.summary } });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function getMahasiswaController(prisma) {
  return async (request, response, next) => {
    const id = parseId(request.params.id);
    if (!id) return validationError(response);
    try {
      response.status(200).json({ success: true, data: await getMahasiswa(prisma, id) });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function createMahasiswaController(prisma) {
  return async (request, response, next) => {
    const input = parseMahasiswaBody(request.body, true);
    if (!input) return validationError(response);
    try {
      const record = await createMahasiswa(prisma, request.auth.user.id, input);
      response.status(201).json({ success: true, data: record });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function updateMahasiswaController(prisma) {
  return async (request, response, next) => {
    const id = parseId(request.params.id);
    const input = parseMahasiswaBody(request.body, false);
    if (!id || !input) return validationError(response);
    try {
      response.status(200).json({ success: true, data: await updateMahasiswa(prisma, id, input) });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function changeMahasiswaStatusController(prisma) {
  return async (request, response, next) => {
    const id = parseId(request.params.id);
    const body = request.body;
    if (!id || !body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !['AKTIF', 'NONAKTIF'].includes(body.status_akun)) {
      return validationError(response);
    }
    try {
      const data = await changeMahasiswaStatus(prisma, id, request.auth.user.id, body.status_akun);
      response.status(200).json({ success: true, data });
    } catch (error) {
      respondError(error, response, next);
    }
  };
}

export function deleteMahasiswaController(prisma) {
  return async (request, response, next) => {
    const id = parseId(request.params.id);
    if (!id) return validationError(response);
    try {
      await deleteMahasiswa(prisma, id, request.auth.user.id);
      response.status(204).end();
    } catch (error) {
      respondError(error, response, next);
    }
  };
}
