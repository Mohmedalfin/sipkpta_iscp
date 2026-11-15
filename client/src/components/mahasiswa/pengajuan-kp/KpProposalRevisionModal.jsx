import { useRef, useState } from 'react';
import {
  IconArrowUpTray,
  IconClose,
  IconDocumentText,
  IconExclamationCircle,
  IconInformationCircle,
  IconSpinner,
} from '../../common/Icons.jsx';
import {
  pengajuanKpErrorMessage,
  uploadKpRevisedProposal,
  validateKpDocumentFile,
} from '../../../services/pengajuanKp.js';
import { useToast } from '../../../context/ToastContext.jsx';

/**
 * Modal Unggah Revisi Proposal Kerja Praktik (KP)
 * Digunakan saat status pengajuan mahasiswa adalah PERLU_REVISI
 * 
 * @param {object} props
 * @param {boolean} props.isOpen - Status buka/tutup modal
 * @param {Function} props.onClose - Handler menutup modal
 * @param {number|string} props.pengajuanId - ID Pengajuan aktif
 * @param {Function} props.onSuccess - Callback setelah revisi berhasil dikirim
 */
export default function KpProposalRevisionModal({
  isOpen,
  onClose,
  pengajuanId,
  expectedDocId = null,
  onSuccess,
}) {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    const validation = validateKpDocumentFile(file, 10);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Silakan pilih berkas PDF proposal perbaikan terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // 1. Unggah berkas proposal revisi
      await uploadKpRevisedProposal(pengajuanId, selectedFile, expectedDocId, revisionNote);

      // 2. Beri notifikasi keberhasilan
      toast.success('Naskah revisi proposal KP berhasil diunggah!');

      // Reset form & tutup modal
      setSelectedFile(null);
      setRevisionNote('');
      if (typeof onSuccess === 'function') {
        await onSuccess();
      }
      onClose();
    } catch (err) {
      const msg = pengajuanKpErrorMessage(
        err,
        'Gagal mengirimkan naskah revisi proposal. Silakan coba kembali.'
      );
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revision-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
    >
      {/* Backdrop */}
      <div
        onClick={!isSubmitting ? onClose : undefined}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <IconDocumentText className="size-5" />
            </div>
            <div>
              <h3 id="revision-modal-title" className="text-base font-bold text-ink">
                Unggah Revisi Proposal KP
              </h3>
              <p className="text-xs text-secondary">
                Kirimkan perbaikan proposal sesuai catatan masukan Dosen Reviewer
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-secondary hover:bg-subtle focus:outline-hidden disabled:opacity-40"
            aria-label="Tutup dialog"
          >
            <IconClose className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-danger">
              <IconExclamationCircle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Pemilih Berkas PDF */}
          <div>
            <label className="block text-xs font-semibold text-ink sm:text-sm">
              Berkas Proposal Perbaikan (PDF, Maks. 10 MB){' '}
              <span className="text-danger">*</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              disabled={isSubmitting}
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-subtle/40 p-5 text-center transition hover:border-brand hover:bg-white"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand">
                <IconArrowUpTray className="size-5" />
              </div>

              {selectedFile ? (
                <div className="mt-2 text-xs">
                  <p className="font-bold text-ink">{selectedFile.name}</p>
                  <p className="text-muted">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Klik untuk mengganti
                  </p>
                </div>
              ) : (
                <div className="mt-2 text-xs">
                  <p className="font-semibold text-brand">Pilih berkas PDF dari komputer</p>
                  <p className="text-muted">Format .pdf dengan ukuran maksimal 10 MB</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="kp-revision-note" className="block text-xs font-semibold text-ink sm:text-sm">
              Catatan Perbaikan (Opsional)
            </label>
            <textarea
              id="kp-revision-note"
              value={revisionNote}
              onChange={(event) => setRevisionNote(event.target.value)}
              disabled={isSubmitting}
              rows={3}
              maxLength={5000}
              className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20"
              placeholder="Jelaskan perubahan yang telah dilakukan pada proposal"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50/70 p-2.5 text-xs text-brand">
            <IconInformationCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              Berkas revisi akan dicatat sebagai <strong>versi proposal baru</strong> dan dapat ditinjau kembali oleh Dosen Reviewer.
            </span>
          </div>

          {/* Tombol Aksi Modal */}
          <div className="mt-5 flex justify-end gap-2.5 border-t border-line pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-lg border border-line bg-white px-4 py-2 text-xs font-semibold text-secondary hover:bg-subtle focus:outline-hidden disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-hover focus:outline-hidden disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <IconSpinner className="size-3.5 animate-spin" />
                  Mengirim Revisi...
                </>
              ) : (
                'Kirim Revisi Proposal'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

