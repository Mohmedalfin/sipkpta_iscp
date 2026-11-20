import {
  IconCheckCircle,
  IconClose,
  IconDocumentText,
  IconExclamationTriangle,
} from '../../common/Icons.jsx';

/**
 * Komponen Badge Status Bimbingan Mahasiswa
 * @param {object} props
 * @param {string} props.status - Status bimbingan
 */
export default function BimbinganStatusBadge({ status }) {
  if (status === 'TERVALIDASI') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 whitespace-nowrap select-none shrink-0">
        <IconCheckCircle className="size-3 text-emerald-600 shrink-0" />
        <span className="whitespace-nowrap">Tervalidasi</span>
      </span>
    );
  }

  if (status === 'MENUNGGU_VALIDASI') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand whitespace-nowrap select-none shrink-0">
        <span className="size-1.5 rounded-full bg-brand animate-pulse shrink-0" />
        <span className="whitespace-nowrap">Menunggu Validasi</span>
      </span>
    );
  }

  if (status === 'PERLU_PERBAIKAN') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 whitespace-nowrap select-none shrink-0">
        <IconExclamationTriangle className="size-3 text-amber-600 shrink-0" />
        <span className="whitespace-nowrap">Perlu Perbaikan</span>
      </span>
    );
  }

  if (status === 'DITOLAK') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 whitespace-nowrap select-none shrink-0">
        <IconClose className="size-3 text-rose-600 shrink-0" />
        <span className="whitespace-nowrap">Ditolak</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100/80 px-2.5 py-0.5 text-[11px] font-medium text-secondary whitespace-nowrap select-none shrink-0">
      <IconDocumentText className="size-3 text-muted shrink-0" />
      <span className="whitespace-nowrap">Draf</span>
    </span>
  );
}

/**
 * Komponen Badge Jenis Pelaksanaan Bimbingan
 * @param {object} props
 * @param {'OFFLINE'|'ONLINE'|string} props.jenis - Jenis bimbingan
 */
export function BimbinganJenisBadge({ jenis }) {
  if (jenis === 'ONLINE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 uppercase tracking-wide whitespace-nowrap select-none shrink-0">
        <span className="whitespace-nowrap">Daring</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800 uppercase tracking-wide whitespace-nowrap select-none shrink-0">
      <span className="whitespace-nowrap">Tatap Muka</span>
    </span>
  );
}
