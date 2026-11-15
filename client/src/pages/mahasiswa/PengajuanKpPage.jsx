import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useKpReviews from '../../hooks/useKpReviews.js';
import useLiveKpDetail from '../../hooks/useLiveKpDetail.js';
import { useToast } from '../../context/ToastContext.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import {
  IconArrowLeft,
  IconCheckCircle,
  IconClipboardCheck,
  IconExclamationCircle,
  IconRefresh,
  IconSpinner,
} from '../../components/common/Icons.jsx';
import {
  KpApplicationTracker,
  KpChecklistSidebar,
  KpDocumentUploader,
  KpGeneralForm,
  KpLockedState,
  KpPrerequisiteCheck,
  KpScheduleBanner,
} from '../../components/mahasiswa/pengajuan-kp/index.js';
import KpAdministrativeRevision from '../../components/mahasiswa/pengajuan-kp/KpAdministrativeRevision.jsx';
import KpApplicationHistory from '../../components/mahasiswa/pengajuan-kp/KpApplicationHistory.jsx';
import { buildKpFormPayload, selectKpApplication, validateKpDraftNumbers } from '../../utils/kpForm.js';
import {
  KP_STATUS_PENGAJUAN,
  createKpDraft,
  getKpApplicationDetail,
  getKpFormOptions,
  listAllOwnKpApplications,
  pengajuanKpErrorMessage,
  submitKpApplication,
  updateKpDraft,
} from '../../services/pengajuanKp.js';

const INITIAL_FORM_STATE = Object.freeze({
  objek_penelitian: '',
  lokasi_penelitian: '',
  tema_penelitian_id: '',
  judul_penelitian: '',
  usulan_pembimbing_id: '',
  ipk_saat_pengajuan: '',
  jumlah_sks_saat_pengajuan: '',
  memiliki_nilai_de: null,
  daftar_mk_nilai_de: '',
  sudah_bayar_spp_variabel: null,
});

/**
 * Halaman Orkestrator Pengajuan Kerja Praktik (KP) Mahasiswa - SIPKITA
 * Mengatur siklus hidup formulir pengajuan: Draf, Validasi, Unggah Berkas, Submit, dan Pelacakan
 */
