import {
  IconAcademicCap,
  IconBriefcase,
  IconCalendar,
  IconCalendarClock,
  IconChartBar,
  IconClipboardCheck,
  IconCube,
  IconDashboard,
  IconDatabase,
  IconDocumentSearch,
  IconDocumentText,
  IconDocumentUpload,
  IconEdit,
  IconUser,
  IconUserCircle,
  IconUsers,
} from '../components/common/Icons.jsx';

export const MAHASISWA_NAVIGATION = [
  {
    group: 'Menu Utama',
    items: [
      {
        type: 'link',
        label: 'Dashboard',
        to: '/mahasiswa/dashboard',
        icon: IconDashboard,
        end: true,
      },
    ],
  },
  {
    group: 'Profil Mahasiswa',
    items: [
      {
        type: 'accordion',
        key: 'dataDiri',
        label: 'Data Diri',
        icon: IconUser,
        activePrefixes: ['/mahasiswa/profil', '/mahasiswa/dokumen'],
        children: [
          {
            label: 'Profil Saya',
            to: '/mahasiswa/profil',
            icon: IconUserCircle,
          },
          {
            label: 'Dokumen Data Diri',
            to: '/mahasiswa/dokumen',
            icon: IconDocumentText,
          },
        ],
      },
    ],
  },
  {
    group: 'Pengajuan Akademik',
    items: [
      {
        type: 'accordion',
        key: 'pengajuan',
        label: 'Pengajuan',
        icon: IconDocumentUpload,
        activePrefixes: ['/mahasiswa/pengajuan'],
        children: [
          {
            label: 'Kerja Praktik (KP)',
            to: '/mahasiswa/pengajuan/kp',
            icon: IconBriefcase,
          },
          {
            label: 'ISCP',
            to: '/mahasiswa/pengajuan/iscp',
            icon: IconCube,
          },
          {
            label: 'Tugas Akhir (TA)',
            to: '/mahasiswa/pengajuan/ta',
            icon: IconAcademicCap,
          },
        ],
      },
      {
        type: 'link',
        label: 'Perpanjangan',
        to: '/mahasiswa/perpanjangan',
        icon: IconCalendar,
      },
      {
        type: 'link',
        label: 'Perubahan Judul',
        to: '/mahasiswa/perubahan-judul',
        icon: IconEdit,
      },
    ],
  },
  {
    group: 'Monitoring',
    items: [
      {
        type: 'link',
        label: 'Status Pengajuan',
        to: '/mahasiswa/status-pengajuan',
        icon: IconClipboardCheck,
      },
      {
        type: 'link',
        label: 'Hasil Review Proposal',
        to: '/mahasiswa/review-proposal',
        icon: IconDocumentSearch,
      },
      {
        type: 'link',
        label: 'Riwayat Akademik',
        to: '/mahasiswa/riwayat',
        icon: IconChartBar,
      },
    ],
  },
  {
    group: 'Bimbingan & Seminar',
    items: [
      {
        type: 'accordion',
        key: 'bimbingan',
        label: 'Bimbingan',
        icon: IconUsers,
        activePrefixes: ['/mahasiswa/bimbingan'],
        children: [
          {
            label: 'Kerja Praktik (KP)',
            to: '/mahasiswa/bimbingan/kp',
            icon: IconBriefcase,
          },
          {
            label: 'ISCP',
            to: '/mahasiswa/bimbingan/iscp',
            icon: IconCube,
          },
          {
            label: 'Tugas Akhir (TA)',
            to: '/mahasiswa/bimbingan/ta',
            icon: IconAcademicCap,
          },
        ],
      },
      {
        type: 'link',
        label: 'Jadwal Seminar',
        to: '/mahasiswa/seminar',
        icon: IconCalendarClock,
      },
    ],
  },
];

