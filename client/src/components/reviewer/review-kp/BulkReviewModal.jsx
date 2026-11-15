import { useState } from 'react';
import {
  IconCheckCircle,
  IconClose,
  IconExclamationCircle,
  IconExclamationTriangle,
  IconInformationCircle,
  IconSpinner,
} from '../../common/Icons.jsx';
import {
  reviewerError,
  saveBulkReviewerResult,
} from '../../../services/reviewerKp.js';
import { useToast } from '../../../context/ToastContext.jsx';

/**
 * Ekstraksi inisial nama
 */
function getInitials(name) {
  if (!name) return 'M';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Modal Konfirmasi Penilaian Layak Massal (Bulk Layak) oleh Reviewer
 *
 * @param {object} props
 * @param {boolean} props.open - State modal terbuka
 * @param {Function} props.onClose - Handler saat modal ditutup
 * @param {Array} props.selected - Daftar item proposal terpilih
 * @param {Function} props.onSuccess - Callback saat aksi massal berhasil
 */
export default function BulkReviewModal({
  open = false,
  onClose,
  selected = [],
  onSuccess,
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  if (!open) return null;

  const hasIneligible = selected.some((item) => !item.eligible_layak_bulk);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !selected.length || hasIneligible || !agreed) return;

    setSubmitting(true);
    setError('');

    try {
      await saveBulkReviewerResult(selected);
      toast.success(
        `Berhasil menyimpan hasil Layak untuk ${selected.length} proposal pilihan.`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const message = await reviewerError(err);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-bulk-review-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-[22px] border border-slate-900/10 bg-white shadow-2xl overflow-hidden">
        {/* Header Modal (Clean, tanpa icon berlebih) */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.08] px-5 sm:px-6 py-4 bg-white shrink-0">
          <div>
            <h2
              id="modal-bulk-review-title"
              className="text-base font-bold text-ink leading-tight"
            >
              Konfirmasi Layak Massal
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Menyatakan {selected.length} proposal terpilih sebagai Layak secara bersamaan.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="size-8 rounded-full border border-slate-900/10 hover:bg-slate-100 flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Tutup modal"
          >
            <IconClose className="size-4" />
          </button>
        </div>

        {/* Form: Scrollable Content & Fixed Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable] p-5 sm:p-6 space-y-4 bg-slate-50/40">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-danger"
              >
                <IconExclamationCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            {hasIneligible && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900"
              >
                <IconExclamationTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  Beberapa proposal yang dipilih sudah pernah dinilai atau tidak dapat dinilai massal.
                  Hanya proposal berstatus <strong>Belum Direview</strong> yang memenuhi syarat penilaian massal.
                </div>
              </div>
            )}

            {/* 1. Ringkasan Proposal Terpilih */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider">
                  Proposal Terpilih
                </label>
                <span className="text-[11px] font-mono font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                  {selected.length} Proposal
                </span>
              </div>

              <div className="rounded-xl border border-slate-900/[0.08] bg-white shadow-2xs overflow-hidden">
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-900/[0.05] [scrollbar-gutter:stable]">
                  {selected.map((item) => (
                    <div
                      key={item.pengajuan_id}
                      className="p-2.5 sm:p-3 flex items-center gap-2.5 hover:bg-slate-50/60 transition-colors text-xs"
                    >
                      <div className="size-7 sm:size-8 rounded-full bg-slate-100 border border-slate-900/10 flex items-center justify-center font-bold text-[11px] text-slate-700 shrink-0">
                        {getInitials(item.mahasiswa?.nama_lengkap)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-ink truncate leading-tight">
                            {item.mahasiswa?.nama_lengkap}
                          </p>
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded font-mono font-semibold text-[10px] bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            v{item.versi_proposal?.nomor_versi || 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted truncate mt-0.5">
                          <span className="font-mono text-secondary">{item.mahasiswa?.nim || '-'}</span> • {item.judul || 'Judul belum diisi'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Callout Informasi */}
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 flex items-start gap-2.5 text-xs text-blue-900">
              <IconInformationCircle className="size-4 text-brand shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed text-secondary text-[11px]">
                <p>
                  Seluruh proposal yang dipilih akan disimpan dengan hasil <strong>Layak</strong> pada versi dokumen terkininya.
                </p>
                <p className="text-muted">
                  *Penilaian ini atomik: semua proposal pilihan akan dinilai sekaligus atau dibatalkan seluruhnya jika terjadi ketidaksesuaian versi.
                </p>
              </div>
            </div>

            {/* 3. Checkbox Persetujuan Pernyataan */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-900/10 bg-white hover:bg-slate-50/70 transition-colors cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={submitting || hasIneligible}
                className="mt-0.5 rounded border-slate-900/20 text-brand focus:ring-brand/30 size-4 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-secondary leading-snug">
                Saya menyatakan telah memeriksa substansi dan kelayakan akademik dari seluruh{' '}
                <strong className="text-ink">{selected.length}</strong> proposal yang dipilih.
              </span>
            </label>
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-slate-900/[0.08] bg-white shrink-0">
            <p className="text-xs text-muted">
              Target: <strong className="text-ink font-mono font-semibold">{selected.length}</strong> proposal
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl border border-slate-900/10 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || hasIneligible || !agreed || !selected.length}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                {submitting ? (
                  <IconSpinner className="size-3.5 animate-spin text-white" />
                ) : (
                  <IconCheckCircle className="size-3.5" />
                )}
                <span>Simpan Layak Semua</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
