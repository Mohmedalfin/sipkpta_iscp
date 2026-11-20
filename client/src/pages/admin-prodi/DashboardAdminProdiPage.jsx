import { Link } from 'react-router-dom';
import {
  IconAcademicCap,
  IconArrowRight,
  IconCheckCircle,
  IconClipboardCheck,
  IconDatabase,
  IconInformationCircle,
  IconUsers,
} from '../../components/common/Icons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function DashboardAdminProdiPage() {
  const { session } = useAuth();
  const displayName = session?.user?.nama_tampilan || session?.user?.login_id || 'Admin Program Studi';

  const quickNavItems = [
    {
      title: 'Verifikasi Data Diri',
      category: 'Pemeriksaan Berkas',
      description:
        'Validasi berkas identitas resmi mahasiswa (KTM, KTP, dan dokumen wajib) sebelum mahasiswa mengajukan KP, ISCP, atau TA.',
      to: '/admin-prodi/verifikasi-data-diri',
      icon: IconClipboardCheck,
      badgeText: 'Prioritas Utama',
      ctaText: 'Buka Verifikasi',
    },
    {
      title: 'Data Mahasiswa',
      category: 'Master Data',
      description:
        'Kelola basis data identitas mahasiswa, Nomor Induk Mahasiswa (NIM), tahun angkatan, dan status keaktifan akademik.',
      to: '/admin-prodi/master/mahasiswa',
      icon: IconUsers,
      badgeText: 'Basis Data',
      ctaText: 'Kelola Mahasiswa',
    },
    {
      title: 'Data Dosen',
      category: 'Master Data',
      description:
        'Basis data pengajar Program Studi Sistem Informasi untuk penugasan dosen reviewer proposal dan pembimbing akademik.',
      to: '/admin-prodi/master/dosen',
      icon: IconAcademicCap,
      badgeText: 'Basis Data',
      ctaText: 'Kelola Dosen',
    },
  ];

  const workflowSteps = [
    {
      number: '01',
      title: 'Unggah Berkas Mahasiswa',
      desc: 'Mahasiswa mengisi data diri dan mengunggah berkas wajib (KTM, KTP, dsb.) melalui portal mahasiswa.',
    },
    {
      number: '02',
      title: 'Pemeriksaan oleh Admin Prodi',
      desc: 'Admin Prodi memeriksa keaslian, kelayakan, dan kesesuaian dokumen dengan data identitas resmi.',
    },
    {
      number: '03',
      title: 'Keputusan Verifikasi',
      desc: 'Admin Prodi memberikan status Disetujui atau Ditolak disertai catatan perbaikan yang jelas jika ada kekurangan.',
    },
    {
      number: '04',
      title: 'Kelayakan Pengajuan Tahap',
      desc: 'Mahasiswa yang seluruh berkas wajibnya telah disetujui dapat melanjutkan ke tahap pengajuan KP, ISCP, atau TA.',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl space-y-6">
      {/* 1. Header Halaman */}
      <div className="border-b border-slate-900/[0.06] pb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Portal Administrasi Program Studi Sistem Informasi
        </span>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Dashboard Admin Prodi
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-secondary">
          Selamat datang, <strong className="text-ink font-semibold">{displayName}</strong>. Pusat pengelolaan master data dan verifikasi berkas mahasiswa SIPKITA.
        </p>
      </div>

      {/* 2. Notice Banner */}
      <div className="rounded-[16px] border border-slate-900/[0.08] bg-white/65 p-4 flex items-start gap-3 shadow-none">
        <IconInformationCircle className="size-4.5 text-slate-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink leading-snug">
            Kewenangan Administrasi Akademik Program Studi
          </p>
          <p className="text-xs text-secondary/90 leading-relaxed mt-0.5">
            Admin Prodi berwenang memeriksa kelengkapan data diri dan berkas administrasi mahasiswa. Verifikasi berkas yang teliti memastikan kelayakan mahasiswa sebelum memasuki siklus akademik Kerja Praktik (KP), Capstone Project (ISCP), dan Tugas Akhir (TA).
          </p>
        </div>
      </div>

      {/* 3. Kartu Menu Cepat (Quick Access Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {quickNavItems.map((item) => {
          const ItemIcon = item.icon;
          return (
            <div
              key={item.to}
              className="group flex flex-col justify-between rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-6 shadow-none hover:bg-white/90 hover:border-slate-900/[0.15] transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="size-10 rounded-full bg-white/80 border border-slate-900/[0.08] flex items-center justify-center text-brand">
                    <ItemIcon className="size-5" />
                  </div>
                  <span className="inline-flex items-center rounded-full border border-slate-900/[0.08] bg-white/80 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {item.badgeText}
                  </span>
                </div>

                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
                  {item.category}
                </span>
                <h2 className="mt-1 text-base font-bold text-ink">
                  {item.title}
                </h2>
                <p className="mt-2 text-xs text-secondary leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-900/[0.06]">
                <Link
                  to={item.to}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-900/[0.08] bg-white/70 hover:bg-white text-xs font-semibold text-slate-700 px-3.5 py-2 transition-colors cursor-pointer"
                >
                  <span>{item.ctaText}</span>
                  <IconArrowRight className="size-3.5 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Panel Informasi & Alur Kerja (2 Kolom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Alur Proses Verifikasi */}
        <div className="lg:col-span-7 rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-6 sm:p-7 shadow-none">
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] pb-4 mb-5">
            <div className="flex items-center gap-2.5">
              <IconClipboardCheck className="size-4.5 text-slate-600 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-ink">
                  Tahapan Alur Verifikasi Data Diri Mahasiswa
                </h2>
                <p className="text-xs text-muted mt-0.5">Standar operasional pemeriksaan berkas mahasiswa</p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
              Alur Wajib
            </span>
          </div>

          <div className="space-y-3">
            {workflowSteps.map((step) => (
              <div key={step.number} className="flex items-start gap-3.5 p-3 rounded-xl border border-slate-900/[0.06] bg-white/60">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/80 border border-slate-900/[0.08] text-brand font-mono text-xs font-bold">
                  {step.number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-ink leading-snug">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-secondary leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kolom Kanan: Panduan Batasan Wewenang */}
        <div className="lg:col-span-5 rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-6 sm:p-7 shadow-none space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] pb-4 mb-2">
            <div className="flex items-center gap-2.5">
              <IconAcademicCap className="size-4.5 text-slate-600 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-ink">
                  Batasan Peran & Hubungan Kewenangan
                </h2>
                <p className="text-xs text-muted mt-0.5">Tata kelola administrasi akademik SIPKITA</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="rounded-xl border border-slate-900/[0.06] bg-white/60 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-ink font-semibold">
                <IconCheckCircle className="size-4 text-emerald-600 shrink-0" />
                <span>Admin Program Studi</span>
              </div>
              <p className="text-secondary leading-relaxed pl-6 text-xs">
                Memeriksa data diri, berkas identitas mahasiswa, dan mengelola master data prodi.
              </p>
            </div>

            <div className="rounded-xl border border-slate-900/[0.06] bg-white/60 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-ink font-semibold">
                <IconCheckCircle className="size-4 text-blue-600 shrink-0" />
                <span>Ketua Program Studi (Kaprodi)</span>
              </div>
              <p className="text-secondary leading-relaxed pl-6 text-xs">
                Menetapkan reviewer proposal, pembimbing akademik, dan memutuskan persetujuan akhir pengajuan KP/ISCP/TA.
              </p>
            </div>

            <div className="rounded-xl border border-slate-900/[0.06] bg-white/60 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-ink font-semibold">
                <IconCheckCircle className="size-4 text-purple-600 shrink-0" />
                <span>Dosen Reviewer & Pembimbing</span>
              </div>
              <p className="text-secondary leading-relaxed pl-6 text-xs">
                Reviewer menelaah substansi proposal pengajuan; Dosen Pembimbing membimbing dan memberikan ACC penyelesaian tahap.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

