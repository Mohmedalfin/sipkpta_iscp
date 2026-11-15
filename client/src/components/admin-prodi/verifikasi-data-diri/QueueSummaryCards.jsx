import {
  IconCheckCircle,
  IconClipboardCheck,
  IconExclamationCircle,
  IconExclamationTriangle,
} from '../../common/Icons.jsx';

export default function QueueSummaryCards({
  activeFilter,
  onSelectFilter,
  counts = {
    belumDiverifikasi: 0,
    perluPerbaikan: 0,
    belumLengkap: 0,
    terverifikasi: 0,
  },
}) {
  const cards = [
    {
      key: 'BELUM_DIVERIFIKASI',
      label: 'Menunggu Verifikasi',
      desc: 'Berkas lengkap 6/6 siap diperiksa',
      count: counts.belumDiverifikasi,
      icon: IconClipboardCheck,
      iconColor: 'text-brand',
    },
    {
      key: 'PERLU_PERBAIKAN',
      label: 'Perlu Perbaikan',
      desc: 'Menunggu revisi dari mahasiswa',
      count: counts.perluPerbaikan,
      icon: IconExclamationTriangle,
      iconColor: 'text-amber-600',
    },
    {
      key: 'BELUM_LENGKAP',
      label: 'Belum Lengkap',
      desc: 'Unggahan berkas belum 6/6',
      count: counts.belumLengkap,
      icon: IconExclamationCircle,
      iconColor: 'text-slate-500',
    },
    {
      key: 'TERVERIFIKASI',
      label: 'Terverifikasi',
      desc: '6/6 berkas disetujui resmi',
      count: counts.terverifikasi,
      icon: IconCheckCircle,
      iconColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isActive = activeFilter === card.key;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelectFilter(isActive ? '' : card.key)}
            className={`group text-left rounded-[18px] border bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none transition-all duration-200 cursor-pointer ${
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
              {card.label}
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

