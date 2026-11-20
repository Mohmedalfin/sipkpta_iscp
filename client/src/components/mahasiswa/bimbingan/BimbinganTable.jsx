import TableSkeletonRows from '../../common/TableSkeletonRows.jsx';
import TableEmptyState, { TableErrorState } from '../../common/TableEmptyState.jsx';
import AdminPagination from '../../admin-prodi/shared/AdminPagination.jsx';
import BimbinganStatusBadge, { BimbinganJenisBadge } from './BimbinganStatusBadge.jsx';
import {
  IconCalendar,
  IconEdit,
  IconEye,
  IconPaperClip,
  IconUsers,
} from '../../common/Icons.jsx';

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
 * Tabel Interaktif Daftar Log Bimbingan Mahasiswa
 * 
 * @param {object} props
 * @param {Array} props.items - Daftar log bimbingan
 * @param {boolean} [props.loading] - State loading data
 * @param {string} [props.error] - Pesan kesalahan
 * @param {Function} [props.onRetry] - Handler coba lagi
 * @param {boolean} [props.hasActiveFilter] - Penanda filter aktif
 * @param {Function} [props.onResetFilter] - Handler reset filter
 * @param {object} props.pagination - Data pagination { page, limit, total, total_pages }
 * @param {Function} props.onPageChange - Handler ganti halaman
 * @param {Function} props.onOpenDetail - Handler buka modal detail/riwayat
 * @param {Function} props.onEditDraft - Handler buka draf untuk diedit/dikirim
 * @param {Function} props.onRevise - Handler buka perbaikan saat status PERLU_PERBAIKAN
 */
export default function BimbinganTable({
  items = [],
  loading = false,
  error = '',
  onRetry,
  hasActiveFilter = false,
  onResetFilter,
  pagination = { page: 1, limit: 15, total: 0, total_pages: 1 },
  onPageChange,
  onOpenDetail,
  onEditDraft,
  onRevise,
}) {
  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm overflow-hidden shadow-none relative z-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-xs border-collapse">
          <thead className="border-b border-slate-900/[0.08] bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-secondary">
            <tr>
              <th scope="col" className="px-4 py-3.5 w-16 text-center whitespace-nowrap">
                Sesi #
              </th>
              <th scope="col" className="px-4 py-3.5 w-44 whitespace-nowrap">
                Jenis & Tanggal
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[240px]">
                Ringkasan Materi Bimbingan
              </th>
              <th scope="col" className="px-4 py-3.5 w-44 min-w-[145px] whitespace-nowrap">
                Status
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[200px]">
                Catatan Pembimbing
              </th>
              <th scope="col" className="px-4 py-3.5 text-right w-28 whitespace-nowrap">
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
                icon={IconUsers}
                title="Belum Ada Catatan Bimbingan"
                description="Mulai catat sesi konsultasi dan bimbingan Kerja Praktik Anda bersama Dosen Pembimbing."
                filteredTitle="Catatan bimbingan tidak ditemukan"
                filteredDescription="Tidak ada log bimbingan yang cocok dengan kriteria filter atau pencarian Anda."
                hasActiveFilter={hasActiveFilter}
                onResetFilter={onResetFilter}
              />
            ) : (
              items.map((item, index) => {
                const sessionNum = pagination.total - ((pagination.page - 1) * pagination.limit + index);
                const isDraft = item.status_bimbingan === 'DRAFT';
                const isRevisionNeeded = item.status_bimbingan === 'PERLU_PERBAIKAN';
                const tanggalPertemuan = item.tanggal_bimbingan ? formatShortDate(item.tanggal_bimbingan) : null;
                const tanggalPengiriman = item.diajukan_pertama_at ? formatShortDate(item.diajukan_pertama_at) : formatShortDate(item.created_at);

                return (
                  <tr
                    key={item.id}
                    className="transition-colors duration-150 hover:bg-slate-50/50 group"
                  >
                    {/* Kolom 1: Sesi # */}
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-500 whitespace-nowrap">
                      #{sessionNum > 0 ? sessionNum : index + 1}
                    </td>

                    {/* Kolom 2: Jenis & Tanggal */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <BimbinganJenisBadge jenis={item.jenis_bimbingan} />
                        <div className="flex items-center gap-1 text-[11px] text-secondary font-medium whitespace-nowrap">
                          <IconCalendar className="size-3 text-muted shrink-0" />
                          <span>{tanggalPertemuan || tanggalPengiriman}</span>
                        </div>
                      </div>
                    </td>

                    {/* Kolom 3: Ringkasan Materi */}
                    <td className="px-4 py-3.5">
                      <div className="max-w-md">
                        <p className="font-semibold text-ink line-clamp-2 leading-relaxed">
                          {item.ringkasan || <span className="italic text-muted font-normal">Belum ada ringkasan materi</span>}
                        </p>
                        {item.versi_pengiriman_terakhir > 1 && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted font-mono whitespace-nowrap">
                            Revisi ke-{item.versi_pengiriman_terakhir}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Kolom 4: Status */}
                    <td className="px-4 py-3.5 align-middle w-44 whitespace-nowrap shrink-0">
                      <BimbinganStatusBadge status={item.status_bimbingan} />
                    </td>

                    {/* Kolom 5: Catatan Pembimbing */}
                    <td className="px-4 py-3.5">
                      <div className="max-w-xs">
                        {item.catatan_pembimbing_terakhir ? (
                          <p
                            className={`text-[11px] leading-relaxed line-clamp-2 font-medium ${
                              isRevisionNeeded
                                ? 'text-amber-900 bg-amber-50/80 p-2 rounded-lg border border-amber-200/80'
                                : item.status_bimbingan === 'DITOLAK'
                                ? 'text-rose-900 bg-rose-50/80 p-2 rounded-lg border border-rose-200/80'
                                : 'text-secondary'
                            }`}
                            title={item.catatan_pembimbing_terakhir}
                          >
                            &ldquo;{item.catatan_pembimbing_terakhir}&rdquo;
                          </p>
                        ) : (
                          <span className="text-[11px] text-muted italic">-</span>
                        )}
                      </div>
                    </td>

                    {/* Kolom 6: Aksi */}
                    <td className="px-4 py-3.5 text-right align-middle whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap shrink-0">
                        {isDraft ? (
                          <button
                            type="button"
                            onClick={() => onEditDraft?.(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white hover:bg-slate-50 px-2.5 py-1 text-xs font-semibold text-secondary hover:text-ink shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            title="Lanjutkan pengisian draf bimbingan"
                          >
                            <IconEdit className="size-3 text-slate-500 shrink-0" />
                            <span>Edit</span>
                          </button>
                        ) : isRevisionNeeded ? (
                          <button
                            type="button"
                            onClick={() => onRevise?.(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            title="Perbaiki catatan bimbingan sesuai arahan dosen"
                          >
                            <IconEdit className="size-3 text-amber-700 shrink-0" />
                            <span>Perbaiki</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenDetail?.(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white hover:bg-slate-50 px-2.5 py-1 text-xs font-semibold text-secondary hover:text-ink shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            title="Lihat rincian bimbingan dan catatan dosen"
                          >
                            <IconEye className="size-3 text-slate-500 shrink-0" />
                            <span>Detail</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination.total > 0 && (
        <div className="border-t border-slate-900/[0.06] bg-slate-50/40 px-4 py-1">
          <AdminPagination
            pagination={pagination}
            onPageChange={onPageChange}
            loading={loading}
            unit="bimbingan"
          />
        </div>
      )}
    </div>
  );
}
