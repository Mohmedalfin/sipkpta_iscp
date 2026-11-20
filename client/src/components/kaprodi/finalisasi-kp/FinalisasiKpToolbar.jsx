import RefreshButton from '../../common/RefreshButton.jsx';
import {
  IconClose,
  IconSearch,
  IconSpinner,
  IconUsers,
} from '../../common/Icons.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';

const STATUS_FINALISASI_OPTIONS = [
  { value: '', label: 'Semua Status Finalisasi' },
  { value: 'SIAP_DITETAPKAN', label: 'Siap Ditetapkan' },
  { value: 'SUDAH_DITETAPKAN', label: 'Sudah Ditetapkan' },
  { value: 'BELUM_SIAP', label: 'Belum Siap Ditetapkan' },
];

const SORT_OPTIONS = [
  { value: 'baru', label: 'Pengajuan Terbaru' },
  { value: 'lama', label: 'Pengajuan Terlama' },
];

/**
 * Toolbar Pencarian & Filter Antrean Finalisasi & Penetapan Pembimbing KP
 *
 * @param {object} props
 * @param {string} props.search - Teks input pencarian
 * @param {Function} props.onSearchChange - Handler perubahan pencarian
 * @param {string} props.statusFinalisasi - Filter status finalisasi aktif
 * @param {Function} props.onStatusFinalisasiChange - Handler perubahan status finalisasi
 * @param {string} props.sort - Urutan data ('baru' | 'lama')
 * @param {Function} props.onSortChange - Handler perubahan urutan
 * @param {Function} props.onRefresh - Handler refresh data
 * @param {Function} props.onReset - Handler reset seluruh filter
 * @param {boolean} [props.loading] - State pemuatan data
 * @param {number} [props.selectedCount=0] - Jumlah baris terpilih
 * @param {Function} [props.onOpenBulkAssign] - Handler klik tombol aksi massal
 */
export default function FinalisasiKpToolbar({
  search = '',
  onSearchChange,
  statusFinalisasi = '',
  sort = 'baru',
  onStatusFinalisasiChange,
  onSortChange,
  onRefresh,
  refreshing = false,
  onReset,
  loading = false,
  selectedCount = 0,
  onOpenBulkAssign,
}) {
  const hasActiveFilter = Boolean(
    search.trim() || statusFinalisasi || sort !== 'baru'
  );

  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative z-20">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Kolom Kiri: Search Input */}
        <div className="relative flex-1 sm:max-w-md">
          <label htmlFor="kaprodi-finalisasi-search" className="sr-only">
            Cari berdasarkan NIM, Nama Mahasiswa, atau Judul Proposal
          </label>
          {loading ? (
            <IconSpinner className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand pointer-events-none animate-spin" />
          ) : (
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
          )}
          <input
            id="kaprodi-finalisasi-search"
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari berdasarkan NIM, Nama, atau Judul Proposal…"
            className="w-full rounded-xl border border-slate-900/[0.12] bg-white/80 pl-10 pr-9 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
              title="Hapus pencarian"
              aria-label="Hapus pencarian"
            >
              <IconClose className="size-3" />
            </button>
          )}
        </div>

        {/* Kolom Kanan: Aksi Massal, Reset Filter & Refresh */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 min-h-[36px]">
          {selectedCount > 0 && onOpenBulkAssign && (
            <button
              type="button"
              onClick={onOpenBulkAssign}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-3 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <IconUsers className="size-3.5" />
              <span>Tetapkan Massal ({selectedCount})</span>
            </button>
          )}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50/70 transition-colors cursor-pointer"
              title="Reset semua filter"
            >
              <IconClose className="size-3" />
              <span>Reset Filter</span>
            </button>
          )}

          <RefreshButton onRefresh={onRefresh} refreshing={refreshing} disabled={loading} />
        </div>
      </div>

      {/* Baris Filter Dropdown */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-900/[0.05]">
        <div className="w-full sm:w-56">
          <CustomSelect
            value={statusFinalisasi}
            options={STATUS_FINALISASI_OPTIONS}
            onChange={(val) => onStatusFinalisasiChange && onStatusFinalisasiChange(val)}
            placeholder="Filter Status Finalisasi"
            searchable={false}
          />
        </div>

        <div className="w-full sm:w-48">
          <CustomSelect
            value={sort}
            options={SORT_OPTIONS}
            onChange={(val) => onSortChange && onSortChange(val)}
            placeholder="Urutan Waktu"
            searchable={false}
          />
        </div>
      </div>
    </div>
  );
}
