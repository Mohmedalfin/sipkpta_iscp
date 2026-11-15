import { IconAcademicCap, IconCheckCircle, IconUser } from '../../common/Icons.jsx';

export default function StudentAcademicCard({ student }) {
  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-900/[0.06] mb-3.5">
        <div className="flex items-center gap-2">
          <IconAcademicCap className="size-4.5 text-slate-600 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-ink">Data Akademik Resmi</h4>
            <p className="text-[10px] text-muted mt-0.5">
              Informasi master terdaftar di Pangkalan Data UTY
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Minimalist Grid with Indented pl-4.5 Values */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        {/* NIM */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <IconUser className="size-3 text-slate-400 shrink-0" />
            <span>Nomor Induk Mahasiswa (NIM)</span>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-ink pl-4.5 font-mono">
            {student.nim}
          </p>
        </div>

        {/* Nama Lengkap */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <IconUser className="size-3 text-slate-400 shrink-0" />
            <span>Nama Lengkap</span>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-ink pl-4.5 truncate" title={student.nama_lengkap}>
            {student.nama_lengkap}
          </p>
        </div>

        {/* Program Studi */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <IconAcademicCap className="size-3 text-slate-400 shrink-0" />
            <span>Program Studi</span>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-ink pl-4.5">
            {student.program_studi?.nama_prodi || 'Sistem Informasi'}
          </p>
        </div>

        {/* Status Akun */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <IconCheckCircle className="size-3 text-slate-400 shrink-0" />
            <span>Status Akun</span>
          </div>
          <div className="mt-0.5 pl-4.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {student.status_akun || 'AKTIF'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
