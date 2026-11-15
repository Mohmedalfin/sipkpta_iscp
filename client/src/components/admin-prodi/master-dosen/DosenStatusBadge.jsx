import { IconCheckCircle, IconLockClosed } from '../../common/Icons.jsx';

export default function DosenStatusBadge({ status, size = 'sm', className = '' }) {
  const isSm = size === 'sm';
  const baseClasses = isSm
    ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold'
    : 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold';

  if (status === 'AKTIF') {
    return (
      <span className={`${baseClasses} border border-emerald-200/70 bg-emerald-50/80 text-emerald-800 ${className}`}>
        <IconCheckCircle className={isSm ? 'size-3 text-emerald-600' : 'size-3.5 text-emerald-600'} />
        <span>Aktif</span>
      </span>
    );
  }

  return (
    <span className={`${baseClasses} border border-slate-900/[0.08] bg-slate-100/80 text-slate-700 ${className}`}>
      <IconLockClosed className={isSm ? 'size-3 text-slate-500' : 'size-3.5 text-slate-500'} />
      <span>Nonaktif</span>
    </span>
  );
}

