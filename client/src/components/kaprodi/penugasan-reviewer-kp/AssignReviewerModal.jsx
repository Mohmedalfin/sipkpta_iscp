import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconArrowDownTray,
  IconArrowLeft,
  IconArrowRight,
  IconBriefcase,
  IconCheckCircle,
  IconClose,
  IconDocumentSearch,
  IconDocumentText,
  IconEdit,
  IconExclamationCircle,
  IconExclamationTriangle,
  IconMapPin,
  IconSpinner,
  IconTrash,
  IconUser,
  IconUsers,
} from '../../common/Icons.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';
import {
  assignApplicationReviewers,
  deactivateApplicationReviewer,
  downloadProposalDocument,
  fetchKaprodiKpDetail,
  fetchReviewerCandidates,
  kaprodiReviewerKpErrorMessage,
  replaceApplicationReviewer,
} from '../../../services/kaprodiReviewerKp.js';
import { useToast } from '../../../context/ToastContext.jsx';

/**
 * Format ukuran file ke satuan manusia
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format tanggal & jam Indonesia
 */
function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '-';
  }
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
 * Modal Kerja Detail Pengajuan & Penugasan Reviewer KP Kaprodi
 *
 * @param {object} props
 * @param {boolean} props.open - State modal terbuka
 * @param {Function} props.onClose - Handler saat modal ditutup
 * @param {number|string} props.pengajuanId - ID pengajuan yang ditinjau
 * @param {Function} [props.onSuccess] - Callback saat penugasan/pergantian berhasil
 * @param {number} [props.queueIndex] - Urutan index antrean saat ini (1-based)
 * @param {number} [props.queueTotal] - Total jumlah pengajuan dalam antrean
 * @param {Function} [props.onPrevStudent] - Navigasi ke pengajuan sebelumnya
 * @param {Function} [props.onNextStudent] - Navigasi ke pengajuan berikutnya
 */
