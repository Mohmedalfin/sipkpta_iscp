import api from './api.js';

const root = '/api/admin-prodi/konfigurasi';
const resources = Object.freeze({
  periods: 'periode-akademik',
  schedules: 'jadwal-proses',
  curriculum: 'kurikulum',
  stages: 'tahap-akademik',
  documents: 'jenis-dokumen',
  requirements: 'persyaratan-pengajuan',
});

function path(resource, id) {
  const name = resources[resource];
  if (!name) throw new Error('Sumber konfigurasi tidak dikenal.');
  return `${root}/${name}${id === undefined ? '' : `/${encodeURIComponent(id)}`}`;
}

export async function listSettings(resource, params = {}) {
  const { data } = await api.get(path(resource), { params });
  return data.data;
}

export async function getSetting(resource, id) {
  const { data } = await api.get(path(resource, id));
  return data.data;
}

export async function createSetting(resource, payload) {
  const { data } = await api.post(path(resource), payload);
  return data.data;
}

export async function updateSetting(resource, id, payload) {
  const { data } = await api.patch(path(resource, id), payload);
  return data.data;
}

export async function toggleSetting(resource, id, active) {
  const { data } = await api.post(`${path(resource, id)}/${active ? 'aktivasi' : 'nonaktivasi'}`);
  return data.data;
}

export async function getAvailability(tahap, jenis_proses) {
  const { data } = await api.get('/api/konfigurasi/akademik/ketersediaan', {
    params: { tahap, jenis_proses },
  });
  return data.data;
}

export function settingsError(error) {
  return error?.response?.data?.error?.message ||
    (error?.response?.status === 409 ? 'Konfigurasi bertentangan dengan data yang sudah ada.' :
      'Permintaan belum dapat diproses. Periksa koneksi dan coba lagi.');
}
