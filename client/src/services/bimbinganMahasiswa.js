import api from './api.js';
import { apiErrorMessage } from './apiError.js';

export const BIMBINGAN_STATUS = Object.freeze({
  ALL: '',
  DRAFT: 'DRAFT',
  MENUNGGU: 'MENUNGGU_VALIDASI',
  VALID: 'TERVALIDASI',
  REVISI: 'PERLU_PERBAIKAN',
  DITOLAK: 'DITOLAK',
});

export const BIMBINGAN_JENIS = Object.freeze({
  ALL: '',
  OFFLINE: 'OFFLINE',
  ONLINE: 'ONLINE',
});

/**
 * Mapping pesan error ramah pengguna untuk modul Bimbingan Mahasiswa
 * @param {Error|object} error - Error dari Axios atau runtime
 * @param {string} defaultMessage - Pesan cadangan
 * @returns {string}
 */
export function bimbinganErrorMessage(error, defaultMessage = 'Terjadi kesalahan pada modul bimbingan.') {
  const errData = error?.response?.data?.error;
  const code = errData?.code;

  if (code === 'BIMBINGAN_UNAVAILABLE') {
    return 'Pengajuan KP Anda belum siap untuk bimbingan atau Dosen Pembimbing belum ditetapkan.';
  }
  if (code === 'BIMBINGAN_NOT_FOUND') {
    return 'Catatan bimbingan tidak ditemukan atau bukan milik pengajuan Anda.';
  }
  if (code === 'BIMBINGAN_CONFLICT') {
    return errData?.message || 'Status atau versi pengiriman bimbingan telah berubah di server. Silakan muat ulang halaman.';
  }
  if (code === 'INVALID_DATE') {
    return errData?.message || 'Tanggal bimbingan tatap muka tidak valid atau berada di masa depan.';
  }
  if (code === 'INVALID_RINGKASAN') {
    return 'Ringkasan materi bimbingan wajib diisi (maksimal 10.000 karakter).';
  }
  if (code === 'INVALID_DOCUMENT') {
    return errData?.message || 'Lampiran berkas harus berupa dokumen PDF dengan ukuran maksimal 5 MB per berkas.';
  }
  if (code === 'LIMIT_FILE_SIZE') {
    return 'Ukuran berkas melebihi batas maksimal 5 MB.';
  }
  if (code === 'PROFILE_UNAVAILABLE') {
    return 'Profil data diri mahasiswa Anda tidak aktif atau belum terverifikasi.';
  }
  if (code === 'RATE_LIMITED') {
    return 'Terlalu banyak aktivitas bimbingan dalam waktu singkat. Silakan tunggu beberapa saat.';
  }
  if (code === 'VALIDATION_ERROR') {
    return errData?.message || 'Input bimbingan tidak valid. Periksa kembali isian formulir Anda.';
  }
  return apiErrorMessage(error, { fallback: defaultMessage });
}

export async function fetchBimbinganContext({ signal } = {}) {
  const response = await api.get('/api/pengajuan/bimbingan/konteks', { signal });
  return response.data?.data ?? null;
}

/**
 * Mengambil ringkasan progres dan target minimal bimbingan
 * @param {number|string} pengajuanId
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function fetchBimbinganProgress(pengajuanId, { signal } = {}) {
  const response = await api.get(`/api/pengajuan/${pengajuanId}/bimbingan/progres`, { signal });
  return response.data?.data;
}

/**
 * Mengambil daftar catatan bimbingan mahasiswa
 * @param {number|string} pengajuanId
 * @param {object} [params]
 * @param {object} [options]
 * @returns {Promise<{ items: Array, pagination: object, progres: object }>}
 */
export async function fetchBimbinganList(pengajuanId, params = {}, { signal } = {}) {
  const cleanParams = {};
  const search = params.q?.trim();
  if (search) cleanParams.q = search;
  if (params.page && Number.isInteger(Number(params.page))) cleanParams.page = Number(params.page);
  if (params.limit && Number.isInteger(Number(params.limit))) cleanParams.limit = Number(params.limit);
  if (params.jenis_bimbingan && ['OFFLINE', 'ONLINE'].includes(params.jenis_bimbingan)) {
    cleanParams.jenis_bimbingan = params.jenis_bimbingan;
  }
  if (params.status_bimbingan && ['DRAFT', 'MENUNGGU_VALIDASI', 'TERVALIDASI', 'PERLU_PERBAIKAN', 'DITOLAK'].includes(params.status_bimbingan)) {
    cleanParams.status_bimbingan = params.status_bimbingan;
  }

  const response = await api.get(`/api/pengajuan/${pengajuanId}/bimbingan`, {
    params: cleanParams,
    signal,
  });
  return response.data?.data || { items: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 1 } };
}

