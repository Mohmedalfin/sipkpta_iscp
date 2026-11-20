import { useEffect, useRef, useState } from 'react';
import {
  IconAcademicCap,
  IconCalendar,
  IconCheckCircle,
  IconClose,
  IconEdit,
  IconExclamationCircle,
  IconLockClosed,
  IconMail,
  IconPhone,
  IconSpinner,
  IconTrash,
  IconUser,
} from '../../common/Icons.jsx';
import DosenStatusBadge from './DosenStatusBadge.jsx';
import { useFocusTrap } from '../../../hooks/useFocusTrap.js';
import {
  fetchDosenDetail,
  dosenErrorMessage,
} from '../../../services/masterDosen.js';
import { useToast } from '../../../context/ToastContext.jsx';

/**
 * Format string ISO ke format tanggal Indonesia lengkap (contoh: 14 Mei 1982)
 */
function formatBirthDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC', // tanggal_lahir disimpan sebagai UTC Date di backend
    });
  } catch {
    return isoString;
  }
}

/**
 * Format timestamp ISO ke format tanggal & waktu lokal (contoh: 6 Nov 2026, 14:30 WIB)
 */
function formatTimestamp(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
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

export default function DosenDetailModal({
  open,
  lecturer,
  onClose,
  onEdit,
  onToggleStatus,
  onDelete,
}) {
  const toast = useToast();
  const modalRef = useRef(null);

  const [detailData, setDetailData] = useState(lecturer || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useFocusTrap(modalRef, open, onClose);

  // Ambil data detail profil mutakhir saat modal terbuka
  useEffect(() => {
    if (!open || !lecturer?.id) return;

    let active = true;
    const controller = new AbortController();
    setDetailData(lecturer);
    setLoading(true);
    setError('');

    fetchDosenDetail(lecturer.id, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setDetailData(data);
      })
      .catch((err) => {
        if (!active) return;
        const msg = dosenErrorMessage(err, 'Gagal memuat rincian dosen.');
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, lecturer, toast]);

  if (!open || !lecturer) return null;

  const current = detailData?.id === lecturer.id ? detailData : lecturer;

  // Inisial avatar dosen
  const initials = current.nama_lengkap
    ? current.nama_lengkap
        .replace(/^(dr|prof|ir|drs|dra)\.?\s+/i, '')
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'DS'
    : 'DS';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs animate-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dosen-detail-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[92vh] rounded-[22px] border border-slate-900/[0.12] bg-white flex flex-col overflow-hidden shadow-2xl text-ink"
      >
        {/* ================= 1. HEADER MODAL ================= */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-white/80 border-b border-slate-900/[0.08] shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar Inisial */}
            <div className="relative shrink-0">
              <div className="size-11 rounded-2xl bg-indigo-50 border border-indigo-200/70 flex items-center justify-center text-indigo-700 font-extrabold text-sm tracking-tight shadow-2xs">
                {initials}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-white ${
                  current.status_akun === 'AKTIF' ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                title={`Status Akun: ${current.status_akun}`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="dosen-detail-modal-title" className="text-base font-bold text-ink truncate leading-snug">
                  {current.nama_lengkap}
                </h2>
                <DosenStatusBadge status={current.status_akun} size="sm" />
              </div>
              <p className="text-xs text-muted truncate mt-0.5">
                Kode Dosen: <span className="font-mono font-bold text-slate-800">{current.kode_dosen}</span>
                {current.nidn && (
                  <span className="text-slate-500"> • NIDN: <span className="font-mono">{current.nidn}</span></span>
                )}
                {current.program_studi?.nama_prodi && (
                  <span className="text-slate-500"> • {current.program_studi.nama_prodi}</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup rincian (Esc)"
            aria-label="Tutup Detail"
          >
            <IconClose className="size-4.5" />
          </button>
        </div>

        {/* ================= 2. ISI DETAIL (SCROLLABLE) ================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Indikator Loading Data Mutakhir */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-900/[0.06] text-xs text-muted">
              <IconSpinner className="size-3.5 text-brand" />
              <span>Memperbarui informasi dosen terbaru…</span>
            </div>
          )}

          {/* Banner Error jika gagal memuat detail */}
          {error && (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50/80 p-3.5 flex items-start gap-3 text-xs text-rose-800">
              <IconExclamationCircle className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Koneksi Detail Terkendala</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* SECTION 1: Identitas Akademik & Status Homebase */}
          <div className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-900/[0.06]">
              <div className="flex items-center gap-2">
                <IconAcademicCap className="size-4 text-brand" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Identitas Akademik & Kepegawaian
                </h3>
              </div>
              <div>
                {current.is_homebase_si ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-200/80 bg-indigo-50/80 text-indigo-800">
                    Homebase Sistem Informasi
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-slate-900/[0.08] bg-slate-100 text-slate-600">
                    Dosen Luar / Mitra
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted block text-[11px]">Kode Dosen (Login ID)</span>
                <span className="font-mono font-bold text-ink text-sm mt-0.5 block">
                  {current.kode_dosen}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px]">NIDN</span>
                <span className="font-mono font-semibold text-slate-800 mt-0.5 block">
                  {current.nidn || '-'}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Jabatan Fungsional</span>
                <span className="font-semibold text-ink mt-0.5 block">
                  {current.jabatan_fungsional || 'Tenaga Pengajar'}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Program Studi Homebase</span>
                <span className="font-semibold text-ink mt-0.5 block">
                  {current.program_studi?.nama_prodi || 'Sistem Informasi'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Kontak & Biodata */}
          <div className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-900/[0.06]">
              <IconMail className="size-4 text-brand" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Kontak & Biodata
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <span className="text-muted block text-[11px]">Alamat Email Resmi</span>
                <div className="flex items-center gap-2 font-mono text-ink mt-0.5">
                  <IconMail className="size-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold">{current.email}</span>
                </div>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Nomor Telepon / WA</span>
                <div className="flex items-center gap-2 font-mono text-ink mt-0.5">
                  <IconPhone className="size-3.5 text-slate-400 shrink-0" />
                  <span>{current.no_telepon || '-'}</span>
                </div>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Tanggal Lahir</span>
                <div className="flex items-center gap-2 text-ink mt-0.5">
                  <IconCalendar className="size-3.5 text-slate-400 shrink-0" />
                  <span>{formatBirthDate(current.tanggal_lahir)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Informasi Akun & Waktu Audit */}
          <div className="rounded-[18px] border border-slate-900/[0.08] bg-slate-50/60 p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-900/[0.06]">
              <IconLockClosed className="size-4 text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Status Akun & Audit Sistem
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted block text-[11px]">Status Akses Login</span>
                <div className="mt-1 flex items-center gap-2">
                  <DosenStatusBadge status={current.status_akun} />
                  <span className="text-[11px] text-muted">
                    {current.status_akun === 'AKTIF'
                      ? 'Dapat login dan bertugas di sistem'
                      : 'Akses login ditangguhkan'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Didaftarkan Pada</span>
                <span className="text-slate-700 mt-0.5 block font-mono text-[11px]">
                  {formatTimestamp(current.created_at)}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-muted block text-[11px]">Pembaruan Terakhir</span>
                <span className="text-slate-700 mt-0.5 block font-mono text-[11px]">
                  {formatTimestamp(current.updated_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 3. FOOTER MODAL (AKSI CEPAT) ================= */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-5 sm:px-6 py-4 bg-slate-50/80 border-t border-slate-900/[0.08] shrink-0">
          {/* Tombol Hapus Dosen */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onDelete) onDelete(current);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
            title="Hapus data dosen ini dari sistem"
          >
            <IconTrash className="size-4" />
            <span>Hapus Dosen</span>
          </button>

          {/* Tombol Aksi Kanan: Toggle Status & Edit */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onToggleStatus) onToggleStatus(current);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                current.status_akun === 'AKTIF'
                  ? 'border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100'
                  : 'border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {current.status_akun === 'AKTIF' ? (
                <>
                  <IconLockClosed className="size-3.5" />
                  <span>Nonaktifkan Akun</span>
                </>
              ) : (
                <>
                  <IconCheckCircle className="size-3.5" />
                  <span>Aktifkan Akun</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onEdit) onEdit(current);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <IconEdit className="size-3.5 text-white" />
              <span>Edit Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

