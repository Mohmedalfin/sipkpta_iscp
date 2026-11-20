import { useRef, useState } from 'react';
import { IconRefresh } from './Icons.jsx';

export default function RefreshButton({ onRefresh, refreshing = false, disabled = false,
  title = 'Segarkan data' }) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const busy = refreshing || pending;
  async function refresh() {
    if (disabled || busy || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try { await onRefresh?.(); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <button type="button" onClick={refresh} disabled={disabled || busy}
    aria-busy={busy} aria-label={title} title={title}
    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-900/[0.12] bg-white px-3 text-xs font-semibold text-secondary shadow-none transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50">
    <IconRefresh className={`size-3.5 ${busy ? 'motion-safe:animate-spin text-brand' : ''}`} />
    <span className="hidden sm:inline">Segarkan Data</span>
  </button>;
}
