import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import BrandMark from '../auth/BrandMark.jsx';
import {
  IconChevronDoubleLeft,
  IconChevronDoubleRight,
  IconChevronDown,
  IconChevronRight,
  IconClose,
} from '../common/Icons.jsx';
import {
  ADMIN_PRODI_NAVIGATION,
  KAPRODI_NAVIGATION,
  MAHASISWA_NAVIGATION,
  PEMBIMBING_NAVIGATION,
  REVIEWER_NAVIGATION,
} from '../../config/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Sidebar({ onNavigate, collapsed = false, onToggleCollapse, onClose, navigation }) {
  const location = useLocation();
  const { session } = useAuth();

  const role = session?.user?.activeRole;
  const navList =
    navigation ||
    (role === 'ADMIN_PRODI'
      ? ADMIN_PRODI_NAVIGATION
      : role === 'KAPRODI'
      ? KAPRODI_NAVIGATION
      : role === 'REVIEWER'
      ? REVIEWER_NAVIGATION
      : role === 'PEMBIMBING'
      ? PEMBIMBING_NAVIGATION
      : MAHASISWA_NAVIGATION);

  // Smart initial state: open section only if current route matches one of its prefixes, otherwise closed
  const [openSections, setOpenSections] = useState(() => {
    const initialState = {};
    navList.forEach((group) => {
      group.items.forEach((item) => {
        if (item.type === 'accordion') {
          const isCurrentActive = item.activePrefixes?.some((prefix) => location.pathname.startsWith(prefix));
          initialState[item.key] = Boolean(isCurrentActive);
        }
      });
    });
    return initialState;
  });

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Sinkronisasi status akordion saat rute berpindah atau peran berubah
  useEffect(() => {
    navList.forEach((group) => {
      group.items.forEach((item) => {
        if (item.type === 'accordion') {
          const isCurrentActive = item.activePrefixes?.some((prefix) => location.pathname.startsWith(prefix));
          if (isCurrentActive) {
            setOpenSections((prev) => ({ ...prev, [item.key]: true }));
          }
        }
      });
    });
  }, [location.pathname, navList]);

  return (
    <div className={`flex h-full flex-col bg-brand text-white select-none overflow-hidden transition-[width] duration-300 ease-in-out ${collapsed ? 'w-[76px]' : 'w-[272px]'}`}>
      {/* Sidebar Header: Brand & Collapse Button */}
      <div className="flex h-16 items-center justify-between px-3.5 shrink-0 gap-2">
        {!collapsed ? (
          <>
            <div className="min-w-0 flex-1 overflow-hidden">
              <BrandMark inverse compact />
            </div>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                title="Sembunyikan sidebar"
                aria-label="Sembunyikan sidebar"
              >
                <IconChevronDoubleLeft className="size-3.5" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex lg:hidden size-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
                aria-label="Tutup navigasi"
              >
                <IconClose className="size-4" />
              </button>
            )}
          </>
        ) : (
          <div className="w-full flex items-center justify-center">
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="size-8 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
                title="Perluas sidebar"
                aria-label="Perluas sidebar"
              >
                <IconChevronDoubleRight className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Navigation Menu Items */}
      <nav
        className="flex-1 min-h-0 overflow-y-auto sidebar-scroll px-3 py-4 space-y-4 text-sm"
        aria-label={`Navigasi ${role ? role.toLowerCase().replace('_', ' ') : 'utama'}`}
      >
        {navList.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-200/80">
                {group.group}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const ItemIcon = item.icon;

                // Direct Navigation Link Item
                if (item.type === 'link') {
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `group flex items-center ${item.hasChevron && !collapsed ? 'justify-between' : 'gap-3'} rounded-lg px-3 py-2.5 text-sm font-medium leading-5 transition-colors duration-150 ${
                          isActive
                            ? 'bg-white text-[#2F5FC3] font-semibold shadow-xs'
                            : 'text-white/90 hover:bg-white/12 hover:text-white'
                        } ${collapsed ? 'justify-center px-0' : ''}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className={`flex items-center gap-3 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
                            <ItemIcon className={`size-5 shrink-0 ${isActive ? 'text-[#2F5FC3]' : 'text-white/80 group-hover:text-white'}`} />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                          </div>
                          {item.hasChevron && !collapsed && (
                            <span className="shrink-0" aria-hidden="true">
                              <IconChevronRight className="size-4 text-white/50 group-hover:text-white/80" />
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                }

                // Accordion Section with Submenu
                if (item.type === 'accordion') {
                  const isSectionActive = item.activePrefixes?.some((prefix) => location.pathname.startsWith(prefix));
                  const isOpen = Boolean(openSections[item.key]);

                  return (
                    <div key={item.key}>
                      <button
                        type="button"
                        onClick={() => toggleSection(item.key)}
                        title={collapsed ? item.label : undefined}
                        aria-expanded={isOpen}
                        className={`w-full group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium leading-5 text-white/90 hover:bg-white/12 hover:text-white transition-colors duration-150 cursor-pointer ${
                          collapsed ? 'justify-center px-0' : ''
                        } ${isSectionActive && !isOpen ? 'bg-white/20 text-white font-semibold' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ItemIcon className="size-5 shrink-0 text-white/80 group-hover:text-white" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!collapsed && (
                          <span className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                            <IconChevronDown className="size-4 text-white/70" />
                          </span>
                        )}
                      </button>

                      {/* Submenu Content with Tree Connector Lines */}
                      {isOpen && !collapsed && (
                        <div className="mt-1 ml-[21px] space-y-1">
                          {item.children.map((child, index) => {
                            const isFirst = index === 0;
                            const isLast = index === item.children.length - 1;
                            const ChildIcon = child.icon;

                            return (
                              <div key={child.to} className="relative flex items-center">
                                {/* Vertical tree line connector */}
                                <span
                                  className={`absolute left-0 w-px bg-white/25 ${
                                    isFirst
                                      ? '-top-1 h-[calc(100%+4px)]'
                                      : isLast
                                      ? 'top-0 h-1/2'
                                      : 'top-0 h-full'
                                  }`}
                                  aria-hidden="true"
                                />
                                {/* Horizontal branch connector */}
                                <span className="absolute left-0 top-1/2 w-3.5 h-px bg-white/25" aria-hidden="true" />

                                {/* Submenu NavLink Pill */}
                                <NavLink
                                  to={child.to}
                                  onClick={onNavigate}
                                  className={({ isActive }) =>
                                    `group ml-3.5 flex-1 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs leading-4 transition-colors duration-150 ${
                                      isActive
                                        ? 'bg-white text-[#2F5FC3] font-semibold shadow-xs'
                                        : 'text-blue-100 hover:bg-white/12 hover:text-white font-medium'
                                    }`
                                  }
                                >
                                  {({ isActive }) => (
                                    <>
                                      <ChildIcon className={`size-4 shrink-0 ${isActive ? 'text-[#2F5FC3]' : 'text-blue-200 group-hover:text-white'}`} />
                                      <span className="truncate">{child.label}</span>
                                    </>
                                  )}
                                </NavLink>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className={`p-3.5 border-t border-white/15 shrink-0 ${collapsed ? 'text-center' : ''}`}>
        {!collapsed ? (
          <div className="flex items-center justify-between text-xs text-blue-100/80">
            <span className="font-semibold tracking-wide">
              {session?.user?.activeRole === 'ADMIN_PRODI' ? 'SIPKITA • ADMIN' : 'SIPKITA UTY'}
            </span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white">v1.0</span>
          </div>
        ) : (
          <span className="text-[10px] font-bold text-white/70">v1.0</span>
        )}
      </div>
    </div>
  );
}
