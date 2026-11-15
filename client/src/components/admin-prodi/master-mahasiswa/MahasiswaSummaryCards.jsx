import {
  IconCalendar,
  IconCheckCircle,
  IconLockClosed,
  IconUsers,
} from '../../common/Icons.jsx';

export default function MahasiswaSummaryCards({
  counts = {
    total: 0,
    aktif: 0,
    nonaktif: 0,
  },
  selectedAngkatan = null,
}) {
  const cards = [
    {
      key: 'total',
      label: 'Total Mahasiswa',
      desc: 'Basis data mahasiswa prodi',
      count: counts.total,
      icon: IconUsers,
      iconColor: 'text-brand',
    },
    {
      key: 'aktif',
      label: 'Mahasiswa Aktif',
      desc: 'Akun terdaftar dapat login',
      count: counts.aktif,
      icon: IconCheckCircle,
      iconColor: 'text-emerald-600',
    },
    {
      key: 'nonaktif',
      label: 'Akun Nonaktif',
      desc: 'Akses login ditangguhkan',
      count: counts.nonaktif,
      icon: IconLockClosed,
      iconColor: 'text-slate-500',
    },
    {
      key: 'angkatan',
      label: selectedAngkatan ? `Angkatan ${selectedAngkatan}` : 'Semua Angkatan',
      desc: selectedAngkatan ? 'Filter aktif diterapkan' : 'Seluruh tahun angkatan',
      count: selectedAngkatan || 'Semua',
      isTextCount: !selectedAngkatan,
      icon: IconCalendar,
      iconColor: 'text-indigo-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;

        return (
          <div
            key={card.key}
            className="text-left rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none"
          >
            {/* Header metrik dengan tinggi terkunci agar tidak memicu pergeseran layout (CLS) */}
            <div className="flex items-center justify-between gap-2 mb-3 h-8 sm:h-9">
              <IconComponent className={`size-6 sm:size-7 shrink-0 ${card.iconColor}`} />
              <div className="h-full flex items-center justify-end">
                <span
                  className={`${
                    card.isTextCount ? 'text-lg sm:text-xl font-bold' : 'text-2xl sm:text-3xl font-extrabold'
                  } text-ink tracking-tight font-mono leading-none`}
                >
                  {card.count}
                </span>
              </div>
            </div>

            {/* Label dan deskripsi dengan tinggi tetap untuk mencegah lonjakan baris */}
            <p className="text-xs sm:text-sm font-bold text-ink leading-snug line-clamp-1 h-5 flex items-center">
              {card.label}
            </p>
            <p className="mt-0.5 text-[11px] text-muted leading-tight line-clamp-1 h-4 flex items-center">
              {card.desc}
            </p>
          </div>
        );
      })}
    </div>
  );
}
