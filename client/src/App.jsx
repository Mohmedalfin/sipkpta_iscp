import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppShell from './layouts/AppShell.jsx';
import DashboardMahasiswaPage from './pages/mahasiswa/DashboardMahasiswaPage.jsx';
import DashboardAdminProdiPage from './pages/admin-prodi/DashboardAdminProdiPage.jsx';
import MasterMahasiswaPage from './pages/admin-prodi/MasterMahasiswaPage.jsx';
import MasterDosenPage from './pages/admin-prodi/MasterDosenPage.jsx';
import AcademicSettingsPage from './pages/admin-prodi/AcademicSettingsPage.jsx';
import VerifikasiDataDiriPage from './pages/admin-prodi/VerifikasiDataDiriPage.jsx';
import VerifikasiPengajuanKpPage from './pages/admin-prodi/VerifikasiPengajuanKpPage.jsx';
import DokumenMahasiswaPage from './pages/mahasiswa/DokumenMahasiswaPage.jsx';
import ProfilMahasiswaPage from './pages/mahasiswa/ProfilMahasiswaPage.jsx';
import PengajuanKpPage from './pages/mahasiswa/PengajuanKpPage.jsx';
import PenugasanReviewerKpPage from './pages/kaprodi/PenugasanReviewerKpPage.jsx';
import FinalisasiPembimbingKpPage from './pages/kaprodi/FinalisasiPembimbingKpPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RoleUnavailablePage from './pages/RoleUnavailablePage.jsx';

const ReviewKpPage = lazy(() => import('./pages/reviewer/ReviewKpPage.jsx'));
const BimbinganKpPage = lazy(() => import('./pages/mahasiswa/BimbinganKpPage.jsx'));

function ProtectedRoute({ role, children }) {
  const { session, initializing } = useAuth();
  if (initializing) return <div className="grid min-h-dvh place-items-center bg-canvas text-sm text-secondary" role="status">Memeriksa sesion</div>;
  if (!session?.user.activeRole) return <Navigate to="/login" replace />;
  if (role && session.user.activeRole !== role) return <Navigate to="/" replace />;
  return children;
}

