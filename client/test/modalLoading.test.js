import test from 'node:test';
import assert from 'node:assert/strict';
import api from '../src/services/api.js';
import { fetchMahasiswaDetail } from '../src/services/masterMahasiswa.js';
import { fetchDosenDetail } from '../src/services/masterDosen.js';
import { fetchAdminDataDiriDetail, fetchAdminDataDiriDocumentFile } from '../src/services/adminDataDiri.js';
import { fetchReviewerCandidates } from '../src/services/kaprodiReviewerKp.js';
import { downloadAdminKpDocumentFile } from '../src/services/adminPengajuanKp.js';

test('modal reads cancel underlying API work instead of merely ignoring late responses', async (t) => {
  const originalAdapter = api.defaults.adapter;
  const storage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => null, removeItem() {} };
  t.after(() => { api.defaults.adapter = originalAdapter; globalThis.sessionStorage = storage; });
  const operations = [
    (signal) => fetchMahasiswaDetail(1, { signal }),
    (signal) => fetchDosenDetail(1, { signal }),
    (signal) => fetchAdminDataDiriDetail(1, { signal }),
    (signal) => fetchAdminDataDiriDocumentFile(1, 'KTM', { signal }),
    (signal) => fetchReviewerCandidates({ limit: 100 }, { signal }),
    (signal) => downloadAdminKpDocumentFile(1, 2, { signal }),
  ];
  for (const operation of operations) {
    const controller = new AbortController();
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    let cancelled = false;
    api.defaults.adapter = (config) => {
      assert.equal(config.signal, controller.signal);
      return new Promise((_resolve, reject) => {
        config.signal.addEventListener('abort', () => { cancelled = true; reject(new Error('cancelled')); }, { once: true });
        started();
      });
    };
    const pending = operation(controller.signal);
    const rejected = assert.rejects(pending, { code: 'ERR_CANCELED' });
    await ready;
    controller.abort();
    await rejected;
    assert.equal(cancelled, true);
  }
});

