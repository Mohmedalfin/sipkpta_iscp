import { rememberNotificationRecipients } from './notification-publication.service.js';
import { publishNotificationChanges } from './realtime.service.js';
const allowedRoutes = new Set([
  '/mahasiswa/pengajuan/kp', '/admin-prodi/verifikasi-pengajuan-kp',
  '/kaprodi/kp/penugasan-reviewer', '/reviewer/review-kp',
]);

export class NotifikasiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function serialize(row) {
  return {
    id: row.id.toString(), notifikasi_id: row.notifikasi_id.toString(),
    kategori_notifikasi: row.notifikasi.kategori_notifikasi,
    judul: row.notifikasi.judul, pesan: row.notifikasi.pesan,
    tautan_internal: row.notifikasi.tautan_internal,
    created_at: row.created_at, status_dibaca: row.status_dibaca,
    dibaca_at: row.dibaca_at,
  };
}

export async function listNotifikasi(prisma, userId, { page, limit, dibaca }) {
  const where = { penerima_user_id: userId,
    ...(dibaca === null ? {} : { status_dibaca: dibaca }) };
  const [rows, total] = await Promise.all([
    prisma.notifikasiPenerima.findMany({ where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit, take: limit,
      include: { notifikasi: true } }),
    prisma.notifikasiPenerima.count({ where }),
  ]);
  return { items: rows.map(serialize), pagination: { page, limit, total,
    total_pages: Math.ceil(total / limit) } };
}

export async function countUnreadNotifikasi(prisma, userId) {
  return { count: await prisma.notifikasiPenerima.count({
    where: { penerima_user_id: userId, status_dibaca: false } }) };
}

export async function markNotifikasiRead(prisma, userId, id) {
  const row = await prisma.notifikasiPenerima.findFirst({
    where: { id, penerima_user_id: userId }, select: { id: true } });
  if (!row) throw new NotifikasiError(404, 'NOTIFICATION_NOT_FOUND', 'Notifikasi tidak ditemukan.');
  const changed = await prisma.notifikasiPenerima.updateMany({
    where: { id, penerima_user_id: userId, status_dibaca: false },
    data: { status_dibaca: true, dibaca_at: new Date() },
  });
  if (changed.count) publishNotificationChanges([userId]);
  return { id: id.toString(), status_dibaca: true, changed: changed.count > 0 };
}

export async function markAllNotifikasiRead(prisma, userId) {
  const changed = await prisma.notifikasiPenerima.updateMany({
    where: { penerima_user_id: userId, status_dibaca: false },
    data: { status_dibaca: true, dibaca_at: new Date() },
  });
  if (changed.count) publishNotificationChanges([userId]);
  return { updated: changed.count };
}

// Call only inside the transaction that creates the corresponding business event.
export async function createNotifikasi(tx, { kategori, judul, pesan, route, actorUserId, recipientIds }) {
  if (!allowedRoutes.has(route)) throw new Error('Invalid notification route.');
  const recipients = [...new Set(recipientIds.filter(Number.isSafeInteger))];
  if (!recipients.length) return null;
  const created = await tx.notifikasi.create({ data: {
    kategori_notifikasi: kategori, judul, pesan, tautan_internal: route,
    dibuat_oleh_user_id: actorUserId ?? null,
    penerima: { create: recipients.map((userId) => ({ penerima_user_id: userId })) },
  }, select: { id: true } });
  rememberNotificationRecipients(recipients);
  return created;
}

export async function studentRecipient(tx, applicationId) {
  const row = await tx.pengajuan.findUnique({ where: { id: applicationId },
    select: { mahasiswa: { select: { user_id: true } } } });
  if (!row) throw new Error('Notification application missing.');
  return row.mahasiswa.user_id;
}

export async function staffRecipients(tx, prodiId, roleCode) {
  // Current staff authorization is single-Prodi. Fail closed if multiple Prodi exist.
  const prodis = await tx.programStudi.findMany({ select: { id: true }, take: 2 });
  if (prodis.length !== 1 || prodis[0].id !== prodiId) return [];
  const users = await tx.user.findMany({ where: { status_akun: 'AKTIF',
    user_roles_diperoleh: { some: { role: { kode_peran: roleCode } } } },
    select: { id: true } });
  return users.map((user) => user.id);
}

export async function reviewerRecipients(tx, applicationId) {
  const rows = await tx.penugasanDosen.findMany({ where: {
    pengajuan_id: applicationId, jenis_penugasan: 'REVIEWER', status_penugasan: 'AKTIF',
    dosen: { status_data: 'AKTIF', user: { status_akun: 'AKTIF',
      user_roles_diperoleh: { some: { role: { kode_peran: 'REVIEWER' } } } } },
  }, select: { dosen: { select: { user_id: true } } } });
  return rows.map((row) => row.dosen.user_id).filter(Number.isSafeInteger);
}