/**
 * Mengambil rincian satu sesi bimbingan beserta riwayat pengirimannya
 * @param {number|string} pengajuanId
 * @param {number|string} id
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function fetchBimbinganDetail(pengajuanId, id, { signal } = {}) {
  const response = await api.get(`/api/pengajuan/${pengajuanId}/bimbingan/${id}`, { signal });
  return response.data?.data;
}

/**
 * Membuat draf log bimbingan baru
 * @param {number|string} pengajuanId
 * @param {object} payload
 * @param {'OFFLINE'|'ONLINE'} payload.jenis_bimbingan
 * @param {string|null} [payload.tanggal_bimbingan]
 * @param {string|null} [payload.ringkasan]
 * @returns {Promise<object>}
 */
export async function createBimbinganDraft(pengajuanId, payload) {
  const response = await api.post(`/api/pengajuan/${pengajuanId}/bimbingan`, payload);
  return response.data?.data;
}

/**
 * Memperbarui isian draf bimbingan yang belum dikirim
 * @param {number|string} pengajuanId
 * @param {number|string} id
 * @param {object} payload
 * @param {string|null} [payload.tanggal_bimbingan]
 * @param {string|null} [payload.ringkasan]
 * @returns {Promise<object>}
 */
export async function updateBimbinganDraft(pengajuanId, id, payload) {
  const response = await api.patch(`/api/pengajuan/${pengajuanId}/bimbingan/${id}`, payload);
  return response.data?.data;
}

/**
 * Mengirimkan catatan bimbingan ke dosen pembimbing disertai lampiran berkas PDF opsional
 * @param {number|string} pengajuanId
 * @param {number|string} id
 * @param {object} payload - { ringkasan, tanggal_bimbingan }
 * @param {File[]} [files=[]] - Maksimal 3 file PDF
 * @returns {Promise<object>}
 */
export async function submitBimbingan(pengajuanId, id, payload, files = []) {
  return sendBimbingan(pengajuanId, id, 'kirim', payload, files);
}

export async function submitBimbinganWithDraft(pengajuanId, {
  draftId, jenisBimbingan, payload, files, onDraftCreated,
}) {
  let id = draftId;
  if (!id) {
    const draft = await createBimbinganDraft(pengajuanId, { jenis_bimbingan: jenisBimbingan, ...payload });
    id = draft.id;
    onDraftCreated(id);
  }
  return submitBimbingan(pengajuanId, id, payload, files);
}

export async function submitBimbinganRevision(pengajuanId, id, payload, files = []) {
  return sendBimbingan(pengajuanId, id, 'revisi', payload, files);
}

async function sendBimbingan(pengajuanId, id, action, payload, files) {
  let body = payload;
  if (files.length) {
    body = new FormData();
    for (const field of ['ringkasan', 'tanggal_bimbingan']) {
      if (payload[field] != null) body.append(field, payload[field]);
    }
    for (const file of files) body.append('files', file);
  }
  const response = await api.post(`/api/pengajuan/${pengajuanId}/bimbingan/${id}/${action}`, body);
  return response.data?.data;
}

/**
 * Mengambil histori linimasa pengiriman dan catatan telaah pembimbing
 * @param {number|string} pengajuanId
 * @param {number|string} id
 * @param {object} [options]
 * @returns {Promise<Array>}
 */
export async function fetchBimbinganHistory(pengajuanId, id, { signal } = {}) {
  const response = await api.get(`/api/pengajuan/${pengajuanId}/bimbingan/${id}/riwayat`, { signal });
  return response.data?.data || [];
}

/**
 * Mengunduh berkas lampiran materi bimbingan
 * @param {number|string} pengajuanId
 * @param {number|string} id
 * @param {number|string} lampiranId
 * @returns {Promise<Blob>}
 */
export async function downloadBimbinganAttachment(pengajuanId, id, lampiranId) {
  const response = await api.get(
    `/api/pengajuan/${pengajuanId}/bimbingan/${id}/lampiran/${lampiranId}/file`,
    { responseType: 'blob' }
  );
  return response.data;
}

/**
 * Helper memicu unduhan browser untuk objek Blob berkas
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerBlobDownload(blob, filename = 'lampiran-bimbingan.pdf') {
  if (typeof window === 'undefined' || !window.URL) return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
