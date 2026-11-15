import { useCallback, useRef, useState } from 'react';
import {
  IconArrowDownTray,
  IconArrowRight,
  IconCheckCircle,
  IconClose,
  IconDocumentSpreadsheet,
  IconDocumentText,
  IconExclamationCircle,
  IconExclamationTriangle,
  IconInformationCircle,
  IconRefresh,
  IconSpinner,
  IconTrash,
} from '../../common/Icons.jsx';
import boxIcon from '../../../assets/NoBackground Box.svg';
import { useFocusTrap } from '../../../hooks/useFocusTrap.js';
import {
  confirmMahasiswaImport,
  downloadMahasiswaCsvTemplate,
  downloadMahasiswaImportErrors,
  mahasiswaErrorMessage,
  previewMahasiswaImport,
} from '../../../services/masterMahasiswa.js';
import { useToast } from '../../../context/ToastContext.jsx';

function formatFileSize(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MahasiswaImportModal({
  open,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const modalRef = useRef(null);
  const fileInputRef = useRef(null);
  const submitInFlightRef = useRef(false);

  // Wizard Steps: 1 ('upload') -> 2 ('preview') -> 3 ('result')
  const [step, setStep] = useState(1);

  // Upload States
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Preview States
  const [previewData, setPreviewData] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Result States
  const [resultData, setResultData] = useState(null);

  // General Error State
  const [errorMessage, setErrorMessage] = useState('');

  // Handle Close & Reset Wizard
  const handleResetAndClose = useCallback(() => {
    if (submitInFlightRef.current || uploading || confirming) return;
    setStep(1);
    setSelectedFile(null);
    setPreviewData(null);
    setResultData(null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }, [uploading, confirming, onClose]);

  useFocusTrap(modalRef, open, handleResetAndClose);

  if (!open) return null;

  // ================= 1. FILE SELECTION HANDLERS =================

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
    if (submitInFlightRef.current) return;
    setErrorMessage('');
    setSelectedFile(null);
    setPreviewData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!/\.csv$/i.test(file.name)) {
      setErrorMessage('Format berkas tidak valid. Harap pilih berkas dengan ekstensi .csv');
      toast.warning('Berkas harus berekstensi .csv');
      return;
    }
    if (file.size === 0) {
      setErrorMessage('Berkas CSV kosong. Pilih berkas yang berisi header dan data mahasiswa.');
      toast.warning('Berkas CSV kosong.');
      return;
    }
    // Maksimum 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas melebihi batas maksimal 5 MB.');
      toast.warning('Ukuran berkas maksimal 5 MB.');
      return;
    }
    setSelectedFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleRemoveFile = () => {
    if (submitInFlightRef.current) return;
    setSelectedFile(null);
    setPreviewData(null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ================= 2. PREVIEW & VALIDATION ACTION =================

  const handleProceedToPreview = async () => {
    if (!selectedFile || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setUploading(true);
    setErrorMessage('');

    try {
      const data = await previewMahasiswaImport(selectedFile);
      setPreviewData(data);
      setStep(2);
      toast.info(`Berkas CSV berhasil dibaca: ${data.total} baris data ditemukan.`);
    } catch (err) {
      const msg = mahasiswaErrorMessage(err, 'Gagal memvalidasi berkas CSV impor.');
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      submitInFlightRef.current = false;
      setUploading(false);
    }
  };

  // ================= 3. CONFIRM IMPORT ACTION =================

  const handleConfirmImport = async () => {
    if (!previewData?.previewId || submitInFlightRef.current) return;
    if (previewData.valid === 0) {
      toast.warning('Tidak ada baris data valid yang dapat diimpor.');
      return;
    }

    submitInFlightRef.current = true;
    setConfirming(true);
    setErrorMessage('');

    try {
      const data = await confirmMahasiswaImport(previewData.previewId);
      setResultData(data);
      setStep(3);
      toast.success(`Berhasil mengimpor ${data.imported} data mahasiswa ke sistem!`);
      if (onSuccess) onSuccess(data);
    } catch (err) {
      const msg = mahasiswaErrorMessage(err, 'Gagal mengeksekusi impor data mahasiswa.');
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      submitInFlightRef.current = false;
      setConfirming(false);
    }
  };

  // ================= 4. DOWNLOAD ERROR REPORT ACTION =================

  const handleDownloadErrors = async () => {
    const previewId = previewData?.previewId || resultData?.previewId;
    if (!previewId || downloadingReport) return;

    setDownloadingReport(true);
    try {
      await downloadMahasiswaImportErrors(previewId);
      toast.success('Laporan baris bermasalah berhasil diunduh (.xlsx).');
    } catch (err) {
      const msg = mahasiswaErrorMessage(err, 'Gagal mengunduh laporan kesalahan.');
      toast.error(msg);
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleBackToFile = () => {
    setPreviewData(null);
    setErrorMessage('');
    setStep(1);
  };

  const visibleErrors = previewData?.errors?.slice(0, 100) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs animate-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mahasiswa-import-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[92vh] rounded-[22px] border border-slate-900/[0.12] bg-white flex flex-col overflow-hidden shadow-2xl text-ink"
      >
        {/* ================= HEADER MODAL & STEPPER ================= */}
        <div className="px-5 sm:px-6 py-4 bg-white/80 border-b border-slate-900/[0.08] shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <img
                src={boxIcon}
                alt=""
                className="size-11 sm:size-12 shrink-0 select-none pointer-events-none object-contain"
                aria-hidden="true"
              />
              <div>
                <h2 id="mahasiswa-import-modal-title" className="text-base font-bold text-ink leading-tight">
                  Impor Massal Data Mahasiswa
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Unggah berkas CSV untuk mendaftarkan banyak akun mahasiswa sekaligus.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetAndClose}
              disabled={uploading || confirming}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              title="Tutup Modal (Esc)"
              aria-label="Tutup Modal"
            >
              <IconClose className="size-4.5" />
            </button>
          </div>

          {/* Stepper Indikator */}
          <div className="mt-4 pt-3 border-t border-slate-900/[0.06] flex items-center justify-between">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <span
                className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 1
                    ? 'bg-brand text-white shadow-xs'
                    : step > 1
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step > 1 ? '✓' : '1'}
              </span>
              <span className={`text-xs font-semibold ${step === 1 ? 'text-ink' : 'text-slate-500'}`}>
                Pilih Berkas
              </span>
            </div>

            <div className={`flex-1 h-0.5 mx-3 ${step > 1 ? 'bg-emerald-300' : 'bg-slate-200'}`} />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <span
                className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 2
                    ? 'bg-brand text-white shadow-xs'
                    : step > 2
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step > 2 ? '✓' : '2'}
              </span>
              <span className={`text-xs font-semibold ${step === 2 ? 'text-ink' : 'text-slate-500'}`}>
                Pratinjau & Validasi
              </span>
            </div>

            <div className={`flex-1 h-0.5 mx-3 ${step > 2 ? 'bg-emerald-300' : 'bg-slate-200'}`} />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <span
                className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 3
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                3
              </span>
              <span className={`text-xs font-semibold ${step === 3 ? 'text-ink' : 'text-slate-500'}`}>
                Hasil Eksekusi
              </span>
            </div>
          </div>
        </div>

        {/* ================= BODY WIZARD (SCROLLABLE) ================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Banner Error Umum */}
          {errorMessage && (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50/90 p-3.5 flex items-start gap-3 text-xs text-rose-800">
              <IconExclamationCircle className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Terjadi Kendala</p>
                <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* ================= STEP 1: PILIH & UNGGAH BERKAS CSV ================= */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Dropzone Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Berkas CSV Data Mahasiswa
                </label>

                {!selectedFile ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Pilih berkas CSV data mahasiswa"
                    className={`relative border-2 border-dashed rounded-[18px] p-7 text-center transition-all cursor-pointer ${
                      isDragOver
                        ? 'border-brand bg-blue-50/70 scale-[0.99]'
                        : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-400'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="size-12 rounded-2xl bg-white border border-slate-900/[0.08] shadow-2xs flex items-center justify-center mx-auto text-brand mb-3">
                      <IconDocumentSpreadsheet className="size-6 text-brand" />
                    </div>
                    <p className="text-xs font-bold text-ink">
                      Seret & lepas berkas CSV ke sini, atau{' '}
                      <span className="text-brand hover:underline">pilih dari komputer</span>
                    </p>
                    <p className="text-[11px] text-muted mt-1">
                      Maksimal 5 MB. CSV UTF-8 dari Excel dengan pemisah koma atau titik koma didukung.
                    </p>
                  </div>
                ) : (
                  /* Kartu Berkas Terpilih */
                  <div className="rounded-[18px] border border-slate-900/[0.1] bg-white p-4 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-700 shrink-0">
                        <IconDocumentSpreadsheet className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink truncate">{selectedFile.name}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                          Ukuran: {formatFileSize(selectedFile.size)} • Siap divalidasi
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      disabled={uploading}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40"
                      title="Hapus / Ganti Berkas"
                    >
                      <IconTrash className="size-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Card Bantuan Format & Download Template */}
              <div className="rounded-[18px] border border-slate-900/[0.08] bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <IconInformationCircle className="size-4 text-brand" />
                    <h3 className="text-xs font-bold text-ink">Panduan & Template Berkas CSV</h3>
                  </div>

                  {/* Tombol Unduh Template */}
                  <button
                    type="button"
                    onClick={downloadMahasiswaCsvTemplate}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/[0.12] bg-white hover:bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-brand shadow-2xs transition-colors cursor-pointer"
                  >
                    <IconArrowDownTray className="size-3 text-brand" />
                    <span>Unduh Template CSV</span>
                  </button>
                </div>

                <p className="text-xs text-secondary leading-relaxed">
                  Kolom pada baris pertama CSV harus mengikuti nama header di bawah. Kolom dengan tanda bintang (<span className="text-rose-500 font-bold">*</span>) wajib diisi:
                </p>
                <p className="text-xs text-secondary leading-relaxed">
                  Di Excel, simpan sebagai CSV UTF-8 (.csv), bukan buku kerja .xlsx. Pastikan tanggal memakai format YYYY-MM-DD dan NIM tetap berupa teks agar angka nol di depan tidak hilang.
                </p>

                {/* Daftar Kolom Wajib */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted block mb-1">
                    Kolom Wajib:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[11px] bg-white border border-slate-900/[0.1] px-2 py-0.5 rounded-md text-ink font-semibold">
                      nim*
                    </span>
                    <span className="font-mono text-[11px] bg-white border border-slate-900/[0.1] px-2 py-0.5 rounded-md text-ink font-semibold">
                      nama*
                    </span>
                    <span className="font-mono text-[11px] bg-white border border-slate-900/[0.1] px-2 py-0.5 rounded-md text-ink font-semibold" title="Format: YYYY-MM-DD">
                      tanggal_lahir* (YYYY-MM-DD)
                    </span>
                    <span className="font-mono text-[11px] bg-white border border-slate-900/[0.1] px-2 py-0.5 rounded-md text-ink font-semibold">
                      email*
                    </span>
                    <span className="font-mono text-[11px] bg-white border border-slate-900/[0.1] px-2 py-0.5 rounded-md text-ink font-semibold" title="Tahun masuk, contoh: 2024">
                      angkatan*
                    </span>
                  </div>
                </div>

                {/* Daftar Kolom Opsional */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted block mb-1">
                    Kolom Opsional:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[11px] bg-white/70 border border-slate-900/[0.06] px-2 py-0.5 rounded-md text-slate-600">
                      nik_kependudukan
                    </span>
                    <span className="font-mono text-[11px] bg-white/70 border border-slate-900/[0.06] px-2 py-0.5 rounded-md text-slate-600">
                      tempat_lahir
                    </span>
                    <span className="font-mono text-[11px] bg-white/70 border border-slate-900/[0.06] px-2 py-0.5 rounded-md text-slate-600">
                      no_telepon
                    </span>
                    <span className="font-mono text-[11px] bg-white/70 border border-slate-900/[0.06] px-2 py-0.5 rounded-md text-slate-600">
                      alamat
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: PRATINJAU & VALIDASI DATA ================= */}
          {step === 2 && previewData && (
            <div className="space-y-4">
              {/* 3 Metric Cards Ringkasan Validasi */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="rounded-[16px] border border-slate-900/[0.08] bg-slate-50/70 p-3 sm:p-3.5 text-center">
                  <span className="text-[10px] uppercase font-bold text-muted block">Total Baris</span>
                  <span className="mt-1 text-xl sm:text-2xl font-black text-ink block">
                    {previewData.total}
                  </span>
                  <span className="text-[10px] text-muted">data dalam CSV</span>
                </div>

                <div className="rounded-[16px] border border-emerald-200/80 bg-emerald-50/70 p-3 sm:p-3.5 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Siap Diimpor</span>
                  <span className="mt-1 text-xl sm:text-2xl font-black text-emerald-700 block">
                    {previewData.valid}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-semibold">baris valid</span>
                </div>

                <div
                  className={`rounded-[16px] border p-3 sm:p-3.5 text-center ${
                    previewData.invalid > 0
                      ? 'border-amber-200/80 bg-amber-50/70'
                      : 'border-slate-900/[0.08] bg-slate-50/50'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold text-slate-600 block">Bermasalah</span>
                  <span
                    className={`mt-1 text-xl sm:text-2xl font-black block ${
                      previewData.invalid > 0 ? 'text-amber-800' : 'text-slate-400'
                    }`}
                  >
                    {previewData.invalid}
                  </span>
                  <span className="text-[10px] text-slate-500">baris ditolak</span>
                </div>
              </div>

              {/* Status Banner */}
              {previewData.invalid > 0 ? (
                <div className="rounded-[16px] border border-amber-200 bg-amber-50/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
                  <div className="flex items-start gap-2.5">
                    <IconExclamationTriangle className="size-4.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900">
                        Ditemukan {previewData.invalid} baris data yang belum memenuhi syarat validasi.
                      </p>
                      <p className="text-amber-800/90 mt-0.5">
                        Anda dapat mengunduh laporan kesalahan lengkap dalam format Excel (.xlsx), atau tetap melanjutkan impor untuk {previewData.valid} data yang valid.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadErrors}
                    disabled={downloadingReport}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100/80 px-3 py-1.5 text-xs font-semibold text-amber-900 shrink-0 transition-colors cursor-pointer shadow-2xs"
                  >
                    {downloadingReport ? (
                      <IconSpinner className="size-3.5" />
                    ) : (
                      <IconArrowDownTray className="size-3.5" />
                    )}
                    <span>Unduh Laporan (.xlsx)</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-[16px] border border-emerald-200 bg-emerald-50/80 p-3.5 flex items-center gap-2.5 text-xs text-emerald-900">
                  <IconCheckCircle className="size-4.5 text-emerald-600 shrink-0" />
                  <p className="font-semibold">
                    Seluruh {previewData.total} baris data mahasiswa valid dan siap diimpor ke dalam basis data sistem!
                  </p>
                </div>
              )}

              {/* Tabel Daftar Baris Bermasalah (Jika Ada) */}
              {previewData.errors && previewData.errors.length > 0 && (
                <div className="rounded-[16px] border border-slate-900/[0.08] bg-white overflow-hidden shadow-2xs">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-900/[0.06] flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">
                      Rincian Kesalahan Validasi ({previewData.errors.length} catatan)
                    </span>
                    <span className="text-[10px] text-muted">
                      Menampilkan {visibleErrors.length} dari {previewData.errors.length} catatan. Laporan Excel memuat semuanya.
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-900/[0.06] bg-slate-50/40 text-[10px] uppercase font-bold text-muted">
                          <th className="py-2 pl-4 pr-2 w-20">Baris CSV</th>
                          <th className="py-2 px-2 w-32">Kolom</th>
                          <th className="py-2 pl-2 pr-4">Pesan Kesalahan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/[0.04]">
                        {visibleErrors.map((errItem, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="py-2 pl-4 pr-2 font-mono font-semibold text-slate-700">
                              #{errItem.row}
                            </td>
                            <td className="py-2 px-2 font-mono text-[11px] text-brand">
                              {errItem.field || '-'}
                            </td>
                            <td className="py-2 pl-2 pr-4 text-rose-700">
                              {errItem.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Callout Kebijakan Akun Otomatis */}
              <div className="rounded-[14px] border border-blue-200/70 bg-blue-50/60 p-3.5 flex items-start gap-2.5 text-xs text-blue-900">
                <IconInformationCircle className="size-4 text-brand shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Setiap baris mahasiswa yang berhasil diimpor otomatis dibuatkan akun pengguna SIPKITA dengan Login ID berupa NIM dan kata sandi awal berbasis tanggal lahir (<code className="font-mono text-slate-800">DDMMYYYY</code>).
                </p>
              </div>
            </div>
          )}

          {/* ================= STEP 3: HASIL IMPOR (SELESAI) ================= */}
          {step === 3 && resultData && (
            <div className="py-4 space-y-5 text-center">
              <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <IconCheckCircle className="size-10" />
              </div>

              <div>
                <h3 className="text-lg font-extrabold text-ink">Impor Massal Selesai</h3>
                <p className="text-xs text-secondary mt-1 max-w-md mx-auto">
                  Data mahasiswa yang valid telah berhasil disimpan ke basis data dan akun pengguna telah aktif.
                </p>
              </div>

              {/* Kartu Ringkasan Hasil */}
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="rounded-xl border border-slate-900/[0.08] bg-slate-50 p-3">
                  <span className="text-[10px] uppercase font-bold text-muted block">Diproses</span>
                  <span className="text-xl font-black text-ink block mt-0.5">{resultData.total}</span>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Berhasil</span>
                  <span className="text-xl font-black text-emerald-700 block mt-0.5">
                    {resultData.imported}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-900/[0.08] bg-slate-50 p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-600 block">Dilewati</span>
                  <span className="text-xl font-black text-slate-600 block mt-0.5">{resultData.failed}</span>
                </div>
              </div>

              {/* Jika masih ada yang gagal, sediakan tombol unduh laporan */}
              {resultData.failed > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadErrors}
                    disabled={downloadingReport}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    {downloadingReport ? (
                      <IconSpinner className="size-3.5 text-brand" />
                    ) : (
                      <IconArrowDownTray className="size-3.5 text-slate-500" />
                    )}
                    <span>Unduh Laporan Baris yang Dilewati (.xlsx)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= FOOTER AKSI ================= */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-900/[0.08] shrink-0">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={uploading}
                className="rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleProceedToPreview}
                disabled={!selectedFile || uploading}
                className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <IconSpinner className="size-3.5" />
                    <span>Menganalisis Berkas…</span>
                  </>
                ) : (
                  <>
                    <span>Lanjutkan Validasi</span>
                    <IconArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={handleBackToFile}
                disabled={confirming}
                className="rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
              >
                Kembali / Ganti Berkas
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={confirming || !previewData || previewData.valid === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {confirming ? (
                  <>
                    <IconSpinner className="size-3.5" />
                    <span>Mengimpor Data Mahasiswa…</span>
                  </>
                ) : (
                  <span>Konfirmasi & Impor ({previewData?.valid || 0} Data)</span>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="rounded-xl bg-brand hover:bg-brand-hover text-white px-6 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Selesai & Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

