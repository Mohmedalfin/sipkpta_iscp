import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeJwt, SignJWT } from 'jose';

import { createApp } from '../src/app.js';
import { authorizeRoles } from '../src/middlewares/authorizeRoles.js';
import { getJwtConfig, signAccessToken } from '../src/security/jwt.js';
import { hashPassword } from '../src/security/password.js';
import { hashRefreshToken } from '../src/security/refreshToken.js';

process.env.JWT_ACCESS_SECRET_BASE64 ||= randomBytes(32).toString('base64url');

const password = 'SIPKITA-test-password';

async function withServer(prisma, run) {
  const server = createApp({ prisma }).listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    await run(baseUrl);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

function createFakePrisma(users, sessions = []) {
  const refreshTokens = [];
  const roleIds = new Map();
  for (const user of users) {
    for (const membership of user.user_roles_diperoleh ?? []) {
      const code = membership.role.kode_peran;
      if (!roleIds.has(code)) roleIds.set(code, roleIds.size + 1);
      membership.role.id ??= roleIds.get(code);
    }
  }
  const withActiveRole = (session) => session ? {
    ...session,
    active_role: session.active_role_id == null ? null : {
      kode_peran: [...roleIds].find(([, id]) => id === session.active_role_id)?.[0] ?? null,
    },
  } : null;
  const prisma = {
    user: {
      async findUnique({ where }) {
        return users.find((user) =>
          where.id !== undefined ? user.id === where.id : user.login_id === where.login_id
        ) ?? null;
      },
    },
    userRole: {
      async findFirst({ where }) {
        const user = users.find((candidate) => candidate.id === where.user_id);
        const membership = user?.user_roles_diperoleh.find(
          (item) => item.role.kode_peran === where.role.kode_peran
        );
        return membership ? { role: membership.role } : null;
      },
    },
    authSession: {
      async create({ data }) {
        sessions.push({ ...data, role_version: data.role_version ?? 0, revoked_at: null });
        return data;
      },
      async findFirst({ where }) {
        return withActiveRole(sessions.find((session) => session.id === where.id &&
          session.user_id === where.user_id && session.revoked_at === null &&
          session.expires_at > where.expires_at.gt) ?? null);
      },
      async updateMany({ where, data }) {
        const matched = sessions.filter((session) => session.id === where.id &&
          (where.user_id === undefined || session.user_id === where.user_id) &&
          session.revoked_at === where.revoked_at);
        for (const session of matched) Object.assign(session, data);
        return { count: matched.length };
      },
      async updateManyAndReturn({ where, data }) {
        const matched = sessions.filter((session) => session.id === where.id &&
          session.user_id === where.user_id && session.revoked_at === where.revoked_at &&
          session.expires_at > where.expires_at.gt);
        for (const session of matched) {
          session.active_role_id = data.active_role_id;
          session.role_version += data.role_version.increment;
        }
        return matched.map((session) => ({ role_version: session.role_version }));
      },
    },
    refreshToken: {
      async create({ data }) {
        refreshTokens.push({ ...data, used_at: null });
        return data;
      },
      async findUnique({ where }) {
        const token = refreshTokens.find((item) => item.token_hash === where.token_hash);
        return token ? { ...token, session: withActiveRole(sessions.find((item) => item.id === token.session_id)) } : null;
      },
      async updateMany({ where, data }) {
        const matched = refreshTokens.filter((item) => item.id === where.id && item.used_at === where.used_at);
        for (const token of matched) Object.assign(token, data);
        return { count: matched.length };
      },
    },
    async $transaction(run) { return run(prisma); },
  };
  return prisma;
}

function loginRequest(baseUrl, loginId, candidatePassword) {
  return request(baseUrl, '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_id: loginId, password: candidatePassword }),
  });
}

