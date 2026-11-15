import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { connectRealtime } from '../src/services/realtime.js';
import api from '../src/services/api.js';

function environment(t) {
  const previous = globalThis.sessionStorage;
  const session = { accessToken: 'test-token', refreshToken: 'test-refresh', user: {
    id: 1, login_id: 'test', roles: ['MAHASISWA'], activeRole: 'MAHASISWA' } };
  globalThis.sessionStorage = { getItem: () => JSON.stringify(session), removeItem() {} };
  t.after(() => { if (previous === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previous; });
  t.mock.method(globalThis, 'setInterval', () => 1);
  t.mock.method(globalThis, 'clearInterval', () => {});
  t.mock.method(globalThis, 'clearTimeout', () => {});
  t.mock.method(Math, 'random', () => 0);
  const delays = [];
  t.mock.method(globalThis, 'setTimeout', (callback, ms) => {
    delays.push(ms); queueMicrotask(callback); return 1;
  });
  return { session, delays };
}

function stream() {
  return new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('event: ready\ndata: {}\n\n'));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}

test('reconnect should increase backoff after repeated ready/immediate disconnect', async (t) => {
  const { delays } = environment(t);
  const controller = new AbortController();
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++requests === 3) controller.abort();
    return stream();
  });
  await connectRealtime({ signal: controller.signal, onEvent() {} });
  assert.deepEqual(delays, [1000, 2000]);
});

test('401 reconnect refreshes through shared API and uses new Bearer token', async (t) => {
  const { session } = environment(t);
  const controller = new AbortController();
  const headers = [];
  t.mock.method(api, 'get', async (path) => {
    assert.equal(path, '/api/auth/me'); session.accessToken = 'refreshed-test-token';
  });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    headers.push(options.headers.Authorization);
    return headers.length === 1 ? new Response('', { status: 401 }) : stream();
  });
  await connectRealtime({ signal: controller.signal, onEvent(type) { if (type === 'ready') controller.abort(); } });
  assert.deepEqual(headers, ['Bearer test-token', 'Bearer refreshed-test-token']);
});

test('403 stops reconnect rather than creating a retry loop', async (t) => {
  environment(t);
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; return new Response('', { status: 403 }); });
  await connectRealtime({ signal: new AbortController().signal, onEvent() {} });
  assert.equal(requests, 1);
});

test('disabled form query stays invalidated without fetching or replacing local cache', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let reads = 0;
  const key = ['kp-detail', 1];
  client.setQueryData(key, { status: 'BELUM_OK' });
  const observer = new QueryObserver(client, { queryKey: key, enabled: false,
    queryFn: async () => { reads++; return { status: 'UPDATED' }; } });
  const stop = observer.subscribe(() => {});
  try {
    await client.invalidateQueries({ queryKey: key });
    assert.equal(reads, 0);
    assert.deepEqual(client.getQueryData(key), { status: 'BELUM_OK' });
    assert.equal(client.getQueryState(key).isInvalidated, true);
  } finally { stop(); observer.destroy(); client.clear(); }
});

test('reconnect delay is capped and resets only after a healthy stream receives data', async (t) => {
  const { delays } = environment(t);
  const controller = new AbortController();
  let now = 0;
  let requests = 0;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    if (requests === 10) controller.abort();
    if (requests !== 8) return stream();
    let chunks = 0;
    return new Response(new ReadableStream({ pull(target) {
      if (chunks++ === 0) target.enqueue(new TextEncoder().encode('event: ready\ndata: {}\n\n'));
      else if (chunks === 2) {
        now += 60000;
        target.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
      } else target.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  });
  await connectRealtime({ signal: controller.signal, onEvent() {} });
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 30000, 30000, 1000, 2000]);
});
