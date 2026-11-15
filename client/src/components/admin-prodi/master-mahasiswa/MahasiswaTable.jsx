import {
  IconAcademicCap,
  IconCheckCircle,
  IconEdit,
  IconEye,
  IconLockClosed,
  IconSearch,
  IconTrash,
  IconUser,
} from '../../common/Icons.jsx';
import MahasiswaStatusBadge from './MahasiswaStatusBadge.jsx';

function TableSkeletonRows({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-900/[0.04]">
          <td className="py-3.5 pl-6 pr-3">
            <div className="space-y-1.5 max-w-[130px]">
              <div className="h-3.5 bg-slate-200/70 rounded w-4/5" />
              <div className="h-2.5 bg-slate-200/50 rounded w-3/5" />
            </div>
          </td>
          <td className="py-3.5 px-3">
            <div className="space-y-1.5 max-w-[200px]">
              <div className="h-3.5 bg-slate-200/70 rounded w-full" />
              <div className="h-2.5 bg-slate-200/50 rounded w-3/4" />
            </div>
          </td>
          <td className="py-3.5 px-3">
            <div className="space-y-1.5 max-w-[150px]">
              <div className="h-3 bg-slate-200/70 rounded w-full" />
              <div className="h-2.5 bg-slate-200/50 rounded w-1/2" />
            </div>
          </td>
          <td className="py-3.5 px-3">
            <div className="space-y-1.5 max-w-[130px]">
              <div className="h-3 bg-slate-200/60 rounded w-4/5" />
              <div className="h-2.5 bg-slate-200/40 rounded w-3/5" />
            </div>
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

export default function MahasiswaTable({
  students = [],
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
              <th scope="col" className="py-3.5 pl-6 pr-3 w-[15%]">NIM / NIK</th>
              <th scope="col" className="py-3.5 px-3 w-[26%]">Nama Lengkap & Akun</th>
              <th scope="col" className="py-3.5 px-3 w-[18%]">Prodi & Angkatan</th>
              <th scope="col" className="py-3.5 px-3 w-[23%]">Kontak & Domisili</th>
              <th scope="col" className="py-3.5 px-3 w-[10%]">Status Akun</th>
              <th scope="col" className="py-3.5 pl-3 pr-6 text-right w-[8%]">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-900/[0.04]">
            {loading ? (
              <TableSkeletonRows count={5} />
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 px-6 text-center">
                  <div className="mx-auto max-w-sm space-y-2">
                    <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <IconSearch className="size-5" />
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      Data mahasiswa tidak ditemukan
                    </p>
                    <p className="text-xs text-muted leading-relaxed">
                      Tidak ada data yang cocok dengan kriteria pencarian atau filter angkatan yang dipilih.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-slate-50/70 transition-colors duration-150 group"
                >
                  {/* Kolom 1: NIM / NIK */}
                  <td className="py-3.5 pl-6 pr-3 align-middle">
                    <div className="font-mono text-xs sm:text-sm font-bold text-ink">
                      {student.nim}
                    </div>
                    <div className="text-[11px] font-mono text-muted mt-0.5">
                      NIK: {student.nik_kependudukan || '-'}
                    </div>
                  </td>

                  {/* Kolom 2: Nama Lengkap & Email */}
                  <td className="py-3.5 px-3 align-middle max-w-[240px]">
                    <div className="font-semibold text-xs sm:text-sm text-ink truncate">
                      {student.nama_lengkap}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate" title={student.email}>
                      {student.email || '-'}
                    </div>
                  </td>

                  {/* Kolom 3: Program Studi & Angkatan */}
                  <td className="py-3.5 px-3 align-middle">
                    <div className="text-xs font-medium text-ink flex items-center gap-1.5">
                      <IconAcademicCap className="size-3.5 text-muted shrink-0" />
                      <span className="truncate">{student.program_studi?.nama_prodi || 'Sistem Informasi'}</span>
                    </div>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                        {student.tahun_angkatan ? `Angkatan ${student.tahun_angkatan}` : 'Angkatan -'}
                      </span>
                    </div>
                  </td>

                  {/* Kolom 4: Kontak & Domisili */}
                  <td className="py-3.5 px-3 align-middle">
                    <div className="text-xs text-ink font-medium">
                      {student.no_telepon || '-'}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5 truncate max-w-[180px]" title={student.alamat || student.tempat_lahir}>
                      {student.tempat_lahir ? `${student.tempat_lahir}, ` : ''}
                      {student.alamat || '-'}
                    </div>
                  </td>

                  {/* Kolom 5: Status Akun */}
                  <td className="py-3.5 px-3 align-middle">
                    <MahasiswaStatusBadge status={student.status_akun} />
                  </td>

                  {/* Kolom 6: Aksi Cepat */}
                  <td className="py-3.5 pl-3 pr-6 align-middle text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      {/* Lihat Detail */}
                      <button
                        type="button"
                        onClick={() => onView && onView(student)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-brand hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Lihat Detail Profil"
                      >
                        <IconEye className="size-4" />
                      </button>

                      {/* Edit Profil */}
                      <button
                        type="button"
                        onClick={() => onEdit && onEdit(student)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Edit Data Mahasiswa"
                      >
                        <IconEdit className="size-4" />
                      </button>

                      {/* Toggle Status Akun */}
                      <button
                        type="button"
                        onClick={() => onToggleStatus && onToggleStatus(student)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          student.status_akun === 'AKTIF'
                            ? 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                            : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title={student.status_akun === 'AKTIF' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                      >
                        {student.status_akun === 'AKTIF' ? (
                          <IconLockClosed className="size-4" />
                        ) : (
                          <IconCheckCircle className="size-4" />
                        )}
                      </button>

                      {/* Hapus Mahasiswa */}
                      <button
                        type="button"
                        onClick={() => onDelete && onDelete(student)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus Mahasiswa"
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