export const ADMIN_PRODI_NAVIGATION = [
  {
    group: 'Menu Utama',
    items: [
      {
        type: 'link',
        label: 'Dashboard',
        to: '/admin-prodi/dashboard',
        icon: IconDashboard,
        end: true,
      },
    ],
  },
  {
    group: 'Master Data',
    items: [
      {
        type: 'accordion',
        key: 'masterData',
        label: 'Master Data',
        icon: IconDatabase,
        activePrefixes: ['/admin-prodi/master'],
        children: [
          {
            label: 'Data Mahasiswa',
            to: '/admin-prodi/master/mahasiswa',
            icon: IconUsers,
          },
          {
            label: 'Data Dosen',
            to: '/admin-prodi/master/dosen',
            icon: IconAcademicCap,
          },
        ],
      },
    ],
  },
  {
    group: 'Pengaturan',
    items: [{
      type: 'link',
      label: 'Pengaturan Akademik',
      to: '/admin-prodi/pengaturan-akademik',
      icon: IconCalendarClock,
    }],
  },
  {
    group: 'Verifikasi',
    items: [
      {
        type: 'link',
        label: 'Verifikasi Data Diri',
        to: '/admin-prodi/verifikasi-data-diri',
        icon: IconClipboardCheck,
      },
      {
        type: 'link',
        label: 'Verifikasi Pengajuan KP',
        to: '/admin-prodi/verifikasi-pengajuan-kp',
        icon: IconBriefcase,
      },
    ],
  },
];

export const KAPRODI_NAVIGATION = [
  {
    group: 'Menu Utama',
    items: [
      {
        type: 'link',
        label: 'Dashboard',
        to: '/kaprodi/dashboard',
        icon: IconDashboard,
        end: true,
      },
    ],
  },
  {
    group: 'Pengajuan & Penugasan',
    items: [
      {
        type: 'accordion',
        key: 'pengajuanKp',
        label: 'Pengajuan KP',
        icon: IconBriefcase,
        activePrefixes: ['/kaprodi/kp'],
        children: [
          {
            label: 'Penugasan Reviewer',
            to: '/kaprodi/kp/penugasan-reviewer',
            icon: IconDocumentSearch,
          },
          {
            label: 'Finalisasi & Pembimbing',
            to: '/kaprodi/kp/finalisasi',
            icon: IconUsers,
          },
        ],
      },
      {
        type: 'link',
        label: 'Pengajuan ISCP',
        to: '/kaprodi/iscp',
        icon: IconCube,
      },
      {
        type: 'link',
        label: 'Pengajuan Tugas Akhir',
        to: '/kaprodi/ta',
        icon: IconAcademicCap,
      },
    ],
  },
  {
    group: 'Monitoring & Akademik',
    items: [
      {
        type: 'link',
        label: 'Monitoring Mahasiswa',
        to: '/kaprodi/monitoring',
        icon: IconClipboardCheck,
      },
      {
        type: 'link',
        label: 'Jadwal Seminar',
        to: '/kaprodi/seminar',
        icon: IconCalendarClock,
      },
    ],
  },
];

export const REVIEWER_NAVIGATION = [
  {
    group: 'Menu Utama',
    items: [
      {
        type: 'link',
        label: 'Dashboard',
        to: '/reviewer/dashboard',
        icon: IconDashboard,
        end: true,
      },
    ],
  },
  {
    group: 'Penelaahan Proposal',
    items: [
      {
        type: 'link',
        label: 'Review Proposal KP',
        to: '/reviewer/review-kp',
        icon: IconBriefcase,
      },
      {
        type: 'link',
        label: 'Review Proposal ISCP',
        to: '/reviewer/review-iscp',
        icon: IconCube,
      },
      {
        type: 'link',
        label: 'Review Proposal TA',
        to: '/reviewer/review-ta',
        icon: IconAcademicCap,
      },
    ],
  },
  {
    group: 'Riwayat Penilaian',
    items: [
      {
        type: 'link',
        label: 'Riwayat Review',
        to: '/reviewer/riwayat',
        icon: IconChartBar,
      },
    ],
  },
];

