import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BIMBINGAN_QUERY } from '../../../services/realtimeQueries.js';
import { bimbinganHistoryAction, latestBimbinganAttachments } from '../../../utils/bimbinganHistory.js';
import { useToast } from '../../../context/ToastContext.jsx';
import {
  bimbinganErrorMessage,
  downloadBimbinganAttachment,
  fetchBimbinganDetail,
  triggerBlobDownload,
} from '../../../services/bimbinganMahasiswa.js';
import BimbinganStatusBadge, { BimbinganJenisBadge } from './BimbinganStatusBadge.jsx';
import {
  IconArrowDownTray,
  IconArrowRight,
  IconArrowUpTray,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconClose,
  IconDocumentText,
  IconExclamationTriangle,
  IconInformationCircle,
  IconPaperClip,
  IconRefresh,
  IconSpinner,
  IconUser,
  IconUsers,
} from '../../common/Icons.jsx';

function formatFullDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return '-';
  }
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '-';
    return `${new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      timeZone: 'Asia/Jakarta',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)} WIB`;
  } catch {
    return '-';
  }
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0 || bytes === '0') return '0 B';
  const num = Number(bytes);
  if (Number.isNaN(num)) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const ACTION_CONFIG = {
  KIRIM: {
    label: 'Pengajuan Catatan Bimbingan',
    actor: 'Mahasiswa',
    actorBadge: 'bg-blue-50 text-brand border-blue-200/80',
    nodeBg: 'bg-brand text-white',
    nodeRing: 'ring-blue-100',
    Icon: IconArrowUpTray,
  },
  KIRIM_REVISI: {
    label: 'Pengiriman Perbaikan Revisi',
    actor: 'Mahasiswa',
    actorBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    nodeBg: 'bg-indigo-600 text-white',
    nodeRing: 'ring-indigo-100',
    Icon: IconRefresh,
  },
  VALIDASI: {
    label: 'Bimbingan Tervalidasi & Disetujui',
    actor: 'Dosen Pembimbing',
    actorBadge: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    nodeBg: 'bg-emerald-600 text-white',
    nodeRing: 'ring-emerald-100',
    Icon: IconCheckCircle,
  },
  PERBAIKAN: {
    label: 'Arahan Perbaikan Diterbitkan',
    actor: 'Dosen Pembimbing',
    actorBadge: 'bg-amber-50 text-amber-900 border-amber-200/80',
    nodeBg: 'bg-amber-500 text-white',
    nodeRing: 'ring-amber-100',
    Icon: IconExclamationTriangle,
  },
  TOLAK: {
    label: 'Sesi Bimbingan Ditolak',
    actor: 'Dosen Pembimbing',
    actorBadge: 'bg-rose-50 text-rose-800 border-rose-200/80',
    nodeBg: 'bg-rose-600 text-white',
    nodeRing: 'ring-rose-100',
    Icon: IconClose,
  },
};

/**
 * Modal Rincian & Linimasa Audit Trail Bimbingan Mahasiswa
 * Didesain ulang mengikuti Modern Academic Administration (SIPKITA visual direction)
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Status visibilitas modal
 * @param {Function} props.onClose - Handler menutup modal
 * @param {number|string} props.pengajuanId - ID Pengajuan KP aktif
 * @param {number|string} props.bimbinganId - ID Sesi Bimbingan
 * @param {Function} [props.onOpenRevision] - Handler membuka form revisi saat PERLU_PERBAIKAN
 * @param {object} [props.supervisor] - Informasi Dosen Pembimbing KP
 * @param {string} [props.topikJudul] - Judul KP mahasiswa
 */
