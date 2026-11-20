import {
  IconBriefcase,
  IconCheckCircle,
  IconExclamationTriangle,
  IconUsers,
} from '../../common/Icons.jsx';

/**
 * Kartu Ringkasan Metrik Antrean Finalisasi & Penetapan Pembimbing KP
 * Selaras dengan design system SIPKITA (rounded-[18px], border tipis, typography tegas, monospace counter).
 *
 * @param {object} props
 * @param {object} props.counts - Agregasi hitungan { belumSiap, siapDitetapkan, sudahDitetapkan, total }
 * @param {string} props.activeFilter - Filter aktif ('', 'BELUM_SIAP', 'SIAP_DITETAPKAN', 'SUDAH_DITETAPKAN')
 * @param {Function} props.onSelectFilter - Handler pemilihan filter kartu
 * @param {boolean} [props.loading] - State pemuatan data
 */
export default function FinalisasiKpSummaryCards({
  counts = {
    belumSiap: 0,
    siapDitetapkan: 0,
    sudahDitetapkan: 0,
    total: 0,
  },
  activeFilter = '',
  onSelectFilter,
  loading = false,
}) {
  const cards = [
    {
      id: 'BELUM_SIAP',
      title: 'Belum Siap',
      desc: 'Syarat kelayakan/review belum lengkap',
      count: counts.belumSiap || 0,
      icon: IconExclamationTriangle,
      iconColor: 'text-amber-600',
    },
    {
      id: 'SIAP_DITETAPKAN',
      title: 'Siap Ditetapkan',
      desc: 'Lolos kelayakan, siap penetapan',
      count: counts.siapDitetapkan || 0,
      icon: IconCheckCircle,
      iconColor: 'text-emerald-600',
    },
    {
      id: 'SUDAH_DITETAPKAN',
      title: 'Sudah Ditetapkan',
      desc: 'Pembimbing aktif telah ditugaskan',
      count: counts.sudahDitetapkan || 0,
      icon: IconUsers,
      iconColor: 'text-brand',
    },
    {
      id: '',
      title: 'Total Pengajuan',
      desc: 'Semua berkas pengajuan aktif prodi',
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
            key={card.id || 'ALL'}
            type="button"
            onClick={() => onSelectFilter && onSelectFilter(isActive ? '' : card.id)}
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
