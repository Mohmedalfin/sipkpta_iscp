import { useFocusTrap } from '../../../hooks/useFocusTrap.js';
import useModalCandidates from '../../../hooks/useModalCandidates.js';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconArrowDownTray,
  IconArrowLeft,
  IconArrowRight,
  IconClose,
  IconDocumentText,
  IconExclamationCircle,
  IconExclamationTriangle,
  IconSpinner,
} from '../../common/Icons.jsx';
import ConfirmDialog from '../../common/ConfirmDialog.jsx';
import {
  FinalisasiStatusBadge,
  ProposalVersionBadge,
} from './FinalisasiKpStatusBadge.jsx';
import KelayakanChecklist from './KelayakanChecklist.jsx';
import AssignSupervisorForm from './AssignSupervisorForm.jsx';
import SupervisorManagementCard from './SupervisorManagementCard.jsx';
import {
  assignSupervisor,
  downloadProposalDocument,
  fetchKaprodiFinalisasiKpDetail,
  kaprodiFinalisasiKpErrorMessage,
  replaceSupervisor,
} from '../../../services/kaprodiFinalisasiKp.js';
import { useToast } from '../../../context/ToastContext.jsx';

/**
 * Ekstraksi inisial nama mahasiswa
 */
function getInitials(name) {
  if (!name) return 'M';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Format tanggal ringkas Indonesia
 */
function formatShortDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '-';
  }
}

/**
 * Modal Kerja Detail Kelayakan, Penetapan Pembimbing Individual, & Penggantian Pembimbing KP
 * Mengikuti arsitektur dan visual 2-kolom minimalis modern selaras dengan modul Penugasan Reviewer.
 *
 * @param {object} props
 * @param {boolean} props.open - State modal terbuka
 * @param {Function} props.onClose - Handler saat modal ditutup
 * @param {number|string} props.pengajuanId - ID pengajuan yang ditinjau
 * @param {Function} [props.onSuccess] - Callback saat penetapan/penggantian berhasil
 * @param {number} [props.queueIndex] - Urutan index antrean saat ini (1-based)
 * @param {number} [props.queueTotal] - Total jumlah pengajuan dalam antrean
 * @param {Function} [props.onPrevStudent] - Navigasi ke pengajuan sebelumnya
 * @param {Function} [props.onNextStudent] - Navigasi ke pengajuan berikutnya
 */
