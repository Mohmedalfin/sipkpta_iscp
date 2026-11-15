import { REVIEW_LABELS } from '../../../services/reviewerKp.js';

/**
 * Badge status review proposal oleh dosen reviewer
 * Menggunakan single-line dot indicator pill yang konsisten dengan SIPKITA design system.
 *
 * @param {object} props
 * @param {string} props.value - Status review: 'LAYAK' | 'TIDAK_LAYAK' | 'BELUM_DIREVIEW'
 */
export default function ReviewStatus({ value }) {
  if (value === 'LAYAK') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 text-emerald-800 text-[11px] font-semibold whitespace-nowrap">
        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span>{REVIEW_LABELS.LAYAK || 'Layak'}</span>
      </span>
    );
  }

  if (value === 'TIDAK_LAYAK') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-rose-200/80 bg-rose-50/80 text-rose-700 text-[11px] font-semibold whitespace-nowrap">
        <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
        <span>Perlu Revisi</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-amber-200/80 bg-amber-50/80 text-amber-800 text-[11px] font-semibold whitespace-nowrap">
      <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
      <span>{REVIEW_LABELS.BELUM_DIREVIEW || 'Belum Direview'}</span>
    </span>
  );
}
