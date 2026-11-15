import {
  IconCheckCircle,
  IconExclamationCircle,
  IconExclamationTriangle,
  IconInformationCircle,
} from '../../common/Icons.jsx';

export default function StatusBadge({ status, size = 'sm', className = '' }) {
  const isSm = size === 'sm';
  const baseClasses = isSm
    ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold'
    : 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold';

  switch (status) {
    case 'TERVERIFIKASI':
      return (
        <span className={`${baseClasses} border border-emerald-200/70 bg-emerald-50/80 text-emerald-800 ${className}`}>
          <IconCheckCircle className={isSm ? 'size-3.5 text-emerald-600' : 'size-4 text-emerald-600'} />
          <span>Terverifikasi</span>
        </span>
      );

    case 'PERLU_PERBAIKAN':
      return (
        <span className={`${baseClasses} border border-amber-200/70 bg-amber-50/80 text-amber-900 ${className}`}>
          <IconExclamationTriangle className={isSm ? 'size-3.5 text-amber-600' : 'size-4 text-amber-600'} />
          <span>Perlu Perbaikan</span>
        </span>
      );

    case 'BELUM_DIVERIFIKASI':
      return (
        <span className={`${baseClasses} border border-blue-200/70 bg-blue-50/80 text-blue-800 ${className}`}>
          <IconInformationCircle className={isSm ? 'size-3.5 text-blue-600' : 'size-4 text-blue-600'} />
          <span>Menunggu Verifikasi</span>
        </span>
      );

    case 'BELUM_DIPERIKSA':
      return (
        <span className={`${baseClasses} border border-sky-200/70 bg-sky-50/80 text-sky-800 ${className}`}>
          <IconInformationCircle className={isSm ? 'size-3.5 text-sky-600' : 'size-4 text-sky-600'} />
          <span>Belum Diperiksa</span>
        </span>
      );

    case 'BELUM_LENGKAP':
    default:
      return (
        <span className={`${baseClasses} border border-slate-900/[0.08] bg-white/80 text-slate-700 ${className}`}>
          <IconExclamationCircle className={isSm ? 'size-3.5 text-slate-500' : 'size-4 text-slate-500'} />
          <span>Belum Lengkap</span>
        </span>
      );
  }
}


