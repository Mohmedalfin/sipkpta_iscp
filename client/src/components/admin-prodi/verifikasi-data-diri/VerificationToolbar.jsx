import RefreshButton from '../../common/RefreshButton.jsx';
import { IconClose, IconSearch, IconSpinner } from '../../common/Icons.jsx';

export default function VerificationToolbar({
  searchInput,
  isSearchActive,
  onSearchChange,
  onClearSearch,
  onRefresh,
  isFetching,
  activeStatus,
  onSelectStatusFilter,
  totalAllStudents,
  paginationTotalItems,
  counts,
}) {
  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-4">
      <div className="flex items-center justify-between gap-2.5 sm:gap-3">
        {/* Search Box with Non-Jumping Status Spinner */}
        <div className="relative flex-1 max-w-md">
          {isSearchActive ? (
            <IconSpinner className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand pointer-events-none" />
          ) : (
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
          )}
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari berdasarkan NIM atau Nama Mahasiswa…"
            className="w-full rounded-xl border border-slate-900/[0.12] bg-white/80 pl-10 pr-9 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
              title="Hapus pencarian"
            >
              <IconClose className="size-3" />
            </button>
          )}
        </div>

        {/* Action Buttons: Refresh (Same row on mobile & desktop) */}
        <RefreshButton onRefresh={onRefresh} refreshing={isFetching} disabled={false} />
      </div>

      {/* Filter Pills Tabs (Stable widths, zero shifting) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-bold text-muted mr-1 uppercase tracking-wider shrink-0">
          Filter:
        </span>

        <button
          type="button"
          onClick={() => onSelectStatusFilter('')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
            activeStatus === ''
              ? 'bg-slate-900 text-white shadow-none'
              : 'border border-slate-900/[0.08] bg-white/70 hover:bg-white text-slate-700'
          }`}
        >
          Semua ({totalAllStudents || paginationTotalItems})
        </button>

        <button
          type="button"
          onClick={() => onSelectStatusFilter('BELUM_DIVERIFIKASI')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
            activeStatus === 'BELUM_DIVERIFIKASI'
              ? 'bg-blue-600 text-white shadow-none'
              : 'border border-slate-900/[0.08] bg-white/70 hover:bg-white text-slate-700 hover:text-blue-700'
          }`}
        >
          Menunggu Verifikasi ({counts.belumDiverifikasi})
        </button>

        <button
          type="button"
          onClick={() => onSelectStatusFilter('PERLU_PERBAIKAN')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
            activeStatus === 'PERLU_PERBAIKAN'
              ? 'bg-amber-600 text-white shadow-none'
              : 'border border-slate-900/[0.08] bg-white/70 hover:bg-white text-slate-700 hover:text-amber-800'
          }`}
        >
          Perlu Perbaikan ({counts.perluPerbaikan})
        </button>

        <button
          type="button"
          onClick={() => onSelectStatusFilter('BELUM_LENGKAP')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
            activeStatus === 'BELUM_LENGKAP'
              ? 'bg-slate-700 text-white shadow-none'
              : 'border border-slate-900/[0.08] bg-white/70 hover:bg-white text-slate-700'
          }`}
        >
          Belum Lengkap ({counts.belumLengkap})
        </button>

        <button
          type="button"
          onClick={() => onSelectStatusFilter('TERVERIFIKASI')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
            activeStatus === 'TERVERIFIKASI'
              ? 'bg-emerald-600 text-white shadow-none'
              : 'border border-slate-900/[0.08] bg-white/70 hover:bg-white text-slate-700 hover:text-emerald-800'
          }`}
        >
          Terverifikasi ({counts.terverifikasi})
        </button>
      </div>
    </div>
  );
}
