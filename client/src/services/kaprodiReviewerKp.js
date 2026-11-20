import api from './api.js';
import { apiErrorMessage } from './apiError.js';

/**
 * Status penugasan reviewer KP
 */
export const PENUGASAN_REVIEWER_STATUS = Object.freeze({
  ALL: '',
  BELUM_ADA: 'BELUM_ADA',
  SUDAH_ADA: 'SUDAH_ADA',
});

/**
 * Status pengajuan administratif KP
 */
export const STATUS_PENGAJUAN_KP = Object.freeze({
  ALL: '',
  DIAJUKAN: 'DIAJUKAN',
  ACC: 'ACC',
  TIDAK_ACC: 'TIDAK_ACC',
});

/**
 * Helper validasi & pembersihan parameter query agar sesuai dengan schema backend Kaprodi
 * @param {object} params
 * @returns {object}
 */
export function buildApplicationQueryParams(params = {}) {
  const clean = {};
  if (params.page && Number.isInteger(Number(params.page)) && Number(params.page) > 0) {
    clean.page = Number(params.page);
  }
  if (params.limit && Number.isInteger(Number(params.limit)) && Number(params.limit) > 0) {
    clean.limit = Number(params.limit);
  }
  if (typeof params.q === 'string' && params.q.trim()) {
    clean.q = params.q.trim();
  }
  if (params.periode && Number.isInteger(Number(params.periode))) {
    clean.periode = Number(params.periode);
  }
  if (['DIAJUKAN', 'ACC', 'TIDAK_ACC'].includes(params.status_pengajuan)) {
    clean.status_pengajuan = params.status_pengajuan;
  }
  if (['BELUM_ADA', 'SUDAH_ADA'].includes(params.status_penugasan_reviewer)) {
    clean.status_penugasan_reviewer = params.status_penugasan_reviewer;
  }
  if (['baru', 'lama'].includes(params.sort)) {
    clean.sort = params.sort;
  }
  return clean;
}

/**
 * Helper pesan error ramah pengguna untuk modul Penugasan Reviewer Kaprodi
 * @param {Error|object} error - Error objek dari Axios atau response
 * @param {string} defaultMessage - Pesan cadangan
 * @returns {string}
 */
export function kaprodiReviewerKpErrorMessage(error, defaultMessage = 'Terjadi kesalahan pada penugasan reviewer KP.') {
  const errData = error?.response?.data?.error;
  const code = errData?.code;

  if (code === 'INVALID_REVIEWER') {
    return 'Dosen yang dipilih bukan kandidat Reviewer aktif pada Program Studi ini.';
  }
  if (code === 'APPLICATION_NOT_FOUND') {
    return 'Data pengajuan KP tidak ditemukan atau bukan milik Program Studi Anda.';
  }
  if (code === 'APPLICATION_FINALIZED') {
    return 'Dosen Pembimbing sudah ditetapkan; penugasan Reviewer sudah dikunci.';
  }
  if (code === 'ASSIGNMENT_LOCKED') {
    return 'Pengajuan tidak dapat menerima penugasan baru pada status saat ini.';
  }
  if (code === 'SAME_REVIEWER') {
    return 'Reviewer pengganti harus dosen yang berbeda dari reviewer saat ini.';
  }
  if (code === 'REVIEWER_ALREADY_ASSIGNED' || code === 'DUPLICATE_ASSIGNMENT') {
    return 'Dosen yang dipilih sudah ditugaskan sebagai Reviewer aktif pada pengajuan ini.';
  }
  if (code === 'ASSIGNMENT_NOT_FOUND' || code === 'REVIEWER_NOT_FOUND') {
    return 'Data penugasan reviewer aktif tidak ditemukan atau sudah dinonaktifkan.';
  }
  if (code === 'APPLICATION_NOT_ASSIGNABLE') {
    return 'Pengajuan ini tidak dapat menerima penugasan Reviewer baru.';
  }
  if (code === 'INVALID_APPLICATIONS') {
    return 'Satu atau lebih pengajuan tidak dapat menerima penugasan reviewer.';
  }
  if (code === 'VALIDATION_ERROR') {
    return 'Parameter atau input penugasan tidak valid. Periksa kembali pilihan Anda.';
  }
  return apiErrorMessage(error, { fallback: defaultMessage });
}

/**
 * Mengambil daftar pengajuan KP mahasiswa untuk penugasan reviewer Kaprodi
 * @param {object} params
 * @returns {Promise<{ items: Array, pagination: object }>}
 */