function RoleLanding() {
  const { session } = useAuth();
  const role = session?.user?.activeRole;
  if (role === 'MAHASISWA') {
    return <Navigate to="/mahasiswa/dashboard" replace />;
  }
  if (role === 'ADMIN_PRODI') {
    return <Navigate to="/admin-prodi/dashboard" replace />;
  }
  if (role === 'KAPRODI') {
    return <Navigate to="/kaprodi/dashboard" replace />;
  }
  if (role === 'REVIEWER') {
    return <Navigate to="/reviewer/dashboard" replace />;
  }
  if (role === 'PEMBIMBING') {
    return <Navigate to="/pembimbing/dashboard" replace />;
  }
  return <RoleUnavailablePage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><RoleLanding /></ProtectedRoute>} />
      <Route path="/mahasiswa" element={<ProtectedRoute role="MAHASISWA"><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="/mahasiswa/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardMahasiswaPage />} />
        <Route path="profil" element={<ProfilMahasiswaPage />} />
        <Route path="dokumen" element={<DokumenMahasiswaPage />} />

        {/* Halaman Menu Akademik */}
        <Route path="pengajuan/kp" element={<PengajuanKpPage />} />
        <Route path="pengajuan/iscp" element={<PlaceholderPage />} />
        <Route path="pengajuan/ta" element={<PlaceholderPage />} />
        <Route path="perpanjangan" element={<PlaceholderPage />} />
        <Route path="perubahan-judul" element={<PlaceholderPage />} />
        <Route path="status-pengajuan" element={<PlaceholderPage />} />
        <Route path="review-proposal" element={<PlaceholderPage />} />
        <Route path="riwayat" element={<PlaceholderPage />} />
        <Route path="bimbingan" element={<Navigate to="/mahasiswa/bimbingan/kp" replace />} />
        <Route path="bimbingan/kp" element={
          <Suspense fallback={<div role="status" className="p-8 text-sm text-secondary">Memuat bimbingan?</div>}>
            <BimbinganKpPage />
          </Suspense>
        } />
        <Route path="bimbingan/iscp" element={<PlaceholderPage />} />
        <Route path="bimbingan/ta" element={<PlaceholderPage />} />
        <Route path="seminar" element={<PlaceholderPage />} />

        {/* Fallback rute tidak dikenal di dalam /mahasiswa selalu mengarah absolut ke /mahasiswa/dashboard */}
        <Route path="*" element={<Navigate to="/mahasiswa/dashboard" replace />} />
      </Route>

      {/* Rute Ruang Kerja Admin Program Studi */}
      <Route path="/admin-prodi" element={<ProtectedRoute role="ADMIN_PRODI"><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="/admin-prodi/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardAdminProdiPage />} />
        <Route path="master/mahasiswa" element={<MasterMahasiswaPage />} />
        <Route path="master/dosen" element={<MasterDosenPage />} />
        <Route path="verifikasi-data-diri" element={<VerifikasiDataDiriPage />} />
        <Route path="verifikasi-pengajuan-kp" element={<VerifikasiPengajuanKpPage />} />
        <Route path="pengajuan-kp" element={<Navigate to="/admin-prodi/verifikasi-pengajuan-kp" replace />} />
        <Route path="pengaturan-akademik" element={<AcademicSettingsPage />} />

        {/* Fallback rute tidak dikenal di dalam /admin-prodi selalu mengarah absolut ke /admin-prodi/dashboard */}
        <Route path="*" element={<Navigate to="/admin-prodi/dashboard" replace />} />
      </Route>

      {/* Rute Ruang Kerja Ketua Program Studi (Kaprodi) */}
      <Route path="/kaprodi" element={<ProtectedRoute role="KAPRODI"><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="/kaprodi/dashboard" replace />} />
        <Route path="dashboard" element={<PlaceholderPage />} />
        <Route path="kp/penugasan-reviewer" element={<PenugasanReviewerKpPage />} />
        <Route path="kp/finalisasi" element={<FinalisasiPembimbingKpPage />} />
        <Route path="iscp" element={<PlaceholderPage />} />
        <Route path="ta" element={<PlaceholderPage />} />
        <Route path="monitoring" element={<PlaceholderPage />} />
        <Route path="seminar" element={<PlaceholderPage />} />
        <Route path="*" element={<Navigate to="/kaprodi/dashboard" replace />} />
      </Route>

      {/* Rute Ruang Kerja Dosen Reviewer */}
      <Route path="/reviewer" element={<ProtectedRoute role="REVIEWER"><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="/reviewer/dashboard" replace />} />
        <Route path="dashboard" element={<PlaceholderPage />} />
        <Route path="review-kp" element={<Suspense fallback={<div role="status" className="p-8 text-sm text-secondary">Memuat ruang review…</div>}><ReviewKpPage /></Suspense>} />
        <Route path="review-iscp" element={<PlaceholderPage />} />
        <Route path="review-ta" element={<PlaceholderPage />} />
        <Route path="riwayat" element={<PlaceholderPage />} />
        <Route path="*" element={<Navigate to="/reviewer/dashboard" replace />} />
      </Route>

      {/* Rute Ruang Kerja Dosen Pembimbing */}
      <Route path="/pembimbing" element={<ProtectedRoute role="PEMBIMBING"><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="/pembimbing/dashboard" replace />} />
        <Route path="dashboard" element={<PlaceholderPage />} />
        <Route path="bimbingan-kp" element={<PlaceholderPage />} />
        <Route path="bimbingan-iscp" element={<PlaceholderPage />} />
        <Route path="bimbingan-ta" element={<PlaceholderPage />} />
        <Route path="acc-penyelesaian" element={<PlaceholderPage />} />
        <Route path="*" element={<Navigate to="/pembimbing/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
