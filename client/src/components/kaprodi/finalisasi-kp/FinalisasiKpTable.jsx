import TableSkeletonRows from '../../common/TableSkeletonRows.jsx';
import TableEmptyState, { TableErrorState } from '../../common/TableEmptyState.jsx';
import {
  IconBriefcase,
  IconCheckCircle,
  IconChevronRight,
  IconExclamationTriangle,
  IconUsers,
} from '../../common/Icons.jsx';
import AdminPagination from '../../admin-prodi/shared/AdminPagination.jsx';
import {
  BimbinganStatusBadge,
  FinalisasiStatusBadge,
} from './FinalisasiKpStatusBadge.jsx';

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
 * Komponen Tabel Antrean Finalisasi & Penetapan Pembimbing KP oleh Kaprodi
 *
 * @param {object} props
 * @param {Array} props.items - Daftar baris data pengajuan
 * @param {boolean} props.loading - State pemuatan data
 * @param {Array<number>} props.selectedIds - ID baris terpilih
 * @param {Function} props.onToggleSelect - Handler pemilihan satu baris
 * @param {Function} props.onToggleSelectAll - Handler pilih semua baris eligible di halaman aktif
 * @param {Function} props.onOpenAction - Handler klik tombol aksi kontekstual per baris
 * @param {object} props.pagination - Metadata pagination
 * @param {Function} props.onPageChange - Handler perubahan halaman
 * @param {boolean} props.hasActiveFilter - Status apakah filter aktif
 * @param {Function} props.onResetFilter - Handler reset filter
 * @param {string} [props.error] - Pesan error server jika request gagal
 * @param {Function} [props.onRetry] - Handler coba lagi
 */
