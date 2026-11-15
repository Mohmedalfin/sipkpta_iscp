import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  IconAcademicCap,
  IconArrowDownTray,
  IconArrowLeft,
  IconArrowRight,
  IconBriefcase,
  IconCalendarClock,
  IconCheckCircle,
  IconClipboardCheck,
  IconClose,
  IconDocumentText,
  IconExclamationCircle,
  IconExclamationTriangle,
  IconEye,
  IconInformationCircle,
  IconSpinner,
  IconUser,
} from '../../common/Icons.jsx';
import {
  adminPengajuanKpErrorMessage,
  approveAllAdminKp,
  decideAdminKpApplication,
  downloadAdminKpDocumentFile,
  examineAdminKpCategory,
  fetchAdminKpDetail,
} from '../../../services/adminPengajuanKp.js';
import { useToast } from '../../../context/ToastContext.jsx';

const PdfPreview = lazy(() => import('../../common/PdfPreview.jsx'));

function formatSimpleDate(isoString) {
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
      timeZone: 'Asia/Jakarta',
    }).format(d) + ' WIB';
  } catch {
    return '-';
  }
}

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '-';
  const mb = Number(bytes) / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

/**
 * Modal Workspace Pemeriksaan Pengajuan KP Mahasiswa (Admin Prodi)
 * Desain Minimalis, Terfokus, dan Ergonomis:
 * 1. Informasi Mahasiswa, Judul, Nilai & Berkas terlihat terpadu tanpa tab terpecah-pecah.
 * 2. Pratinjau PDF langsung tampil saat memilih dokumen.
 * 3. Tiga aksi utama yang jelas di footer: "Setujui (ACC)", "Minta Perbaikan", atau "Tolak".
 * 
 * @param {object} props
 * @param {boolean} props.open - Status modal buka/tutup
 * @param {number|string|null} props.pengajuanId - ID pengajuan yang diperiksa
 * @param {Function} props.onClose - Handler menutup modal
 * @param {Function} props.onStatusUpdated - Callback setelah perubahan status/keputusan berhasil
 * @param {number} [props.queueIndex] - Indeks antrean mahasiswa saat ini (0-based)
 * @param {number} [props.queueTotal] - Total antrean mahasiswa di tabel
 * @param {Function} [props.onPrevStudent] - Navigasi ke pengajuan sebelumnya
 * @param {Function} [props.onNextStudent] - Navigasi ke pengajuan berikutnya
 */