function meRequest(baseUrl, token) {
  return request(baseUrl, '/api/auth/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function refreshRequest(baseUrl, token) {
  return request(baseUrl, '/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  });
}

function logoutRequest(baseUrl, token) {
  return request(baseUrl, '/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function activeRoleRequest(baseUrl, token, role) {
  return request(baseUrl, '/api/auth/active-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role }),
  });
}

test('login dan me memakai role database terbaru tanpa mengirim hash', async () => {
  const hash = await hashPassword(password);
  const users = [{
    id: 7,
    login_id: '0000000003',
    password_hash: hash,
    status_akun: 'AKTIF',
    user_roles_diperoleh: [
      { role: { kode_peran: 'REVIEWER' } },
      { role: { kode_peran: 'PEMBIMBING' } },
    ],
  }];

  await withServer(createFakePrisma(users), async (baseUrl) => {
    const login = await loginRequest(baseUrl, users[0].login_id, password);
    assert.equal(login.status, 200);
    assert.equal(login.body.data.tokenType, 'Bearer');
    assert.equal(login.body.data.expiresIn, 900);
    assert.deepEqual(login.body.data.user.roles, ['PEMBIMBING', 'REVIEWER']);
    assert.equal(login.body.data.user.activeRole, null);
    assert.equal('password_hash' in login.body.data.user, false);
    const token = login.body.data.accessToken;

    const me = await meRequest(baseUrl, token);
    assert.equal(me.status, 200);
    assert.deepEqual(me.body.data.user.roles, ['PEMBIMBING', 'REVIEWER']);
    assert.equal('password_hash' in me.body.data.user, false);
    assert.equal(JSON.stringify(me.body).includes(token), false);

    users[0].user_roles_diperoleh.pop();
    const afterRevocation = await meRequest(baseUrl, token);
    assert.deepEqual(afterRevocation.body.data.user.roles, ['REVIEWER']);

    users[0].user_roles_diperoleh = [];
    assert.equal((await meRequest(baseUrl, token)).status, 401);

    users[0].status_akun = 'NONAKTIF';
    assert.equal((await meRequest(baseUrl, token)).status, 401);
  });
});

test('kredensial salah, user tak dikenal, nonaktif, tanpa role, dan body invalid ditolak', async () => {
  const hash = await hashPassword(password);
  const users = [{
    id: 1,
    login_id: 'admin.sistem',
    password_hash: hash,
    status_akun: 'AKTIF',
    user_roles_diperoleh: [{ role: { kode_peran: 'ADMIN_SISTEM' } }],
  }];

  await withServer(createFakePrisma(users), async (baseUrl) => {
    const wrong = await loginRequest(baseUrl, 'admin.sistem', `${password}-wrong`);
    const missing = await loginRequest(baseUrl, 'not-found', password);
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, missing.body);

    users[0].status_akun = 'NONAKTIF';
    assert.deepEqual((await loginRequest(baseUrl, 'admin.sistem', password)).body, wrong.body);
    users[0].status_akun = 'AKTIF';
    users[0].user_roles_diperoleh = [];
    assert.deepEqual((await loginRequest(baseUrl, 'admin.sistem', password)).body, wrong.body);

  });

  await withServer(createFakePrisma(users), async (baseUrl) => {
    const invalid = await loginRequest(baseUrl, 123, password);
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
    const extra = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: 'admin.sistem', password, role: 'KAPRODI' }),
    });
    assert.equal(extra.status, 400);
  });
});

test('rate limit login menolak percobaan keenam', async () => {
  await withServer(createFakePrisma([]), async (baseUrl) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.equal((await loginRequest(baseUrl, 'unknown', password)).status, 401);
    }
    const limited = await loginRequest(baseUrl, 'unknown', password);
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, 'RATE_LIMITED');
  });
});

test('login valid tetap diterima setelah lima percobaan gagal dari IP yang sama', async () => {
  const user = {
    id: 43,
    login_id: 'mahasiswa43',
    password_hash: await hashPassword(password),
    status_akun: 'AKTIF',
    user_roles_diperoleh: [{ role: { kode_peran: 'MAHASISWA' } }],
  };

  await withServer(createFakePrisma([user]), async (baseUrl) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.equal((await loginRequest(baseUrl, user.login_id, `${password}-wrong`)).status, 401);
    }

    const valid = await loginRequest(baseUrl, user.login_id, password);
    assert.equal(valid.status, 200);
    assert.equal(valid.body.data.user.login_id, user.login_id);

    const limited = await loginRequest(baseUrl, user.login_id, `${password}-wrong`);
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, 'RATE_LIMITED');
  });
});

