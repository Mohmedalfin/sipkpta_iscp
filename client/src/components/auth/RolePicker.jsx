import {
  IconAcademicCap,
  IconArrowRight,
  IconClipboardCheck,
  IconDatabase,
  IconDocumentSearch,
  IconSpinner,
  IconUser,
  IconUsers,
} from '../common/Icons.jsx';

/**
 * Metadata peran untuk presentasi kartu pemilihan peran (RolePicker)
 */
const ROLE_CONFIG = {
  KAPRODI: {
    label: 'Ketua Program Studi',
    shortLabel: 'Kaprodi',
    subLabel: 'Program Studi Sistem Informasi',
    description: 'Persetujuan akhir pengajuan, penetapan reviewer, dan penugasan dosen pembimbing.',
    icon: IconAcademicCap,
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    iconBgClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  REVIEWER: {
    label: 'Dosen Reviewer',
    shortLabel: 'Reviewer',
    subLabel: 'Penelaah Proposal KP / ISCP / TA',
    description: 'Pemeriksaan substansi dan penilaian kelayakan proposal pengajuan mahasiswa.',
    icon: IconDocumentSearch,
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    iconBgClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  PEMBIMBING: {
    label: 'Dosen Pembimbing',
    shortLabel: 'Pembimbing',
    subLabel: 'Pembimbing KP / ISCP / TA',
    description: 'Bimbingan berkala, monitoring progres mahasiswa, dan validasi penyelesaian tahap.',
    icon: IconUsers,
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    iconBgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  ADMIN_PRODI: {
    label: 'Admin Program Studi',
    shortLabel: 'Admin Prodi',
    subLabel: 'Administrasi Akademik',
    description: 'Pemeriksaan berkas persyaratan, verifikasi data diri, dan pengelolaan master data.',
    icon: IconClipboardCheck,
    badgeClass: 'border-blue-200 bg-blue-50 text-brand',
    iconBgClass: 'bg-blue-50 text-brand border-blue-200',
  },
  MAHASISWA: {
    label: 'Mahasiswa',
    shortLabel: 'Mahasiswa',
    subLabel: 'Sistem Informasi',
    description: 'Pengajuan KP, ISCP, TA, unggah berkas persyaratan, dan bimbingan berkala.',
    icon: IconUser,
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
    iconBgClass: 'bg-slate-50 text-slate-700 border-slate-200',
  },
  ADMIN_SISTEM: {
    label: 'Admin Sistem',
    shortLabel: 'Admin Sistem',
    subLabel: 'Administrator Global',
    description: 'Pemeliharaan sistem, manajemen akun pengguna, dan konfigurasi server.',
    icon: IconDatabase,
    badgeClass: 'border-purple-200 bg-purple-50 text-purple-700',
    iconBgClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

export function getRoleMeta(roleCode) {
  return (
    ROLE_CONFIG[roleCode] || {
      label: roleCode
        .toLowerCase()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      shortLabel: roleCode,
      subLabel: 'Sistem Informasi',
      description: 'Akses menu dan tindakan sesuai kewenangan peran akun ini.',
      icon: IconUser,
      badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
      iconBgClass: 'bg-slate-50 text-slate-700 border-slate-200',
    }
  );
}

/**
 * Komponen Pemilihan Peran Aktif saat Login untuk Akun Multi-Role
 * 
 * @param {object} props
 * @param {string[]} props.roles - Daftar kode peran yang dimiliki akun
 * @param {string|null} props.pendingRole - Peran yang sedang diproses aktivasinya
 * @param {string} [props.error] - Pesan error jika gagal aktivasi peran
 * @param {Function} props.onSelect - Handler saat pengguna memilih peran
 */
export default function RolePicker({ roles = [], pendingRole, error, onSelect }) {
  return (
    <section aria-labelledby="role-heading" className="w-full space-y-5">
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
          Pilih Ruang Kerja
        </span>
        <h1 id="role-heading" className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
          Pilih Peran untuk Sesi Ini
        </h1>
        <p className="text-xs sm:text-sm leading-relaxed text-secondary">
          Akun Anda memiliki lebih dari satu peran. Pilih ruang kerja yang ingin Anda buka saat ini. Anda dapat berpindah peran kapan saja melalui menu profil.
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-danger flex items-start gap-2"
          role="alert"
        >
          <span className="font-bold">•</span>
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        {roles.map((roleCode) => {
          const meta = getRoleMeta(roleCode);
          const Icon = meta.icon;
          const isActivating = pendingRole === roleCode;
          const isDisabled = Boolean(pendingRole);

          return (
            <button
              key={roleCode}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(roleCode)}
              className={`group w-full rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer select-none relative focus:outline-hidden ${
                isActivating
                  ? 'border-brand bg-blue-50/50 ring-2 ring-brand/20 shadow-xs'
                  : 'border-slate-900/[0.1] bg-white/85 backdrop-blur-sm hover:border-brand hover:bg-white hover:shadow-xs active:scale-[0.995]'
              } ${isDisabled && !isActivating ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Ikon Peran */}
                  <div
                    className={`size-10 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${meta.iconBgClass}`}
                  >
                    <Icon className="size-5" />
                  </div>

                  {/* Informasi Peran */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-ink group-hover:text-brand transition-colors">
                        {meta.label}
                      </h2>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
                      >
                        {meta.shortLabel}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] leading-relaxed text-secondary line-clamp-2">
                      {meta.description}
                    </p>
                  </div>
                </div>

                {/* Status Aksi di Sebelah Kanan */}
                <div className="shrink-0 pt-1">
                  {isActivating ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                      <IconSpinner className="size-3.5 text-brand animate-spin" />
                      <span>Masuk…</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-900/[0.08] bg-white px-2.5 py-1 text-xs font-semibold text-secondary group-hover:border-brand group-hover:text-brand transition-colors shadow-2xs">
                      <span>Buka</span>
                      <IconArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
