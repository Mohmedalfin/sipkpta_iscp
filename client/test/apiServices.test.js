import assert from 'node:assert/strict';
import test from 'node:test';
import api from '../src/services/api.js';
import { apiBlobErrorMessage, apiErrorMessage } from '../src/services/apiError.js';
import { fetchMahasiswaList, mahasiswaErrorMessage } from '../src/services/masterMahasiswa.js';
import { fetchDosenList } from '../src/services/masterDosen.js';
import { fetchAdminDataDiriList } from '../src/services/adminDataDiri.js';
import { listSettings } from '../src/services/academicSettings.js';
import { fetchReviewerTasks, fetchReviewerTask, fetchReviewerPdf, reviewerError } from '../src/services/reviewerKp.js';

test('service daftar mempertahankan items, pagination, summary dan memisahkan signal dari query', async (t) => {
  const adapter = api.defaults.adapter;
  const storage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => null, removeItem() {} };
  t.after(() => { api.defaults.adapter = adapter; globalThis.sessionStorage = storage; });
  const items = [{ id: 1 }];
  const pagination = { page: 2, limit: 15, total_items: 32, total_pages: 3 };
  const summary = { total: 32, aktif: 30 };
  const controller = new AbortController();
  let requests = 0;
  api.defaults.adapter = async (config) => {
    requests++;
    assert.equal(config.signal, controller.signal);
    assert.equal(config.params.signal, undefined);
    assert.equal(config.params.search, 'Budi');
    return { config, status: 200, headers: {}, data: { success: true, data: items, meta: { pagination, summary } } };
  };
  for (const fetchList of [fetchMahasiswaList, fetchDosenList, fetchAdminDataDiriList]) {
    assert.deepEqual(await fetchList({ page: 2, limit: 15, search: ' Budi ' }, { signal: controller.signal }),
      { items, pagination, summary });
  }
  controller.abort();
  await assert.rejects(fetchMahasiswaList({}, { signal: controller.signal }), { code: 'ERR_CANCELED' });
  assert.equal(requests, 3);
});

test('service reviewer dan konfigurasi meneruskan options serta menjaga respons JSON dan Blob', async (t) => {
  const adapter = api.defaults.adapter;
  const storage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => null, removeItem() {} };
  t.after(() => { api.defaults.adapter = adapter; globalThis.sessionStorage = storage; });
  const controller = new AbortController();
  const payload = { items: [], pagination: { total: 0 }, jumlah_eligible_bulk: 0 };
  const blob = new Blob(['PDF'], { type: 'application/pdf' });
  api.defaults.adapter = async (config) => {
    assert.equal(config.signal, controller.signal);
    return { config, status: 200, headers: {}, data: config.responseType === 'blob' ? blob : { data: payload } };
  };
  const options = { signal: controller.signal };
  assert.deepEqual(await fetchReviewerTasks({}, options), payload);
  assert.deepEqual(await fetchReviewerTask(1, options), payload);
  assert.deepEqual(await listSettings('periods', {}, options), payload);
  assert.equal(await fetchReviewerPdf(1, options), blob);
});

test('error umum mempertahankan pesan backend dan timeout impor tanpa menampilkan pesan teknis Axios', async () => {
  const backend = { response: { data: { error: { message: 'Versi proposal berubah.' } } } };
  assert.equal(apiErrorMessage(backend), 'Versi proposal berubah.');
  assert.equal(mahasiswaErrorMessage({ code: 'ECONNABORTED' }),
    'Proses terlalu lama. Periksa kembali hasil impor sebelum mencoba ulang.');
  assert.equal(apiErrorMessage({ message: 'Network Error' }), 'Koneksi ke server gagal. Periksa jaringan Anda.');
  assert.equal(apiErrorMessage({}, { fallback: 'Gagal memuat.' }), 'Gagal memuat.');
  assert.equal(await reviewerError(new Error('Isi catatan.')), 'Isi catatan.');
  assert.equal(await reviewerError({ isAxiosError: true, message: 'Network Error' }),
    'Koneksi ke server gagal. Periksa jaringan Anda.');
  assert.equal(await apiBlobErrorMessage({ response: { data: new Blob([JSON.stringify(backend.response.data)]) } }),
    'Versi proposal berubah.');
  assert.equal(await apiBlobErrorMessage({ response: { data: new Blob(['<html>error</html>']) } }, { fallback: 'Gagal unduh.' }), 'Gagal unduh.');
});