export default function BimbinganDetailModal({
  isOpen,
  onClose,
  pengajuanId,
  bimbinganId,
  onOpenRevision,
  supervisor = null,
  topikJudul = '',
}) {
  const toast = useToast();
  const modalRef = useRef(null);

  const query = useQuery({
    queryKey: [BIMBINGAN_QUERY.detail, pengajuanId, bimbinganId],
    enabled: Boolean(isOpen && pengajuanId && bimbinganId),
    queryFn: ({ signal }) => fetchBimbinganDetail(pengajuanId, bimbinganId, { signal }),
  });
  const detail = query.data;
  const loading = query.isPending;
  const error = query.error ? bimbinganErrorMessage(query.error, 'Gagal memuat rincian bimbingan.') : '';
  const [downloadingId, setDownloadingId] = useState(null);

  const supervisorData = supervisor?.dosen || supervisor || {};
  const supervisorName = supervisorData.nama_lengkap || supervisorData.nama || 'Dosen Pembimbing KP';
  const supervisorCode = supervisorData.kode_dosen || null;
  const supervisorNidn = supervisorData.nidn || null;

  // Handle tombol Escape untuk menutup modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handler unduh berkas lampiran PDF
  const handleDownloadAttachment = async (lampiran) => {
    if (downloadingId) return;
    setDownloadingId(lampiran.id);

    try {
      const blob = await downloadBimbinganAttachment(pengajuanId, bimbinganId, lampiran.id);
      triggerBlobDownload(blob, lampiran.nama_file_asli || `lampiran-bimbingan-${lampiran.id}.pdf`);
      toast.success(`Berkas ${lampiran.nama_file_asli} berhasil diunduh.`);
    } catch (err) {
      toast.error(bimbinganErrorMessage(err, 'Gagal mengunduh berkas lampiran.'));
    } finally {
      setDownloadingId(null);
    }
  };

  const currentAttachments = latestBimbinganAttachments(detail);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs animate-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bimbingan-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl sm:max-w-4xl max-h-[92vh] rounded-[22px] border border-slate-900/[0.12] bg-white flex flex-col overflow-hidden shadow-2xl text-ink"
      >
        {/* ================= 1. HEADER MODAL REDESIGNED ================= */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-50/80 border-b border-slate-900/[0.08] shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-11 sm:size-12 rounded-2xl bg-brand-soft border border-blue-200/70 flex items-center justify-center text-brand font-extrabold text-sm tracking-tight shadow-2xs shrink-0">
              <IconDocumentText className="size-5 sm:size-6 text-brand" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Portal Mahasiswa • Rincian Sesi Bimbingan KP
                </span>
                {detail && (
                  <span className="inline-flex items-center rounded-md bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-mono font-bold text-slate-700">
                    ID #{detail.id || bimbinganId}
                  </span>
                )}
              </div>
              <h2 id="bimbingan-detail-title" className="text-base sm:text-lg font-extrabold text-ink tracking-tight truncate">
                Sesi Bimbingan #{detail?.id || bimbinganId}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {detail && (
              <div className="hidden sm:flex items-center gap-2">
                <BimbinganStatusBadge status={detail.status_bimbingan} />
                <BimbinganJenisBadge jenis={detail.jenis_bimbingan} />
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup rincian"
              title="Tutup (Esc)"
              className="size-8.5 rounded-xl text-slate-400 hover:text-ink hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
            >
              <IconClose className="size-4" />
            </button>
          </div>
        </div>

        {/* Badges bar for mobile display */}
        {detail && (
          <div className="flex sm:hidden items-center justify-between gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-200/70">
            <span className="text-xs text-muted font-medium">Status & Pelaksanaan:</span>
            <div className="flex items-center gap-2">
              <BimbinganStatusBadge status={detail.status_bimbingan} />
              <BimbinganJenisBadge jenis={detail.jenis_bimbingan} />
            </div>
          </div>
        )}

        {/* ================= 2. BODY MODAL (SCROLLABLE) ================= */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5.5 flex-1">
          {loading ? (
            <div className="space-y-4 py-8 animate-pulse">
              <div className="h-6 w-1/3 rounded-lg bg-slate-100" />
              <div className="h-24 rounded-2xl bg-slate-100" />
              <div className="h-44 rounded-2xl bg-slate-100" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-center space-y-3">
              <IconExclamationTriangle className="size-8 text-rose-600 mx-auto" />
              <p className="text-sm font-semibold text-rose-900">{error}</p>
              <button
                type="button"
                onClick={() => query.refetch({ cancelRefetch: false })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-50 shadow-2xs transition-colors cursor-pointer"
              >
                <IconRefresh className="size-3.5" />
                <span>Coba Muat Ulang</span>
              </button>
            </div>
          ) : detail ? (
            <>
              {/* ================= METADATA STRIP: 4 STATS CARDS ================= */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Jenis Pelaksanaan */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Jenis Pelaksanaan
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-ink truncate">
                    {detail.jenis_bimbingan === 'OFFLINE' ? (
                      <>
                        <IconUsers className="size-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">Tatap Muka (Offline)</span>
                      </>
                    ) : (
                      <>
                        <IconCalendar className="size-3.5 text-sky-600 shrink-0" />
                        <span className="truncate">Daring (Online)</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 2. Tanggal Konsultasi */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    {detail.jenis_bimbingan === 'OFFLINE' ? 'Tanggal Pertemuan' : 'Waktu Pengiriman'}
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-ink truncate" title={detail.jenis_bimbingan === 'OFFLINE' ? formatFullDate(detail.tanggal_bimbingan) : formatDateTime(detail.diajukan_pertama_at)}>
                    <IconCalendar className="size-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">
                      {detail.jenis_bimbingan === 'OFFLINE'
                        ? formatFullDate(detail.tanggal_bimbingan)
                        : detail.diajukan_pertama_at
                        ? formatDateTime(detail.diajukan_pertama_at)
                        : 'Dicatat Saat Pengiriman'}
                    </span>
                  </div>
                </div>

                {/* 3. Versi Pengiriman */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Versi Pengiriman
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-ink">
                    <IconClock className="size-3.5 text-slate-500 shrink-0" />
                    <span>Versi Terkini #{detail.versi_pengiriman_terakhir || 1}</span>
                  </div>
                </div>

                {/* 4. Dosen Pembimbing */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Dosen Pembimbing
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-ink truncate" title={supervisorName}>
                    <IconUser className="size-3.5 text-brand shrink-0" />
                    <span className="truncate">{supervisorName}</span>
                    {supervisorCode && (
                      <span className="text-[10px] font-mono font-semibold text-brand bg-brand/10 px-1.5 py-0.2 rounded-md shrink-0">
                        {supervisorCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ================= HERO ASSESSMENT / STATUS CARD ================= */}
              {detail.status_bimbingan === 'PERLU_PERBAIKAN' && (
                <div className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50/90 to-amber-100/40 p-4.5 sm:p-5 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/80">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <IconExclamationTriangle className="size-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                          Tindakan Mahasiswa Diperlukan
                        </span>
                        <h3 className="text-sm font-bold text-amber-950">
                          Arahan Perbaikan dari Dosen Pembimbing
                        </h3>
                      </div>
                    </div>

                    {onOpenRevision && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenRevision(detail);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer shrink-0"
                      >
                        <IconArrowUpTray className="size-3.5" />
                        <span>Kirim Revisi Sekarang</span>
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl bg-white/95 border border-amber-200 p-3.5 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-medium shadow-2xs">
                    {detail.catatan_pembimbing_terakhir ? (
                      <div>
                        <span className="font-bold text-amber-900 block mb-1">Catatan & Catatan Revisi Pembimbing:</span>
                        &ldquo;{detail.catatan_pembimbing_terakhir}&rdquo;
                      </div>
                    ) : (
                      <span className="text-muted italic">Dosen pembimbing menandai perlu perbaikan tanpa catatan teks tambahan.</span>
                    )}
                  </div>
                </div>
              )}

              {detail.status_bimbingan === 'TERVALIDASI' && (
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-emerald-100/30 p-4.5 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconCheckCircle className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                        Status Validasi Akademik
                      </span>
                      <h3 className="text-sm font-bold text-emerald-950">
                        Sesi Bimbingan Telah Divalidasi & Disetujui Resmi
                      </h3>
                    </div>
                  </div>

                  {detail.catatan_pembimbing_terakhir && (
                    <div className="rounded-xl bg-white/95 border border-emerald-200 p-3.5 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap shadow-2xs">
                      <span className="font-bold text-emerald-900 block mb-1">Catatan Pembimbing:</span>
                      &ldquo;{detail.catatan_pembimbing_terakhir}&rdquo;
                    </div>
                  )}

                  {detail.diperiksa_at && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium pt-0.5">
                      <IconClock className="size-3.5 text-emerald-600 shrink-0" />
                      <span>Divalidasi secara resmi pada {formatDateTime(detail.diperiksa_at)}</span>
                    </div>
                  )}
                </div>
              )}

              {detail.status_bimbingan === 'DITOLAK' && (
                <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/90 to-rose-100/30 p-4.5 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <IconClose className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">
                        Hasil Telaah
                      </span>
                      <h3 className="text-sm font-bold text-rose-950">
                        Sesi Bimbingan Ditolak oleh Dosen Pembimbing
                      </h3>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/95 border border-rose-200 p-3.5 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap shadow-2xs">
                    <span className="font-bold text-rose-900 block mb-1">Alasan Penolakan:</span>
                    {detail.catatan_pembimbing_terakhir || (
                      <span className="text-muted italic">Tidak ada alasan penolakan tertulis.</span>
                    )}
                  </div>
                </div>
              )}

              {detail.status_bimbingan === 'MENUNGGU_VALIDASI' && (
                <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-4.5 sm:p-5 flex items-start gap-3.5 text-xs text-blue-950 shadow-xs">
                  <div className="size-9 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    <IconClock className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-ink text-sm">
                      Menunggu Pemeriksaan Dosen Pembimbing
                    </h3>
                    <p className="text-secondary text-xs leading-relaxed">
                      Catatan bimbingan versi #{detail.versi_pengiriman_terakhir} telah berhasil dikirim ke Dosen Pembimbing Anda. Anda akan menerima notifikasi saat pembimbing menerbitkan telaah arahan atau validasi resmi.
                    </p>
                  </div>
                </div>
              )}

              {/* ================= KARTU MATERI BIMBINGAN & LAMPIRAN BERKAS ================= */}
              <div className="rounded-2xl border border-slate-900/[0.08] bg-white p-4.5 sm:p-5 shadow-xs space-y-4">
                {/* Judul Topik KP bila tersedia */}
                {topikJudul && (
                  <div className="pb-3 border-b border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                      Topik Kerja Praktik
                    </span>
                    <p className="text-xs font-bold text-ink mt-0.5 leading-snug">
                      {topikJudul}
                    </p>
                  </div>
                )}

                {/* Ringkasan Materi */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">
                      Ringkasan Materi & Pokok Pembahasan
                    </span>
                    <span className="text-[10px] font-mono text-muted">
                      {detail.ringkasan ? `${detail.ringkasan.length.toLocaleString('id-ID')} karakter` : 'Kosong'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 text-xs text-ink leading-relaxed whitespace-pre-wrap font-normal">
                    {detail.ringkasan || (
                      <span className="text-muted italic">Tidak ada catatan ringkasan materi.</span>
                    )}
                  </div>
                </div>

                {/* Berkas Lampiran PDF Terkini */}
                {currentAttachments.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">
                        Berkas Lampiran PDF Terkini ({currentAttachments.length})
                      </span>
                      <span className="text-[10px] text-muted font-medium">Format PDF Resmi</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {currentAttachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/90 bg-white hover:border-brand/40 shadow-2xs hover:shadow-xs transition-all text-xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="size-8 rounded-lg bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 font-bold text-[10px] shrink-0">
                              PDF
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ink max-w-[170px] sm:max-w-[210px]" title={file.nama_file_asli}>
                                {file.nama_file_asli}
                              </p>
                              <p className="text-[10px] text-muted font-mono">
                                {formatFileSize(file.ukuran_bytes)}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(file)}
                            disabled={downloadingId === file.id}
                            title={`Unduh berkas ${file.nama_file_asli}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand hover:text-white hover:border-brand px-2.5 py-1 text-xs font-semibold text-secondary transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                          >
                            {downloadingId === file.id ? (
                              <IconSpinner className="size-3 animate-spin" />
                            ) : (
                              <IconArrowDownTray className="size-3" />
                            )}
                            <span className="hidden sm:inline">Unduh</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ================= LINIMASA AUDIT TRAIL REDESIGNED (HIGH PRECISION CONTINUOUS SPINE) ================= */}
              <div className="rounded-2xl border border-slate-900/[0.08] bg-white p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-ink tracking-tight uppercase">
                      Linimasa Riwayat Pengiriman & Telaah Pembimbing
                    </h3>
                    <p className="text-[11px] text-secondary mt-0.5">
                      Audit trail transparan iterasi pengajuan materi, arahan dosen pembimbing, dan riwayat berkas lampiran.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 shrink-0">
                    {detail.riwayat?.length || 0} Aktivitas
                  </span>
                </div>

                {detail.riwayat && detail.riwayat.length > 0 ? (
                  <div className="relative pt-1">
                    {/* Continuous Vertical Spine: Pixel-perfect aligned through the center of all step nodes */}
                    <div
                      className="absolute left-4 sm:left-4.5 top-4 bottom-4 w-0.5 bg-slate-200"
                      aria-hidden="true"
                    />

                    <div className="space-y-5">
                      {detail.riwayat.map((event, idx) => {
                        const isLast = idx === detail.riwayat.length - 1;
                        const config = ACTION_CONFIG[bimbinganHistoryAction(event)] || {
                          label: event.aksi,
                          actor: 'Sistem',
                          actorBadge: 'bg-slate-100 text-slate-700 border-slate-200',
                          nodeBg: 'bg-slate-500 text-white',
                          nodeRing: 'ring-slate-100',
                          Icon: IconClock,
                        };
                        const EventIcon = config.Icon;

                        return (
                          <div key={event.id || idx} className="relative flex items-start gap-3.5 sm:gap-4.5 group">
                            {/* Step Node Marker: Centered directly over the spine */}
                            <div className="relative flex items-center justify-center size-8 sm:size-9 shrink-0 z-10">
                              <div
                                className={`size-7 sm:size-8 rounded-full border-2 border-white flex items-center justify-center shadow-xs ring-4 ${config.nodeRing} ${config.nodeBg} transition-transform group-hover:scale-110 shrink-0`}
                                title={config.label}
                              >
                                <EventIcon className="size-3.5 text-white" />
                              </div>
                            </div>

                            {/* Event Content Card */}
                            <div
                              className={`flex-1 min-w-0 rounded-2xl border p-4 sm:p-4.5 transition-shadow shadow-2xs space-y-3 ${
                                isLast
                                  ? 'border-brand/30 bg-indigo-50/20 ring-1 ring-brand/10'
                                  : 'border-slate-200/90 bg-white'
                              }`}
                            >
                              {/* Event Header */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs sm:text-sm font-bold text-ink">
                                    {config.label}
                                  </span>
                                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                                    Versi #{event.versi_pengiriman}
                                  </span>
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[10px] font-semibold ${config.actorBadge}`}
                                  >
                                    {config.actor}
                                  </span>
                                  {isLast && (
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold px-2 py-0.2">
                                      Status Terkini
                                    </span>
                                  )}
                                </div>

                                <span className="text-[11px] font-mono text-muted flex items-center gap-1 shrink-0">
                                  <IconClock className="size-3 shrink-0" />
                                  <span>{formatDateTime(event.created_at)}</span>
                                </span>
                              </div>

                              {/* Status Transition Pill */}
                              {event.status_sebelum && event.status_sesudah && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[10px] font-medium text-secondary">
                                  <span className="font-semibold text-slate-700">{event.status_sebelum}</span>
                                  <IconArrowRight className="size-2.5 text-slate-400 shrink-0" />
                                  <span className="font-bold text-slate-900">{event.status_sesudah}</span>
                                </div>
                              )}

                              {/* Supervisor Feedback Note (Catatan & Arahan Pembimbing) */}
                              {event.catatan && (
                                <div className="rounded-xl bg-amber-50/80 border border-amber-200/90 p-3.5 text-xs text-slate-800 space-y-1.5 shadow-2xs">
                                  <div className="flex items-center gap-1.5 font-bold text-amber-950 text-[11px]">
                                    <IconUser className="size-3.5 text-amber-700 shrink-0" />
                                    <span>Catatan & Arahan Pembimbing:</span>
                                  </div>
                                  <p className="italic leading-relaxed pl-5 whitespace-pre-wrap text-slate-900">
                                    &ldquo;{event.catatan}&rdquo;
                                  </p>
                                </div>
                              )}

                              {/* Snapshot Ringkasan Materi Mahasiswa */}
                              {event.ringkasan_snapshot && (
                                <div className="rounded-xl bg-slate-50/70 border border-slate-200/70 p-3 text-xs leading-relaxed text-ink space-y-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                                    Ringkasan Materi yang Dikirimkan (Snapshot Versi #{event.versi_pengiriman}):
                                  </span>
                                  <p className="line-clamp-3 hover:line-clamp-none whitespace-pre-wrap text-slate-700 leading-relaxed transition-all">
                                    {event.ringkasan_snapshot}
                                  </p>
                                </div>
                              )}

                              {/* Berkas Lampiran pada putaran ini */}
                              {event.lampiran_bimbingan && event.lampiran_bimbingan.length > 0 && (
                                <div className="pt-1 space-y-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                                    Berkas Lampiran Versi Ini ({event.lampiran_bimbingan.length}):
                                  </span>
                                  <div className="flex flex-wrap gap-2">
                                    {event.lampiran_bimbingan.map((att) => (
                                      <button
                                        key={att.id}
                                        type="button"
                                        onClick={() => handleDownloadAttachment(att)}
                                        disabled={downloadingId === att.id}
                                        title={`Unduh berkas ${att.nama_file_asli}`}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-brand/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:text-ink shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                                      >
                                        <IconPaperClip className="size-3 text-rose-600 shrink-0" />
                                        <span className="truncate max-w-[150px] sm:max-w-[200px] font-medium">
                                          {att.nama_file_asli}
                                        </span>
                                        <span className="text-[10px] text-muted font-mono">
                                          ({formatFileSize(att.ukuran_bytes)})
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-muted italic bg-slate-50/60 rounded-xl border border-slate-200/60">
                    Belum ada riwayat aktivitas yang tercatat untuk sesi bimbingan ini.
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* ================= 3. FOOTER MODAL REDESIGNED ================= */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 bg-slate-50/80 border-t border-slate-900/[0.08] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer"
          >
            Tutup
          </button>

          {detail?.status_bimbingan === 'PERLU_PERBAIKAN' && onOpenRevision && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRevision(detail);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 px-4.5 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
            >
              <IconArrowUpTray className="size-3.5" />
              <span>Kirim Revisi Bimbingan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
