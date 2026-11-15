import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { login } from '../src/services/auth.service.js';
import { signAccessToken } from '../src/security/jwt.js';
import { verifyPassword } from '../src/security/password.js';

process.env.JWT_ACCESS_SECRET_BASE64 ||= randomBytes(32).toString('base64url');

function fakePrisma({ prodiIds = [1], failProfile = false } = {}) {
  const state = {
    prodis: prodiIds.map((id) => ({ id, kode_prodi: `P${id}`, nama_prodi: `Prodi ${id}` })),
    users: [{ id: 1, login_id: 'admin.prodi', email: 'admin@example.test', status_akun: 'AKTIF',
      user_roles_diperoleh: [{ role: { id: 1, kode_peran: 'ADMIN_PRODI' } }] }],
    dosen: [],
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
    if (where.is_homebase_si !== undefined && row.is_homebase_si !== where.is_homebase_si) return false;
    if (where.user?.status_akun &&
        state.users.find((user) => user.id === row.user_id)?.status_akun !== where.user.status_akun) return false;
    if (!where.OR) return true;
    return where.OR.some((clause) =>
      clause.kode_dosen?.contains && row.kode_dosen.toLowerCase().includes(clause.kode_dosen.contains.toLowerCase()) ||
      clause.nidn?.contains && row.nidn?.includes(clause.nidn.contains) ||
      clause.nama_lengkap?.contains && row.nama_lengkap.toLowerCase().includes(clause.nama_lengkap.contains.toLowerCase())
    );
  };
  const prisma = {
    state,
    programStudi: { async findMany({ take }) { return state.prodis.slice(0, take); } },
    user: {
      async findUnique({ where }) {
        return state.users.find((user) =>
          where.id !== undefined ? user.id === where.id : user.login_id === where.login_id
        ) ?? null;
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
    authSession: {
      async findFirst({ where }) {
        return state.sessions.find((session) => session.id === where.id && session.user_id === where.user_id &&
          session.revoked_at === null && session.expires_at > where.expires_at.gt) ?? null;
      },
    },
    dosen: {
      async findMany({ where, skip, take }) {
        return state.dosen.filter((row) => matches(row, where)).slice(skip, skip + take).map(materialize);
      },
      async count({ where }) { return state.dosen.filter((row) => matches(row, where)).length; },
      async findFirst({ where }) {
        const row = state.dosen.find((candidate) => matches(candidate, where));
        return row ? materialize(row) : null;
      },
      async create({ data }) {
        if (failProfile) throw new Error('simulated profile failure');
        if (state.dosen.some((row) => row.kode_dosen === data.kode_dosen ||
            data.nidn && row.nidn === data.nidn)) throw { code: 'P2002' };
        const row = { id: state.dosen.length + 1, ...data, status_data: 'AKTIF',
          created_at: new Date(), updated_at: new Date() };
        state.dosen.push(row);
        return materialize(row);
      },
      async update({ where, data }) {
        const row = state.dosen.find((candidate) => candidate.id === where.id);
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
  const response = await fetch(`${base}/api/master/dosen${path}`, {
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
  kode_dosen: 'DSN001',
  nidn: '0123456789',
  email: 'dosen@example.test',
  nama_lengkap: 'Dosen Uji',
  tanggal_lahir: '1980-04-05',
};

test('master dosen: POST, list, detail, PATCH dan akun awal tanpa role', async () => {
  const prisma = fakePrisma();
  await withServer(prisma, async (base, token) => {
    const created = await request(base, token, '', 'POST', payload);
    assert.equal(created.status, 201);
    assert.equal(created.body.data.kode_dosen, payload.kode_dosen);
    assert.equal(JSON.stringify(created.body).includes('password_hash'), false);
    assert.equal(prisma.state.users[1].login_id, payload.kode_dosen);
    assert.equal(prisma.state.users[1].user_roles_diperoleh.length, 0);
    assert.equal(await verifyPassword('05041980', prisma.state.users[1].password_hash), true);
    assert.equal(await login(prisma, payload.kode_dosen, '05041980'), null);
    const originalHash = prisma.state.users[1].password_hash;

    const listed = await request(base, token, '?page=1&limit=5&search=dosen');
    assert.equal(listed.status, 200);
    assert.equal(listed.body.meta.pagination.total_items, 1);
    assert.deepEqual(listed.body.meta.summary,
      { total: 1, aktif: 1, nonaktif: 0, homebase: 0 });
    assert.equal(listed.body.data.length, 1);
    assert.equal((await request(base, token, '/1')).body.data.email, payload.email);
    assert.equal((await request(base, token, '/999')).status, 404);

    const patched = await request(base, token, '/1', 'PATCH', {
      email: 'baru@example.test', tanggal_lahir: '1981-12-06', nama_lengkap: 'Nama Baru',
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.nama_lengkap, 'Nama Baru');
    assert.equal(prisma.state.users[1].password_hash, originalHash);
    assert.equal(JSON.stringify(patched.body).includes('password_hash'), false);
  });
});

test('master dosen: duplikat, allowlist, dan input tidak sah ditolak', async () => {
  const prisma = fakePrisma();
  await withServer(prisma, async (base, token) => {
    assert.equal((await request(base, token, '', 'POST', payload)).status, 201);
    const duplicate = await request(base, token, '', 'POST', payload);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'DOSEN_DUPLICATE');
    assert.equal(prisma.state.users.length, 2);
    assert.equal((await request(base, token, '', 'POST', { ...payload, kode_dosen: 'bad code' })).status, 400);
    assert.equal((await request(base, token, '', 'POST', { ...payload, email: 'bad' })).status, 400);
    assert.equal((await request(base, token, '', 'POST', { ...payload, tanggal_lahir: '1980-02-30' })).status, 400);
    assert.equal((await request(base, token, '?limit=101')).status, 400);
    assert.equal((await request(base, token, '/1', 'PATCH', { kode_dosen: 'DSN002' })).status, 400);
    assert.equal((await request(base, token, '/1', 'PATCH', { roles: ['REVIEWER'] })).status, 400);
    assert.equal((await request(base, token, '', 'POST', {
      ...payload, kode_dosen: 'DSN002', email: 'other@example.test', program_studi_id: 2,
    })).status, 403);
  });
});

test('master dosen: kegagalan profil me-rollback User', async () => {
  const prisma = fakePrisma({ failProfile: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    await withServer(prisma, async (base, token) => {
      assert.equal((await request(base, token, '', 'POST', payload)).status, 500);
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(prisma.state.users.length, 1);
  assert.equal(prisma.state.dosen.length, 0);
});

test('master dosen: tanpa login, role lain, dan multi-prodi ditolak', async () => {
  const prisma = fakePrisma();
  await withServer(prisma, async (base, token) => {
    assert.equal((await request(base, null)).status, 401);
    prisma.state.sessions[0].active_role = { kode_peran: 'REVIEWER' };
    assert.equal((await request(base, token)).status, 401);
    prisma.state.users[0].user_roles_diperoleh.push({ role: { id: 2, kode_peran: 'REVIEWER' } });
    const reviewerToken = (await signAccessToken(1, prisma.state.sessions[0].id, 'REVIEWER', 0)).token;
    assert.equal((await request(base, reviewerToken)).status, 403);
    assert.equal((await request(base, reviewerToken, '', 'POST', payload)).status, 403);
  });
  const multiProdi = fakePrisma({ prodiIds: [1, 2] });
  await withServer(multiProdi, async (base, token) => {
    assert.equal((await request(base, token)).status, 403);
    assert.equal((await request(base, token, '', 'POST', payload)).status, 403);
  });
});
