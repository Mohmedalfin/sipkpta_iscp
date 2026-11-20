import RefreshButton from '../../common/RefreshButton.jsx';
import {
  IconArrowDownTray,
  IconCheckCircle,
  IconClose,
  IconSearch,
  IconSpinner,
} from '../../common/Icons.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';

const STATUS_REVIEW_OPTIONS = [
  { value: '', label: 'Semua Status Review' },
  { value: 'BELUM_DIREVIEW', label: 'Belum Direview' },
  { value: 'LAYAK', label: 'Sudah Layak' },
  { value: 'TIDAK_LAYAK', label: 'Perlu Perbaikan (Tidak Layak)' },
];

/**
 * Toolbar Pencarian & Filter Review Proposal KP oleh Dosen Reviewer
 *
 * @param {object} props
 * @param {string} props.search - Teks pencarian
 * @param {Function} props.onSearchChange - Handler perubahan pencarian
 * @param {string} props.statusReview - Filter status review aktif
 * @param {Function} props.onStatusReviewChange - Handler perubahan filter status review
 * @param {Function} props.onRefresh - Handler refresh data antrean
 * @param {Function} props.onReset - Handler reset seluruh filter
 * @param {boolean} [props.loading] - State loading data
 * @param {boolean} [props.busy] - State sedang memproses unduhan/aksi batch
 * @param {number} [props.selectedCount=0] - Jumlah proposal terpilih
 * @param {boolean} [props.canBulk=false] - Kelayakan untuk aksi massal Layak Semua
 * @param {Function} props.onDownloadSelected - Handler unduh ZIP proposal terpilih
 * @param {Function} props.onDownloadAll - Handler unduh seluruh berkas proposal dalam satu ZIP
 * @param {Function} props.onOpenBulkReview - Handler pembuka konfirmasi Layak Semua
 */
export default function ReviewKpToolbar({
  search = '',
  onSearchChange,
  statusReview = '',
  onStatusReviewChange,
  onRefresh,
  refreshing = false,
  onReset,
  loading = false,
  busy = false,
  selectedCount = 0,
  canBulk = false,
  onDownloadSelected,
  onDownloadAll,
  onOpenBulkReview,
}) {
  const hasActiveFilter = Boolean(search.trim() || statusReview);

  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative z-20">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Kolom Kiri: Search Input */}
        <div className="relative flex-1 sm:max-w-md">
          <label htmlFor="reviewer-kp-search" className="sr-only">
            Cari berdasarkan NIM, Nama Mahasiswa, atau Judul Proposal
          </label>
          {loading ? (
            <IconSpinner className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand pointer-events-none animate-spin" />
          ) : (
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
          )}
          <input
            id="reviewer-kp-search"
            type="text"
            value={search}
            maxLength={100}
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

        {/* Kolom Kanan: Aksi Batch, Reset Filter & Refresh */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0 min-h-[36px]">
          {/* Aksi saat ada item terpilih */}
          {selectedCount > 0 && (
            <>
              <button
                type="button"
                onClick={onDownloadSelected}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/10 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
                title="Unduh proposal terpilih dalam format ZIP"
              >
                {busy ? (
                  <IconSpinner className="size-3.5 animate-spin text-brand" />
                ) : (
                  <IconArrowDownTray className="size-3.5" />
                )}
                <span>Unduh Terpilih ({selectedCount})</span>
              </button>

              <button
                type="button"
                onClick={onOpenBulkReview}
                disabled={busy || !canBulk}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-3 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  canBulk
                    ? 'Nyatakan seluruh proposal terpilih sebagai Layak'
                    : 'Pilih 1–50 proposal yang belum direview untuk penilaian massal'
                }
              >
                <IconCheckCircle className="size-3.5" />
                <span>Layak Semua ({selectedCount})</span>
              </button>
            </>
          )}

          {/* Unduh Seluruh Penugasan Aktif */}
          <button
            type="button"
            onClick={onDownloadAll}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/10 bg-white/80 hover:bg-white px-3 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
            title="Unduh seluruh proposal penugasan aktif Anda dalam satu file ZIP"
          >
            {busy ? (
              <IconSpinner className="size-3.5 animate-spin text-brand" />
            ) : (
              <IconArrowDownTray className="size-3.5" />
            )}
            <span className="hidden sm:inline">Unduh Semua ZIP</span>
          </button>

          {/* Tombol Reset Filter */}
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

          {/* Tombol Segarkan Data */}
          <RefreshButton onRefresh={onRefresh} refreshing={refreshing} disabled={loading || busy} />
        </div>
      </div>

      {/* Baris Filter Dropdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 pt-1 border-t border-slate-900/[0.05]">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-muted uppercase tracking-wider">
            Status Review
          </label>
          <CustomSelect
            value={statusReview}
            options={STATUS_REVIEW_OPTIONS}
            onChange={onStatusReviewChange}
            placeholder="Semua Status Review"
          />
        </div>
      </div>
    </div>
  );
}
