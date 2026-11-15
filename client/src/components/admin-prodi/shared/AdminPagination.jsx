import { IconArrowLeft, IconArrowRight } from '../../common/Icons.jsx';

function visiblePages(page, totalPages) {
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  return Array.from({ length: Math.min(5, totalPages) }, (_, index) => first + index);
}

export default function AdminPagination({ pagination, onPageChange, loading = false, unit = 'data' }) {
  const total = pagination?.total_items ?? pagination?.total ?? 0;
  if (total < 1) return null;

  const totalPages = Math.max(1, Number(pagination.total_pages) || 1);
  const page = Math.min(Math.max(1, Number(pagination.page) || 1), totalPages);
  const limit = Math.max(1, Number(pagination.limit) || 20);
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pages = visiblePages(page, totalPages);
  const goTo = (nextPage) => {
    if (!loading && nextPage >= 1 && nextPage <= totalPages && nextPage !== page) {
      onPageChange(nextPage);
    }
  };
  const pageButton = (number) => (
    <button key={number} type="button" onClick={() => goTo(number)} disabled={loading}
      aria-label={`Halaman ${number}`} aria-current={number === page ? 'page' : undefined}
      className={`flex size-8 items-center justify-center rounded-lg border text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        number === page ? 'border-brand bg-brand text-white' :
          'border-line bg-white text-secondary hover:bg-subtle'
      }`}>
      {number}
    </button>
  );

  return (
    <nav aria-label={`Halaman daftar ${unit}`}
      className="flex flex-col items-center justify-between gap-3 py-3 text-xs sm:flex-row">
      <p className="text-secondary">
        Menampilkan <strong className="font-semibold text-ink">{start}–{end}</strong> dari{' '}
        <strong className="font-semibold text-ink">{total}</strong> {unit}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button type="button" onClick={() => goTo(page - 1)} disabled={page <= 1 || loading}
          aria-label="Halaman sebelumnya"
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 font-semibold text-secondary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40">
          <IconArrowLeft className="size-3.5" /> <span className="hidden sm:inline">Sebelumnya</span>
        </button>
        {pages[0] > 1 && <>
          {pageButton(1)}
          {pages[0] > 2 && <span aria-hidden="true" className="px-0.5 text-muted">…</span>}
        </>}
        {pages.map(pageButton)}
        {pages.at(-1) < totalPages && <>
          {pages.at(-1) < totalPages - 1 && <span aria-hidden="true" className="px-0.5 text-muted">…</span>}
          {pageButton(totalPages)}
        </>}
        <button type="button" onClick={() => goTo(page + 1)} disabled={page >= totalPages || loading}
          aria-label="Halaman berikutnya"
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 font-semibold text-secondary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40">
          <span className="hidden sm:inline">Berikutnya</span> <IconArrowRight className="size-3.5" />
        </button>
      </div>
    </nav>
  );
}
