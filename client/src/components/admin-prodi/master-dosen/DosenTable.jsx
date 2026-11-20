import TableSkeletonRows from '../../common/TableSkeletonRows.jsx';
import TableEmptyState, { TableErrorState } from '../../common/TableEmptyState.jsx';
import {
  IconCheckCircle,
  IconEdit,
  IconEye,
  IconLockClosed,
  IconMail,
  IconPhone,
  IconSearch,
  IconTrash,
  IconUser,
} from '../../common/Icons.jsx';
import DosenStatusBadge from './DosenStatusBadge.jsx';

export default function DosenTable({
  lecturers = [],
  loading = false,
  refreshing = false,
  error = '',
  onRetry,
  hasActiveFilter = false,
  onResetFilter,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
  footer,
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm shadow-none">
      <div className="overflow-x-auto">
        <table aria-busy={loading || refreshing} className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-900/[0.06] bg-slate-50/70 text-[10px] font-bold text-secondary uppercase tracking-wider">
              <th scope="col" className="py-3.5 pl-6 pr-3 w-[15%]">Kode Dosen & NIDN</th>
              <th scope="col" className="py-3.5 px-3 w-[28%]">Nama Lengkap & Akun</th>
              <th scope="col" className="py-3.5 px-3 w-[22%]">Jabatan & Homebase</th>
              <th scope="col" className="py-3.5 px-3 w-[15%]">Kontak</th>
              <th scope="col" className="py-3.5 px-3 w-[10%]">Status Akun</th>
              <th scope="col" className="py-3.5 pl-3 pr-6 text-right w-[10%]">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-900/[0.04]">
            {loading ? (
              <TableSkeletonRows count={5} columns={6} />
            ) : error ? (
              <TableErrorState colSpan={6} error={error} onRetry={onRetry} />
            ) : lecturers.length === 0 ? (
              <TableEmptyState
                colSpan={6}
                icon={IconUser}
                title="Belum ada data dosen"
                description="Belum ada data dosen yang terdaftar di program studi."
                filteredTitle="Data dosen tidak ditemukan"
                filteredDescription="Tidak ada data dosen yang cocok dengan kata kunci pencarian yang dimasukkan."
                hasActiveFilter={hasActiveFilter}
                onResetFilter={onResetFilter}
              />
            ) : (
              lecturers.map((lecturer) => (
                <tr
                  key={lecturer.id}
                  className="hover:bg-slate-50/70 transition-colors duration-150 group"
                >
                  {/* Kolom 1: Kode Dosen & NIDN */}
                  <td className="py-3.5 pl-6 pr-3 align-middle">
                    <div className="font-mono font-bold text-ink">
                      {lecturer.kode_dosen}
                    </div>
                    <div className="text-[11px] font-mono text-muted mt-0.5">
                      NIDN: {lecturer.nidn || '-'}
                    </div>
                  </td>

                  {/* Kolom 2: Nama Lengkap & Email Akun */}
                  <td className="py-3.5 px-3 align-middle">
                    <div className="font-bold text-ink leading-snug">
                      {lecturer.nama_lengkap}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted font-mono mt-0.5 truncate max-w-[240px]">
                      <IconMail className="size-3 text-slate-400 shrink-0" />
                      <span>{lecturer.email}</span>
                    </div>
                  </td>

                  {/* Kolom 3: Jabatan Fungsional & Homebase SI */}
                  <td className="py-3.5 px-3 align-middle">
                    <div className="font-semibold text-slate-700 leading-snug">
                      {lecturer.jabatan_fungsional || 'Tenaga Pengajar'}
                    </div>
                    <div className="mt-1">
                      {lecturer.is_homebase_si ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-200/80 bg-indigo-50/80 text-indigo-800">
                          Homebase SI
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-slate-900/[0.08] bg-slate-100 text-slate-600">
                          Dosen Luar / Mitra
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Kolom 4: Kontak Telepon */}
                  <td className="py-3.5 px-3 align-middle">
                    {lecturer.no_telepon ? (
                      <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
                        <IconPhone className="size-3 text-slate-400 shrink-0" />
                        <span>{lecturer.no_telepon}</span>
                      </div>
                    ) : (
                      <span className="text-muted text-[11px]">-</span>
                    )}
                  </td>

                  {/* Kolom 5: Status Akun */}
                  <td className="py-3.5 px-3 align-middle">
                    <DosenStatusBadge status={lecturer.status_akun} />
                  </td>

                  {/* Kolom 6: Aksi Cepat */}
                  <td className="py-3.5 pl-3 pr-6 align-middle text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      {/* Lihat Detail */}
                      <button
                        type="button"
                        onClick={() => onView && onView(lecturer)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-brand hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Lihat Detail Profil Dosen"
                      >
                        <IconEye className="size-4" />
                      </button>

                      {/* Edit Profil */}
                      <button
                        type="button"
                        onClick={() => onEdit && onEdit(lecturer)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Edit Data Dosen"
                      >
                        <IconEdit className="size-4" />
                      </button>

                      {/* Toggle Status Akun */}
                      <button
                        type="button"
                        onClick={() => onToggleStatus && onToggleStatus(lecturer)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          lecturer.status_akun === 'AKTIF'
                            ? 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                            : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title={lecturer.status_akun === 'AKTIF' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                      >
                        {lecturer.status_akun === 'AKTIF' ? (
                          <IconLockClosed className="size-4" />
                        ) : (
                          <IconCheckCircle className="size-4" />
                        )}
                      </button>

                      {/* Hapus Dosen */}
                      <button
                        type="button"
                        onClick={() => onDelete && onDelete(lecturer)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus Dosen"
                      >
                        <IconTrash className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer && <div className="border-t border-line px-6">{footer}</div>}
    </div>
  );
}

