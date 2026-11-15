import api from './api.js';
import { apiBlobErrorMessage } from './apiError.js';

export const REVIEW_LABELS = Object.freeze({ BELUM_DIREVIEW: 'Belum direview', LAYAK: 'Layak', TIDAK_LAYAK: 'Tidak layak' });

export function reviewPayload(detail, result, note = '') {
  const trimmed = note.trim();
  if (!['LAYAK', 'TIDAK_LAYAK'].includes(result) || trimmed.length > 5000 ||
    (result === 'TIDAK_LAYAK' && !trimmed)) throw new Error('Isi catatan untuk hasil Tidak layak (maksimal 5.000 karakter).');
  return { hasil_review: result, catatan_reviewer: trimmed || null,
    expected_dokumen_pengajuan_id: detail.versi_proposal.id,
    expected_versi_topik_id: detail.versi_proposal.versi_topik_id };
}

export function bulkReviewPayload(items) {
  if (!items.length || items.length > 50 || items.some((item) => !item.eligible_layak_bulk)) {
    throw new Error('Pilih 1–50 proposal yang belum direview dan masih dapat dinilai.');
  }
  return { konfirmasi: true, items: items.map((item) => ({ pengajuan_id: item.pengajuan_id,
    expected_dokumen_pengajuan_id: item.versi_proposal.id })) };
}

export async function reviewerError(error) {
  // Kesalahan validasi lokal memakai Error biasa; pertahankan arahannya.
  if (error instanceof Error && !error.isAxiosError && !error.response) return error.message;
  return apiBlobErrorMessage(error, { fallback: 'Permintaan gagal. Coba kembali.' });
}

export async function fetchReviewerTasks(params = {}, { signal } = {}) {
  return (await api.get('/api/reviewer/pengajuan', { params, signal })).data.data;
}
export async function fetchReviewerTask(id, { signal } = {}) {
  return (await api.get(`/api/reviewer/pengajuan/${id}`, { signal })).data.data;
}
export async function fetchReviewerPdf(id, { signal } = {}) {
  return (await api.get(`/api/reviewer/pengajuan/${id}/proposal/file`, { responseType: 'blob', signal })).data;
}
export async function saveReviewerResult(id, payload) {
  return (await api.post(`/api/reviewer/pengajuan/${id}/review`, payload)).data.data;
}
export async function saveBulkReviewerResult(items) {
  return (await api.post('/api/reviewer/review/bulk-layak', bulkReviewPayload(items))).data.data;
}
export async function downloadReviewerZip(ids) {
  const body = ids ? { scope: 'SELECTED', pengajuan_ids: ids } : { scope: 'ALL_ASSIGNED' };
  return (await api.post('/api/reviewer/proposal/download-bulk', body, { responseType: 'blob' })).data;
}
export function saveReviewerBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
