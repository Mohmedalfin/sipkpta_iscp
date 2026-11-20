import { Link, useLocation } from 'react-router-dom';
import { getBreadcrumb } from '../config/navigation.js';
import { IconArrowRight, IconInformationCircle } from '../components/common/Icons.jsx';

export default function PlaceholderPage() {
  const location = useLocation();
  const crumbs = getBreadcrumb(location.pathname);
  const currentTitle = crumbs[crumbs.length - 1]?.label || 'Halaman Akademik';
  const parentCategory = crumbs[0]?.label || 'SIPKITA';

  const pathname = location.pathname;
  let portalName = 'Portal Mahasiswa';
  let homeLink = '/mahasiswa/dashboard';
  let homeLabel = 'Ke Dashboard Mahasiswa';

  if (pathname.startsWith('/admin-prodi')) {
    portalName = 'Portal Administrasi Program Studi';
    homeLink = '/admin-prodi/dashboard';
    homeLabel = 'Ke Dashboard Admin';
  } else if (pathname.startsWith('/kaprodi')) {
    portalName = 'Portal Ketua Program Studi';
    homeLink = '/kaprodi/dashboard';
    homeLabel = 'Ke Dashboard Kaprodi';
  } else if (pathname.startsWith('/reviewer')) {
    portalName = 'Portal Dosen Reviewer';
    homeLink = '/reviewer/dashboard';
    homeLabel = 'Ke Dashboard Reviewer';
  } else if (pathname.startsWith('/pembimbing')) {
    portalName = 'Portal Dosen Pembimbing';
    homeLink = '/pembimbing/dashboard';
    homeLabel = 'Ke Dashboard Pembimbing';
  }

  return (
    <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl space-y-6">
      {/* Header */}
      <div className="border-b border-slate-900/[0.06] pb-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
            {parentCategory}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {currentTitle}
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-secondary">
          {portalName} — Sistem Informasi Pengelolaan KP, ISCP, dan Tugas Akhir (SIPKITA).
        </p>
      </div>

      {/* Main Status Card */}
      <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-8 text-center max-w-xl mx-auto my-12 shadow-none">
        <div className="size-14 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center mx-auto mb-4 text-brand">
          <IconInformationCircle className="size-7" />
        </div>

        <h2 className="text-lg font-bold text-ink">
          Modul Sedang Dalam Tahap Pengembangan
        </h2>

        <p className="mt-2 text-xs sm:text-sm text-secondary leading-relaxed">
          Fitur <strong>{currentTitle}</strong> dijadwalkan pada roadmap implementasi berikutnya. Saat ini kerangka navigasi dan tata letak ruang kerja peran telah aktif.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={homeLink}
            className="rounded-full bg-slate-900 hover:bg-black text-white px-5 py-2.5 text-xs font-bold tracking-wider uppercase transition-colors inline-flex items-center gap-2"
          >
            <span>{homeLabel}</span>
            <IconArrowRight className="size-3.5 text-white" />
          </Link>
        </div>
      </div>
    </div>
  );
}
