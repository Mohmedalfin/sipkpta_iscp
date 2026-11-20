import RefreshButton from '../../common/RefreshButton.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';
import { IconClose, IconPlus, IconSearch } from '../../common/Icons.jsx';

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status Bimbingan' },
  { value: 'TERVALIDASI', label: 'Tervalidasi' },
  { value: 'MENUNGGU_VALIDASI', label: 'Menunggu Validasi' },
  { value: 'PERLU_PERBAIKAN', label: 'Perlu Perbaikan' },
  { value: 'DRAFT', label: 'Draf Tersimpan' },
  { value: 'DITOLAK', label: 'Ditolak' },
];

const JENIS_OPTIONS = [
  { value: '', label: 'Semua Jenis Bimbingan' },
  { value: 'OFFLINE', label: 'Tatap Muka (Offline)' },
  { value: 'ONLINE', label: 'Daring (Online)' },
];

/**
 * Toolbar Filter, Pencarian, & Aksi Tambah Bimbingan Mahasiswa
 * Responsif penuh untuk Desktop dan Mode Ponsel (Mobile-First UX)
 *
 * @param {object} props
 * @param {string} props.search - Kata kunci pencarian
 * @param {Function} props.onSearchChange - Handler perubahan pencarian
 * @param {string} props.statusFilter - Filter status bimbingan
 * @param {Function} props.onStatusFilterChange - Handler ganti status
 * @param {string} props.jenisFilter - Filter jenis bimbingan
 * @param {Function} props.onJenisFilterChange - Handler ganti jenis
 * @param {Function} props.onRefresh - Handler refresh data
 * @param {boolean} [props.refreshing] - State background refresh
 * @param {Function} props.onReset - Handler reset seluruh filter
 * @param {boolean} [props.hasActiveFilter] - Penanda ada filter aktif
 * @param {Function} props.onOpenCreate - Handler klik tombol "+ Catat Bimbingan"
 * @param {boolean} [props.disabled] - State disable tombol
 */
export default function BimbinganToolbar({
  search = '',
  onSearchChange,
  statusFilter = '',
  onStatusFilterChange,
  jenisFilter = '',
  onJenisFilterChange,
  onRefresh,
  refreshing = false,
  onReset,
  hasActiveFilter = false,
  onOpenCreate,
  disabled = false,
}) {
  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-3.5 sm:p-5 shadow-none space-y-3 sm:space-y-3.5 relative z-20">
      {/* ================= BARIS 1: PENCARIAN & AKSI ================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        {/* Input Pencarian (Dengan Refresh di mobile pada satu baris) */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
          <div className="relative flex-1 min-w-0">
            <label htmlFor="bimbingan-search" className="sr-only">
              Cari catatan bimbingan atau arahan pembimbing
            </label>
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
            <input
              id="bimbingan-search"
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari ringkasan materi atau catatan dosen…"
              className="w-full h-9 rounded-xl border border-slate-900/[0.12] bg-white pl-9.5 pr-8 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-muted hover:text-ink cursor-pointer"
                title="Hapus pencarian"
              >
                <IconClose className="size-3.5" />
              </button>
            )}
          </div>

          {/* Tombol Refresh Khusus Mobile (Icon only, sejajar dengan search input) */}
          <div className="sm:hidden shrink-0">
            <RefreshButton
              onRefresh={onRefresh}
              refreshing={refreshing}
              title="Segarkan daftar bimbingan"
            />
          </div>
        </div>

        {/* Tombol Tambah Bimbingan Khusus Mobile (Full-width, thumb-friendly) */}
        <button
          type="button"
          onClick={onOpenCreate}
          disabled={disabled}
          className="w-full sm:hidden inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-3.5 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Catat sesi bimbingan baru"
        >
          <IconPlus className="size-3.5 text-white" />
          <span>Catat Bimbingan</span>
        </button>

        {/* Desktop Actions Cluster (>= sm): Reset Filter, Refresh Button & Catat Bimbingan */}
        <div className="hidden sm:flex items-center gap-2 shrink-0 min-h-[36px]">
          {hasActiveFilter && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100/80 hover:text-rose-800 transition-colors cursor-pointer shadow-2xs"
              title="Reset semua filter"
            >
              <IconClose className="size-3 text-rose-600" />
              <span>Reset Filter</span>
            </button>
          )}

          <RefreshButton
            onRefresh={onRefresh}
            refreshing={refreshing}
            title="Segarkan daftar bimbingan"
          />

          <button
            type="button"
            onClick={onOpenCreate}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Catat sesi bimbingan baru"
          >
            <IconPlus className="size-3.5 text-white" />
            <span>Catat Bimbingan</span>
          </button>
        </div>
      </div>

      {/* ================= BARIS 2: DROPDOWN FILTER & KETERANGAN ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-900/[0.05] pt-2.5 sm:pt-3">
        {/* Kolom Filter: Grid 2-Kolom di Mobile, Flex di Desktop */}
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-2.5">
          {/* Filter Status */}
          <div className="w-full sm:w-52">
            <CustomSelect
              value={statusFilter}
              onChange={onStatusFilterChange}
              options={STATUS_OPTIONS}
              placeholder="Status Bimbingan"
            />
          </div>

          {/* Filter Jenis */}
          <div className="w-full sm:w-48">
            <CustomSelect
              value={jenisFilter}
              onChange={onJenisFilterChange}
              options={JENIS_OPTIONS}
              placeholder="Jenis Pelaksanaan"
            />
          </div>
        </div>

        {/* Info & Reset Filter untuk Mobile */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-[11px] text-muted">
          {/* Tombol Reset Filter di Mobile saat aktif */}
          {hasActiveFilter && (
            <div className="sm:hidden">
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200/80 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100/80 transition-colors cursor-pointer shadow-2xs"
                title="Reset semua filter"
              >
                <IconClose className="size-2.5 text-rose-600" />
                <span>Reset Filter</span>
              </button>
            </div>
          )}

          <span className="truncate">
            Menampilkan catatan bimbingan KP Anda
          </span>
        </div>
      </div>
    </div>
  );
}
