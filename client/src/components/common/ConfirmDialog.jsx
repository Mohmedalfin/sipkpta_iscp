import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import {
  IconArrowLeft,
  IconCheckCircle,
  IconExclamationTriangle,
  IconInformationCircle,
  IconSignOut,
  IconSpinner,
} from './Icons.jsx';

const variantConfig = {
  danger: {
    iconBadge: 'bg-red-50 ring-8 ring-red-50/60 text-danger border border-red-100',
    mainIcon: <IconSignOut className="size-7" />,
    badgeStyle: 'bg-red-50 text-danger border border-red-200/70',
    defaultBadge: 'Konfirmasi • Tindakan Penting',
    buttonStyle: 'bg-danger hover:bg-red-700 active:bg-red-800 shadow-sm shadow-red-900/10',
    buttonIcon: <IconSignOut className="size-4 shrink-0" />,
  },
  warning: {
    iconBadge: 'bg-amber-50 ring-8 ring-amber-50/60 text-amber-600 border border-amber-100',
    mainIcon: <IconExclamationTriangle className="size-7" />,
    badgeStyle: 'bg-amber-50 text-amber-800 border border-amber-200/70',
    defaultBadge: 'Perhatian • Konfirmasi',
    buttonStyle: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 shadow-sm shadow-amber-900/10',
    buttonIcon: <IconExclamationTriangle className="size-4 shrink-0" />,
  },
  primary: {
    iconBadge: 'bg-blue-50 ring-8 ring-blue-50/60 text-brand border border-blue-100',
    mainIcon: <IconInformationCircle className="size-7" />,
    badgeStyle: 'bg-blue-50 text-brand border border-blue-200/70',
    defaultBadge: 'Informasi • SIPKITA',
    buttonStyle: 'bg-brand hover:bg-brand-hover active:bg-brand-pressed shadow-sm shadow-blue-900/10',
    buttonIcon: <IconCheckCircle className="size-4 shrink-0" />,
  },
};

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  badge,
  title = 'Konfirmasi Tindakan',
  description = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Kembali',
  variant = 'primary',
  loading = false,
  icon = null,
  confirmIcon,
  cancelIcon,
}) {
  const dialogRef = useRef(null);

  useFocusTrap(dialogRef, open, () => {
    if (!loading) onClose();
  });

  if (typeof document === 'undefined' || !open) return null;

  const config = variantConfig[variant] || variantConfig.primary;
  const badgeText = badge !== undefined ? badge : config.defaultBadge;

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      {/* Backdrop */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        disabled={loading}
        onClick={() => !loading && onClose()}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity cursor-default"
      />

      {/* Dialog Card - Styled after reference_03.jpeg */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-[460px] rounded-[28px] bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 z-10 my-8 flex flex-col items-center text-center transition-all animate-modal-in"
      >
        {/* Top Halo Icon */}
        {icon || (
          <div className={`size-16 rounded-full flex items-center justify-center mb-4 ${config.iconBadge}`}>
            {config.mainIcon}
          </div>
        )}

        {/* Pill Badge Tag */}
        {badgeText && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide mb-3 ${config.badgeStyle}`}>
            <span>{badgeText}</span>
          </div>
        )}

        {/* Heading */}
        <h2 id="confirm-dialog-title" className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
          {title}
        </h2>

        {/* Description Context */}
        <p id="confirm-dialog-description" className="mt-2.5 text-xs sm:text-sm text-secondary/80 leading-relaxed max-w-[340px]">
          {description}
        </p>

        {/* Action Buttons (side-by-side with icons like reference_03) */}
        <div className="mt-7 flex items-center justify-center gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-line bg-white hover:bg-subtle text-xs sm:text-sm font-semibold text-secondary hover:text-ink px-4 py-2.5 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelIcon !== undefined ? cancelIcon : <IconArrowLeft className="size-4 shrink-0" />}
            <span>{cancelLabel}</span>
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-bold text-white whitespace-nowrap transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 ${config.buttonStyle}`}
          >
            {loading ? (
              <IconSpinner className="size-4 shrink-0" />
            ) : (
              confirmIcon !== undefined ? confirmIcon : config.buttonIcon
            )}
            <span>{loading ? 'Memproses…' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
