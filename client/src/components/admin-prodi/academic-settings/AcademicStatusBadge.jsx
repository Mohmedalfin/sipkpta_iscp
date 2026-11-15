import {
  IconCheckCircle,
  IconLockClosed,
  IconInformationCircle,
  IconExclamationCircle,
} from '../../common/Icons.jsx';

/**
 * AcademicStatusBadge
 * Badge status semantik untuk modul Pengaturan Akademik (Periode, Jadwal, Kurikulum, Dokumen, Persyaratan).
 * Mendukung status: AKTIF, NONAKTIF, DRAFT, DIBUKA, BELUM_DIBUKA, DITUTUP, WAJIB, OPSIONAL, dll.
 */
export default function AcademicStatusBadge({ status, size = 'sm', className = '' }) {
  const isSm = size === 'sm';
  const baseClasses = isSm
    ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-tight'
    : 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-tight';

  const normalized = typeof status === 'boolean'
    ? (status ? 'AKTIF' : 'NONAKTIF')
    : String(status || '').toUpperCase().trim();

  switch (normalized) {
    case 'AKTIF':
      return (
        <span className={`${baseClasses} border border-emerald-200/80 bg-emerald-50 text-emerald-800 ${className}`}>
          <IconCheckCircle className={isSm ? 'size-3 text-emerald-600' : 'size-3.5 text-emerald-600'} />
          <span>Aktif</span>
        </span>
      );

    case 'NONAKTIF':
      return (
        <span className={`${baseClasses} border border-slate-200 bg-slate-100 text-slate-700 ${className}`}>
          <IconLockClosed className={isSm ? 'size-3 text-slate-500' : 'size-3.5 text-slate-500'} />
          <span>Nonaktif</span>
        </span>
      );

    case 'DRAFT':
      return (
        <span className={`${baseClasses} border border-amber-200/80 bg-amber-50 text-amber-800 ${className}`}>
          <IconInformationCircle className={isSm ? 'size-3 text-amber-600' : 'size-3.5 text-amber-600'} />
          <span>Draft</span>
        </span>
      );

    case 'DIBUKA':
      return (
        <span className={`${baseClasses} border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold ${className}`}>
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
          </span>
          <span>Dibuka</span>
        </span>
      );

    case 'BELUM_DIBUKA':
      return (
        <span className={`${baseClasses} border border-sky-200/80 bg-sky-50 text-sky-800 ${className}`}>
          <span className="size-1.5 rounded-full bg-sky-500" />
          <span>Belum Dibuka</span>
        </span>
      );

    case 'DITUTUP':
      return (
        <span className={`${baseClasses} border border-rose-200/80 bg-rose-50 text-rose-800 ${className}`}>
          <IconLockClosed className={isSm ? 'size-3 text-rose-600' : 'size-3.5 text-rose-600'} />
          <span>Ditutup</span>
        </span>
      );

    case 'BELUM_DIKONFIGURASI':
      return (
        <span className={`${baseClasses} border border-slate-200 bg-slate-50 text-slate-600 ${className}`}>
          <IconExclamationCircle className={isSm ? 'size-3 text-slate-400' : 'size-3.5 text-slate-400'} />
          <span>Belum Dikonfigurasi</span>
        </span>
      );

    case 'WAJIB':
      return (
        <span className={`${baseClasses} border border-blue-200/80 bg-blue-50 text-brand font-bold ${className}`}>
          <span className="size-1.5 rounded-full bg-brand" />
          <span>Wajib</span>
        </span>
      );

    case 'OPSIONAL':
      return (
        <span className={`${baseClasses} border border-slate-200 bg-slate-100 text-slate-600 ${className}`}>
          <span>Opsional</span>
        </span>
      );

    default:
      return (
        <span className={`${baseClasses} border border-slate-200 bg-slate-50 text-slate-700 ${className}`}>
          <span>{status || '—'}</span>
        </span>
      );
  }
}

