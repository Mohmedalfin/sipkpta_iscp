import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconChevronDown,
  IconClose,
  IconSearch,
} from './Icons.jsx';

/**
 * Komponen Dropdown Kustom SIPKITA
 * Menggunakan React Portal & fixed positioning untuk mencegah pergeseran layout (layout shift),
 * terpotongnya dropdown akibat overflow-hidden/auto, dan konflik z-index pada modal.
 *
 * @param {object} props
 * @param {string} [props.id] - ID elemen input
 * @param {string|number} props.value - Nilai terpilih saat ini
 * @param {Array<{value: string|number, label: string, subtitle?: string, disabled?: boolean}>} props.options - Daftar opsi
 * @param {Function} props.onChange - Handler saat opsi dipilih (value)
 * @param {string} [props.placeholder] - Placeholder saat belum ada nilai
 * @param {boolean} [props.disabled] - Status nonaktif
 * @param {boolean} [props.hasError] - Status error validasi
 * @param {boolean} [props.searchable] - Tampilkan input pencarian jika opsi banyak (default: true jika opsi > 5)
 * @param {React.ComponentType} [props.icon] - Ikon di sisi kiri tombol
 * @param {string} [props.className] - Kelas tambahan untuk wrapper
 */
export default function CustomSelect({
  id,
  value,
  options = [],
  onChange,
  placeholder = 'Pilih salah satu...',
  disabled = false,
  hasError = false,
  searchable,
  icon: Icon = null,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState(null);

  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Perbarui koordinat dan arah buka dropdown
  useEffect(() => {
    if (!open) return;

    function updateCoords() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();

      // Cek apakah tombol masih terlihat di viewport
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const estimatedMenuHeight = 240; // max-h-60
      const openUpwards = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

      setCoords({
        top: openUpwards ? 'auto' : `${rect.bottom + 4}px`,
        bottom: openUpwards ? `${window.innerHeight - rect.top + 4}px` : 'auto',
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      });
    }

    updateCoords();

    function handleClickOutside(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('resize', updateCoords);
    // Gunakan capture phase untuk mendeteksi scroll pada kontainer modal
    window.addEventListener('scroll', updateCoords, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Fokuskan input pencarian saat dropdown terbuka
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!open) {
      setSearchTerm('');
    }
  }, [open]);

  // Cari objek opsi terpilih
  const selectedOpt = options.find((opt) => {
    const optVal = typeof opt === 'object' && opt !== null ? opt.value : opt;
    return String(optVal) === String(value);
  });

  const displayLabel = value
    ? (typeof selectedOpt === 'object' && selectedOpt !== null ? selectedOpt.label : selectedOpt) || placeholder
    : placeholder;

  const isSelected = value !== '' && value !== null && value !== undefined;

  // Filter opsi berdasarkan pencarian
  const isSearchActive = searchable !== undefined ? searchable : options.length > 5;
  const filteredOptions = isSearchActive && searchTerm.trim()
    ? options.filter((opt) => {
        const label = typeof opt === 'object' && opt !== null ? opt.label : String(opt);
        const sub = typeof opt === 'object' && opt !== null ? opt.subtitle || '' : '';
        const searchTarget = `${label} ${sub}`.toLowerCase();
        return searchTarget.includes(searchTerm.toLowerCase());
      })
    : options;

  // Cek apakah options sudah memiliki opsi kosong manual
  const hasExplicitEmptyOption = options.some((opt) => {
    const optVal = typeof opt === 'object' && opt !== null ? opt.value : opt;
    return optVal === '' || optVal === null || optVal === undefined;
  });

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Tombol Pemicu Dropdown */}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={hasError}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border pl-3 pr-2.5 py-2 text-xs font-medium transition cursor-pointer select-none focus:outline-hidden ${
          hasError
            ? 'border-danger bg-white text-ink ring-2 ring-danger/20'
            : open
            ? 'border-brand ring-2 ring-brand/20 bg-white text-ink shadow-xs'
            : isSelected
            ? 'border-brand/40 bg-brand-soft/60 text-brand font-semibold hover:bg-brand-soft'
            : 'border-slate-900/[0.12] bg-white/80 text-ink hover:bg-white hover:border-slate-900/[0.2]'
        } ${disabled ? 'cursor-not-allowed bg-subtle text-secondary opacity-75' : ''}`}
        title={isSelected ? displayLabel : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <Icon
              className={`size-4 shrink-0 transition-colors ${
                isSelected || open ? 'text-brand' : 'text-muted'
              }`}
            />
          )}
          <span className={`truncate ${!isSelected ? 'text-muted font-normal' : 'text-ink'}`}>
            {displayLabel}
          </span>
        </div>

        <IconChevronDown
          className={`size-4 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-brand' : 'text-muted'
          }`}
        />
      </button>

      {/* Menu Pilihan Popup via Portal ke Document Body (Anti-Clipped & Anti-Layout Shift) */}
      {open &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              width: coords.width,
              zIndex: 99999,
            }}
            className="rounded-xl border border-slate-900/[0.12] bg-white p-1.5 shadow-2xl text-xs sm:text-sm space-y-1 max-h-60 overflow-y-auto animate-in fade-in duration-100"
          >
            {/* Kolom Pencarian Cepat (Bila Opsi Banyak) */}
            {isSearchActive && (
              <div className="relative mb-1 border-b border-line pb-1.5 px-1">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari pilihan..."
                  className="w-full rounded-md border border-line bg-subtle/40 pl-8 pr-7 py-1 text-xs text-ink placeholder:text-muted focus:border-brand focus:bg-white focus:outline-hidden"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
                  >
                    <IconClose className="size-3" />
                  </button>
                )}
              </div>
            )}

            {/* Opsi Kosong (Hanya jika belum ada opsi manual dengan value '') */}
            {!hasExplicitEmptyOption && (
              <button
                type="button"
                role="option"
                aria-selected={!isSelected}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition cursor-pointer text-xs ${
                  !isSelected
                    ? 'bg-brand-soft text-brand font-semibold'
                    : 'text-muted hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <span>-- {placeholder} --</span>
                {!isSelected && <span className="text-brand font-bold">✓</span>}
              </button>
            )}

            {/* Daftar Opsi Terfilter */}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const optVal = typeof opt === 'object' && opt !== null ? opt.value : opt;
                const optLabel = typeof opt === 'object' && opt !== null ? opt.label : opt;
                const optSub = typeof opt === 'object' && opt !== null ? opt.subtitle : null;
                const optDisabled = Boolean(typeof opt === 'object' && opt !== null && opt.disabled);
                const isOptSelected = String(optVal) === String(value);

                return (
                  <button
                    key={idx}
                    type="button"
                    role="option"
                    disabled={optDisabled}
                    aria-selected={isOptSelected}
                    onClick={() => {
                      if (optDisabled) return;
                      onChange(optVal);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left transition ${
                      optDisabled
                        ? 'cursor-not-allowed opacity-50 bg-slate-50 text-muted'
                        : isOptSelected
                        ? 'bg-brand-soft text-brand font-semibold cursor-pointer'
                        : 'text-ink hover:bg-slate-100 cursor-pointer'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate text-xs sm:text-sm">{optLabel}</p>
                      {optSub && (
                        <p className="text-[11px] text-muted truncate">{optSub}</p>
                      )}
                    </div>
                    {isOptSelected && (
                      <span className="text-brand font-bold text-xs shrink-0">✓</span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-muted">
                Tidak ada pilihan yang sesuai "{searchTerm}".
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
