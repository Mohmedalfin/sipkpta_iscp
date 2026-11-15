import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/security/jwt.js';
import { hashPassword, verifyPassword } from '../src/security/password.js';

const TEST_DATABASE = 'sipkita_master_dosen_test';
const shouldRun = process.env.SIPKITA_DOSEN_REAL_DB === '1';

async function counts(prisma) {
  const [programStudi, role, user, userRole, dosen, authSession, refreshToken] = await Promise.all([
    prisma.programStudi.count(), prisma.role.count(), prisma.user.count(),
    prisma.userRole.count(), prisma.dosen.count(), prisma.authSession.count(),
    prisma.refreshToken.count(),
  ]);
  return { programStudi, role, user, userRole, dosen, authSession, refreshToken };
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

test('Master Dosen: integrasi HTTP dan PostgreSQL terisolasi', { skip: !shouldRun }, async () => {
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
      dosen: 0, authSession: 0, refreshToken: 0,
    }, 'Database test harus kosong sebelum tes dimulai.');

    const prodi = await prisma.programStudi.create({
      data: {
        kode_prodi: 'TEST_SI', nama_prodi: 'Sistem Informasi Test', jenjang: 'S1',
        nama_fakultas: 'Fakultas Test', nama_perguruan_tinggi: 'Universitas Test',
      },
    });
    created.prodi.push(prodi.id);
    const adminRole = await prisma.role.create({
      data: { kode_peran: 'ADMIN_PRODI', nama_peran: 'Admin Prodi Test' },
    });
    created.roles.push(adminRole.id);
    const admin = await prisma.user.create({
      data: {
        login_id: `test.admin.${randomUUID().slice(0, 8)}`,
        email: `admin-${randomUUID().slice(0, 8)}@example.test`,
        password_hash: await hashPassword(randomBytes(20).toString('base64url')),
      },
    });
    created.users.push(admin.id);
    await prisma.userRole.create({ data: { user_id: admin.id, role_id: adminRole.id } });
    const adminSessionId = randomUUID();
    await prisma.authSession.create({
      data: {
        id: adminSessionId, user_id: admin.id, active_role_id: adminRole.id,
        role_version: 0, expires_at: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    process.env.JWT_ACCESS_SECRET_BASE64 ||= randomBytes(32).toString('base64url');
    const adminToken = (await signAccessToken(admin.id, adminSessionId, 'ADMIN_PRODI', 0)).token;
    server = createApp({ prisma }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const payload = {
      program_studi_id: prodi.id,
      kode_dosen: `D${randomUUID().replaceAll('-', '').slice(0, 9)}`,
      nidn: '0123456789',
      email: `dosen-${randomUUID().slice(0, 8)}@example.test`,
      nama_lengkap: 'Dosen Integration Test',
      tanggal_lahir: '1980-04-05',
      is_homebase_si: true,
    };

    assert.equal((await request(base, '/api/master/dosen')).status, 401);
    const createdResponse = await request(base, '/api/master/dosen', {
      method: 'POST', token: adminToken, body: payload,
    });
    assert.equal(createdResponse.status, 201);
    assert.equal(JSON.stringify(createdResponse.body).includes('password_hash'), false);
    const dosenId = createdResponse.body.data.id;
    const dosenUser = await prisma.user.findUnique({ where: { login_id: payload.kode_dosen } });
    assert.ok(dosenUser);
    created.users.push(dosenUser.id);
    assert.equal(dosenUser.email, payload.email);
    assert.equal(await verifyPassword('05041980', dosenUser.password_hash), true);
    assert.equal(await prisma.userRole.count({ where: { user_id: dosenUser.id } }), 0);
    assert.equal(await prisma.dosen.count({
      where: { id: dosenId, user_id: dosenUser.id, program_studi_id: prodi.id },
    }), 1);

    const noRoleLogin = await request(base, '/api/auth/login', {
      method: 'POST', body: { login_id: payload.kode_dosen, password: '05041980' },
    });
    assert.equal(noRoleLogin.status, 401);
    const noRoleSessionId = randomUUID();
    await prisma.authSession.create({
      data: {
        id: noRoleSessionId, user_id: dosenUser.id,
        role_version: 0, expires_at: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const noRoleToken = (await signAccessToken(dosenUser.id, noRoleSessionId, null, 0)).token;
    assert.equal((await request(base, '/api/master/dosen', { token: noRoleToken })).status, 401);

    const list = await request(base, '/api/master/dosen?page=1&limit=5&search=Integration', {
      token: adminToken,
    });
    assert.equal(list.status, 200);
    assert.equal(list.body.meta.pagination.total_items, 1);
    assert.deepEqual(list.body.meta.summary,
      { total: 1, aktif: 1, nonaktif: 0, homebase: 1 });
    assert.equal(list.body.data[0].id, dosenId);
    assert.equal(JSON.stringify(list.body).includes('password_hash'), false);
    const detail = await request(base, `/api/master/dosen/${dosenId}`, { token: adminToken });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.kode_dosen, payload.kode_dosen);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}`)).status, 401);

    const originalHash = dosenUser.password_hash;
    const patched = await request(base, `/api/master/dosen/${dosenId}`, {
      method: 'PATCH', token: adminToken,
      body: { tanggal_lahir: '1981-12-06', nama_lengkap: 'Nama Diperbarui', email: 'baru@example.test' },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.nama_lengkap, 'Nama Diperbarui');
    assert.equal(patched.body.data.email, 'baru@example.test');
    assert.equal((await prisma.user.findUnique({ where: { id: dosenUser.id } })).password_hash, originalHash);
    assert.equal(JSON.stringify(patched.body).includes('password_hash'), false);
    assert.equal((await request(base, '/api/auth/login', {
      method: 'POST', body: { login_id: payload.kode_dosen, password: '05041980' },
    })).status, 401);

    const beforeDuplicate = await counts(prisma);
    const duplicate = await request(base, '/api/master/dosen', {
      method: 'POST', token: adminToken, body: payload,
    });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await counts(prisma), beforeDuplicate);

    const rollbackCode = `R${randomUUID().replaceAll('-', '').slice(0, 9)}`;
    const rollback = await request(base, '/api/master/dosen', {
      method: 'POST', token: adminToken,
      body: { ...payload, kode_dosen: rollbackCode, email: `rollback-${randomUUID().slice(0, 8)}@example.test` },
    });
    assert.equal(rollback.status, 409);
    assert.equal(await prisma.user.count({ where: { login_id: rollbackCode } }), 0);
    assert.deepEqual(await counts(prisma), beforeDuplicate);

    const reviewerRole = await prisma.role.create({
      data: { kode_peran: 'REVIEWER', nama_peran: 'Reviewer Test' },
    });
    created.roles.push(reviewerRole.id);
    await prisma.userRole.create({
      data: { user_id: admin.id, role_id: reviewerRole.id },
    });
    const reviewerSessionId = randomUUID();
    await prisma.authSession.create({
      data: {
        id: reviewerSessionId, user_id: admin.id, active_role_id: reviewerRole.id,
        role_version: 0, expires_at: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const reviewerToken = (await signAccessToken(admin.id, reviewerSessionId, 'REVIEWER', 0)).token;
    assert.equal((await request(base, '/api/master/dosen', { token: reviewerToken })).status, 403);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}`, { token: reviewerToken })).status, 403);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}`, {
      method: 'PATCH', token: reviewerToken, body: { nama_lengkap: 'Tidak Diizinkan' },
    })).status, 403);
    assert.equal((await request(base, '/api/master/dosen', {
      method: 'POST', token: reviewerToken, body: payload,
    })).status, 403);

    assert.equal((await request(base, `/api/master/dosen/${dosenId}/status`, {
      method: 'PATCH', token: adminToken, body: { status_akun: 'SUSPENDED' },
    })).status, 400);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}/status`, {
      method: 'PATCH', token: reviewerToken, body: { status_akun: 'NONAKTIF' },
    })).status, 403);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}/status`, {
      method: 'PATCH', body: { status_akun: 'NONAKTIF' },
    })).status, 401);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}`, {
      method: 'DELETE', token: reviewerToken,
    })).status, 403);
    await prisma.userRole.create({ data: { user_id: dosenUser.id, role_id: adminRole.id } });
    assert.equal((await request(base, `/api/master/dosen/${dosenId}/status`, {
      method: 'PATCH', token: adminToken, body: { status_akun: 'NONAKTIF' },
    })).status, 403);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}`, {
      method: 'DELETE', token: adminToken,
    })).status, 403);
    await prisma.userRole.delete({ where: { user_id_role_id: { user_id: dosenUser.id, role_id: adminRole.id } } });
    const inactive = await request(base, `/api/master/dosen/${dosenId}/status`, {
      method: 'PATCH', token: adminToken, body: { status_akun: 'NONAKTIF' },
    });
    assert.equal(inactive.status, 200);
    assert.equal(inactive.body.data.status_data, 'AKTIF');
    assert.equal(await prisma.authSession.count({ where: { user_id: dosenUser.id, revoked_at: null } }), 0);
    assert.equal((await request(base, '/api/auth/me', { token: noRoleToken })).status, 401);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}/status`, {
      method: 'PATCH', token: adminToken, body: { status_akun: 'AKTIF' },
    })).status, 200);
    assert.equal((await prisma.user.findUnique({ where: { id: dosenUser.id } })).password_hash, originalHash);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}`, {
      method: 'DELETE', token: adminToken,
    })).status, 409);
    await prisma.authSession.delete({ where: { id: noRoleSessionId } });
    assert.equal((await request(base, `/api/master/dosen/${dosenId}`, {
      method: 'DELETE', token: adminToken,
    })).status, 204);
    assert.equal(await prisma.user.count({ where: { id: dosenUser.id } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { entitas: 'Dosen', entitas_id: BigInt(dosenId) } }), 3);

    const secondProdi = await prisma.programStudi.create({
      data: {
        kode_prodi: 'TEST_OTHER', nama_prodi: 'Prodi Lain Test', jenjang: 'S1',
        nama_fakultas: 'Fakultas Test', nama_perguruan_tinggi: 'Universitas Test',
      },
    });
    created.prodi.push(secondProdi.id);
    assert.equal((await request(base, '/api/master/dosen', { token: adminToken })).status, 403);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}`, { token: adminToken })).status, 403);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}/status`, {
      method: 'PATCH', token: adminToken, body: { status_akun: 'NONAKTIF' },
    })).status, 403);
    assert.equal((await request(base, `/api/master/dosen/${dosenId}`, {
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
        await prisma.dosen.deleteMany({ where: { user_id: { in: created.users } } });
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
