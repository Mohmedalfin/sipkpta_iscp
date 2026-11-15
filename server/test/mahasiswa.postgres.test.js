import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/security/jwt.js';
import { hashPassword } from '../src/security/password.js';

const TEST_DATABASE = 'sipkita_master_mahasiswa_test';
const shouldRun = process.env.SIPKITA_MASTER_REAL_DB === '1';

async function counts(prisma) {
  const [programStudi, role, user, userRole, mahasiswa, authSession, refreshToken] = await Promise.all([
    prisma.programStudi.count(),
    prisma.role.count(),
    prisma.user.count(),
    prisma.userRole.count(),
    prisma.mahasiswa.count(),
    prisma.authSession.count(),
    prisma.refreshToken.count(),
  ]);
  return { programStudi, role, user, userRole, mahasiswa, authSession, refreshToken };
}

async function request(base, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

test('Master Mahasiswa: integrasi HTTP dan PostgreSQL terisolasi', { skip: !shouldRun }, async () => {
  const sourceUrl = new URL(process.env.DATABASE_URL);
  assert.equal(sourceUrl.pathname, '/sipkita_dev');
  sourceUrl.pathname = `/${TEST_DATABASE}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: sourceUrl.toString() }) });
  const created = { prodi: [], roles: [], users: [] };
  let server;
  let testError;
  let baseline;

  try {
    baseline = await counts(prisma);
    assert.deepEqual(baseline, {
      programStudi: 0, role: 0, user: 0, userRole: 0,
      mahasiswa: 0, authSession: 0, refreshToken: 0,
    }, 'Database test harus kosong sebelum tes dimulai.');

    const prodi = await prisma.programStudi.create({
      data: {
        kode_prodi: 'TEST_SI',
        nama_prodi: 'Sistem Informasi Test',
        jenjang: 'S1',
        nama_fakultas: 'Fakultas Test',
        nama_perguruan_tinggi: 'Universitas Test',
      },
    });
    created.prodi.push(prodi.id);
    const adminRole = await prisma.role.create({
      data: { kode_peran: 'ADMIN_PRODI', nama_peran: 'Admin Prodi Test' },
    });
    created.roles.push(adminRole.id);
    const studentRole = await prisma.role.create({
      data: { kode_peran: 'MAHASISWA', nama_peran: 'Mahasiswa Test' },
    });
    created.roles.push(studentRole.id);
    const admin = await prisma.user.create({
      data: {
        login_id: `test.admin.${randomUUID().slice(0, 8)}`,
        email: `admin-${randomUUID().slice(0, 8)}@example.test`,
        password_hash: await hashPassword(randomBytes(20).toString('base64url')),
      },
    });
    created.users.push(admin.id);
    await prisma.userRole.create({
      data: { user_id: admin.id, role_id: adminRole.id },
    });
    const adminSessionId = randomUUID();
    await prisma.authSession.create({
      data: {
        id: adminSessionId,
        user_id: admin.id,
        active_role_id: adminRole.id,
        role_version: 0,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    process.env.JWT_ACCESS_SECRET_BASE64 ||= randomBytes(32).toString('base64url');
    const adminToken = (await signAccessToken(admin.id, adminSessionId, 'ADMIN_PRODI', 0)).token;
    server = createApp({ prisma }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const payload = {
      program_studi_id: prodi.id,
      nim: `9${randomBytes(4).readUInt32BE().toString().padStart(9, '0')}`,
      email: `student-${randomUUID().slice(0, 8)}@example.test`,
      nama_lengkap: 'Mahasiswa Integration Test',
      tanggal_lahir: '2002-03-04',
      nik_kependudukan: '1234567890123456',
    };

    assert.equal((await request(base, '/api/master/mahasiswa')).status, 401);
    const createdResponse = await request(base, '/api/master/mahasiswa', {
      method: 'POST', token: adminToken, body: payload,
    });
    assert.equal(createdResponse.status, 201);
    assert.equal(JSON.stringify(createdResponse.body).includes('password_hash'), false);
    const mahasiswaId = createdResponse.body.data.id;
    const student = await prisma.user.findUnique({ where: { login_id: payload.nim } });
    assert.ok(student);
    created.users.push(student.id);
    assert.equal(student.email, payload.email);
    assert.equal((await prisma.userRole.count({
      where: { user_id: student.id, role_id: studentRole.id, assigned_by_user_id: admin.id },
    })), 1);
    assert.equal((await prisma.mahasiswa.count({
      where: { id: mahasiswaId, user_id: student.id, program_studi_id: prodi.id },
    })), 1);

    const login = await request(base, '/api/auth/login', {
      method: 'POST', body: { login_id: payload.nim, password: '04032002' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.data.user.activeRole, 'MAHASISWA');
    assert.equal((await request(base, '/api/master/mahasiswa', {
      token: login.body.data.accessToken,
    })).status, 403);
    assert.equal((await request(base, '/api/master/mahasiswa', {
      method: 'POST', token: login.body.data.accessToken, body: payload,
    })).status, 403);

    const list = await request(base, '/api/master/mahasiswa?page=1&limit=5&search=Integration', {
      token: adminToken,
    });
    assert.equal(list.status, 200);
    assert.equal(list.body.meta.pagination.total_items, 1);
    assert.deepEqual(list.body.meta.summary, { total: 1, aktif: 1, nonaktif: 0 });
    assert.equal(list.body.data[0].id, mahasiswaId);
    assert.equal(JSON.stringify(list.body).includes('password_hash'), false);
    const detail = await request(base, `/api/master/mahasiswa/${mahasiswaId}`, { token: adminToken });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.nim, payload.nim);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}`)).status, 401);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}`, {
      token: login.body.data.accessToken,
    })).status, 403);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}`, {
      method: 'PATCH', token: login.body.data.accessToken,
      body: { nama_lengkap: 'Tidak Diizinkan' },
    })).status, 403);

    const originalHash = student.password_hash;
    const patched = await request(base, `/api/master/mahasiswa/${mahasiswaId}`, {
      method: 'PATCH', token: adminToken,
      body: { tanggal_lahir: '2001-12-05', nama_lengkap: 'Nama Diperbarui' },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.nama_lengkap, 'Nama Diperbarui');
    assert.equal((await prisma.user.findUnique({ where: { id: student.id } })).password_hash, originalHash);
    assert.equal((await request(base, '/api/auth/login', {
      method: 'POST', body: { login_id: payload.nim, password: '04032002' },
    })).status, 200);

    const beforeDuplicate = await counts(prisma);
    const duplicate = await request(base, '/api/master/mahasiswa', {
      method: 'POST', token: adminToken, body: payload,
    });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await counts(prisma), beforeDuplicate);

    const rollbackNim = `8${randomBytes(4).readUInt32BE().toString().padStart(9, '0')}`;
    const rollback = await request(base, '/api/master/mahasiswa', {
      method: 'POST', token: adminToken,
      body: { ...payload, nim: rollbackNim, email: `rollback-${randomUUID().slice(0, 8)}@example.test` },
    });
    assert.equal(rollback.status, 409);
    assert.equal(await prisma.user.count({ where: { login_id: rollbackNim } }), 0);
    assert.deepEqual(await counts(prisma), beforeDuplicate);

    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}/status`, {
      method: 'PATCH', token: adminToken, body: { status_akun: 'INVALID' },
    })).status, 400);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}/status`, {
      method: 'PATCH', token: login.body.data.accessToken, body: { status_akun: 'NONAKTIF' },
    })).status, 403);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}/status`, {
      method: 'PATCH', body: { status_akun: 'NONAKTIF' },
    })).status, 401);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}`, {
      method: 'DELETE', token: login.body.data.accessToken,
    })).status, 403);
    await prisma.userRole.create({ data: { user_id: student.id, role_id: adminRole.id } });
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}/status`, {
      method: 'PATCH', token: adminToken, body: { status_akun: 'NONAKTIF' },
    })).status, 403);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}`, {
      method: 'DELETE', token: adminToken,
    })).status, 403);
    await prisma.userRole.delete({ where: { user_id_role_id: { user_id: student.id, role_id: adminRole.id } } });
    const inactive = await request(base, `/api/master/mahasiswa/${mahasiswaId}/status`, {
      method: 'PATCH', token: adminToken, body: { status_akun: 'NONAKTIF' },
    });
    assert.equal(inactive.status, 200);
    assert.equal(inactive.body.data.status_data, 'AKTIF');
    assert.deepEqual((await request(base, '/api/master/mahasiswa', {
      token: adminToken,
    })).body.meta.summary, { total: 1, aktif: 0, nonaktif: 1 });
    assert.equal(await prisma.authSession.count({ where: { user_id: student.id, revoked_at: null } }), 0);
    assert.equal((await request(base, '/api/auth/me', { token: login.body.data.accessToken })).status, 401);
    assert.equal((await request(base, '/api/auth/login', {
      method: 'POST', body: { login_id: payload.nim, password: '04032002' },
    })).status, 401);
    assert.equal((await request(base, '/api/auth/refresh', {
      method: 'POST', body: { refreshToken: login.body.data.refreshToken },
    })).status, 401);
    const active = await request(base, `/api/master/mahasiswa/${mahasiswaId}/status`, {
      method: 'PATCH', token: adminToken, body: { status_akun: 'AKTIF' },
    });
    assert.equal(active.status, 200);
    assert.deepEqual((await request(base, '/api/master/mahasiswa', {
      token: adminToken,
    })).body.meta.summary, { total: 1, aktif: 1, nonaktif: 0 });
    assert.equal((await prisma.user.findUnique({ where: { id: student.id } })).password_hash, originalHash);
    assert.equal((await request(base, '/api/auth/me', { token: login.body.data.accessToken })).status, 401);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}`, {
      method: 'DELETE', token: adminToken,
    })).status, 409);

    const targetSessions = (await prisma.authSession.findMany({
      where: { user_id: student.id }, select: { id: true },
    })).map((session) => session.id);
    await prisma.refreshToken.deleteMany({ where: { session_id: { in: targetSessions } } });
    await prisma.authSession.deleteMany({ where: { id: { in: targetSessions } } });
    await prisma.verifikasiDataDiri.create({ data: { mahasiswa_id: mahasiswaId } });
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}`, {
      method: 'DELETE', token: adminToken,
    })).status, 409);
    await prisma.verifikasiDataDiri.delete({ where: { mahasiswa_id: mahasiswaId } });
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}`, {
      method: 'DELETE', token: adminToken,
    })).status, 204);
    assert.equal(await prisma.user.count({ where: { id: student.id } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { entitas: 'Mahasiswa', entitas_id: BigInt(mahasiswaId) } }), 3);

    const secondProdi = await prisma.programStudi.create({
      data: {
        kode_prodi: 'TEST_OTHER', nama_prodi: 'Prodi Lain Test', jenjang: 'S1',
        nama_fakultas: 'Fakultas Test', nama_perguruan_tinggi: 'Universitas Test',
      },
    });
    created.prodi.push(secondProdi.id);
    assert.equal((await request(base, '/api/master/mahasiswa', { token: adminToken })).status, 403);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}`, { token: adminToken })).status, 403);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}/status`, {
      method: 'PATCH', token: adminToken, body: { status_akun: 'NONAKTIF' },
    })).status, 403);
    assert.equal((await request(base, `/api/master/mahasiswa/${mahasiswaId}`, {
      method: 'DELETE', token: adminToken,
    })).status, 403);
  } catch (error) {
    testError = error;
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      const sessionIds = (await prisma.authSession.findMany({
        where: { user_id: { in: created.users } }, select: { id: true },
      })).map((session) => session.id);
      if (sessionIds.length) {
        await prisma.refreshToken.deleteMany({ where: { session_id: { in: sessionIds } } });
        await prisma.authSession.deleteMany({ where: { id: { in: sessionIds } } });
      }
      if (created.users.length) {
        await prisma.auditLog.deleteMany({ where: { aktor_user_id: { in: created.users } } });
        await prisma.mahasiswa.deleteMany({ where: { user_id: { in: created.users } } });
        await prisma.userRole.deleteMany({ where: { user_id: { in: created.users } } });
        await prisma.user.deleteMany({ where: { id: { in: created.users } } });
      }
      if (created.roles.length) await prisma.role.deleteMany({ where: { id: { in: created.roles } } });
      if (created.prodi.length) await prisma.programStudi.deleteMany({ where: { id: { in: created.prodi } } });
      if (baseline) assert.deepEqual(await counts(prisma), baseline);
    } catch (cleanupError) {
      testError ??= cleanupError;
    }
    await prisma.$disconnect();
  }
  if (testError) throw testError;
});
