import { useState } from 'react';
import {
  IconCheckCircle,
  IconDocumentSearch,
  IconExclamationCircle,
  IconSpinner,
} from '../../common/Icons.jsx';
import {
  reviewPayload,
  reviewerError,
  saveReviewerResult,
} from '../../../services/reviewerKp.js';
import ReviewStatus from './ReviewStatus.jsx';

/**
 * Formulir Keputusan Hasil Telaah Reviewer KP
 *
 * @param {object} props
 * @param {object} props.detail - Detail pengajuan KP terkini
 * @param {Function} props.onSaved - Callback setelah keputusan berhasil disimpan
 * @param {Function} props.onBusy - Callback penanda status loading ke modal induk
 */
export default function ReviewDecisionForm({ detail, onSaved, onBusy }) {
  const [result, setResult] = useState('LAYAK');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canReview =
    detail.review_saya === 'BELUM_DIREVIEW' &&
    ['DIAJUKAN', 'ACC'].includes(detail.status_pengajuan);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    if (result === 'TIDAK_LAYAK' && !note.trim()) {
      setError('Catatan arahan perbaikan wajib diisi jika proposal dinyatakan Tidak Layak.');
      return;
    }

    setError('');
    setBusy(true);
    if (onBusy) onBusy(true);

    try {
      await saveReviewerResult(detail.pengajuan_id, reviewPayload(detail, result, note));
      onSaved();
    } catch (failure) {
      const msg = await reviewerError(failure);
      setError(msg);
    } finally {
      setBusy(false);
      if (onBusy) onBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      {/* Header Keputusan */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-900/[0.08]">
        <div>
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
            Keputusan Telaah Reviewer
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            Penilaian berlaku untuk proposal versi <span className="font-semibold text-ink">v{detail.versi_proposal?.nomor_versi || 1}</span>.
          </p>
        </div>
        <ReviewStatus value={detail.review_saya} />
      </div>

      {canReview ? (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-danger"
            >
              <IconExclamationCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <fieldset disabled={busy} className="space-y-3.5">
            <legend className="text-xs font-bold text-ink block mb-2">
              Pilih Hasil Pemeriksaan <span className="text-danger">*</span>
            </legend>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Opsi Layak */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  result === 'LAYAK'
                    ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500'
                    : 'border-slate-900/10 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="hasil_review"
                  value="LAYAK"
                  checked={result === 'LAYAK'}
                  onChange={() => setResult('LAYAK')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500 size-4 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-emerald-950">Layak (Disetujui)</p>
                    <IconCheckCircle className="size-3.5 text-emerald-600" />
                  </div>
                  <p className="text-[11px] text-emerald-800/80 mt-0.5 leading-snug">
                    Proposal memenuhi kelayakan akademik dan siap untuk proses berikutnya.
                  </p>
                </div>
              </label>

              {/* Opsi Tidak Layak */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  result === 'TIDAK_LAYAK'
                    ? 'border-rose-500 bg-rose-50/70 ring-1 ring-rose-500'
                    : 'border-slate-900/10 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="hasil_review"
                  value="TIDAK_LAYAK"
                  checked={result === 'TIDAK_LAYAK'}
                  onChange={() => setResult('TIDAK_LAYAK')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500 size-4 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-rose-950">Tidak Layak (Perlu Perbaikan)</p>
                    <IconExclamationCircle className="size-3.5 text-rose-600" />
                  </div>
                  <p className="text-[11px] text-rose-800/80 mt-0.5 leading-snug">
                    Proposal memerlukan revisi. Catatan arahan wajib diisi untuk mahasiswa.
                  </p>
                </div>
              </label>
            </div>

            {/* Input Catatan Reviewer */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="review-note" className="text-xs font-bold text-ink">
                  Catatan Reviewer{' '}
                  {result === 'TIDAK_LAYAK' ? (
                    <span className="text-rose-600 font-semibold">(Wajib Diisi)</span>
                  ) : (
                    <span className="text-muted font-normal">(Opsional)</span>
                  )}
                </label>
                <span className="text-[11px] font-mono text-muted">
                  {note.length} / 5.000
                </span>
              </div>
              <textarea
                id="review-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                required={result === 'TIDAK_LAYAK'}
                maxLength={5000}
                rows={4}
                className="w-full rounded-xl border border-slate-900/[0.12] bg-white p-3 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
                placeholder={
                  result === 'TIDAK_LAYAK'
                    ? 'Tuliskan poin-poin yang perlu diperbaiki (latar belakang, metode, batasan sistem, dll)...'
                    : 'Tuliskan masukan atau arahan penyempurnaan (jika ada)...'
                }
              />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={busy || (result === 'TIDAK_LAYAK' && !note.trim())}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-2.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <IconSpinner className="size-4 animate-spin text-white" />
            ) : (
              <IconDocumentSearch className="size-4" />
            )}
            <span>{busy ? 'Menyimpan Hasil Review…' : 'Simpan Hasil Review'}</span>
          </button>
        </form>
      ) : (
        /* Status Terkunci / Sudah Direview */
        <div className="p-3.5 rounded-xl border border-slate-900/[0.08] bg-white space-y-1 shadow-2xs">
          <p className="text-xs font-bold text-ink">Keputusan Versi Ini Telah Final</p>
          <p className="text-[11px] text-muted leading-relaxed">
            {detail.review_saya !== 'BELUM_DIREVIEW'
              ? `Anda telah menyimpan hasil telaah untuk proposal versi ini. Penilaian putaran berikutnya dapat dilakukan setelah mahasiswa mengunggah versi proposal baru.`
              : 'Status pengajuan saat ini tidak mengizinkan pengisian telaah review.'}
          </p>
        </div>
      )}
    </section>
  );
}
