import { createPortal } from 'react-dom';
import {
  IconCheckCircle,
  IconClose,
  IconExclamationCircle,
  IconExclamationTriangle,
  IconInformationCircle,
} from './Icons.jsx';

const toastStyles = {
  success: {
    container: 'bg-emerald-50/95 border-emerald-200 text-emerald-950 shadow-emerald-900/5',
    icon: <IconCheckCircle className="size-5 text-emerald-600 shrink-0 mt-0.5" />,
  },
  error: {
    container: 'bg-red-50/95 border-red-200 text-red-950 shadow-red-900/5',
    icon: <IconExclamationCircle className="size-5 text-red-600 shrink-0 mt-0.5" />,
  },
  warning: {
    container: 'bg-amber-50/95 border-amber-200 text-amber-950 shadow-amber-900/5',
    icon: <IconExclamationTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />,
  },
  info: {
    container: 'bg-blue-50/95 border-blue-200 text-blue-950 shadow-blue-900/5',
    icon: <IconInformationCircle className="size-5 text-brand shrink-0 mt-0.5" />,
  },
};

export default function ToastContainer({ toasts, onDismiss }) {
  if (typeof document === 'undefined' || toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed top-5 inset-x-4 sm:inset-x-auto sm:right-5 sm:left-auto z-[9999] flex flex-col items-center sm:items-end gap-2.5 pointer-events-none"
      aria-live="polite"
      aria-label="Pemberitahuan aplikasi"
    >
      {toasts.map((toast) => {
        const style = toastStyles[toast.type] || toastStyles.info;

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto w-full max-w-sm flex items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-xs transition-all duration-200 ease-out animate-toast-in ${style.container}`}
          >
            {style.icon}
            <div className="flex-1 min-w-0 pr-1">
              {toast.title && (
                <p className="text-xs font-bold leading-snug mb-0.5">{toast.title}</p>
              )}
              <p className="text-xs leading-relaxed font-medium">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <IconClose className="size-3" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
