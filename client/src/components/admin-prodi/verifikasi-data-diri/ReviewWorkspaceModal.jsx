import { useEffect, useRef, useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheckCircle,
  IconClose,
  IconExclamationCircle,
  IconInformationCircle,
  IconSpinner,
} from '../../common/Icons.jsx';
import ConfirmDialog from '../../common/ConfirmDialog.jsx';
import DocumentChecklistItem from './DocumentChecklistItem.jsx';
import RevisionNoteModal from './RevisionNoteModal.jsx';
import StudentAcademicCard from './StudentAcademicCard.jsx';
import WorkspacePdfViewer from './WorkspacePdfViewer.jsx';
import {
  adminDataDiriErrorMessage,
  fetchAdminDataDiriDetail,
  fetchAdminDataDiriDocumentFile,
  verifyAdminDataDiriDocument,
  verifyAllAdminDataDiri,
} from '../../../services/adminDataDiri.js';
import { useToast } from '../../../context/ToastContext.jsx';
import { useFocusTrap } from '../../../hooks/useFocusTrap.js';

function formatFileSize(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '-';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function ReviewWorkspaceModal({
  open,
  studentId,
  onClose,
  onStatusUpdated,
  queueIndex = 0,
  queueTotal = 0,
  onPrevStudent,
  onNextStudent,
}) {
  const toast = useToast();
  const modalRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  // Active document selected for preview
  const [selectedDocCode, setSelectedDocCode] = useState(null);
  const [previewState, setPreviewState] = useState({
    loading: false,
    url: null,
    error: '',
    fileName: '',
  });

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [targetRevisionDoc, setTargetRevisionDoc] = useState(null);
  const [confirmVerifyAllOpen, setConfirmVerifyAllOpen] = useState(false);

  // Tab switch for mobile view: 'docs' | 'preview'
  const [mobileTab, setMobileTab] = useState('docs');

  useFocusTrap(modalRef, open, onClose);

  // Fetch student detail when studentId changes
  useEffect(() => {
    if (!open || !studentId) {
      setDetail(null);
      setLoading(true);
      setSelectedDocCode(null);
      setPreviewState({ loading: false, url: null, error: '', fileName: '' });
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    setDetail(null);
    setSelectedDocCode(null);

    // Clean up preview URL
    if (previewState.url) {
      URL.revokeObjectURL(previewState.url);
      setPreviewState({ loading: false, url: null, error: '', fileName: '' });
    }

    fetchAdminDataDiriDetail(studentId)
      .then((data) => {
        if (!active) return;
        if (data?.mahasiswa?.id == null || String(data.mahasiswa.id) !== String(studentId)) {
          setError('Detail mahasiswa tidak tersedia. Buka ulang pemeriksaan.');
          return;
        }
        setDetail(data);
        // Default select first uploaded document for instant preview
        const firstUploaded = data.dokumen?.find((d) => d.is_uploaded && d.dokumen_terkini);
        if (firstUploaded) {
          setSelectedDocCode(firstUploaded.kode_jenis);
        }
      })
      .catch((err) => {
        if (!active) return;
        const msg = adminDataDiriErrorMessage(err, 'Gagal memuat detail data diri mahasiswa.');
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, studentId]);

  // Load PDF when selected document changes
  useEffect(() => {
    if (!open || !studentId || !selectedDocCode ||
      String(detail?.mahasiswa?.id) !== String(studentId)) return;

    const docItem = detail.dokumen?.find((d) => d.kode_jenis === selectedDocCode);
    if (!docItem?.dokumen_terkini) {
      if (previewState.url) URL.revokeObjectURL(previewState.url);
      setPreviewState({ loading: false, url: null, error: 'Berkas belum diunggah oleh mahasiswa.', fileName: '' });
      return;
    }

    let active = true;
    if (previewState.url) {
      URL.revokeObjectURL(previewState.url);
    }
    setPreviewState({ loading: true, url: null, error: '', fileName: docItem.dokumen_terkini.file.nama_file_asli });

    fetchAdminDataDiriDocumentFile(studentId, selectedDocCode)
      .then((blob) => {
        if (!active) return;
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const objectUrl = URL.createObjectURL(pdfBlob);
        setPreviewState({
          loading: false,
          url: objectUrl,
          error: '',
          fileName: docItem.dokumen_terkini.file.nama_file_asli,
        });
      })
      .catch((err) => {
        if (!active) return;
        setPreviewState({
          loading: false,
          url: null,
          error: adminDataDiriErrorMessage(err, 'Gagal menampilkan berkas PDF.'),
          fileName: docItem.dokumen_terkini.file.nama_file_asli,
        });
      });

    return () => {
      active = false;
    };
  }, [open, studentId, selectedDocCode]);

  // Clean up objectUrl on unmount or close
  useEffect(() => {
    return () => {
      if (previewState.url) {
        URL.revokeObjectURL(previewState.url);
      }
    };
  }, [previewState.url]);

  if (!open) return null;

  // Handler: Setujui individual document
  async function handleApproveDocument(docItem) {
    if (!docItem.dokumen_terkini || actionLoading) return;
    setActionLoading(true);
    try {
      await verifyAdminDataDiriDocument(studentId, docItem.kode_jenis, {
        status: 'TERVERIFIKASI',
        catatan: null,
        expectedVersion: docItem.dokumen_terkini.versi,
      });
      toast.success(`Dokumen ${docItem.nama_jenis} berhasil disetujui.`);
      // Refresh detail data
      const updated = await fetchAdminDataDiriDetail(studentId);
      setDetail(updated);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      const msg = adminDataDiriErrorMessage(err, 'Gagal menyetujui dokumen.');
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  }

  // Handler: Open revision modal
  function handleOpenRevision(docItem) {
    setTargetRevisionDoc(docItem);
    setRevisionModalOpen(true);
  }

  // Handler: Submit revision note
  async function handleSubmitRevision(note) {
    if (!targetRevisionDoc?.dokumen_terkini || actionLoading) return;
    setActionLoading(true);
    try {
      await verifyAdminDataDiriDocument(studentId, targetRevisionDoc.kode_jenis, {
        status: 'PERLU_PERBAIKAN',
        catatan: note,
        expectedVersion: targetRevisionDoc.dokumen_terkini.versi,
      });
      toast.success(`Permintaan perbaikan untuk ${targetRevisionDoc.nama_jenis} telah dikirim.`);
      setRevisionModalOpen(false);
      setTargetRevisionDoc(null);
      // Refresh detail data
      const updated = await fetchAdminDataDiriDetail(studentId);
      setDetail(updated);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      const msg = adminDataDiriErrorMessage(err, 'Gagal mengirim catatan perbaikan.');
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  }

  // Handler: Verify all 6 documents
  async function handleVerifyAllConfirm() {
    if (!detail?.kelengkapan?.lengkap || actionLoading) return;
    setActionLoading(true);
    try {
      const expectedVersions = {};
      detail.dokumen.forEach((d) => {
        if (d.dokumen_terkini) {
          expectedVersions[d.kode_jenis] = d.dokumen_terkini.versi;
        }
      });

      await verifyAllAdminDataDiri(studentId, expectedVersions);
      toast.success('Seluruh 6 berkas data diri mahasiswa berhasil diverifikasi!');
      setConfirmVerifyAllOpen(false);
      const updated = await fetchAdminDataDiriDetail(studentId);
      setDetail(updated);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      const msg = adminDataDiriErrorMessage(err, 'Gagal memverifikasi seluruh dokumen.');
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  }

  const visibleDetail = detail?.mahasiswa?.id != null &&
    String(detail.mahasiswa.id) === String(studentId) ? detail : null;
  const showDetailLoading = loading || (!error && !visibleDetail);
  const student = visibleDetail?.mahasiswa;
  const verifikasi = visibleDetail?.verifikasi;
  const kelengkapan = visibleDetail?.kelengkapan;
  const documents = visibleDetail?.dokumen || [];

  // Determine if Verify All button is eligible
  const canVerifyAll =
    kelengkapan?.lengkap &&
    documents.every((d) => d.dokumen_terkini && d.dokumen_terkini.status_dokumen !== 'PERLU_PERBAIKAN') &&
    verifikasi?.status_verifikasi !== 'TERVERIFIKASI';

  const selectedDoc = documents.find((d) => d.kode_jenis === selectedDocCode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-950/50 backdrop-blur-xs animate-modal-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-modal-title"
        className="relative w-full max-w-7xl h-[94vh] sm:h-[92vh] max-h-[920px] rounded-[20px] sm:rounded-[24px] border border-slate-900/[0.12] bg-canvas flex flex-col overflow-hidden shadow-2xl text-ink"
      >
        {/* ================= 1. MODAL TOP HEADER ================= */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 bg-white/75 backdrop-blur-sm border-b border-slate-900/[0.06] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* Student Avatar & Basic Info */}
            <div className="relative shrink-0">
              <div className="size-9 sm:size-10 rounded-full bg-white/80 border border-slate-900/[0.08] flex items-center justify-center text-slate-800 font-bold text-xs tracking-tight">
                {student?.nama_lengkap
                  ? student.nama_lengkap.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                  : 'M'}
              </div>
              <span
                className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                title="Status Mahasiswa Aktif"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="workspace-modal-title" className="text-xs sm:text-base font-bold text-ink truncate leading-snug">
                {student ? student.nama_lengkap : 'Memuat data mahasiswa…'}
              </h2>
              <p className="text-[11px] sm:text-xs text-muted truncate mt-0.5">
                NIM: <span className="font-mono font-semibold text-secondary">{student?.nim || '-'}</span>
                {student?.program_studi && ` • ${student.program_studi.nama_prodi}`}
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
                  title="Mahasiswa sebelumnya"
                  aria-label="Mahasiswa sebelumnya"
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
                  title="Mahasiswa berikutnya"
                  aria-label="Mahasiswa berikutnya"
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

        {/* ================= 2. MOBILE VIEW TAB SWITCHER ================= */}
        <div className="flex lg:hidden bg-white/90 backdrop-blur-sm border-b border-slate-900/[0.08] px-4 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setMobileTab('docs')}
            className={`flex-1 py-2.5 font-bold text-center border-b-2 transition-colors cursor-pointer ${
              mobileTab === 'docs'
                ? 'border-brand text-brand'
                : 'border-transparent text-secondary hover:text-ink'
            }`}
          >
            Daftar Berkas ({kelengkapan?.jumlah_terunggah || 0}/6)
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-2.5 font-bold text-center border-b-2 transition-colors cursor-pointer ${
              mobileTab === 'preview'
                ? 'border-brand text-brand'
                : 'border-transparent text-secondary hover:text-ink'
            }`}
          >
            Pratinjau PDF {selectedDoc ? `(${selectedDoc.nama_jenis})` : ''}
          </button>
        </div>

        {/* ================= 3. MAIN WORKSPACE CONTENT ================= */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {showDetailLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
              <IconSpinner className="size-8 text-brand" />
              <p className="text-xs text-secondary font-medium">Memuat data berkas mahasiswa…</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <IconExclamationCircle className="size-10 text-danger mb-2" />
              <p className="text-sm font-bold text-ink">Gagal Memuat Data</p>
              <p className="text-xs text-secondary mt-1 max-w-md">{error}</p>
            </div>
          ) : !visibleDetail ? null : (
            <>
              {/* ------------ LEFT PANE: CHECKLIST 6 DOKUMEN & DATA AKADEMIK ------------ */}
              <div
                className={`flex-1 lg:flex-none min-h-0 h-full w-full lg:w-[44%] xl:w-[40%] lg:border-r border-slate-900/[0.08] bg-white/70 backdrop-blur-sm overflow-y-auto p-4 sm:p-5 space-y-4 lg:shrink-0 ${
                  mobileTab === 'preview' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Official Academic Master Card (styled exactly as reference) */}
                {student && <StudentAcademicCard student={student} />}

                {/* Section Header: Checklist Wajib */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-900/[0.06]">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
                      Checklist Wajib
                    </span>
                    <h3 className="text-xs font-bold text-ink">
                      6 Berkas Identitas Resmi
                    </h3>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                      kelengkapan?.lengkap
                        ? 'bg-emerald-50/80 text-emerald-800 border-emerald-200/70'
                        : 'bg-amber-50/80 text-amber-900 border-amber-200/70'
                    }`}
                  >
                    {kelengkapan?.jumlah_terunggah || 0} / 6 Terunggah
                  </span>
                </div>

                {/* 6 Documents Cards */}
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const isSelected = selectedDocCode === doc.kode_jenis;
                    const docTerkini = doc.dokumen_terkini;
                    const statusDokumen = docTerkini?.status_dokumen || 'BELUM_UNGGAH';

                    return (
                      <DocumentChecklistItem
                        key={doc.kode_jenis}
                        doc={doc}
                        docTerkini={docTerkini}
                        statusDokumen={statusDokumen}
                        isSelected={isSelected}
                        actionLoading={actionLoading}
                        onSelect={() => {
                          setSelectedDocCode(doc.kode_jenis);
                          setMobileTab('preview');
                        }}
                        onOpenRevision={() => handleOpenRevision(doc)}
                        onApproveDocument={() => handleApproveDocument(doc)}
                        formatFileSize={formatFileSize}
                        formatDate={formatDate}
                      />
                    );
                  })}
                </div>
              </div>

              {/* ------------ RIGHT PANE: INTEGRATED PDF PREVIEWER ------------ */}
              <WorkspacePdfViewer
                mobileTab={mobileTab}
                selectedDoc={selectedDoc}
                selectedDocCode={selectedDocCode}
                previewState={previewState}
              />
            </>
          )}
        </div>

        {/* ================= 4. MODAL BOTTOM ACTION BAR ================= */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 px-4 sm:px-6 py-3 bg-white/85 backdrop-blur-sm border-t border-slate-900/[0.08] shrink-0">
          <div className="flex items-center gap-2 text-xs text-secondary">
            <IconInformationCircle className="size-4 text-slate-500 shrink-0" />
            <span className="truncate">
              {kelengkapan?.lengkap
                ? 'Seluruh berkas wajib (6/6) telah terunggah.'
                : `Berkas belum lengkap (${kelengkapan?.jumlah_terunggah || 0}/6 terunggah).`}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={actionLoading}
              className="rounded-xl border border-slate-900/[0.08] bg-white/80 hover:bg-white px-3.5 sm:px-4 py-2 text-xs font-semibold text-secondary transition-colors cursor-pointer"
            >
              Tutup
            </button>

            {/* Quick Action: Verifikasi Semua (6 Berkas) */}
            <button
              type="button"
              onClick={() => setConfirmVerifyAllOpen(true)}
              disabled={!canVerifyAll || actionLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:pointer-events-none text-white px-3.5 sm:px-4 py-2 text-xs font-bold transition-colors cursor-pointer shadow-none whitespace-nowrap"
              title={
                !kelengkapan?.lengkap
                  ? 'Berkas mahasiswa belum lengkap 6/6'
                  : 'Verifikasi sekaligus keenam berkas mahasiswa'
              }
            >
              {actionLoading ? (
                <>
                  <IconSpinner className="size-3.5" />
                  <span>Memproses…</span>
                </>
              ) : (
                <>
                  <IconCheckCircle className="size-4" />
                  <span>Verifikasi Semua</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Revision Note Modal Dialog */}
      <RevisionNoteModal
        open={revisionModalOpen}
        documentTitle={targetRevisionDoc?.nama_jenis || 'Dokumen'}
        onSubmit={handleSubmitRevision}
        onClose={() => {
          setRevisionModalOpen(false);
          setTargetRevisionDoc(null);
        }}
        submitting={actionLoading}
      />

      {/* Confirm Dialog for Verifikasi Semua */}
      <ConfirmDialog
        open={confirmVerifyAllOpen}
        onClose={() => !actionLoading && setConfirmVerifyAllOpen(false)}
        onConfirm={handleVerifyAllConfirm}
        badge="Verifikasi Data Diri • 6 Berkas"
        title="Setujui Seluruh Berkas Mahasiswa?"
        description={`Anda akan menyetujui seluruh 6 dokumen data diri milik ${student?.nama_lengkap || 'mahasiswa ini'} secara serentak. Status verifikasi mahasiswa akan menjadi TERVERIFIKASI resmi.`}
        confirmLabel="Verifikasi Semua"
        cancelLabel="Batal"
        variant="primary"
        loading={actionLoading}
      />
    </div>
  );
}
