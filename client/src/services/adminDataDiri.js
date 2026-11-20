import api from './api.js';
import { apiErrorMessage } from './apiError.js';
import { readListResponse } from './apiResponse.js';

export function adminDataDiriErrorMessage(error, defaultMessage = 'Terjadi kesalahan pada verifikasi data diri.') {
  return apiErrorMessage(error, { fallback: defaultMessage });
}

/**
 * Mengambil daftar mahasiswa untuk verifikasi data diri Admin Prodi.
 * Filter query disesuaikan secara ketat dengan validator server:
 * hanya mengirim key yang memiliki nilai nyata ('page', 'limit', 'search', 'status', 'lengkap').
 */
export async function fetchAdminDataDiriList({
  page = 1,
  limit = 20,
  search = '',
  status = '',
  lengkap = null,
} = {}, { signal } = {}) {
  const params = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (search && search.trim()) params.search = search.trim();
  if (status && status.trim()) params.status = status.trim();
  if (lengkap === true || lengkap === 'true') params.lengkap = 'true';
  else if (lengkap === false || lengkap === 'false') params.lengkap = 'false';

  const response = await api.get('/api/admin-prodi/verifikasi-data-diri', { params, signal });
  return readListResponse(response);
}

/**
 * Mengambil detail lengkap verifikasi data diri mahasiswa dan 6 dokumen wajib.
 */
export async function fetchAdminDataDiriDetail(mahasiswaId, { signal } = {}) {
  const response = await api.get(`/api/admin-prodi/verifikasi-data-diri/${encodeURIComponent(mahasiswaId)}`, { signal });
  return response.data.data;
}

/**
 * Mengambil blob stream file PDF dokumen mahasiswa.
 */
export async function fetchAdminDataDiriDocumentFile(mahasiswaId, kodeJenis, { signal } = {}) {
  const response = await api.get(
    `/api/admin-prodi/verifikasi-data-diri/${encodeURIComponent(mahasiswaId)}/dokumen/${encodeURIComponent(kodeJenis)}/file`,
    {
      responseType: 'blob', signal,
    },
  );
  return response.data;
}

/**
 * Memberikan keputusan verifikasi pada satu dokumen (TERVERIFIKASI atau PERLU_PERBAIKAN).
 * Payload dibatasi ketat: { status, catatan, expectedVersion }
 */
export async function verifyAdminDataDiriDocument(mahasiswaId, kodeJenis, { status, catatan = null, expectedVersion }) {
  const payload = {
    status,
    catatan: catatan ? catatan.trim() : null,
    expectedVersion: Number(expectedVersion),
  };
  const response = await api.patch(
    `/api/admin-prodi/verifikasi-data-diri/${encodeURIComponent(mahasiswaId)}/dokumen/${encodeURIComponent(kodeJenis)}`,
    payload,
  );
  return response.data.data;
}

/**
 * Menyetujui ke-6 berkas wajib sekaligus untuk satu mahasiswa.
 * Payload dibatasi ketat: { expectedVersions: { [kodeJenis]: number } }
 */
export async function verifyAllAdminDataDiri(mahasiswaId, expectedVersions) {
  const payload = {
    expectedVersions,
  };
  const response = await api.post(
    `/api/admin-prodi/verifikasi-data-diri/${encodeURIComponent(mahasiswaId)}/verifikasi-semua`,
    payload,
  );
  return response.data.data;
}

