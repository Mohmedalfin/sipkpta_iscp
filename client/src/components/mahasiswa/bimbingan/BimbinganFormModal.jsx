import { useEffect, useId, useRef, useState } from 'react';
import { useToast } from '../../../context/ToastContext.jsx';
import {
  bimbinganErrorMessage,
  createBimbinganDraft,
  submitBimbinganWithDraft,
  submitBimbinganRevision,
  updateBimbinganDraft,
} from '../../../services/bimbinganMahasiswa.js';
import BimbinganStatusBadge from './BimbinganStatusBadge.jsx';
import {
  IconArrowUpTray,
  IconCalendar,
  IconClose,
  IconDocumentText,
  IconExclamationTriangle,
  IconInformationCircle,
  IconPaperClip,
  IconPlus,
  IconSpinner,
  IconTrash,
  IconUser,
  IconUsers,
} from '../../common/Icons.jsx';

const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_RINGKASAN_CHARS = 10000;

function getTodayJakartaString() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Modal Formulir Input & Revisi Bimbingan Mahasiswa
 * Didesain selaras dengan Modal Rincian Bimbingan (Modern Academic Administration)
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Status visibilitas modal
 * @param {Function} props.onClose - Handler menutup modal
 * @param {number|string} props.pengajuanId - ID Pengajuan KP aktif
 * @param {object|null} [props.initialData] - Data draf jika dalam mode edit atau data bimbingan jika revisi
 * @param {'create'|'edit_draft'|'revision'|string} [props.mode='create'] - Mode operasional modal
 * @param {Function} [props.onSuccess] - Callback setelah aksi simpan/kirim sukses
 * @param {object} [props.supervisor] - Informasi Dosen Pembimbing KP
 * @param {string} [props.topikJudul] - Judul topik penelitian KP mahasiswa
 */
