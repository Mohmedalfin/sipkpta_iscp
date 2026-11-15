import {
  IconBriefcase,
  IconDocumentSearch,
  IconUsers,
} from '../../common/Icons.jsx';
import AdminPagination from '../../admin-prodi/shared/AdminPagination.jsx';

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
 * Badge status verifikasi administratif oleh Admin Prodi (Sederhana & Rapi)
 */
function AdminStatusBadge({ berkasStatus, pengajuanStatus }) {
  if (pengajuanStatus === 'ACC' || berkasStatus === 'OK_LENGKAP') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 text-emerald-800 text-[11px] font-semibold whitespace-nowrap">
        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span>ACC Admin</span>
      </span>
    );
  }
  if (pengajuanStatus === 'TIDAK_ACC') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-rose-200/80 bg-rose-50/80 text-rose-700 text-[11px] font-semibold whitespace-nowrap">
        <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
        <span>Ditolak</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-blue-200/80 bg-blue-50/80 text-blue-700 text-[11px] font-semibold whitespace-nowrap">
      <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
      <span>Menunggu</span>
    </span>
  );
}

/**
 * Badge status penugasan reviewer oleh Kaprodi (Sederhana & Rapi)
 */
function ReviewerStatusBadge({ count }) {
  if (!count || count === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-amber-200/80 bg-amber-50/80 text-amber-800 text-[11px] font-semibold whitespace-nowrap">
        <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
        <span>Belum Ada</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-brand/20 bg-brand/10 text-brand text-[11px] font-semibold whitespace-nowrap">
      <span className="size-1.5 rounded-full bg-brand shrink-0" />
      <span>{count} Reviewer</span>
    </span>
  );
}

/**
 * Ekstraksi inisial nama
 */
