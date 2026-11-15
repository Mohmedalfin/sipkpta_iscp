import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../../hooks/useFocusTrap.js';
import {
  IconArrowDownTray,
  IconArrowLeft,
  IconArrowRight,
  IconClose,
  IconExclamationCircle,
  IconInformationCircle,
  IconSpinner,
} from '../../common/Icons.jsx';
import {
  fetchReviewerPdf,
  fetchReviewerTask,
  reviewerError,
  saveReviewerBlob,
} from '../../../services/reviewerKp.js';
import ReviewDecisionForm from './ReviewDecisionForm.jsx';
import ReviewHistory from './ReviewHistory.jsx';

const PdfPreview = lazy(() => import('../../common/PdfPreview.jsx'));

/**
 * Format ukuran file ke satuan yang terbaca
 */
function formatFileSize(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '';
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

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
 * Modal Workspace Pemeriksaan Proposal KP oleh Reviewer
 * Mengikuti pola load dan layout stabil dari verifikasi-data-diri (tinggi konsisten sebelum dan sesudah data terload).
 *
 * @param {object} props
 * @param {number} props.id - ID Pengajuan KP
 * @param {object} [props.initialItem] - Data ringkasan awal mahasiswa untuk mencegah layout shift
 * @param {Function} props.onClose - Handler saat modal ditutup
 * @param {Function} props.onSaved - Callback setelah keputusan berhasil disimpan
 * @param {number} [props.queueIndex=1] - Nomor urut mahasiswa aktif pada antrean
 * @param {number} [props.queueTotal=1] - Total mahasiswa pada antrean
 * @param {Function} [props.onPrevStudent] - Navigasi ke mahasiswa sebelumnya
 * @param {Function} [props.onNextStudent] - Navigasi ke mahasiswa berikutnya
 */
export default function ReviewWorkspaceModal({
  id,
  initialItem = null,
  onClose,
  onSaved,
  queueIndex = 1,
  queueTotal = 1,
  onPrevStudent,
  onNextStudent,
}) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [mobileTab, setMobileTab] = useState('preview'); // 'preview' | 'review'

  const [state, setState] = useState({
    loading: true,
    detail: null,
    blob: null,
    url: '',
    error: '',
    pdfError: '',
  });

  useFocusTrap(ref, true, () => {
    if (!busy) onClose();
  });

  useEffect(() => {
    const controller = new AbortController();
    let url = '';
    setState({
      loading: true,
      detail: null,
      blob: null,
      url: '',
      error: '',
      pdfError: '',
    });

    async function load() {
      try {
        const detail = await fetchReviewerTask(id, { signal: controller.signal });
        let blob = null;
        let pdfError = '';
        try {
          blob = await fetchReviewerPdf(id, { signal: controller.signal });
        } catch (error) {
          pdfError = await reviewerError(error);
        }
        if (controller.signal.aborted) return;
        url = blob ? URL.createObjectURL(blob) : '';
        setState({
          loading: false,
          detail,
          blob,
          url,
          error: '',
          pdfError,
        });
      } catch (error) {
        const message = await reviewerError(error);
        if (!controller.signal.aborted) {
          setState((old) => ({ ...old, loading: false, error: message }));
        }
      }
    }

    load();

    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, version]);

  function saved() {
    onSaved();
    setVersion((old) => old + 1);
  }

  // Nama mahasiswa & periode akademik (didukung fallback data antrean tabel agar header instan tanpa layout shift)
  const mahasiswaNama =
    state.detail?.mahasiswa?.nama_lengkap ||
    initialItem?.mahasiswa?.nama_lengkap ||
    'Memuat data mahasiswa…';
  const mahasiswaNim =
    state.detail?.mahasiswa?.nim ||
    initialItem?.mahasiswa?.nim ||
    '-';
  const periode = state.detail?.periode
    ? `${state.detail.periode.tahun_ajaran} (${state.detail.periode.semester})`
    : initialItem?.periode
    ? `${initialItem.periode.tahun_ajaran} (${initialItem.periode.semester})`
    : '';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-workspace-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        ref={ref}
        className="relative w-full max-w-7xl h-[94vh] sm:h-[92vh] max-h-[920px] rounded-[20px] sm:rounded-[24px] border border-slate-900/[0.12] bg-white flex flex-col overflow-hidden shadow-2xl text-ink"
      >
        {/* ================= 1. MODAL TOP HEADER ================= */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 bg-white border-b border-slate-900/[0.08] shrink-0">
          {/* Sisi Kiri: Profil Mahasiswa */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="size-9 sm:size-10 rounded-full bg-slate-100 border border-slate-900/[0.08] flex items-center justify-center text-slate-800 font-bold text-xs tracking-tight">
                {getInitials(mahasiswaNama)}
              </div>
              <span
                className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                title="Status Mahasiswa Aktif"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="review-workspace-title"
                className="text-xs sm:text-base font-bold text-ink truncate leading-snug"
              >
                {mahasiswaNama}
              </h2>
              <p className="text-[11px] sm:text-xs text-muted truncate mt-0.5">
                NIM: <span className="font-mono font-semibold text-secondary">{mahasiswaNim}</span>
                {periode ? ` • Periode ${periode}` : ''}
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Navigasi Antrean & Tombol Tutup */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {queueTotal > 1 && (
              <div className="inline-flex items-center rounded-full border border-slate-900/[0.08] bg-slate-50 p-0.5 shadow-none">
                <button
                  type="button"
                  disabled={queueIndex <= 1 || state.loading || busy}
                  onClick={onPrevStudent}
                  className="size-6 sm:size-7 rounded-full flex items-center justify-center text-slate-500 hover:text-ink hover:bg-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Proposal sebelumnya"
                  aria-label="Proposal sebelumnya"
                >
                  <IconArrowLeft className="size-3 sm:size-3.5" />
                </button>
                <span className="px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-mono font-semibold text-slate-600 select-none">
                  {queueIndex} / {queueTotal}
                </span>
                <button
                  type="button"
                  disabled={queueIndex >= queueTotal || state.loading || busy}
                  onClick={onNextStudent}
                  className="size-6 sm:size-7 rounded-full flex items-center justify-center text-slate-500 hover:text-ink hover:bg-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Proposal berikutnya"
                  aria-label="Proposal berikutnya"
                >
                  <IconArrowRight className="size-3 sm:size-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="size-8 rounded-full border border-slate-900/[0.08] bg-white hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-ink transition-colors cursor-pointer shadow-none shrink-0 disabled:opacity-50"
              aria-label="Tutup pemeriksaan"
            >
              <IconClose className="size-4" />
            </button>
          </div>
        </div>

        {/* ================= 2. MOBILE VIEW TAB SWITCHER ================= */}
        <div className="flex lg:hidden bg-white border-b border-slate-900/[0.08] px-4 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-2.5 font-bold text-center border-b-2 transition-colors cursor-pointer ${
              mobileTab === 'preview'
                ? 'border-brand text-brand'
                : 'border-transparent text-secondary hover:text-ink'
            }`}
          >
            Pratinjau PDF Proposal
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('review')}
            className={`flex-1 py-2.5 font-bold text-center border-b-2 transition-colors cursor-pointer ${
              mobileTab === 'review'
                ? 'border-brand text-brand'
                : 'border-transparent text-secondary hover:text-ink'
            }`}
          >
            Keputusan & Histori
          </button>
        </div>

        {/* ================= 3. MAIN WORKSPACE CONTENT ================= */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden bg-white">
          {/* Loading State: Mengisi penuh tinggi workspace tanpa mengecilkan layout */}
          {state.loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 bg-slate-50/50">
              <IconSpinner className="size-8 text-brand animate-spin" />
              <p className="text-xs text-secondary font-medium">
                Memuat berkas proposal & riwayat telaah…
              </p>
              <p className="text-[11px] text-muted">Memvalidasi penugasan aktif Anda</p>
            </div>
          ) : state.error ? (
            /* Error State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
              <IconExclamationCircle className="size-10 text-danger mb-2" />
              <p className="text-sm font-bold text-ink">Gagal Memuat Data Proposal</p>
              <p className="text-xs text-secondary mt-1 max-w-md">{state.error}</p>
              <button
                type="button"
                onClick={() => setVersion((v) => v + 1)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-900/10 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer"
              >
                <span>Coba Lagi</span>
              </button>
            </div>
          ) : (
            /* 2-Pane Workspace Layout */
            <>
              {/* ------------ LEFT PANE: PENAMPIL DOKUMEN PDF ------------ */}
              <section
                className={`flex-1 lg:flex-none min-h-0 h-full w-full lg:w-[58%] xl:w-[62%] flex flex-col border-b lg:border-b-0 lg:border-r border-slate-900/[0.08] bg-slate-100/60 overflow-hidden ${
                  mobileTab === 'review' ? 'hidden lg:flex' : 'flex'
                }`}
              >
                {/* Subheader Dokumen */}
                <div className="px-5 py-3 border-b border-slate-900/[0.08] bg-white flex items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-ink truncate leading-tight">
                      {state.detail?.judul || 'Proposal Kerja Praktik'}
                    </h3>
                    <p className="text-[11px] text-muted truncate mt-0.5">
                      Versi <span className="font-semibold text-ink">v{state.detail?.versi_proposal?.nomor_versi || 1}</span>
                      {state.detail?.proposal?.ukuran_bytes
                        ? ` • ${formatFileSize(state.detail.proposal.ukuran_bytes)}`
                        : ''}
                    </p>
                  </div>

                  {state.blob && (
                    <button
                      type="button"
                      onClick={() =>
                        saveReviewerBlob(
                          state.blob,
                          state.detail?.proposal?.nama_file_asli || 'Proposal_KP.pdf'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/10 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer shadow-2xs shrink-0"
                      title="Unduh berkas PDF proposal"
                    >
                      <IconArrowDownTray className="size-3.5" />
                      <span>Unduh PDF</span>
                    </button>
                  )}
                </div>

                {/* PDF Viewer Canvas */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
                  {state.pdfError ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center rounded-xl border border-slate-900/10 bg-white">
                      <IconExclamationCircle className="size-8 text-rose-500 mb-2" />
                      <p className="text-xs font-bold text-ink">Pratinjau PDF Tidak Dapat Dimuat</p>
                      <p className="text-[11px] text-muted mt-1 max-w-sm">{state.pdfError}</p>
                      <button
                        type="button"
                        onClick={() => setVersion((v) => v + 1)}
                        className="mt-3 text-xs text-brand font-semibold hover:underline cursor-pointer"
                      >
                        Coba muat ulang berkas
                      </button>
                    </div>
                  ) : (
                    <Suspense
                      fallback={
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-xs text-muted">
                          <IconSpinner className="size-6 animate-spin text-brand mb-2" />
                          <span>Menyiapkan pratinjau dokumen PDF…</span>
                        </div>
                      }
                    >
                      <PdfPreview url={state.url} title="Proposal Kerja Praktik" />
                    </Suspense>
                  )}
                </div>
              </section>

              {/* ------------ RIGHT PANE: FORM KEPUTUSAN & HISTORI ------------ */}
              <aside
                className={`flex-1 min-h-0 h-full overflow-y-auto [scrollbar-gutter:stable] p-5 sm:p-6 space-y-5 bg-slate-50/40 ${
                  mobileTab === 'preview' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Catatan Perbaikan dari Mahasiswa (jika proposal revisi) */}
                {state.detail?.proposal?.catatan_perbaikan && (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <IconInformationCircle className="size-4 text-amber-600 shrink-0" />
                      <span>Catatan Perbaikan dari Mahasiswa</span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-wrap break-words pl-5.5">
                      {state.detail.proposal.catatan_perbaikan}
                    </p>
                  </div>
                )}

                {/* Status Progres Tim Reviewer */}
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-900/[0.08] bg-white text-xs shadow-2xs">
                  <span className="text-muted font-medium">Tim Reviewer Aktif</span>
                  <span className="font-semibold text-ink">
                    <strong className="text-brand font-bold">
                      {state.detail?.rekap?.jumlah_layak_versi_terkini ?? 0}
                    </strong>{' '}
                    dari {state.detail?.rekap?.jumlah_reviewer_aktif ?? 1} reviewer menyatakan Layak
                  </span>
                </div>

                {/* Formulir Keputusan Telaah */}
                <ReviewDecisionForm
                  key={version}
                  detail={state.detail}
                  onSaved={saved}
                  onBusy={setBusy}
                />

                {/* Histori Putaran Telaah Terdahulu */}
                <ReviewHistory items={state.detail?.riwayat_saya || []} />
              </aside>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
