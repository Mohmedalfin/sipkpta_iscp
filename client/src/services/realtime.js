import api from './api.js';
import { getSession } from './session.js';

export function createEventParser(onEvent) {
  let buffer = '';
  return (text) => {
    buffer = (buffer + text).replace(/\r\n/g, '\n');
    if (buffer.length > 65536) throw new Error('Event stream exceeds limit.');
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const lines = frame.split('\n');
      const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
      const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
      if (type && data) {
        try { onEvent(type, JSON.parse(data)); } catch { /* Ignore malformed events. */ }
      }
    }
  };
}

function pause(ms, signal) {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}

export async function connectRealtime({ signal, onEvent }) {
  let failures = 0;
  while (!signal.aborted) {
    const connection = new AbortController();
    const abort = () => connection.abort();
    signal.addEventListener('abort', abort, { once: true });
    let lastFrame = Date.now();
    const watchdog = setInterval(() => { if (Date.now() - lastFrame > 45000) connection.abort(); }, 5000);
    try {
      const token = getSession()?.accessToken;
      if (!token || signal.aborted) return;
      const response = await fetch(`${api.defaults.baseURL}/api/realtime/events`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: connection.signal, cache: 'no-store',
      });
      if (response.status === 401) {
        // Axios performs the shared token refresh; no token is placed in a URL.
        await api.get('/api/auth/me', { signal });
        throw new Error('Reconnect with refreshed session.');
      }
      if (response.status === 403) return;
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Stream unavailable.');
      const connectedAt = Date.now();
      const parse = createEventParser(onEvent);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (!signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          lastFrame = Date.now();
          // A ready frame alone does not prove the connection is stable.
          if (lastFrame - connectedAt >= 60000) failures = 0;
          parse(decoder.decode(value, { stream: true }));
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } catch { /* Bounded reconnect; REST and periodic reconciliation remain available. */ }
    finally {
      connection.abort();
      clearInterval(watchdog);
      signal.removeEventListener('abort', abort);
    }
    if (!signal.aborted) await pause(Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)) + Math.random() * 500, signal);
  }
}
