import { useState } from 'react';
import {
  IconCheckCircle,
  IconClose,
  IconExclamationTriangle,
  IconSpinner,
} from '../../common/Icons.jsx';

/**
 * Dialog Konfirmasi Keputusan Administratif Pengajuan KP (ACC / TIDAK_ACC / ACC_SEMUA)
 * 
 * @param {object} props
 * @param {boolean} props.open - Status modal buka/tutup
 * @param {'ACC'|'TIDAK_ACC'|'ACC_SEMUA'} props.type - Jenis keputusan
 * @param {Function} props.onClose - Handler batal / tutup modal
 * @param {Function} props.onConfirm - Handler submit keputusan ({ type, catatan })
 * @param {boolean} [props.loading] - State proses pengiriman
 */
export default function KpAdminDecisionDialog({
  open,
  type = 'ACC',
  onClose,
  onConfirm,
  loading = false,
}) {
  const [catatan, setCatatan] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!open) return null;

  const isReject = type === 'TIDAK_ACC';
  const isApproveAll = type === 'ACC_SEMUA';

  const handleConfirmSubmit = (e) => {
    e.preventDefault();
    if (isReject && !catatan.trim()) {
      setErrorMessage('Alasan penolakan administratif wajib diisi.');
      return;
    }
    setErrorMessage('');
    onConfirm({ type, catatan: catatan.trim() || null });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        onClick={!loading ? onClose : undefined}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl transition-all">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`flex size-10 items-center justify-center rounded-xl border ${
                isReject
                  ? 'border-rose-200 bg-rose-50 text-danger'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {isReject ? (
                <IconExclamationTriangle className="size-5" />
              ) : (
                <IconCheckCircle className="size-5" />
              )}
            </span>
            <div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isReject ? 'text-danger' : 'text-emerald-700'
                }`}
              >
                {isApproveAll
                  ? 'Tindakan Satu Klik'
                  : isReject
                  ? 'Penolakan Terminal'
                  : 'Persetujuan Final'}
              </span>
              <h3 id="decision-dialog-title" className="text-base font-bold text-ink">
                {isApproveAll
                  ? 'ACC Semua Persyaratan KP'
                  : isReject
                  ? 'Tolak Pengajuan KP'
                  : 'ACC Administratif Pengajuan KP'}
              </h3>
            </div>
          </div>

          {!loading && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted hover:bg-subtle hover:text-ink focus:outline-hidden"
            >
              <IconClose className="size-4" />
            </button>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-secondary">
          {isApproveAll
            ? 'Saya telah memeriksa Berkas dan Nilai mahasiswa ini dan menyatakan persyaratan administratif KP memenuhi ketentuan.'
            : isReject
            ? 'Pengajuan ini akan ditolak secara administratif. Mahasiswa akan menerima notifikasi penolakan beserta alasan tertulis.'
            : 'Menyatakan pengajuan KP mahasiswa telah memenuhi seluruh persyaratan berkas dan akademik Program Studi.'}
        </p>

        <form onSubmit={handleConfirmSubmit} className="mt-4 space-y-4">
          {!isApproveAll && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">
                {isReject ? (
                  <span>
                    Alasan Penolakan <span className="text-danger">*</span>
                  </span>
                ) : (
                  <span>Catatan Keputusan (Opsional)</span>
                )}
              </label>
              <textarea
                rows={3}
                value={catatan}
                onChange={(e) => {
                  setCatatan(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                disabled={loading}
                placeholder={
                  isReject
                    ? 'Tuliskan alasan penolakan secara jelas dan objektif...'
                    : 'Tuliskan catatan tambahan untuk mahasiswa bila diperlukan...'
                }
                className={`w-full rounded-lg border p-2.5 text-xs text-ink placeholder:text-muted focus:outline-hidden focus:ring-1 ${
                  errorMessage
                    ? 'border-danger focus:ring-danger'
                    : 'border-line focus:border-brand focus:ring-brand'
                }`}
              />
              {errorMessage && (
                <p className="mt-1 text-[11px] font-medium text-danger">
                  {errorMessage}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-semibold text-secondary shadow-2xs hover:bg-subtle focus:outline-hidden"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs focus:outline-hidden disabled:opacity-50 ${
                isReject
                  ? 'bg-danger hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading && <IconSpinner className="size-3.5 animate-spin" />}
              {isApproveAll
                ? 'Ya, ACC Semua'
                : isReject
                ? 'Ya, Tolak Pengajuan'
                : 'Ya, Setujui (ACC)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

