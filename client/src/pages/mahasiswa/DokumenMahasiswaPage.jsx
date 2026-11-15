import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  IconArrowDownTray,
  IconArrowUpTray,
  IconCheckCircle,
  IconClose,
  IconDocumentText,
  IconExclamationCircle,
  IconExclamationTriangle,
  IconEye,
  IconInformationCircle,
  IconLockClosed,
  IconSpinner,
} from '../../components/common/Icons.jsx';
import boxIcon from '../../assets/NoBackground Box.svg';
import { useToast } from '../../context/ToastContext.jsx';
import {
  dataDiriErrorMessage,
  fetchDocumentBlob,
  fetchMyDataDiri,
  uploadDocumentFile,
} from '../../services/dataDiri.js';

const PdfPreview = lazy(() => import('../../components/common/PdfPreview.jsx'));

const DOCUMENT_METADATA = {
  IJAZAH: {
    description: 'Ijazah Pendidikan Terakhir / Surat Keterangan Lulus (SKL)',
    tip: 'Pastikan nomor ijazah, stempel legalisir, dan tanda tangan rektor/kepala sekolah terlihat jelas.',
  },
  KK: {
    description: 'Kartu Keluarga (KK) Asli atau Legalisir',
    tip: 'Pastikan seluruh anggota keluarga dan NIK kepala keluarga terbaca dengan jelas.',
  },
  KTP: {
    description: 'Kartu Tanda Penduduk (KTP) Elektronik Asli',
    tip: 'Pindai/scan sisi depan KTP dalam posisi tegak dan tidak terpotong tepi sudutnya.',
  },
  AKTA: {
    description: 'Akta Kelahiran Resmi dari Dukcapil',
    tip: 'Pastikan nama lengkap, nomor akta, dan tanggal kelahiran sesuai dengan data akademik.',
  },
  KTM: {
    description: 'Kartu Tanda Mahasiswa (KTM) Universitas Teknologi Yogyakarta',
    tip: 'Gunakan KTM fisik atau KTM digital resmi yang mencantumkan NIM dan status aktif Anda.',
  },
  FORM_DATA_DIRI: {
    description: 'Formulir Kelengkapan Data Diri Mahasiswa',
    tip: 'Pastikan formulir telah diisi lengkap dan dibubuhi tanda tangan yang sah.',
  },
};

