import { serializable } from '../src/services/pengajuan-kp.service.js';
import { createNotifikasi } from '../src/services/notifikasi.service.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRealtimeRoutes } from '../src/routes/realtime.routes.js';
import { afterKpChange, canReceiveKpEvent, publishNotificationChanges, publishReviewChanges, subscribeToUser } from '../src/services/realtime.service.js';
import { signAccessToken } from '../src/security/jwt.js';

test('event bus routes only to owner; unsubscribe and failed subscriber do not break publication', async () => {
  const received = [];
  const foreign = [];
  const cleanup = [subscribeToUser(1, (event) => received.push(event)),
    subscribeToUser(1, () => { throw new Error('Disconnected'); }), subscribeToUser(2, (event) => foreign.push(event))];
  const prisma = { pengajuan: { findMany: async () => [{ id: 3, mahasiswa: { user_id: 1 } }] } };
  try {
    await publishReviewChanges(prisma, [3, 3]);
    assert.equal(received.length, 1);
    assert.equal(received[0].resource_id, 3);
    assert.equal(foreign.length, 0);
    assert.equal(JSON.stringify(received).includes('user_id'), false);
  } finally { cleanup.forEach((fn) => fn()); }
  await publishReviewChanges(prisma, [3]);
  assert.equal(received.length, 1);
});

test('publication lookup failure is isolated from successful academic mutation', async () => {
  const previous = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    await assert.doesNotReject(publishReviewChanges({ pengajuan: { findMany: async () => {
      throw new Error('PRIVATE_CONNECTION_DETAIL');
    } } }, [1]));
    assert.equal(logs.length, 1);
    assert.equal(JSON.stringify(logs).includes('PRIVATE_CONNECTION_DETAIL'), false);
  } finally { console.error = previous; }
});

test('administration/assignment events follow commit and preserve mutation response; rollback emits nothing', async () => {
  const events = [];
  const stop = subscribeToUser(1, (event) => events.push(event));
  const prisma = { pengajuan: { findMany: async () => [{ id: 3, mahasiswa: { user_id: 1 } }] } };
  try {
    const result = { status: 'ACC' };
    assert.equal(await afterKpChange(prisma, 'pengajuan.administration.updated', async () => result, [3]), result);
    await assert.rejects(afterKpChange(prisma, 'pengajuan.assignment.updated', async () => { throw new Error('rollback'); }, [3]));
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'pengajuan.administration.updated');
  } finally { stop(); }
});

test('staff scope fails closed and reviewer invalidation includes ended assignment only for assignment events', async () => {
  const event = { resource_id: 3, type: 'pengajuan.assignment.updated' };
  await assert.rejects(canReceiveKpEvent({ programStudi: { findMany: async () => [{ id: 1 }, { id: 2 }] } },
    { id: 1, activeRole: 'KAPRODI' }, event), { code: 'PRODI_SCOPE_UNAVAILABLE' });
  let where;
  const prisma = { penugasanDosen: { findFirst: async (args) => {
    where = args.where;
    return { id: 1, dosen: { program_studi_id: 1 }, pengajuan: { mahasiswa: { program_studi_id: 1 } } };
  } } };
  assert.equal(await canReceiveKpEvent(prisma, { id: 1, activeRole: 'REVIEWER' }, event), true);
  assert.equal(where.status_penugasan, undefined);
  await canReceiveKpEvent(prisma, { id: 1, activeRole: 'REVIEWER' }, { ...event, type: 'pengajuan.review.updated' });
  assert.equal(where.status_penugasan, 'AKTIF');
  assert.equal(await canReceiveKpEvent({ pengajuan: { findFirst: async () => null } }, { id: 7, activeRole: 'MAHASISWA' }, event), false);
});

