import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/security/jwt.js';
import { verifyPassword } from '../src/security/password.js';

process.env.JWT_ACCESS_SECRET_BASE64 ||= randomBytes(32).toString('base64url');

function fakePrisma({ prodiIds = [1], failProfile = false } = {}) {
  const state = {
    prodis: prodiIds.map((id) => ({ id, kode_prodi: `P${id}`, nama_prodi: `Prodi ${id}` })),
    users: [{ id: 1, login_id: 'admin.prodi', email: 'admin@example.test', status_akun: 'AKTIF',
      user_roles_diperoleh: [{ role: { id: 1, kode_peran: 'ADMIN_PRODI' } }] }],
    mahasiswa: [],
    userRoles: [],
    sessions: [{ id: '00000000-0000-4000-8000-000000000001', user_id: 1, role_version: 0,
      active_role: { kode_peran: 'ADMIN_PRODI' }, revoked_at: null,
      expires_at: new Date(Date.now() + 60000) }],
  };

  const materialize = (row) => ({
    ...row,
    user: state.users.find((user) => user.id === row.user_id),
    program_studi: state.prodis.find((prodi) => prodi.id === row.program_studi_id),
  });
  const matches = (row, where) => {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.program_studi_id !== undefined && row.program_studi_id !== where.program_studi_id) return false;
    if (where.tahun_angkatan !== undefined && row.tahun_angkatan !== where.tahun_angkatan) return false;
    if (where.user?.status_akun &&
        state.users.find((user) => user.id === row.user_id)?.status_akun !== where.user.status_akun) return false;
    if (!where.OR) return true;
    return where.OR.some((clause) =>
      clause.nim?.contains && row.nim.includes(clause.nim.contains) ||
      clause.nama_lengkap?.contains && row.nama_lengkap.toLowerCase().includes(clause.nama_lengkap.contains.toLowerCase())
    );
  };
  const prisma = {
    state,
    programStudi: {
      async findMany({ take }) { return state.prodis.slice(0, take); },
    },
    user: {
      async findUnique({ where }) {
        return state.users.find((user) => user.id === where.id) ?? null;
      },
      async create({ data }) {
        if (state.users.some((user) => user.login_id === data.login_id || user.email === data.email)) {
          throw { code: 'P2002' };
        }
        const user = { id: state.users.length + 1, ...data, user_roles_diperoleh: [] };
        state.users.push(user);
        return user;
      },
      async update({ where, data }) {
        if (state.users.some((user) => user.id !== where.id && user.email === data.email)) {
          throw { code: 'P2002' };
        }
        const user = state.users.find((candidate) => candidate.id === where.id);
        Object.assign(user, data);
        return user;
      },
    },
    role: { async findUnique() { return { id: 2 }; } },
    userRole: {
      async create({ data }) {
        state.userRoles.push({ ...data });
        return data;
      },
    },
    authSession: {
      async findFirst({ where }) {
        return state.sessions.find((session) => session.id === where.id && session.user_id === where.user_id &&
          session.revoked_at === null && session.expires_at > where.expires_at.gt) ?? null;
      },
    },
    mahasiswa: {
      async findMany({ where, skip, take }) {
        return state.mahasiswa.filter((row) => matches(row, where)).slice(skip, skip + take).map(materialize);
      },
      async count({ where }) { return state.mahasiswa.filter((row) => matches(row, where)).length; },
      async findFirst({ where }) {
        const row = state.mahasiswa.find((candidate) => matches(candidate, where));
        return row ? materialize(row) : null;
      },
      async create({ data }) {
        if (failProfile) throw new Error('simulated profile failure');
        if (state.mahasiswa.some((row) => row.nim === data.nim)) throw { code: 'P2002' };
        const row = { id: state.mahasiswa.length + 1, ...data, status_data: 'AKTIF',
          created_at: new Date(), updated_at: new Date() };
        state.mahasiswa.push(row);
        return materialize(row);
      },
      async update({ where, data }) {
        const row = state.mahasiswa.find((candidate) => candidate.id === where.id);
        Object.assign(row, data);
        return materialize(row);
      },
    },
    async $transaction(action) {
      if (Array.isArray(action)) return Promise.all(action);
      const snapshot = structuredClone(state);
      try { return await action(prisma); } catch (error) {
        for (const key of Object.keys(state)) state[key] = snapshot[key];
        throw error;
      }
    },
  };
  return prisma;
}

