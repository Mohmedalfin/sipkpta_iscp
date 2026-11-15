import { randomUUID } from 'node:crypto';
import { authorizedProdiId } from './mahasiswa.service.js';

const listeners = new Map();

const MAX_PENDING_EVENTS = 64;
const DELIVERY_TIMEOUT_MS = 10000;

export function subscribeToUser(userId, listener, role = 'MAHASISWA', { onDisconnect = () => {} } = {}) {
  const group = listeners.get(userId) ?? new Set();
  const entry = { role, enqueue };
  const pending = new Map();
  let active = true;
  let draining = false;
  let timer;
  group.add(entry);
  listeners.set(userId, group);

  function unsubscribe() {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    pending.clear();
    group.delete(entry);
    if (!group.size && listeners.get(userId) === group) listeners.delete(userId);
  }

  function disconnect() {
    unsubscribe();
    try { onDisconnect(); } catch { /* Transport may already be closed. */ }
  }

  async function drain() {
    draining = true;
    try {
      while (active && pending.size) {
        const [key, event] = pending.entries().next().value;
        pending.delete(key);
        timer = setTimeout(disconnect, DELIVERY_TIMEOUT_MS);
        timer.unref?.();
        try { await listener(event); } catch { disconnect(); }
        finally { clearTimeout(timer); }
      }
    } finally { draining = false; }
  }

  function enqueue(event) {
    if (!active) return;
    const key = `${event.type}:${event.resource_id}`;
    if (!pending.has(key) && pending.size >= MAX_PENDING_EVENTS) return disconnect();
    // Events are invalidation hints; only the latest pending hint per resource is needed.
    pending.set(key, event);
    if (!draining) void drain();
  }

  return unsubscribe;
}

export function publishNotificationChanges(userIds) {
  for (const userId of new Set(userIds)) {
    const entries = listeners.get(userId);
    if (!entries) continue;
    const event = { event_id: randomUUID(), schema_version: 1,
      type: 'notifikasi.updated', resource_type: 'notifikasi', resource_id: 0,
      occurred_at: new Date().toISOString() };
    for (const { enqueue } of entries) enqueue(event);
  }
}

export async function publishReviewChanges(prisma, applicationIds) {
  return publishApplicationChanges(prisma, applicationIds, 'pengajuan.review.updated');
}

export async function canReceiveKpEvent(prisma, user, event) {
  const id = event.resource_id;
  if (user.activeRole === 'MAHASISWA') return Boolean(await prisma.pengajuan.findFirst({
    where: { id, mahasiswa: { user_id: user.id } }, select: { id: true } }));
  if (user.activeRole === 'REVIEWER') {
    const assignment = await prisma.penugasanDosen.findFirst({ where: {
    pengajuan_id: id, jenis_penugasan: 'REVIEWER',
    ...(event.type === 'pengajuan.assignment.updated' ? {} : { status_penugasan: 'AKTIF' }),
    dosen: { user_id: user.id, status_data: 'AKTIF' },
    }, select: { id: true, dosen: { select: { program_studi_id: true } },
      pengajuan: { select: { mahasiswa: { select: { program_studi_id: true } } } } } });
    return Boolean(assignment && assignment.dosen.program_studi_id === assignment.pengajuan.mahasiswa.program_studi_id);
  }
  if (['ADMIN_PRODI', 'KAPRODI'].includes(user.activeRole)) {
    const prodiId = await authorizedProdiId(prisma);
    return Boolean(await prisma.pengajuan.findFirst({ where: { id,
      mahasiswa: { program_studi_id: prodiId } }, select: { id: true } }));
  }
  return false;
}

export async function publishApplicationChanges(prisma, applicationIds, type) {
  if (!applicationIds.length) return;
  try {
    const rows = await prisma.pengajuan.findMany({ where: { id: { in: [...new Set(applicationIds)] } },
      select: { id: true, mahasiswa: { select: { user_id: true } } } });
    for (const row of rows) {
      const event = { event_id: randomUUID(), schema_version: 1,
        type, resource_type: 'pengajuan', resource_id: row.id,
        occurred_at: new Date().toISOString() };
      for (const [userId, entries] of listeners) {
        for (const { enqueue, role } of entries) {
          if (role === 'PEMBIMBING' || role === 'MAHASISWA' && userId !== row.mahasiswa.user_id) continue;
          enqueue(event);
        }
      }
    }
  } catch { console.error('Realtime review publication failed.'); }
}

/** Jalankan operasi hingga commit, kemudian terbitkan event tanpa mengubah respons bisnis. */
export async function afterKpChange(prisma, type, operation, ids) {
  const result = await operation();
  try {
    const applicationIds = typeof ids === 'function' ? await ids(result) : ids;
    await publishApplicationChanges(prisma, applicationIds, type);
  } catch { console.error('Realtime publication failed.'); }
  return result;
}