export const PEMBIMBING_NAVIGATION = [
  {
    group: 'Menu Utama',
    items: [
      {
        type: 'link',
        label: 'Dashboard',
        to: '/pembimbing/dashboard',
        icon: IconDashboard,
        end: true,
      },
    ],
  },
  {
    group: 'Bimbingan Mahasiswa',
    items: [
      {
        type: 'link',
        label: 'Bimbingan KP',
        to: '/pembimbing/bimbingan-kp',
        icon: IconBriefcase,
      },
      {
        type: 'link',
        label: 'Bimbingan ISCP',
        to: '/pembimbing/bimbingan-iscp',
        icon: IconCube,
      },
      {
        type: 'link',
        label: 'Bimbingan TA',
        to: '/pembimbing/bimbingan-ta',
        icon: IconAcademicCap,
      },
    ],
  },
  {
    group: 'Penyelesaian Tahap',
    items: [
      {
        type: 'link',
        label: 'Validasi & ACC Tahap',
        to: '/pembimbing/acc-penyelesaian',
        icon: IconClipboardCheck,
      },
    ],
  },
];

export const ROUTE_BREADCRUMBS = {
  '/mahasiswa': [{ label: 'Beranda', isHome: true }],
  '/mahasiswa/dashboard': [{ label: 'Beranda', isHome: true }],
  '/admin-prodi': [{ label: 'Beranda', isHome: true }],
  '/admin-prodi/dashboard': [{ label: 'Beranda', isHome: true }],
  '/kaprodi': [{ label: 'Beranda', isHome: true }],
  '/kaprodi/dashboard': [{ label: 'Beranda', isHome: true }],
  '/reviewer': [{ label: 'Beranda', isHome: true }],
  '/reviewer/dashboard': [{ label: 'Beranda', isHome: true }],
  '/pembimbing': [{ label: 'Beranda', isHome: true }],
  '/pembimbing/dashboard': [{ label: 'Beranda', isHome: true }],
  '/admin-prodi/master/mahasiswa': [
    { label: 'Master Data' },
    { label: 'Data Mahasiswa' },
  ],
  '/admin-prodi/master/dosen': [
    { label: 'Master Data' },
    { label: 'Data Dosen' },
  ],
  '/admin-prodi/pengaturan-akademik': [
    { label: 'Pengaturan' },
    { label: 'Pengaturan Akademik' },
  ],
  '/admin-prodi/verifikasi-data-diri': [
    { label: 'Verifikasi' },
    { label: 'Verifikasi Data Diri' },
  ],
  '/admin-prodi/verifikasi-pengajuan-kp': [
    { label: 'Verifikasi' },
    { label: 'Verifikasi Pengajuan KP' },
  ],
  '/mahasiswa/profil': [
    { label: 'Data Diri' },
    { label: 'Profil Saya' },
  ],
  '/mahasiswa/dokumen': [
    { label: 'Data Diri' },
    { label: 'Dokumen Data Diri' },
  ],
  '/mahasiswa/pengajuan/kp': [
    { label: 'Pengajuan' },
    { label: 'Kerja Praktik (KP)' },
  ],
  '/mahasiswa/pengajuan/iscp': [
    { label: 'Pengajuan' },
    { label: 'ISCP' },
  ],
  '/mahasiswa/pengajuan/ta': [
    { label: 'Pengajuan' },
    { label: 'Tugas Akhir (TA)' },
  ],
  '/mahasiswa/perpanjangan': [
    { label: 'Pengajuan' },
    { label: 'Perpanjangan' },
  ],
  '/mahasiswa/perubahan-judul': [
    { label: 'Pengajuan' },
    { label: 'Perubahan Judul' },
  ],
  '/mahasiswa/status-pengajuan': [
    { label: 'Monitoring' },
    { label: 'Status Pengajuan' },
  ],
  '/mahasiswa/review-proposal': [
    { label: 'Monitoring' },
    { label: 'Hasil Review Proposal' },
  ],
  '/mahasiswa/riwayat': [
    { label: 'Monitoring' },
    { label: 'Riwayat Akademik' },
  ],
  '/mahasiswa/bimbingan/kp': [
    { label: 'Bimbingan' },
    { label: 'Kerja Praktik (KP)' },
  ],
  '/mahasiswa/bimbingan/iscp': [
    { label: 'Bimbingan' },
    { label: 'ISCP' },
  ],
  '/mahasiswa/bimbingan/ta': [
    { label: 'Bimbingan' },
    { label: 'Tugas Akhir (TA)' },
  ],
  '/mahasiswa/bimbingan': [
    { label: 'Bimbingan' },
    { label: 'Kerja Praktik (KP)' },
  ],
  '/mahasiswa/seminar': [
    { label: 'Bimbingan & Seminar' },
    { label: 'Jadwal Seminar' },
  ],
  '/kaprodi/kp/penugasan-reviewer': [
    { label: 'Pengajuan KP' },
    { label: 'Penugasan Reviewer' },
  ],
  '/kaprodi/kp/finalisasi': [
    { label: 'Pengajuan KP' },
    { label: 'Finalisasi & Pembimbing' },
  ],
  '/kaprodi/iscp': [
    { label: 'Pengajuan & Penugasan' },
    { label: 'Pengajuan ISCP' },
  ],
  '/kaprodi/ta': [
    { label: 'Pengajuan & Penugasan' },
    { label: 'Pengajuan Tugas Akhir' },
  ],
  '/kaprodi/monitoring': [
    { label: 'Monitoring & Akademik' },
    { label: 'Monitoring Mahasiswa' },
  ],
  '/kaprodi/seminar': [
    { label: 'Monitoring & Akademik' },
    { label: 'Jadwal Seminar' },
  ],
  '/reviewer/review-kp': [
    { label: 'Penelaahan Proposal' },
    { label: 'Review Proposal KP' },
  ],
  '/reviewer/review-iscp': [
    { label: 'Penelaahan Proposal' },
    { label: 'Review Proposal ISCP' },
  ],
  '/reviewer/review-ta': [
    { label: 'Penelaahan Proposal' },
    { label: 'Review Proposal TA' },
  ],
  '/reviewer/riwayat': [
    { label: 'Riwayat Penilaian' },
    { label: 'Riwayat Review' },
  ],
  '/pembimbing/bimbingan-kp': [
    { label: 'Bimbingan Mahasiswa' },
    { label: 'Bimbingan KP' },
  ],
  '/pembimbing/bimbingan-iscp': [
    { label: 'Bimbingan Mahasiswa' },
    { label: 'Bimbingan ISCP' },
  ],
  '/pembimbing/bimbingan-ta': [
    { label: 'Bimbingan Mahasiswa' },
    { label: 'Bimbingan TA' },
  ],
  '/pembimbing/acc-penyelesaian': [
    { label: 'Penyelesaian Tahap' },
    { label: 'Validasi & ACC Tahap' },
  ],
};