export default function FinalisasiWorkspaceModal({
  open = false,
  onClose,
  pengajuanId,
  onSuccess,
  queueIndex = 1,
  queueTotal = 1,
  onPrevStudent,
  onNextStudent,
}) {
  const toast = useToast();
  const modalRef = useRef(null);
  useFocusTrap(modalRef, open, () => { if (!mutationInFlight.current) onClose(); });
  const mutationInFlight = useRef(false);
  const currentContext = useRef(null);
  currentContext.current = open ? pengajuanId : null;
  const queryClient = useQueryClient();
  const requestController = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedDetail, setDetail] = useState(null);
  const detail = loadedDetail && String(loadedDetail.id) === String(pengajuanId) ? loadedDetail : null;
  const candidateQuery = useModalCandidates('supervisor', open, pengajuanId);
  const candidates = candidateQuery.data?.items ?? [];
  const candidatesUnavailable = candidateQuery.isPending || candidateQuery.isError;
  const detailRequestIdRef = useRef(0);

  // State Submisi
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [submittingReplace, setSubmittingReplace] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState(false);

  // Dialog Konfirmasi Penetapan
  const [confirmAssign, setConfirmAssign] = useState({
    open: false,
    dosenId: null,
    dosenName: '',
  });

  /**
   * Muat data detail kelayakan pengajuan dan daftar kandidat pembimbing
   */
  const loadDetailAndCandidates = useCallback(async () => {
    if (!pengajuanId) return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const requestId = ++detailRequestIdRef.current;

    setLoading(true);
    setError('');

    try {
      const detailData = await queryClient.fetchQuery({
        queryKey: ['kaprodi-finalisasi-kp-detail', pengajuanId], staleTime: 0,
        queryFn: ({ signal }) => fetchKaprodiFinalisasiKpDetail(pengajuanId,
          { signal: AbortSignal.any([signal, controller.signal]) }),
      });

      if (requestId !== detailRequestIdRef.current) return;

      if (!detailData || String(detailData.id) !== String(pengajuanId)) {
        setError('Data pengajuan tidak ditemukan atau tidak tersedia.');
        return;
      }

      setDetail(detailData);

    } catch (err) {
      if (requestId !== detailRequestIdRef.current) return;
      const message = kaprodiFinalisasiKpErrorMessage(
        err,
        'Gagal memuat rincian kelayakan atau daftar kandidat pembimbing.'
      );
      setError(message);
      toast.error(message);
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [pengajuanId, toast, queryClient]);

  useEffect(() => {
    if (open && pengajuanId) {
      loadDetailAndCandidates();
      setConfirmAssign({ open: false, dosenId: null, dosenName: '' });
    } else {
      detailRequestIdRef.current += 1;
      setLoading(true);
      setDetail(null);
  
    }
    return () => {
      detailRequestIdRef.current += 1;
      requestController.current?.abort();
    };
  }, [open, pengajuanId, loadDetailAndCandidates]);

  const mutating = submittingAssign || submittingReplace;

  if (!open) return null;

  const mahasiswaNama = detail?.mahasiswa?.nama_lengkap || 'Mahasiswa';
  const mahasiswaNim = detail?.mahasiswa?.nim || '-';
  const periode = detail?.periode_akademik
    ? `${detail.periode_akademik.tahun_ajaran} (${detail.periode_akademik.semester})`
    : '';
  const judul = detail?.versi_topik?.judul_penelitian || 'Judul belum diisi';
  const versiProposal = detail?.proposal_terkini?.nomor_versi ?? detail?.versi_topik?.nomor_versi ?? 1;
  const tanggalKirim = formatShortDate(detail?.diajukan_at);

  /**
   * Handler Unduh Berkas Proposal PDF
   */
  const handleDownloadProposal = async () => {
    if (!detail?.proposal_terkini?.id) {
      toast.warning('Dokumen proposal fisik tidak ditemukan.');
      return;
    }

    setDownloadingDoc(true);
    try {
      const blob = await downloadProposalDocument(pengajuanId, detail.proposal_terkini.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `Proposal_KP_${mahasiswaNim}_v${versiProposal}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Berkas proposal berhasil diunduh.');
    } catch (err) {
      toast.error(kaprodiFinalisasiKpErrorMessage(err, 'Gagal mengunduh berkas proposal.'));
    } finally {
      setDownloadingDoc(false);
    }
  };

  /**
   * Handler Buka Dialog Konfirmasi Penetapan
   */
  const handlePromptAssign = (dosenId) => {
    const candidate = candidates.find((c) => c.id === dosenId);
    setConfirmAssign({
      open: true,
      dosenId,
      dosenName: candidate?.nama_lengkap || 'Dosen Pembimbing',
    });
  };

  /**
   * Eksekusi Penetapan Pembimbing Resmi
   */
  const handleExecuteAssign = async () => {
    if (candidatesUnavailable || !confirmAssign.dosenId || !detail?.proposal_terkini?.id) return;

    if (mutationInFlight.current || !detail || String(detail.id) !== String(pengajuanId)) return;
    mutationInFlight.current = true;
    setSubmittingAssign(true);
    try {
      await assignSupervisor(pengajuanId, {
        dosen_id: confirmAssign.dosenId,
        expected_dokumen_pengajuan_id: detail.proposal_terkini.id,
      });

      toast.success(
        `Dosen Pembimbing ${confirmAssign.dosenName} berhasil ditetapkan untuk ${mahasiswaNama}.`
      );
      setConfirmAssign({ open: false, dosenId: null, dosenName: '' });

      // Muat ulang detail internal & refresh antrean di halaman luar
      if (currentContext.current === pengajuanId) await loadDetailAndCandidates();
      void candidateQuery.refetch({ cancelRefetch: false });
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(kaprodiFinalisasiKpErrorMessage(err, 'Gagal menetapkan dosen pembimbing.'));
    } finally {
      mutationInFlight.current = false;
      setSubmittingAssign(false);
    }
  };

  /**
   * Eksekusi Penggantian Pembimbing Resmi
   */
  const handleExecuteReplace = async ({ dosen_baru_id, alasan_penggantian }) => {
    if (mutationInFlight.current || !detail || String(detail.id) !== String(pengajuanId)) return;
    mutationInFlight.current = true;
    if (candidatesUnavailable) { mutationInFlight.current = false; return; }
    setSubmittingReplace(true);
    try {
      await replaceSupervisor(pengajuanId, {
        dosen_baru_id,
        alasan_penggantian,
      });

      toast.success('Dosen pembimbing berhasil diganti.');
      if (currentContext.current === pengajuanId) await loadDetailAndCandidates();
      void candidateQuery.refetch({ cancelRefetch: false });
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(kaprodiFinalisasiKpErrorMessage(err, 'Gagal mengganti dosen pembimbing.'));
    } finally {
      mutationInFlight.current = false;
      setSubmittingReplace(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-finalisasi-workspace-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      >
        <div ref={modalRef} className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-[22px] border border-slate-900/10 bg-white shadow-2xl overflow-hidden">
          {/* 1. Modal Header (Clean & Minimalis) */}
          <div className="flex items-center justify-between border-b border-slate-900/[0.08] px-5 py-4 bg-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <div className="size-10 rounded-full bg-slate-100 border border-slate-900/10 flex items-center justify-center font-bold text-sm text-slate-700 shrink-0 select-none">
                  {getInitials(mahasiswaNama)}
                </div>
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="min-w-0">
                <h2
                  id="modal-finalisasi-workspace-title"
                  className="text-sm sm:text-base font-bold text-ink truncate leading-tight"
                >
                  {mahasiswaNama}
                </h2>
                <p className="text-xs text-muted font-mono mt-0.5">
                  NIM: {mahasiswaNim} {periode ? `• Periode ${periode}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {queueTotal > 1 && (
                <div className="flex items-center rounded-lg border border-slate-900/10 bg-slate-50 p-0.5 text-xs">
                  <button
                    type="button"
                    disabled={queueIndex <= 1 || loading || mutating}
                    onClick={onPrevStudent}
                    className="p-1 rounded hover:bg-white text-secondary disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Pengajuan Sebelumnya"
                  >
                    <IconArrowLeft className="size-3.5" />
                  </button>
                  <span className="px-2 font-mono text-[11px] font-semibold text-secondary">
                    {queueIndex} / {queueTotal}
                  </span>
                  <button
                    type="button"
                    disabled={queueIndex >= queueTotal || loading || mutating}
                    onClick={onNextStudent}
                    className="p-1 rounded hover:bg-white text-secondary disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Pengajuan Berikutnya"
                  >
                    <IconArrowRight className="size-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => { if (!mutationInFlight.current) onClose(); }}
                disabled={mutating}
                className="size-8 rounded-full border border-slate-900/10 hover:bg-slate-100 flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
                aria-label="Tutup modal"
              >
                <IconClose className="size-4" />
              </button>
            </div>
          </div>

          {/* 2. Modal Body (Scrollable 2-Kolom) */}
          <div className="p-5 overflow-y-auto [scrollbar-gutter:stable] space-y-5 flex-1 bg-slate-50/40">
            {candidateQuery.isPending && <p role="status" className="text-xs text-muted">Memuat kandidat dosen?</p>}
            {candidateQuery.isError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p>{kaprodiFinalisasiKpErrorMessage(candidateQuery.error, 'Kandidat dosen belum dapat dimuat.')}</p>
              <button type="button" className="mt-1 font-semibold underline" onClick={() => candidateQuery.refetch()}>Coba lagi</button>
            </div>}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800"
              >
                <IconExclamationCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            {loading || (!error && !detail) ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted">
                <IconSpinner className="size-7 animate-spin text-brand mb-2" />
                <p className="text-xs font-semibold">Memuat rincian kelayakan & kandidat pembimbing…</p>
              </div>
            ) : error && !detail ? null : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Kolom Kiri: Informasi Proposal & Dokumen (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Card Info Proposal */}
                  <div className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 space-y-3.5 shadow-none">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-900/[0.06] pb-2.5">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                        Informasi Proposal KP
                      </span>
                      {detail && (
                        <FinalisasiStatusBadge
                          status={detail.status_finalisasi}
                          reasons={detail.alasan}
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-[11px] text-muted block mb-0.5">Judul Penelitian</label>
                      <p className="text-xs font-bold text-ink leading-snug">
                        {judul}
                      </p>
                    </div>

                    {tanggalKirim && (
                      <div>
                        <label className="text-[11px] text-muted block mb-0.5">Tanggal Pengajuan</label>
                        <p className="text-xs text-secondary font-medium">
                          {tanggalKirim}
                        </p>
                      </div>
                    )}

                    {detail?.usulan_pembimbing?.nama_lengkap && (
                      <div className="pt-2 border-t border-slate-900/[0.06]">
                        <label className="text-[11px] text-muted block mb-0.5">
                          Usulan Pembimbing (Mahasiswa)
                        </label>
                        <p className="text-xs text-secondary italic">
                          {detail.usulan_pembimbing.nama_lengkap}
                        </p>
                        <span className="text-[10px] text-muted block mt-0.5">
                          *Usulan sekadar referensi, bukan penugasan resmi.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Berkas Proposal */}
                  <div className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 space-y-3 shadow-none">
                    <div className="flex items-center justify-between border-b border-slate-900/[0.06] pb-2">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                        Berkas Proposal
                      </span>
                      {detail?.proposal_terkini && (
                        <span className="text-[11px] font-mono text-muted">
                          v{versiProposal}
                        </span>
                      )}
                    </div>

                    {detail?.proposal_terkini?.id ? (
                      <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-900/[0.06] bg-slate-50/70">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <IconDocumentText className="size-5 text-brand shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">
                              Proposal_KP_{mahasiswaNim}.pdf
                            </p>
                            <p className="text-[10px] text-muted">
                              Versi proposal terkini
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleDownloadProposal}
                          disabled={downloadingDoc}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/10 bg-white hover:bg-slate-50 px-2.5 py-1 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {downloadingDoc ? (
                            <IconSpinner className="size-3.5 animate-spin text-brand" />
                          ) : (
                            <IconArrowDownTray className="size-3.5 text-brand" />
                          )}
                          <span>Unduh</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 text-center text-xs text-muted">
                        Tidak ada dokumen proposal yang terlampir.
                      </div>
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: Aksi Penetapan & Kelayakan (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* 1. Komponen Aksi Utama Kaprodi */}
                  {detail.status_finalisasi === 'SIAP_DITETAPKAN' ? (
                    <AssignSupervisorForm
                      candidates={candidates}
                      usulanPembimbing={detail.usulan_pembimbing}
                      submitting={submittingAssign || candidatesUnavailable}
                      onSubmit={handlePromptAssign}
                    />
                  ) : detail.status_finalisasi === 'SUDAH_DITETAPKAN' ? (
                    <SupervisorManagementCard
                      pembimbing={detail.pembimbing}
                      statusBimbingan={detail.status_bimbingan}
                      candidates={candidates}
                      submittingReplace={submittingReplace || candidatesUnavailable}
                      onReplace={handleExecuteReplace}
                    />
                  ) : (
                    // Banner jika BELUM_SIAP
                    <div className="rounded-[18px] border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 space-y-1.5 shadow-none">
                      <div className="flex items-center gap-2">
                        <IconExclamationTriangle className="size-4 text-amber-600 shrink-0" />
                        <h4 className="font-bold text-xs text-amber-950">
                          Pengajuan Belum Siap Ditetapkan
                        </h4>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Sesuai prosedur operasional akademik, Dosen Pembimbing hanya dapat ditetapkan setelah seluruh 7 gerbang kelayakan di bawah ini terpenuhi.
                      </p>
                    </div>
                  )}

                  {/* 2. Rincian Checklist Kelayakan Ringkas */}
                  <KelayakanChecklist
                    detail={detail}
                    compact={detail.status_finalisasi === 'SIAP_DITETAPKAN'}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog Konfirmasi Penetapan Pembimbing */}
      <ConfirmDialog
        open={confirmAssign.open}
        onClose={() => setConfirmAssign({ open: false, dosenId: null, dosenName: '' })}
        onConfirm={handleExecuteAssign}
        title="Tetapkan Dosen Pembimbing?"
        description={`Anda akan menetapkan ${confirmAssign.dosenName} sebagai Dosen Pembimbing resmi untuk pengajuan KP mahasiswa ${mahasiswaNama}. Lanjutkan?`}
        confirmLabel="Ya, Tetapkan Pembimbing"
        cancelLabel="Batal"
        variant="primary"
        loading={submittingAssign}
      />
    </>
  );
}