export async function fetchKaprodiKpApplications(params = {}, { signal } = {}) {
  const cleanParams = buildApplicationQueryParams(params);
  const response = await api.get('/api/kaprodi/pengajuan', { params: cleanParams, signal });
  return (
    response.data?.data || {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, total_pages: 1 },
    }
  );
}

/**
 * Mengambil detail lengkap satu pengajuan KP (termasuk info proposal & penugasan)
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export async function fetchKaprodiKpDetail(id, { signal } = {}) {
  const response = await api.get(`/api/kaprodi/pengajuan/${id}`, { signal });
  return response.data?.data;
}

/**
 * Mengambil daftar kandidat dosen reviewer aktif
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=100]
 * @param {string} [params.q='']
 * @param {number} [params.pengajuan_id]
 * @returns {Promise<{ items: Array, pagination: object }>}
 */
export async function fetchReviewerCandidates(params = {}, { signal } = {}) {
  const cleanParams = {};
  if (params.page) cleanParams.page = Number(params.page);
  if (params.limit) cleanParams.limit = Number(params.limit);
  if (params.q?.trim()) cleanParams.q = params.q.trim();
  if (params.pengajuan_id) cleanParams.pengajuan_id = Number(params.pengajuan_id);

  const response = await api.get('/api/kaprodi/kandidat-reviewer', { params: cleanParams, signal });
  return response.data?.data || { items: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 1 } };
}

/**
 * Mengambil daftar reviewer aktif dan histori pada satu pengajuan
 * @param {number|string} id
 * @returns {Promise<{ items: Array, jumlah_reviewer_aktif: number }>}
 */
export async function fetchApplicationReviewers(id) {
  const response = await api.get(`/api/kaprodi/pengajuan/${id}/reviewer`);
  return response.data?.data || { items: [], jumlah_reviewer_aktif: 0 };
}

/**
 * Menugaskan satu atau beberapa reviewer ke pengajuan tertentu
 * @param {number|string} pengajuanId
 * @param {Array<number>} dosenIds
 * @returns {Promise<object>}
 */
export async function assignApplicationReviewers(pengajuanId, dosenIds) {
  const response = await api.post(`/api/kaprodi/pengajuan/${pengajuanId}/reviewer`, {
    dosen_ids: dosenIds.map(Number),
  });
  return response.data?.data;
}

/**
 * Menugaskan satu dosen reviewer ke banyak pengajuan sekaligus (Shortcut Bulk Assignment)
 * @param {Array<number>} pengajuanIds
 * @param {number|string} dosenId
 * @returns {Promise<{ created: number, already_assigned: number, items: Array }>}
 */
export async function assignBulkReviewers(pengajuanIds, dosenId) {
  const response = await api.post('/api/kaprodi/penugasan-reviewer/bulk', {
    pengajuan_ids: pengajuanIds.map(Number),
    dosen_id: Number(dosenId),
  });
  return response.data?.data;
}

/**
 * Mengganti reviewer aktif dengan reviewer baru disertai alasan
 * @param {number|string} penugasanId
 * @param {object} payload
 * @param {number} payload.dosen_id_baru
 * @param {string} payload.alasan
 * @returns {Promise<object>}
 */
export async function replaceApplicationReviewer(penugasanId, { dosen_id_baru, alasan }) {
  const response = await api.post(`/api/kaprodi/penugasan-reviewer/${penugasanId}/ganti`, {
    dosen_id_baru: Number(dosen_id_baru),
    alasan,
  });
  return response.data?.data;
}

/**
 * Menonaktifkan penugasan reviewer dengan alasan
 * @param {number|string} penugasanId
 * @param {string} alasan
 * @returns {Promise<object>}
 */
export async function deactivateApplicationReviewer(penugasanId, alasan) {
  const response = await api.patch(`/api/kaprodi/penugasan-reviewer/${penugasanId}`, {
    alasan,
  });
  return response.data?.data;
}

/**
 * Mengunduh berkas dokumen proposal pengajuan KP
 * @param {number|string} pengajuanId
 * @param {number|string} dokumenId
 * @returns {Promise<Blob>}
 */
export async function downloadProposalDocument(pengajuanId, dokumenId) {
  const response = await api.get(`/api/kaprodi/pengajuan/${pengajuanId}/dokumen/${dokumenId}/file`, {
    responseType: 'blob',
  });
  return response.data;
}
