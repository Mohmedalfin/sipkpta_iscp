import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { createEventParser } from '../src/services/realtime.js';
import { isRealtimeQuery } from '../src/services/realtimeQueries.js';

test('resource events invalidate only supported list/detail families', () => {
  const events = [{ type: 'pengajuan.assignment.updated', resource_id: 3 }];
  assert.equal(isRealtimeQuery(['reviewer-kp-list', {}], events), true);
  assert.equal(isRealtimeQuery(['admin-kp-list', { page: 2 }], events), true);
  assert.equal(isRealtimeQuery(['kp-reviews', 3], events), true);
  assert.equal(isRealtimeQuery(['kp-detail', 4], events), false);
  assert.equal(isRealtimeQuery(['unrelated-data', 3], events), false);
  assert.equal(isRealtimeQuery(['admin-kp-detail', 3], [{ type: 'unknown', resource_id: 3 }]), false);
});

test('SSE parser handles fragmented CRLF, multiple frames, comments and malformed JSON', () => {
  const events = [];
  const parse = createEventParser((type, data) => events.push({ type, data }));
  parse('event: ready\r');
  parse('\ndata: {}\r\n\r\n: heartbeat\n\nevent: change\ndata: {"resource_');
  parse('id":7}\n\nevent: change\ndata: invalid\n\nevent: change\ndata: {"resource_id":8}\n\n');
  assert.deepEqual(events, [{ type: 'ready', data: {} }, { type: 'change', data: { resource_id: 7 } },
    { type: 'change', data: { resource_id: 8 } }]);
});

test('query cache deduplicates reads and reconciliation can cancel stale in-flight data', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } });
  let calls = 0;
  const options = { queryKey: ['kp-reviews', 1], queryFn: async () => { calls++; return { version: 1 }; } };
  await Promise.all([client.fetchQuery(options), client.fetchQuery(options)]);
  assert.equal(calls, 1);
  await client.invalidateQueries({ queryKey: options.queryKey, refetchType: 'none' });
  await client.fetchQuery({ ...options, queryFn: async () => ({ version: 2 }) });
  assert.deepEqual(client.getQueryData(options.queryKey), { version: 2 });
  await client.invalidateQueries({ queryKey: options.queryKey, refetchType: 'none' });
  let aborted = false;
  const pending = client.fetchQuery({ ...options, queryFn: ({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('Aborted stale request.')); }, { once: true });
  }) });
  await client.cancelQueries({ queryKey: options.queryKey });
  // Cancellation with cached data reverts to that data instead of rejecting.
  assert.deepEqual(await pending, { version: 2 });
  assert.equal(aborted, true);
  await client.invalidateQueries({ queryKey: options.queryKey, refetchType: 'none' });
  await client.fetchQuery({ ...options, queryFn: async () => ({ version: 3 }) });
  assert.deepEqual(client.getQueryData(options.queryKey), { version: 3 });
  client.clear();
});

test('notification events invalidate inbox only; reconnect refreshes active notification queries', () => {
  const event = [{ type: 'notifikasi.updated', resource_id: 0 }];
  assert.equal(isRealtimeQuery(['notifications', 'count'], event), true);
  assert.equal(isRealtimeQuery(['notifications', 'list', 2], event), true);
  assert.equal(isRealtimeQuery(['kp-reviews', 3], event), false);
  assert.equal(isRealtimeQuery(['notifications', 'count'], null), true);
});
