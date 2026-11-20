import TableSkeletonRows from '../../common/TableSkeletonRows.jsx';
import TableEmptyState, { TableErrorState } from '../../common/TableEmptyState.jsx';
import {
  IconBriefcase,
  IconCheckCircle,
  IconClipboardCheck,
  IconCalendarClock,
  IconDocumentText,
  IconExclamationTriangle,
  IconUser,
} from '../../common/Icons.jsx';
import AdminPagination from '../shared/AdminPagination.jsx';

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
 * Komponen Badge Kategori Berkas dan Nilai
 */
function CategoryBadge({ status }) {
  if (status === 'OK_LENGKAP') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        <IconCheckCircle className="size-3 text-emerald-600" />
        OK Lengkap
      </span>
    );
  }
  if (status === 'BELUM_OK') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
        <IconExclamationTriangle className="size-3 text-amber-600" />
        Perlu Revisi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-subtle px-2 py-0.5 text-[11px] font-medium text-secondary">
      <IconCalendarClock className="size-3 text-muted" />
      Belum Diperiksa
    </span>
  );
}

/**
 * Komponen Badge Status Pengajuan Utama
 */
function StatusPengajuanBadge({ status }) {
  if (status === 'ACC') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
        <IconCheckCircle className="size-3.5 text-emerald-700" />
        Disetujui (ACC)
      </span>
    );
  }
  if (status === 'TIDAK_ACC') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-bold text-danger">
        Ditolak Administratif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-brand">
      <span className="size-1.5 animate-pulse rounded-full bg-brand" />
      Menunggu Pemeriksaan
    </span>
  );
}

/**
 * Baris Skeleton saat data sedang dimuat
 */
/**
 * Tabel Daftar Antrean Pengajuan KP Admin Prodi
 * 
 * @param {object} props
 * @param {Array} props.items - Daftar pengajuan dari API
 * @param {object} props.pagination - Data pagination { page, limit, total, total_pages }
 * @param {Function} props.onPageChange - Handler ganti halaman
 * @param {Function} props.onOpenDetail - Handler saat tombol 'Periksa' diklik
 * @param {boolean} [props.loading] - State loading
 */
export default function KpAdminTable({
  items = [],
  pagination = { page: 1, limit: 20, total: 0, total_pages: 1 },
  onPageChange,
  onOpenDetail,
  loading = false,
  error = '',
  onRetry,
  hasActiveFilter = false,
  onResetFilter,
}) {
  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm overflow-hidden shadow-none relative z-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="border-b border-slate-900/[0.08] bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-secondary">
            <tr>
              <th scope="col" className="px-4 py-3.5">
                Mahasiswa
              </th>
              <th scope="col" className="px-4 py-3.5">
                Usulan Topik & Periode
              </th>
              <th scope="col" className="px-4 py-3.5">
                Pemeriksaan Berkas
              </th>
              <th scope="col" className="px-4 py-3.5">
                Pemeriksaan Nilai
              </th>
              <th scope="col" className="px-4 py-3.5">
                Status Pengajuan
              </th>
              <th scope="col" className="px-4 py-3.5 text-right">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-900/[0.05] text-ink">
            {loading ? (
              <TableSkeletonRows count={5} columns={6} />
            ) : error ? (
              <TableErrorState colSpan={6} error={error} onRetry={onRetry} />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={6}
                icon={IconClipboardCheck}
                title="Belum ada antrean pengajuan KP"
                description="Belum ada mahasiswa yang mengajukan Kerja Praktik pada periode ini."
                filteredTitle="Pengajuan tidak ditemukan"
                filteredDescription="Tidak ada data pengajuan KP yang sesuai dengan kriteria filter atau pencarian Anda."
                hasActiveFilter={hasActiveFilter}
                onResetFilter={onResetFilter}
              />
            ) : (
              items.map((item) => {
                const mahasiswa = item.mahasiswa || {};
                const periode = item.periode_akademik || {};
                const topik = item.versi_topik || {};

                return (
                  <tr
                    key={item.id}
                    className="transition-colors duration-150 hover:bg-slate-50/50"
                  >
                    {/* Kolom 1: Mahasiswa */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-ink">
                        {mahasiswa.nama_lengkap || 'Tanpa Nama'}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-secondary">
                        {mahasiswa.nim || '-'}
                      </div>
                      {item.diajukan_at && (
                        <div className="mt-1 text-[10px] text-muted">
                          Diajukan: {formatShortDate(item.diajukan_at)}
                        </div>
                      )}
                    </td>

                    {/* Kolom 2: Usulan Topik & Periode */}
                    <td className="px-4 py-3.5 max-w-xs">
                      <div
                        className="line-clamp-2 font-medium text-ink"
                        title={topik.judul_penelitian || '-'}
                      >
                        {topik.judul_penelitian || '(Judul belum diset)'}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted">
                        <IconBriefcase className="size-3 text-muted" />
                        <span>
                          {periode.tahun_ajaran} ({periode.semester})
                        </span>
                      </div>
                    </td>

                    {/* Kolom 3: Status Kategori Berkas */}
                    <td className="px-4 py-3.5">
                      <CategoryBadge status={item.status_pemeriksaan_berkas} />
                    </td>

                    {/* Kolom 4: Status Kategori Nilai */}
                    <td className="px-4 py-3.5">
                      <CategoryBadge status={item.status_pemeriksaan_akademik} />
                    </td>

                    {/* Kolom 5: Status Pengajuan */}
                    <td className="px-4 py-3.5">
                      <StatusPengajuanBadge status={item.status_pengajuan} />
                    </td>

                    {/* Kolom 6: Aksi */}
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-2xs transition focus:outline-hidden ${
                          item.status_pengajuan === 'DIAJUKAN'
                            ? 'bg-brand text-white hover:bg-brand-hover'
                            : 'border border-line bg-white text-secondary hover:bg-subtle hover:text-ink'
                        }`}
                      >
                        <IconClipboardCheck className="size-3.5" />
                        Periksa
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Baris Pagination */}
      {pagination.total > 0 && <div className="border-t border-line px-4">
        <AdminPagination pagination={pagination} onPageChange={onPageChange}
          loading={loading} unit="pengajuan" />
      </div>}
    </div>
  );
}