export default function AssignReviewerModal({
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
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const detailRequestIdRef = useRef(0);

  // Form State Penugasan Baru
  const [selectedDosenId, setSelectedDosenId] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Sub-dialog Pergantian Reviewer
  const [replaceState, setReplaceState] = useState({
    open: false,
    penugasanId: null,
    currentDosenName: '',
    currentDosenId: null,
  });
  const [replacementDosenId, setReplacementDosenId] = useState('');
  const [replaceReason, setReplaceReason] = useState('');
  const [submittingReplace, setSubmittingReplace] = useState(false);

  // Sub-dialog Penonaktifan Reviewer
  const [deactivateState, setDeactivateState] = useState({
    open: false,
    penugasanId: null,
    currentDosenName: '',
  });
  const [deactivateReason, setDeactivateReason] = useState('');
  const [submittingDeactivate, setSubmittingDeactivate] = useState(false);

  // Unduh dokumen
  const [downloading, setDownloading] = useState(false);

  /**
   * Muat data detail pengajuan dan daftar kandidat dosen
   */
  const loadDetailAndCandidates = useCallback(async () => {
    if (!pengajuanId) return;
    const requestId = ++detailRequestIdRef.current;

    setLoading(true);
    setError('');
    setDetail(null);
    setCandidates([]);

    try {
      const [detailData, candidateData] = await Promise.all([
        queryClient.fetchQuery({ queryKey: ['kaprodi-kp-detail', pengajuanId],
          queryFn: ({ signal }) => fetchKaprodiKpDetail(pengajuanId, { signal }), staleTime: 0 }),
        fetchReviewerCandidates({ limit: 100, pengajuan_id: pengajuanId }),
      ]);
      if (requestId !== detailRequestIdRef.current) return;
      if (detailData?.id == null || String(detailData.id) !== String(pengajuanId)) {
        setError('Detail pengajuan tidak tersedia. Coba lagi.');
        return;
      }

      setDetail(detailData);
      setCandidates(candidateData?.items || []);
    } catch (err) {
      if (requestId !== detailRequestIdRef.current) return;
      const message = kaprodiReviewerKpErrorMessage(
        err,
        'Gagal memuat detail pengajuan atau daftar kandidat reviewer.'
      );
      setError(message);
      toast.error(message);
    } finally {
      if (requestId === detailRequestIdRef.current) setLoading(false);
    }
  }, [pengajuanId, toast, queryClient]);

  useEffect(() => {
    if (open && pengajuanId) {
      loadDetailAndCandidates();
      setSelectedDosenId('');
      setReplaceState({ open: false, penugasanId: null, currentDosenName: '', currentDosenId: null });
      setDeactivateState({ open: false, penugasanId: null, currentDosenName: '' });
      setReplaceReason('');
      setDeactivateReason('');
    } else {
      detailRequestIdRef.current += 1;
      setLoading(true);
      setDetail(null);
      setCandidates([]);
    }
    return () => { detailRequestIdRef.current += 1; };
  }, [open, pengajuanId, loadDetailAndCandidates]);

  if (!open) return null;

  // Reviewer Aktif & Riwayat
  const visibleDetail = detail?.id != null && String(detail.id) === String(pengajuanId) ? detail : null;
  const showDetailLoading = loading || (!error && !visibleDetail);
  const activeAssignments =
    visibleDetail?.penugasan_dosen?.filter((row) => row.status_penugasan === 'AKTIF') || [];
  const inactiveAssignments =
    visibleDetail?.penugasan_dosen?.filter((row) => row.status_penugasan === 'NONAKTIF') || [];

  // Berkas Dokumen Proposal Terkini
  const proposalDoc = visibleDetail?.dokumen_pengajuan?.find((d) => Boolean(d.dokumen));

  // Handler Unduh Proposal
  const handleDownloadProposal = async () => {
    if (!proposalDoc || !detail?.id) return;
    setDownloading(true);
    try {
      const blob = await downloadProposalDocument(detail.id, proposalDoc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = proposalDoc.dokumen?.nama_file_asli || `Proposal_KP_${detail.mahasiswa?.nim}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = kaprodiReviewerKpErrorMessage(err, 'Gagal mengunduh berkas proposal.');
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  };

  // Handler Submit Penugasan Baru
  const handleAssignReviewer = async (e) => {
    e.preventDefault();
    if (!selectedDosenId) {
      toast.warning('Pilih salah satu dosen reviewer terlebih dahulu.');
      return;
    }

    setSubmittingAssign(true);
    setError('');

    try {
      await assignApplicationReviewers(pengajuanId, [Number(selectedDosenId)]);
      toast.success('Dosen Reviewer berhasil ditugaskan.');
      setSelectedDosenId('');
      await loadDetailAndCandidates();
      if (onSuccess) onSuccess();
    } catch (err) {
      const message = kaprodiReviewerKpErrorMessage(err, 'Gagal menugaskan reviewer.');
      setError(message);
      toast.error(message);
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Handler Submit Pergantian Reviewer
  const handleReplaceReviewer = async (e) => {
    e.preventDefault();
    if (!replacementDosenId) {
      toast.warning('Pilih dosen pengganti terlebih dahulu.');
      return;
    }
    if (!replaceReason.trim()) {
      toast.warning('Alasan pergantian reviewer wajib diisi.');
      return;
    }

    setSubmittingReplace(true);
    setError('');

    try {
      await replaceApplicationReviewer(replaceState.penugasanId, {
        dosen_id_baru: Number(replacementDosenId),
        alasan: replaceReason.trim(),
      });
      toast.success('Reviewer berhasil diganti.');
      setReplaceState({ open: false, penugasanId: null, currentDosenName: '', currentDosenId: null });
      setReplacementDosenId('');
      setReplaceReason('');
      await loadDetailAndCandidates();
      if (onSuccess) onSuccess();
    } catch (err) {
      const message = kaprodiReviewerKpErrorMessage(err, 'Gagal mengganti reviewer.');
      setError(message);
      toast.error(message);
    } finally {
      setSubmittingReplace(false);
    }
  };

  // Handler Submit Penonaktifan Reviewer
  const handleDeactivateReviewer = async (e) => {
    e.preventDefault();
    if (!deactivateReason.trim()) {
      toast.warning('Alasan penonaktifan reviewer wajib diisi.');
      return;
    }

    setSubmittingDeactivate(true);
    setError('');

    try {
      await deactivateApplicationReviewer(deactivateState.penugasanId, deactivateReason.trim());
      toast.success('Penugasan reviewer dinonaktifkan.');
      setDeactivateState({ open: false, penugasanId: null, currentDosenName: '' });
      setDeactivateReason('');
      await loadDetailAndCandidates();
      if (onSuccess) onSuccess();
    } catch (err) {
      const message = kaprodiReviewerKpErrorMessage(err, 'Gagal menonaktifkan reviewer.');
      setError(message);
      toast.error(message);
    } finally {
      setSubmittingDeactivate(false);
    }
  };

  const mahasiswaNama = visibleDetail?.mahasiswa?.nama_lengkap || 'Memuat...';
  const mahasiswaNim = visibleDetail?.mahasiswa?.nim || '-';
  const periode = visibleDetail?.periode_akademik
    ? `${visibleDetail.periode_akademik.tahun_ajaran} (${visibleDetail.periode_akademik.semester})`
    : '';

  // Opsi Dropdown Kandidat untuk Penugasan Baru
  const candidateOptions = candidates.map((c) => ({
    value: String(c.id),
    label: `${c.nama_lengkap} (Beban aktif: ${c.jumlah_penugasan_reviewer_aktif ?? 0})${
      c.sudah_ditugaskan ? ' — Sudah Ditugaskan' : ''
    }`,
    disabled: Boolean(c.sudah_ditugaskan),
  }));

  // Opsi Dropdown Dosen Pengganti (tidak boleh sama dengan dosen yang sedang diganti)
  const replacementOptions = candidates
    .filter((c) => c.id !== replaceState.currentDosenId)
    .map((c) => ({
      value: String(c.id),
      label: `${c.nama_lengkap} (Beban aktif: ${c.jumlah_penugasan_reviewer_aktif ?? 0})${
        c.sudah_ditugaskan ? ' — Sudah Ditugaskan' : ''
      }`,
      disabled: Boolean(c.sudah_ditugaskan),
    }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-assign-reviewer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-[22px] border border-slate-900/10 bg-white shadow-2xl overflow-hidden">
        {/* 1. Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.08] px-5 py-4 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <div className="size-10 rounded-full bg-slate-100 border border-slate-900/10 flex items-center justify-center font-bold text-sm text-slate-700 shrink-0">
                {getInitials(mahasiswaNama)}
              </div>
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="min-w-0">
              <h2
                id="modal-assign-reviewer-title"
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
                  disabled={queueIndex <= 1 || loading}
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
                  disabled={queueIndex >= queueTotal || loading}
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
              onClick={onClose}
              className="size-8 rounded-full border border-slate-900/10 hover:bg-slate-100 flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
              aria-label="Tutup modal"
            >
              <IconClose className="size-4" />
            </button>
          </div>
        </div>

        {/* 2. Modal Body */}
        <div className="p-5 overflow-y-auto [scrollbar-gutter:stable] space-y-5 flex-1 bg-slate-50/40">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-danger"
            >
              <IconExclamationCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {showDetailLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
              <IconSpinner className="size-7 animate-spin text-brand mb-2" />
              <p className="text-xs font-semibold">Memuat rincian pengajuan & kandidat reviewer…</p>
            </div>
          ) : error && !visibleDetail ? null : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Kolom Kiri: Rincian Proposal (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Card Info Pengajuan */}
                <div className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 space-y-3.5 shadow-none">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-900/[0.06] pb-2.5">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                      Informasi Proposal KP
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                        detail?.status_pemeriksaan_berkas === 'OK_LENGKAP'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-blue-50 text-brand border border-blue-200'
                      }`}
                    >
                      {detail?.status_pemeriksaan_berkas === 'OK_LENGKAP' ? 'ACC Admin' : 'Menunggu Admin'}
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] text-muted block mb-0.5">Judul Penelitian</label>
                    <p className="text-xs font-bold text-ink leading-snug">
                      {detail?.versi_topik?.judul_penelitian || 'Judul belum diisi'}
                    </p>
                  </div>

                  {detail?.versi_topik?.objek_penelitian && (
                    <div>
                      <label className="text-[11px] text-muted block mb-0.5">Instansi / Objek</label>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                        <IconMapPin className="size-3.5 text-muted shrink-0" />
                        <span>{detail.versi_topik.objek_penelitian}</span>
                      </div>
                    </div>
                  )}

                  {detail?.topik_penelitian?.tema_penelitian?.nama_tema && (
                    <div>
                      <label className="text-[11px] text-muted block mb-0.5">Tema Penelitian</label>
                      <p className="text-xs text-secondary font-medium">
                        {detail.topik_penelitian.tema_penelitian.nama_tema}
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
                      <span className="text-[10px] text-muted">
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
                    {proposalDoc && (
                      <span className="text-[11px] font-mono text-muted">
                        v{proposalDoc.nomor_versi || 1}
                      </span>
                    )}
                  </div>

                  {proposalDoc?.dokumen ? (
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-900/[0.06] bg-slate-50/70">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <IconDocumentText className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-ink truncate">
                            {proposalDoc.dokumen.nama_file_asli}
                          </p>
                          <p className="text-[10px] text-muted font-mono">
                            {formatBytes(proposalDoc.dokumen.ukuran_bytes)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDownloadProposal}
                        disabled={downloading}
                        className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-900/10 px-2.5 py-1 text-xs font-semibold text-secondary hover:text-ink hover:bg-slate-100 transition-colors shadow-none cursor-pointer shrink-0 disabled:opacity-50"
                        title="Unduh Berkas Proposal PDF"
                      >
                        {downloading ? (
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

              {/* Kolom Kanan: Penugasan Reviewer (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* 1. Reviewer Aktif Saat Ini */}
                <div className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 space-y-3.5 shadow-none">
                  <div className="flex items-center justify-between border-b border-slate-900/[0.06] pb-2.5">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                      Reviewer Aktif Ditugaskan
                    </span>
                    <span className="text-xs font-mono font-bold text-brand">
                      {activeAssignments.length} Reviewer Aktif
                    </span>
                  </div>

                  {activeAssignments.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                      <IconExclamationTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Belum Ada Reviewer</p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Proposal ini belum memiliki dosen penelaah. Pilih dosen reviewer pada form di bawah ini.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {activeAssignments.map((assignment) => {
                        const dosen = assignment.dosen;
                        return (
                          <div
                            key={assignment.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-900/[0.08] bg-white shadow-none"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-8 rounded-full bg-brand/10 text-brand font-bold text-xs flex items-center justify-center shrink-0">
                                {getInitials(dosen?.nama_lengkap)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-ink truncate">
                                  {dosen?.nama_lengkap}
                                </p>
                                <p className="text-[10px] text-muted font-mono">
                                  Kode Dosen: {dosen?.kode_dosen || '-'} • Ditugaskan:{' '}
                                  {formatDateTime(assignment.created_at)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() =>
                                  setReplaceState({
                                    open: true,
                                    penugasanId: assignment.id,
                                    currentDosenName: dosen?.nama_lengkap || 'Reviewer',
                                    currentDosenId: dosen?.id,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-900/10 px-2 py-1 text-xs font-medium text-secondary hover:text-ink hover:bg-slate-50 transition-colors cursor-pointer"
                                title="Ganti reviewer dengan dosen lain"
                              >
                                <IconEdit className="size-3" />
                                <span>Ganti</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setDeactivateState({
                                    open: true,
                                    penugasanId: assignment.id,
                                    currentDosenName: dosen?.nama_lengkap || 'Reviewer',
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 px-2 py-1 text-xs font-medium text-rose-700 transition-colors cursor-pointer"
                                title="Nonaktifkan penugasan reviewer"
                              >
                                <IconTrash className="size-3" />
                                <span>Nonaktifkan</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sub-form Pergantian Reviewer (Inline Drawer) */}
                {replaceState.open && (
                  <form
                    onSubmit={handleReplaceReviewer}
                    className="rounded-[18px] border-2 border-brand/30 bg-blue-50/40 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-brand/20 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-brand">
                        <IconEdit className="size-3.5" />
                        <span>Ganti Reviewer: {replaceState.currentDosenName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setReplaceState({ open: false, penugasanId: null, currentDosenName: '', currentDosenId: null })
                        }
                        className="text-muted hover:text-ink cursor-pointer"
                      >
                        <IconClose className="size-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-secondary mb-1">
                        Pilih Dosen Reviewer Pengganti
                      </label>
                      <CustomSelect
                        value={replacementDosenId}
                        options={replacementOptions}
                        onChange={setReplacementDosenId}
                        placeholder="Pilih dosen pengganti..."
                        searchable={true}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-secondary mb-1">
                        Alasan Pergantian <span className="text-danger">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={replaceReason}
                        onChange={(e) => setReplaceReason(e.target.value)}
                        placeholder="Contoh: Dosen reviewer berhalangan atau sedang cuti akademik…"
                        className="w-full rounded-xl border border-slate-900/[0.12] bg-white p-2.5 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setReplaceState({ open: false, penugasanId: null, currentDosenName: '', currentDosenId: null })
                        }
                        disabled={submittingReplace}
                        className="rounded-lg border border-slate-900/10 bg-white px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-slate-50 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={submittingReplace}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white px-3 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {submittingReplace && <IconSpinner className="size-3 animate-spin text-white" />}
                        <span>Simpan Penggantian</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Sub-form Penonaktifan Reviewer */}
                {deactivateState.open && (
                  <form
                    onSubmit={handleDeactivateReviewer}
                    className="rounded-[18px] border-2 border-rose-300 bg-rose-50/40 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-danger">
                        <IconTrash className="size-3.5" />
                        <span>Nonaktifkan Reviewer: {deactivateState.currentDosenName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDeactivateState({ open: false, penugasanId: null, currentDosenName: '' })
                        }
                        className="text-muted hover:text-ink cursor-pointer"
                      >
                        <IconClose className="size-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-secondary mb-1">
                        Alasan Penonaktifan <span className="text-danger">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={deactivateReason}
                        onChange={(e) => setDeactivateReason(e.target.value)}
                        placeholder="Contoh: Terjadi perubahan topik atau pembatalan penugasan oleh Kaprodi…"
                        className="w-full rounded-xl border border-slate-900/[0.12] bg-white p-2.5 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDeactivateState({ open: false, penugasanId: null, currentDosenName: '' })
                        }
                        disabled={submittingDeactivate}
                        className="rounded-lg border border-slate-900/10 bg-white px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-slate-50 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={submittingDeactivate}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {submittingDeactivate && <IconSpinner className="size-3 animate-spin text-white" />}
                        <span>Nonaktifkan Reviewer</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* 2. Form Tambah / Tetapkan Reviewer Baru */}
                <form
                  onSubmit={handleAssignReviewer}
                  className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 space-y-3.5 shadow-none"
                >
                  <div className="border-b border-slate-900/[0.06] pb-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                      {activeAssignments.length === 0
                        ? 'Tetapkan Reviewer Baru'
                        : 'Tambah Dosen Reviewer Lain'}
                    </span>
                    <p className="text-[11px] text-muted mt-0.5">
                      Pilih dari daftar dosen aktif Program Studi. Beban aktif menunjukkan jumlah proposal yang sedang ditelaah.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-secondary mb-1">
                      Kandidat Dosen Reviewer
                    </label>
                    <CustomSelect
                      value={selectedDosenId}
                      options={candidateOptions}
                      onChange={setSelectedDosenId}
                      placeholder="Pilih dosen reviewer..."
                      searchable={true}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-muted leading-relaxed">
                      *Satu pengajuan dapat memiliki lebih dari satu reviewer aktif.
                    </span>
                    <button
                      type="submit"
                      disabled={!selectedDosenId || submittingAssign}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 self-end sm:self-auto"
                    >
                      {submittingAssign ? (
                        <IconSpinner className="size-3.5 animate-spin text-white shrink-0" />
                      ) : (
                        <IconDocumentSearch className="size-3.5 shrink-0" />
                      )}
                      <span>Tugaskan Reviewer</span>
                    </button>
                  </div>
                </form>

                {/* 3. Riwayat Penugasan (Histori Nonaktif) */}
                {inactiveAssignments.length > 0 && (
                  <div className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 space-y-2.5 shadow-none">
                    <div className="border-b border-slate-900/[0.06] pb-2">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                        Riwayat Penugasan Sebelumnya
                      </span>
                    </div>

                    <div className="space-y-2">
                      {inactiveAssignments.map((histori) => (
                        <div
                          key={histori.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-900/[0.05] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-muted text-[11px]">
                            <span className="font-semibold text-secondary">
                              {histori.dosen?.nama_lengkap}
                            </span>
                            <span className="font-mono">
                              Nonaktif: {formatDateTime(histori.berakhir_at)}
                            </span>
                          </div>
                          {histori.alasan_perubahan && (
                            <p className="text-[11px] text-muted italic">
                              Alasan: &ldquo;{histori.alasan_perubahan}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-900/[0.08] px-5 py-3 bg-white shrink-0">
          <p className="text-xs text-muted">
            {activeAssignments.length > 0 ? (
              <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                <IconCheckCircle className="size-3.5 text-emerald-600" />
                {activeAssignments.length} reviewer aktif terpasang
              </span>
            ) : (
              <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                <IconExclamationTriangle className="size-3.5 text-amber-600" />
                Belum ada reviewer aktif
              </span>
            )}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-900/10 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

