import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/security/jwt.js';
import { getKurikulum, listKurikulum } from '../src/services/kurikulum.service.js';

const target = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (target.pathname !== '/sipkita_dev') throw new Error('Smoke test ditolak: target bukan sipkita_dev.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString() }) });
let server;
try {
  const [{ name }] = await prisma.$queryRaw`SELECT current_database() AS name`;
  assert.equal(name, 'sipkita_dev');
  const before = await prisma.kurikulum.count();
  const result = await listKurikulum(prisma, { page: 1, limit: 1, search: '', is_aktif: null });
  assert.ok(Array.isArray(result.data));
  assert.equal(typeof result.pagination.total_items, 'number');
  await assert.rejects(() => getKurikulum(prisma, 2147483647), (error) => error.status === 404);
  server = createApp({ prisma, mailService: {} }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/admin-prodi/konfigurasi/kurikulum`;
  const unauthorized = await fetch(url);
  assert.equal(unauthorized.status, 401);
  const session = await prisma.authSession.findFirst({ where: {
    revoked_at: null, expires_at: { gt: new Date() },
    active_role: { kode_peran: 'ADMIN_PRODI' }, user: { status_akun: 'AKTIF' },
  }, select: { id: true, user_id: true, role_version: true } });
  if (session && process.env.JWT_ACCESS_SECRET_BASE64) {
    const token = (await signAccessToken(session.user_id, session.id, 'ADMIN_PRODI', session.role_version)).token;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.data));
    console.log('Smoke K3: HTTP 401 dan HTTP 200 baca berhasil memakai sesi Admin Prodi existing.');
  } else {
    console.log('Smoke K3: HTTP 401 dan baca service berhasil; HTTP 200 dilewati karena tidak ada sesi Admin Prodi aktif.');
  }
  assert.equal(await prisma.kurikulum.count(), before);
  console.log('Smoke K3: jumlah Kurikulum tidak berubah.');
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
}