export function getBreadcrumb(pathname) {
  if (!pathname) return [{ label: 'Beranda', isHome: true }];

  // Normalize path by removing trailing slash
  const cleanPath =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  if (ROUTE_BREADCRUMBS[cleanPath]) {
    return ROUTE_BREADCRUMBS[cleanPath];
  }

  // Prefix matching for nested routes
  for (const [route, crumbs] of Object.entries(ROUTE_BREADCRUMBS)) {
    if (
      route !== '/mahasiswa' &&
      route !== '/mahasiswa/dashboard' &&
      route !== '/admin-prodi' &&
      route !== '/admin-prodi/dashboard' &&
      route !== '/kaprodi' &&
      route !== '/kaprodi/dashboard' &&
      route !== '/reviewer' &&
      route !== '/reviewer/dashboard' &&
      route !== '/pembimbing' &&
      route !== '/pembimbing/dashboard' &&
      cleanPath.startsWith(route)
    ) {
      return crumbs;
    }
  }

  // Dynamic fallback lookup through navigation lists
  const allNavGroups = [
    ...MAHASISWA_NAVIGATION,
    ...ADMIN_PRODI_NAVIGATION,
    ...KAPRODI_NAVIGATION,
    ...REVIEWER_NAVIGATION,
    ...PEMBIMBING_NAVIGATION,
  ];
  for (const group of allNavGroups) {
    for (const item of group.items) {
      if (item.type === 'link' && cleanPath.startsWith(item.to)) {
        return [{ label: group.group }, { label: item.label }];
      }
      if (item.type === 'accordion' && item.children) {
        const found = item.children.find((c) => cleanPath.startsWith(c.to));
        if (found) {
          return [{ label: item.label }, { label: found.label }];
        }
      }
    }
  }

  return [{ label: 'Beranda', isHome: true }];
}



