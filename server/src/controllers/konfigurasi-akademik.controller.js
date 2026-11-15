import {
  JENIS_PROSES, STATUS_PERIODE, createPeriod, createSchedule, getPeriod, getSchedule,
  listPeriods, listSchedules, setPeriodActive, setScheduleActive, updatePeriod, updateSchedule,
  listStages, getStage, listDocumentTypes, createDocumentType, updateDocumentType,
  listRequirements, createRequirement, updateRequirement,
  getAvailability,
} from '../services/konfigurasi-akademik.service.js';
import { createKurikulum, getKurikulum, listKurikulum, updateKurikulum } from '../services/kurikulum.service.js';

const invalid = (response) => response.status(400).json({ success: false,
  error: { code: 'VALIDATION_ERROR', message: 'Input konfigurasi tidak valid.' } });
const id = (value) => /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) <= 2147483647
  ? Number(value) : null;
const body = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every((key) => allowed.includes(key));
const send = (action, status = 200) => async (request, response, next) => {
  try { response.status(status).json({ success: true, data: await action(request) }); }
  catch (error) {
    if (Number.isInteger(error?.status) && typeof error?.code === 'string') {
      response.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
    } else next(error);
  }
};

function listQuery(request, kind) {
  const query = request.query;
  const fields = kind === 'period' ? ['page', 'limit', 'tahun_ajaran', 'semester', 'status'] :
    ['page', 'limit', 'periode', 'tahap', 'jenis_proses', 'status'];
  if (Object.keys(query).some((key) => !fields.includes(key))) return null;
  const page = query.page === undefined ? 1 : id(query.page);
  const limit = query.limit === undefined ? 20 : id(query.limit);
  if (!page || !limit || limit > 100) return null;
  if (kind === 'period') {
    if ((query.tahun_ajaran && !/^[0-9/]{1,9}$/.test(query.tahun_ajaran)) ||
      (query.semester && !['GANJIL', 'GENAP'].includes(query.semester)) ||
      (query.status && !STATUS_PERIODE.includes(query.status))) return null;
    return { page, limit, tahun_ajaran: query.tahun_ajaran, semester: query.semester, status: query.status };
  }
  const periode = query.periode === undefined ? null : id(query.periode);
  const tahap = query.tahap === undefined ? null : id(query.tahap);
  if (query.periode !== undefined && !periode || query.tahap !== undefined && !tahap ||
    query.jenis_proses && !JENIS_PROSES.includes(query.jenis_proses) ||
    query.status && !['NONAKTIF', 'BELUM_DIBUKA', 'DIBUKA', 'DITUTUP'].includes(query.status)) return null;
  return { page, limit, periode, tahap, jenis_proses: query.jenis_proses, status: query.status };
}

const periodFields = ['tahun_ajaran', 'semester', 'tanggal_mulai', 'tanggal_selesai'];
const scheduleFields = ['periode_akademik_id', 'tahap_akademik_id', 'jenis_proses',
  'tanggal_buka', 'tanggal_tutup', 'is_aktif', 'keterangan'];
const withId = (action) => (request) => {
  const recordId = id(request.params.id);
  if (!recordId) throw Object.assign(new Error('ID tidak valid.'), { status: 400, code: 'VALIDATION_ERROR' });
  return action(request, recordId);
};
const checkedBody = (fields, action) => (request) => {
  if (!body(request.body, fields) || Object.keys(request.body).length === 0) {
    throw Object.assign(new Error('Input konfigurasi tidak valid.'), { status: 400, code: 'VALIDATION_ERROR' });
  }
  return action(request);
};

export const periodsIndex = (prisma) => (request, response, next) => {
  const query = listQuery(request, 'period');
  if (!query) return invalid(response);
  return send(() => listPeriods(prisma, query))(request, response, next);
};
export const periodDetail = (prisma) => send(withId((_, recordId) => getPeriod(prisma, recordId)));
export const periodCreate = (prisma) => send(checkedBody(periodFields, (request) =>
  createPeriod(prisma, request.body)), 201);
export const periodUpdate = (prisma) => send(withId(checkedBody(periodFields, (request) =>
  updatePeriod(prisma, id(request.params.id), request.body))));
export const periodToggle = (prisma, active) => send(withId((_, recordId) =>
  setPeriodActive(prisma, recordId, active)));

export const schedulesIndex = (prisma) => (request, response, next) => {
  const query = listQuery(request, 'schedule');
  if (!query) return invalid(response);
  return send(() => listSchedules(prisma, query))(request, response, next);
};
export const scheduleDetail = (prisma) => send(withId((_, recordId) => getSchedule(prisma, recordId)));
export const scheduleCreate = (prisma) => send(checkedBody(scheduleFields, (request) =>
  createSchedule(prisma, request.body, request.auth.user.id)), 201);
export const scheduleUpdate = (prisma) => send(withId(checkedBody(scheduleFields, (request) =>
  updateSchedule(prisma, id(request.params.id), request.body))));
export const scheduleToggle = (prisma, active) => send(withId((_, recordId) =>
  setScheduleActive(prisma, recordId, active)));

