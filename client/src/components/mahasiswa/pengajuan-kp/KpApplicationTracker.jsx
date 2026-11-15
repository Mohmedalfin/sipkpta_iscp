import { useState } from 'react';
import {
  IconAcademicCap,
  IconArrowUpTray,
  IconArrowDownTray,
  IconBriefcase,
  IconCalendarClock,
  IconCheckCircle,
  IconClipboardCheck,
  IconDocumentText,
  IconEdit,
  IconExclamationCircle,
  IconExclamationTriangle,
  IconEye,
  IconInformationCircle,
  IconUser,
  IconUsers,
} from '../../common/Icons.jsx';
import { KP_STATUS_PENGAJUAN } from '../../../services/pengajuanKp.js';
import KpProposalRevisionModal from './KpProposalRevisionModal.jsx';

/**
 * Format tanggal Indonesia
 */
function formatIndonesianDate(isoString) {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(date) + ' WIB';
  } catch {
    return '-';
  }
}

/**
 * Konfigurasi status badge
 */
const STATUS_CONFIG = {
  [KP_STATUS_PENGAJUAN.DRAFT]: {
    label: 'Draf Pengajuan',
    badgeClass: 'bg-slate-100 text-secondary border-line',
  },
  [KP_STATUS_PENGAJUAN.DIAJUKAN]: {
    label: 'Menunggu Verifikasi Admin',
    badgeClass: 'bg-blue-50 text-brand border-blue-200',
  },
  [KP_STATUS_PENGAJUAN.ACC]: {
    label: 'ACC Administrasi',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  },
  [KP_STATUS_PENGAJUAN.TIDAK_ACC]: {
    label: 'Tidak ACC',
    badgeClass: 'bg-rose-50 text-danger border-rose-300',
  },
};

/**
 * Komponen Pelacak Progres Pengajuan KP Mahasiswa (Application Tracker)
 * Menampilkan:
 * 1. Kartu Header Status & Tanggal Pengajuan
 * 2. 4-Tahap Stepper Timeline Siklus Akademik Pengajuan
 * 3. Ringkasan Topik, Tempat KP, & Dosen Pembimbing Resmi
 * 4. Panel Catatan Reviewer & Tombol Unggah Revisi (bila PERLU_REVISI)
 * 
 * @param {object} props
 * @param {object} props.pengajuan - Objek detail pengajuan
 * @param {Array} props.reviews - Daftar review proposal dari server
 * @param {Function} props.onRefresh - Handler reload detail pengajuan
 */
