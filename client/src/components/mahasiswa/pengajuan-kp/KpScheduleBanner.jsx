import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconCalendarClock,
  IconCheckCircle,
  IconExclamationTriangle,
  IconLockClosed,
} from '../../common/Icons.jsx';

/**
 * Format tanggal ringkas Indonesia: misal "1 Feb 2027, 06:59 WIB"
 */
function formatShortDate(isoString) {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
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
 * Menghitung sisa hari
 */
function calculateRemainingDays(tglSelesai) {
  if (!tglSelesai) return null;
  try {
    const end = new Date(tglSelesai).getTime();
    const now = Date.now();
    const diffMs = end - now;
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Komponen Banner Status Jadwal & Prasyarat Pengajuan KP (Minimalist & Compact)
 * Menyajikan informasi esensial (periode, batas akhir, status pendaftaran, dan data diri)
 * dalam satu bar horizontal yang ramping tanpa memakan ruang vertikal berlebih.
 * 
 * @param {object} props
 * @param {object|null} props.jadwal - Data jadwal dari opsi-form { tahun_ajaran, semester, tgl_mulai, tgl_selesai, is_open }
 * @param {object|null} [props.dataDiri] - Data prasyarat data diri mahasiswa { lengkap, jumlah_terunggah, jumlah_wajib }
 * @param {boolean} [props.loading] - State loading
 */
export default function KpScheduleBanner({ jadwal, dataDiri = null, loading = false }) {
  if (loading) {
    return (
      <div className="w-full animate-pulse rounded-lg border border-line bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="h-4 w-64 rounded bg-subtle" />
          <div className="h-6 w-36 rounded-full bg-subtle" />
        </div>
      </div>
    );
  }

  const isOpen = Boolean(jadwal?.is_open);
  const remainingDays = isOpen ? calculateRemainingDays(jadwal?.tgl_selesai) : null;
  const isDataDiriLengkap = Boolean(dataDiri?.lengkap);

  return (
    <aside
      aria-label="Status Pendaftaran dan Periode Akademik"
      className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 sm:px-4 sm:py-2.5 shadow-2xs"
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        {/* Sisi Kiri: Ikon, Periode, & Batas Akhir Ringkas */}
        <div className="flex items-center gap-2.5 min-w-0">
          {isOpen ? (
            <IconCalendarClock className="size-4.5 shrink-0 text-emerald-600" />
          ) : (
            <IconLockClosed className="size-4.5 shrink-0 text-secondary" />
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
            <span className="font-bold text-ink">
              {jadwal?.tahun_ajaran && jadwal?.semester
                ? `Periode ${jadwal.tahun_ajaran} ${jadwal.semester}`
                : 'Periode KP'}
            </span>
            <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand">
              Kerja Praktik
            </span>
            <span className="text-line hidden sm:inline">•</span>
            <span className="text-secondary text-xs">
              Batas:{' '}
              <strong className="font-semibold text-ink">
                {formatShortDate(jadwal?.tgl_selesai)}
              </strong>
              {remainingDays !== null && (
                <span className="ml-1 text-muted">
                  ({remainingDays === 0 ? 'Hari ini terakhir' : `${remainingDays} hari lagi`})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Sisi Kanan: Status Pendaftaran & Status Data Diri Ringkas */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Badge Buka / Tutup */}
          {isOpen ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
              </span>
              Pendaftaran Dibuka
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-secondary">
              <span className="size-2 rounded-full bg-slate-400" />
              Pendaftaran Ditutup
            </span>
          )}

          {/* Badge Prasyarat Data Diri (Minimalis) */}
          {dataDiri && (
            isDataDiriLengkap ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <IconCheckCircle className="size-3.5 text-emerald-600" />
                Data Diri Lengkap (6/6)
              </span>
            ) : (
              <Link
                to="/mahasiswa/dokumen"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 focus:outline-hidden"
                title="Klik untuk melengkapi berkas data diri"
              >
                <IconExclamationTriangle className="size-3.5 text-amber-700" />
                Data Diri Belum Lengkap ({dataDiri.jumlah_terunggah || 0}/6)
                <IconArrowRight className="size-3" />
              </Link>
            )
          )}
        </div>
      </div>
    </aside>
  );
}
