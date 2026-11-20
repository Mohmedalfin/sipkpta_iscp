import api from './api.js';
import { apiErrorMessage } from './apiError.js';

function positiveId(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= 2147483647 ? number : null;
}

function listParams(params, idKeys = []) {
  const clean = {};
  for (const key of ['page', ...idKeys]) {
    const value = positiveId(params[key]);
    if (value) clean[key] = value;
  }
  const limit = positiveId(params.limit);
  if (limit) clean.limit = Math.min(limit, 100);
  if (typeof params.q === 'string' && params.q.trim()) clean.q = params.q.trim().slice(0, 100);
  return clean;
}

/**
 * Status finalisasi & kelayakan penetapan pembimbing KP
 */
export const STATUS_FINALISASI_KP = Object.freeze({
  ALL: '',
  BELUM_SIAP: 'BELUM_SIAP',
  SIAP_DITETAPKAN: 'SIAP_DITETAPKAN',
  SUDAH_DITETAPKAN: 'SUDAH_DITETAPKAN',
});

/**
 * Status pelaksanaan bimbingan KP
 */
export const STATUS_BIMBINGAN_KP = Object.freeze({
  ALL: '',
  BELUM_DIMULAI: 'BELUM_DIMULAI',
  SUDAH_DIMULAI: 'SUDAH_DIMULAI',
});

/**
 * Pemetaan kode alasan kelayakan ke teks bahasa Indonesia yang informatif
 */
export const ALASAN_KELAYAKAN_LABEL = Object.freeze({
  ACC_ADMIN_BELUM_TERSEDIA: 'Belum mendapat persetujuan (ACC) administratif dari Admin Prodi.',
  BERKAS_BELUM_LENGKAP: 'Pemeriksaan berkas persyaratan belum lengkap (OK_LENGKAP).',
  NILAI_BELUM_LENGKAP: 'Pemeriksaan kelayakan akademik/nilai belum lengkap (OK_LENGKAP).',
  DATA_DIRI_BELUM_TERVERIFIKASI: 'Data diri mahasiswa belum diverifikasi oleh Admin Prodi.',
  PROPOSAL_TERKINI_TIDAK_TERSEDIA: 'Dokumen proposal terkini atau versi topik tidak ditemukan.',
  REVIEWER_AKTIF_BELUM_ADA: 'Belum ada dosen Reviewer aktif yang ditugaskan oleh Kaprodi.',
  REVIEW_TERKINI_BELUM_LAYAK: 'Satu atau lebih reviewer belum memberikan penilaian LAYAK pada proposal terkini.',
});

/**
 * Memvalidasi dan membersihkan parameter query untuk endpoint antrean finalisasi Kaprodi.
 * Hanya menyertakan kunci yang diizinkan oleh schema backend:
 * ['q', 'page', 'limit', 'periode', 'status_finalisasi', 'pembimbing_id', 'sort']
 *
 * @param {object} params
 * @returns {object}
 */
export function buildFinalisasiQueryParams(params = {}) {
  const clean = listParams(params, ['periode', 'pembimbing_id']);

  if (
    ['BELUM_SIAP', 'SIAP_DITETAPKAN', 'SUDAH_DITETAPKAN'].includes(params.status_finalisasi)
  ) {
    clean.status_finalisasi = params.status_finalisasi;
  }

  if (['baru', 'lama'].includes(params.sort)) {
    clean.sort = params.sort;
  }

  return clean;
}

/**
 * Format pesan error ramah pengguna untuk modul Finalisasi & Penetapan Pembimbing KP
 * @param {Error|object} error - Error objek Axios atau response
 * @param {string} [defaultMessage] - Pesan cadangan jika kode tidak dikenali
 * @returns {string}
 */
export function kaprodiFinalisasiKpErrorMessage(
  error,
  defaultMessage = 'Terjadi kesalahan pada modul finalisasi dan penetapan pembimbing KP.'
) {
  const errData = error?.response?.data?.error;
  const code = errData?.code;

  if (code === 'INVALID_SUPERVISOR') {
    return 'Dosen yang dipilih bukan kandidat Pembimbing aktif pada Program Studi ini.';
  }
  if (code === 'APPLICATION_NOT_FOUND') {
    return 'Data pengajuan KP tidak ditemukan atau bukan milik Program Studi Anda.';
  }
  if (code === 'APPLICATION_NOT_READY') {
    return 'Pengajuan belum memenuhi seluruh syarat kelayakan (berkas, nilai akademik, data diri, atau review proposal belum LAYAK).';
  }
  if (code === 'SUPERVISOR_ALREADY_ASSIGNED') {
    return 'Dosen Pembimbing aktif sudah ditetapkan pada pengajuan ini. Gunakan fitur penggantian pembimbing jika diperlukan.';
  }
  if (code === 'SUPERVISION_STARTED') {
    return 'Bimbingan sudah dimulai. Dosen pembimbing tidak dapat diganti lagi melalui menu ini.';
  }
  if (code === 'SAME_SUPERVISOR') {
    return 'Dosen pembimbing baru harus berbeda dari dosen pembimbing saat ini.';
  }
  if (code === 'STALE_PROPOSAL') {
    return 'Versi proposal pengajuan telah diperbarui. Silakan muat ulang halaman untuk data terbaru.';
  }
  if (code === 'INVALID_APPLICATIONS') {
    return 'Satu atau lebih pengajuan tidak dapat diproses karena belum memenuhi syarat kelayakan.';
  }
  if (code === 'VALIDATION_ERROR') {
    return 'Parameter atau data penetapan tidak valid. Periksa kembali pilihan Anda.';
  }
  if (code === 'PRODI_SCOPE_UNAVAILABLE') {
    return 'Cakupan Program Studi Anda tidak ditemukan atau akun dosen Anda tidak aktif.';
  }

  return apiErrorMessage(error, { fallback: defaultMessage });
}

