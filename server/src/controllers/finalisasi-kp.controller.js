import {
  assignPembimbingKp, assignPembimbingKpBulk, getFinalisasiKp,
  listFinalisasiKp, listKandidatPembimbingKp, listPenugasanPembimbingKp,
  replacePembimbingKp,
} from '../services/finalisasi-kp.service.js';

function invalid(response) {
  response.status(400).json({ success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Input finalisasi tidak valid.' } });
}

function id(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2147483647 ? parsed : null;
}

function body(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
}

function positiveInt(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}

function failure(error, response, next) {
  if (!Number.isInteger(error?.status) || typeof error?.code !== 'string') return next(error);
  response.status(error.status).json({ success: false,
    error: { code: error.code, message: error.message,
      ...(error.details ? { details: error.details } : {}) } });
}

function query(request, kind) {
  const allowed = kind === 'applications'
    ? ['q', 'page', 'limit', 'periode', 'status_finalisasi', 'pembimbing_id', 'sort']
    : kind === 'candidates' ? ['q', 'page', 'limit', 'pengajuan_id']
      : ['page', 'limit', 'periode', 'dosen_id', 'status'];
  const input = request.query;
  if (Object.keys(input).some((key) => !allowed.includes(key))) return null;
  const page = input.page === undefined ? 1 : id(input.page);
  const limit = input.limit === undefined ? 20 : id(input.limit);
  const q = input.q === undefined ? '' : input.q;
  if (!page || !limit || limit > 100 || typeof q !== 'string' || q.trim().length > 100 ||
    ['periode', 'pembimbing_id', 'pengajuan_id', 'dosen_id'].some((key) =>
      input[key] !== undefined && !id(input[key])) ||
    input.status_finalisasi !== undefined && ![
      'BELUM_SIAP', 'SIAP_DITETAPKAN', 'SUDAH_DITETAPKAN',
    ].includes(input.status_finalisasi) ||
    input.status !== undefined && !['AKTIF', 'NONAKTIF'].includes(input.status) ||
    input.sort !== undefined && !['baru', 'lama'].includes(input.sort)) return null;
  return { page, limit, q: q.trim(), sort: input.sort || 'baru',
    periode: input.periode ? id(input.periode) : null,
    pembimbing_id: input.pembimbing_id ? id(input.pembimbing_id) : null,
    pengajuan_id: input.pengajuan_id ? id(input.pengajuan_id) : null,
    dosen_id: input.dosen_id ? id(input.dosen_id) : null,
    status_finalisasi: input.status_finalisasi || null, status: input.status || null };
}

function handler(prisma, service, parse) {
  return async (request, response, next) => {
    const args = parse(request);
    if (!args) return invalid(response);
    try { response.status(200).json({ success: true, data: await service(prisma, ...args) }); }
    catch (error) { failure(error, response, next); }
  };
}

export function listFinalisasiKpController(prisma) {
  return handler(prisma, listFinalisasiKp, (request) => {
    const parsed = query(request, 'applications');
    return parsed ? [request.auth.user.id, parsed] : null;
  });
}

export function getFinalisasiKpController(prisma) {
  return handler(prisma, getFinalisasiKp, (request) => {
    const parsed = id(request.params.id);
    return parsed ? [request.auth.user.id, parsed] : null;
  });
}

export function listKandidatPembimbingKpController(prisma) {
  return handler(prisma, listKandidatPembimbingKp, (request) => {
    const parsed = query(request, 'candidates');
    return parsed ? [request.auth.user.id, parsed] : null;
  });
}

function mapping(value, withApplication) {
  const keys = withApplication
    ? ['pengajuan_id', 'dosen_id', 'expected_dokumen_pengajuan_id']
    : ['dosen_id', 'expected_dokumen_pengajuan_id'];
  return body(value, keys) && keys.every((key) => positiveInt(value[key]));
}

export function assignPembimbingKpController(prisma) {
  return handler(prisma, assignPembimbingKp, (request) => {
    const applicationId = id(request.params.id);
    return applicationId && mapping(request.body, false)
      ? [request.auth.user.id, applicationId, request.body] : null;
  });
}

export function assignPembimbingKpBulkController(prisma) {
  return handler(prisma, assignPembimbingKpBulk, (request) => {
    const items = request.body?.assignments;
    if (!body(request.body, ['assignments', 'konfirmasi']) || request.body.konfirmasi !== true ||
      !Array.isArray(items) || !items.length || items.length > 50 ||
      items.some((row) => !mapping(row, true)) ||
      new Set(items.map((row) => row.pengajuan_id)).size !== items.length) return null;
    return [request.auth.user.id, items];
  });
}

export function listPenugasanPembimbingKpController(prisma) {
  return handler(prisma, listPenugasanPembimbingKp, (request) => {
    const parsed = query(request, 'assignments');
    return parsed ? [request.auth.user.id, parsed] : null;
  });
}

export function replacePembimbingKpController(prisma) {
  return handler(prisma, replacePembimbingKp, (request) => {
    const applicationId = id(request.params.id);
    const newDosenId = request.body?.dosen_baru_id;
    const reason = request.body?.alasan_penggantian;
    if (!applicationId || !body(request.body, ['dosen_baru_id', 'alasan_penggantian']) ||
      !positiveInt(newDosenId) || typeof reason !== 'string' ||
      !reason.trim() || reason.trim().length > 2000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(reason)) return null;
    return [request.auth.user.id, applicationId, newDosenId, reason.trim()];
  });
}
