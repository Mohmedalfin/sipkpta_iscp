import api from './api.js';

export function dataDiriErrorMessage(error, defaultMessage = 'Terjadi kesalahan pada data diri.') {
  const backendMessage = error?.response?.data?.error?.message;
  if (backendMessage && typeof backendMessage === 'string') {
    return backendMessage;
  }
  if (error?.message && typeof error.message === 'string' && !error.response) {
    return 'Koneksi ke server gagal. Periksa jaringan Anda.';
  }
  return defaultMessage;
}

export async function fetchMyDataDiri() {
  const response = await api.get('/api/mahasiswa/me/data-diri');
  return response.data.data;
}

export async function updateMyProfile(payload) {
  const response = await api.patch('/api/mahasiswa/me/profil', payload);
  return response.data.data;
}

export async function uploadDocumentFile(kodeJenis, file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.put(`/api/mahasiswa/me/data-diri/dokumen/${encodeURIComponent(kodeJenis)}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data;
}

export async function fetchDocumentBlob(kodeJenis) {
  const response = await api.get(`/api/mahasiswa/me/data-diri/dokumen/${encodeURIComponent(kodeJenis)}/file`, {
    responseType: 'blob',
  });
  return response.data;
}