test('refresh merotasi token, reuse mencabut sesi, dan logout memutus access token', async () => {
  const hash = await hashPassword(password);
  const user = {
    id: 42, login_id: 'mahasiswa42', password_hash: hash, status_akun: 'AKTIF',
    user_roles_diperoleh: [{ role: { kode_peran: 'MAHASISWA' } }],
  };
  const prisma = createFakePrisma([user]);
  await withServer(prisma, async (baseUrl) => {
    const login = await loginRequest(baseUrl, user.login_id, password);
    assert.equal(login.status, 200);
    assert.equal(login.body.data.user.activeRole, 'MAHASISWA');
    assert.ok(login.body.data.refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token_hash: hashRefreshToken(login.body.data.refreshToken) },
    });
    assert.ok(storedToken);
    assert.notEqual(storedToken.token_hash, login.body.data.refreshToken);
    assert.equal('refreshToken' in storedToken, false);
    assert.equal((await meRequest(baseUrl, login.body.data.accessToken)).status, 200);

    const rotated = await refreshRequest(baseUrl, login.body.data.refreshToken);
    assert.equal(rotated.status, 200);
    assert.notEqual(rotated.body.data.refreshToken, login.body.data.refreshToken);
    assert.equal((await meRequest(baseUrl, rotated.body.data.accessToken)).status, 200);

    const reused = await refreshRequest(baseUrl, login.body.data.refreshToken);
    assert.equal(reused.status, 401);
    assert.equal(reused.body.error.code, 'REFRESH_TOKEN_REUSED');
    assert.equal((await meRequest(baseUrl, rotated.body.data.accessToken)).status, 401);
    assert.equal((await refreshRequest(baseUrl, rotated.body.data.refreshToken)).status, 401);

    const secondLogin = await loginRequest(baseUrl, user.login_id, password);
    assert.equal(secondLogin.status, 200);
    assert.equal((await logoutRequest(baseUrl, secondLogin.body.data.accessToken)).status, 204);
    assert.equal((await meRequest(baseUrl, secondLogin.body.data.accessToken)).status, 401);
    assert.equal((await refreshRequest(baseUrl, secondLogin.body.data.refreshToken)).status, 401);
  });
});

test('role aktif dapat dipilih, diganti, dipertahankan saat refresh, dan dibatasi kepemilikannya', async () => {
  const hash = await hashPassword(password);
  const user = {
    id: 44, login_id: 'dosen44', password_hash: hash, status_akun: 'AKTIF',
    user_roles_diperoleh: [
      { role: { kode_peran: 'REVIEWER' } },
      { role: { kode_peran: 'PEMBIMBING' } },
    ],
  };
  await withServer(createFakePrisma([user]), async (baseUrl) => {
    const login = await loginRequest(baseUrl, user.login_id, password);
    assert.equal(login.status, 200);
    assert.equal(login.body.data.user.activeRole, null);
    assert.equal((await meRequest(baseUrl, login.body.data.accessToken)).body.data.user.activeRole, null);

    const reviewer = await activeRoleRequest(baseUrl, login.body.data.accessToken, 'REVIEWER');
    assert.equal(reviewer.status, 200);
    assert.equal(reviewer.body.data.user.activeRole, 'REVIEWER');
    assert.equal((await meRequest(baseUrl, login.body.data.accessToken)).status, 401);
    assert.equal((await meRequest(baseUrl, reviewer.body.data.accessToken)).body.data.user.activeRole, 'REVIEWER');

    const notOwned = await activeRoleRequest(baseUrl, reviewer.body.data.accessToken, 'KAPRODI');
    assert.equal(notOwned.status, 403);
    assert.equal(notOwned.body.error.code, 'ROLE_NOT_OWNED');

    const pembimbing = await activeRoleRequest(baseUrl, reviewer.body.data.accessToken, 'PEMBIMBING');
    assert.equal(pembimbing.status, 200);
    assert.equal(pembimbing.body.data.user.activeRole, 'PEMBIMBING');
    assert.equal((await meRequest(baseUrl, reviewer.body.data.accessToken)).status, 401);

    const reviewerAgain = await activeRoleRequest(
      baseUrl,
      pembimbing.body.data.accessToken,
      'REVIEWER'
    );
    assert.equal(reviewerAgain.status, 200);
    assert.equal(reviewerAgain.body.data.user.activeRole, 'REVIEWER');
    assert.equal((await meRequest(baseUrl, reviewer.body.data.accessToken)).status, 401);
    assert.equal((await meRequest(baseUrl, pembimbing.body.data.accessToken)).status, 401);

    const refreshed = await refreshRequest(baseUrl, login.body.data.refreshToken);
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.body.data.user.activeRole, 'REVIEWER');
    assert.equal((await meRequest(baseUrl, refreshed.body.data.accessToken)).body.data.user.activeRole, 'REVIEWER');
    assert.equal((await logoutRequest(baseUrl, refreshed.body.data.accessToken)).status, 204);
    assert.equal((await meRequest(baseUrl, refreshed.body.data.accessToken)).status, 401);
  });
});

