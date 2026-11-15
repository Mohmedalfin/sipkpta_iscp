import {
  IconBriefcase,
  IconCheckCircle,
  IconDocumentSearch,
  IconExclamationTriangle,
} from '../../common/Icons.jsx';

/**
 * Kartu Ringkasan Metrik Antrean Penugasan Reviewer KP Kaprodi
 * Selaras dengan design system SIPKITA (rounded-[18px], bare icon kiri, monospace counter kanan).
 *
 * @param {object} props
 * @param {object} props.counts - Agregasi hitungan { belumAda, sudahAda, sudahAcc, total }
 * @param {string} props.activeFilter - Filter aktif ('ALL', 'BELUM_ADA', 'SUDAH_ADA', 'ACC')
 * @param {Function} props.onSelectFilter - Handler filter cepat kartu
 * @param {boolean} [props.loading] - State loading
 */
export default function ReviewerKpSummaryCards({
  counts = {
    belumAda: 0,
    sudahAda: 0,
    sudahAcc: 0,
    total: 0,
  },
  activeFilter = 'ALL',
  onSelectFilter,
  loading = false,
}) {
  const cards = [
    {
      id: 'BELUM_ADA',
      title: 'Belum Ada Reviewer',
      desc: 'Menunggu penugasan dosen penelaah',
      count: counts.belumAda || 0,
      icon: IconExclamationTriangle,
      iconColor: 'text-amber-600',
    },
    {
      id: 'SUDAH_ADA',
      title: 'Sudah Ditugaskan',
      desc: 'Memiliki reviewer aktif prodi',
      count: counts.sudahAda || 0,
      icon: IconDocumentSearch,
      iconColor: 'text-brand',
    },
    {
      id: 'ACC',
      title: 'ACC Administratif',
      desc: 'Lolos verifikasi berkas Admin',
      count: counts.sudahAcc || 0,
      icon: IconCheckCircle,
      iconColor: 'text-emerald-600',
    },
    {
      id: 'ALL',
      title: 'Total Pengajuan',
      desc: 'Semua berkas pengajuan prodi',
      count: counts.total || 0,
      icon: IconBriefcase,
      iconColor: 'text-slate-700',
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

