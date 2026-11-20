import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleFinalisasiPage, toggleFinalisasiSelection } from '../src/utils/finalisasiSelection.js';
import { assignSupervisorBulk } from '../src/services/kaprodiFinalisasiKp.js';
import api from '../src/services/api.js';

const ready = (id) => ({ id, is_eligible: true, status_finalisasi: 'SIAP_DITETAPKAN',
  proposal_terkini: { id: id + 100 } });

test('bulk selection retains all proposal snapshots when changing page or list refreshes', () => {
  const first = ready(1);
  const second = ready(2);
  let selected = toggleFinalisasiSelection([], first);
  selected = toggleFinalisasiPage(selected, [second]);
  assert.deepEqual(selected.map((item) => item.id), [1, 2]);
  // Old modal logic received currentPage only and rejected this valid selection.
  assert.equal([second].filter((item) => selected.some((row) => row.id === item.id)).length, 1);
  assert.equal(selected.length, 2);
  assert.equal(selected[0].proposal_terkini.id, 101);
  selected = toggleFinalisasiPage(selected, [second]);
  assert.deepEqual(selected.map((item) => item.id), [1]);
  assert.deepEqual(toggleFinalisasiSelection(selected, { ...second, is_eligible: false }), selected);
  assert.deepEqual(toggleFinalisasiSelection(selected, undefined), selected);
});

test('bulk service sends every selected application and its proposal snapshot using the server contract', async (t) => {
  const previous = api.defaults.adapter;
  const storage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => null, removeItem() {} };
  t.after(() => { api.defaults.adapter = previous; globalThis.sessionStorage = storage; });
  let payload;
  api.defaults.adapter = async (config) => {
    assert.equal(config.method, 'post');
    assert.equal(config.url, '/api/kaprodi/pembimbing-kp/bulk');
    payload = JSON.parse(config.data);
    return { status: 200, statusText: 'OK', headers: {}, config,
      data: { success: true, data: { created: 2, already_assigned: 0 } } };
  };
  const selected = toggleFinalisasiPage([ready(1)], [ready(2)]);
  const result = await assignSupervisorBulk(selected.map((item) => ({
    pengajuan_id: item.id, dosen_id: 5, expected_dokumen_pengajuan_id: item.proposal_terkini.id,
  })));
  assert.equal(result.created, 2);
  assert.equal(payload.konfirmasi, true);
  assert.deepEqual(payload.assignments, [
    { pengajuan_id: 1, dosen_id: 5, expected_dokumen_pengajuan_id: 101 },
    { pengajuan_id: 2, dosen_id: 5, expected_dokumen_pengajuan_id: 102 },
  ]);
});
