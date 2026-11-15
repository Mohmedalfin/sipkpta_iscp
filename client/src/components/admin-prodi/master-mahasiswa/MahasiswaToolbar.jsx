import { useEffect, useRef, useState } from 'react';
import {
  IconCalendar,
  IconChevronDown,
  IconClose,
  IconRefresh,
  IconSearch,
  IconSpinner,
} from '../../common/Icons.jsx';

export default function MahasiswaToolbar({
  searchInput,
  isSearchActive,
  onSearchChange,
  onClearSearch,
  selectedAngkatan,
  onSelectAngkatan,
  availableAngkatan = [],
  onRefresh,
  isFetching,
  totalItems = 0,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const hasActiveFilters = Boolean(searchInput || selectedAngkatan);

  // Menutup menu dropdown saat klik di luar elemen atau menekan tombol Escape
  useEffect(() => {
    if (!isDropdownOpen) return;

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const handleResetAll = () => {
    onClearSearch();
    onSelectAngkatan('');
    setIsDropdownOpen(false);
  };

  return (
    <div
      className={`rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative ${
        isDropdownOpen ? 'z-30' : 'z-10'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Sisi Kiri: Search Input & Filter Angkatan (Lebar stabil mencegah pergeseran layout) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-md">
            <label htmlFor="master-mahasiswa-search" className="sr-only">
              Cari mahasiswa berdasarkan NIM atau nama
            </label>
            {isSearchActive ? (
              <IconSpinner className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand pointer-events-none" />
            ) : (
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
            )}
            <input
              id="master-mahasiswa-search"
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
                aria-label="Hapus pencarian"
              >
                <IconClose className="size-3" />
              </button>
            )}
          </div>

          {/* Filter Dropdown Angkatan Dinamis */}
          <div ref={dropdownRef} className={`relative shrink-0 sm:w-48 ${isDropdownOpen ? 'z-40' : ''}`}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              className={`w-full flex items-center justify-between rounded-xl border pl-3.5 pr-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                isDropdownOpen
                  ? 'border-brand ring-2 ring-brand/20 bg-white text-ink shadow-xs'
                  : selectedAngkatan
                  ? 'border-brand/40 bg-brand-soft/60 text-brand font-semibold hover:bg-brand-soft'
                  : 'border-slate-900/[0.12] bg-white/80 text-ink hover:bg-white hover:border-slate-900/[0.2]'
              }`}
              title="Filter menurut Tahun Angkatan"
            >
              <div className="flex items-center gap-2 min-w-0">
                <IconCalendar
                  className={`size-3.5 shrink-0 transition-colors ${
                    selectedAngkatan || isDropdownOpen ? 'text-brand' : 'text-muted'
                  }`}
                />
                <span className="truncate">
                  {selectedAngkatan ? `Angkatan ${selectedAngkatan}` : 'Semua Angkatan'}
                </span>
              </div>
              <IconChevronDown
                className={`size-3.5 shrink-0 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180 text-brand' : 'text-muted'
                }`}
              />
            </button>

            {/* Menu Pilihan Angkatan */}
            {isDropdownOpen && (
              <div
                role="listbox"
                className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl border border-slate-900/[0.08] bg-white p-1 shadow-xl text-xs space-y-0.5 max-h-56 overflow-y-auto animate-fadeIn"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={!selectedAngkatan}
                  onClick={() => {
                    onSelectAngkatan('');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    !selectedAngkatan
                      ? 'bg-brand-soft text-brand font-semibold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-ink'
                  }`}
                >
                  <span>Semua Angkatan</span>
                  {!selectedAngkatan && <span className="text-brand font-bold text-xs">✓</span>}
                </button>

                {availableAngkatan.map((year) => {
                  const isSelected = selectedAngkatan === year.toString() || selectedAngkatan === year;
                  return (
                    <button
                      key={year}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelectAngkatan(year.toString());
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-brand-soft text-brand font-semibold'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-ink'
                      }`}
                    >
                      <span>Angkatan {year}</span>
                      {isSelected && <span className="text-brand font-bold text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sisi Kanan: Reset Filter & Refresh Button (Tinggi terkunci stabil) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 min-h-[36px]">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50/70 transition-colors cursor-pointer"
              title="Reset semua filter dan pencarian"
            >
              <IconClose className="size-3" />
              <span>Reset Filter</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-900/[0.08] bg-white/80 hover:bg-white px-3 py-2 text-xs font-semibold text-secondary transition-colors cursor-pointer disabled:opacity-50 shadow-none shrink-0"
            title="Segarkan data mahasiswa"
          >
            <IconRefresh className={`size-3.5 ${isFetching ? 'animate-spin text-brand' : ''}`} />
            <span className="hidden sm:inline">Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* Baris Informasi Hasil / Active Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900/[0.04] text-[11px] text-muted">
        <div>
          <span>Menampilkan hasil pencarian: </span>
          <strong className="text-ink font-semibold">{totalItems} mahasiswa</strong>
          {selectedAngkatan && (
            <span> • Angkatan <strong className="text-brand font-semibold">{selectedAngkatan}</strong></span>
          )}
        </div>
      </div>
    </div>
  );
}
