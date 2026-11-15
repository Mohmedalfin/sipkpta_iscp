import { useEffect, useRef } from 'react';

/**
 * Traps keyboard focus within an element and handles Escape key dismiss.
 * Menggunakan ref untuk onClose agar perubahan referensi fungsi tidak menyebabkan
 * effect dijalankan ulang pada setiap keystroke/re-render di dalam modal.
 *
 * @param {import('react').RefObject} containerRef - Container to trap focus inside.
 * @param {boolean} isActive - Whether the trap is currently active.
 * @param {() => void} onClose - Callback invoked when Escape key is pressed.
 */
export function useFocusTrap(containerRef, isActive, onClose) {
  const onCloseRef = useRef(onClose);

  // Selalu perbarui referensi onClose terbaru tanpa memicu re-run effect utama
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isActive) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Berikan fokus awal hanya jika belum ada elemen di dalam kontainer yang aktif
    if (!containerRef.current?.contains(document.activeElement)) {
      const autofocusEl = containerRef.current?.querySelector('[autofocus]');
      if (autofocusEl) {
        autofocusEl.focus();
      } else {
        const firstFocusable = containerRef.current?.querySelector(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(
        containerRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      );

      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, isActive]);
}
