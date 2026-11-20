import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconClose,
  IconDocumentSearch,
  IconExclamationCircle,
  IconInformationCircle,
  IconSpinner,
} from '../../common/Icons.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';
import {
  assignBulkReviewers,
  fetchReviewerCandidates,
  kaprodiReviewerKpErrorMessage,
} from '../../../services/kaprodiReviewerKp.js';
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
 * Modal Penugasan Reviewer KP Massal (Bulk Assignment) oleh Kaprodi
 *
 * @param {object} props
 * @param {boolean} props.open - State modal terbuka
 * @param {Function} props.onClose - Handler saat modal ditutup
 * @param {Array<number>} props.selectedIds - ID pengajuan yang dicentang
 * @param {Array} props.items - Seluruh item antrean pada tampilan saat ini
 * @param {Function} props.onSuccess - Callback saat penugasan massal berhasil
 */
export default function BulkAssignReviewerModal({
  open = false,
  onClose,
  selectedIds = [],
  items = [],
  onSuccess,
}) {
  const toast = useToast();

  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [selectedDosenId, setSelectedDosenId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const candidateRequestIdRef = useRef(0);
  const requestController = useRef(null);

  // Ambil daftar kandidat dosen saat modal dibuka
  const loadCandidates = useCallback(async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const requestId = ++candidateRequestIdRef.current;
    setLoadingCandidates(true);
    setError('');
    setCandidates([]);

    try {
      const res = await fetchReviewerCandidates({ limit: 100 }, { signal: controller.signal });
      if (requestId !== candidateRequestIdRef.current) return;
      setCandidates(res?.items || []);
    } catch (err) {
      if (requestId !== candidateRequestIdRef.current) return;
      const message = kaprodiReviewerKpErrorMessage(
        err,
        'Gagal memuat daftar kandidat reviewer prodi.'
      );
      setError(message);
    } finally {
      if (requestId === candidateRequestIdRef.current) setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadCandidates();
      setSelectedDosenId('');
      setError('');
    } else {
      candidateRequestIdRef.current += 1;
      setLoadingCandidates(true);
      setCandidates([]);
      setSelectedDosenId('');
    }
    return () => { candidateRequestIdRef.current += 1; requestController.current?.abort(); };
  }, [open, loadCandidates]);

  if (!open) return null;

  // Filter daftar pengajuan yang sedang dipilih
  const selectedApplications = items.filter((item) => selectedIds.includes(item.id));

  // Handler Submit Penugasan Massal
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loadingCandidates || !selectedDosenId) {
      toast.warning('Pilih salah satu dosen reviewer terlebih dahulu.');
      return;
    }
    if (!selectedIds.length) {
      toast.warning('Tidak ada pengajuan yang dipilih.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await assignBulkReviewers(selectedIds, Number(selectedDosenId));

      const createdCount = res?.created ?? 0;
      const alreadyAssignedCount = res?.already_assigned ?? 0;

      if (createdCount > 0) {
        toast.success(`Berhasil menugaskan reviewer ke ${createdCount} pengajuan.`);
      }
      if (alreadyAssignedCount > 0) {
        toast.info(
          `${alreadyAssignedCount} pengajuan dilewati karena dosen reviewer sudah aktif sebelumnya.`
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const message = kaprodiReviewerKpErrorMessage(
        err,
        'Gagal menugaskan reviewer massal ke pengajuan terpilih.'
      );
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Opsi Dropdown Dosen Reviewer
  const candidateOptions = candidates.map((c) => ({
    value: String(c.id),
    label: `${c.nama_lengkap} (Beban aktif: ${c.jumlah_penugasan_reviewer_aktif ?? 0})`,
  }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-bulk-assign-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-[22px] border border-slate-900/10 bg-white shadow-2xl overflow-hidden">
        {/* Header (Clean, tanpa icon) */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.08] px-5 sm:px-6 py-4 bg-white shrink-0">
          <div>
            <h2
              id="modal-bulk-assign-title"
              className="text-base font-bold text-ink leading-tight"
            >
              Tugaskan Reviewer Massal
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Tetapkan satu dosen penelaah untuk {selectedIds.length} pengajuan proposal terpilih.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full border border-slate-900/10 hover:bg-slate-100 flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <IconClose className="size-4" />
          </button>
        </div>

        {/* Form: Scrollable Body & Fixed Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Body */}
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

            {/* 1. Ringkasan Pengajuan Terpilih */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider">
                  Mahasiswa Terpilih
                </label>
                <span className="text-[11px] font-mono font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                  {selectedIds.length} Pengajuan
                </span>
              </div>

              <div className="rounded-xl border border-slate-900/[0.08] bg-white shadow-2xs overflow-hidden">
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-900/[0.05] [scrollbar-gutter:stable]">
                  {selectedApplications.length > 0 ? (
                    selectedApplications.map((app) => (
                      <div
                        key={app.id}
                        className="p-2.5 sm:p-3 flex items-center gap-2.5 hover:bg-slate-50/60 transition-colors text-xs"
                      >
                        <div className="size-7 sm:size-8 rounded-full bg-slate-100 border border-slate-900/10 flex items-center justify-center font-bold text-[11px] text-slate-700 shrink-0">
                          {getInitials(app.mahasiswa?.nama_lengkap)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-ink truncate leading-tight">
                            {app.mahasiswa?.nama_lengkap}
                          </p>
                          <p className="text-[11px] text-muted truncate mt-0.5">
                            <span className="font-mono text-secondary">{app.mahasiswa?.nim || '-'}</span> • {app.versi_topik?.judul_penelitian || 'Judul belum diisi'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-muted">
                      {selectedIds.length} pengajuan dipilih dari tabel.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Pilihan Dosen Reviewer Target */}
            <div className="space-y-1.5 pt-0.5">
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                Pilih Dosen Reviewer Target
              </label>
              {loadingCandidates ? (
                <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl border border-slate-900/10 bg-white text-xs text-muted">
                  <IconSpinner className="size-4 animate-spin text-brand" />
                  <span>Memuat kandidat dosen prodi…</span>
                </div>
              ) : (
                <CustomSelect
                  value={selectedDosenId}
                  options={candidateOptions}
                  onChange={setSelectedDosenId}
                  placeholder="Pilih dosen reviewer target..."
                  searchable={true}
                />
              )}
            </div>

            {/* 3. Info Callout */}
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 flex items-start gap-2.5 text-xs text-blue-900">
              <IconInformationCircle className="size-4 text-brand shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed text-secondary text-[11px]">
                <p>
                  Dosen yang dipilih akan ditugaskan ke seluruh pengajuan mahasiswa di atas.
                </p>
                <p className="text-muted">
                  *Jika dosen sudah menjadi reviewer aktif pada salah satu pengajuan, sistem otomatis melewatinya tanpa duplikasi.
                </p>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-slate-900/[0.08] bg-white shrink-0">
            <p className="text-xs text-muted">
              Target: <strong className="text-ink font-mono font-semibold">{selectedIds.length}</strong> mahasiswa
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl border border-slate-900/10 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loadingCandidates || !selectedDosenId || submitting || !selectedIds.length}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                {submitting ? (
                  <IconSpinner className="size-3.5 animate-spin text-white" />
                ) : (
                  <IconDocumentSearch className="size-3.5" />
                )}
                <span>Tugaskan Sekarang</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

