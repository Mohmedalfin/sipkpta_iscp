import api from './api.js';
import { apiErrorMessage } from './apiError.js';
import { readListResponse } from './apiResponse.js';

export function dosenErrorMessage(error, defaultMessage = 'Terjadi kesalahan pada data dosen.') {
  return apiErrorMessage(error, { fallback: defaultMessage });
}

/**
 * Mengambil daftar data dosen dengan paginasi dan pencarian.
 * Parameter query dibatasi ketat: page, limit, search.
 */
export async function fetchDosenList({
  page = 1,
  limit = 20,
  search = '',
} = {}, { signal } = {}) {
  const params = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (search && search.trim()) params.search = search.trim();

  const response = await api.get('/api/master/dosen', { params, signal });
  return readListResponse(response);
}

/**
 * Mengambil detail profil lengkap dosen berdasarkan ID.
 */
export async function fetchDosenDetail(id, { signal } = {}) {
  const response = await api.get(`/api/master/dosen/${encodeURIComponent(id)}`, { signal });
  return response.data.data;
}

/**
 * Menambah akun dan profil dosen baru secara manual.
 */
export async function createDosen(payload) {
  const response = await api.post('/api/master/dosen', payload);
  return response.data.data;
}

/**
 * Memperbarui profil dosen secara manual.
 */
export async function updateDosen(id, payload) {
  const response = await api.patch(`/api/master/dosen/${encodeURIComponent(id)}`, payload);
  return response.data.data;
}

/**
 * Mengubah status keaktifan akun dosen (AKTIF / NONAKTIF).
 */
export async function changeDosenStatus(id, status_akun) {
  const response = await api.patch(`/api/master/dosen/${encodeURIComponent(id)}/status`, {
    status_akun,
  });
  return response.data.data;
}

/**
 * Menghapus akun dan profil dosen (jika belum berelasi dengan data penting).
 */
export async function deleteDosen(id) {
  const response = await api.delete(`/api/master/dosen/${encodeURIComponent(id)}`);
  return response.data;
}

/**
 * Mengunggah berkas CSV data dosen untuk dianalisis dan dipratinjau.
 */
export async function previewDosenImport(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/master/dosen/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

/**
 * Mengonfirmasi eksekusi impor untuk baris data yang valid dari sesi preview.
 */
export async function confirmDosenImport(previewId) {
  const response = await api.post('/api/master/dosen/import', {
    previewId,
    confirmValidOnly: true,
  });
  return response.data.data;
}

/**
 * Mengunduh berkas laporan Excel (.xlsx) yang memuat baris data dosen yang gagal/bermasalah.
 */
export async function downloadDosenImportErrors(previewId) {
  const response = await api.get(`/api/master/dosen/import/${encodeURIComponent(previewId)}/errors.xlsx`, {
    responseType: 'blob',
    timeout: 60_000,
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'dosen-import-errors.xlsx');
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Menghasilkan dan mengunduh berkas template CSV standar untuk impor data dosen.
 * Menggunakan BOM UTF-8 dan hint 'sep=,' agar Microsoft Excel membaca pemisah koma
 * dan titik koma dengan tepat di berbagai preferensi regional OS.
 */
export function downloadDosenCsvTemplate() {
  const headers = 'kode_dosen,nidn,nama,tanggal_lahir,email,no_telepon,jabatan_fungsional,is_homebase_si';
  const sample1 = 'DSN001,0014058201,"Dr. Eng. Andi Pratama, S.T., M.T.",1982-05-14,dosen.andi@sipkita.test,081234567890,"Lektor Kepala",true';
  const sample2 = 'DSN002,0022088502,"Ratna Dewi, M.Kom.",1985-08-22,dosen.ratna@sipkita.test,081298765432,Lektor,true';
  const content = `\uFEFFsep=,\r\n${headers}\r\n${sample1}\r\n${sample2}\r\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'template-impor-dosen.csv');
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

