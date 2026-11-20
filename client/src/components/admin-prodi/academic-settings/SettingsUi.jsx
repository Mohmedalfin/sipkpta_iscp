import RefreshButton from '../../common/RefreshButton.jsx';
import { ListSkeleton } from '../../common/TableSkeletonRows.jsx';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  IconChevronDown,
  IconClose,
  IconExclamationCircle,
  IconSpinner,
} from '../../common/Icons.jsx';
import boxIcon from '../../../assets/NoBackground Box.svg';
import { useFocusTrap } from '../../../hooks/useFocusTrap.js';
import AdminPagination from '../shared/AdminPagination.jsx';

export const inputClass =
  'w-full rounded-xl border border-slate-900/[0.12] bg-white/90 px-3.5 py-2 text-xs text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all';

export const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-50 active:bg-slate-100 px-3.5 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-4 py-2 text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Format tanggal Indonesia (contoh: 1 September 2026)
 */
export function formatDateIndo(dateStr) {
  if (!dateStr) return '—';
  try {
    const raw = String(dateStr).slice(0, 10);
    const d = new Date(raw + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Format tanggal dan waktu WIB (contoh: 10 Nov 2026, 08.00 WIB)
 */
export function formatDateTimeWib(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return (
      new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d) + ' WIB'
    );
  } catch {
    return dateStr;
  }
}

/**
 * Header section untuk setiap panel pengaturan akademik.
 */
export function SectionHeader({
  title,
  description,
  onAdd,
  addLabel = 'Tambah Data',
  onRefresh,
  refreshing = false,
  badgeCount = null,
  kicker = 'PENGATURAN',
  children,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-900/[0.06] min-h-[56px]">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
            {kicker}
          </span>
          {badgeCount !== null && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-secondary">
              {badgeCount}
            </span>
          )}
        </div>
        <h2 className="text-base sm:text-lg font-bold text-ink leading-tight mt-0.5">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs text-secondary max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
        {children}
        {onRefresh && (
          <RefreshButton onRefresh={onRefresh} refreshing={refreshing} />
        )}
        {onAdd && (
          <button type="button" onClick={onAdd} className={primaryButton}>
            <span>+</span>
            <span>{addLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * State feedback: loading skeleton / error banner / empty state.
 */
export function ListState({ loading, error, empty, emptyTitle = 'Belum ada data', emptyMessage = 'Belum ada data konfigurasi untuk filter yang dipilih.', onRetry }) {
  if (loading) return <ListSkeleton />;

  if (error) {
    return (
      <div className="rounded-[18px] border border-rose-200 bg-rose-50/80 p-5 flex items-start gap-3.5" role="alert">
        <IconExclamationCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-rose-900">Gagal Memuat Konfigurasi</p>
          <p className="text-xs text-rose-800/90 mt-0.5 leading-relaxed">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-rose-900 hover:text-rose-950 underline cursor-pointer"
            >
              Coba lagi
            </button>
          )}
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-[18px] border border-dashed border-slate-900/[0.12] bg-white/70 p-8 text-center flex flex-col items-center justify-center gap-2" role="status">
        <div className="size-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          <IconExclamationCircle className="size-5" />
        </div>
        <p className="text-xs font-bold text-ink mt-1">{emptyTitle}</p>
        <p className="text-xs text-secondary max-w-sm">{emptyMessage}</p>
      </div>
    );
  }

  return null;
}

/**
 * Paginator kontrol data.
 */
export function Pager({ pagination, onPage, unit }) {
  return <AdminPagination pagination={pagination} onPageChange={onPage} unit={unit} />;
}

/**
 * Modal form terstandarisasi dengan header ikon NoBackground Box.svg.
 */
export function FormDialog({
  title,
  subtitle,
  open,
  onClose,
  onSubmit,
  busy,
  error,
  children,
  submitLabel = 'Simpan Konfigurasi',
  cancelLabel = 'Batal',
  maxWidth = 'max-w-xl',
}) {
  const dialogRef = useRef(null);

  useFocusTrap(dialogRef, open, () => {
    if (!busy) onClose();
  });

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs animate-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <section
        ref={dialogRef}
        className={`relative w-full ${maxWidth} max-h-[92vh] rounded-[22px] border border-slate-900/[0.12] bg-white flex flex-col overflow-hidden shadow-2xl text-ink`}
      >
        {/* ================= 1. HEADER MODAL (Clean tanpa kicker) ================= */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-white/80 border-b border-slate-900/[0.08] shrink-0">
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <img
              src={boxIcon}
              alt=""
              className="size-11 sm:size-12 shrink-0 select-none pointer-events-none object-contain"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2
                id="settings-dialog-title"
                className="text-base font-bold text-ink leading-tight truncate"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-muted mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup formulir"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
            title="Tutup formulir (Esc)"
          >
            <IconClose className="size-4.5" />
          </button>
        </div>

        {/* ================= 2. ISI FORMULIR (SCROLLABLE) ================= */}
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-[14px] border border-rose-200 bg-rose-50/80 p-3.5 flex items-start gap-3 text-xs text-rose-800"
              >
                <IconExclamationCircle className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Terjadi Kesalahan</p>
                  <p className="mt-0.5 leading-relaxed">{error}</p>
                </div>
              </div>
            )}
            {children}
          </div>

          {/* ================= 3. FOOTER AKSI ================= */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-900/[0.08] bg-slate-50/80 px-5 sm:px-6 py-3.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <>
                  <IconSpinner className="size-3.5 animate-spin" />
                  <span>Menyimpan…</span>
                </>
              ) : (
                <span>{submitLabel}</span>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}

/**
 * Reusable input field dengan label, chevron pada select, dan pesan bantuan.
 */
export function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  disabled = false,
  children,
  min,
  max,
  maxLength,
  placeholder,
  helperText,
  error,
  autoFocus = false,
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs font-semibold text-slate-700 mb-1">
        <span>{label}</span>
        {required && <span className="text-rose-500 font-bold"> *</span>}
      </label>
      {children ? (
        <div className="relative">
          <select
            id={name}
            name={name}
            value={value ?? ''}
            onChange={onChange}
            required={required}
            disabled={disabled}
            className={`${inputClass} appearance-none pr-9 cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
              error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''
            }`}
          >
            {children}
          </select>
          <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
        </div>
      ) : (
        <input
          id={name}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          type={type}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          min={min}
          max={max}
          maxLength={maxLength}
          placeholder={placeholder}
          className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
            error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''
          }`}
        />
      )}
      {error ? (
        <p className="text-[11px] text-rose-600 mt-1 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[10px] text-muted mt-1 leading-normal">{helperText}</p>
      ) : null}
    </div>
  );
}
