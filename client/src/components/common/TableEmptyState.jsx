import {
  IconClose,
  IconExclamationCircle,
  IconRefresh,
  IconSearch,
} from './Icons.jsx';

/**
 * Komponen Standar Empty State untuk Seluruh Tabel SIPKITA
 * Menangani 2 kondisi:
 * 1. Filter aktif menghasilkan 0 data -> Ikon pencarian, teks filter tidak cocok, dan tombol reset filter.
 * 2. Data kosong alami dari server -> Ikon domain kontekstual, teks data kosong, tanpa tombol reset.
 *
 * @param {object} props
 * @param {number} props.colSpan - Jumlah kolom tabel
 * @param {boolean} [props.hasActiveFilter=false] - True jika ada filter/pencarian aktif
 * @param {Function} [props.onResetFilter] - Callback saat tombol Reset diklik
 * @param {React.ReactNode} [props.icon] - Ikon kustom saat data kosong alami
 * @param {string} [props.title='Belum ada data'] - Judul saat data kosong alami
 * @param {string} [props.filteredTitle='Tidak ada data yang sesuai'] - Judul saat filter aktif
 * @param {string} [props.description='Saat ini belum ada data yang tersedia.'] - Deskripsi data kosong alami
 * @param {string} [props.filteredDescription='Coba sesuaikan kata kunci pencarian atau ubah filter yang diterapkan.'] - Deskripsi saat filter aktif
 * @param {string} [props.resetLabel='Reset Filter Pencarian'] - Label tombol reset
 */
export default function TableEmptyState({
  colSpan,
  hasActiveFilter = false,
  onResetFilter,
  icon,
  title = 'Belum ada data',
  filteredTitle = 'Tidak ada data yang sesuai',
  description = 'Saat ini belum ada data yang tersedia.',
  filteredDescription = 'Coba sesuaikan kata kunci pencarian atau ubah filter yang diterapkan.',
  resetLabel = 'Reset Filter Pencarian',
}) {
  const displayTitle = hasActiveFilter ? filteredTitle : title;
  const displayDescription = hasActiveFilter ? filteredDescription : description;

  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
          <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-muted mb-3.5 shrink-0">
            {hasActiveFilter ? (
              <IconSearch className="size-6 text-muted" />
            ) : (
              icon || <IconSearch className="size-6 text-muted" />
            )}
          </div>
          <h3 className="text-sm font-bold text-ink">
            {displayTitle}
          </h3>
          <p className="mt-1 text-xs text-secondary leading-relaxed">
            {displayDescription}
          </p>
          {hasActiveFilter && onResetFilter && (
            <button
              type="button"
              onClick={onResetFilter}
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.12] bg-white px-3.5 py-1.5 text-xs font-semibold text-secondary hover:text-ink hover:bg-slate-50 transition-colors cursor-pointer shadow-none"
            >
              <IconClose className="size-3" />
              <span>{resetLabel}</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Komponen Standar Error State di Dalam Baris Tabel
 * Ditampilkan saat data tabel gagal dimuat dari server
 *
 * @param {object} props
 * @param {number} props.colSpan - Jumlah kolom tabel
 * @param {string} [props.title='Gagal Memuat Data'] - Judul error
 * @param {string} [props.error='Terjadi kesalahan saat memuat data dari server.'] - Pesan error
 * @param {Function} [props.onRetry] - Handler tombol coba lagi
 */
export function TableErrorState({
  colSpan,
  title = 'Gagal Memuat Data',
  error = 'Terjadi kesalahan saat memuat data dari server.',
  onRetry,
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
          <div className="size-12 rounded-full bg-rose-100/80 flex items-center justify-center text-rose-600 mb-3.5 shrink-0">
            <IconExclamationCircle className="size-6 text-rose-600" />
          </div>
          <h3 className="text-sm font-bold text-ink">
            {title}
          </h3>
          <p className="mt-1 text-xs text-secondary leading-relaxed">
            {error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-brand text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-brand-hover transition-colors cursor-pointer shadow-xs"
            >
              <IconRefresh className="size-3.5" />
              <span>Coba Lagi</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
