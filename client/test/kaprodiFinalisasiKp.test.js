import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALASAN_KELAYAKAN_LABEL,
  STATUS_BIMBINGAN_KP,
  STATUS_FINALISASI_KP,
  buildFinalisasiQueryParams,
  kaprodiFinalisasiKpErrorMessage,
} from '../src/services/kaprodiFinalisasiKp.js';

test('buildFinalisasiQueryParams membersihkan parameter tidak valid dan menyaring sesuai allowed keys', () => {
  const input = {
    page: '3',
    limit: '25',
    q: '  Sistem Informasi Logistik  ',
    periode: '4',
    status_finalisasi: 'SIAP_DITETAPKAN',
    pembimbing_id: '12',
    sort: 'lama',
    extra_field_should_be_stripped: 'malicious or invalid key',
  };

  const output = buildFinalisasiQueryParams(input);

  assert.equal(output.page, 3);
  assert.equal(output.limit, 25);
  assert.equal(output.q, 'Sistem Informasi Logistik');
  assert.equal(output.periode, 4);
  assert.equal(output.status_finalisasi, 'SIAP_DITETAPKAN');
  assert.equal(output.pembimbing_id, 12);
  assert.equal(output.sort, 'lama');
  assert.equal(output.extra_field_should_be_stripped, undefined);
});

test('buildFinalisasiQueryParams membatasi limit maksimal 100 dan mengabaikan nilai negatif atau non-numerik', () => {
  const output = buildFinalisasiQueryParams({
    page: '-5',
    limit: '999',
    periode: 'invalid_periode',
    status_finalisasi: 'INVALID_STATUS',
    sort: 'invalid_sort',
  });

  assert.equal(output.page, undefined);
  assert.equal(output.limit, 100);
  assert.equal(output.periode, undefined);
  assert.equal(output.status_finalisasi, undefined);
  assert.equal(output.sort, undefined);
});

test('buildFinalisasiQueryParams menerima seluruh varian enum status_finalisasi yang valid', () => {
  assert.equal(
    buildFinalisasiQueryParams({ status_finalisasi: 'BELUM_SIAP' }).status_finalisasi,
    'BELUM_SIAP'
  );
  assert.equal(
    buildFinalisasiQueryParams({ status_finalisasi: 'SIAP_DITETAPKAN' }).status_finalisasi,
    'SIAP_DITETAPKAN'
  );
  assert.equal(
    buildFinalisasiQueryParams({ status_finalisasi: 'SUDAH_DITETAPKAN' }).status_finalisasi,
    'SUDAH_DITETAPKAN'
  );
});

test('kaprodiFinalisasiKpErrorMessage memetakan kode error spesifik backend ke teks informatif', () => {
  assert.equal(
    kaprodiFinalisasiKpErrorMessage({
      response: { data: { error: { code: 'INVALID_SUPERVISOR' } } },
    }),
    'Dosen yang dipilih bukan kandidat Pembimbing aktif pada Program Studi ini.'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage({
      response: { data: { error: { code: 'APPLICATION_NOT_FOUND' } } },
    }),
    'Data pengajuan KP tidak ditemukan atau bukan milik Program Studi Anda.'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage({
      response: { data: { error: { code: 'APPLICATION_NOT_READY' } } },
    }),
    'Pengajuan belum memenuhi seluruh syarat kelayakan (berkas, nilai akademik, data diri, atau review proposal belum LAYAK).'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage({
      response: { data: { error: { code: 'SUPERVISOR_ALREADY_ASSIGNED' } } },
    }),
    'Dosen Pembimbing aktif sudah ditetapkan pada pengajuan ini. Gunakan fitur penggantian pembimbing jika diperlukan.'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage({
      response: { data: { error: { code: 'SUPERVISION_STARTED' } } },
    }),
    'Bimbingan sudah dimulai. Dosen pembimbing tidak dapat diganti lagi melalui menu ini.'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage({
      response: { data: { error: { code: 'SAME_SUPERVISOR' } } },
    }),
    'Dosen pembimbing baru harus berbeda dari dosen pembimbing saat ini.'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage({
      response: { data: { error: { code: 'STALE_PROPOSAL' } } },
    }),
    'Versi proposal pengajuan telah diperbarui. Silakan muat ulang halaman untuk data terbaru.'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage({
      response: { data: { error: { code: 'INVALID_APPLICATIONS' } } },
    }),
    'Satu atau lebih pengajuan tidak dapat diproses karena belum memenuhi syarat kelayakan.'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage({
      response: { data: { error: { code: 'VALIDATION_ERROR' } } },
    }),
    'Parameter atau data penetapan tidak valid. Periksa kembali pilihan Anda.'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage({
      response: { data: { error: { code: 'PRODI_SCOPE_UNAVAILABLE' } } },
    }),
    'Cakupan Program Studi Anda tidak ditemukan atau akun dosen Anda tidak aktif.'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage({ message: 'Network Error' }),
    'Koneksi ke server gagal. Periksa jaringan Anda.'
  );

  assert.equal(
    kaprodiFinalisasiKpErrorMessage(null, 'Pesan cadangan kustom'),
    'Pesan cadangan kustom'
  );
});

test('Konstanta status dan label alasan kelayakan terdefinisi dengan benar', () => {
  assert.equal(STATUS_FINALISASI_KP.BELUM_SIAP, 'BELUM_SIAP');
  assert.equal(STATUS_FINALISASI_KP.SIAP_DITETAPKAN, 'SIAP_DITETAPKAN');
  assert.equal(STATUS_FINALISASI_KP.SUDAH_DITETAPKAN, 'SUDAH_DITETAPKAN');

  assert.equal(STATUS_BIMBINGAN_KP.BELUM_DIMULAI, 'BELUM_DIMULAI');
  assert.equal(STATUS_BIMBINGAN_KP.SUDAH_DIMULAI, 'SUDAH_DIMULAI');

  assert.ok(ALASAN_KELAYAKAN_LABEL.ACC_ADMIN_BELUM_TERSEDIA);
  assert.ok(ALASAN_KELAYAKAN_LABEL.BERKAS_BELUM_LENGKAP);
  assert.ok(ALASAN_KELAYAKAN_LABEL.NILAI_BELUM_LENGKAP);
  assert.ok(ALASAN_KELAYAKAN_LABEL.DATA_DIRI_BELUM_TERVERIFIKASI);
  assert.ok(ALASAN_KELAYAKAN_LABEL.PROPOSAL_TERKINI_TIDAK_TERSEDIA);
  assert.ok(ALASAN_KELAYAKAN_LABEL.REVIEWER_AKTIF_BELUM_ADA);
  assert.ok(ALASAN_KELAYAKAN_LABEL.REVIEW_TERKINI_BELUM_LAYAK);
});

test('query ignores booleans, fractional IDs and values beyond PostgreSQL integer range', () => {
  assert.deepEqual(buildFinalisasiQueryParams({ page: true, periode: 1.5,
    pembimbing_id: 2147483648, limit: false }), {});
});
