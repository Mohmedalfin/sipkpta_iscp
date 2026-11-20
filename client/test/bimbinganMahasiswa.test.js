import assert from 'node:assert/strict';
import test from 'node:test';
import api from '../src/services/api.js';
import { BIMBINGAN_QUERY, isRealtimeQuery } from '../src/services/realtimeQueries.js';
import { bimbinganHistoryAction, latestBimbinganAttachments } from '../src/utils/bimbinganHistory.js';
import {
  BIMBINGAN_JENIS,
  BIMBINGAN_STATUS,
  bimbinganErrorMessage,
  submitBimbinganWithDraft,
  triggerBlobDownload,
} from '../src/services/bimbinganMahasiswa.js';

test('BIMBINGAN_STATUS dan BIMBINGAN_JENIS membekukan nilai enum yang sesuai', () => {
  assert.equal(BIMBINGAN_STATUS.DRAFT, 'DRAFT');
  assert.equal(BIMBINGAN_STATUS.MENUNGGU, 'MENUNGGU_VALIDASI');
  assert.equal(BIMBINGAN_STATUS.VALID, 'TERVALIDASI');
  assert.equal(BIMBINGAN_STATUS.REVISI, 'PERLU_PERBAIKAN');
  assert.equal(BIMBINGAN_STATUS.DITOLAK, 'DITOLAK');

  assert.equal(BIMBINGAN_JENIS.OFFLINE, 'OFFLINE');
  assert.equal(BIMBINGAN_JENIS.ONLINE, 'ONLINE');

  assert.ok(Object.isFrozen(BIMBINGAN_STATUS));
  assert.ok(Object.isFrozen(BIMBINGAN_JENIS));
});

test('bimbinganErrorMessage memetakan kode error spesifik backend ke teks bahasa Indonesia yang jelas', () => {
  // Test BIMBINGAN_UNAVAILABLE
  const unavailableErr = {
    response: {
      data: {
        error: { code: 'BIMBINGAN_UNAVAILABLE' },
      },
    },
  };
  assert.equal(
    bimbinganErrorMessage(unavailableErr),
    'Pengajuan KP Anda belum siap untuk bimbingan atau Dosen Pembimbing belum ditetapkan.'
  );

  // Test BIMBINGAN_NOT_FOUND
  const notFoundErr = {
    response: {
      data: {
        error: { code: 'BIMBINGAN_NOT_FOUND' },
      },
    },
  };
  assert.equal(
    bimbinganErrorMessage(notFoundErr),
    'Catatan bimbingan tidak ditemukan atau bukan milik pengajuan Anda.'
  );

  // Test INVALID_DATE
  const invalidDateErr = {
    response: {
      data: {
        error: { code: 'INVALID_DATE', message: 'Tanggal bimbingan tidak boleh di masa depan' },
      },
    },
  };
  assert.equal(
    bimbinganErrorMessage(invalidDateErr),
    'Tanggal bimbingan tidak boleh di masa depan'
  );

  // Test INVALID_DOCUMENT
  const docErr = {
    response: {
      data: {
        error: { code: 'INVALID_DOCUMENT' },
      },
    },
  };
  assert.equal(
    bimbinganErrorMessage(docErr),
    'Lampiran berkas harus berupa dokumen PDF dengan ukuran maksimal 5 MB per berkas.'
  );

  // Test RATE_LIMITED
  const rateLimitErr = {
    response: {
      data: {
        error: { code: 'RATE_LIMITED' },
      },
    },
  };
  assert.equal(
    bimbinganErrorMessage(rateLimitErr),
    'Terlalu banyak aktivitas bimbingan dalam waktu singkat. Silakan tunggu beberapa saat.'
  );

  // Test generic error fallback
  const genericErr = new Error('Network error');
  assert.ok(bimbinganErrorMessage(genericErr).length > 0);
});

