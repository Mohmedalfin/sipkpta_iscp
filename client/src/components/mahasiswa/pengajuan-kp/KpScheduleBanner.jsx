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
      <div className="w-full motion-safe:animate-pulse rounded-lg border border-line bg-white px-4 py-3">
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
      className="w-full rounded-xl border border-line bg-white px-4 py-3 motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Sisi Kiri: Ikon, Periode, & Batas Akhir Ringkas */}
        <div className="flex items-start gap-2 min-w-0">
          {isOpen ? (
            <IconCalendarClock className="mt-0.5 size-5 shrink-0 text-secondary" />
          ) : (
            <IconLockClosed className="mt-0.5 size-5 shrink-0 text-secondary" />
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
            <span className="font-semibold text-ink">
              {jadwal?.tahun_ajaran && jadwal?.semester
                ? `Periode ${jadwal.tahun_ajaran} ${jadwal.semester}`
                : 'Periode KP'}
            </span>
            <span className="rounded border border-line bg-subtle/50 px-2 py-0.5 text-[11px] font-medium text-secondary">
              Kerja Praktik
            </span>
            <span className="hidden">•</span>
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
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge Buka / Tutup */}
          {isOpen ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-subtle/50 px-2.5 py-1 text-xs font-semibold text-secondary">
              <span className="size-1.5 rounded-full bg-secondary" aria-hidden="true" />
              Pendaftaran Dibuka
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-subtle/50 px-2.5 py-1 text-xs font-semibold text-secondary">
              <span className="size-2 rounded-full bg-slate-400" />
              Pendaftaran Ditutup
            </span>
          )}

          {/* Badge Prasyarat Data Diri (Minimalis) */}
          {dataDiri && (
            isDataDiriLengkap ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-secondary">
                <IconCheckCircle className="size-3.5 text-secondary" />
                Data Diri Lengkap (6/6)
              </span>
            ) : (
              <Link
                to="/mahasiswa/dokumen"
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 focus:outline-hidden"
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
