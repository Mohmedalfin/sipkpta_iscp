import api from './api.js';
import { apiErrorMessage } from './apiError.js';
import { readListResponse } from './apiResponse.js';

export function mahasiswaErrorMessage(error, defaultMessage = 'Terjadi kesalahan pada data mahasiswa.') {
  return apiErrorMessage(error, { fallback: defaultMessage,
    timeoutMessage: 'Proses terlalu lama. Periksa kembali hasil impor sebelum mencoba ulang.' });
}

/**
 * Mengambil daftar mahasiswa dengan paginasi, pencarian, dan filter angkatan.
 * Query params dibatasi ketat sesuai kontrak backend: page, limit, search, tahun_angkatan.
 */
export async function fetchMahasiswaList({
  page = 1,
  limit = 20,
  search = '',
  tahun_angkatan = null,
} = {}, { signal } = {}) {
  const params = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (search && search.trim()) params.search = search.trim();
  if (tahun_angkatan) params.tahun_angkatan = Number(tahun_angkatan);

  const response = await api.get('/api/master/mahasiswa', { params, signal });
  return readListResponse(response);
}

/**
 * Mengambil detail profil lengkap mahasiswa berdasarkan ID.
 */
export async function fetchMahasiswaDetail(id, { signal } = {}) {
  const response = await api.get(`/api/master/mahasiswa/${encodeURIComponent(id)}`, { signal });
  return response.data.data;
}

/**
 * Menambah akun dan profil mahasiswa baru secara manual.
 */
export async function createMahasiswa(payload) {
  const response = await api.post('/api/master/mahasiswa', payload);
  return response.data.data;
}

/**
 * Memperbarui profil mahasiswa secara manual.
 */
export async function updateMahasiswa(id, payload) {
  const response = await api.patch(`/api/master/mahasiswa/${encodeURIComponent(id)}`, payload);
  return response.data.data;
}

/**
 * Mengubah status keaktifan akun mahasiswa (AKTIF / NONAKTIF).
 */
export async function changeMahasiswaStatus(id, status_akun) {
  const response = await api.patch(`/api/master/mahasiswa/${encodeURIComponent(id)}/status`, {
    status_akun,
  });
  return response.data.data;
}

/**
 * Menghapus akun dan profil mahasiswa (jika belum berelasi dengan data penting).
 */
export async function deleteMahasiswa(id) {
  const response = await api.delete(`/api/master/mahasiswa/${encodeURIComponent(id)}`);
  return response.data;
}



/**
 * Mengunggah berkas CSV data mahasiswa untuk dianalisis dan dipratinjau.
 */
export async function previewMahasiswaImport(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/master/mahasiswa/import/preview', formData, {
    timeout: 60_000,
  });
  return response.data.data;
}

/**
 * Mengonfirmasi eksekusi impor untuk baris data yang valid dari sesi preview.
 */
export async function confirmMahasiswaImport(previewId) {
  const response = await api.post('/api/master/mahasiswa/import', {
    previewId,
    confirmValidOnly: true,
  }, { timeout: 180_000 });
  return response.data.data;
}

/**
 * Mengunduh berkas laporan Excel (.xlsx) yang memuat baris data yang gagal/bermasalah.
 */
export async function downloadMahasiswaImportErrors(previewId) {
  const response = await api.get(`/api/master/mahasiswa/import/${encodeURIComponent(previewId)}/errors.xlsx`, {
    responseType: 'blob',
    timeout: 60_000,
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'mahasiswa-import-errors.xlsx');
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Menghasilkan dan mengunduh berkas template CSV standar untuk impor data mahasiswa.
 */
export function downloadMahasiswaCsvTemplate() {
  const headers = 'nim,nama,tanggal_lahir,email,angkatan,nik_kependudukan,tempat_lahir,no_telepon,alamat';
  const sample1 = '1202240001,Ahmad Dahlan,2003-05-15,ahmad.dahlan@student.ac.id,2024,3201011505030001,Yogyakarta,081234567890,"Jl. Ringroad Utara No. 1"';
  const sample2 = '1202240002,Siti Aminah,2004-08-20,siti.aminah@student.ac.id,2024,3201012008040002,Sleman,081298765432,"Jl. Kaliurang KM 5"';
  const content = `\uFEFFsep=,\r\n${headers}\r\n${sample1}\r\n${sample2}\r\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'template-impor-mahasiswa.csv');
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
