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

function TableSkeletonRows({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-900/[0.04]">
          <td className="py-3.5 pl-6 pr-3">
            <div className="space-y-1.5 max-w-[120px]">
              <div className="h-3.5 bg-slate-200/70 rounded w-4/5" />
              <div className="h-2.5 bg-slate-200/50 rounded w-3/5" />
            </div>
          </td>
          <td className="py-3.5 px-3">
            <div className="space-y-1.5 max-w-[220px]">
              <div className="h-3.5 bg-slate-200/70 rounded w-full" />
              <div className="h-2.5 bg-slate-200/50 rounded w-3/4" />
            </div>
          </td>
          <td className="py-3.5 px-3">
            <div className="space-y-1.5 max-w-[160px]">
              <div className="h-3 bg-slate-200/70 rounded w-4/5" />
              <div className="h-4 w-20 bg-slate-200/50 rounded-full" />
            </div>
          </td>
          <td className="py-3.5 px-3">
            <div className="h-3 bg-slate-200/60 rounded w-24" />
          </td>
          <td className="py-3.5 px-3">
            <div className="h-6 w-20 bg-slate-200/60 rounded-full" />
          </td>
          <td className="py-3.5 pl-3 pr-6 text-right">
            <div className="h-7 w-24 bg-slate-200/60 rounded-xl inline-block" />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function DosenTable({
  lecturers = [],
  loading = false,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
  footer,
}) {
  return (
    <div className="flex min-h-[320px] flex-col overflow-hidden rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm shadow-none">
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-900/[0.06] bg-slate-50/50 text-[11px] font-bold text-muted uppercase tracking-wider">
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
              <TableSkeletonRows count={5} />
            ) : lecturers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 px-6 text-center">
                  <div className="mx-auto max-w-sm space-y-2">
                    <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <IconSearch className="size-5" />
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      Data dosen tidak ditemukan
                    </p>
                    <p className="text-xs text-muted leading-relaxed">
                      Tidak ada data yang cocok dengan kata kunci pencarian yang dimasukkan.
                    </p>
                  </div>
                </td>
              </tr>
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