function getInitials(name) {
  if (!name) return 'M';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Tabel Antrean Penugasan Reviewer KP Kaprodi
 *
 * @param {object} props
 * @param {Array} props.items - Daftar pengajuan KP
 * @param {boolean} [props.loading] - State loading
 * @param {object} props.pagination - Metadata pagination
 * @param {Function} props.onPageChange - Handler ganti halaman
 * @param {Array<number>} [props.selectedIds=[]] - Array ID pengajuan yang dicentang
 * @param {Function} props.onToggleSelect - Handler centang satu baris
 * @param {Function} props.onToggleSelectAll - Handler centang semua baris di halaman aktif
 * @param {Function} props.onOpenAssign - Handler saat tombol "Tugaskan" atau "Kelola" diklik
 * @param {Function} props.onResetFilter - Handler reset filter pada empty state
 * @param {boolean} [props.hasActiveFilter] - Penanda ada filter aktif
 */
export default function ReviewerKpTable({
  items = [],
  loading = false,
  pagination = { page: 1, limit: 15, total: 0, total_pages: 1 },
  onPageChange,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onOpenAssign,
  onResetFilter,
  hasActiveFilter = false,
}) {
  const allCurrentPageSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));
  const someCurrentPageSelected =
    items.length > 0 &&
    items.some((item) => selectedIds.includes(item.id)) &&
    !allCurrentPageSelected;

  return (
    <div className="rounded-[20px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm shadow-none overflow-hidden flex flex-col relative z-0">
      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-900/[0.08] bg-slate-50/70 text-muted uppercase text-[10px] font-bold tracking-wider">
              <th scope="col" className="w-10 px-4 py-3 text-center">
                <input
                  type="checkbox"
                  aria-label="Pilih semua pengajuan di halaman ini"
                  checked={allCurrentPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someCurrentPageSelected;
                  }}
                  onChange={onToggleSelectAll}
                  disabled={loading || items.length === 0}
                  className="rounded border-slate-900/20 text-brand focus:ring-brand/30 size-3.5 cursor-pointer disabled:cursor-not-allowed"
                />
              </th>
              <th scope="col" className="px-4 py-3 min-w-[200px]">
                Mahasiswa
              </th>
              <th scope="col" className="px-4 py-3 min-w-[260px]">
                Judul Proposal & Periode
              </th>
              <th scope="col" className="px-4 py-3 min-w-[120px] whitespace-nowrap">
                Status Admin
              </th>
              <th scope="col" className="px-4 py-3 min-w-[120px] whitespace-nowrap">
                Status Reviewer
              </th>
              <th scope="col" className="px-4 py-3 min-w-[110px] text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/[0.05] text-ink">
            {loading ? (
              // Loading Skeleton 5 Baris
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse">
                  <td className="px-4 py-3.5 text-center">
                    <div className="size-3.5 mx-auto rounded bg-slate-200" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-slate-200 shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3.5 bg-slate-200 rounded w-28" />
                        <div className="h-2.5 bg-slate-100 rounded w-20" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="space-y-1.5">
                      <div className="h-3 bg-slate-200 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-5 bg-slate-200 rounded-md w-24" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-5 bg-slate-200 rounded-md w-28" />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="h-7 bg-slate-200 rounded-lg w-16 ml-auto" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                    <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-muted mb-3">
                      <IconBriefcase className="size-6" />
                    </div>
                    <h3 className="text-sm font-bold text-ink">
                      {hasActiveFilter
                        ? 'Tidak ada pengajuan yang cocok'
                        : 'Belum ada antrean pengajuan KP'}
                    </h3>
                    <p className="mt-1 text-xs text-secondary leading-relaxed">
                      {hasActiveFilter
                        ? 'Coba sesuaikan kata kunci pencarian atau ubah filter status yang diterapkan.'
                        : 'Belum ada mahasiswa yang mengirim pengajuan Kerja Praktik pada periode ini.'}
                    </p>
                    {hasActiveFilter && onResetFilter && (
                      <button
                        type="button"
                        onClick={onResetFilter}
                        className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.12] bg-white px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Reset Filter Pencarian
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              items.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const nim = item.mahasiswa?.nim || '-';
                const nama = item.mahasiswa?.nama_lengkap || '-';
                const judul = item.versi_topik?.judul_penelitian || 'Judul belum diisi';
                const periode = item.periode_akademik
                  ? `${item.periode_akademik.tahun_ajaran} (${item.periode_akademik.semester})`
                  : null;
                const tanggalKirim = formatShortDate(item.diajukan_at);
                const reviewerCount = item.jumlah_reviewer_aktif ?? 0;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors duration-150 hover:bg-white/90 ${
                      isSelected ? 'bg-brand/[0.04]' : ''
                    }`}
                  >
                    {/* Checkbox Selection */}
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Pilih pengajuan ${nama}`}
                        checked={isSelected}
                        onChange={() => onToggleSelect && onToggleSelect(item.id)}
                        className="rounded border-slate-900/20 text-brand focus:ring-brand/30 size-3.5 cursor-pointer"
                      />
                    </td>

                    {/* Mahasiswa Info */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-slate-100 border border-slate-900/[0.08] flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                          {getInitials(nama)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-ink leading-tight truncate">
                            {nama}
                          </p>
                          <p className="text-[11px] text-muted font-mono mt-0.5">
                            {nim}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Judul & Periode */}
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-ink leading-snug line-clamp-2" title={judul}>
                        {judul}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                        {periode && <span>{periode}</span>}
                        {periode && tanggalKirim !== '-' && <span>•</span>}
                        {tanggalKirim !== '-' && <span>Kirim: {tanggalKirim}</span>}
                      </div>
                    </td>

                    {/* Status Admin */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <AdminStatusBadge
                        berkasStatus={item.status_pemeriksaan_berkas}
                        pengajuanStatus={item.status_pengajuan}
                      />
                    </td>

                    {/* Status Reviewer */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <ReviewerStatusBadge count={reviewerCount} />
                    </td>

                    {/* Tombol Aksi */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {reviewerCount === 0 ? (
                        <button
                          type="button"
                          onClick={() => onOpenAssign && onOpenAssign(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand hover:bg-brand-hover text-white px-2.5 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <IconDocumentSearch className="size-3" />
                          <span>Tugaskan</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenAssign && onOpenAssign(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-900/[0.12] bg-white/90 hover:bg-white text-secondary hover:text-ink px-2.5 py-1.5 text-xs font-semibold shadow-none transition-colors cursor-pointer"
                        >
                          <IconUsers className="size-3" />
                          <span>Kelola</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loading && items.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-900/[0.06] bg-slate-50/50">
          <AdminPagination
            pagination={pagination}
            onPageChange={onPageChange}
            loading={loading}
            unit="pengajuan"
          />
        </div>
      )}
    </div>
  );
}

