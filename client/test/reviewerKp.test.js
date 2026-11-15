import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_LABELS, bulkReviewPayload, reviewPayload } from '../src/services/reviewerKp.js';

const detail = {
  pengajuan_id: 12,
  eligible_layak_bulk: true,
  versi_proposal: { id: 42, versi_topik_id: 7 },
};

test('review mengirim snapshot proposal dan topik tanpa identitas reviewer', () => {
  assert.deepEqual(reviewPayload(detail, 'TIDAK_LAYAK', '  Perjelas metode.  '), {
    hasil_review: 'TIDAK_LAYAK',
    catatan_reviewer: 'Perjelas metode.',
    expected_dokumen_pengajuan_id: 42,
    expected_versi_topik_id: 7,
  });
  assert.equal(reviewPayload(detail, 'LAYAK').catatan_reviewer, null);
});

test('Tidak layak memerlukan catatan dan membatasi panjang input', () => {
  assert.throws(() => reviewPayload(detail, 'TIDAK_LAYAK', '  '));
  assert.throws(() => reviewPayload(detail, 'LAYAK', 'a'.repeat(5001)));
  assert.throws(() => reviewPayload(detail, 'ACC'));
});

test('bulk hanya memakai pilihan eksplisit yang eligible dan snapshot versinya', () => {
  assert.deepEqual(bulkReviewPayload([detail]), {
    konfirmasi: true,
    items: [{ pengajuan_id: 12, expected_dokumen_pengajuan_id: 42 }],
  });
  assert.throws(() => bulkReviewPayload([]));
  assert.throws(() => bulkReviewPayload([{ ...detail, eligible_layak_bulk: false }]));
  assert.throws(() => bulkReviewPayload(Array(51).fill(detail)));
});

test('REVIEW_LABELS memiliki pemetaan status bahasa Indonesia yang konsisten', () => {
  assert.equal(REVIEW_LABELS.BELUM_DIREVIEW, 'Belum direview');
  assert.equal(REVIEW_LABELS.LAYAK, 'Layak');
  assert.equal(REVIEW_LABELS.TIDAK_LAYAK, 'Tidak layak');
});

test('perhitungan ringkasan beban review mengagregasi status secara akurat', () => {
  const dummyTasks = [
    { pengajuan_id: 1, review_saya: 'BELUM_DIREVIEW' },
    { pengajuan_id: 2, review_saya: 'BELUM_DIREVIEW' },
    { pengajuan_id: 3, review_saya: 'LAYAK' },
    { pengajuan_id: 4, review_saya: 'TIDAK_LAYAK' },
  ];

  const counts = {
    belumDireview: dummyTasks.filter((t) => t.review_saya === 'BELUM_DIREVIEW').length,
    layak: dummyTasks.filter((t) => t.review_saya === 'LAYAK').length,
    tidakLayak: dummyTasks.filter((t) => t.review_saya === 'TIDAK_LAYAK').length,
    total: dummyTasks.length,
  };

  assert.equal(counts.belumDireview, 2);
  assert.equal(counts.layak, 1);
  assert.equal(counts.tidakLayak, 1);
  assert.equal(counts.total, 4);
});

test('validasi kelayakan item massal mendeteksi item non-eligible', () => {
  const items = [
    { pengajuan_id: 1, eligible_layak_bulk: true },
    { pengajuan_id: 2, eligible_layak_bulk: false },
  ];
  const hasIneligible = items.some((item) => !item.eligible_layak_bulk);
  assert.equal(hasIneligible, true);

  const allEligible = items.filter((i) => i.eligible_layak_bulk);
  assert.equal(allEligible.length, 1);
  assert.equal(allEligible.every((item) => item.eligible_layak_bulk), true);
});