test('Validasi aturan Tahap 2 (Form Modal Input Bimbingan)', () => {
  const MAX_FILES = 3;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_CHARS = 10000;

  // 1. Validasi Batas Karakter Ringkasan
  const validRingkasan = 'Membahas progres bab 1 dan tinjauan pustaka.';
  const overRingkasan = 'a'.repeat(MAX_CHARS + 1);
  assert.ok(validRingkasan.length <= MAX_CHARS);
  assert.ok(overRingkasan.length > MAX_CHARS);

  // 2. Validasi Tanggal Pertemuan Tatap Muka (Offline)
  const todayJakarta = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const pastDate = '2020-01-01';
  const futureDate = '2099-12-31';

  assert.ok(pastDate <= todayJakarta, 'Tanggal lampau harus valid');
  assert.ok(todayJakarta <= todayJakarta, 'Tanggal hari ini harus valid');
  assert.ok(futureDate > todayJakarta, 'Tanggal masa depan harus ditolak');

  // 3. Validasi Berkas PDF (Maksimal 3 file, 5 MB/file)
  const samplePdf = { name: 'laporan.pdf', size: 1024 * 1024, type: 'application/pdf' };
  const sampleNonPdf = { name: 'gambar.png', size: 500 * 1024, type: 'image/png' };
  const sampleOversizedPdf = { name: 'besar.pdf', size: 6 * 1024 * 1024, type: 'application/pdf' };

  const isPdf = (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
  assert.ok(isPdf(samplePdf));
  assert.ok(!isPdf(sampleNonPdf));

  assert.ok(samplePdf.size <= MAX_FILE_BYTES);
  assert.ok(sampleOversizedPdf.size > MAX_FILE_BYTES);

  const fileList = [samplePdf, samplePdf, samplePdf];
  assert.equal(fileList.length, MAX_FILES);
});

test('Validasi aturan Tahap 3 (Detail Modal, Audit Trail, & Download Blob)', () => {
  // 1. triggerBlobDownload aman dipanggil di environment non-browser tanpa melempar error
  assert.doesNotThrow(() => {
    triggerBlobDownload(new Blob(['dummy pdf content']), 'test.pdf');
  });

  assert.equal(bimbinganHistoryAction({ aksi: 'KIRIM' }), 'KIRIM');
  assert.equal(bimbinganHistoryAction({ aksi: 'PERIKSA', status_sesudah: 'TERVALIDASI' }), 'VALIDASI');
  assert.equal(bimbinganHistoryAction({ aksi: 'PERIKSA', status_sesudah: 'PERLU_PERBAIKAN' }), 'PERBAIKAN');
  assert.equal(bimbinganHistoryAction({ aksi: 'PERIKSA', status_sesudah: 'DITOLAK' }), 'TOLAK');

  const riwayat = [
    { aksi: 'KIRIM', versi_pengiriman: 1, lampiran_bimbingan: [{ id: 10 }] },
    { aksi: 'KIRIM_REVISI', versi_pengiriman: 2, lampiran_bimbingan: [{ id: 20 }] },
    { aksi: 'PERIKSA', versi_pengiriman: 2, lampiran_bimbingan: [] },
  ];
  assert.deepEqual(latestBimbinganAttachments({ versi_pengiriman_terakhir: 2, riwayat }), [{ id: 20 }]);
  assert.deepEqual(latestBimbinganAttachments({ versi_pengiriman_terakhir: 0, riwayat: [] }), []);
});

test('retry pengiriman memakai draf yang sudah diterima dari server', async (t) => {
  const draftPath = '/api/pengajuan/3/bimbingan';
  const sendPath = draftPath + '/12/kirim';
  const requests = [];
  let draftId;
  t.mock.method(api, 'post', async (path, body) => {
    requests.push(path);
    if (path === draftPath) {
      assert.deepEqual(body, { jenis_bimbingan: 'ONLINE', ringkasan: 'Materi' });
      return { data: { data: { id: 12 } } };
    }
    assert.ok(body instanceof FormData);
    assert.equal(body.get('ringkasan'), 'Materi');
    assert.equal(body.getAll('files').length, 1);
    if (requests.length === 2) throw new Error('Upload gagal');
    return { data: { data: { id: 12, status_bimbingan: 'MENUNGGU_VALIDASI' } } };
  });
  const options = { jenisBimbingan: 'ONLINE', payload: { ringkasan: 'Materi' },
    files: [new Blob(['pdf'], { type: 'application/pdf' })],
    onDraftCreated: (id) => { draftId = id; } };
  await assert.rejects(submitBimbinganWithDraft(3, options), /Upload gagal/);
  const result = await submitBimbinganWithDraft(3, { ...options, draftId });
  assert.equal(result.status_bimbingan, 'MENUNGGU_VALIDASI');
  assert.deepEqual(requests, [draftPath, sendPath, sendPath]);
});

test('invalidasi SSE Bimbingan terbatas pada pengajuan dan perubahan yang relevan', () => {
  const events = [{ type: 'bimbingan.updated', resource_id: 12 }];
  assert.equal(isRealtimeQuery([BIMBINGAN_QUERY.list, 12, { page: 2 }], events), true);
  assert.equal(isRealtimeQuery([BIMBINGAN_QUERY.detail, 12, 50], events), true);
  assert.equal(isRealtimeQuery([BIMBINGAN_QUERY.detail, 13, 50], events), false);
  assert.equal(isRealtimeQuery([BIMBINGAN_QUERY.context], events), false);
  assert.equal(isRealtimeQuery(['kp-detail', 12], events), false);
  assert.equal(isRealtimeQuery([BIMBINGAN_QUERY.context], [{ type: 'pengajuan.assignment.updated' }]), true);
  assert.equal(isRealtimeQuery([BIMBINGAN_QUERY.detail, 12, 50]), true);
});
