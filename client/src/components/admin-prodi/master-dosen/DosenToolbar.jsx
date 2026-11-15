import {
  IconClose,
  IconRefresh,
  IconSearch,
  IconSpinner,
} from '../../common/Icons.jsx';

export default function DosenToolbar({
  searchInput,
  isSearchActive,
  onSearchChange,
  onClearSearch,
  onRefresh,
  isFetching,
  totalItems = 0,
}) {
  const hasActiveFilters = Boolean(searchInput);

  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Sisi Kiri: Search Input */}
        <div className="flex-1 sm:max-w-md">
          <div className="relative w-full">
            <label htmlFor="master-dosen-search" className="sr-only">
              Cari dosen berdasarkan Kode Dosen, NIDN, atau Nama Lengkap
            </label>
            {isSearchActive ? (
              <IconSpinner className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand pointer-events-none" />
            ) : (
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
            )}
            <input
              id="master-dosen-search"
              type="text"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari berdasarkan Kode Dosen, NIDN, atau Nama Lengkap…"
              className="w-full rounded-xl border border-slate-900/[0.12] bg-white/80 pl-10 pr-9 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
                title="Hapus pencarian"
                aria-label="Hapus pencarian"
              >
                <IconClose className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Sisi Kanan: Reset Filter & Refresh Button (Tinggi terkunci stabil) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 min-h-[36px]">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearSearch}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50/70 transition-colors cursor-pointer"
              title="Reset pencarian"
            >
              <IconClose className="size-3" />
              <span>Reset Pencarian</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-900/[0.08] bg-white/80 hover:bg-white px-3 py-2 text-xs font-semibold text-secondary transition-colors cursor-pointer disabled:opacity-50 shadow-none shrink-0"
            title="Segarkan data dosen"
          >
            <IconRefresh className={`size-3.5 ${isFetching ? 'animate-spin text-brand' : ''}`} />
            <span className="hidden sm:inline">Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* Baris Informasi Hasil Pencarian */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900/[0.04] text-[11px] text-muted">
        <div>
          <span>Menampilkan hasil: </span>
          <strong className="text-ink font-semibold">{totalItems} dosen</strong>
          {searchInput && (
            <span> dengan kata kunci <strong className="text-brand font-semibold">"{searchInput}"</strong></span>
          )}
        </div>
      </div>
    </div>
  );
}

