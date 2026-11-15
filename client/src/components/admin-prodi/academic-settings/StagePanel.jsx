import { useAcademicSettingsList } from '../../../hooks/useAcademicSettingsList.js';
import AcademicStatusBadge from './AcademicStatusBadge.jsx';
import { ListState, SectionHeader } from './SettingsUi.jsx';
import {
  IconArrowRight,
  IconCheckCircle,
  IconDatabase,
  IconInformationCircle,
} from '../../common/Icons.jsx';

const STAGE_META = {
  KP: {
    badgeColor: 'bg-blue-50 text-brand border-blue-200/70',
    description: 'Tahap praktik industri lapangan untuk memperoleh pengalaman kerja profesional di instansi/perusahaan mitra.',
    nextRequirement: 'Wajib ACC Pembimbing & kelulusan seminar KP untuk membuka hak pengajuan ISCP.',
  },
  ISCP: {
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
    description: 'Proyek capstone terintegrasi sistem informasi yang memecahkan masalah nyata dengan solusi sistem berbasis data/aplikasi.',
    nextRequirement: 'Wajib ACC Pembimbing penyelesaian ISCP untuk membuka hak pengajuan Tugas Akhir.',
  },
  TA: {
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200/70',
    description: 'Tahap penulisan skripsi/tugas akhir komprehensif sebagai syarat akhir kelulusan Program Sarjana Sistem Informasi.',
    nextRequirement: 'Tahap akhir akademik sebelum yudisium dan kelulusan sarjana.',
  },
};

export default function StagePanel() {
  const list = useAcademicSettingsList('stages');

  const sortedStages = [...list.data].sort((a, b) => a.urutan - b.urutan);

  return (
    <div className="space-y-5">
      {/* ================= 1. SECTION HEADER ================= */}
      <SectionHeader
        title="Tahap Akademik Program Studi"
        description="Kelola alur dan integritas urutan tahapan akademik KP → ISCP → TA prodi."
        onRefresh={list.refresh}
        badgeCount={list.data.length}
        kicker="SIKLUS AKADEMIK"
      />

      {/* ================= 2. VISUAL PIPELINE FLOWCHART ================= */}
      {!list.loading && !list.error && sortedStages.length > 0 && (
        <div className="rounded-[20px] border border-slate-900/[0.08] bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-brand" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
              Diagram Alur Siklus Tahap Akademik
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {sortedStages.map((stage, idx) => {
              const meta = STAGE_META[stage.kode_tahap] || {
                badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
                description: 'Tahap proses akademik resmi program studi.',
                nextRequirement: 'Sesuai ketentuan akademik prodi.',
              };
              const isLast = idx === sortedStages.length - 1;

              return (
                <div
                  key={stage.id}
                  className="relative flex flex-col justify-between rounded-xl border border-slate-900/[0.08] bg-slate-50/50 p-4 transition-all hover:bg-slate-50 hover:shadow-xs"
                >
                  <div>
                    {/* Header Card Tahap */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="size-6 rounded-full bg-brand text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">
                          {stage.urutan}
                        </span>
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md border ${meta.badgeColor}`}
                        >
                          {stage.kode_tahap}
                        </span>
                      </div>
                      <AcademicStatusBadge status={stage.is_aktif} size="sm" />
                    </div>

                    <h4 className="text-sm font-bold text-ink leading-snug">
                      {stage.nama_tahap}
                    </h4>

                    <p className="mt-1.5 text-[11px] text-secondary leading-relaxed line-clamp-3">
                      {meta.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-900/[0.06] text-[10px] text-muted leading-tight">
                    <span className="font-semibold text-slate-700">Persyaratan Lanjut:</span>{' '}
                    {meta.nextRequirement}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 4. FEEDBACK STATES ================= */}
      <ListState
        loading={list.loading}
        error={list.error}
        empty={!list.data.length}
        emptyTitle="Tahap Akademik Tidak Ditemukan"
        emptyMessage="Data tahap akademik belum tersedia pada server."
        onRetry={list.refresh}
      />

      {/* ================= 5. TABEL RINCIAN TAHAP AKADEMIK ================= */}
      {!list.loading && !list.error && sortedStages.length > 0 && (
        <div className="overflow-hidden rounded-[20px] border border-slate-900/[0.08] bg-white shadow-2xs">
          <div className="px-5 py-3.5 border-b border-slate-900/[0.06] bg-slate-50/75 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Rincian Master Tahap Akademik
            </h4>
            <span className="text-[11px] text-muted">
              Total {sortedStages.length} Tahap Terdaftar
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/[0.06] bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">Urutan & Kode</th>
                  <th className="px-5 py-3">Nama Tahap Akademik</th>
                  <th className="px-5 py-3">Maks. Perpanjangan</th>
                  <th className="px-5 py-3">Status Tahap</th>
                  <th className="px-5 py-3">Integritas Alur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.06] text-xs">
                {sortedStages.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    {/* 1. Urutan & Kode */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                          Urutan #{row.urutan}
                        </span>
                        <span className="font-mono font-bold text-xs text-brand bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                          {row.kode_tahap}
                        </span>
                      </div>
                    </td>

                    {/* 2. Nama Tahap */}
                    <td className="px-5 py-4">
                      <span className="font-bold text-ink text-sm block">
                        {row.nama_tahap}
                      </span>
                      <span className="text-[11px] text-muted font-mono">
                        ID Tahap: #{row.id}
                      </span>
                    </td>

                    {/* 3. Maks. Perpanjangan */}
                    <td className="px-5 py-4 whitespace-nowrap text-secondary">
                      {row.maks_perpanjangan ? (
                        <span className="font-semibold text-slate-800">
                          {row.maks_perpanjangan} Kali Semester
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 font-medium">
                          Belum Dibatasi
                        </span>
                      )}
                    </td>

                    {/* 4. Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <AcademicStatusBadge status={row.is_aktif} />
                    </td>

                    {/* 5. Integritas Alur */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-lg">
                        <IconCheckCircle className="size-3 text-emerald-600" />
                        <span>Siklus Terkunci Sistem</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