/**
 * Mengambil daftar antrean pengajuan KP untuk monitoring kelayakan & penetapan pembimbing
 * @param {object} params
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ items: Array, pagination: object }>}
 */
export async function fetchKaprodiFinalisasiKpList(params = {}, { signal } = {}) {
  const cleanParams = buildFinalisasiQueryParams(params);
  const response = await api.get('/api/kaprodi/pengajuan-kp/finalisasi', {
    params: cleanParams,
    signal,
  });

  return (
    response.data?.data || {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, total_pages: 1 },
    }
  );
}

/**
 * Mengambil detail lengkap kelayakan dan status pengajuan KP tunggal
 * @param {number|string} id - ID pengajuan
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export async function fetchKaprodiFinalisasiKpDetail(id, { signal } = {}) {
  const response = await api.get(`/api/kaprodi/pengajuan-kp/${id}/finalisasi`, { signal });
  return response.data?.data;
}

/**
 * Mengambil daftar kandidat dosen pembimbing aktif di Program Studi
 * @param {object} params
 * @param {string} [params.q] - Pencarian nama atau kode dosen
 * @param {number} [params.pengajuan_id] - ID pengajuan (untuk cek usulan mahasiswa)
 * @param {number} [params.page=1]
 * @param {number} [params.limit=100]
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ items: Array, pagination: object }>}
 */
export async function fetchSupervisorCandidates(params = {}, { signal } = {}) {
  const cleanParams = listParams(params, ['pengajuan_id']);

  const response = await api.get('/api/kaprodi/pembimbing-kp/kandidat', {
    params: cleanParams,
    signal,
  });

  return (
    response.data?.data || {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, total_pages: 1 },
    }
  );
}

/**
 * Menetapkan Dosen Pembimbing tunggal untuk satu pengajuan KP yang sudah layak
 * @param {number|string} id - ID pengajuan
 * @param {object} payload - { dosen_id, expected_dokumen_pengajuan_id }
 * @returns {Promise<object>}
 */
export async function assignSupervisor(id, payload = {}) {
  const body = {
    dosen_id: Number(payload.dosen_id),
    expected_dokumen_pengajuan_id: Number(payload.expected_dokumen_pengajuan_id),
  };
  const response = await api.post(`/api/kaprodi/pengajuan-kp/${id}/pembimbing`, body);
  return response.data?.data;
}

/**
 * Menetapkan Dosen Pembimbing secara massal untuk beberapa pengajuan KP yang sudah layak
 * @param {Array<{ pengajuan_id: number, dosen_id: number, expected_dokumen_pengajuan_id: number }>} assignments
 * @returns {Promise<object>}
 */
export async function assignSupervisorBulk(assignments = []) {
  const cleanAssignments = assignments.map((row) => ({
    pengajuan_id: Number(row.pengajuan_id),
    dosen_id: Number(row.dosen_id),
    expected_dokumen_pengajuan_id: Number(row.expected_dokumen_pengajuan_id),
  }));

  const response = await api.post('/api/kaprodi/pembimbing-kp/bulk', {
    assignments: cleanAssignments,
    konfirmasi: true,
  });
  return response.data?.data;
}

/**
 * Mengganti Dosen Pembimbing aktif sebelum bimbingan dimulai
 * @param {number|string} id - ID pengajuan
 * @param {object} payload - { dosen_baru_id, alasan_penggantian }
 * @returns {Promise<object>}
 */
export async function replaceSupervisor(id, payload = {}) {
  const body = {
    dosen_baru_id: Number(payload.dosen_baru_id || payload.dosen_id_baru),
    alasan_penggantian: String(payload.alasan_penggantian || payload.alasan_perubahan || '').trim(),
  };
  const response = await api.post(`/api/kaprodi/pengajuan-kp/${id}/pembimbing/ganti`, body);
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

/**
 * Mengambil daftar penugasan pembimbing KP (aktif/nonaktif/histori)
 * @param {object} params
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ items: Array, pagination: object }>}
 */
export async function fetchSupervisorAssignments(params = {}, { signal } = {}) {
  const cleanParams = listParams(params, ['periode', 'dosen_id']);
  delete cleanParams.q;
  if (['AKTIF', 'NONAKTIF'].includes(params.status)) cleanParams.status = params.status;

  const response = await api.get('/api/kaprodi/pembimbing-kp/penugasan', {
    params: cleanParams,
    signal,
  });

  return (
    response.data?.data || {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, total_pages: 1 },
    }
  );
}
