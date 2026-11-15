import {
  IconCalendarClock,
  IconCheckCircle,
  IconClipboardCheck,
  IconExclamationTriangle,
} from '../../common/Icons.jsx';

/**
 * Kartu Ringkasan Metrik Antrean Pemeriksaan Pengajuan KP Admin Prodi
 * Konsisten dengan KPI Card di Verifikasi Data Diri & Master Mahasiswa.
 * 
 * @param {object} props
 * @param {object} props.counts - Agregasi hitungan
 * @param {string} props.activeFilter - Filter aktif saat ini ('ALL', 'DIAJUKAN', 'BELUM_OK', 'SIAP_ACC', 'ACC')
 * @param {Function} props.onSelectFilter - Handler saat kartu diklik untuk filter cepat
 * @param {boolean} [props.loading] - State loading
 */
export default function KpAdminSummaryCards({
  counts = {
    perluDiperiksa: 0,
    perluPerbaikan: 0,
    siapPutusan: 0,
    sudahAcc: 0,
  },
  activeFilter = 'ALL',
  onSelectFilter,
  loading = false,
}) {
  const cards = [
    {
      id: 'DIAJUKAN',
      title: 'Perlu Diperiksa',
      desc: 'Pengajuan baru & belum diperiksa',
      count: counts.perluDiperiksa || 0,
      icon: IconClipboardCheck,
      iconColor: 'text-brand',
    },
    {
      id: 'BELUM_OK',
      title: 'Perlu Perbaikan',
      desc: 'Menunggu revisi berkas/nilai mahasiswa',
      count: counts.perluPerbaikan || 0,
      icon: IconExclamationTriangle,
      iconColor: 'text-amber-600',
    },
    {
      id: 'SIAP_ACC',
      title: 'Siap Diputuskan',
      desc: 'Berkas & data akademik sudah OK',
      count: counts.siapPutusan || 0,
      icon: IconCalendarClock,
      iconColor: 'text-indigo-600',
    },
    {
      id: 'ACC',
      title: 'Disetujui (ACC)',
      desc: 'Lolos verifikasi administratif Prodi',
      count: counts.sudahAcc || 0,
      icon: IconCheckCircle,
      iconColor: 'text-emerald-600',
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
