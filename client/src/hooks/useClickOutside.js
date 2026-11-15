import { useEffect } from 'react';

/**
 * Triggers callback when a click occurs outside the referenced DOM element.
 * @param {import('react').RefObject} ref - Ref to the element to observe.
 * @param {() => void} handler - Callback to invoke on outside click.
 */
export function useClickOutside(ref, handler) {
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler]);
}

