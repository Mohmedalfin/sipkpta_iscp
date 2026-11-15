import { useEffect, useRef, useState } from 'react';
import { IconChevronDown } from '../../common/Icons.jsx';

/**
 * SettingsDropdownFilter
 * Komponen dropdown filter kustom berstandar SIPKITA (mengikuti MahasiswaToolbar).
 * Mendukung pencarian, status aktif, ikon kustom, dan penanganan klik di luar.
 */
export default function SettingsDropdownFilter({
  value,
  options = [],
  onChange,
  icon: Icon = null,
  placeholder = 'Semua',
  className = '',
  minWidth = 'min-w-[150px]',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Cari label dari opsi yang sedang terpilih
  const selectedOpt = options.find((opt) => {
    const val = typeof opt === 'object' && opt !== null ? opt.value : opt;
    return String(val) === String(value);
  });

  const displayLabel = value
    ? (typeof selectedOpt === 'object' && selectedOpt !== null ? selectedOpt.label : selectedOpt) || placeholder
    : placeholder;

  const isSelected = Boolean(value);

  return (
    <div ref={ref} className={`relative shrink-0 ${minWidth} ${className} ${open ? 'z-40' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border pl-3 pr-2.5 py-2 text-xs font-medium transition-colors cursor-pointer select-none ${
          open
            ? 'border-brand ring-2 ring-brand/20 bg-white text-ink shadow-xs'
            : isSelected
            ? 'border-brand/40 bg-brand-soft/60 text-brand font-semibold hover:bg-brand-soft'
            : 'border-slate-900/[0.12] bg-white/80 text-ink hover:bg-white hover:border-slate-900/[0.2]'
        }`}
        title={displayLabel}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <Icon
              className={`size-3.5 shrink-0 transition-colors ${
                isSelected || open ? 'text-brand' : 'text-muted'
              }`}
            />
          )}
          <span className="truncate">{displayLabel}</span>
        </div>
        <IconChevronDown
          className={`size-3.5 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-brand' : 'text-muted'
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1.5 min-w-full rounded-xl border border-slate-900/[0.08] bg-white p-1 shadow-xl text-xs space-y-0.5 max-h-56 overflow-y-auto"
        >
          {options.map((opt, idx) => {
            const optVal = typeof opt === 'object' && opt !== null ? opt.value : opt;
            const optLabel = typeof opt === 'object' && opt !== null ? opt.label : opt;
            const isOptSelected = String(optVal) === String(value);

            return (
              <button
                key={idx}
                type="button"
                role="option"
                aria-selected={isOptSelected}
                onClick={() => {
                  onChange(optVal);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  isOptSelected
                    ? 'bg-brand-soft text-brand font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <span className="truncate">{optLabel}</span>
                {isOptSelected && <span className="text-brand font-bold text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

