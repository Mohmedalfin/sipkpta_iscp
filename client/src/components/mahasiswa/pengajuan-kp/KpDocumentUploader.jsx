import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  IconArrowDownTray,
  IconArrowUpTray,
  IconCheckCircle,
  IconClose,
  IconDocumentText,
  IconExclamationCircle,
  IconEye,
  IconInformationCircle,
  IconSpinner,
} from '../../common/Icons.jsx';
import {
  KP_DOCUMENT_CODES,
  downloadKpDocumentFile,
  pengajuanKpErrorMessage,
  uploadKpDocument,
  validateKpDocumentFile,
} from '../../../services/pengajuanKp.js';
import { useToast } from '../../../context/ToastContext.jsx';

const PdfPreview = lazy(() => import('../../common/PdfPreview.jsx'));

/**
 * Format tanggal Indonesia ringkas untuk penanda waktu upload berkas
 */
function formatUploadDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(date) + ' WIB';
  } catch {
    return '';
  }
}

/**
 * Pemetaan toleransi kode berkas antara backend canonical dan varian
 */
const CODE_MATCH_MAP = {
  [KP_DOCUMENT_CODES.PROPOSAL]: ['PROPOSAL_KP'],
  [KP_DOCUMENT_CODES.BUKTI_BAYAR]: ['BUKTI_BAYAR_PROPOSAL_KP', 'BUKTI_PEMBAYARAN_KP'],
  [KP_DOCUMENT_CODES.SPP_VARIABEL]: ['BUKTI_SPP_VARIABEL_KP', 'SPP_VARIABEL_KP'],
  [KP_DOCUMENT_CODES.SERTIFIKAT_SOSIALISASI]: ['SERTIFIKAT_SOSIALISASI_KP', 'SOSIALISASI_KP'],
  [KP_DOCUMENT_CODES.SURAT_SOSIALISASI]: ['SURAT_PERNYATAAN_SOSIALISASI_KP', 'SURAT_SOSIALISASI_KP'],
};

/**
 * Ekstraksi kode jenis dari berbagai format relasi backend Prisma
 */
function extractDocCode(doc) {
  return (
    doc?.persyaratan_pengajuan?.jenis_dokumen?.kode_jenis ||
    doc?.jenis_dokumen?.kode_jenis ||
    doc?.persyaratan?.jenis_dokumen?.kode_jenis ||
    doc?.kode_jenis ||
    null
  );
}

/**
 * Metadata dan petunjuk jenis dokumen pengajuan KP
 */
const DOCUMENT_SPECS = {
  [KP_DOCUMENT_CODES.PROPOSAL]: {
    nama: 'Naskah Proposal Kerja Praktik',
    maxMb: 10,
    required: true,
  },
  [KP_DOCUMENT_CODES.BUKTI_BAYAR]: {
    nama: 'Bukti Pembayaran Proposal KP',
    maxMb: 5,
    required: true,
  },
  [KP_DOCUMENT_CODES.SPP_VARIABEL]: {
    nama: 'Bukti Pembayaran SPP Variabel',
    maxMb: 5,
    required: false, // Ditentukan dinamis oleh sudah_bayar_spp_variabel
  },
  [KP_DOCUMENT_CODES.SERTIFIKAT_SOSIALISASI]: {
    nama: 'Sertifikat Sosialisasi KP',
    maxMb: 5,
    required: false, // Pilihan alternatif
  },
  [KP_DOCUMENT_CODES.SURAT_SOSIALISASI]: {
    nama: 'Surat Pernyataan Sosialisasi KP',
    maxMb: 5,
    required: false, // Pilihan alternatif
  },
};

/**
 * Komponen Pengelola & Pengunggah Berkas Persyaratan Kerja Praktik (KP)
 * 
 * @param {object} props
 * @param {number|string|null} props.pengajuanId - ID Pengajuan aktif (wajib ada untuk mengunggah berkas)
 * @param {Array} props.dokumenList - Daftar berkas dokumen pengajuan yang sudah ada dari detail pengajuan
 * @param {boolean} props.sudahBayarSpp - Nilai konfirmasi SPP Variabel dari formulir
 * @param {Function} props.onDocumentUploaded - Callback saat dokumen berhasil diunggah (refresh detail)
 * @param {boolean} [props.disabled] - Status nonaktif saat submit
 * @param {boolean} [props.readOnly] - Status hanya-baca jika pengajuan sudah dikirim
 */