test('SSE HTTP requires student role, routes owner event and closes after session revocation', { timeout: 10000 }, async () => {
  const previous = process.env.JWT_ACCESS_SECRET_BASE64;
  process.env.JWT_ACCESS_SECRET_BASE64 = randomBytes(32).toString('base64url');
  let revoked = false;
  let role = 'MAHASISWA';
  const prisma = {
    authSession: { findFirst: async () => revoked ? null : { id: sessionId, role_version: 0, active_role: { kode_peran: role } } },
    user: { findUnique: async () => ({ id: 1, login_id: 'test', status_akun: 'AKTIF',
      user_roles_diperoleh: [{ role: { kode_peran: role } }] }) },
    pengajuan: { findMany: async () => [{ id: 3, mahasiswa: { user_id: 1 } }], findFirst: async () => ({ id: 3 }) },
  };
  const sessionId = randomUUID();
  const app = express();
  app.use('/api/realtime', createRealtimeRoutes({ prisma, heartbeatMs: 25 }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/realtime/events`;
  const controller = new AbortController();
  try {
    assert.equal((await fetch(url)).status, 401);
    role = 'SUPER_ADMIN';
    const wrongRole = await signAccessToken(1, sessionId, role, 0);
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${wrongRole.token}` } })).status, 403);
    role = 'MAHASISWA';
    const auth = await signAccessToken(1, sessionId, 'MAHASISWA', 0);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` }, signal: controller.signal });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    assert.match(decoder.decode((await reader.read()).value), /event: ready/);
    await publishReviewChanges(prisma, [3]);
    let data = '';
    while (!data.includes('event: change')) data += decoder.decode((await reader.read()).value);
    assert.match(data, /"resource_id":3/);
    publishNotificationChanges([1]);
    let notice = '';
    while (!notice.includes('notifikasi.updated')) notice += decoder.decode((await reader.read()).value);
    assert.match(notice, /"resource_type":"notifikasi"/);
    revoked = true;
    let done = false;
    while (!done) ({ done } = await reader.read());
    reader.releaseLock();
  } finally {
    controller.abort();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (previous === undefined) delete process.env.JWT_ACCESS_SECRET_BASE64;
    else process.env.JWT_ACCESS_SECRET_BASE64 = previous;
  }
});

test('post-commit response should not wait for a slow realtime subscriber', async () => {
  let release;
  let started;
  const gate = new Promise((resolve) => { release = resolve; });
  const entered = new Promise((resolve) => { started = resolve; });
  const stop = subscribeToUser(99, async () => { started(); await gate; });
  const prisma = { pengajuan: { findMany: async () => [{ id: 99, mahasiswa: { user_id: 99 } }] } };
  let completed = false;
  const pending = afterKpChange(prisma, 'pengajuan.administration.updated', async () => ({ committed: true }), [99])
    .then(() => { completed = true; });
  try {
    await entered;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(completed, true, 'Successful mutation is held up by realtime subscriber.');
  } finally { release(); stop(); await pending; }
});

test('unsubscribe should be idempotent after a new subscriber has joined', async () => {
  const prisma = { pengajuan: { findMany: async () => [{ id: 100, mahasiswa: { user_id: 100 } }] } };
  const oldStop = subscribeToUser(100, () => {});
  oldStop();
  let received = 0;
  const newStop = subscribeToUser(100, () => { received++; });
  try {
    oldStop();
    await publishReviewChanges(prisma, [100]);
    assert.equal(received, 1);
  } finally { newStop(); }
});


test('slow subscribers coalesce pending hints and do not block other subscribers', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const slow = [];
  const fast = [];
  const stops = [subscribeToUser(501, async (event) => { slow.push(event); await gate; }),
    subscribeToUser(501, (event) => fast.push(event))];
  const prisma = { pengajuan: { findMany: async () => [{ id: 501, mahasiswa: { user_id: 501 } }] } };
  try {
    for (let i = 0; i < 100; i++) await publishReviewChanges(prisma, [501]);
    assert.equal(slow.length, 1);
    assert.equal(fast.length, 100);
    release();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(slow.length, 2);
    assert.equal(slow[1].event_id, fast.at(-1).event_id);
  } finally { release(); stops.forEach((stop) => stop()); }
});

test('queue overflow disconnects and discards pending work', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  let disconnected = 0;
  const stop = subscribeToUser(502, async () => { calls++; await gate; }, 'MAHASISWA',
    { onDisconnect: () => { disconnected++; } });
  const prisma = { pengajuan: { findMany: async ({ where }) => where.id.in.map((id) => ({ id, mahasiswa: { user_id: 502 } })) } };
  try {
    await publishReviewChanges(prisma, Array.from({ length: 100 }, (_, i) => i + 1));
    assert.equal(disconnected, 1);
    release();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
    await publishReviewChanges(prisma, [200]);
    assert.equal(calls, 1);
  } finally { release(); stop(); }
});

test('delivery timeout closes subscription without starting another authorization task', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  let disconnected = 0;
  const stop = subscribeToUser(503, async () => { calls++; await gate; }, 'MAHASISWA',
    { onDisconnect: () => { disconnected++; } });
  const prisma = { pengajuan: { findMany: async () => [{ id: 503, mahasiswa: { user_id: 503 } }] } };
  try {
    await publishReviewChanges(prisma, [503]);
    t.mock.timers.tick(10000);
    assert.equal(disconnected, 1);
    await publishReviewChanges(prisma, [503]);
    release();
    await Promise.resolve();
    assert.equal(calls, 1);
  } finally { release(); stop(); }
});

test('notification event goes only to recipients after commit and never after rollback', async () => {
  const mine = [];
  const foreign = [];
  const stopMine = subscribeToUser(701, (event) => mine.push(event));
  const stopForeign = subscribeToUser(702, (event) => foreign.push(event));
  const prisma = { $transaction: async (operation) => operation({
    notifikasi: { create: async () => ({ id: 1n }) },
  }) };
  try {
    await serializable(prisma, (tx) => createNotifikasi(tx, {
      kategori: 'PENGAJUAN_KP', judul: 'Baru', pesan: 'Pengajuan baru',
      route: '/mahasiswa/pengajuan/kp', recipientIds: [701, 701],
    }));
    assert.equal(mine.length, 1);
    assert.equal(foreign.length, 0);
    assert.equal(mine[0].type, 'notifikasi.updated');
    await assert.rejects(serializable(prisma, async (tx) => {
      await createNotifikasi(tx, { kategori: 'PENGAJUAN_KP', judul: 'Rollback',
        pesan: 'Gagal', route: '/mahasiswa/pengajuan/kp', recipientIds: [701] });
      throw new Error('rollback');
    }));
    assert.equal(mine.length, 1);
  } finally { stopMine(); stopForeign(); }
});
