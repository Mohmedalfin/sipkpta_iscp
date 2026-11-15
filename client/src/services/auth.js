import api from './api.js';

export async function login(credentials) {
  const { data } = await api.post('/api/auth/login', credentials);
  return data.data;
}

export async function selectActiveRole(role) {
  const { data } = await api.post('/api/auth/active-role', { role });
  return data.data;
}

export async function getCurrentUser() {
  const { data } = await api.get('/api/auth/me');
  return data.data.user;
}

export async function logout() {
  await api.post('/api/auth/logout');
}

export function authErrorMessage(error, fallback = 'Permintaan tidak dapat diproses.') {
  if (!error.response) return 'Server belum dapat dihubungi. Periksa koneksi lalu coba lagi.';
  if (error.response.status === 429) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  return error.response.data?.error?.message || fallback;
}
