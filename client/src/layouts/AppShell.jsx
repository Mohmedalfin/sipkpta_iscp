import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
import TopBar from '../components/layout/TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { authErrorMessage } from '../services/auth.js';

export default function AppShell({ children }) {
  const { session, signOut } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const drawerRef = useRef(null);

  // Close mobile drawer on route transition
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Accessible keyboard navigation (Escape & focus cycle) for mobile drawer
  useFocusTrap(drawerRef, drawerOpen, () => setDrawerOpen(false));

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      toast.success('Berhasil keluar dari akun.');
      navigate('/login', { replace: true });
    } catch (requestError) {
      toast.error(authErrorMessage(requestError, 'Gagal keluar. Coba lagi.'));
    } finally {
      setSigningOut(false);
      setConfirmSignOutOpen(false);
    }
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas">
      <a href="#main-content" className="shell-skip-link">Lewati navigasi</a>

      {/* Desktop Persistent Sidebar */}
      <aside
        className={`shell-sidebar hidden h-dvh shrink-0 flex-col lg:flex transition-[width] duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[272px]'
        }`}
        aria-label="Menu utama"
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
      </aside>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/50 backdrop-blur-xs transition-opacity"
            aria-label="Tutup menu"
            onClick={() => setDrawerOpen(false)}
            tabIndex={-1}
          />
          <aside
            ref={drawerRef}
            id="mobile-navigation"
            className="shell-sidebar relative h-dvh w-[272px] max-w-[85vw] shadow-2xl z-10 flex flex-col"
            aria-label="Menu utama"
          >
            <Sidebar onNavigate={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden bg-brand">
        {/* Top Header Bar */}
        <TopBar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          onOpenMobileDrawer={() => setDrawerOpen(true)}
          session={session}
          onSignOut={() => setConfirmSignOutOpen(true)}
          signingOut={signingOut}
        />

        {/* Content Body: Curved Frame matching reference */}
        <div className="flex-1 min-h-0 bg-brand flex flex-col">
          <main
            id="main-content"
            className="shell-main bg-grid-canvas flex-1 overflow-y-scroll [scrollbar-gutter:stable] rounded-t-[30px] lg:rounded-tr-none lg:rounded-tl-[42px] focus:outline-none shadow-sm"
            tabIndex={-1}
          >
            {children || <Outlet />}
          </main>
        </div>
      </div>

      {/* Logout Confirmation Dialog styled after reference_03.jpeg */}
      <ConfirmDialog
        open={confirmSignOutOpen}
        onClose={() => !signingOut && setConfirmSignOutOpen(false)}
        onConfirm={handleSignOut}
        badge="Autentikasi • Keluar Akun"
        title="Keluar dari Akun?"
        description="Sesi aktif Anda saat ini akan diakhiri. Anda perlu login kembali untuk mengakses layanan akademik SIPKITA."
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        variant="danger"
        loading={signingOut}
      />
    </div>
  );
}
