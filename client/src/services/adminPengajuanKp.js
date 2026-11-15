import api from './api.js';
import { apiErrorMessage } from './apiError.js';

const BASE_PATH = '/api/admin-prodi/pengajuan';

/**
 * Status pengajuan administratif KP
 */
export const ADMIN_KP_STATUS_PENGAJUAN = Object.freeze({
  DIAJUKAN: 'DIAJUKAN',
  ACC: 'ACC',
  TIDAK_ACC: 'TIDAK_ACC',
});

/**
 * Status pemeriksaan kategori Berkas dan Nilai
 */
export const ADMIN_KP_CATEGORY_STATUS = Object.freeze({
  BELUM_DIPERIKSA: 'BELUM_DIPERIKSA',
  BELUM_OK: 'BELUM_OK',
  OK_LENGKAP: 'OK_LENGKAP',
});

/**
 * Helper ekstraksi pesan error backend ramah pengguna
 * @param {Error|object} error - Error objek dari Axios atau network
 * @param {string} defaultMessage - Pesan cadangan
 * @returns {string}
 */
export function adminPengajuanKpErrorMessage(error, defaultMessage = 'Terjadi kesalahan pada pemeriksaan pengajuan KP.') {
  const errData = error?.response?.data?.error;
  const code = errData?.code;

  if (code === 'STALE_SNAPSHOT') {
    return 'Data pengajuan telah diperbarui oleh mahasiswa atau pengguna lain. Halaman akan dimuat ulang.';
  }
  if (code === 'REVISION_PENDING') {
    return 'Kategori masih berstatus BELUM OK dan menunggu perbaikan resmi dari mahasiswa.';
  }
  if (code === 'PERSONAL_DATA_NOT_VERIFIED') {
    return 'Data diri mahasiswa belum diverifikasi lengkap (6/6 dokumen identitas wajib).';
  }
  if (code === 'INCOMPLETE_DOCUMENTS') {
    return 'Berkas persyaratan KP belum lengkap atau tidak konsisten dengan deklarasi SPP.';
  }
  if (code === 'CATEGORIES_NOT_APPROVED') {
    return 'Kategori Berkas dan Nilai harus berstatus OK Lengkap sebelum ACC dapat diputuskan.';
  }
  if (code === 'APPLICATION_LOCKED') {
    return 'Pengajuan ini sudah berstatus final dan terkunci.';
  }
  return apiErrorMessage(error, { fallback: defaultMessage });
}

/**
 * Mengambil daftar pengajuan KP mahasiswa untuk Admin Prodi
 * @param {object} params
 * @param {number} [params.page=1] - Nomor halaman
 * @param {number} [params.limit=20] - Jumlah baris per halaman
 * @param {string} [params.search=''] - Pencarian NIM atau nama mahasiswa
 * @param {string} [params.status_pengajuan=''] - Filter status ('DIAJUKAN', 'ACC', 'TIDAK_ACC')
 * @param {string} [params.status_berkas=''] - Filter status berkas ('BELUM_DIPERIKSA', 'BELUM_OK', 'OK_LENGKAP')
 * @param {string} [params.status_nilai=''] - Filter status nilai ('BELUM_DIPERIKSA', 'BELUM_OK', 'OK_LENGKAP')
 * @returns {Promise<{ items: Array, pagination: object }>}
 */
export async function fetchAdminKpApplications({
  page = 1,
  limit = 20,
  search = '',
  status_pengajuan = '',
  status_berkas = '',
  status_nilai = '',
} = {}) {
  const params = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (search && search.trim()) params.search = search.trim();
  if (status_pengajuan && status_pengajuan.trim()) params.status_pengajuan = status_pengajuan.trim();
  if (status_berkas && status_berkas.trim()) params.status_berkas = status_berkas.trim();
  if (status_nilai && status_nilai.trim()) params.status_nilai = status_nilai.trim();

  const response = await api.get(BASE_PATH, { params });
  return response.data.data;
}

/**
 * Mengambil detail lengkap pengajuan KP mahasiswa termasuk snapshot concurrency
 * @param {number|string} id - ID Pengajuan
 * @returns {Promise<object>} Detail pengajuan dengan field snapshot SHA-256
 */
export async function fetchAdminKpDetail(id) {
  const response = await api.get(`${BASE_PATH}/${id}`);
  return response.data.data;
}

/**
 * Mengunduh berkas PDF persyaratan KP secara privat
 * @param {number|string} id - ID Pengajuan
 * @param {number|string} dokumenId - ID Dokumen Pengajuan
 * @returns {Promise<Blob>} Binary PDF blob
 */
export async function downloadAdminKpDocumentFile(id, dokumenId) {
  const response = await api.get(`${BASE_PATH}/${id}/dokumen/${dokumenId}/file`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Memperbarui status pemeriksaan kategori Berkas atau Nilai
 * @param {number|string} id - ID Pengajuan
 * @param {object} payload
 * @param {'BERKAS'|'NILAI'} payload.category - Kategori yang diperiksa
 * @param {'BELUM_OK'|'OK_LENGKAP'} payload.status - Status hasil pemeriksaan
 * @param {string|null} [payload.catatan=null] - Catatan perbaikan (wajib jika BELUM_OK)
 * @param {string} payload.expected_snapshot - Token snapshot concurrency
 * @returns {Promise<object>}
 */
export async function examineAdminKpCategory(id, {
  category,
  status,
  catatan = null,
  expected_snapshot,
}) {
  const endpoint = category === 'BERKAS'
    ? `${BASE_PATH}/${id}/pemeriksaan-berkas`
    : `${BASE_PATH}/${id}/pemeriksaan-nilai`;

  const payload = {
    status,
    catatan: catatan?.trim() || null,
    expected_snapshot,
  };

  const response = await api.patch(endpoint, payload);
  return response.data.data;
}

/**
 * Mengambil keputusan akhir pengajuan KP (ACC atau TIDAK_ACC)
 * @param {number|string} id - ID Pengajuan
 * @param {object} payload
 * @param {'ACC'|'TIDAK_ACC'} payload.status - Keputusan akhir
 * @param {string|null} [payload.catatan=null] - Alasan/catatan keputusan (wajib jika TIDAK_ACC)
 * @param {string} payload.expected_snapshot - Token snapshot concurrency
 * @returns {Promise<object>}
 */
export async function decideAdminKpApplication(id, {
  status,
  catatan = null,
  expected_snapshot,
}) {
  const payload = {
    status,
    catatan: catatan?.trim() || null,
    expected_snapshot,
  };

  const response = await api.post(`${BASE_PATH}/${id}/keputusan`, payload);
  return response.data.data;
}

/**
 * Menyetujui semua persyaratan pengajuan KP secara atomik dalam satu klik ("ACC Semua")
 * @param {number|string} id - ID Pengajuan
 * @param {object} payload
 * @param {string} payload.expected_snapshot - Token snapshot concurrency
 * @returns {Promise<object>}
 */
export async function approveAllAdminKp(id, { expected_snapshot }) {
  const payload = {
    konfirmasi: true,
    expected_snapshot,
  };

  const response = await api.post(`${BASE_PATH}/${id}/acc-lengkap`, payload);
  return response.data.data;
}

