import { useEffect, useRef, useState } from 'react';
import {
  IconAcademicCap,
  IconCalendar,
  IconClose,
  IconEdit,
  IconExclamationCircle,
  IconLockClosed,
  IconMail,
  IconMapPin,
  IconPhone,
  IconSpinner,
  IconUser,
} from '../../common/Icons.jsx';
import MahasiswaStatusBadge from './MahasiswaStatusBadge.jsx';
import StatusBadge from '../shared/StatusBadge.jsx';
import { useFocusTrap } from '../../../hooks/useFocusTrap.js';
import {
  fetchMahasiswaDetail,
  mahasiswaErrorMessage,
} from '../../../services/masterMahasiswa.js';
import { useToast } from '../../../context/ToastContext.jsx';

/**
 * Format string ISO ke format tanggal Indonesia lengkap (contoh: 15 Mei 2003)
 */
function formatBirthDate(isoString, tempatLahir = null) {
  if (!isoString) return tempatLahir || '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return tempatLahir || isoString;
    const dateFormatted = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC', // tanggal_lahir disimpan sebagai UTC Date
    });
    return tempatLahir ? `${tempatLahir}, ${dateFormatted}` : dateFormatted;
  } catch {
    return tempatLahir ? `${tempatLahir}, ${isoString}` : isoString;
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

export default function MahasiswaDetailModal({
  open,
  student,
  onClose,
  onEdit,
  onToggleStatus,
}) {
  const toast = useToast();
  const modalRef = useRef(null);

  const [detailData, setDetailData] = useState(student || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useFocusTrap(modalRef, open, onClose);

  // Ambil data detail profil paling mutakhir saat modal terbuka
  useEffect(() => {
    if (!open || !student?.id) return;

    let active = true;
    const controller = new AbortController();
    setDetailData(student);
    setLoading(true);
    setError('');

    fetchMahasiswaDetail(student.id, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setDetailData(data);
      })
      .catch((err) => {
        if (!active) return;
        const msg = mahasiswaErrorMessage(err, 'Gagal memuat rincian mahasiswa.');
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
  }, [open, student, toast]);

  if (!open || !student) return null;

  const current = detailData?.id === student.id ? detailData : student;

  // Inisial avatar mahasiswa
  const initials = current.nama_lengkap
    ? current.nama_lengkap
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'M';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs animate-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mahasiswa-detail-modal-title"
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
              <div className="size-11 rounded-2xl bg-brand-soft border border-blue-200/70 flex items-center justify-center text-brand font-extrabold text-sm tracking-tight shadow-2xs">
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
                <h2 id="mahasiswa-detail-modal-title" className="text-base font-bold text-ink truncate leading-snug">
                  {current.nama_lengkap}
                </h2>
                <MahasiswaStatusBadge status={current.status_akun} size="sm" />
              </div>
              <p className="text-xs text-muted truncate mt-0.5">
                NIM: <span className="font-mono font-bold text-slate-800">{current.nim}</span>
                {current.program_studi?.nama_prodi && (
                  <span className="text-slate-500"> • {current.program_studi.nama_prodi}</span>
                )}
                {current.tahun_angkatan && (
                  <span className="text-slate-500"> • Angkatan {current.tahun_angkatan}</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup (Esc)"
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
              <span>Memperbarui informasi mahasiswa terbaru…</span>
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

          {/* Kartu Bagian 1: Data Akademik & Akun Sistem */}
          <div className="rounded-2xl border border-slate-900/[0.08] bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-900/[0.06] pb-2">
              <IconAcademicCap className="size-4 text-brand" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Informasi Akademik & Akun
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted block text-[11px]">NIM (Nomor Induk Mahasiswa)</span>
                <span className="font-mono font-bold text-ink mt-0.5 block">{current.nim}</span>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Program Studi</span>
                <span className="font-semibold text-ink mt-0.5 block">
                  {current.program_studi?.nama_prodi || 'Sistem Informasi'}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Tahun Angkatan</span>
                <span className="font-semibold text-ink mt-0.5 block">
                  {current.tahun_angkatan ? `Angkatan ${current.tahun_angkatan}` : '-'}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Status Akun Login</span>
                <div className="mt-1">
                  <MahasiswaStatusBadge status={current.status_akun} size="sm" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <span className="text-muted block text-[11px]">Email Terdaftar</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-slate-700">
                  <IconMail className="size-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono text-xs">{current.email || '-'}</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <span className="text-muted block text-[11px]">Status Verifikasi Berkas Data Diri</span>
                <div className="mt-1">
                  <StatusBadge status={current.status_data || 'BELUM_LENGKAP'} size="sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Kartu Bagian 2: Biodata & Kontak Pribadi */}
          <div className="rounded-2xl border border-slate-900/[0.08] bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-900/[0.06] pb-2">
              <IconUser className="size-4 text-brand" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Biodata & Kontak Pribadi
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted block text-[11px]">NIK Kependudukan (KTP)</span>
                <span className="font-mono font-semibold text-ink mt-0.5 block">
                  {current.nik_kependudukan || '-'}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Tempat & Tanggal Lahir</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-ink">
                  <IconCalendar className="size-3.5 text-slate-400 shrink-0" />
                  <span>{formatBirthDate(current.tanggal_lahir, current.tempat_lahir)}</span>
                </div>
              </div>

              <div>
                <span className="text-muted block text-[11px]">Nomor Telepon / WhatsApp</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-ink">
                  <IconPhone className="size-3.5 text-slate-400 shrink-0" />
                  <span>{current.no_telepon || '-'}</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <span className="text-muted block text-[11px]">Alamat Tempat Tinggal</span>
                <div className="flex items-start gap-1.5 mt-0.5 text-ink">
                  <IconMapPin className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{current.alamat || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Kartu Bagian 3: Riwayat Sistem & Audit Trail */}
          <div className="rounded-xl border border-slate-900/[0.06] bg-slate-50/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted">
            <div>
              <span>Terdaftar pada: </span>
              <span className="font-semibold text-slate-700">{formatTimestamp(current.created_at)}</span>
            </div>
            <div>
              <span>Terakhir diperbarui: </span>
              <span className="font-semibold text-slate-700">{formatTimestamp(current.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* ================= 3. FOOTER AKSI ================= */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-900/[0.08] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            {/* Tombol Toggle Status dari Modal Detail */}
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onToggleStatus) onToggleStatus(current);
              }}
              className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                current.status_akun === 'AKTIF'
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {current.status_akun === 'AKTIF' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
            </button>

            {/* Tombol Edit Profil */}
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onEdit) onEdit(current);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <IconEdit className="size-3.5" />
              <span>Edit Mahasiswa</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

