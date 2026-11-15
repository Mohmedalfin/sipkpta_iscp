import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/security/jwt.js';

const TEST_DATABASE = 'sipkita_test_kp_d1_spp_20261105070147_1066f27b';

async function api(base, path, token, method = 'GET', body) {
  const response = await fetch(`${base}/api/admin-prodi/konfigurasi/kurikulum${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('K3 Kurikulum: HTTP, batas Prodi, dan PostgreSQL TEST',
  { skip: process.env.SIPKITA_KURIKULUM_REAL_DB !== '1' }, async () => {
    assert.ok(process.env.DATABASE_URL);
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${TEST_DATABASE}`;
    url.searchParams.delete('schema');
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
    const created = { kurikulum: [], prodi: [], users: [], roles: [], sessions: [] };
    let server;
    const previousSecret = process.env.JWT_ACCESS_SECRET_BASE64;
    try {
      const [{ name }] = await prisma.$queryRaw`SELECT current_database() AS name`;
      assert.equal(name, TEST_DATABASE);
      const table = await prisma.$queryRaw`SELECT to_regclass('public.kurikulum')::text AS name`;
      assert.ok(table[0].name, 'Migrasi K3 harus sudah diterapkan pada TEST.');
      const initialApplications = await prisma.pengajuan.count();
      const existingProdi = await prisma.programStudi.findMany({ take: 2, select: { id: true } });
      assert.ok(existingProdi.length <= 1, 'Scope Admin Prodi harus tidak ambigu.');
      let prodiId = existingProdi[0]?.id;
      if (!prodiId) {
        const prodi = await prisma.programStudi.create({ data: { kode_prodi: 'TEST_K3',
          nama_prodi: 'Prodi Test K3', jenjang: 'S1', nama_fakultas: 'Test',
          nama_perguruan_tinggi: 'Test' } });
        prodiId = prodi.id;
        created.prodi.push(prodi.id);
      }
      async function role(code) {
        let row = await prisma.role.findUnique({ where: { kode_peran: code } });
        if (!row) {
          row = await prisma.role.create({ data: { kode_peran: code, nama_peran: code } });
          created.roles.push(row.id);
        }
        return row;
      }
      const adminRole = await role('ADMIN_PRODI');
      const studentRole = await role('MAHASISWA');
      const tag = randomBytes(5).toString('hex');
      const admin = await prisma.user.create({ data: { login_id: `k3-admin-${tag}`,
        email: `k3-admin-${tag}@example.invalid`, password_hash: randomBytes(32).toString('hex') } });
      const student = await prisma.user.create({ data: { login_id: `k3-student-${tag}`,
        email: `k3-student-${tag}@example.invalid`, password_hash: randomBytes(32).toString('hex') } });
      created.users.push(admin.id, student.id);
      await prisma.userRole.createMany({ data: [
        { user_id: admin.id, role_id: adminRole.id }, { user_id: student.id, role_id: studentRole.id },
      ] });
      process.env.JWT_ACCESS_SECRET_BASE64 = randomBytes(32).toString('base64url');
      async function token(user, roleRow) {
        const sessionId = randomUUID();
        created.sessions.push(sessionId);
        await prisma.authSession.create({ data: { id: sessionId, user_id: user.id,
          active_role_id: roleRow.id, expires_at: new Date(Date.now() + 3600000) } });
        return (await signAccessToken(user.id, sessionId, roleRow.kode_peran, 0)).token;
      }
      const adminToken = await token(admin, adminRole);
      const studentToken = await token(student, studentRole);
      server = createApp({ prisma, mailService: {} }).listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      assert.equal((await api(base, '', null)).status, 401);
      assert.equal((await api(base, '', studentToken)).status, 403);
      const payload = { kode_kurikulum: `KUR_${tag.toUpperCase()}`,
        nama_kurikulum: 'Kurikulum Test', tahun_mulai_berlaku: 2022,
        keterangan: 'Master informasi', is_aktif: true };
      assert.equal((await api(base, '', adminToken, 'POST',
        { ...payload, program_studi_id: prodiId })).status, 400);
      assert.equal((await api(base, '', adminToken, 'POST',
        { kode_kurikulum: 'x', nama_kurikulum: '', tahun_mulai_berlaku: 1 })).status, 400);
      const made = await api(base, '', adminToken, 'POST', payload);
      assert.equal(made.status, 201);
      created.kurikulum.push(made.body.data.id);
      assert.equal(made.body.data.program_studi_id, prodiId);
      assert.equal((await api(base, '', adminToken, 'POST', payload)).status, 409);
      const list = await api(base, `?page=1&limit=1&search=${payload.kode_kurikulum}&is_aktif=true`, adminToken);
      assert.equal(list.status, 200);
      assert.equal(list.body.data.pagination.total_items, 1);
      assert.equal(list.body.data.pagination.limit, 1);
      assert.equal(list.body.data.data[0].id, made.body.data.id);
      assert.equal((await api(base, '?page=0', adminToken)).status, 400);
      assert.equal((await api(base, `/${made.body.data.id}`, adminToken)).status, 200);
      const changed = await api(base, `/${made.body.data.id}`, adminToken, 'PATCH',
        { is_aktif: false, nama_kurikulum: 'Kurikulum Test Revisi' });
      assert.equal(changed.status, 200);
      assert.equal(changed.body.data.is_aktif, false);
      assert.equal((await api(base, `?search=${payload.kode_kurikulum}&is_aktif=false`, adminToken))
        .body.data.pagination.total_items, 1);
      assert.equal((await api(base, '/2147483647', adminToken)).status, 404);
      assert.equal((await api(base, '/2147483647', adminToken, 'PATCH', { is_aktif: true })).status, 404);
      assert.equal((await api(base, `/${made.body.data.id}`, adminToken, 'PATCH',
        { program_studi_id: prodiId })).status, 400);
      const secondProdi = await prisma.programStudi.create({ data: { kode_prodi: `TEST_K3_${tag}`,
        nama_prodi: 'Prodi Kedua Test', jenjang: 'S1', nama_fakultas: 'Test',
        nama_perguruan_tinggi: 'Test' } });
      created.prodi.push(secondProdi.id);
      const sameCodeOtherProdi = await prisma.kurikulum.create({ data: { program_studi_id: secondProdi.id,
        kode_kurikulum: payload.kode_kurikulum, nama_kurikulum: 'Kurikulum Prodi Kedua',
        tahun_mulai_berlaku: 2022 } });
      created.kurikulum.push(sameCodeOtherProdi.id);
      assert.equal((await api(base, '', adminToken)).status, 403);
      assert.equal(await prisma.pengajuan.count(), initialApplications);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (created.kurikulum.length) await prisma.kurikulum.deleteMany({ where: { id: { in: created.kurikulum } } });
      if (created.sessions.length) await prisma.authSession.deleteMany({ where: { id: { in: created.sessions } } });
      if (created.users.length) {
        await prisma.userRole.deleteMany({ where: { user_id: { in: created.users } } });
        await prisma.user.deleteMany({ where: { id: { in: created.users } } });
      }
      if (created.roles.length) await prisma.role.deleteMany({ where: { id: { in: created.roles } } });
      if (created.prodi.length) await prisma.programStudi.deleteMany({ where: { id: { in: created.prodi } } });
      await prisma.$disconnect();
      if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET_BASE64;
      else process.env.JWT_ACCESS_SECRET_BASE64 = previousSecret;
    }
  });
