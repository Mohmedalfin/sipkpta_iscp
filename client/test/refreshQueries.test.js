import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { refreshQueries } from '../src/utils/refreshQueries.js';
import { canRefreshKpTracking } from '../src/utils/kpForm.js';

test('manual refresh is blocked for new forms, drafts and each administrative revision category', () => {
  assert.equal(canRefreshKpTracking(null), false);
  assert.equal(canRefreshKpTracking({ status_pengajuan: 'DRAFT' }), false);
  for (const category of ['status_pemeriksaan_berkas', 'status_pemeriksaan_akademik']) {
    assert.equal(canRefreshKpTracking({ status_pengajuan: 'DIAJUKAN', [category]: 'BELUM_OK' }), false);
  }
  assert.equal(canRefreshKpTracking({ status_pengajuan: 'DIAJUKAN' }), true);
  assert.equal(canRefreshKpTracking({ status_pengajuan: 'ACC' }), true);
});

test('repeated refresh reuses the in-flight read, preserves displayed data, and scopes invalidation', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = ['admin-kp-list', { page: 2, search: 'test' }];
  let calls = 0;
  let aborted = false;
  let release;
  client.setQueryData(key, { version: 1 });
  client.setQueryData(['unrelated'], { version: 1 });
  const observer = new QueryObserver(client, { queryKey: key, staleTime: Infinity,
    queryFn: ({ signal }) => {
      calls++;
      signal.addEventListener('abort', () => { aborted = true; });
      return new Promise((resolve) => { release = resolve; });
    } });
  const unsubscribe = observer.subscribe(() => {});
  try {
    const first = refreshQueries(client, ['admin-kp-list']);
    const second = refreshQueries(client, ['admin-kp-list']);
    assert.equal(calls, 1);
    assert.equal(aborted, false);
    assert.deepEqual(observer.getCurrentResult().data, { version: 1 });
    assert.equal(client.getQueryState(['unrelated']).isInvalidated, false);
    release({ version: 2 });
    await Promise.all([first, second]);
    assert.deepEqual(client.getQueryData(key), { version: 2 });
  } finally { unsubscribe(); observer.destroy(); client.clear(); }
});
