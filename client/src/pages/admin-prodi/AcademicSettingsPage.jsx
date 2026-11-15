import { useSearchParams } from 'react-router-dom';
import { useAcademicSettingsList } from '../../hooks/useAcademicSettingsList.js';
import { formatDateIndo } from '../../components/admin-prodi/academic-settings/SettingsUi.jsx';
import PeriodPanel from '../../components/admin-prodi/academic-settings/PeriodPanel.jsx';
import SchedulePanel from '../../components/admin-prodi/academic-settings/SchedulePanel.jsx';
import CurriculumPanel from '../../components/admin-prodi/academic-settings/CurriculumPanel.jsx';
import StagePanel from '../../components/admin-prodi/academic-settings/StagePanel.jsx';
import DocumentTypesPanel from '../../components/admin-prodi/academic-settings/DocumentTypesPanel.jsx';
import RequirementsPanel from '../../components/admin-prodi/academic-settings/RequirementsPanel.jsx';
import {
  IconAcademicCap,
  IconCalendar,
  IconCalendarClock,
  IconClipboardCheck,
  IconDatabase,
  IconDocumentText,
  IconSpinner,
} from '../../components/common/Icons.jsx';

const panels = {
  periode: PeriodPanel,
  jadwal: SchedulePanel,
  kurikulum: CurriculumPanel,
  tahap: StagePanel,
  dokumen: DocumentTypesPanel,
  persyaratan: RequirementsPanel,
};

const tabs = [
  {
    key: 'periode',
    label: 'Periode Akademik',
    shortLabel: 'Periode',
    icon: IconCalendar,
    description: 'Tahun ajaran & semester',
  },
  {
    key: 'jadwal',
    label: 'Jadwal Proses',
    shortLabel: 'Jadwal',
    icon: IconCalendarClock,
    description: 'Reguler & perpanjangan',
  },
  {
    key: 'kurikulum',
    label: 'Master Kurikulum',
    shortLabel: 'Kurikulum',
    icon: IconAcademicCap,
    description: 'Informasi kurikulum prodi',
  },
  {
    key: 'tahap',
    label: 'Tahap Akademik',
    shortLabel: 'Tahap',
    icon: IconDatabase,
    description: 'Alur KP → ISCP → TA',
  },
  {
    key: 'dokumen',
    label: 'Jenis Dokumen',
    shortLabel: 'Dokumen',
    icon: IconDocumentText,
    description: 'Master berkas pengajuan',
  },
  {
    key: 'persyaratan',
    label: 'Persyaratan Pengajuan',
    shortLabel: 'Persyaratan',
    icon: IconClipboardCheck,
    description: 'Ketentuan per tahap & jalur',
  },
];

export default function AcademicSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('tab');
  const tab = Object.hasOwn(panels, selected) ? selected : 'periode';
  const Panel = panels[tab];

  // Ambil periode akademik yang berstatus AKTIF untuk ditampilkan di pojok kanan atas
  const activePeriodsQuery = useAcademicSettingsList('periods', { status: 'AKTIF', limit: 1 });
  const activePeriod = activePeriodsQuery.data?.[0];
  const activePeriodLoading = activePeriodsQuery.loading;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-12">
      {/* 1. Header Halaman & Action Bar (Sesuai Master Mahasiswa & Master Dosen) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900/[0.06] pb-5">
        {/* Sisi Kiri: Judul Halaman & Subtitle */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Portal Administrasi
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Pengaturan Akademik
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-secondary">
            Kelola kalender periode akademik, jadwal proses pengajuan & perpanjangan, master kurikulum, serta konfigurasi dokumen persyaratan tahapan KP, ISCP, dan TA.
          </p>
        </div>

        {/* Sisi Kanan: Widget Ringkas Informasi Periode Aktif */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          {activePeriodLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-900/[0.08] bg-white px-3.5 py-2 text-xs text-muted shadow-2xs">
              <IconSpinner className="size-3.5 animate-spin text-brand" />
              <span className="text-[11px] font-medium">Memeriksa periode aktif…</span>
            </div>
          ) : activePeriod ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-50/50 px-3.5 py-2 shadow-2xs">
              <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-600">
                <IconCalendar className="size-4 shrink-0" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Periode Aktif
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-ink leading-tight mt-0.5">
                  Semester {activePeriod.semester} {activePeriod.tahun_ajaran}
                </div>
                <div className="text-[10px] text-secondary mt-0.5 font-medium">
                  {formatDateIndo(activePeriod.tanggal_mulai)} – {formatDateIndo(activePeriod.tanggal_selesai)}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900 shadow-2xs">
              <span className="size-2 rounded-full bg-amber-500 shrink-0" />
              <div>
                <span className="font-semibold block text-[10px] uppercase tracking-wider text-amber-800">
                  Periode Akademik
                </span>
                <span className="text-[11px] text-amber-900/90 font-medium">
                  Belum ada periode aktif
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= 2. TAB NAVIGATION ================= */}
      <nav
        aria-label="Bagian pengaturan akademik"
        className="rounded-2xl bg-slate-100/90 border border-slate-900/[0.08] p-1.5 overflow-x-auto shadow-2xs"
      >
        <div className="flex min-w-max items-center gap-1.5">
          {tabs.map(({ key, label, shortLabel, icon: Icon, description }) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSearchParams({ tab: key }, { replace: true })}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer select-none ${
                  isActive
                    ? 'bg-white text-brand shadow-xs border border-slate-900/[0.08]'
                    : 'text-secondary hover:text-ink hover:bg-white/60 border border-transparent'
                }`}
                title={description}
              >
                <Icon
                  className={`size-4 shrink-0 transition-colors ${
                    isActive ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span className="hidden md:inline">{label}</span>
                <span className="inline md:hidden">{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ================= 3. ACTIVE PANEL CONTAINER ================= */}
      <div className="min-h-[500px]">
        <Panel onPeriodChange={activePeriodsQuery.refresh} />
      </div>
    </div>
  );
}
