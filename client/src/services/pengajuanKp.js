/**
 * Service API Pengajuan Kerja Praktik (KP) Mahasiswa - SIPKITA
 * Menghubungkan client dengan endpoint backend /api/pengajuan
 * 
 * Rujukan: PRD-backend-pengajuan-kp-mahasiswa-sipkita.md & .agents/skills/feature-implementation
 */

import api from './api.js';
import { apiErrorMessage } from './apiError.js';

const BASE_PATH = '/api/pengajuan';

/**
 * Daftar kode dokumen khusus untuk alur Kerja Praktik (KP)
 */
export const KP_DOCUMENT_CODES = Object.freeze({
  PROPOSAL: 'PROPOSAL_KP',
  BUKTI_BAYAR: 'BUKTI_BAYAR_PROPOSAL_KP',
  SPP_VARIABEL: 'BUKTI_SPP_VARIABEL_KP',
  SERTIFIKAT_SOSIALISASI: 'SERTIFIKAT_SOSIALISASI_KP',
  SURAT_SOSIALISASI: 'SURAT_PERNYATAAN_SOSIALISASI_KP',
});

/**
 * Enum status pengajuan KP sesuai state machine backend
 */
export const KP_STATUS_PENGAJUAN = Object.freeze({
  DRAFT: 'DRAFT',
  DIAJUKAN: 'DIAJUKAN',
  ACC: 'ACC',
  TIDAK_ACC: 'TIDAK_ACC',
});

/**
 * Helper ekstraksi pesan error backend secara terpusat & human-friendly
 * @param {Error|object} error - Error dari axios atau runtime
 * @param {string} defaultMessage - Pesan default jika error tidak spesifik
 * @returns {string} Pesan kesalahan bahasa Indonesia
 */
export function pengajuanKpErrorMessage(error, defaultMessage = 'Terjadi kesalahan pada proses pengajuan KP.') {
  const errData = error?.response?.data?.error;
  const backendMessage = errData?.message;

  if (backendMessage && typeof backendMessage === 'string') {
    // Jika ada rincian field yang kurang lengkap pada error 422
    if (errData?.details?.missing && Array.isArray(errData.details.missing)) {
      const fieldNames = {
        tema_penelitian_id: 'Tema Penelitian',
        judul_penelitian: 'Usulan Judul KP',
        objek_penelitian: 'Objek/Instansi Penelitian',
        lokasi_penelitian: 'Lokasi/Kota Pelaksanaan',
        usulan_pembimbing_id: 'Usulan Dosen Pembimbing',
        ipk_saat_pengajuan: 'Nilai IPK',
        jumlah_sks_saat_pengajuan: 'Jumlah SKS',
        memiliki_nilai_de: 'Konfirmasi Nilai D/E',
        daftar_mk_nilai_de: 'Daftar Mata Kuliah Nilai D/E',
        sudah_bayar_spp_variabel: 'Deklarasi SPP Variabel',
        PROPOSAL_KP: 'Berkas Proposal KP',
        BUKTI_BAYAR_PROPOSAL_KP: 'Bukti Pembayaran Proposal KP',
        BUKTI_SPP_VARIABEL_KP: 'Bukti SPP Variabel',
        'SERTIFIKAT_SOSIALISASI_KP|SURAT_PERNYATAAN_SOSIALISASI_KP': 'Sertifikat atau Surat Pernyataan Sosialisasi KP',
      };
      const missingLabels = errData.details.missing
        .map((key) => fieldNames[key] || key)
        .join(', ');
      return `${backendMessage} Belum lengkap: ${missingLabels}.`;
    }
    return backendMessage;
  }

  return apiErrorMessage(error, { fallback: defaultMessage,
    networkMessage: 'Koneksi ke server terputus. Pastikan jaringan internet Anda stabil.' });
}

/**
 * Validasi awal file berkas PDF di sisi client sebelum diunggah ke server
 * @param {File} file - Objek file dari input form
 * @param {number} maxMb - Batas maksimum file dalam Megabyte (default 10 MB)
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateKpDocumentFile(file, maxMb = 10) {
  if (!file) {
    return { valid: false, error: 'Silakan pilih berkas dokumen terlebih dahulu.' };
  }

  // Validasi format/MIME type PDF
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return { valid: false, error: 'Berkas harus berupa dokumen dengan format PDF (.pdf).' };
  }

  // Validasi ukuran berkas
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Ukuran berkas (${sizeMb} MB) melebihi batas maksimal yang diizinkan (${maxMb} MB).`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Mengambil opsi form, periode aktif, status buka jadwal, tema, dan kelengkapan data diri
 * @param {string} tahap - Kode tahap akademik (default: 'KP')
 * @returns {Promise<object>} Data opsi formulir dari server
 */
export async function getKpFormOptions(tahap = 'KP') {
  const response = await api.get(`${BASE_PATH}/opsi-form`, {
    params: { tahap },
  });
  return response.data.data;
}

/**
 * Mengambil riwayat daftar pengajuan KP milik mahasiswa yang login
 * @param {object} params - Query params { page, limit, status }
 * @returns {Promise<{ items: Array, pagination: object }>}
 */
export async function listOwnKpApplications(params = {}) {
  const response = await api.get(BASE_PATH, { params });
  return response.data.data;
}