export default function DokumenMahasiswaPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Uploading state: stores kode_jenis of document currently uploading
  const [uploadingKode, setUploadingKode] = useState(null);

  // Hidden file input refs
  const fileInputRefs = useRef({});
  const previewRequestRef = useRef(0);
  const previewUrlRef = useRef(null);

  // Preview Modal state
  const [previewState, setPreviewState] = useState({
    isOpen: false,
    kodeJenis: null,
    namaJenis: '',
    versi: null,
    url: null,
    loading: false,
    error: null,
  });

  useEffect(() => () => {
    previewRequestRef.current += 1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyDataDiri();
      setData(res);
    } catch (err) {
      const msg = dataDiriErrorMessage(err, 'Gagal memuat dokumen data diri.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle triggering file picker
  const handleTriggerUpload = (kodeJenis) => {
    if (uploadingKode) return;
    const input = fileInputRefs.current[kodeJenis];
    if (input) {
      input.value = '';
      input.click();
    }
  };

  // Handle file selection and upload
  const handleFileChange = async (event, kodeJenis, namaJenis) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Client-side file validation
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.pdf') && file.type !== 'application/pdf') {
      toast.error('Format berkas harus PDF (.pdf).');
      return;
    }

    if (file.size === 0) {
      toast.error('Berkas PDF kosong (0 byte). Silakan pilih berkas yang valid.');
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      toast.error(`Ukuran berkas (${sizeMb} MB) melebihi batas maksimal 5 MB.`);
      return;
    }

    // 2. Perform upload
    setUploadingKode(kodeJenis);
    try {
      const res = await uploadDocumentFile(kodeJenis, file);
      toast.success(`Berkas ${namaJenis} berhasil diunggah (Versi ${res.versi})!`);

      // Refresh data to keep progress bar and status synchronized
      const updated = await fetchMyDataDiri();
      setData(updated);
    } catch (err) {
      const msg = dataDiriErrorMessage(err, `Gagal mengunggah berkas ${namaJenis}.`);
      toast.error(msg);
    } finally {
      setUploadingKode(null);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Handle Preview Document
  const handleOpenPreview = async (doc) => {
    const requestId = ++previewRequestRef.current;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;

    setPreviewState({
      isOpen: true,
      kodeJenis: doc.kode_jenis,
      namaJenis: doc.nama_jenis,
      versi: doc.versi_terkini,
      url: null,
      loading: true,
      error: null,
    });

    try {
      const blob = await fetchDocumentBlob(doc.kode_jenis);
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
      const msg = dataDiriErrorMessage(err, 'Gagal membuka berkas dokumen.');
      setPreviewState((prev) => ({
        ...prev,
        loading: false,
        error: msg,
      }));
    }
  };

  const handleClosePreview = () => {
    previewRequestRef.current += 1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewState({
      isOpen: false,
      kodeJenis: null,
      namaJenis: '',
      versi: null,
      url: null,
      loading: false,
      error: null,
    });
  };

  // Close preview modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && previewState.isOpen) {
        handleClosePreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewState.isOpen, previewState.url]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 animate-pulse">
        <div className="border-b border-slate-900/[0.06] pb-5">
          <div className="h-3 w-32 bg-slate-200/60 rounded mb-2" />
          <div className="h-7 w-60 bg-slate-200/60 rounded mb-2" />
          <div className="h-3.5 w-96 bg-slate-200/40 rounded" />
        </div>
        <div className="h-44 rounded-[18px] bg-white/60 border border-slate-900/[0.06]" />
        <div className="h-96 rounded-[18px] bg-white/60 border border-slate-900/[0.06]" />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-md my-12 text-center">
        <div className="p-8 rounded-[18px] border border-slate-900/[0.08] bg-white/75 shadow-none flex flex-col items-center">
          <IconExclamationCircle className="size-8 text-danger mb-3" />
          <h2 className="text-base font-bold text-ink">Gagal Memuat Dokumen</h2>
          <p className="mt-2 text-xs text-secondary leading-relaxed">
            {error || 'Data dokumen identitas tidak dapat ditemukan.'}
          </p>
          <button
            type="button"
            onClick={loadData}
            className="mt-5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-semibold shadow-none transition-colors cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const { dokumen, kelengkapan } = data;
  const progressPercent = kelengkapan
    ? Math.round((kelengkapan.jumlah_terunggah / kelengkapan.jumlah_wajib) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* 1. Header Halaman */}
      <div className="border-b border-slate-900/[0.06] pb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Verifikasi Data Diri
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Dokumen Data Diri
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-secondary">
          Unggah dan kelola 6 berkas identitas akademik wajib Anda untuk keperluan verifikasi resmi Admin Program Studi.
        </p>
      </div>

      {/* 2. Banner Ringkasan Progres Kelengkapan (Translucent Surface) */}
      <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 p-6 sm:p-7 shadow-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Kolom Kiri: Progress & Status */}
          <div className="lg:col-span-7 space-y-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Status Kelengkapan
              </span>

              {/* Status Badge Global */}
              {kelengkapan.sudah_diverifikasi ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Terverifikasi Admin Prodi
                </span>
              ) : kelengkapan.lengkap ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/70 bg-blue-50/80 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                  Lengkap (6/6) • Menunggu Verifikasi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50/80 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  <span className="size-2 rounded-full bg-amber-500" />
                  Belum Lengkap ({kelengkapan.jumlah_wajib - kelengkapan.jumlah_terunggah} berkas belum diunggah)
                </span>
              )}
            </div>

            {/* Counter & Progress bar */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-ink tracking-tight font-mono">
                    {kelengkapan.jumlah_terunggah}
                  </span>
                  <span className="text-sm font-semibold text-muted">
                    / {kelengkapan.jumlah_wajib} Berkas Diunggah
                  </span>
                </div>
                <span className="text-sm font-bold text-ink font-mono">
                  {progressPercent}%
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-slate-900/[0.06] overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              {kelengkapan.sudah_diverifikasi
                ? 'Seluruh berkas identitas Anda telah diverifikasi dan disetujui secara resmi oleh Admin Program Studi.'
                : kelengkapan.lengkap
                ? 'Semua 6 berkas telah lengkap diunggah. Berkas Anda sedang dalam antrean pemeriksaan oleh Sekretariat Program Studi.'
                : 'Silakan unggah keenam berkas identitas di bawah. Anda dapat mengunggahnya satu per satu secara bertahap.'}
            </p>
          </div>

          {/* Kolom Kanan: Petunjuk Teknis Berkas */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-900/[0.06] pt-5 lg:pt-0 lg:pl-6 space-y-2.5">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <IconInformationCircle className="size-4 text-slate-500 shrink-0" />
              <span>Petunjuk Berkas</span>
            </h3>

            <ul className="text-xs text-secondary space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>Format berkas wajib <strong>PDF (.pdf)</strong> saja.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>Ukuran maksimal tiap berkas adalah <strong>5 MB</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>Dokumen dipindai (*scan*) berwarna, terbaca jelas, dan tidak terpotong.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 3. Daftar 6 Dokumen Wajib (Opsi A: Structured Row Cards) */}
      <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 p-6 sm:p-7 shadow-none space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-900/[0.06] gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-ink">Daftar Berkas Identitas Wajib</h2>
              <span className="inline-flex items-center rounded-full border border-slate-900/[0.08] bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                6 Berkas
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Klik tombol aksi pada masing-masing dokumen untuk mengunggah, mengganti, atau melihat pratinjau berkas.
            </p>
          </div>
        </div>

        {/* List of 6 documents */}
        <div className="divide-y divide-slate-900/[0.06]">
          {dokumen.map((doc, idx) => {
            const meta = DOCUMENT_METADATA[doc.kode_jenis] || {};
            const isUploadingThis = uploadingKode === doc.kode_jenis;
            const isVerified = doc.status_dokumen === 'TERVERIFIKASI';
            const isNeedsRevision = doc.status_dokumen === 'PERLU_PERBAIKAN';
            const isPending = doc.status_dokumen === 'BELUM_DIPERIKSA';
            const isNotUploaded = !doc.is_uploaded;

            return (
              <div
                key={doc.kode_jenis}
                className={`py-4.5 sm:py-5 first:pt-2 last:pb-2 transition-colors ${
                  isNeedsRevision ? 'rounded-2xl p-4 bg-amber-50/40 my-2' : ''
                }`}
              >
                {/* Hidden File Input */}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  ref={(el) => {
                    fileInputRefs.current[doc.kode_jenis] = el;
                  }}
                  onChange={(e) => handleFileChange(e, doc.kode_jenis, doc.nama_jenis)}
                  disabled={Boolean(uploadingKode) || isVerified}
                />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Bagian Kiri: Nomor, Ikon & Informasi Dokumen */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <span className="text-xs font-mono font-bold text-slate-400 mt-0.5 shrink-0">
                      0{idx + 1}
                    </span>

                    <IconDocumentText className="size-5 text-slate-500 shrink-0 mt-0.5" />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-ink leading-tight">
                          {doc.nama_jenis}
                        </h3>

                        {/* Versi pill */}
                        {doc.is_uploaded && doc.versi_terkini && (
                          <span className="inline-flex items-center rounded-full border border-slate-900/[0.08] bg-white/70 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-600">
                            Versi {doc.versi_terkini}
                          </span>
                        )}

                        {/* Status Badge */}
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Terverifikasi
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/70 bg-blue-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
                            <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
                            Belum Diperiksa
                          </span>
                        ) : isNeedsRevision ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            Perlu Perbaikan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                            <span className="size-1.5 rounded-full bg-slate-400" />
                            Belum Diunggah
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-secondary mt-1">
                        {meta.description || doc.nama_jenis}
                      </p>

                      <p className="text-[11px] text-muted mt-0.5 hidden sm:block">
                        {meta.tip}
                      </p>
                    </div>
                  </div>

                  {/* Bagian Kanan: Tombol Aksi */}
                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center pl-7 md:pl-0">
                    {/* Tombol Lihat Berkas (Pratinjau) */}
                    {doc.is_uploaded && (
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(doc)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.08] bg-white/70 hover:bg-white px-3 py-1.5 text-xs font-semibold text-secondary transition-colors cursor-pointer"
                        title="Lihat pratinjau berkas PDF"
                      >
                        <IconEye className="size-3.5 text-slate-500" />
                        <span>Pratinjau</span>
                      </button>
                    )}

                    {/* Tombol Unggah / Ganti Berkas */}
                    {isVerified ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-900/[0.06] bg-slate-100/60 px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed"
                        title="Berkas telah diverifikasi dan dikunci oleh Admin Prodi"
                      >
                        <IconLockClosed className="size-3.5 text-slate-400" />
                        <span>Terkunci</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTriggerUpload(doc.kode_jenis)}
                        disabled={Boolean(uploadingKode)}
                        className={`inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold px-3.5 py-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          isNotUploaded
                            ? 'bg-brand hover:bg-brand-hover text-white'
                            : 'border border-slate-900/[0.08] bg-white/70 hover:bg-white text-ink'
                        }`}
                      >
                        {isUploadingThis ? (
                          <>
                            <IconSpinner className="size-3.5" />
                            <span>Mengunggah…</span>
                          </>
                        ) : (
                          <>
                            <IconArrowUpTray className="size-3.5" />
                            <span>{isNotUploaded ? 'Unggah PDF' : 'Ganti Berkas'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Box Catatan Revisi Admin (Jika status PERLU_PERBAIKAN) */}
                {isNeedsRevision && doc.catatan_admin && (
                  <div className="mt-3.5 ml-0 sm:ml-7 p-3 rounded-xl border border-amber-300/80 bg-white/90 text-xs text-amber-950 flex items-start gap-2 shadow-none">
                    <IconExclamationTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900 block">
                        Catatan Pemeriksaan Admin Prodi:
                      </span>
                      <p className="mt-0.5 text-secondary leading-relaxed">
                        {doc.catatan_admin}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Modal Pratinjau PDF */}
      {previewState.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-modal-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
        >
          <div className="relative w-full max-w-4xl h-[88vh] rounded-[20px] border border-slate-900/[0.1] bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-900/[0.06] bg-slate-50/50">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={boxIcon}
                  alt=""
                  className="size-9 sm:size-10 shrink-0 select-none pointer-events-none object-contain"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <h2 id="preview-modal-title" className="text-sm font-bold text-ink truncate">
                    {previewState.namaJenis}
                  </h2>
                  <p className="text-[11px] text-muted font-mono">
                    {previewState.versi ? `Versi ${previewState.versi}` : 'Dokumen Terkini'} • PDF Resmi
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewState.url && (
                  <a
                    href={previewState.url}
                    download={`${previewState.kodeJenis || 'dokumen'}.pdf`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.08] bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-secondary transition-colors cursor-pointer"
                    title="Unduh berkas PDF ke perangkat"
                  >
                    <IconArrowDownTray className="size-3.5" />
                    <span className="hidden sm:inline">Unduh PDF</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="size-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-ink hover:bg-slate-200/50 transition-colors cursor-pointer"
                  aria-label="Tutup pratinjau"
                >
                  <IconClose className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-2 relative overflow-hidden">
              {previewState.loading ? (
                <div className="flex flex-col items-center gap-2 text-xs text-secondary">
                  <IconSpinner className="size-6 text-brand" />
                  <span>Memuat pratinjau dokumen…</span>
                </div>
              ) : previewState.error ? (
                <div className="p-6 max-w-md text-center bg-white rounded-2xl border border-slate-900/[0.08]">
                  <IconExclamationCircle className="size-8 text-danger mx-auto mb-2" />
                  <p className="text-xs text-secondary">{previewState.error}</p>
                  <button
                    type="button"
                    onClick={() => handleOpenPreview({ kode_jenis: previewState.kodeJenis, nama_jenis: previewState.namaJenis, versi_terkini: previewState.versi })}
                    className="mt-4 rounded-xl bg-brand text-white px-3 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : previewState.url ? (
                <Suspense fallback={(
                  <div className="flex items-center gap-2 text-xs text-secondary" role="status">
                    <IconSpinner className="size-5 text-brand" /> Menyiapkan penampil PDF…
                  </div>
                )}>
                  <PdfPreview url={previewState.url} title={previewState.namaJenis} />
                </Suspense>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
