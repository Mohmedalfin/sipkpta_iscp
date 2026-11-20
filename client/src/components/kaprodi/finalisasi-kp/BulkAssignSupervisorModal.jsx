import { useFocusTrap } from '../../../hooks/useFocusTrap.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconCheckCircle,
  IconClose,
  IconExclamationCircle,
  IconInformationCircle,
  IconSpinner,
} from '../../common/Icons.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';
import {
  assignSupervisorBulk,
  fetchSupervisorCandidates,
  kaprodiFinalisasiKpErrorMessage,
} from '../../../services/kaprodiFinalisasiKp.js';
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
 * Modal Penetapan Pembimbing KP Massal (Bulk Assignment) oleh Kaprodi
 * Menggunakan gaya minimalis modern selaras dengan modul Penugasan Reviewer.
 *
 * @param {object} props
 * @param {boolean} props.open - State modal terbuka
 * @param {Function} props.onClose - Handler saat modal ditutup
 * @param {Array<number>} props.selectedIds - ID pengajuan yang dicentang
 * @param {Array} props.items - Seluruh item antrean pada halaman saat ini
 * @param {Function} props.onSuccess - Callback saat penetapan massal berhasil
 */
export default function BulkAssignSupervisorModal({
  open = false,
  onClose,
  selectedIds = [],
  items = [],
  onSuccess,
}) {
  const toast = useToast();
  const modalRef = useRef(null);
  const submitInFlight = useRef(false);
  useFocusTrap(modalRef, open, () => { if (!submitInFlight.current) onClose(); });

  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [selectedDosenId, setSelectedDosenId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const candidateRequestIdRef = useRef(0);
  const requestController = useRef(null);

  // Ambil daftar kandidat dosen pembimbing saat modal dibuka
  const loadCandidates = useCallback(async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const requestId = ++candidateRequestIdRef.current;
    setLoadingCandidates(true);
    setError('');
    setCandidates([]);

    try {
      const res = await fetchSupervisorCandidates({ limit: 100 }, { signal: controller.signal });
      if (requestId !== candidateRequestIdRef.current) return;
      setCandidates(res?.items || []);
    } catch (err) {
      if (requestId !== candidateRequestIdRef.current) return;
      const message = kaprodiFinalisasiKpErrorMessage(
        err,
        'Gagal memuat daftar kandidat pembimbing prodi.'
      );
      setError(message);
    } finally {
      if (requestId === candidateRequestIdRef.current) {
        setLoadingCandidates(false);
      }
    }
  }, []);

  // Filter pengajuan terpilih yang siap ditetapkan
  const selectedApplications = items.filter(
    (item) =>
      selectedIds.includes(item.id) &&
      item.is_eligible &&
      item.status_finalisasi === 'SIAP_DITETAPKAN' &&
      Boolean(item.proposal_terkini?.id)
  );

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
    return () => {
      candidateRequestIdRef.current += 1;
      requestController.current?.abort();
    };
  }, [open, loadCandidates]);

  if (!open) return null;

  // Handler Submit Penugasan Massal
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loadingCandidates || !selectedDosenId) {
      toast.warning('Pilih salah satu dosen pembimbing terlebih dahulu.');
      return;
    }
    if (submitInFlight.current || submitting) return;
    if (!selectedApplications.length || selectedApplications.length !== selectedIds.length) {
      toast.warning('Pilihan pengajuan berubah atau tidak lagi siap. Periksa kembali seluruh pilihan.');
      return;
    }

    if (selectedApplications.length > 50) {
      toast.warning('Maksimal 50 pengajuan dalam satu penetapan massal.');
      return;
    }
    submitInFlight.current = true;
    setSubmitting(true);
    setError('');

    const payloadAssignments = selectedApplications.map((app) => ({
      pengajuan_id: app.id,
      dosen_id: Number(selectedDosenId),
      expected_dokumen_pengajuan_id: app.proposal_terkini.id,
    }));

    try {
      const res = await assignSupervisorBulk(payloadAssignments);
      const createdCount = res?.created ?? 0;
      const alreadyAssignedCount = res?.already_assigned ?? 0;

      if (createdCount > 0) {
        toast.success(
          `Berhasil menetapkan Dosen Pembimbing untuk ${createdCount} pengajuan KP.`
        );
      }
      if (alreadyAssignedCount > 0) {
        toast.info(
          `${alreadyAssignedCount} pengajuan dilewati karena pembimbing sudah aktif sebelumnya.`
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const message = kaprodiFinalisasiKpErrorMessage(
        err,
        'Gagal memproses penetapan dosen pembimbing massal.'
      );
      setError(message);
      toast.error(message);
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  };

  // Opsi Dropdown Dosen Pembimbing
  const candidateOptions = candidates
    .slice()
    .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
    .map((c) => ({
      value: String(c.id),
      label: `${c.nama_lengkap} (Beban aktif: ${c.jumlah_penugasan_pembimbing_aktif ?? 0} mhs)`,
    }));

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-bulk-assign-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-[22px] border border-slate-900/10 bg-white shadow-2xl overflow-hidden">
        {/* Header Modal (Clean, tanpa icon besar) */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.08] px-5 sm:px-6 py-4 bg-white shrink-0">
          <div>
            <h2
              id="modal-bulk-assign-title"
              className="text-base font-bold text-ink leading-tight"
            >
              Tetapkan Pembimbing Massal
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Tetapkan satu dosen pembimbing untuk {selectedApplications.length} pengajuan KP terpilih.
            </p>
          </div>

          <button
            type="button"
            onClick={() => { if (!submitInFlight.current) onClose(); }}
            disabled={submitting}
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
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800"
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
                  {selectedApplications.length} Pengajuan
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
                        <div className="size-7 sm:size-8 rounded-full bg-slate-100 border border-slate-900/10 flex items-center justify-center font-bold text-[11px] text-slate-700 shrink-0 select-none">
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

            {/* 2. Pilihan Dosen Pembimbing Target */}
            <div className="space-y-1.5 pt-0.5">
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                Pilih Dosen Pembimbing Target
              </label>
              {loadingCandidates ? (
                <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl border border-slate-900/10 bg-white text-xs text-muted">
                  <IconSpinner className="size-4 animate-spin text-brand" />
                  <span>Memuat kandidat dosen pembimbing prodi…</span>
                </div>
              ) : (
                <CustomSelect
                  value={selectedDosenId}
                  options={candidateOptions}
                  onChange={setSelectedDosenId}
                  placeholder="Pilih dosen pembimbing target..."
                  searchable={true}
                />
              )}
            </div>

            {/* 3. Info Callout (Netral Minimalis) */}
            <div className="rounded-xl border border-slate-900/[0.08] bg-slate-50 p-3.5 flex items-start gap-2.5 text-xs text-secondary">
              <IconInformationCircle className="size-4 text-brand shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed text-[11px]">
                <p className="text-ink font-medium">
                  Dosen yang dipilih akan ditetapkan secara resmi ke seluruh pengajuan mahasiswa di atas.
                </p>
                <p className="text-muted">
                  *Penetapan massal dijalankan dalam satu transaksi atomik dan masing-masing mahasiswa akan menerima notifikasi otomatis.
                </p>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-slate-900/[0.08] bg-white shrink-0">
            <p className="text-xs text-muted">
              Target: <strong className="text-ink font-mono font-semibold">{selectedApplications.length}</strong> mahasiswa
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { if (!submitInFlight.current) onClose(); }}
            disabled={submitting}
                className="rounded-xl border border-slate-900/10 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loadingCandidates || !selectedDosenId || submitting || !selectedApplications.length}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                {submitting ? (
                  <>
                    <IconSpinner className="size-3.5 animate-spin text-white" />
                    <span>Menyimpan…</span>
                  </>
                ) : (
                  <>
                    <IconCheckCircle className="size-3.5" />
                    <span>Tetapkan Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
