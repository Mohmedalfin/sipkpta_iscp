import { useEffect, useRef, useState } from 'react';
import { IconClose, IconSpinner } from '../../common/Icons.jsx';
import boxIcon from '../../../assets/NoBackground Box.svg';
import { useFocusTrap } from '../../../hooks/useFocusTrap.js';

const PRESET_REASONS = [
  'Foto/scan dokumen buram atau teks tidak terbaca dengan jelas.',
  'Dokumen terpotong, silakan unggah ulang seluruh lembar dokumen.',
  'Data identitas pada dokumen tidak cocok dengan profil resmi mahasiswa.',
  'Bukan dokumen asli atau legalisir resmi yang disyaratkan.',
];

export default function RevisionNoteModal({
  open,
  documentTitle = 'Dokumen',
  onSubmit,
  onClose,
  submitting = false,
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const modalRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setError('');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  useFocusTrap(modalRef, open, onClose);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const cleanNote = note.trim();
    if (!cleanNote) {
      setError('Catatan perbaikan wajib diisi agar mahasiswa mengetahui hal yang harus diperbaiki.');
      return;
    }
    if (cleanNote.length > 2000) {
      setError('Catatan maksimal 2000 karakter.');
      return;
    }
    setError('');
    onSubmit(cleanNote);
  }

  function handlePresetClick(preset) {
    setNote((prev) => (prev ? `${prev}\n${preset}` : preset));
    setError('');
    textareaRef.current?.focus();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-modal-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-modal-title"
        className="relative w-full max-w-lg rounded-[22px] border border-slate-900/[0.12] bg-white/95 backdrop-blur-md p-6 shadow-2xl text-ink"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-900/[0.06]">
          <div className="flex items-center gap-3">
            <img
              src={boxIcon}
              alt=""
              className="size-11 sm:size-12 shrink-0 select-none pointer-events-none object-contain"
              aria-hidden="true"
            />
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
                Permintaan Revisi Dokumen
              </span>
              <h2 id="revision-modal-title" className="text-base font-bold text-ink">
                Minta Perbaikan: {documentTitle}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="size-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-ink hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup dialog"
          >
            <IconClose className="size-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="revision-note-input" className="block text-xs font-bold text-ink mb-1">
              Catatan Alasan Perbaikan <span className="text-danger">*</span>
            </label>
            <p className="text-[11px] text-muted mb-2">
              Tuliskan instruksi atau alasan yang jelas agar mahasiswa dapat memperbaiki dokumen dengan tepat.
            </p>
            <textarea
              id="revision-note-input"
              ref={textareaRef}
              rows={4}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError('');
              }}
              placeholder="Contoh: Foto KTP tidak terbaca jelas pada bagian NIK. Mohon scan ulang dengan pencahayaan yang cukup."
              className={`w-full rounded-xl border p-3 text-xs leading-relaxed text-ink focus:outline-none transition-colors ${
                error
                  ? 'border-danger focus:ring-2 focus:ring-danger/20'
                  : 'border-slate-900/[0.12] bg-white/80 focus:border-brand focus:ring-2 focus:ring-brand/20'
              }`}
            />
            {error && <p className="mt-1 text-xs text-danger font-medium">{error}</p>}
          </div>

          {/* Preset Buttons for Quick Entry */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
              Template Catatan Cepat (Klik untuk memilih):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className="rounded-full border border-slate-900/[0.08] bg-white/70 hover:bg-white px-3 py-1 text-[11px] text-secondary font-medium text-left transition-colors cursor-pointer"
                >
                  + {preset.length > 40 ? `${preset.substring(0, 40)}…` : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-900/[0.06] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-900/[0.08] bg-white/80 hover:bg-white px-4 py-2 text-xs font-semibold text-secondary transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !note.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold transition-colors cursor-pointer shadow-none"
            >
              {submitting ? (
                <>
                  <IconSpinner className="size-3.5" />
                  <span>Menyimpan…</span>
                </>
              ) : (
                <span>Kirim Permintaan Revisi</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