export default function KpAdminWorkspaceModal({
  open,
  pengajuanId,
  onClose,
  onStatusUpdated,
  queueIndex = 0,
  queueTotal = 0,
  onPrevStudent,
  onNextStudent,
}) {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const detailRequestIdRef = useRef(0);
  const previewRequestIdRef = useRef(0);
  const previewUrlRef = useRef(null);

  // Berkas yang sedang aktif dipratinjau di sisi kanan
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [previewState, setPreviewState] = useState({
    url: null,
    title: '',
    loading: false,
    error: '',
  });

  // State Dialog Aksi Utama (ACC, Minta Perbaikan, Tolak)
  const [actionDialog, setActionDialog] = useState({
    open: false,
    mode: 'ACC', // 'ACC' | 'REVISI' | 'TOLAK'
    revisiBerkas: true,
    revisiNilai: false,
    catatan: '',
    error: '',
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Tab switch khusus layar mobile: 'workspace' | 'preview'
  const [mobilePane, setMobilePane] = useState('workspace');

  // Toggle riwayat audit timeline di sisi kiri
  const [showHistory, setShowHistory] = useState(false);

  /**
   * Mengambil detail pengajuan terbaru dari backend
   */
  const loadDetailData = async () => {
    if (!pengajuanId) return;
    const requestId = ++detailRequestIdRef.current;
    previewRequestIdRef.current += 1;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setLoading(true);
    setError('');
    setDetail(null);
    setSelectedDocId(null);
    setPreviewState({ url: null, title: '', loading: false, error: '' });

    try {
      const data = await fetchAdminKpDetail(pengajuanId);
      if (requestId !== detailRequestIdRef.current) return;
      if (data?.id == null || String(data.id) !== String(pengajuanId)) {
        setError('Detail pengajuan tidak tersedia. Coba lagi.');
        return;
      }
      setDetail(data);

      // Otomatis pilih berkas pertama (biasanya proposal) jika belum ada yang dipilih
      const firstDoc = data.dokumen_pengajuan?.[0];
      if (firstDoc) {
        setSelectedDocId(firstDoc.id);
        loadPdfPreview(
          data.id,
          firstDoc.id,
          firstDoc.persyaratan_pengajuan?.jenis_dokumen?.nama_jenis || 'Pratinjau Dokumen'
        );
      }
    } catch (err) {
      if (requestId !== detailRequestIdRef.current) return;
      const msg = adminPengajuanKpErrorMessage(err, 'Gagal memuat detail pengajuan KP.');
      setError(msg);
      toast.error(msg);
    } finally {
      if (requestId === detailRequestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (open && pengajuanId) {
      loadDetailData();
    } else {
      detailRequestIdRef.current += 1;
      previewRequestIdRef.current += 1;
      setDetail(null);
      setLoading(true);
      setError('');
      setSelectedDocId(null);
      setShowHistory(false);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewState({ url: null, title: '', loading: false, error: '' });
    }
    return () => {
      detailRequestIdRef.current += 1;
      previewRequestIdRef.current += 1;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pengajuanId]);

  /**
   * Memuat pratinjau file PDF secara privat
   */
  const loadPdfPreview = async (appId, docId, title) => {
    const requestId = ++previewRequestIdRef.current;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setPreviewState({
      url: null,
      title,
      loading: true,
      error: '',
    });

    try {
      const blob = await downloadAdminKpDocumentFile(appId, docId);
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(pdfBlob);
      if (requestId !== previewRequestIdRef.current) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      previewUrlRef.current = objectUrl;
      setPreviewState({
        url: objectUrl,
        title,
        loading: false,
        error: '',
      });
    } catch (err) {
      if (requestId !== previewRequestIdRef.current) return;
      const msg = adminPengajuanKpErrorMessage(err, 'Gagal memuat berkas PDF.');
      setPreviewState({
        url: null,
        title,
        loading: false,
        error: msg,
      });
    }
  };

  /**
   * Handler memilih dokumen untuk dipratinjau
   */
  const handleSelectDocument = (doc) => {
    setSelectedDocId(doc.id);
    setMobilePane('preview');
    loadPdfPreview(
      detail.id,
      doc.id,
      doc.persyaratan_pengajuan?.jenis_dokumen?.nama_jenis || doc.dokumen?.nama_file_asli || 'Dokumen'
    );
  };

  /**
   * Handler mengunduh berkas PDF
   */
  const handleDownloadDoc = async (doc) => {
    if (!detail?.id || !doc?.id) return;
    try {
      const title = doc.persyaratan_pengajuan?.jenis_dokumen?.nama_jenis || 'Dokumen_KP';
      toast.info(`Mengunduh berkas ${title}...`);
      const blob = await downloadAdminKpDocumentFile(detail.id, doc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.dokumen?.nama_file_asli || `${title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      toast.error(adminPengajuanKpErrorMessage(err, 'Gagal mengunduh berkas.'));
    }
  };

  /**
   * Handler submit keputusan dari actionDialog
   */
  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (!detail?.id || !detail?.snapshot) return;

    const { mode, revisiBerkas, revisiNilai, catatan } = actionDialog;

    // 1. Eksekusi ACC Pengajuan (Satu Klik Atomik)
    if (mode === 'ACC') {
      setActionLoading(true);
      try {
        await approveAllAdminKp(detail.id, {
          expected_snapshot: detail.snapshot,
        });
        toast.success('Pengajuan KP berhasil disetujui (ACC Administratif) dan diteruskan ke Kaprodi!');
        setActionDialog((prev) => ({ ...prev, open: false }));
        await loadDetailData();
        if (typeof onStatusUpdated === 'function') onStatusUpdated();
      } catch (err) {
        const msg = adminPengajuanKpErrorMessage(err, 'Gagal menyetujui pengajuan KP.');
        toast.error(msg);
        if (err?.response?.data?.error?.code === 'STALE_SNAPSHOT') {
          await loadDetailData();
        }
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // 2. Eksekusi Minta Perbaikan (Revisi Berkas dan/atau Nilai)
    if (mode === 'REVISI') {
      if (!revisiBerkas && !revisiNilai) {
        setActionDialog((prev) => ({
          ...prev,
          error: 'Pilih minimal satu kategori yang perlu diperbaiki (Berkas atau Nilai).',
        }));
        return;
      }
      if (!catatan.trim()) {
        setActionDialog((prev) => ({
          ...prev,
          error: 'Catatan instruksi perbaikan untuk mahasiswa wajib diisi.',
        }));
        return;
      }

      setActionLoading(true);
      try {
        let currentSnapshot = detail.snapshot;

        // Tandai Berkas jika dipilih
        if (revisiBerkas) {
          const resBerkas = await examineAdminKpCategory(detail.id, {
            category: 'BERKAS',
            status: 'BELUM_OK',
            catatan: catatan.trim(),
            expected_snapshot: currentSnapshot,
          });
          // Update snapshot untuk request berurutan
          if (resBerkas?.snapshot) currentSnapshot = resBerkas.snapshot;
        }

        // Tandai Nilai jika dipilih
        if (revisiNilai) {
          // Ambil detail terbaru untuk snapshot kedua jika berkas baru saja diupdate
          const refreshed = await fetchAdminKpDetail(detail.id);
          await examineAdminKpCategory(detail.id, {
            category: 'NILAI',
            status: 'BELUM_OK',
            catatan: catatan.trim(),
            expected_snapshot: refreshed.snapshot,
          });
        }

        toast.success('Permintaan perbaikan berhasil dikirim ke mahasiswa!');
        setActionDialog((prev) => ({ ...prev, open: false, catatan: '', error: '' }));
        await loadDetailData();
        if (typeof onStatusUpdated === 'function') onStatusUpdated();
      } catch (err) {
        const msg = adminPengajuanKpErrorMessage(err, 'Gagal mengirim permintaan perbaikan.');
        toast.error(msg);
        if (err?.response?.data?.error?.code === 'STALE_SNAPSHOT') {
          await loadDetailData();
        }
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // 3. Eksekusi Penolakan Administratif
    if (mode === 'TOLAK') {
      if (!catatan.trim()) {
        setActionDialog((prev) => ({
          ...prev,
          error: 'Alasan penolakan administratif wajib diisi.',
        }));
        return;
      }

      setActionLoading(true);
      try {
        await decideAdminKpApplication(detail.id, {
          status: 'TIDAK_ACC',
          catatan: catatan.trim(),
          expected_snapshot: detail.snapshot,
        });
        toast.success('Pengajuan KP telah ditolak secara administratif.');
        setActionDialog((prev) => ({ ...prev, open: false, catatan: '', error: '' }));
        await loadDetailData();
        if (typeof onStatusUpdated === 'function') onStatusUpdated();
      } catch (err) {
        const msg = adminPengajuanKpErrorMessage(err, 'Gagal menolak pengajuan.');
        toast.error(msg);
        if (err?.response?.data?.error?.code === 'STALE_SNAPSHOT') {
          await loadDetailData();
        }
      } finally {
        setActionLoading(false);
      }
    }
  };

  if (!open) return null;

  const visibleDetail = detail?.id != null && String(detail.id) === String(pengajuanId) ? detail : null;
  const showDetailLoading = loading || (!error && !visibleDetail);
  const isSubmittedState = !showDetailLoading && !error && visibleDetail?.status_pengajuan === 'DIAJUKAN';
  const isDataDiriVerified = !showDetailLoading && !error && visibleDetail?.mahasiswa?.verifikasi_data_diri?.status_verifikasi === 'TERVERIFIKASI';
  const isBerkasOk = visibleDetail?.status_pemeriksaan_berkas === 'OK_LENGKAP';
  const isNilaiOk = visibleDetail?.status_pemeriksaan_akademik === 'OK_LENGKAP';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-workspace-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-950/50 backdrop-blur-xs animate-modal-in"
    >
      {/* Backdrop */}
      <div
        onClick={!actionLoading ? onClose : undefined}
        className="fixed inset-0"
        aria-hidden="true"
      />

      {/* Main Modal Container */}
      <div className="relative w-full max-w-7xl h-[94vh] sm:h-[92vh] max-h-[920px] rounded-[20px] sm:rounded-[24px] border border-slate-900/[0.12] bg-canvas flex flex-col overflow-hidden shadow-2xl text-ink">
        {/* ============================================================ */}
        {/* 1. Modal Top Header (Konsisten dengan Verifikasi Data Diri)  */}
        {/* ============================================================ */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 bg-white/75 backdrop-blur-sm border-b border-slate-900/[0.06] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* Student Avatar & Basic Info */}
            <div className="relative shrink-0">
              <div className="size-9 sm:size-10 rounded-full bg-white/80 border border-slate-900/[0.08] flex items-center justify-center text-slate-800 font-bold text-xs tracking-tight">
                {visibleDetail?.mahasiswa?.nama_lengkap
                  ? visibleDetail.mahasiswa.nama_lengkap
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'M'}
              </div>
              <span
                className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                title="Status Mahasiswa Aktif"
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2 id="modal-workspace-title" className="text-xs sm:text-base font-bold text-ink truncate leading-snug">
                {visibleDetail?.mahasiswa?.nama_lengkap || 'Memuat data mahasiswa…'}
              </h2>
              <p className="text-[11px] sm:text-xs text-muted truncate mt-0.5">
                NIM: <span className="font-mono font-semibold text-secondary">{visibleDetail?.mahasiswa?.nim || '-'}</span>
                <span> • {visibleDetail?.mahasiswa?.program_studi?.nama_prodi || 'Sistem Informasi'}</span>
              </p>
            </div>
          </div>

          {/* Queue Navigation & Close Button (Pinned at far right) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {queueTotal > 1 && (
              <div className="inline-flex items-center rounded-full border border-slate-900/[0.08] bg-white/80 p-0.5 shadow-none">
                <button
                  type="button"
                  onClick={onPrevStudent}
                  disabled={queueIndex <= 0 || loading || actionLoading}
                  className="size-6 sm:size-7 rounded-full flex items-center justify-center text-slate-500 hover:text-ink hover:bg-slate-100 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Pengajuan sebelumnya"
                  aria-label="Pengajuan sebelumnya"
                >
                  <IconArrowLeft className="size-3 sm:size-3.5" />
                </button>
                <span className="px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-mono font-semibold text-slate-600 select-none">
                  {queueIndex + 1} / {queueTotal}
                </span>
                <button
                  type="button"
                  onClick={onNextStudent}
                  disabled={queueIndex >= queueTotal - 1 || loading || actionLoading}
                  className="size-6 sm:size-7 rounded-full flex items-center justify-center text-slate-500 hover:text-ink hover:bg-slate-100 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Pengajuan berikutnya"
                  aria-label="Pengajuan berikutnya"
                >
                  <IconArrowRight className="size-3 sm:size-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={actionLoading}
              className="size-8 rounded-full border border-slate-900/[0.08] bg-white/80 hover:bg-white flex items-center justify-center text-slate-400 hover:text-ink transition-colors cursor-pointer shadow-none shrink-0"
              aria-label="Tutup pemeriksaan"
            >
              <IconClose className="size-4" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden border-b border-line bg-white px-4 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setMobilePane('workspace')}
            className={`flex-1 py-2.5 font-bold text-center border-b-2 transition ${
              mobilePane === 'workspace'
                ? 'border-brand text-brand'
                : 'border-transparent text-secondary'
            }`}
          >
            Data & Berkas
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('preview')}
            className={`flex-1 py-2.5 font-bold text-center border-b-2 transition ${
              mobilePane === 'preview'
                ? 'border-brand text-brand'
                : 'border-transparent text-secondary'
            }`}
          >
            Pratinjau PDF {previewState.title ? `(${previewState.title})` : ''}
          </button>
        </div>

        {/* ============================================================ */}
        {/* 2. Main Workspace Area (2 Columns)                           */}
        {/* ============================================================ */}
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">
          {showDetailLoading ? (
            <div className="grid flex-1 place-items-center p-8">
              <div className="flex flex-col items-center gap-2 text-secondary text-xs">
                <IconSpinner className="size-8 text-brand animate-spin" />
                <span>Memuat data pengajuan dan berkas KP...</span>
              </div>
            </div>
          ) : error ? (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div className="max-w-md space-y-2">
                <IconExclamationCircle className="mx-auto size-10 text-danger" />
                <h3 className="text-sm font-bold text-ink">Gagal Membuka Pengajuan</h3>
                <p className="text-xs text-secondary">{error}</p>
                <button
                  type="button"
                  onClick={loadDetailData}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-brand-hover"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ------------------------------------------------------------ */}
              {/* LEFT COLUMN: Single Unified, Focused Overview & File List    */}
              {/* ------------------------------------------------------------ */}
              <div
                className={`flex-1 lg:flex-none min-h-0 h-full w-full lg:w-[48%] xl:w-[44%] lg:border-r border-line bg-white overflow-y-auto p-4 sm:p-5 space-y-4 shrink-0 ${
                  mobilePane === 'preview' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* 1. KARTU USULAN KP & IDENTITAS MITRA */}
                <div className="rounded-xl border border-line bg-subtle/20 p-4 space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-brand">
                        Tema: {detail.topik_penelitian?.tema_penelitian?.nama_tema || '-'}
                      </span>
                      <span className="text-[11px] text-muted">
                        Periode: {detail.periode_akademik?.tahun_ajaran} ({detail.periode_akademik?.semester})
                      </span>
                    </div>

                    <h3 className="mt-2 text-sm font-bold text-ink leading-snug">
                      {detail.versi_topik?.judul_penelitian || '(Judul belum diset)'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/60 text-xs">
                    <div>
                      <span className="text-[11px] text-muted block">Instansi & Lokasi:</span>
                      <span className="font-semibold text-ink">
                        {detail.versi_topik?.objek_penelitian || '-'}
                      </span>
                      <span className="text-secondary block text-[11px]">
                        {detail.versi_topik?.lokasi_penelitian || '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted block">Usulan Dosen Pembimbing:</span>
                      <span className="font-semibold text-ink">
                        {detail.usulan_pembimbing?.nama_lengkap || '-'}
                      </span>
                      {detail.usulan_pembimbing?.kode_dosen && (
                        <span className="text-secondary block font-mono text-[11px]">
                          Kode: {detail.usulan_pembimbing.kode_dosen}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. RINGKASAN KELAYAKAN DATA AKADEMIK (Compact Horizontal Strip) */}
                <div className="rounded-xl border border-line bg-white p-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-line/60">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <IconAcademicCap className="size-4 text-brand" />
                      Kelayakan Akademik
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold border ${
                        isNilaiOk
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : detail.status_pemeriksaan_akademik === 'BELUM_OK'
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : 'border-line bg-subtle text-secondary'
                      }`}
                    >
                      {detail.status_pemeriksaan_akademik === 'OK_LENGKAP'
                        ? 'Nilai OK Lengkap'
                        : detail.status_pemeriksaan_akademik === 'BELUM_OK'
                        ? 'Perlu Revisi Nilai'
                        : 'Belum Diperiksa'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2.5 sm:grid-cols-4 text-xs">
                    <div>
                      <span className="text-[11px] text-muted block">IPK Terakhir</span>
                      <span className="text-sm font-extrabold text-ink">
                        {detail.ipk_saat_pengajuan !== null ? Number(detail.ipk_saat_pengajuan).toFixed(2) : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted block">SKS Lulus</span>
                      <span className="text-sm font-extrabold text-ink">
                        {detail.jumlah_sks_saat_pengajuan ?? '-'} <span className="text-[10px] font-normal text-muted">SKS</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted block">Nilai D/E</span>
                      <span className="font-semibold text-ink text-xs">
                        {detail.memiliki_nilai_de ? (
                          <span className="text-amber-800 font-bold">Ada Nilai D/E</span>
                        ) : (
                          <span className="text-emerald-700">Tidak Ada</span>
                        )}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted block">SPP Variabel</span>
                      <span className="font-semibold text-ink text-xs">
                        {detail.sudah_bayar_spp_variabel ? 'Ya, Bayar' : 'Tidak'}
                      </span>
                    </div>
                  </div>

                  {detail.memiliki_nilai_de && detail.daftar_mk_nilai_de && (
                    <div className="mt-2 rounded-lg bg-amber-50/60 border border-amber-200/60 p-2 text-[11px] text-amber-900">
                      <strong>Mata Kuliah D/E:</strong> {detail.daftar_mk_nilai_de}
                    </div>
                  )}

                  {detail.catatan_pemeriksaan_akademik && (
                    <div className="mt-2 rounded-lg bg-subtle p-2 text-[11px] text-secondary italic">
                      Catatan Nilai: "{detail.catatan_pemeriksaan_akademik}"
                    </div>
                  )}
                </div>

                {/* 3. DAFTAR BERKAS PERSYARATAN KP (Interaktif: Klik langsung buka PDF) */}
                <div className="rounded-xl border border-line bg-white p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-line/60">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <IconDocumentText className="size-4 text-brand" />
                      Berkas Persyaratan KP ({detail.dokumen_pengajuan?.length || 0})
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold border ${
                        isBerkasOk
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : detail.status_pemeriksaan_berkas === 'BELUM_OK'
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : 'border-line bg-subtle text-secondary'
                      }`}
                    >
                      {detail.status_pemeriksaan_berkas === 'OK_LENGKAP'
                        ? 'Berkas OK Lengkap'
                        : detail.status_pemeriksaan_berkas === 'BELUM_OK'
                        ? 'Perlu Revisi Berkas'
                        : 'Belum Diperiksa'}
                    </span>
                  </div>

                  <p className="text-[11px] text-secondary">
                    Klik berkas di bawah untuk langsung membuka pratinjau PDF di panel kanan:
                  </p>

                  <div className="space-y-2">
                    {detail.dokumen_pengajuan?.map((doc) => {
                      const isSelected = selectedDocId === doc.id;
                      const namaJenis = doc.persyaratan_pengajuan?.jenis_dokumen?.nama_jenis || 'Dokumen Persyaratan';

                      return (
                        <div
                          key={doc.id}
                          onClick={() => handleSelectDocument(doc)}
                          className={`cursor-pointer rounded-lg border p-3 transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-brand bg-blue-50/30 ring-1 ring-brand/30 shadow-2xs'
                              : 'border-line bg-white hover:border-slate-300 hover:bg-subtle/20'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <IconDocumentText
                                className={`size-4 shrink-0 ${isSelected ? 'text-brand' : 'text-muted'}`}
                              />
                              <h4 className="text-xs font-bold text-ink truncate">
                                {namaJenis}
                              </h4>
                              <span className="rounded bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-secondary shrink-0">
                                v{doc.nomor_versi || 1}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted truncate">
                              <span className="truncate">{doc.dokumen?.nama_file_asli || '-'}</span>
                              <span>•</span>
                              <span>{formatBytes(doc.dokumen?.ukuran_bytes)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleSelectDocument(doc)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold shadow-2xs focus:outline-hidden ${
                                isSelected
                                  ? 'bg-brand text-white'
                                  : 'border border-line bg-white text-secondary hover:bg-subtle'
                              }`}
                            >
                              Lihat
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadDoc(doc)}
                              className="rounded-lg border border-line bg-white p-1 text-secondary shadow-2xs hover:bg-subtle"
                              title="Unduh berkas PDF"
                            >
                              <IconArrowDownTray className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {detail.catatan_pemeriksaan_berkas && (
                    <div className="mt-2 rounded-lg bg-subtle p-2 text-[11px] text-secondary italic">
                      Catatan Berkas: "{detail.catatan_pemeriksaan_berkas}"
                    </div>
                  )}
                </div>

                {/* 4. PRASYARAT DATA DIRI & RIWAYAT PERUBAHAN */}
                <div className="rounded-xl border border-line bg-subtle/20 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Prasyarat Dokumen Data Diri:</span>
                    {isDataDiriVerified ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                        <IconCheckCircle className="size-3 text-emerald-600" />
                        Terverifikasi (6/6 Dokumen Sah)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 border border-amber-200">
                        <IconExclamationTriangle className="size-3 text-amber-600" />
                        Belum Terverifikasi
                      </span>
                    )}
                  </div>

                  {/* Riwayat Timeline Toggle */}
                  <div className="pt-2 border-t border-line/60">
                    <button
                      type="button"
                      onClick={() => setShowHistory(!showHistory)}
                      className="text-xs text-brand hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>{showHistory ? 'Sembunyikan Riwayat Status' : 'Lihat Riwayat Perubahan Status'}</span>
                      <span className="text-[10px] text-muted">({detail.riwayat_status?.length || 0})</span>
                    </button>

                    {showHistory && (
                      <div className="mt-3 space-y-2 text-xs">
                        {detail.riwayat_status?.length === 0 ? (
                          <p className="text-muted italic">Belum ada riwayat tercatat.</p>
                        ) : (
                          <div className="space-y-2 border-l border-line pl-3 ml-1">
                            {detail.riwayat_status?.map((item) => (
                              <div key={item.id} className="relative">
                                <span className="absolute -left-4.5 mt-1 size-2.5 rounded-full border border-white bg-brand" />
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className="font-bold text-ink">{item.jenis_status}:</span>
                                  <span>{item.status_sebelum || 'AWAL'} → {item.status_sesudah}</span>
                                  <span className="text-muted">({formatSimpleDate(item.created_at)})</span>
                                </div>
                                {item.catatan && (
                                  <p className="text-secondary italic text-[11px] bg-white p-1.5 rounded border border-line/60 mt-0.5">
                                    "{item.catatan}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* RIGHT COLUMN: Interactive Full-Height PDF Viewer             */}
              {/* ------------------------------------------------------------ */}
              <div
                className={`flex-1 min-h-0 h-full bg-canvas flex flex-col overflow-hidden ${
                  mobilePane === 'workspace' ? 'hidden lg:flex' : 'flex'
                }`}
              >
                {/* Header Viewer */}
                <div className="flex items-center justify-between border-b border-line bg-white px-4 py-2 text-xs shrink-0">
                  <div className="flex items-center gap-2 truncate">
                    <IconDocumentText className="size-4 text-brand shrink-0" />
                    <span className="font-bold text-ink truncate">
                      {previewState.title || 'Pratinjau Dokumen'}
                    </span>
                  </div>

                  {previewState.url && (
                    <button
                      type="button"
                      onClick={() => {
                        const activeDoc = detail?.dokumen_pengajuan?.find((d) => d.id === selectedDocId);
                        if (activeDoc) handleDownloadDoc(activeDoc);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-secondary hover:bg-subtle"
                    >
                      <IconArrowDownTray className="size-3" />
                      Unduh Berkas
                    </button>
                  )}
                </div>

                {/* Content Viewer */}
                <div className="relative flex-1 overflow-hidden p-3 sm:p-4">
                  {previewState.loading ? (
                    <div className="grid h-full place-items-center">
                      <div className="flex flex-col items-center gap-2 text-secondary text-xs">
                        <IconSpinner className="size-6 text-brand animate-spin" />
                        <span>Memuat berkas PDF...</span>
                      </div>
                    </div>
                  ) : previewState.error ? (
                    <div className="grid h-full place-items-center p-6 text-center">
                      <div className="max-w-md space-y-2">
                        <IconExclamationCircle className="mx-auto size-8 text-danger" />
                        <p className="text-xs font-semibold text-ink">Gagal Membuka Berkas</p>
                        <p className="text-[11px] text-muted">{previewState.error}</p>
                      </div>
                    </div>
                  ) : previewState.url ? (
                    <Suspense
                      fallback={
                        <div className="grid h-full place-items-center">
                          <IconSpinner className="size-6 text-brand" />
                        </div>
                      }
                    >
                      <PdfPreview url={previewState.url} title={previewState.title} />
                    </Suspense>
                  ) : (
                    <div className="grid h-full place-items-center text-muted text-xs">
                      Pilih salah satu berkas dari panel sebelah kiri untuk melihat isi dokumen.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ============================================================ */}
        {/* 3. Modal Footer: TIGA AKSI UTAMA YANG JELAS & INTUITIF      */}
        {/* ============================================================ */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-5 py-3.5 shrink-0">
          {/* Sisi Kiri: Status Kesiapan Singkat */}
          <div className="flex items-center gap-2 text-xs">
            {!isDataDiriVerified && (
              <span className="inline-flex items-center gap-1 text-amber-800 text-[11px] bg-amber-50 px-2 py-1 rounded border border-amber-200">
                <IconInformationCircle className="size-3.5 shrink-0" />
                Data Diri wajib TERVERIFIKASI untuk menyetujui pengajuan
              </span>
            )}
            {isDataDiriVerified && isSubmittedState && (
              <span className="text-muted text-[11px]">
                Periksa berkas & data akademik, lalu tentukan tindakan di sebelah kanan:
              </span>
            )}
          </div>

          {/* Sisi Kanan: 3 Tombol Utama Saja */}
          <div className="flex items-center gap-2">
            {isSubmittedState ? (
              <>
                {/* 1. Tombol Utama: Setujui (ACC Pengajuan) */}
                <button
                  type="button"
                  disabled={actionLoading || !isDataDiriVerified}
                  onClick={() =>
                    setActionDialog({
                      open: true,
                      mode: 'ACC',
                      revisiBerkas: false,
                      revisiNilai: false,
                      catatan: '',
                      error: '',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 focus:outline-hidden disabled:opacity-40"
                  title={
                    !isDataDiriVerified
                      ? 'Data Diri mahasiswa belum terverifikasi'
                      : 'Sahkan persyaratan dan teruskan pengajuan ke Kaprodi'
                  }
                >
                  <IconCheckCircle className="size-4" />
                  Setujui (ACC Pengajuan)
                </button>

                {/* 2. Tombol Minta Perbaikan (Revisi) */}
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    setActionDialog({
                      open: true,
                      mode: 'REVISI',
                      revisiBerkas: true,
                      revisiNilai: false,
                      catatan: '',
                      error: '',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50/80 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-100 focus:outline-hidden disabled:opacity-50"
                >
                  <IconExclamationTriangle className="size-3.5 text-amber-700" />
                  Minta Perbaikan
                </button>

                {/* 3. Tombol Tolak Administratif */}
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    setActionDialog({
                      open: true,
                      mode: 'TOLAK',
                      revisiBerkas: false,
                      revisiNilai: false,
                      catatan: '',
                      error: '',
                    })
                  }
                  className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-danger hover:bg-rose-50 hover:border-rose-300 focus:outline-hidden disabled:opacity-50"
                >
                  Tolak
                </button>
              </>
            ) : null}

            {/* Tombol Tutup */}
            <button
              type="button"
              disabled={actionLoading}
              onClick={onClose}
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-semibold text-secondary shadow-2xs hover:bg-subtle focus:outline-hidden"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* DIALOG TINDAKAN SEDERHANA (ACC / REVISI / TOLAK)             */}
      {/* ============================================================ */}
      {actionDialog.open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4"
        >
          <div
            onClick={() => !actionLoading && setActionDialog((prev) => ({ ...prev, open: false }))}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          <div className="relative w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl">
            {/* Header Dialog */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                {actionDialog.mode === 'ACC' && (
                  <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <IconCheckCircle className="size-5" />
                  </span>
                )}
                {actionDialog.mode === 'REVISI' && (
                  <span className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                    <IconExclamationTriangle className="size-5" />
                  </span>
                )}
                {actionDialog.mode === 'TOLAK' && (
                  <span className="flex size-9 items-center justify-center rounded-lg bg-rose-100 text-danger border border-rose-200">
                    <IconExclamationCircle className="size-5" />
                  </span>
                )}

                <div>
                  <h3 className="text-sm font-bold text-ink">
                    {actionDialog.mode === 'ACC' && 'Setujui Pengajuan KP'}
                    {actionDialog.mode === 'REVISI' && 'Minta Perbaikan Mahasiswa'}
                    {actionDialog.mode === 'TOLAK' && 'Tolak Pengajuan KP'}
                  </h3>
                  <p className="text-[11px] text-muted">
                    Mahasiswa: {detail?.mahasiswa?.nama_lengkap} ({detail?.mahasiswa?.nim})
                  </p>
                </div>
              </div>

              {!actionLoading && (
                <button
                  type="button"
                  onClick={() => setActionDialog((prev) => ({ ...prev, open: false }))}
                  className="rounded p-1 text-muted hover:bg-subtle"
                >
                  <IconClose className="size-4" />
                </button>
              )}
            </div>

            {/* Form Konten Dialog */}
            <form onSubmit={handleExecuteAction} className="mt-4 space-y-3.5">
              {/* OPSI ACC */}
              {actionDialog.mode === 'ACC' && (
                <p className="text-xs text-secondary leading-relaxed bg-subtle/50 p-3 rounded-lg border border-line/60">
                  Saya telah memeriksa berkas dan data kelayakan akademik mahasiswa ini. Pengajuan akan disetujui (ACC Administratif) dan diteruskan ke Ketua Program Studi untuk penugasan Dosen Reviewer & Pembimbing.
                </p>
              )}

              {/* OPSI REVISI */}
              {actionDialog.mode === 'REVISI' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-ink block mb-1.5">
                      Pilih Bagian yang Perlu Diperbaiki:
                    </label>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={actionDialog.revisiBerkas}
                          onChange={(e) =>
                            setActionDialog((prev) => ({
                              ...prev,
                              revisiBerkas: e.target.checked,
                              error: '',
                            }))
                          }
                          className="size-4 rounded text-brand focus:ring-brand"
                        />
                        <span className="font-medium text-ink">Berkas Persyaratan</span>
                      </label>

                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={actionDialog.revisiNilai}
                          onChange={(e) =>
                            setActionDialog((prev) => ({
                              ...prev,
                              revisiNilai: e.target.checked,
                              error: '',
                            }))
                          }
                          className="size-4 rounded text-brand focus:ring-brand"
                        />
                        <span className="font-medium text-ink">Data Akademik / Nilai</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink block mb-1">
                      Instruksi Perbaikan <span className="text-danger">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={actionDialog.catatan}
                      onChange={(e) =>
                        setActionDialog((prev) => ({
                          ...prev,
                          catatan: e.target.value,
                          error: '',
                        }))
                      }
                      placeholder="Contoh: Lampiran bukti pembayaran tidak terbaca, silakan unggah ulang scan bukti transfer resmi..."
                      className="w-full rounded-lg border border-line p-2.5 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </>
              )}

              {/* OPSI TOLAK */}
              {actionDialog.mode === 'TOLAK' && (
                <>
                  <p className="text-xs text-secondary leading-relaxed bg-rose-50/50 p-2.5 rounded-lg border border-rose-200/60 text-danger">
                    Tindakan ini bersifat final. Pengajuan Kerja Praktik mahasiswa akan ditolak secara administratif.
                  </p>
                  <div>
                    <label className="text-xs font-semibold text-ink block mb-1">
                      Alasan Penolakan <span className="text-danger">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={actionDialog.catatan}
                      onChange={(e) =>
                        setActionDialog((prev) => ({
                          ...prev,
                          catatan: e.target.value,
                          error: '',
                        }))
                      }
                      placeholder="Sebutkan alasan objektif penolakan pengajuan..."
                      className="w-full rounded-lg border border-line p-2.5 text-xs text-ink placeholder:text-muted focus:border-danger focus:outline-hidden focus:ring-1 focus:ring-danger"
                    />
                  </div>
                </>
              )}

              {actionDialog.error && (
                <p className="text-[11px] font-semibold text-danger">
                  {actionDialog.error}
                </p>
              )}

              {/* Tombol Dialog */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line/60">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setActionDialog((prev) => ({ ...prev, open: false }))}
                  className="rounded-lg border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-secondary hover:bg-subtle"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-2xs focus:outline-hidden disabled:opacity-50 ${
                    actionDialog.mode === 'ACC'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : actionDialog.mode === 'REVISI'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-danger hover:bg-rose-700'
                  }`}
                >
                  {actionLoading && <IconSpinner className="size-3.5 animate-spin" />}
                  {actionDialog.mode === 'ACC' && 'Ya, Setujui (ACC)'}
                  {actionDialog.mode === 'REVISI' && 'Kirim Permintaan'}
                  {actionDialog.mode === 'TOLAK' && 'Tolak Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
