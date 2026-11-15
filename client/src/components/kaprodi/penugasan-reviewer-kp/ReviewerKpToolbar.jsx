import {
  IconClose,
  IconRefresh,
  IconSearch,
  IconSpinner,
  IconUsers,
} from '../../common/Icons.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';

const STATUS_PENUGASAN_OPTIONS = [
  { value: '', label: 'Semua Status Penugasan' },
  { value: 'BELUM_ADA', label: 'Belum Ada Reviewer' },
  { value: 'SUDAH_ADA', label: 'Sudah Ada Reviewer' },
];

const STATUS_PENGAJUAN_OPTIONS = [
  { value: '', label: 'Semua Status Pengajuan' },
  { value: 'DIAJUKAN', label: 'Menunggu Pemeriksaan' },
  { value: 'ACC', label: 'Disetujui (ACC Admin)' },
  { value: 'TIDAK_ACC', label: 'Ditolak (TIDAK ACC)' },
];

const SORT_OPTIONS = [
  { value: 'baru', label: 'Pengajuan Terbaru' },
  { value: 'lama', label: 'Pengajuan Terlama' },
];

/**
 * Toolbar Pencarian & Filter Penugasan Reviewer KP Kaprodi
 *
 * @param {object} props
 * @param {string} props.search - Teks pencarian
 * @param {Function} props.onSearchChange - Handler pencarian
 * @param {string} props.statusPenugasan - Filter status penugasan reviewer
 * @param {Function} props.onStatusPenugasanChange - Handler filter status penugasan
 * @param {string} props.statusPengajuan - Filter status pengajuan
 * @param {Function} props.onStatusPengajuanChange - Handler filter status pengajuan
 * @param {string} props.sort - Urutan data ('baru' | 'lama')
 * @param {Function} props.onSortChange - Handler urutan data
 * @param {Function} props.onRefresh - Handler refresh
 * @param {Function} props.onReset - Handler reset filter
 * @param {boolean} [props.loading] - State loading
 * @param {number} [props.selectedCount=0] - Jumlah baris terpilih
 * @param {Function} [props.onOpenBulkAssign] - Handler modal penugasan massal
 */
export default function ReviewerKpToolbar({
  search = '',
  onSearchChange,
  statusPenugasan = '',
  statusPengajuan = '',
  sort = 'baru',
  onStatusPenugasanChange,
  onStatusPengajuanChange,
  onSortChange,
  onRefresh,
  onReset,
  loading = false,
  selectedCount = 0,
  onOpenBulkAssign,
}) {
  const hasActiveFilter = Boolean(
    search.trim() || statusPenugasan || statusPengajuan || sort !== 'baru'
  );

  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative z-20">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Kolom Kiri: Search Input */}
        <div className="relative flex-1 sm:max-w-md">
          <label htmlFor="kaprodi-reviewer-search" className="sr-only">
            Cari berdasarkan NIM, Nama Mahasiswa, atau Judul
          </label>
          {loading ? (
            <IconSpinner className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand pointer-events-none animate-spin" />
          ) : (
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
          )}
          <input
            id="kaprodi-reviewer-search"
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
              <span>Tugaskan Massal ({selectedCount})</span>
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

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-900/[0.08] bg-white/80 hover:bg-white px-3 py-2 text-xs font-semibold text-secondary transition-colors cursor-pointer disabled:opacity-50 shadow-none shrink-0"
            title="Segarkan data antrean"
          >
            <IconRefresh className={`size-3.5 ${loading ? 'animate-spin text-brand' : ''}`} />
            <span className="hidden sm:inline">Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* Baris Filter Dropdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1 border-t border-slate-900/[0.05]">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-muted uppercase tracking-wider">
            Status Penugasan Reviewer
          </label>
          <CustomSelect
            value={statusPenugasan}
            options={STATUS_PENUGASAN_OPTIONS}
            onChange={onStatusPenugasanChange}
            placeholder="Semua Status Penugasan"
            searchable={false}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold text-muted uppercase tracking-wider">
            Status Pengajuan
          </label>
          <CustomSelect
            value={statusPengajuan}
            options={STATUS_PENGAJUAN_OPTIONS}
            onChange={onStatusPengajuanChange}
            placeholder="Semua Status Pengajuan"
            searchable={false}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold text-muted uppercase tracking-wider">
            Urutan
          </label>
          <CustomSelect
            value={sort}
            options={SORT_OPTIONS}
            onChange={onSortChange}
            placeholder="Urutan Data"
            searchable={false}
          />
        </div>
      </div>
    </div>
  );
}