export default function FinalisasiKpTable({
  items = [],
  loading = false,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onOpenAction,
  pagination = { page: 1, limit: 15, total: 0, total_pages: 1 },
  onPageChange,
  hasActiveFilter = false,
  onResetFilter,
  error = '',
  onRetry,
}) {
  // Hanya baris dengan status 'SIAP_DITETAPKAN' (is_eligible = true) yang dapat dipilih secara massal
  const eligibleItems = items.filter((item) => item.is_eligible && item.status_finalisasi === 'SIAP_DITETAPKAN');
  const eligibleIds = eligibleItems.map((item) => item.id);
  const allEligibleSelected =
    eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.includes(id));
  const isIndeterminate =
    eligibleIds.some((id) => selectedIds.includes(id)) && !allEligibleSelected;

  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm overflow-hidden shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-900/[0.08] bg-slate-50/70 text-secondary uppercase font-bold text-[10px] tracking-wider">
              {/* Checkbox Header */}
              <th scope="col" className="w-10 px-4 py-3.5 text-center">
                <input
                  type="checkbox"
                  aria-label="Pilih semua pengajuan siap ditetapkan di halaman ini"
                  checked={allEligibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={onToggleSelectAll}
                  disabled={loading || eligibleIds.length === 0}
                  className="rounded border-slate-900/20 text-brand focus:ring-brand/30 size-3.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                />
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[200px]">
                Mahasiswa
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[240px]">
                Proposal & Judul
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[160px]">
                Usulan Mahasiswa
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[170px]">
                Pembimbing Resmi
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[160px]">
                Status
              </th>
              <th scope="col" className="px-4 py-3.5 text-right min-w-[120px]">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/[0.05] text-ink">
            {loading ? (
              <TableSkeletonRows columns={7} />
            ) : error ? (
              <TableErrorState
                colSpan={7}
                title="Gagal Memuat Antrean Finalisasi"
                error={error}
                onRetry={onRetry}
              />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={7}
                hasActiveFilter={hasActiveFilter}
                onResetFilter={onResetFilter}
                icon={<IconBriefcase className="size-6 text-muted" />}
                title="Belum ada antrean finalisasi KP"
                filteredTitle="Tidak ada pengajuan yang sesuai"
                description="Belum ada mahasiswa yang masuk dalam antrean finalisasi dan penetapan pembimbing Kerja Praktik."
                filteredDescription="Coba sesuaikan kata kunci pencarian atau ubah filter status yang diterapkan."
              />
            ) : (
              // Data Baris Nyata
              items.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isEligible = item.is_eligible && item.status_finalisasi === 'SIAP_DITETAPKAN';
                const nim = item.mahasiswa?.nim || '-';
                const nama = item.mahasiswa?.nama_lengkap || '-';
                const initial = nama.charAt(0).toUpperCase();
                const judul = item.versi_topik?.judul_penelitian || 'Judul belum diisi';
                const tanggalKirim = formatShortDate(item.diajukan_at);

                const usulanDosen = item.usulan_pembimbing?.nama_lengkap;
                const pembimbingResmi = item.pembimbing?.dosen;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors duration-150 hover:bg-white/90 ${
                      isSelected ? 'bg-brand/[0.04]' : ''
                    }`}
                  >
                    {/* Checkbox Pemilihan */}
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Pilih pengajuan ${nama}`}
                        checked={isSelected}
                        onChange={() => onToggleSelect && onToggleSelect(item.id)}
                        disabled={!isEligible}
                        title={
                          isEligible
                            ? `Pilih pengajuan ${nama}`
                            : 'Hanya pengajuan dengan status Siap Ditetapkan yang dapat dipilih untuk aksi massal.'
                        }
                        className="rounded border-slate-900/20 text-brand focus:ring-brand/30 size-3.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>

                    {/* Info Mahasiswa */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="size-8 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 select-none"
                          aria-hidden="true"
                        >
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate max-w-[180px]">
                            {nama}
                          </p>
                          <p className="text-[11px] text-muted font-mono leading-tight">
                            {nim}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Proposal & Judul Penelitian */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <p
                          className="font-medium text-ink leading-snug line-clamp-2 max-w-sm"
                          title={judul}
                        >
                          {judul}
                        </p>
                        <p className="text-[10px] text-muted">
                          Diajukan: {tanggalKirim}
                        </p>
                      </div>
                    </td>

                    {/* Dosen Usulan Mahasiswa */}
                    <td className="px-4 py-3.5">
                      {usulanDosen ? (
                        <div className="space-y-0.5">
                          <p className="font-medium text-ink truncate max-w-[160px]" title={usulanDosen}>
                            {usulanDosen}
                          </p>
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
                            *Usulan Mahasiswa
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted text-[11px] italic">Tidak ada usulan</span>
                      )}
                    </td>

                    {/* Pembimbing Resmi yang Ditetapkan */}
                    <td className="px-4 py-3.5">
                      {pembimbingResmi ? (
                        <div className="space-y-0.5">
                          <p className="font-semibold text-brand truncate max-w-[170px]" title={pembimbingResmi.nama_lengkap}>
                            {pembimbingResmi.nama_lengkap}
                          </p>
                          {pembimbingResmi.kode_dosen && (
                            <span className="font-mono text-[10px] text-secondary">
                              [{pembimbingResmi.kode_dosen}]
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <span className="size-1.5 rounded-full bg-slate-300" />
                          <span>Belum Ditetapkan</span>
                        </span>
                      )}
                    </td>

                    {/* Status Finalisasi */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <FinalisasiStatusBadge
                          status={item.status_finalisasi}
                          reasons={item.alasan}
                        />
                        {item.status_finalisasi === 'SUDAH_DITETAPKAN' && (
                          <BimbinganStatusBadge status={item.status_bimbingan} />
                        )}
                      </div>
                    </td>

                    {/* Tombol Aksi Kontekstual */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {item.status_finalisasi === 'SIAP_DITETAPKAN' ? (
                        <button
                          type="button"
                          onClick={() => onOpenAction && onOpenAction(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          title="Tetapkan Dosen Pembimbing untuk pengajuan ini"
                        >
                          <IconCheckCircle className="size-3" />
                          <span>Tetapkan</span>
                        </button>
                      ) : item.status_finalisasi === 'SUDAH_DITETAPKAN' ? (
                        <button
                          type="button"
                          onClick={() => onOpenAction && onOpenAction(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-900/[0.12] bg-white hover:bg-slate-50 text-secondary hover:text-ink px-2.5 py-1.5 text-xs font-semibold shadow-none transition-colors cursor-pointer"
                          title="Kelola atau ganti Dosen Pembimbing"
                        >
                          <IconUsers className="size-3 text-brand" />
                          <span>Kelola</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenAction && onOpenAction(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200/80 bg-amber-50/70 hover:bg-amber-100/70 text-amber-800 px-2.5 py-1.5 text-xs font-medium shadow-none transition-colors cursor-pointer"
                          title="Periksa rincian syarat kelayakan yang belum terpenuhi"
                        >
                          <IconExclamationTriangle className="size-3 text-amber-600" />
                          <span>Cek Kendala</span>
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

      {/* Footer Pagination */}
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