export default function BimbinganFormModal({
  isOpen,
  onClose,
  pengajuanId,
  initialData = null,
  mode = 'create',
  onSuccess,
  supervisor = null,
  topikJudul = '',
}) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);
  const summaryId = useId();
  const dateId = useId();

  const isRevision = mode === 'revision' || initialData?.status_bimbingan === 'PERLU_PERBAIKAN';
  const todayJakarta = getTodayJakartaString();

  const supervisorData = supervisor?.dosen || supervisor || {};
  const supervisorName = supervisorData.nama_lengkap || supervisorData.nama || null;
  const supervisorCode = supervisorData.kode_dosen || null;
  const supervisorNidn = supervisorData.nidn || null;

  const [draftId, setDraftId] = useState(initialData?.id);
  const isEdit = Boolean(draftId) && !isRevision;
  const actionInFlight = useRef(false);
  const [jenisBimbingan, setJenisBimbingan] = useState(initialData?.jenis_bimbingan ?? 'OFFLINE');
  const [tanggalBimbingan, setTanggalBimbingan] = useState(() => {
    if (initialData?.jenis_bimbingan === 'ONLINE') return '';
    return initialData?.tanggal_bimbingan?.slice(0, 10) || todayJakarta;
  });
  const [ringkasan, setRingkasan] = useState(initialData?.ringkasan ?? '');
  const [files, setFiles] = useState([]);

  const [formError, setFormError] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isBusy = savingDraft || submitting;

  // Handle tombol Escape untuk menutup modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !actionInFlight.current) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handler pemilihan file PDF
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    setFormError('');

    const newFileList = [...files];
    for (const file of selectedFiles) {
      if (newFileList.length >= MAX_FILES) {
        setFormError(`Maksimal ${MAX_FILES} berkas lampiran PDF yang dapat diunggah.`);
        break;
      }

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setFormError(`Berkas "${file.name}" ditolak. Hanya dokumen berformat PDF yang diperbolehkan.`);
        continue;
      }

      if (file.size > MAX_FILE_BYTES) {
        setFormError(`Berkas "${file.name}" melebihi ukuran batas maksimal 5 MB.`);
        continue;
      }

      // Cegah duplikasi file berdasarkan nama dan ukuran
      const isDuplicate = newFileList.some(
        (existing) => existing.name === file.name && existing.size === file.size
      );
      if (!isDuplicate) {
        newFileList.push(file);
      }
    }

    setFiles(newFileList);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (indexToRemove) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleJenisChange = (nextJenis) => {
    if (isEdit) return; // Jenis bimbingan terkunci jika edit draf
    setJenisBimbingan(nextJenis);
    if (nextJenis === 'ONLINE') {
      setTanggalBimbingan('');
    } else {
      setTanggalBimbingan(todayJakarta);
    }
    setFormError('');
  };

  // Validasi lokal sebelum kirim
  const validateForSubmit = () => {
    if (jenisBimbingan === 'OFFLINE') {
      if (!tanggalBimbingan) {
        return 'Tanggal bimbingan tatap muka wajib diisi.';
      }
      if (tanggalBimbingan > todayJakarta) {
        return 'Tanggal bimbingan tatap muka tidak boleh berada di masa depan.';
      }
    }

    const trimmedSummary = ringkasan.trim();
    if (!trimmedSummary) {
      return 'Ringkasan materi bimbingan wajib diisi sebelum dikirim ke Dosen Pembimbing.';
    }
    if (trimmedSummary.length > MAX_RINGKASAN_CHARS) {
      return `Ringkasan materi melebihi batas maksimal ${MAX_RINGKASAN_CHARS.toLocaleString('id-ID')} karakter.`;
    }

    return null;
  };

  // Aksi 1: Simpan sebagai Draf
  const handleSaveDraft = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setFormError('');
    setSavingDraft(true);

    try {
      const payload = {
        tanggal_bimbingan: jenisBimbingan === 'OFFLINE' ? (tanggalBimbingan || null) : null,
        ringkasan: ringkasan.trim() || null,
      };

      if (isEdit) {
        await updateBimbinganDraft(pengajuanId, draftId, payload);
        toast.success('Draf bimbingan berhasil diperbarui.');
      } else {
        await createBimbinganDraft(pengajuanId, { ...payload, jenis_bimbingan: jenisBimbingan });
        toast.success('Draf bimbingan berhasil disimpan.');
      }

      if (files.length > 0) {
        toast.info('Catatan: Berkas lampiran PDF akan disertakan saat Anda menekan "Kirim ke Pembimbing".');
      }

      onSuccess?.('bimbingan.draft.updated');
      onClose();
    } catch (err) {
      setFormError(bimbinganErrorMessage(err, 'Gagal menyimpan draf bimbingan.'));
    } finally {
      actionInFlight.current = false;
      setSavingDraft(false);
    }
  };

  // Aksi 2: Kirim ke Dosen Pembimbing
  const handleSubmitToSupervisor = async () => {
    if (actionInFlight.current) return;
    const validationError = validateForSubmit();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    actionInFlight.current = true;
    setFormError('');
    setSubmitting(true);
    let createdDraft = false;
    const payload = {
      ringkasan: ringkasan.trim(),
      ...(jenisBimbingan === 'OFFLINE' && { tanggal_bimbingan: tanggalBimbingan }),
    };

    try {
      if (isRevision) {
        await submitBimbinganRevision(pengajuanId, initialData.id, payload, files);
        toast.success('Revisi catatan bimbingan berhasil dikirim ke Dosen Pembimbing.');
      } else {
        await submitBimbinganWithDraft(pengajuanId, {
          draftId, jenisBimbingan, payload, files,
          onDraftCreated: (id) => {
            createdDraft = true;
            setDraftId(id);
          },
        });
        toast.success('Catatan bimbingan berhasil dikirim ke Dosen Pembimbing.');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      if (createdDraft) onSuccess?.('bimbingan.draft.updated');
      setFormError(bimbinganErrorMessage(err, 'Gagal mengirim catatan bimbingan ke pembimbing.'));
    } finally {
      actionInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs animate-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bimbingan-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl sm:max-w-4xl max-h-[92vh] rounded-[22px] border border-slate-900/[0.12] bg-white flex flex-col overflow-hidden shadow-2xl text-ink"
      >
        {/* ================= 1. HEADER MODAL SELARAS ================= */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-50/80 border-b border-slate-900/[0.08] shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Brand Icon Box: Sesuai gaya BimbinganDetailModal */}
            <div
              className={`size-11 sm:size-12 rounded-2xl flex items-center justify-center font-extrabold text-sm tracking-tight shadow-2xs shrink-0 ${
                isRevision
                  ? 'bg-amber-50 border border-amber-200/80 text-amber-700'
                  : 'bg-brand-soft border border-blue-200/70 text-brand'
              }`}
            >
              {isRevision ? (
                <IconArrowUpTray className="size-5 sm:size-6 text-amber-600" />
              ) : isEdit ? (
                <IconDocumentText className="size-5 sm:size-6 text-brand" />
              ) : (
                <IconPlus className="size-5 sm:size-6 text-brand" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Portal Mahasiswa • Log Bimbingan Kerja Praktik
                </span>
                {initialData?.id && (
                  <span className="inline-flex items-center rounded-md bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-mono font-bold text-slate-700">
                    ID #{initialData.id}
                  </span>
                )}
              </div>
              <h2 id="bimbingan-modal-title" className="text-base sm:text-lg font-extrabold text-ink tracking-tight truncate">
                {isRevision
                  ? `Kirim Revisi Sesi Bimbingan #${initialData?.nomor_sesi || initialData?.id}`
                  : isEdit
                  ? 'Lanjutkan Draf Bimbingan'
                  : 'Catat Sesi Bimbingan Baru'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isRevision ? (
              <div className="hidden sm:inline-flex">
                <BimbinganStatusBadge status="PERLU_PERBAIKAN" />
              </div>
            ) : isEdit ? (
              <div className="hidden sm:inline-flex">
                <BimbinganStatusBadge status="DRAFT" />
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              aria-label="Tutup formulir"
              title="Tutup (Esc)"
              className="size-8.5 rounded-xl text-slate-400 hover:text-ink hover:bg-slate-200/60 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
            >
              <IconClose className="size-4" />
            </button>
          </div>
        </div>

        {/* ================= 2. BODY FORMULIR (SCROLLABLE) ================= */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1">
          {/* Banner Error Validasi Form */}
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800 flex items-start gap-2.5 shadow-2xs"
            >
              <IconExclamationTriangle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{formError}</div>
            </div>
          )}

          {/* Konteks Topik & Dosen Pembimbing */}
          {(supervisorName || topikJudul) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs">
              {topikJudul && (
                <div className="min-w-0 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Topik Kerja Praktik
                  </span>
                  <p className="font-bold text-ink truncate" title={topikJudul}>
                    {topikJudul}
                  </p>
                </div>
              )}
              {supervisorName && (
                <div className="min-w-0 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Dosen Pembimbing KP
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-ink truncate" title={supervisorName}>
                    <IconUser className="size-3.5 text-brand shrink-0" />
                    <span className="truncate">{supervisorName}</span>
                    {supervisorCode && (
                      <span className="text-[10px] font-mono font-semibold text-brand bg-brand/10 px-1.5 py-0.2 rounded-md shrink-0">
                        {supervisorCode}
                      </span>
                    )}
                    {supervisorNidn && (
                      <span className="text-[10px] font-mono font-normal text-muted shrink-0">
                        ({supervisorNidn})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hero Callout Arahan Pembimbing untuk Mode Revisi */}
          {isRevision && (
            <div className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50/90 to-amber-100/40 p-4.5 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-3 pb-2.5 border-b border-amber-200/80">
                <div className="size-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconExclamationTriangle className="size-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                    Tindakan Mahasiswa Diperlukan
                  </span>
                  <h3 className="text-sm font-bold text-amber-950">
                    Arahan & Catatan Perbaikan dari Dosen Pembimbing
                  </h3>
                </div>
              </div>

              <div className="rounded-xl bg-white/95 border border-amber-200 p-3.5 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-medium shadow-2xs">
                {initialData?.catatan_pembimbing_terakhir ? (
                  <div>
                    <span className="font-bold text-amber-900 block mb-1">Catatan Pembimbing:</span>
                    &ldquo;{initialData.catatan_pembimbing_terakhir}&rdquo;
                  </div>
                ) : (
                  <span className="text-muted italic">
                    Dosen pembimbing menandai perlu perbaikan tanpa catatan teks tambahan.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ================= KARTU 1: PELAKSANAAN & TANGGAL ================= */}
          <div className="rounded-2xl border border-slate-900/[0.08] bg-white p-4.5 sm:p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              1. Format & Waktu Pelaksanaan Bimbingan
            </h3>

            {/* Pilihan Jenis Bimbingan */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold text-ink">
                Jenis Pelaksanaan <span className="text-rose-500">*</span>
              </legend>

              {isEdit ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-center gap-2.5 text-xs text-secondary">
                  <IconInformationCircle className="size-4 text-indigo-600 shrink-0" />
                  <span>
                    Jenis pelaksanaan terkunci pada mode{' '}
                    <strong className="text-ink font-semibold">
                      {jenisBimbingan === 'OFFLINE' ? 'Tatap Muka (Offline)' : 'Daring (Online)'}
                    </strong>{' '}
                    sesuai draf bimbingan awal.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Radio Card 1: Tatap Muka */}
                  <label
                    className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all shadow-2xs ${
                      jenisBimbingan === 'OFFLINE'
                        ? 'border-brand bg-indigo-50/30 ring-1.5 ring-brand'
                        : 'border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="jenis_bimbingan"
                      value="OFFLINE"
                      checked={jenisBimbingan === 'OFFLINE'}
                      onChange={() => handleJenisChange('OFFLINE')}
                      disabled={isBusy}
                      className="mt-0.5 text-brand focus:ring-brand"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                        <IconUsers className="size-3.5 text-indigo-600 shrink-0" />
                        <span>Tatap Muka (Offline)</span>
                      </div>
                      <p className="mt-1 text-[11px] text-secondary leading-relaxed">
                        Pertemuan konsultasi langsung di kampus atau lokasi Kerja Praktik.
                      </p>
                    </div>
                  </label>

                  {/* Radio Card 2: Daring */}
                  <label
                    className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all shadow-2xs ${
                      jenisBimbingan === 'ONLINE'
                        ? 'border-brand bg-sky-50/30 ring-1.5 ring-brand'
                        : 'border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="jenis_bimbingan"
                      value="ONLINE"
                      checked={jenisBimbingan === 'ONLINE'}
                      onChange={() => handleJenisChange('ONLINE')}
                      disabled={isBusy}
                      className="mt-0.5 text-brand focus:ring-brand"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                        <IconCalendar className="size-3.5 text-sky-600 shrink-0" />
                        <span>Daring (Online)</span>
                      </div>
                      <p className="mt-1 text-[11px] text-secondary leading-relaxed">
                        Konsultasi via email, aplikasi perpesanan, dokumen bersama, atau video call.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </fieldset>

            {/* Input Tanggal Bimbingan (Khusus Tatap Muka) */}
            {jenisBimbingan === 'OFFLINE' ? (
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <label htmlFor={dateId} className="block text-xs font-bold text-ink">
                  Tanggal Pertemuan Tatap Muka <span className="text-rose-500">*</span>
                </label>
                <div className="relative max-w-xs">
                  <input
                    id={dateId}
                    type="date"
                    max={todayJakarta}
                    value={tanggalBimbingan}
                    onChange={(e) => {
                      setTanggalBimbingan(e.target.value);
                      setFormError('');
                    }}
                    disabled={isBusy}
                    className="w-full rounded-xl border border-slate-900/[0.12] bg-white px-3.5 py-2 text-xs text-ink focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand shadow-2xs disabled:bg-slate-50 disabled:text-muted"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  Pilih tanggal pelaksanaan bimbingan tatap muka (maksimal hari ini, waktu Jakarta).
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-sky-200/80 bg-sky-50/70 p-3.5 flex items-start gap-2.5 text-xs text-sky-950 pt-1 border-t border-slate-100">
                <IconInformationCircle className="size-4 text-sky-700 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Untuk bimbingan daring (online), tanggal pertemuan tidak perlu diinput manual. Waktu pengiriman akan dicatat secara otomatis oleh sistem saat dikirim ke Dosen Pembimbing.
                </span>
              </div>
            )}
          </div>

          {/* ================= KARTU 2: RINGKASAN MATERI ================= */}
          <div className="rounded-2xl border border-slate-900/[0.08] bg-white p-4.5 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                2. Ringkasan Materi & Pokok Pembahasan
              </h3>
              <span
                className={`text-[11px] font-mono ${
                  ringkasan.length > MAX_RINGKASAN_CHARS ? 'text-rose-600 font-bold' : 'text-muted'
                }`}
              >
                {ringkasan.length.toLocaleString('id-ID')} / {MAX_RINGKASAN_CHARS.toLocaleString('id-ID')} karakter
              </span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={summaryId} className="sr-only">
                Ringkasan Materi & Arahan Pembimbing
              </label>
              <textarea
                id={summaryId}
                rows={5}
                maxLength={MAX_RINGKASAN_CHARS}
                value={ringkasan}
                onChange={(e) => {
                  setRingkasan(e.target.value);
                  setFormError('');
                }}
                disabled={isBusy}
                placeholder="Tuliskan poin-poin materi yang dikonsultasikan, progres bab/laporan Kerja Praktik yang telah diselesaikan, kendala yang dihadapi, serta kesepakatan arahan berikutnya dari Dosen Pembimbing..."
                className="w-full rounded-xl border border-slate-900/[0.12] bg-white p-3.5 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand shadow-2xs disabled:bg-slate-50 disabled:text-muted leading-relaxed"
              />
              <p className="text-[11px] text-muted">
                Wajib diisi lengkap sebelum catatan dikirimkan untuk ditelaah oleh Dosen Pembimbing.
              </p>
            </div>
          </div>

          {/* ================= KARTU 3: BERKAS LAMPIRAN PDF ================= */}
          <div className="rounded-2xl border border-slate-900/[0.08] bg-white p-4.5 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  3. Berkas Lampiran Dokumen <span className="font-normal lowercase">(opsional)</span>
                </h3>
                <p className="text-[11px] text-secondary">
                  Sertakan naskah laporan, lembar revisi, atau berkas pendukung konsultasi lainnya.
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                {files.length} / {MAX_FILES} Berkas
              </span>
            </div>

            {/* Input File Tersembunyi */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileChange}
              disabled={isBusy || files.length >= MAX_FILES}
              className="hidden"
            />

            {/* Dropzone Area Unggah Berkas */}
            {files.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="w-full rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand/60 bg-slate-50/60 hover:bg-indigo-50/20 p-5 text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="size-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
                  <IconPaperClip className="size-4.5 text-brand" />
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">
                    Klik untuk memilih dokumen PDF atau lampiran progres
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Hanya format .pdf (Maks. 5 MB per berkas, maksimal {MAX_FILES} berkas)
                  </p>
                </div>
              </button>
            )}

            {/* Daftar Berkas Terpilih (Sesuai Gaya BimbinganDetailModal) */}
            {files.length > 0 && (
              <div className="space-y-2 pt-1" aria-label="Daftar berkas lampiran bimbingan terpilih">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  Berkas Terpilih ({files.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {files.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/90 bg-white hover:border-brand/30 shadow-2xs transition-all text-xs group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="size-8 rounded-lg bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 font-bold text-[10px] shrink-0">
                          PDF
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink max-w-[170px] sm:max-w-[200px]" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-muted font-mono">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        disabled={isBusy}
                        title={`Hapus lampiran ${file.name}`}
                        className="size-7.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        <IconTrash className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================= 3. FOOTER MODAL SELARAS ================= */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 px-5 sm:px-6 py-4 bg-slate-50/80 border-t border-slate-900/[0.08] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="w-full sm:w-auto rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {/* Aksi Simpan Draf (Hanya untuk Pencatatan Baru atau Edit Draf) */}
            {!isRevision && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isBusy}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-50 active:bg-slate-100 px-4 py-2 text-xs font-semibold text-secondary hover:text-ink shadow-2xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {savingDraft ? (
                  <>
                    <IconSpinner className="size-3.5 animate-spin" />
                    <span>Menyimpan Draf...</span>
                  </>
                ) : (
                  <span>Simpan sebagai Draf</span>
                )}
              </button>
            )}

            {/* Aksi Kirim ke Dosen Pembimbing */}
            <button
              type="button"
              onClick={handleSubmitToSupervisor}
              disabled={isBusy}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-4.5 py-2 text-xs font-bold text-white shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
                isRevision
                  ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                  : 'bg-brand hover:bg-brand-hover active:bg-brand-pressed'
              }`}
            >
              {submitting ? (
                <>
                  <IconSpinner className="size-3.5 animate-spin" />
                  <span>{isRevision ? 'Mengirimkan Revisi...' : 'Mengirimkan Catatan...'}</span>
                </>
              ) : isRevision ? (
                <>
                  <IconArrowUpTray className="size-3.5" />
                  <span>Kirim Revisi ke Pembimbing</span>
                </>
              ) : (
                <>
                  <IconDocumentText className="size-3.5" />
                  <span>Kirim ke Pembimbing</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
