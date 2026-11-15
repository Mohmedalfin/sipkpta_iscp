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
function SkeletonRows({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-line">
          <td className="p-4">
            <div className="h-4 w-32 rounded bg-subtle" />
            <div className="mt-1.5 h-3 w-20 rounded bg-subtle" />
          </td>
          <td className="p-4">
            <div className="h-4 w-48 rounded bg-subtle" />
            <div className="mt-1.5 h-3 w-24 rounded bg-subtle" />
          </td>
          <td className="p-4">
            <div className="h-5 w-24 rounded bg-subtle" />
          </td>
          <td className="p-4">
            <div className="h-5 w-24 rounded bg-subtle" />
          </td>
          <td className="p-4">
            <div className="h-6 w-28 rounded bg-subtle" />
          </td>
          <td className="p-4 text-right">
            <div className="inline-block h-8 w-24 rounded-lg bg-subtle" />
          </td>
        </tr>
      ))}
    </>
  );
}

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
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-2xs relative z-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-subtle/40 text-[11px] font-bold uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="p-4">
                Mahasiswa
              </th>
              <th scope="col" className="p-4">
                Usulan Topik & Periode
              </th>
              <th scope="col" className="p-4">
                Pemeriksaan Berkas
              </th>
              <th scope="col" className="p-4">
                Pemeriksaan Nilai
              </th>
              <th scope="col" className="p-4">
                Status Pengajuan
              </th>
              <th scope="col" className="p-4 text-right">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {loading ? (
              <SkeletonRows count={5} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-secondary">
                  <IconDocumentText className="mx-auto size-10 text-muted" />
                  <p className="mt-2 text-sm font-semibold text-ink">
                    Tidak Ada Pengajuan Ditemukan
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Belum ada pengajuan KP yang sesuai dengan kriteria filter saat ini.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const mahasiswa = item.mahasiswa || {};
                const periode = item.periode_akademik || {};
                const topik = item.versi_topik || {};

                return (
                  <tr
                    key={item.id}
                    className="transition hover:bg-subtle/30"
                  >
                    {/* Kolom 1: Mahasiswa */}
                    <td className="p-4">
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
                    <td className="p-4 max-w-xs">
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
                    <td className="p-4">
                      <CategoryBadge status={item.status_pemeriksaan_berkas} />
                    </td>

                    {/* Kolom 4: Status Kategori Nilai */}
                    <td className="p-4">
                      <CategoryBadge status={item.status_pemeriksaan_akademik} />
                    </td>

                    {/* Kolom 5: Status Pengajuan */}
                    <td className="p-4">
                      <StatusPengajuanBadge status={item.status_pengajuan} />
                    </td>

                    {/* Kolom 6: Aksi */}
                    <td className="p-4 text-right">
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
