import RefreshButton from '../../common/RefreshButton.jsx';
import {
  IconClose,
  IconSearch,
  IconSpinner,
} from '../../common/Icons.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';

const STATUS_PENGAJUAN_OPTIONS = [
  { value: '', label: 'Semua Status Pengajuan' },
  { value: 'DIAJUKAN', label: 'Menunggu Pemeriksaan' },
  { value: 'ACC', label: 'Disetujui (ACC)' },
  { value: 'TIDAK_ACC', label: 'Ditolak (TIDAK_ACC)' },
];

const STATUS_KATEGORI_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'BELUM_DIPERIKSA', label: 'Belum Diperiksa' },
  { value: 'BELUM_OK', label: 'Perlu Revisi (BELUM OK)' },
  { value: 'OK_LENGKAP', label: 'OK Lengkap' },
];

/**
 * Toolbar Pencarian & Filter Pemeriksaan Pengajuan KP Admin Prodi
 * Konsisten dengan toolbar di Verifikasi Data Diri & Master Mahasiswa.
 * 
 * @param {object} props
 * @param {string} props.search - Nilai teks pencarian
 * @param {Function} props.onSearchChange - Handler perubahan pencarian
 * @param {string} props.statusPengajuan - Nilai filter status pengajuan
 * @param {Function} props.onStatusPengajuanChange - Handler perubahan status pengajuan
 * @param {string} props.statusBerkas - Nilai filter status berkas
 * @param {Function} props.onStatusBerkasChange - Handler perubahan status berkas
 * @param {string} props.statusNilai - Nilai filter status nilai
 * @param {Function} props.onStatusNilaiChange - Handler perubahan status nilai
 * @param {Function} props.onRefresh - Handler tombol refresh
 * @param {Function} props.onReset - Handler reset semua filter
 * @param {boolean} [props.loading] - State loading
 */
export default function KpAdminToolbar({
  search = '',
  onSearchChange,
  statusPengajuan = '',
  statusBerkas = '',
  statusNilai = '',
  onStatusPengajuanChange,
  onStatusBerkasChange,
  onStatusNilaiChange,
  onRefresh,
  refreshing = false,
  onReset,
  loading = false,
}) {
  const hasActiveFilter = Boolean(
    search.trim() || statusPengajuan || statusBerkas || statusNilai
  );

  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative z-20">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Kolom Kiri: Search Input */}
        <div className="relative flex-1 sm:max-w-md">
          <label htmlFor="kp-admin-search" className="sr-only">
            Cari mahasiswa berdasarkan NIM atau nama
          </label>
          {loading ? (
            <IconSpinner className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand pointer-events-none animate-spin" />
          ) : (
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
          )}
          <input
            id="kp-admin-search"
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari berdasarkan NIM atau Nama Mahasiswa…"
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

        {/* Kolom Kanan: Reset Filter & Tombol Refresh */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 min-h-[36px]">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1 border-t border-slate-900/[0.05]">
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
            Pemeriksaan Berkas
          </label>
          <CustomSelect
            value={statusBerkas}
            options={STATUS_KATEGORI_OPTIONS}
            onChange={onStatusBerkasChange}
            placeholder="Semua Status Berkas"
            searchable={false}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold text-muted uppercase tracking-wider">
            Pemeriksaan Nilai
          </label>
          <CustomSelect
            value={statusNilai}
            options={STATUS_KATEGORI_OPTIONS}
            onChange={onStatusNilaiChange}
            placeholder="Semua Status Nilai"
            searchable={false}
          />
        </div>
      </div>
    </div>
  );
}
