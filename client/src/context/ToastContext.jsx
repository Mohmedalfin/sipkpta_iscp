import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import ToastContainer from '../components/common/ToastContainer.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message, type = 'info', options = {}) => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());
      const duration = options.duration ?? 4000;
      const title = options.title ?? null;

      const newToast = { id, message, type, title, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Maksimal 5 toast sekaligus

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  const toastMethods = useMemo(() => {
    const fn = (message, type, options) => show(message, type, options);
    fn.success = (message, options) => show(message, 'success', options);
    fn.error = (message, options) => show(message, 'error', options);
    fn.warning = (message, options) => show(message, 'warning', options);
    fn.info = (message, options) => show(message, 'info', options);
    fn.dismiss = dismiss;
    return fn;
  }, [show, dismiss]);

  return (
    <ToastContext.Provider value={toastMethods}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const fallbackToast = {
  show: () => null,
  success: (msg) => console.log('[Toast success]:', msg),
  error: (msg) => console.error('[Toast error]:', msg),
  warning: (msg) => console.warn('[Toast warning]:', msg),
  info: (msg) => console.info('[Toast info]:', msg),
  dismiss: () => {},
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return fallbackToast;
  }
  return context;
}

