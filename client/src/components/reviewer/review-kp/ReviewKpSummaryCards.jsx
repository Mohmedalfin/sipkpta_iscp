import {
  IconCheckCircle,
  IconDocumentSearch,
  IconExclamationCircle,
  IconExclamationTriangle,
} from '../../common/Icons.jsx';

/**
 * Kartu Ringkasan Metrik Beban Review Proposal KP oleh Dosen Reviewer
 * Selaras dengan design system SIPKITA (rounded-[18px], bare icon kiri, monospace counter kanan).
 *
 * @param {object} props
 * @param {object} props.counts - Agregasi hitungan { belumDireview, layak, tidakLayak, total }
 * @param {string} props.activeFilter - Filter aktif ('ALL', 'BELUM_DIREVIEW', 'LAYAK', 'TIDAK_LAYAK')
 * @param {Function} props.onSelectFilter - Handler filter cepat kartu
 * @param {boolean} [props.loading] - State loading
 */
export default function ReviewKpSummaryCards({
  counts = {
    belumDireview: 0,
    layak: 0,
    tidakLayak: 0,
    total: 0,
  },
  activeFilter = 'ALL',
  onSelectFilter,
  loading = false,
}) {
  const cards = [
    {
      id: 'BELUM_DIREVIEW',
      title: 'Belum Direview',
      desc: 'Proposal menunggu telaah Anda',
      count: counts.belumDireview || 0,
      icon: IconExclamationTriangle,
      iconColor: 'text-amber-600',
    },
    {
      id: 'LAYAK',
      title: 'Sudah Layak',
      desc: 'Dinyatakan memenuhi syarat',
      count: counts.layak || 0,
      icon: IconCheckCircle,
      iconColor: 'text-emerald-600',
    },
    {
      id: 'TIDAK_LAYAK',
      title: 'Perlu Perbaikan',
      desc: 'Menunggu revisi mahasiswa',
      count: counts.tidakLayak || 0,
      icon: IconExclamationCircle,
      iconColor: 'text-rose-600',
    },
    {
      id: 'ALL',
      title: 'Total Penugasan',
      desc: 'Seluruh proposal ditugaskan',
      count: counts.total || 0,
      icon: IconDocumentSearch,
      iconColor: 'text-brand',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isActive = activeFilter === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter && onSelectFilter(isActive ? 'ALL' : card.id)}
            disabled={loading}
            className={`group text-left rounded-[18px] border bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none transition-all duration-200 cursor-pointer disabled:cursor-not-allowed ${
              isActive
                ? 'border-slate-900/30 bg-white/95 ring-1.5 ring-slate-900/15 shadow-xs'
                : 'border-slate-900/[0.08] hover:bg-white hover:border-slate-900/[0.15]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <IconComponent className={`size-6 sm:size-7 shrink-0 ${card.iconColor}`} />
              <span className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-mono">
                {card.count}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-bold text-ink leading-snug">
              {card.title}
            </p>
            <p className="mt-0.5 text-[11px] text-muted leading-tight line-clamp-1">
              {card.desc}
            </p>
          </button>
        );
      })}
    </div>
  );
}