export async function listAllOwnKpApplications() {
  const items = [];
  let page = 1;
  let totalPages;
  do {
    const result = await listOwnKpApplications({ page, limit: 100 });
    items.push(...result.items);
    totalPages = result.pagination.total_pages;
    page += 1;
  } while (page <= totalPages);
  return items;
}

/**
 * Mengambil detail lengkap suatu pengajuan KP
 * @param {number|string} id - ID Pengajuan
 * @returns {Promise<object>} Objek detail pengajuan
 */
export async function getKpApplicationDetail(id) {
  const response = await api.get(`${BASE_PATH}/${id}`);
  return response.data.data;
}

/**
 * Membuat draf pengajuan KP baru (status: DRAFT)
 * @param {object} payload - Isian formulir pengajuan
 * @returns {Promise<object>} Ringkasan pengajuan yang baru dibuat
 */
export async function createKpDraft(payload) {
  const response = await api.post(BASE_PATH, payload);
  return response.data.data;
}

/**
 * Memperbarui isian draf pengajuan KP yang belum dikirim
 * @param {number|string} id - ID Pengajuan
 * @param {object} payload - Field yang diubah
 * @returns {Promise<object>} Objek detail pengajuan yang diperbarui
 */
export async function updateKpDraft(id, payload) {
  const response = await api.patch(`${BASE_PATH}/${id}`, payload);
  return response.data.data;
}

/**
 * Mengunggah satu berkas dokumen persyaratan ke draf pengajuan
 * @param {number|string} id - ID Pengajuan
 * @param {string} kodeJenis - Kode jenis dokumen (misal: 'PROPOSAL_KP')
 * @param {File} file - Berkas file PDF
 * @returns {Promise<object>} Info versi dokumen yang berhasil diunggah
 */
export async function uploadKpDocument(id, kodeJenis, file) {
  const formData = new FormData();
  formData.append('kode_jenis', kodeJenis);
  formData.append('file', file);

  const response = await api.post(`${BASE_PATH}/${id}/dokumen`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data;
}

/**
 * Mengunduh berkas dokumen persyaratan pengajuan sebagai Blob
 * @param {number|string} id - ID Pengajuan
 * @param {number|string} dokumenId - ID Dokumen Pengajuan
 * @returns {Promise<Blob>} File binary blob
 */
export async function downloadKpDocumentFile(id, dokumenId) {
  const response = await api.get(`${BASE_PATH}/${id}/dokumen/${dokumenId}/file`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Mengirimkan pengajuan secara final ke Program Studi (Submit)
 * Mengubah status pengajuan dari DRAFT menjadi DIAJUKAN
 * @param {number|string} id - ID Pengajuan
 * @param {boolean} setujuPernyataan - Wajib bernilai true
 * @returns {Promise<object>} Status hasil pengiriman
 */
export async function submitKpApplication(id, setujuPernyataan = true) {
  const response = await api.post(`${BASE_PATH}/${id}/kirim`, {
    setuju_pernyataan: setujuPernyataan,
  });
  return response.data.data;
}

/**
 * Memperbaiki berkas atau data administrasi setelah verifikasi Admin Prodi (jika BELUM_OK)
 * @param {number|string} id - ID Pengajuan
 * @param {object} payload - Perubahan data perbaikan
 * @returns {Promise<object>} Objek pengajuan yang telah diperbaiki
 */
export async function reviseKpApplication(id, payload) {
  const response = await api.patch(`${BASE_PATH}/${id}/perbaikan`, payload);
  return response.data.data;
}

/**
 * Memberitahu Admin Prodi bahwa perbaikan administrasi telah selesai diperbaiki
 * @param {number|string} id - ID Pengajuan
 * @returns {Promise<object>} Status hasil pengiriman perbaikan
 */
export async function sendKpRevision(id, kategori) {
  const response = await api.post(`${BASE_PATH}/${id}/kirim-perbaikan`, { kategori });
  return response.data.data;
}

/**
 * Melihat catatan dan hasil penilaian dari Dosen Reviewer Proposal
 * @param {number|string} id - ID Pengajuan
 * @returns {Promise<object>} Catatan review proposal
 */
export async function getKpReviews(id) {
  const response = await api.get(`${BASE_PATH}/${id}/review`);
  return response.data.data;
}

/**
 * Mengunggah file proposal revisi yang telah disempurnakan mahasiswa
 * @param {number|string} id - ID Pengajuan
 * @param {File} file - File PDF proposal revisi baru
 * @param {number|string} [expectedDokumenPengajuanId] - ID Dokumen Pengajuan proposal sebelumnya yang direvisi
 * @param {string} [revisionNote] - Catatan perbaikan mahasiswa, bila ada
 * @returns {Promise<object>} Status hasil unggah revisi proposal
 */
export async function uploadKpRevisedProposal(id, file, expectedDokumenPengajuanId = null, revisionNote = '') {
  const formData = new FormData();
  formData.append('file', file);
  if (revisionNote.trim()) formData.append('catatan_perbaikan', revisionNote.trim());
  if (expectedDokumenPengajuanId) {
    formData.append('expected_dokumen_pengajuan_id', expectedDokumenPengajuanId);
  }

  const response = await api.post(`${BASE_PATH}/${id}/revisi-proposal`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data;
}

