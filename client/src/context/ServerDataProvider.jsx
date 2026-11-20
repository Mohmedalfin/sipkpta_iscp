import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './AuthContext.jsx';
import { connectRealtime } from '../services/realtime.js';
import { isRealtimeQuery } from '../services/realtimeQueries.js';

function ScopedDataProvider({ user, children }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: {
    staleTime: 30000, gcTime: 300000, retry: 1, refetchOnWindowFocus: true,
  } } }));
  useEffect(() => {
    if (!['MAHASISWA', 'ADMIN_PRODI', 'KAPRODI', 'REVIEWER', 'PEMBIMBING'].includes(user?.activeRole)) return undefined;
    const controller = new AbortController();
    const changed = new Map();
    let refreshAll = false;
    let timer;
    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      if (document.visibilityState === 'hidden') return;
      const events = [...changed.values()];
      const all = refreshAll;
      changed.clear();
      refreshAll = false;
      // Cancel stale in-flight reads, then refetch only observed queries.
      const filters = { predicate: (query) => isRealtimeQuery(query.queryKey, all ? null : events) };
      void client.cancelQueries(filters).then(() => {
        if (!controller.signal.aborted) return client.invalidateQueries(filters);
      });
    };
    const schedule = () => { if (!timer) timer = setTimeout(flush, 250); };
    const visible = () => { if (document.visibilityState !== 'hidden' && (refreshAll || changed.size)) schedule(); };
    document.addEventListener('visibilitychange', visible);
    void connectRealtime({ signal: controller.signal, onEvent: (type, data) => {
      if (type === 'ready') { refreshAll = true; schedule(); }
      if (type === 'change' && data.schema_version === 1 &&
        ['pengajuan.review.updated', 'pengajuan.administration.updated', 'pengajuan.assignment.updated', 'bimbingan.updated', 'bimbingan.draft.updated', 'notifikasi.updated'].includes(data.type) &&
        Number.isSafeInteger(data.resource_id)) {
        changed.set(`${data.type}:${data.resource_id}`, data); schedule();
      }
    } });
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [client, user?.activeRole]);
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default function ServerDataProvider({ children }) {
  const { session } = useAuth();
  const user = session?.user;
  return <ScopedDataProvider key={user ? `${user.id}:${user.activeRole}` : 'anonymous'} user={user}>{children}</ScopedDataProvider>;
}
