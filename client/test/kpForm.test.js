import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKpFormPayload, selectKpApplication, validateKpDraftNumbers } from '../src/utils/kpForm.js';

test('periode baru tidak tertutup oleh pengajuan semester lama', () => {
  const previous = { id: 9, periode_akademik: { id: 1 } };
  const current = { id: 10, periode_akademik: { id: 2 } };
  assert.equal(selectKpApplication([previous], 2).selected, null);
  assert.equal(selectKpApplication([current, previous], 2).selected, current);
  assert.equal(selectKpApplication([current, previous], 2, 9).selected, previous);
  assert.equal(selectKpApplication([current, previous], null).selected, current);
});

test('deklarasi belum dijawab tetap null pada draf', () => {
  const payload = buildKpFormPayload({ tema_penelitian_id: 1, judul_penelitian: 'Judul',
    objek_penelitian: '', lokasi_penelitian: '', usulan_pembimbing_id: '',
    ipk_saat_pengajuan: '', jumlah_sks_saat_pengajuan: '',
    memiliki_nilai_de: null, daftar_mk_nilai_de: '', sudah_bayar_spp_variabel: null });
  assert.equal(payload.memiliki_nilai_de, null);
  assert.equal(payload.sudah_bayar_spp_variabel, null);
  assert.equal(payload.ipk_saat_pengajuan, null);
  assert.equal(payload.jumlah_sks_saat_pengajuan, null);
});

test('angka tidak dipotong diam-diam sebelum dikirim', () => {
  assert.equal(buildKpFormPayload({ tema_penelitian_id: 1,
    jumlah_sks_saat_pengajuan: '12.5' }).jumlah_sks_saat_pengajuan, 12.5);
  assert.ok(validateKpDraftNumbers({ ipk_saat_pengajuan: '3e2',
    jumlah_sks_saat_pengajuan: '12.5' }).ipk_saat_pengajuan);
  assert.ok(validateKpDraftNumbers({ ipk_saat_pengajuan: '3e2',
    jumlah_sks_saat_pengajuan: '12.5' }).jumlah_sks_saat_pengajuan);
});