async function withServer(prisma, run) {
  const server = createApp({ prisma }).listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const token = (await signAccessToken(1, prisma.state.sessions[0].id, 'ADMIN_PRODI', 0)).token;
    await run(base, token);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(base, token, path = '', method = 'GET', body) {
  const response = await fetch(`${base}/api/master/mahasiswa${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

const payload = {
  program_studi_id: 1,
  nim: '522001999',
  email: 'student@example.test',
  nama_lengkap: 'Mahasiswa Uji',
  tanggal_lahir: '2002-03-04',
  tahun_angkatan: 2023,
};

test('master mahasiswa: POST, list, detail, PATCH dan password awal', async () => {
  const prisma = fakePrisma();
  await withServer(prisma, async (base, token) => {
    const created = await request(base, token, '', 'POST', payload);
    assert.equal(created.status, 201);
    assert.equal(created.body.data.nim, payload.nim);
    assert.equal(JSON.stringify(created.body).includes('password_hash'), false);
    assert.equal(prisma.state.users[1].login_id, payload.nim);
    assert.equal(await verifyPassword('04032002', prisma.state.users[1].password_hash), true);
    assert.equal(prisma.state.userRoles[0].assigned_by_user_id, 1);
    const originalHash = prisma.state.users[1].password_hash;

    const listed = await request(base, token, '?page=1&limit=5&search=mahasiswa');
    assert.equal(listed.status, 200);
    assert.equal(listed.body.meta.pagination.total_items, 1);
    assert.deepEqual(listed.body.meta.summary, { total: 1, aktif: 1, nonaktif: 0 });
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].tahun_angkatan, 2023);

    const filterAngkatanMatch = await request(base, token, '?tahun_angkatan=2023');
    assert.equal(filterAngkatanMatch.status, 200);
    assert.equal(filterAngkatanMatch.body.meta.pagination.total_items, 1);

    const filterAngkatanAlias = await request(base, token, '?angkatan=2023');
    assert.equal(filterAngkatanAlias.status, 200);
    assert.equal(filterAngkatanAlias.body.meta.pagination.total_items, 1);

    const filterAngkatanMismatch = await request(base, token, '?tahun_angkatan=2020');
    assert.equal(filterAngkatanMismatch.status, 200);
    assert.equal(filterAngkatanMismatch.body.meta.pagination.total_items, 0);

    const filterAngkatanInvalid = await request(base, token, '?tahun_angkatan=bukan_angka');
    assert.equal(filterAngkatanInvalid.status, 400);

    assert.equal((await request(base, token, '/1')).body.data.email, payload.email);
    assert.equal((await request(base, token, '/999')).status, 404);

    const patched = await request(base, token, '/1', 'PATCH', {
      email: 'new@example.test', tanggal_lahir: '2001-12-05', nama_lengkap: 'Nama Baru',
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.nama_lengkap, 'Nama Baru');
    assert.equal(prisma.state.users[1].password_hash, originalHash);
    assert.equal(JSON.stringify(patched.body).includes('password_hash'), false);
  });
});

test('ringkasan seluruh prodi tetap akurat melampaui 100 data dan tidak terpengaruh filter', async () => {
  const prisma = fakePrisma();
  for (let index = 0; index < 125; index += 1) {
    const userId = index + 2;
    prisma.state.users.push({ id: userId,
      status_akun: index < 118 ? 'AKTIF' : 'NONAKTIF' });
    prisma.state.mahasiswa.push({ id: index + 1, user_id: userId,
      program_studi_id: 1, nim: String(index + 1).padStart(8, '0'),
      nama_lengkap: `Mahasiswa ${index + 1}`, tahun_angkatan: 2024 });
  }
  await withServer(prisma, async (base, token) => {
    const firstPage = await request(base, token, '?page=1&limit=20');
    assert.equal(firstPage.status, 200);
    assert.equal(firstPage.body.data.length, 20);
    assert.equal(firstPage.body.meta.pagination.total_items, 125);
    assert.deepEqual(firstPage.body.meta.summary, { total: 125, aktif: 118, nonaktif: 7 });

    const filtered = await request(base, token, '?search=tidak-ada');
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.meta.pagination.total_items, 0);
    assert.deepEqual(filtered.body.meta.summary, { total: 125, aktif: 118, nonaktif: 7 });
  });
});

test('master mahasiswa: duplikat dan input tidak sah ditolak', async () => {
  const prisma = fakePrisma();
  await withServer(prisma, async (base, token) => {
    assert.equal((await request(base, token, '', 'POST', payload)).status, 201);
    const duplicate = await request(base, token, '', 'POST', payload);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'MAHASISWA_DUPLICATE');
    assert.equal(prisma.state.users.length, 2);
    assert.equal((await request(base, token, '', 'POST', { ...payload, nim: 'abc' })).status, 400);
    assert.equal((await request(base, token, '', 'POST', { ...payload, email: 'bad' })).status, 400);
    assert.equal((await request(base, token, '?limit=101')).status, 400);
    assert.equal((await request(base, token, '', 'POST', { ...payload, nim: '522001998', email: 'other@example.test', program_studi_id: 2 })).status, 403);
    assert.equal((await request(base, token, '', 'POST', { ...payload, nim: '522001998', email: 'other@example.test', tanggal_lahir: '2002-02-30' })).status, 400);
    assert.equal((await request(base, token, '/1', 'PATCH', { nim: '522001888' })).status, 400);
  });
});

test('master mahasiswa: kegagalan pembuatan profil me-rollback User dan UserRole', async () => {
  const prisma = fakePrisma({ failProfile: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    await withServer(prisma, async (base, token) => {
      const result = await request(base, token, '', 'POST', payload);
      assert.equal(result.status, 500);
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(prisma.state.users.length, 1);
  assert.equal(prisma.state.userRoles.length, 0);
  assert.equal(prisma.state.mahasiswa.length, 0);
});

test('master mahasiswa: tanpa login, role lain, dan lebih dari satu prodi ditolak', async () => {
  const prisma = fakePrisma();
  await withServer(prisma, async (base, token) => {
    assert.equal((await request(base, null)).status, 401);
    prisma.state.sessions[0].active_role = { kode_peran: 'MAHASISWA' };
    assert.equal((await request(base, token)).status, 401);
    prisma.state.users[0].user_roles_diperoleh.push({ role: { id: 2, kode_peran: 'MAHASISWA' } });
    const studentToken = (await signAccessToken(1, prisma.state.sessions[0].id, 'MAHASISWA', 0)).token;
    assert.equal((await request(base, studentToken)).status, 403);
    assert.equal((await request(base, studentToken, '', 'POST', payload)).status, 403);
  });
  const multiProdi = fakePrisma({ prodiIds: [1, 2] });
  await withServer(multiProdi, async (base, token) => {
    const result = await request(base, token);
    assert.equal(result.status, 403);
    assert.equal((await request(base, token, '', 'POST', payload)).status, 403);
  });
});
