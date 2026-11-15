import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApplicationQueryParams,
  kaprodiReviewerKpErrorMessage,
} from '../src/services/kaprodiReviewerKp.js';

test('buildApplicationQueryParams membersihkan parameter kosong dan tidak valid', () => {
  const input = {
    page: '2',
    limit: '15',
    q: '  Ahmad Dani  ',
    status_penugasan_reviewer: '',
    status_pengajuan: 'INVALID_STATUS',
    sort: 'lama',
    extraKey: 'should_be_ignored',
  };

  const output = buildApplicationQueryParams(input);

  assert.equal(output.page, 2);
  assert.equal(output.limit, 15);
  assert.equal(output.q, 'Ahmad Dani');
  assert.equal(output.sort, 'lama');
  assert.equal(output.status_penugasan_reviewer, undefined);
  assert.equal(output.status_pengajuan, undefined);
  assert.equal(output.extraKey, undefined);
});

test('buildApplicationQueryParams menerima enum penugasan reviewer yang valid', () => {
  assert.equal(
    buildApplicationQueryParams({ status_penugasan_reviewer: 'BELUM_ADA' }).status_penugasan_reviewer,
    'BELUM_ADA'
  );
  assert.equal(
    buildApplicationQueryParams({ status_penugasan_reviewer: 'SUDAH_ADA' }).status_penugasan_reviewer,
    'SUDAH_ADA'
  );
  assert.equal(
    buildApplicationQueryParams({ status_pengajuan: 'ACC' }).status_pengajuan,
    'ACC'
  );
});

test('kaprodiReviewerKpErrorMessage memetakan kode error spesifik backend', () => {
  assert.equal(
    kaprodiReviewerKpErrorMessage({ response: { data: { error: { code: 'INVALID_REVIEWER' } } } }),
    'Dosen yang dipilih bukan kandidat Reviewer aktif pada Program Studi ini.'
  );

  assert.equal(
    kaprodiReviewerKpErrorMessage({ response: { data: { error: { code: 'DUPLICATE_ASSIGNMENT' } } } }),
    'Dosen yang dipilih sudah ditugaskan sebagai Reviewer aktif pada pengajuan ini.'
  );

  assert.equal(
    kaprodiReviewerKpErrorMessage({ response: { data: { error: { code: 'APPLICATION_FINALIZED' } } } }),
    'Dosen Pembimbing sudah ditetapkan; penugasan Reviewer sudah dikunci.'
  );

  assert.equal(
    kaprodiReviewerKpErrorMessage({ response: { data: { error: { code: 'SAME_REVIEWER' } } } }),
    'Reviewer pengganti harus dosen yang berbeda dari reviewer saat ini.'
  );

  assert.equal(
    kaprodiReviewerKpErrorMessage({ response: { data: { error: { code: 'APPLICATION_NOT_FOUND' } } } }),
    'Data pengajuan KP tidak ditemukan atau bukan milik Program Studi Anda.'
  );

  assert.equal(
    kaprodiReviewerKpErrorMessage({ response: { data: { error: { code: 'INVALID_APPLICATIONS' } } } }),
    'Satu atau lebih pengajuan tidak dapat menerima penugasan reviewer.'
  );

  assert.equal(
    kaprodiReviewerKpErrorMessage({ message: 'Network Error' }),
    'Koneksi ke server gagal. Periksa jaringan Anda.'
  );

  assert.equal(
    kaprodiReviewerKpErrorMessage(null, 'Pesan default'),
    'Pesan default'
  );
});