export const stagesIndex = (prisma) => send(() => listStages(prisma));
export const stageDetail = (prisma) => send(withId((_, recordId) => getStage(prisma, recordId)));
function pageQuery(query, allowed) {
  if (Object.keys(query).some((key) => !allowed.includes(key))) return null;
  const page = query.page === undefined ? 1 : id(query.page);
  const limit = query.limit === undefined ? 20 : id(query.limit);
  if (!page || !limit || limit > 100) return null;
  return { page, limit };
}
function activeFilter(value) {
  if (value === undefined) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
export const documentTypesIndex = (prisma) => (request, response, next) => {
  const pagination = pageQuery(request.query, ['page', 'limit', 'search', 'is_aktif']);
  const is_aktif = activeFilter(request.query.is_aktif);
  const search = request.query.search === undefined ? '' : request.query.search;
  if (!pagination || is_aktif === undefined || typeof search !== 'string' || search.length > 100) return invalid(response);
  return send(() => listDocumentTypes(prisma, { ...pagination, search: search.trim(), is_aktif }))(request, response, next);
};
const documentFields = ['kode_jenis', 'nama_jenis', 'deskripsi', 'format_diizinkan', 'maks_ukuran_mb', 'is_aktif'];
export const documentTypeCreate = (prisma) => send(checkedBody(documentFields, (request) =>
  createDocumentType(prisma, request.body)), 201);
export const documentTypeUpdate = (prisma) => send(withId(checkedBody(documentFields, (request) =>
  updateDocumentType(prisma, id(request.params.id), request.body))));
const requirementFields = ['periode_akademik_id', 'tahap_akademik_id', 'jenis_pengajuan',
  'pilihan_topik', 'jenis_dokumen_id', 'is_wajib', 'boleh_gunakan_dokumen_sebelumnya',
  'petunjuk', 'urutan_tampil', 'is_aktif'];
export const requirementsIndex = (prisma) => (request, response, next) => {
  const pagination = pageQuery(request.query, ['page', 'limit', 'periode', 'tahap',
    'jenis_pengajuan', 'pilihan_topik', 'jenis_dokumen', 'is_aktif']);
  const is_aktif = activeFilter(request.query.is_aktif);
  if (!pagination || is_aktif === undefined ||
    request.query.periode !== undefined && !id(request.query.periode) ||
    request.query.tahap !== undefined && !id(request.query.tahap) ||
    request.query.jenis_dokumen !== undefined && !id(request.query.jenis_dokumen) ||
    request.query.jenis_pengajuan && !['REGULER'].includes(request.query.jenis_pengajuan) ||
    request.query.pilihan_topik && !['BARU', 'LANJUT'].includes(request.query.pilihan_topik)) return invalid(response);
  const query = { ...pagination, is_aktif, periode: request.query.periode ? id(request.query.periode) : null,
    tahap: request.query.tahap ? id(request.query.tahap) : null,
    jenis_dokumen: request.query.jenis_dokumen ? id(request.query.jenis_dokumen) : null,
    jenis_pengajuan: request.query.jenis_pengajuan, pilihan_topik: request.query.pilihan_topik };
  return send(() => listRequirements(prisma, query))(request, response, next);
};
export const requirementCreate = (prisma) => send(checkedBody(requirementFields, (request) =>
  createRequirement(prisma, request.body)), 201);
export const requirementUpdate = (prisma) => send(withId(checkedBody([
  'petunjuk', 'is_wajib', 'boleh_gunakan_dokumen_sebelumnya', 'urutan_tampil', 'is_aktif',
], (request) =>
  updateRequirement(prisma, id(request.params.id), request.body))));

export const availability = (prisma) => (request, response, next) => {
  if (Object.keys(request.query).some((key) => !['tahap', 'jenis_proses'].includes(key)) ||
    !['KP', 'ISCP', 'TA'].includes(request.query.tahap) ||
    !JENIS_PROSES.includes(request.query.jenis_proses)) return invalid(response);
  return send(() => getAvailability(prisma, request.query.tahap, request.query.jenis_proses))(request, response, next);
};

const kurikulumFields = ['kode_kurikulum', 'nama_kurikulum', 'tahun_mulai_berlaku', 'keterangan', 'is_aktif'];
export const kurikulumIndex = (prisma) => (request, response, next) => {
  const pagination = pageQuery(request.query, ['page', 'limit', 'search', 'is_aktif']);
  const is_aktif = activeFilter(request.query.is_aktif);
  const search = request.query.search === undefined ? '' : request.query.search;
  if (!pagination || is_aktif === undefined || typeof search !== 'string' || search.length > 100) return invalid(response);
  return send(() => listKurikulum(prisma, { ...pagination, search: search.trim(), is_aktif }))(request, response, next);
};
export const kurikulumDetail = (prisma) => send(withId((_, recordId) => getKurikulum(prisma, recordId)));
export const kurikulumCreate = (prisma) => send(checkedBody(kurikulumFields, (request) =>
  createKurikulum(prisma, request.body)), 201);
export const kurikulumUpdate = (prisma) => send(withId(checkedBody(kurikulumFields, (request) =>
  updateKurikulum(prisma, id(request.params.id), request.body))));
