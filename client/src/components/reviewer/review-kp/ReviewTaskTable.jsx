import TableSkeletonRows from '../../common/TableSkeletonRows.jsx';
import TableEmptyState, { TableErrorState } from '../../common/TableEmptyState.jsx';
import {
  IconClose,
  IconDocumentSearch,
  IconExclamationCircle,
} from '../../common/Icons.jsx';
import AdminPagination from '../../admin-prodi/shared/AdminPagination.jsx';
import ReviewStatus from './ReviewStatus.jsx';

/**
 * Format tanggal Indonesia ringkas
 */
function formatShortDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '-';
  }
}

/**
 * Ekstraksi inisial nama mahasiswa
 */
function getInitials(name) {
  if (!name) return 'M';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Tabel Antrean Tugas Review Proposal KP oleh Dosen Reviewer
 *
 * @param {object} props
 * @param {object} props.list - Data & handler dari useReviewerKpList
 * @param {Array<number>} [props.selected=[]] - ID pengajuan yang dicentang
 * @param {Function} props.onSelect - Handler toggle centang baris
 * @param {Function} props.onSelectAll - Handler toggle centang semua baris di halaman aktif
 * @param {Function} props.onOpen - Handler buka modal periksa proposal
 * @param {Function} props.onResetFilter - Handler reset filter
 */
export default function ReviewTaskTable({
  list,
  selected = [],
  onSelect,
  onSelectAll,
  onOpen,
  onResetFilter,
}) {
  const items = list?.items || [];
  const loading = Boolean(list?.loading);
  const error = list?.error || '';
  const pagination = list?.pagination || { page: 1, limit: 15, total: 0, total_pages: 1 };

  const allCurrentPageSelected =
    items.length > 0 && items.every((item) => selected.includes(item.pengajuan_id));
  const someCurrentPageSelected =
    items.length > 0 &&
    items.some((item) => selected.includes(item.pengajuan_id)) &&
    !allCurrentPageSelected;

  const hasActiveFilter = Boolean(list?.search?.trim() || list?.query?.status_review);

  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm shadow-none overflow-hidden flex flex-col relative z-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-900/[0.08] bg-slate-50/70 text-secondary uppercase text-[10px] font-bold tracking-wider">
              <th scope="col" className="w-10 px-4 py-3.5 text-center">
                <input
                  type="checkbox"
                  aria-label="Pilih semua proposal di halaman ini"
                  checked={allCurrentPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someCurrentPageSelected;
                  }}
                  onChange={onSelectAll}
                  disabled={loading || items.length === 0}
                  className="rounded border-slate-900/20 text-brand focus:ring-brand/30 size-3.5 cursor-pointer disabled:cursor-not-allowed"
                />
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[200px]">
                Mahasiswa
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[280px]">
                Proposal Penelitian
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[130px]">
                Periode
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[140px]">
                Status Review
              </th>
              <th scope="col" className="px-4 py-3.5 text-right pr-5 min-w-[140px]">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-900/[0.05]">
            {/* 1. Loading Skeleton */}
            {loading ? (
              <TableSkeletonRows columns={6} />
            ) : error ? (
              /* 2. Error State */
              <TableErrorState
                colSpan={6}
                title="Gagal Memuat Antrean Review"
                error={error}
                onRetry={list?.reload}
              />
            ) : items.length === 0 ? (
              /* 3. Empty State */
              <TableEmptyState
                colSpan={6}
                hasActiveFilter={hasActiveFilter}
                onResetFilter={onResetFilter}
                icon={<IconDocumentSearch className="size-6 text-muted" />}
                title="Belum ada penugasan proposal KP"
                filteredTitle="Tidak ada proposal yang sesuai"
                description="Belum ada proposal Kerja Praktik yang ditugaskan kepada Anda saat ini."
                filteredDescription="Tidak ada proposal yang sesuai dengan kriteria pencarian atau filter status yang dipilih."
              />
            ) : (
              /* 4. Data Rows */
              items.map((item) => {
                const isSelected = selected.includes(item.pengajuan_id);
                const nomorVersi = item.versi_proposal?.nomor_versi || 1;
                const tanggalProposal = formatShortDate(
                  item.proposal_updated_at || item.versi_proposal?.created_at
                );

                return (
                  <tr
                    key={item.pengajuan_id}
                    className={`transition-colors duration-150 ${
                      isSelected ? 'bg-brand/5 hover:bg-brand/10' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Pilih proposal ${item.mahasiswa?.nama_lengkap}`}
                        checked={isSelected}
                        onChange={() => onSelect(item.pengajuan_id)}
                        className="rounded border-slate-900/20 text-brand focus:ring-brand/30 size-3.5 cursor-pointer"
                      />
                    </td>

                    {/* Mahasiswa */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 sm:size-9 rounded-full bg-slate-100 border border-slate-900/10 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                          {getInitials(item.mahasiswa?.nama_lengkap)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-ink truncate leading-tight">
                            {item.mahasiswa?.nama_lengkap}
                          </p>
                          <p className="font-mono text-[11px] text-muted truncate mt-0.5">
                            {item.mahasiswa?.nim}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Proposal */}
                    <td className="px-4 py-3.5 max-w-md">
                      <p className="font-medium text-ink line-clamp-2 leading-snug">
                        {item.judul || 'Judul proposal belum tersedia'}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded font-mono font-semibold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                          v{nomorVersi}
                        </span>
                        <span>•</span>
                        <span>Update: {tanggalProposal}</span>
                      </div>
                    </td>

                    {/* Periode */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="font-semibold text-secondary leading-tight">
                        {item.periode?.tahun_ajaran || '-'}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {item.periode?.semester || ''}
                      </p>
                    </td>

                    {/* Status Review */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <ReviewStatus value={item.review_saya} />
                    </td>

                    {/* Aksi */}
                    <td className="px-4 py-3.5 text-right pr-5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpen(item.pengajuan_id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand/20 bg-brand/5 text-brand hover:bg-brand hover:text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        title="Buka ruang kerja review proposal"
                      >
                        <IconDocumentSearch className="size-3.5" />
                        <span>Periksa Proposal</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="border-t border-slate-900/[0.08] px-5 py-2 bg-white/50">
        <AdminPagination
          pagination={pagination}
          onPageChange={list?.setPage}
          loading={loading}
          unit="proposal"
        />
      </div>
    </div>
  );
}
