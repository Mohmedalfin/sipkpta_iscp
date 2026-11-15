import { useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  IconAcademicCap,
  IconCheckCircle,
  IconChevronRight,
  IconHome,
  IconMenu,
  IconSignOut,
  IconSpinner,
} from '../common/Icons.jsx';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import NotificationBell from './NotificationBell.jsx';
import { getBreadcrumb } from '../../config/navigation.js';
import { getRoleMeta } from '../auth/RolePicker.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { authErrorMessage } from '../../services/auth.js';

export default function TopBar({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileDrawer,
  session,
  onSignOut,
  signingOut = false,
}) {
  const { chooseRole } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(null);

  const profileDropdownRef = useRef(null);

  // Accessible click-outside handlers
  useClickOutside(profileDropdownRef, () => setProfileDropdownOpen(false));

  const activeRole = session?.user?.activeRole || 'MAHASISWA';
  const roleMeta = getRoleMeta(activeRole);

  const userRoles = session?.user?.roles || (session?.user?.activeRole ? [session.user.activeRole] : []);
  const hasMultipleRoles = userRoles.length > 1;

  const displayName = session?.user?.nama_tampilan || session?.user?.login_id || roleMeta.label;
  const loginId = session?.user?.login_id || '-';
  const userInitials = displayName
    ? displayName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const location = useLocation();
  const crumbs = getBreadcrumb(location.pathname);
  const isHome = crumbs.length === 1 && crumbs[0].isHome;

  const handleSignOutClick = () => {
    setProfileDropdownOpen(false);
    if (onSignOut) onSignOut();
  };

  /**
   * Mengganti peran aktif sesi secara langsung tanpa harus logout
   */
  const handleSwitchRole = async (targetRole) => {
    if (targetRole === activeRole || switchingRole) return;
    setSwitchingRole(targetRole);
    try {
      await chooseRole(targetRole);
      const targetMeta = getRoleMeta(targetRole);
      toast.success(`Beralih ke ruang kerja ${targetMeta.label}.`);
      setProfileDropdownOpen(false);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = authErrorMessage(err, 'Gagal mengganti peran aktif.');
      toast.error(msg);
    } finally {
      setSwitchingRole(null);
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between bg-brand px-4 sm:px-6 text-white z-20">
      {/* Header Left: Toggle & Breadcrumb */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="grid lg:hidden size-9 place-items-center rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Buka menu navigasi"
          onClick={onOpenMobileDrawer}
        >
          <IconMenu className="size-5" />
        </button>

        {/* Desktop Sembunyikan/Tampilkan Toggle Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden lg:inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label={sidebarCollapsed ? 'Tampilkan navigasi' : 'Sembunyikan navigasi'}
        >
          <IconMenu className="size-4 text-white/80" />
          <span>{sidebarCollapsed ? 'Tampilkan' : 'Sembunyikan'}</span>
        </button>

        {/* Subtle separator on desktop */}
        <span className="hidden sm:inline-block h-4 w-px bg-white/20 shrink-0" aria-hidden="true" />

        {/* Dynamic Location Indicator (Breadcrumb) */}
        <nav aria-label="Lokasi halaman" className="flex items-center gap-1.5 text-xs text-white/90 min-w-0">
          {isHome ? (
            <span className="inline-flex items-center gap-1.5 font-bold text-white">
              <IconHome className="size-3.5 text-white/80 shrink-0" />
              <span>Beranda</span>
            </span>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              {crumbs.map((crumb, idx) => {
                const isLast = idx === crumbs.length - 1;
                return (
                  <span key={idx} className="flex items-center gap-1.5 min-w-0">
                    {idx > 0 && (
                      <IconChevronRight className="size-3 text-white/50 shrink-0" aria-hidden="true" />
                    )}
                    <span
                      className={`truncate ${
                        isLast ? 'font-bold text-white' : 'text-white/75'
                      }`}
                    >
                      {crumb.label}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </nav>
      </div>

      {/* Header Right: Notification Bell & Profile Dropdown */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <NotificationBell session={session} />

        <div className="h-5 w-px bg-white/25" aria-hidden="true" />

        {/* Profile Chip & Dropdown Menu */}
        <div ref={profileDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileDropdownOpen((prev) => !prev)}
            className="group flex items-center gap-2.5 rounded-lg p-1.5 sm:px-2.5 text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-expanded={profileDropdownOpen}
            aria-label="Menu profil pengguna"
          >
            {/* User Avatar Circle with Initials */}
            <span className="relative flex size-8.5 items-center justify-center rounded-full bg-white text-[#2F5FC3] font-black text-xs shadow-2xs">
              {userInitials}
              <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-400 ring-2 ring-white" aria-hidden="true" />
            </span>

            {/* Name & Role Text (Dinamis untuk semua peran) */}
            <div className="hidden sm:block text-left min-w-0">
              <span className="block text-xs font-bold text-white truncate max-w-[140px]">
                {displayName}
              </span>
              <span className="block text-[10px] text-blue-100/80 font-medium truncate">
                {roleMeta.shortLabel} • SI
              </span>
            </div>

            <svg
              className={`size-3.5 text-white/80 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Profile Dropdown Menu (Mendukung Switch Role jika memiliki multiple roles) */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-line bg-white p-2 shadow-xl z-50 text-ink">
              {/* Header Info Akun */}
              <div className="px-3 py-2.5 border-b border-line">
                <p className="text-xs font-bold text-ink truncate">{displayName}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                  <span className="text-[11px] font-semibold text-brand">
                    {roleMeta.label}
                  </span>
                </div>
                <p className="text-[10px] text-muted font-mono mt-0.5 truncate">
                  ID: {loginId}
                </p>
              </div>

              {/* Submenu Ganti Peran (Hanya tampil jika akun memiliki > 1 peran) */}
              {hasMultipleRoles && (
                <div className="py-2 border-b border-line px-1">
                  <div className="px-2 pb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
                    <span>Ganti Ruang Kerja / Peran</span>
                    <span className="text-[9px] font-mono text-secondary">{userRoles.length} Peran Tersedia</span>
                  </div>

                  <div className="space-y-1">
                    {userRoles.map((roleCode) => {
                      const itemMeta = getRoleMeta(roleCode);
                      const ItemIcon = itemMeta.icon;
                      const isActive = roleCode === activeRole;
                      const isSwitchingThis = switchingRole === roleCode;

                      return (
                        <button
                          key={roleCode}
                          type="button"
                          disabled={isActive || Boolean(switchingRole)}
                          onClick={() => handleSwitchRole(roleCode)}
                          className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all ${
                            isActive
                              ? 'bg-blue-50/80 text-brand font-semibold cursor-default border border-blue-200/60'
                              : 'text-ink hover:bg-subtle/80 hover:text-brand cursor-pointer'
                          } ${switchingRole && !isSwitchingThis ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`size-7 rounded-lg border flex items-center justify-center shrink-0 ${
                                isActive
                                  ? 'bg-white border-blue-200 text-brand'
                                  : 'bg-subtle/70 border-line text-muted'
                              }`}
                            >
                              <ItemIcon className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <span className="block text-xs truncate leading-snug">
                                {itemMeta.label}
                              </span>
                              <span className="block text-[10px] text-muted truncate">
                                {itemMeta.shortLabel}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isSwitchingThis ? (
                              <IconSpinner className="size-3.5 text-brand animate-spin" />
                            ) : isActive ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold">
                                <IconCheckCircle className="size-2.5 text-emerald-600" />
                                Aktif
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted font-medium hover:text-brand">
                                Pilih
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Footer: Tombol Keluar */}
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={handleSignOutClick}
                  disabled={signingOut}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-danger hover:bg-red-50 transition-colors cursor-pointer text-xs font-semibold"
                >
                  <IconSignOut className="size-4 text-danger shrink-0" />
                  <span>
                    {signingOut ? 'Keluar dari akun…' : 'Keluar dari Akun'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