test('refresh/logout menolak token invalid dan sesi kedaluwarsa', async () => {
  const hash = await hashPassword(password);
  const user = {
    id: 43, login_id: 'mahasiswa43', password_hash: hash, status_akun: 'AKTIF',
    user_roles_diperoleh: [{ role: { kode_peran: 'MAHASISWA' } }],
  };
  const sessions = [];
  await withServer(createFakePrisma([user], sessions), async (baseUrl) => {
    assert.equal((await refreshRequest(baseUrl, 'bad')).status, 400);
    assert.equal((await refreshRequest(baseUrl, randomBytes(32).toString('base64url'))).status, 401);
    assert.equal((await logoutRequest(baseUrl, 'bad')).status, 401);
    const login = await loginRequest(baseUrl, user.login_id, password);
    assert.equal(login.status, 200);
    sessions[0].expires_at = new Date(Date.now() - 1000);
    assert.equal((await refreshRequest(baseUrl, login.body.data.refreshToken)).status, 401);
    assert.equal((await meRequest(baseUrl, login.body.data.accessToken)).status, 401);
  });
});

test('token hilang, rusak, tanda tangan salah, expired, iss, aud, dan alg salah ditolak', async () => {
  const user = {
    id: 10,
    login_id: '522001001',
    status_akun: 'AKTIF',
    user_roles_diperoleh: [{ role: { kode_peran: 'MAHASISWA' } }],
  };
  const config = getJwtConfig();
  const sessionId = randomUUID();
  const good = (await signAccessToken(user.id, sessionId)).token;
  const makeToken = (claims = {}, key = config.secret, alg = 'HS256') => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ sid: sessionId, role: null, role_version: 0 })
      .setProtectedHeader({ alg })
      .setSubject(String(user.id))
      .setIssuer(claims.issuer ?? config.issuer)
      .setAudience(claims.audience ?? config.audience)
      .setIssuedAt(claims.issuedAt ?? now)
      .setExpirationTime(claims.expiresAt ?? now + 60)
      .setJti(randomUUID())
      .sign(key);
  };

  await withServer(createFakePrisma([user], [{
    id: sessionId, user_id: user.id, role_version: 0, revoked_at: null,
    expires_at: new Date(Date.now() + 60_000),
  }]), async (baseUrl) => {
    assert.equal((await meRequest(baseUrl)).status, 401);
    assert.equal((await meRequest(baseUrl, 'broken')).status, 401);
    const [header, payload, signature] = good.split('.');
    const changedSignature = `${header}.${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    assert.equal((await meRequest(baseUrl, changedSignature)).status, 401);
    assert.equal((await meRequest(baseUrl, await makeToken({}, randomBytes(32)))).status, 401);
    assert.equal((await meRequest(baseUrl, await makeToken({ expiresAt: 1 }))).status, 401);
    assert.equal((await meRequest(baseUrl, await makeToken({ issuer: 'other' }))).status, 401);
    assert.equal((await meRequest(baseUrl, await makeToken({ audience: 'other' }))).status, 401);
    assert.equal((await meRequest(baseUrl, await makeToken({}, config.secret, 'HS384'))).status, 401);
    const now = Math.floor(Date.now() / 1000);
    const missingJti = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.id))
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(config.secret);
    assert.equal((await meRequest(baseUrl, missingJti)).status, 401);
    assert.equal((await meRequest(baseUrl, good)).status, 200);
  });
});

test('authorizeRoles hanya memakai role aktif', () => {
  const middleware = authorizeRoles('REVIEWER', 'PEMBIMBING');
  const response = () => ({
    code: null,
    body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const user = {
    auth: {
      activeRole: 'REVIEWER',
      user: { roles: ['REVIEWER', 'PEMBIMBING'], activeRole: 'REVIEWER' },
    },
  };
  let nextCalled = false;
  authorizeRoles('REVIEWER')(user, response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  const inactiveOwnedRole = response();
  authorizeRoles('PEMBIMBING')(user, inactiveOwnedRole, () => assert.fail('must deny'));
  assert.equal(inactiveOwnedRole.code, 403);

  const forbidden = response();
  authorizeRoles('KAPRODI')(user, forbidden, () => assert.fail('must deny'));
  assert.equal(forbidden.code, 403);

  const noAllowedRoles = response();
  authorizeRoles()(user, noAllowedRoles, () => assert.fail('must deny'));
  assert.equal(noAllowedRoles.code, 403);

  const noActiveRole = response();
  middleware({ auth: { activeRole: null, user: { roles: ['REVIEWER', 'PEMBIMBING'] } } }, noActiveRole, () => assert.fail('must deny'));
  assert.equal(noActiveRole.code, 403);

  const anonymous = response();
  middleware({}, anonymous, () => assert.fail('must deny'));
  assert.equal(anonymous.code, 401);
});

test('error internal auth tidak membocorkan nilai sensitif ke respons atau log', async () => {
  const sensitiveMarker = 'sensitive-test-marker';
  const prisma = {
    user: {
      async findUnique() {
        throw new Error(sensitiveMarker);
      },
    },
  };
  const originalError = console.error;
  const logged = [];
  console.error = (...values) => logged.push(values.join(' '));
  try {
    await withServer(prisma, async (baseUrl) => {
      const result = await loginRequest(baseUrl, 'admin.sistem', password);
      assert.equal(result.status, 500);
      assert.equal(result.body.error.code, 'INTERNAL_ERROR');
      assert.equal(JSON.stringify(result.body).includes(sensitiveMarker), false);
      assert.equal(logged.join(' ').includes(sensitiveMarker), false);
    });
  } finally {
    console.error = originalError;
  }
});

test('empat fixture development menjalani alur auth dengan sesi uji terisolasi', {
  skip: process.env.SIPKITA_AUTH_REAL_DB !== '1',
}, async () => {
  const { getPrisma, disconnectPrisma } = await import('../src/config/prisma.js');
  const { USER_FIXTURES } = await import('../prisma/seed/users.js');
  const prisma = getPrisma();
  assert.ok(prisma);
  assert.ok(process.env.SIPKITA_DEV_SEED_PASSWORD);
  const createdSessionIds = [];

  try {
    const before = await prisma.user.findMany({
      select: { id: true, password_hash: true, status_akun: true, updated_at: true },
      orderBy: { id: 'asc' },
    });
    const beforeUserRoles = await prisma.userRole.count();
    const beforeSessionCount = await prisma.authSession.count();
    const beforeRefreshCount = await prisma.refreshToken.count();
    try {
      await withServer(prisma, async (baseUrl) => {
        for (const code of ['DEV_MHS_A', 'DEV_SYS_ADMIN', 'DEV_KAPRODI', 'DEV_DOSEN_C']) {
          const fixture = USER_FIXTURES.find((candidate) => candidate.kode_fixture === code);
          const result = await loginRequest(baseUrl, fixture.login_id, process.env.SIPKITA_DEV_SEED_PASSWORD);
          assert.equal(result.status, 200, `${code} login gagal`);
          createdSessionIds.push(decodeJwt(result.body.data.accessToken).sid);
          assert.ok(result.body.data.user.roles.length > 0);
          const me = await meRequest(baseUrl, result.body.data.accessToken);
          assert.equal(me.status, 200);
          assert.equal(me.body.data.user.login_id, fixture.login_id);
          if (code === 'DEV_MHS_A') {
            const refreshed = await refreshRequest(baseUrl, result.body.data.refreshToken);
            assert.equal(refreshed.status, 200);
            assert.equal((await meRequest(baseUrl, refreshed.body.data.accessToken)).status, 200);
            const reused = await refreshRequest(baseUrl, result.body.data.refreshToken);
            assert.equal(reused.status, 401);
            assert.equal(reused.body.error.code, 'REFRESH_TOKEN_REUSED');
            assert.equal((await meRequest(baseUrl, refreshed.body.data.accessToken)).status, 401);
            assert.equal((await refreshRequest(baseUrl, refreshed.body.data.refreshToken)).status, 401);
          } else if (code === 'DEV_DOSEN_C') {
            assert.equal(result.body.data.user.activeRole, null);
            const reviewer = await activeRoleRequest(
              baseUrl,
              result.body.data.accessToken,
              'REVIEWER'
            );
            assert.equal(reviewer.status, 200);
            assert.equal((await meRequest(baseUrl, result.body.data.accessToken)).status, 401);
            const notOwned = await activeRoleRequest(
              baseUrl,
              reviewer.body.data.accessToken,
              'KAPRODI'
            );
            assert.equal(notOwned.status, 403);
            const pembimbing = await activeRoleRequest(
              baseUrl,
              reviewer.body.data.accessToken,
              'PEMBIMBING'
            );
            assert.equal(pembimbing.status, 200);
            assert.equal((await meRequest(baseUrl, reviewer.body.data.accessToken)).status, 401);
            const reviewerAgain = await activeRoleRequest(
              baseUrl,
              pembimbing.body.data.accessToken,
              'REVIEWER'
            );
            assert.equal(reviewerAgain.status, 200);
            assert.equal((await meRequest(baseUrl, reviewer.body.data.accessToken)).status, 401);
            assert.equal((await meRequest(baseUrl, pembimbing.body.data.accessToken)).status, 401);
            const refreshed = await refreshRequest(baseUrl, result.body.data.refreshToken);
            assert.equal(refreshed.status, 200);
            assert.equal(refreshed.body.data.user.activeRole, 'REVIEWER');
            assert.equal((await logoutRequest(baseUrl, refreshed.body.data.accessToken)).status, 204);
            assert.equal((await meRequest(baseUrl, refreshed.body.data.accessToken)).status, 401);
          } else {
            assert.equal(result.body.data.user.activeRole, fixture.roles[0]);
            assert.equal((await logoutRequest(baseUrl, result.body.data.accessToken)).status, 204);
          }
        }
      });
    } finally {
      if (createdSessionIds.length > 0) {
        await prisma.refreshToken.deleteMany({ where: { session_id: { in: createdSessionIds } } });
        await prisma.authSession.deleteMany({ where: { id: { in: createdSessionIds } } });
      }
    }
    const after = await prisma.user.findMany({
      select: { id: true, password_hash: true, status_akun: true, updated_at: true },
      orderBy: { id: 'asc' },
    });
    assert.deepEqual(after, before);
    assert.equal(await prisma.userRole.count(), beforeUserRoles);
    assert.equal(await prisma.authSession.count(), beforeSessionCount);
    assert.equal(await prisma.refreshToken.count(), beforeRefreshCount);
  } finally {
    await disconnectPrisma();
  }
});