export default function PengajuanKpPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // State Utama Halaman
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data Master & Opsi Form dari Backend
  const [opsiForm, setOpsiForm] = useState(null);

  // Detail Pengajuan Aktif Mahasiswa (bila ada)
  const [activePengajuan, setActivePengajuan] = useState(null);
  useLiveKpDetail(activePengajuan, setActivePengajuan);
  const { reviews, reviewError } = useKpReviews(activePengajuan);
  const [historyItems, setHistoryItems] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const loadSequence = useRef(0);

  // State Formulir Pengajuan
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [formErrors, setFormErrors] = useState({});
  const [setujuPernyataan, setSetujuPernyataan] = useState(false);

  // Loading Actions State
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  /**
   * Memuat opsi form, status jadwal, kelengkapan data diri, dan pengajuan KP aktif
   */
  const loadPageData = async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    setOpsiForm(null);
    setActivePengajuan(null);
    void queryClient.invalidateQueries({ queryKey: ['kp-reviews'], refetchType: 'none' });

    try {
      const [applicationsResult, optionsResult] = await Promise.allSettled([
        listAllOwnKpApplications(), getKpFormOptions('KP'),
      ]);
      if (sequence !== loadSequence.current) return;
      if (applicationsResult.status === 'rejected') throw applicationsResult.reason;
      const applications = applicationsResult.value;
      const optionsRes = optionsResult.status === 'fulfilled' ? optionsResult.value : null;
      const normalizedOptions = optionsRes && {
        ...optionsRes,
        tema_penelitian: optionsRes.tema,
        dosen_pembimbing: optionsRes.kandidat_pembimbing,
        jadwal: {
          ...optionsRes.jadwal,
          tgl_mulai: optionsRes.jadwal.tanggal_buka,
          tgl_selesai: optionsRes.jadwal.tanggal_tutup,
          tahun_ajaran: optionsRes.periode.tahun_ajaran,
          semester: optionsRes.periode.semester,
        },
      };
      setOpsiForm(normalizedOptions);
      const { selected, history } = selectKpApplication(
        applications, optionsRes?.periode?.id ?? null, selectedHistoryId,
      );
      setHistoryItems(history);

      if (selected) {
        const detail = await getKpApplicationDetail(selected.id);
        if (sequence !== loadSequence.current) return;
        queryClient.setQueryData(['kp-detail', detail.id], detail);
        setActivePengajuan(detail);

        if (detail.status_pengajuan === KP_STATUS_PENGAJUAN.DRAFT &&
            optionsRes && !selectedHistoryId) {
          setFormData({
            objek_penelitian: detail.versi_topik?.objek_penelitian || '',
            lokasi_penelitian: detail.versi_topik?.lokasi_penelitian || '',
            tema_penelitian_id: detail.topik_penelitian?.tema_penelitian?.id || '',
            judul_penelitian: detail.versi_topik?.judul_penelitian || '',
            usulan_pembimbing_id: detail.usulan_pembimbing?.id || '',
            ipk_saat_pengajuan: detail.ipk_saat_pengajuan ?? '',
            jumlah_sks_saat_pengajuan: detail.jumlah_sks_saat_pengajuan ?? '',
            memiliki_nilai_de: detail.memiliki_nilai_de,
            daftar_mk_nilai_de: detail.daftar_mk_nilai_de || '',
            sudah_bayar_spp_variabel: detail.sudah_bayar_spp_variabel,
          });
        }
      } else {
        setFormData(INITIAL_FORM_STATE);
      }
      if (!optionsRes) {
        setError(pengajuanKpErrorMessage(optionsResult.reason, 'Jadwal KP belum tersedia.'));
      }
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      const msg = pengajuanKpErrorMessage(err, 'Gagal memuat formulir pengajuan KP.');
      setError(msg);
      toast.error(msg);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
    return () => { loadSequence.current += 1; };
  }, [selectedHistoryId]);

  /**
   * Handler perubahan nilai input formulir
   */
  const handleFormChange = (fieldName, value) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));

    // Hapus error inline pada field yang sedang diedit
    if (formErrors[fieldName]) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      });
    }
  };

  /**
   * Validasi client sebelum menyimpan draf awal
   */
  const validateForDraft = () => {
    const errors = validateKpDraftNumbers(formData);
    if (!formData.tema_penelitian_id) {
      errors.tema_penelitian_id = 'Pilih tema penelitian terlebih dahulu untuk menyimpan draf.';
    }
    if (!formData.judul_penelitian?.trim()) {
      errors.judul_penelitian = 'Tuliskan usulan judul KP untuk menyimpan draf.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Menyimpan isian formulir sebagai Draf di server
   */
  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting) return;
    if (!validateForDraft()) {
      toast.error('Lengkapi Tema Penelitian dan Usulan Judul terlebih dahulu untuk menyimpan draf.');
      return;
    }

    setIsSavingDraft(true);
    try {
      const payload = buildKpFormPayload(formData);

      let resultApp;
      if (activePengajuan?.id) {
        // Update draft yang ada
        resultApp = await updateKpDraft(activePengajuan.id, payload);
        toast.success('Draf pengajuan KP berhasil diperbarui.');
      } else {
        // Buat draft pengajuan baru
        resultApp = await createKpDraft(payload);
        toast.success('Draf pengajuan KP berhasil dibuat! Anda sekarang dapat mengunggah berkas persyaratan.');
      }

      // Muat ulang detail pengajuan terbaru agar ID dan relasi tersinkron
      const detail = await getKpApplicationDetail(resultApp.id);
      setActivePengajuan(detail);
    } catch (err) {
      const msg = pengajuanKpErrorMessage(err, 'Gagal menyimpan draf pengajuan KP.');
      toast.error(msg);
    } finally {
      setIsSavingDraft(false);
    }
  };

  /**
   * Callback saat satu berkas dokumen berhasil diunggah (refresh detail)
   */
  const handleDocumentUploaded = async () => {
    if (!activePengajuan?.id) return;
    try {
      const detail = await getKpApplicationDetail(activePengajuan.id);
      setActivePengajuan(detail);
    } catch {
      // Abaikan jika background refresh gagal sesaat
    }
  };

  /**
   * Buka konfirmasi submit
   */
  const handleOpenSubmitConfirm = () => {
    setConfirmSubmitOpen(true);
  };

  /**
   * Eksekusi pengiriman pengajuan (Submit) ke Program Studi
   */
  const handleConfirmSubmit = async () => {
    if (isSubmitting) return;
    if (!activePengajuan?.id) {
      toast.error('Draf pengajuan tidak ditemukan. Silakan simpan draf terlebih dahulu.');
      return;
    }
    if (!validateForDraft() || typeof formData.memiliki_nilai_de !== 'boolean' ||
        typeof formData.sudah_bayar_spp_variabel !== 'boolean') {
      toast.error('Lengkapi jawaban akademik dan SPP Variabel sebelum mengirim pengajuan.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Simpan perubahan form terakhir terlebih dahulu
      await updateKpDraft(activePengajuan.id, buildKpFormPayload(formData));

      // 2. Eksekusi pengiriman pengajuan (Submit)
      await submitKpApplication(activePengajuan.id, true);

      toast.success('Pengajuan Kerja Praktik berhasil dikirimkan ke Program Studi!');
      setConfirmSubmitOpen(false);

      // 3. Muat ulang data halaman untuk beralih ke tampilan Tracker
      await loadPageData();
    } catch (err) {
      const msg = pengajuanKpErrorMessage(
        err,
        'Pengajuan belum dapat dikirimkan. Pastikan seluruh berkas dan syarat terpenuhi.'
      );
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // RENDER: Loading Skeleton
  // =========================================================================
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 animate-pulse" role="status">
        <div className="border-b border-line pb-5">
          <div className="h-3 w-32 rounded bg-subtle" />
          <div className="mt-2 h-7 w-64 rounded bg-subtle" />
          <div className="mt-2 h-4 w-96 rounded bg-subtle" />
        </div>
        <div className="h-24 w-full rounded-xl bg-subtle" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-5">
            <div className="h-60 rounded-xl bg-subtle" />
            <div className="h-60 rounded-xl bg-subtle" />
          </div>
          <div className="lg:col-span-4">
            <div className="h-80 rounded-xl bg-subtle" />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Error State
  // =========================================================================
  if (error && !activePengajuan) {
    return (
      <div className="mx-auto w-full max-w-2xl py-12 text-center" role="alert">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-danger shadow-xs">
          <IconExclamationCircle className="size-8" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-ink">
          Gagal Memuat Formulir Pengajuan KP
        </h2>
        <p className="mt-1 text-sm text-secondary leading-relaxed">
          {error}
        </p>
        <button
          type="button"
          onClick={loadPageData}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-hover focus:outline-hidden"
        >
          <IconRefresh className="size-3.5" />
          Coba Lagi
        </button>
      </div>
    );
  }

  const isScheduleOpen = Boolean(opsiForm?.jadwal?.is_open);
  const isSubmittedState =
    activePengajuan && (activePengajuan.status_pengajuan !== KP_STATUS_PENGAJUAN.DRAFT ||
      !opsiForm || selectedHistoryId !== null);

  // Normalisasi daftar berkas terunggah
  const dokumenList = activePengajuan?.dokumen_pengajuan || [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* ============================================================ */}
      {/* Header Halaman                                               */}
      {/* ============================================================ */}
      <div className="border-b border-line pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Portal Akademik Mahasiswa
            </span>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Pengajuan Kerja Praktik (KP)
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-secondary">
              Formulir usulan instansi mitra, topik perancangan sistem, kelayakan akademik, dan pelacakan verifikasi Program Studi.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadPageData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-secondary shadow-xs hover:bg-subtle focus:outline-hidden"
              title="Segarkan data pengajuan"
            >
              <IconRefresh className="size-3.5" />
              Segarkan
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. Banner Jadwal Akademik & Prasyarat Data Diri              */}
      {/* ============================================================ */}
      <KpScheduleBanner
        jadwal={opsiForm?.jadwal}
        dataDiri={opsiForm?.data_diri}
        loading={loading}
      />

      {error && activePengajuan && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        {error} Pengajuan yang sudah tersimpan tetap dapat dilihat di bawah.
      </p>}

      <KpApplicationHistory items={historyItems} selectedId={selectedHistoryId}
        onSelect={setSelectedHistoryId} onReturn={() => setSelectedHistoryId(null)} />

      {/* ============================================================ */}
      {/* KONDISI A: Pengajuan Sudah Terkirim (Tracking State)         */}
      {/* ============================================================ */}
      {isSubmittedState ? (
        <>
          <KpApplicationTracker
            pengajuan={activePengajuan}
            reviews={reviews}
            reviewError={reviewError}
            onRefresh={loadPageData}
          />
          {activePengajuan.status_pengajuan === KP_STATUS_PENGAJUAN.DIAJUKAN &&
            (activePengajuan.status_pemeriksaan_berkas === 'BELUM_OK' ||
              activePengajuan.status_pemeriksaan_akademik === 'BELUM_OK') &&
            <KpAdministrativeRevision pengajuan={activePengajuan}
              persyaratan={opsiForm?.persyaratan || []} onRefresh={loadPageData} />}
        </>
      ) : !isScheduleOpen && !activePengajuan ? (
        /* ============================================================ */
        /* KONDISI B: Jadwal Ditutup & Mahasiswa Belum Memiliki Pengajuan */
        /* ============================================================ */
        <KpLockedState
          jadwal={opsiForm?.jadwal}
          dataDiri={opsiForm?.data_diri}
        />
      ) : (
        /* ============================================================ */
        /* KONDISI C: Mode Formulir Pengajuan (Draf Aktif / Pengisian)   */
        /* ============================================================ */
        <div className="space-y-6">
          {/* Banner Pemeriksaan Prasyarat Data Diri */}
          <KpPrerequisiteCheck dataDiri={opsiForm?.data_diri} />

          {/* Tata Letak 2 Kolom (Formulir + Sticky Checklist Sidebar) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Kolom Kiri: Formulir & Pengunggah Dokumen */}
            <div className="space-y-6 lg:col-span-8">
              {/* Formulir Utama */}
              <KpGeneralForm
                formData={formData}
                onChange={handleFormChange}
                errors={formErrors}
                opsiForm={opsiForm}
                disabled={isSavingDraft || isSubmitting}
                readOnly={false}
              />

              {/* Pengunggah Berkas Persyaratan */}
              <KpDocumentUploader
                pengajuanId={activePengajuan?.id || null}
                dokumenList={dokumenList}
                persyaratan={opsiForm?.persyaratan || []}
                sudahBayarSpp={Boolean(formData.sudah_bayar_spp_variabel)}
                onDocumentUploaded={handleDocumentUploaded}
                disabled={isSavingDraft || isSubmitting}
                readOnly={false}
              />
            </div>

            {/* Kolom Kanan: Sidebar Ringkasan & Aksi */}
            <div className="lg:col-span-4">
              <KpChecklistSidebar
                formData={formData}
                dokumenList={dokumenList}
                dataDiri={opsiForm?.data_diri}
                jadwal={opsiForm?.jadwal}
                setujuPernyataan={setujuPernyataan}
                onTogglePernyataan={setSetujuPernyataan}
                onSaveDraft={handleSaveDraft}
                onSubmitPengajuan={handleOpenSubmitConfirm}
                isSaving={isSavingDraft}
                isSubmitting={isSubmitting}
                readOnly={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Dialog Konfirmasi Submit Pengajuan                           */}
      {/* ============================================================ */}
      <ConfirmDialog
        open={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        onConfirm={handleConfirmSubmit}
        variant="primary"
        badge="Konfirmasi Pengajuan KP"
        title="Kirim Pengajuan Kerja Praktik Sekarang?"
        description="Setelah dikirimkan, berkas pengajuan Anda akan diteruskan ke Admin Program Studi untuk proses verifikasi administrasi dan Anda tidak dapat lagi mengubah data draf ini."
        confirmLabel="Ya, Kirim Pengajuan"
        cancelLabel="Periksa Kembali"
        loading={isSubmitting}
      />
    </div>
  );
}