export default function KpDocumentUploader({
  pengajuanId,
  dokumenList = [],
  persyaratan = [],
  sudahBayarSpp = false,
  onDocumentUploaded,
  disabled = false,
  readOnly = false,
}) {
  const toast = useToast();
  const documentSpec = (code) => {
    const configured = persyaratan.find((item) => item.kode_jenis === code);
    return {
      ...DOCUMENT_SPECS[code],
      ...(configured ? {
        nama: configured.nama_jenis,
        maxMb: configured.maks_ukuran_mb,
        required: configured.is_wajib,
        deskripsi: configured.petunjuk,
      } : {}),
    };
  };

  // State upload per kode jenis: menyimpan kode_jenis yang sedang proses upload
  const [uploadingKode, setUploadingKode] = useState(null);

  /**
   * Helper mencari data dokumen pengajuan berdasarkan kode_jenis
   */
  const findDocument = (kodeJenis) => {
    if (!Array.isArray(dokumenList) || dokumenList.length === 0) return null;
    const matchTargets = CODE_MATCH_MAP[kodeJenis] || [kodeJenis];

    // Utamakan dokumen versi terkini (is_terkini: true)
    const current = dokumenList.find(
      (doc) => matchTargets.includes(extractDocCode(doc)) && doc.is_terkini !== false
    );
    if (current) return current;

    // Fallback bila properti is_terkini tidak diset eksplisit
    return (
      dokumenList.find((doc) => matchTargets.includes(extractDocCode(doc))) || null
    );
  };

  // Pilihan alternatif sosialisasi: 'SERTIFIKAT' atau 'SURAT'
  const [sosialisasiChoice, setSosialisasiChoice] = useState(() => {
    const hasSurat = dokumenList.some((d) => {
      const c = extractDocCode(d);
      return c === 'SURAT_PERNYATAAN_SOSIALISASI_KP' || c === 'SURAT_SOSIALISASI_KP';
    });
    return hasSurat ? 'SURAT' : 'SERTIFIKAT';
  });

  // Sinkronisasi otomatis tab sosialisasi saat berkas terunggah
  useEffect(() => {
    const hasSertifikat = Boolean(findDocument(KP_DOCUMENT_CODES.SERTIFIKAT_SOSIALISASI));
    const hasSurat = Boolean(findDocument(KP_DOCUMENT_CODES.SURAT_SOSIALISASI));
    if (hasSurat && !hasSertifikat) {
      setSosialisasiChoice('SURAT');
    } else if (hasSertifikat && !hasSurat) {
      setSosialisasiChoice('SERTIFIKAT');
    }
  }, [dokumenList]);

  // Hidden file input refs
  const fileInputRefs = useRef({});
  const previewRequestRef = useRef(0);
  const previewUrlRef = useRef(null);

  // State Pratinjau PDF Modal
  const [previewState, setPreviewState] = useState({
    isOpen: false,
    title: '',
    url: null,
    loading: false,
    error: null,
  });

  useEffect(() => () => {
    previewRequestRef.current += 1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  /**
   * Memicu dialog pemilih file
   */
  const handleTriggerPicker = (kodeJenis) => {
    if (!pengajuanId) {
      toast.error('Silakan simpan draf formulir terlebih dahulu sebelum mengunggah berkas.');
      return;
    }
    if (uploadingKode || disabled || readOnly) return;

    const input = fileInputRefs.current[kodeJenis];
    if (input) {
      input.value = '';
      input.click();
    }
  };

  /**
   * Menangani pemilihan berkas dan proses upload
   */
  const handleFileChange = async (event, kodeJenis) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const spec = documentSpec(kodeJenis);

    // 1. Validasi berkas di sisi klien
    const validation = validateKpDocumentFile(file, spec.maxMb);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // 2. Kirim berkas ke backend
    setUploadingKode(kodeJenis);
    try {
      const res = await uploadKpDocument(pengajuanId, kodeJenis, file);
      const vNum = res?.nomor_versi || res?.versi?.nomor_versi || 1;
      toast.success(`Berkas ${spec.nama} berhasil diunggah (Versi ${vNum})!`);

      if (typeof onDocumentUploaded === 'function') {
        await onDocumentUploaded();
      }
    } catch (err) {
      const msg = pengajuanKpErrorMessage(err, `Gagal mengunggah ${spec.nama}.`);
      toast.error(msg);
    } finally {
      setUploadingKode(null);
      if (event.target) event.target.value = '';
    }
  };

  /**
   * Membuka modal pratinjau dokumen PDF
   */
  const handleOpenPreview = async (doc, spec) => {
    if (!pengajuanId || !doc?.id) return;
    const requestId = ++previewRequestRef.current;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;

    setPreviewState({
      isOpen: true,
      title: spec.nama,
      url: null,
      loading: true,
      error: null,
    });

    try {
      const blob = await downloadKpDocumentFile(pengajuanId, doc.id);
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(pdfBlob);
      if (requestId !== previewRequestRef.current) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      previewUrlRef.current = objectUrl;
      setPreviewState((prev) => ({
        ...prev,
        loading: false,
        url: objectUrl,
      }));
    } catch (err) {
      if (requestId !== previewRequestRef.current) return;
      const msg = pengajuanKpErrorMessage(err, 'Gagal memuat berkas PDF untuk pratinjau.');
      setPreviewState((prev) => ({
        ...prev,
        loading: false,
        error: msg,
      }));
    }
  };

  /**
   * Menutup modal pratinjau dan membersihkan blob url
   */
  const handleClosePreview = () => {
    previewRequestRef.current += 1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewState({
      isOpen: false,
      title: '',
      url: null,
      loading: false,
      error: null,
    });
  };

  /**
   * Mengunduh berkas langsung ke perangkat mahasiswa
   */
  const handleDownloadFile = async (doc, spec) => {
    if (!pengajuanId || !doc?.id) return;
    try {
      toast.info(`Mengunduh berkas ${spec.nama}...`);
      const blob = await downloadKpDocumentFile(pengajuanId, doc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kodeJenisFormat(spec.nama)}_${pengajuanId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const msg = pengajuanKpErrorMessage(err, 'Gagal mengunduh berkas dokumen.');
      toast.error(msg);
    }
  };

  function kodeJenisFormat(str) {
    return (str || 'Dokumen').replace(/\s+/g, '_');
  }

  // Render kartu unggah dokumen
  const renderDocumentCard = (kodeJenis, isMandatoryOverride = null) => {
    const spec = documentSpec(kodeJenis);
    const doc = findDocument(kodeJenis);
    const isUploaded = Boolean(doc);
    const isUploading = uploadingKode === kodeJenis;
    const isRequired = isMandatoryOverride !== null ? isMandatoryOverride : spec.required;

    const versiTerbaru =
      doc?.nomor_versi ??
      doc?.versi_dokumen?.[0]?.nomor_versi ??
      (isUploaded ? 1 : null);

    const namaFile = doc?.dokumen?.nama_file_asli || null;
    const fileSizeMb = doc?.dokumen?.ukuran_bytes
      ? (Number(doc.dokumen.ukuran_bytes) / (1024 * 1024)).toFixed(2)
      : null;

    return (
      <div
        key={kodeJenis}
        className={`rounded-xl border p-4 transition-all sm:p-5 ${
          isUploaded
            ? 'border-emerald-300 bg-emerald-50/25 shadow-2xs'
            : isRequired
            ? 'border-line bg-white'
            : 'border-dashed border-line bg-subtle/30'
        }`}
      >
        {/* Hidden File Input */}
        <input
          ref={(el) => {
            fileInputRefs.current[kodeJenis] = el;
          }}
          type="file"
          accept=".pdf,application/pdf"
          disabled={disabled || readOnly || isUploading}
          onChange={(e) => handleFileChange(e, kodeJenis)}
          className="hidden"
          aria-hidden="true"
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Kolom Info Berkas */}
          <div className="flex items-start gap-3 min-w-0">
            {isUploaded ? (
              <IconCheckCircle className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            ) : (
              <IconDocumentText className="mt-0.5 size-5 shrink-0 text-muted" />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-ink">
                  {spec.nama}
                </h4>
                {isRequired ? (
                  <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-danger border border-rose-200">
                    Wajib
                  </span>
                ) : (
                  <span className="rounded-md bg-subtle px-2 py-0.5 text-xs font-medium text-secondary border border-line">
                    Kondisional / Opsional
                  </span>
                )}
                {isUploaded ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <IconCheckCircle className="size-3 text-emerald-700" />
                    Terunggah (v{versiTerbaru})
                  </span>
                ) : (
                  <span className="rounded-md bg-subtle px-2 py-0.5 text-xs font-medium text-muted border border-line">
                    Belum Diunggah
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-secondary leading-relaxed">
                {spec.deskripsi}
              </p>

              {/* Tampilan Khusus Saat Sudah Terunggah: Box Detail Berkas Terlampir */}
              {isUploaded ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                    <IconDocumentText className="size-4 shrink-0 text-emerald-600" />
                    <span className="max-w-[200px] truncate font-medium text-ink sm:max-w-xs" title={namaFile || 'Berkas PDF'}>
                      {namaFile || `${spec.nama}.pdf`}
                    </span>
                    {fileSizeMb && (
                      <span className="border-l border-line pl-2 text-[11px] text-muted">
                        {fileSizeMb} MB
                      </span>
                    )}
                  </div>
                  {doc.created_at && (
                    <span className="text-[11px] text-muted">
                      Diunggah: {formatUploadDate(doc.created_at)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                  <span>Format: <strong>PDF</strong></span>
                  <span>•</span>
                  <span>Maks: <strong>{spec.maxMb} MB</strong></span>
                </div>
              )}

              {/* Catatan Pemeriksaan (jika ada catatan admin/reviewer) */}
              {doc?.catatan_pemeriksaan && (
                <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <span className="font-semibold">Catatan Pemeriksa: </span>
                  <span>{doc.catatan_pemeriksaan}</span>
                </div>
              )}
            </div>
          </div>

          {/* Kolom Tombol Aksi */}
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {isUploading ? (
              <span className="inline-flex items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-xs font-medium text-secondary">
                <IconSpinner className="size-4 animate-spin text-brand" />
                Mengunggah...
              </span>
            ) : isUploaded ? (
              <>
                {/* Tombol Pratinjau */}
                <button
                  type="button"
                  onClick={() => handleOpenPreview(doc, spec)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition hover:bg-subtle focus:outline-hidden"
                >
                  <IconEye className="size-3.5 text-secondary" />
                  Pratinjau
                </button>

                {/* Tombol Unduh */}
                <button
                  type="button"
                  onClick={() => handleDownloadFile(doc, spec)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-secondary shadow-2xs transition hover:bg-subtle focus:outline-hidden"
                  title="Unduh berkas PDF"
                >
                  <IconArrowDownTray className="size-3.5" />
                  Unduh
                </button>

                {/* Tombol Ganti Berkas (Versi Baru) */}
                {!readOnly && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleTriggerPicker(kodeJenis)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs transition hover:bg-emerald-50 focus:outline-hidden disabled:opacity-50"
                  >
                    <IconArrowUpTray className="size-3.5 text-emerald-700" />
                    Ganti Berkas
                  </button>
                )}
              </>
            ) : (
              /* Tombol Unggah Pertama Kali */
              !readOnly && (
                <button
                  type="button"
                  disabled={disabled || !pengajuanId}
                  onClick={() => handleTriggerPicker(kodeJenis)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-hover focus:outline-hidden disabled:opacity-50"
                >
                  <IconArrowUpTray className="size-3.5" />
                  Unggah Berkas PDF
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section
      aria-labelledby="section-dokumen-heading"
      className="rounded-xl border border-line bg-white p-5 shadow-2xs"
    >
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <IconDocumentText className="size-5 text-brand" />
        <h3 id="section-dokumen-heading" className="text-sm font-bold text-ink sm:text-base">
          4. Berkas Persyaratan Kerja Praktik
        </h3>
      </div>

      {!pengajuanId && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-subtle/50 px-3 py-2 text-xs text-secondary">
          <IconInformationCircle className="size-4 shrink-0 text-muted" />
          <span>Simpan formulir sebagai draf terlebih dahulu untuk mulai mengunggah berkas persyaratan.</span>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {/* 1. Naskah Proposal KP (Wajib, 10 MB) */}
        {renderDocumentCard(KP_DOCUMENT_CODES.PROPOSAL, true)}

        {/* 2. Bukti Pembayaran Proposal (Wajib, 5 MB) */}
        {renderDocumentCard(KP_DOCUMENT_CODES.BUKTI_BAYAR, true)}

        {/* 3. Bukti SPP Variabel (Kondisional: Wajib jika sudah_bayar_spp_variabel == true) */}
        {renderDocumentCard(KP_DOCUMENT_CODES.SPP_VARIABEL, sudahBayarSpp)}

        {/* 4. Berkas Sosialisasi KP (Pilihan Alternatif: Sertifikat ATAU Surat Pernyataan) */}
        <div className="rounded-xl border border-line p-4 sm:p-5">
          <div className="border-b border-line pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-ink">
                Bukti Keikutsertaan Sosialisasi KP
              </h4>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 border border-amber-200">
                Wajib Salah Satu
              </span>
            </div>
            <p className="mt-1 text-xs text-secondary">
              Pilih salah satu jenis bukti sosialisasi yang Anda miliki: Sertifikat Kehadiran Resmi atau Surat Pernyataan.
            </p>

            {/* Selector Tab / Radio Sosialisasi */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink sm:text-sm">
                <input
                  type="radio"
                  name="sosialisasi_choice"
                  checked={sosialisasiChoice === 'SERTIFIKAT'}
                  onChange={() => setSosialisasiChoice('SERTIFIKAT')}
                  disabled={disabled || readOnly}
                  className="size-4 text-brand focus:ring-brand"
                />
                <span>Sertifikat Sosialisasi KP</span>
                {findDocument(KP_DOCUMENT_CODES.SERTIFIKAT_SOSIALISASI) && (
                  <span className="text-[11px] font-semibold text-emerald-700">(Sudah Terunggah)</span>
                )}
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink sm:text-sm">
                <input
                  type="radio"
                  name="sosialisasi_choice"
                  checked={sosialisasiChoice === 'SURAT'}
                  onChange={() => setSosialisasiChoice('SURAT')}
                  disabled={disabled || readOnly}
                  className="size-4 text-brand focus:ring-brand"
                />
                <span>Surat Pernyataan Sosialisasi KP</span>
                {findDocument(KP_DOCUMENT_CODES.SURAT_SOSIALISASI) && (
                  <span className="text-[11px] font-semibold text-emerald-700">(Sudah Terunggah)</span>
                )}
              </label>
            </div>
          </div>

          <div className="mt-4">
            {sosialisasiChoice === 'SERTIFIKAT'
              ? renderDocumentCard(KP_DOCUMENT_CODES.SERTIFIKAT_SOSIALISASI, true)
              : renderDocumentCard(KP_DOCUMENT_CODES.SURAT_SOSIALISASI, true)}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Modal Pratinjau PDF                                          */}
      {/* ============================================================ */}
      {previewState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
        >
          {/* Backdrop */}
          <div
            onClick={handleClosePreview}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2">
                <IconDocumentText className="size-5 text-brand" />
                <h3 id="preview-title" className="text-sm font-bold text-ink sm:text-base">
                  Pratinjau: {previewState.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClosePreview}
                className="rounded-lg p-1.5 text-secondary hover:bg-subtle focus:outline-hidden"
                aria-label="Tutup pratinjau"
              >
                <IconClose className="size-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="relative flex-1 overflow-hidden bg-canvas p-3 sm:p-4">
              {previewState.loading ? (
                <div className="grid h-full place-items-center">
                  <div className="flex flex-col items-center gap-2 text-secondary">
                    <IconSpinner className="size-6 text-brand" />
                    <span className="text-xs">Memuat berkas PDF...</span>
                  </div>
                </div>
              ) : previewState.error ? (
                <div className="grid h-full place-items-center p-6 text-center">
                  <div className="max-w-md space-y-2">
                    <IconExclamationCircle className="mx-auto size-8 text-danger" />
                    <p className="text-sm font-semibold text-ink">Gagal Membuka Berkas</p>
                    <p className="text-xs text-secondary">{previewState.error}</p>
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
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

