import { IconExclamationCircle, IconRefresh } from './Icons.jsx';

/**
 * Komponen Standar Banner Error di Bagian Atas Halaman Utama SIPKITA
 * Menampilkan pesan error terformat dengan tombol aksi Coba Lagi yang seragam.
 *
 * @param {object} props
 * @param {string} [props.title='Gagal Memuat Data'] - Judul banner error
 * @param {string} props.message - Pesan deskripsi error
 * @param {Function} [props.onRetry] - Handler retry pemuatan data
 */
export default function ErrorBanner({
  title = 'Gagal Memuat Data',
  message,
  onRetry,
}) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-[18px] border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-800 flex items-start gap-3 shadow-none transition-all"
    >
      <IconExclamationCircle className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-rose-900">{title}</p>
        <p className="mt-0.5 text-rose-700 leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <IconRefresh className="size-3" />
          <span>Coba Lagi</span>
        </button>
      )}
    </div>
  );
}