export default function KpApplicationTracker({
  pengajuan,
  reviews = null,
  reviewError = '',
  onRefresh,
}) {
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);

  if (!pengajuan) return null;

  const currentStatus = pengajuan.status_pengajuan;
  const needsAdminRevision = pengajuan.status_pemeriksaan_berkas === 'BELUM_OK' ||
    pengajuan.status_pemeriksaan_akademik === 'BELUM_OK';
  const statusCfg = needsAdminRevision ? {
    label: 'Perlu Perbaikan Administrasi',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    desc: 'Periksa catatan Admin Prodi dan kirim perbaikan pada kategori yang diminta.',
  } : STATUS_CONFIG[currentStatus] || {
    label: currentStatus,
    badgeClass: 'bg-subtle text-secondary',
    desc: 'Status pengajuan sedang diproses.',
  };

  const versiTopik = pengajuan.versi_topik || {};
  const pembimbingResmi = pengajuan.pembimbing?.dosen || null;
  const reviewItems = reviews?.items || [];
  const currentProposalId = reviews?.dokumen_pengajuan_id || null;
  const activeReviews = reviewItems.filter((item) => item.status_penugasan === 'AKTIF');
  const needsProposalRevision = activeReviews.some((item) => item.hasil_versi_terkini === 'TIDAK_LAYAK');
  const reviewComplete = activeReviews.length > 0 &&
    activeReviews.every((item) => item.hasil_versi_terkini === 'LAYAK');
  const currentReview = (item) => item.riwayat?.find((event) =>
    event.dokumen_pengajuan_id === currentProposalId &&
    event.versi_topik_id === pengajuan.versi_topik?.id);

  // Menentukan status tiap langkah pada 4-Tahap Stepper
  const getStepStatus = (stepIndex) => {
    // Step 0: Pengajuan Terkirim
    if (stepIndex === 0) return currentStatus === KP_STATUS_PENGAJUAN.DRAFT ? 'PENDING' : 'COMPLETED';

    // Step 1: Verifikasi Berkas (Admin Prodi)
    if (stepIndex === 1) {
      if (needsAdminRevision) return 'WARNING';
      if (currentStatus === KP_STATUS_PENGAJUAN.TIDAK_ACC) return 'REJECTED';
      if (pengajuan.status_pemeriksaan_berkas === 'OK_LENGKAP' &&
          pengajuan.status_pemeriksaan_akademik === 'OK_LENGKAP') return 'COMPLETED';
      return currentStatus === KP_STATUS_PENGAJUAN.DRAFT ? 'PENDING' : 'IN_PROGRESS';
    }

    // Step 2: Review Proposal (Dosen Reviewer)
    if (stepIndex === 2) {
      if (needsProposalRevision) return 'WARNING';
      if (reviewComplete) return 'COMPLETED';
      return activeReviews.length ? 'IN_PROGRESS' : 'PENDING';
    }

    // Step 3: Keputusan Akhir & ACC (Kaprodi)
    if (stepIndex === 3) {
      if (currentStatus === KP_STATUS_PENGAJUAN.TIDAK_ACC) return 'REJECTED';
      if (pembimbingResmi) return 'COMPLETED';
      if (currentStatus === KP_STATUS_PENGAJUAN.ACC) return 'IN_PROGRESS';
      return 'PENDING';
    }

    return 'PENDING';
  };

  const steps = [
    {
      title: '1. Pengajuan Terkirim',
      desc: 'Mahasiswa mengirimkan formulir dan berkas KP',
      status: getStepStatus(0),
    },
    {
      title: '2. Verifikasi Berkas',
      desc: 'Admin Prodi memeriksa keabsahan & data diri',
      status: getStepStatus(1),
    },
    {
      title: '3. Review Proposal',
      desc: 'Dosen Reviewer menilai proposal & metodologi',
      status: getStepStatus(2),
    },
    {
      title: '4. Keputusan & ACC',
      desc: 'ACC administrasi dan penetapan pembimbing oleh Kaprodi',
      status: getStepStatus(3),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* 1. Header Banner Status Pengajuan                            */}
      {/* ============================================================ */}
      <section
        aria-label="Status Pengajuan Kerja Praktik"
        className="rounded-xl border border-line bg-white p-5 sm:p-6 shadow-xs"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-muted">
                Nomor Pengajuan: #{pengajuan.id}
              </span>
              <span
                className={`inline-flex items-center rounded-md border px-2.5 text-xs font-bold ${statusCfg.badgeClass}`}
              >
                {statusCfg.label}
              </span>
            </div>

            <h2 className="mt-1 text-base font-bold text-ink sm:text-lg">
              {versiTopik.judul_penelitian || 'Pengajuan Kerja Praktik'}
            </h2>

            <p className="text-xs text-secondary sm:text-sm">
              {statusCfg.desc}
            </p>
          </div>

          {needsProposalRevision && currentProposalId &&
            [KP_STATUS_PENGAJUAN.DIAJUKAN, KP_STATUS_PENGAJUAN.ACC].includes(currentStatus) && (
            <button
              type="button"
              onClick={() => setIsRevisionModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-amber-600 focus:outline-hidden sm:shrink-0"
            >
              <IconArrowUpTray className="size-4" />
              Unggah Revisi Proposal
            </button>
          )}
        </div>

        {/* Metadata Waktu Pengajuan */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line pt-3 text-xs text-muted">
          <span>
            <strong className="text-ink">Tanggal Diajukan:</strong>{' '}
              {formatIndonesianDate(pengajuan.diajukan_at)}
          </span>
          <span>
            <strong className="text-ink">Pembaruan Terakhir:</strong>{' '}
            {formatIndonesianDate(pengajuan.updated_at)}
          </span>
          {pengajuan.pilihan_topik && (
            <span>
              <strong className="text-ink">Jalur:</strong>{' '}
              <span className="rounded bg-subtle px-1.5 py-0.5 font-medium text-secondary">
                {pengajuan.pilihan_topik}
              </span>
            </span>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. 4-Tahap Stepper Timeline                                  */}
      {/* ============================================================ */}
      <section
        aria-label="Tahapan Proses Pengajuan"
        className="rounded-xl border border-line bg-white p-5 sm:p-6"
      >
        <h3 className="text-sm font-bold text-ink sm:text-base">
          Tahapan Proses Akademik
        </h3>
        <p className="mt-0.5 text-xs text-secondary">
          Alur verifikasi administrasi hingga persetujuan akhir Kerja Praktik oleh Program Studi
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className={`relative rounded-xl border p-4 transition-all ${
                step.status === 'COMPLETED'
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : step.status === 'IN_PROGRESS'
                  ? 'border-brand/40 bg-blue-50/40 ring-1 ring-brand/20'
                  : step.status === 'WARNING'
                  ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-300'
                  : step.status === 'REJECTED'
                  ? 'border-rose-300 bg-rose-50/40'
                  : 'border-line bg-subtle/30 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                    step.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : step.status === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-brand'
                      : step.status === 'WARNING'
                      ? 'bg-amber-100 text-amber-800'
                      : step.status === 'REJECTED'
                      ? 'bg-rose-100 text-danger'
                      : 'bg-white text-muted border border-line'
                  }`}
                >
                  {step.status === 'COMPLETED' ? (
                    <IconCheckCircle className="size-4" />
                  ) : step.status === 'WARNING' ? (
                    <IconExclamationTriangle className="size-4" />
                  ) : (
                    idx + 1
                  )}
                </span>

                <span className="text-[11px] font-semibold">
                  {step.status === 'COMPLETED' && (
                    <span className="text-emerald-700">Selesai</span>
                  )}
                  {step.status === 'IN_PROGRESS' && (
                    <span className="inline-flex items-center gap-1 text-brand">
                      <span className="size-1.5 animate-pulse rounded-full bg-brand" />
                      Sedang Berjalan
                    </span>
                  )}
                  {step.status === 'WARNING' && (
                    <span className="text-amber-700">Perlu Aksi</span>
                  )}
                  {step.status === 'REJECTED' && (
                    <span className="text-danger">Ditolak</span>
                  )}
                  {step.status === 'PENDING' && (
                    <span className="text-muted">Menunggu</span>
                  )}
                </span>
              </div>

              <h4 className="mt-3 text-xs font-bold text-ink sm:text-sm">
                {step.title}
              </h4>
              <p className="mt-1 text-xs text-secondary leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. Panel Catatan Reviewer (Bila Sudah Ada Review / Revisi)    */}
      {/* ============================================================ */}
      {reviewError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{reviewError}</p>}
      {reviewItems.length > 0 && (
        <section
          aria-label="Catatan Reviewer Proposal"
          className="rounded-xl border border-line bg-white p-5 sm:p-6"
        >
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <IconUsers className="size-5 text-brand" />
            <h3 className="text-sm font-bold text-ink sm:text-base">
              Catatan Evaluasi Reviewer Proposal
            </h3>
          </div>

          {reviews?.riwayat_revisi?.some((item) => item.catatan_perbaikan) && (
            <div className="mt-4 space-y-3">
              {reviews.riwayat_revisi.filter((item) => item.catatan_perbaikan).map((item) => (
                <div key={item.dokumen_pengajuan_id} className="rounded-lg border border-line bg-subtle/40 p-4 text-xs sm:text-sm">
                  <p className="font-semibold text-ink">Catatan perbaikan proposal versi {item.nomor_versi}</p>
                  <p className="mt-1 whitespace-pre-line text-secondary">{item.catatan_perbaikan}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-3">
            {reviewItems.map((rev, idx) => (
              <div
                key={rev.penugasan_id || idx}
                className="rounded-lg border border-line bg-subtle/40 p-4 text-xs sm:text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2">
                  <div className="font-semibold text-ink">
                    Reviewer {idx + 1}: {rev.reviewer?.nama_lengkap || 'Dosen Reviewer'}
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                      rev.hasil_versi_terkini === 'LAYAK'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Rekomendasi: {rev.status_penugasan === 'AKTIF'
                      ? rev.hasil_versi_terkini : 'Penugasan nonaktif'}
                  </span>
                </div>

                <div className="mt-2 text-secondary">
                  <p className="font-medium text-ink">Catatan / Komentar Perbaikan:</p>
                  <p className="mt-1 whitespace-pre-line leading-relaxed italic text-ink/90">
                    "{currentReview(rev)?.catatan_reviewer || 'Belum ada catatan tertulis pada proposal terkini.'}"
                  </p>
                </div>

                {currentReview(rev)?.reviewed_at && (
                  <p className="mt-2 text-[11px] text-muted">
                    Waktu Review: {formatIndonesianDate(currentReview(rev).reviewed_at)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 4. Rincian Usulan Topik & Tempat Kerja Praktik               */}
      {/* ============================================================ */}
      <section
        aria-label="Rincian Usulan KP"
        className="rounded-xl border border-line bg-white p-5 sm:p-6"
      >
        <h3 className="text-sm font-bold text-ink sm:text-base">
          Rincian Data Usulan Kerja Praktik
        </h3>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Objek & Mitra */}
          <div className="rounded-lg border border-line bg-subtle/30 p-3">
            <dt className="text-xs text-muted flex items-center gap-1.5">
              <IconBriefcase className="size-3.5 text-secondary" />
              Instansi & Objek KP
            </dt>
            <dd className="mt-1 font-semibold text-ink text-xs sm:text-sm">
              {versiTopik.objek_penelitian || '-'}
            </dd>
          </div>

          {/* Lokasi */}
          <div className="rounded-lg border border-line bg-subtle/30 p-3">
            <dt className="text-xs text-muted">Lokasi / Kota Pelaksanaan</dt>
            <dd className="mt-1 font-semibold text-ink text-xs sm:text-sm">
              {versiTopik.lokasi_penelitian || '-'}
            </dd>
          </div>

          {/* Usulan Pembimbing */}
          <div className="rounded-lg border border-line bg-subtle/30 p-3">
            <dt className="text-xs text-muted flex items-center gap-1.5">
              <IconUser className="size-3.5 text-secondary" />
              Usulan Pembimbing (Mahasiswa)
            </dt>
            <dd className="mt-1 font-semibold text-ink text-xs sm:text-sm">
              {pengajuan.usulan_pembimbing?.nama_lengkap || '-'}
            </dd>
          </div>

          {/* Pembimbing Resmi Ditetapkan */}
          <div className="rounded-lg border border-line bg-subtle/30 p-3">
            <dt className="text-xs text-muted flex items-center gap-1.5">
              <IconAcademicCap className="size-3.5 text-brand" />
              Dosen Pembimbing Resmi (Ditetapkan Kaprodi)
            </dt>
            <dd className="mt-1 font-semibold text-ink text-xs sm:text-sm">
              {pembimbingResmi?.nama_lengkap || (
                <span className="italic text-muted">Menunggu penetapan resmi Kaprodi</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* ============================================================ */}
      {/* Modal Unggah Revisi Proposal                                 */}
      {/* ============================================================ */}
      <KpProposalRevisionModal
        isOpen={isRevisionModalOpen}
        onClose={() => setIsRevisionModalOpen(false)}
        pengajuanId={pengajuan.id}
        expectedDocId={currentProposalId}
        onSuccess={onRefresh}
      />
    </div>
  );
}

