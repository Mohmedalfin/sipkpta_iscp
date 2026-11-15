import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';

import { createApp } from '../src/app.js';
import { createMailService } from '../src/services/mail.service.js';
import { hashPassword, verifyPassword } from '../src/security/password.js';
import { createPasswordResetToken, hashPasswordResetToken } from '../src/security/resetToken.js';

process.env.JWT_ACCESS_SECRET_BASE64 ||= randomBytes(32).toString('base64url');

const oldPassword = 'Password-lama-aman';
const newPassword = 'Password-baru-aman';

async function withServer(prisma, mailService, run) {
  const server = createApp({ prisma, mailService }).listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(baseUrl, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function forgotRequest(baseUrl, email) {
  return request(baseUrl, '/api/auth/forgot-password', { email });
}

function resetRequest(baseUrl, token, password = newPassword) {
  return request(baseUrl, '/api/auth/reset-password', {
    token,
    newPassword: password,
    confirmPassword: password,
  });
}

function loginRequest(baseUrl, loginId, password) {
  return request(baseUrl, '/api/auth/login', { login_id: loginId, password });
}

function refreshRequest(baseUrl, refreshToken) {
  return request(baseUrl, '/api/auth/refresh', { refreshToken });
}

async function meRequest(baseUrl, accessToken) {
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { status: response.status, body: await response.json() };
}

function matches(value, condition) {
  if (condition === undefined) return true;
  if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
    return value === condition;
  }
  if ('not' in condition && value === condition.not) return false;
  if ('gt' in condition && !(value > condition.gt)) return false;
  if ('in' in condition && !condition.in.includes(value)) return false;
  return true;
}

function createFakePrisma(users, { tokens = [], sessions = [] } = {}) {
  const refreshTokens = [];
  let nextTokenId = tokens.reduce((maximum, token) => Math.max(maximum, token.id), 0) + 1;
  let transactionTail = Promise.resolve();
  const roleIds = new Map();
  for (const user of users) {
    for (const membership of user.user_roles_diperoleh ?? []) {
      const code = membership.role.kode_peran;
      if (!roleIds.has(code)) roleIds.set(code, roleIds.size + 1);
      membership.role.id ??= roleIds.get(code);
    }
  }

  const activeRole = (session) => session?.active_role_id == null ? null : {
    kode_peran: [...roleIds].find(([, id]) => id === session.active_role_id)?.[0] ?? null,
  };
  const tokenMatches = (token, where = {}) =>
    matches(token.id, where.id) && matches(token.user_id, where.user_id) &&
    matches(token.used_at, where.used_at) && matches(token.expires_at, where.expires_at) &&
    matches(token.created_at, where.created_at) && matches(token.token_hash, where.token_hash);

  const prisma = {
    state: { users, tokens, sessions, refreshTokens },
    user: {
      async findUnique({ where }) {
        return users.find((user) =>
          (where.id !== undefined && user.id === where.id) ||
          (where.email !== undefined && user.email === where.email) ||
          (where.login_id !== undefined && user.login_id === where.login_id)
        ) ?? null;
      },
      async update({ where, data }) {
        const user = users.find((candidate) => candidate.id === where.id);
        if (!user) throw new Error('user not found');
        Object.assign(user, data);
        return user;
      },
    },
    passwordResetToken: {
      async create({ data }) {
        const token = { id: nextTokenId++, created_at: new Date(), used_at: null, ...data };
        tokens.push(token);
        return token;
      },
      async findFirst({ where }) {
        return tokens.find((token) => tokenMatches(token, where)) ?? null;
      },
      async findUnique({ where }) {
        const token = tokens.find((candidate) => candidate.token_hash === where.token_hash);
        if (!token) return null;
        return { ...token, user: users.find((user) => user.id === token.user_id) };
      },
      async updateMany({ where, data }) {
        const matched = tokens.filter((token) => tokenMatches(token, where));
        for (const token of matched) Object.assign(token, data);
        return { count: matched.length };
      },
      async deleteMany({ where }) {
        const retained = tokens.filter((token) => !tokenMatches(token, where));
        const count = tokens.length - retained.length;
        tokens.splice(0, tokens.length, ...retained);
        return { count };
      },
    },
    authSession: {
      async create({ data }) {
        const session = { revoked_at: null, role_version: 0, ...data };
        sessions.push(session);
        return session;
      },
      async findFirst({ where }) {
        const session = sessions.find((candidate) =>
          matches(candidate.id, where.id) && matches(candidate.user_id, where.user_id) &&
          matches(candidate.revoked_at, where.revoked_at) && matches(candidate.expires_at, where.expires_at)
        );
        return session ? { ...session, active_role: activeRole(session) } : null;
      },
      async updateMany({ where, data }) {
        const matched = sessions.filter((session) =>
          matches(session.id, where.id) && matches(session.user_id, where.user_id) &&
          matches(session.revoked_at, where.revoked_at) && matches(session.expires_at, where.expires_at)
        );
        for (const session of matched) Object.assign(session, data);
        return { count: matched.length };
      },
    },
    refreshToken: {
      async create({ data }) {
        const token = { used_at: null, ...data };
        refreshTokens.push(token);
        return token;
      },
      async findUnique({ where }) {
        const token = refreshTokens.find((candidate) => candidate.token_hash === where.token_hash);
        if (!token) return null;
        const session = sessions.find((candidate) => candidate.id === token.session_id);
        return { ...token, session: { ...session, active_role: activeRole(session) } };
      },
      async updateMany({ where, data }) {
        const matched = refreshTokens.filter((token) =>
          matches(token.id, where.id) && matches(token.used_at, where.used_at)
        );
        for (const token of matched) Object.assign(token, data);
        return { count: matched.length };
      },
    },
    async $transaction(run) {
      const result = transactionTail.then(() => run(prisma));
      transactionTail = result.catch(() => {});
      return result;
    },
  };
  return prisma;
}

function createUser(overrides = {}) {
  return {
    id: 1,
    login_id: 'mahasiswa.test',
    email: 'mahasiswa@example.test',
    password_hash: '',
    password_changed_at: null,
    status_akun: 'AKTIF',
    mahasiswa: { tanggal_lahir: new Date('2000-01-02T00:00:00.000Z') },
    dosen: null,
    user_roles_diperoleh: [{ role: { kode_peran: 'MAHASISWA' } }],
    ...overrides,
  };
}

test('FP-01/FP-02: respons generik sama dan database hanya menyimpan hash token', async () => {
  const user = createUser({ password_hash: await hashPassword(oldPassword) });
  const prisma = createFakePrisma([user]);
  const delivered = [];
  const mailService = { async sendPasswordReset(message) { delivered.push(message); } };

  await withServer(prisma, mailService, async (baseUrl) => {
    const known = await forgotRequest(baseUrl, `  ${user.email.toUpperCase()}  `);
    const unknown = await forgotRequest(baseUrl, 'unknown@example.test');
    assert.equal(known.status, 200);
    assert.deepEqual(unknown, known);
  });

  assert.equal(delivered.length, 1);
  assert.equal(prisma.state.tokens.length, 1);
  assert.match(prisma.state.tokens[0].token_hash, /^[a-f0-9]{64}$/);
  assert.equal(prisma.state.tokens[0].token_hash, hashPasswordResetToken(delivered[0].token));
  assert.equal(JSON.stringify(prisma.state.tokens).includes(delivered[0].token), false);
});

test('FP-03/FP-06/FP-07/FP-10: reset mengganti password, mencabut sesi user A, dan menjaga user B serta role', async () => {
  const userA = createUser({ password_hash: await hashPassword(oldPassword) });
  const userB = createUser({
    id: 2,
    login_id: 'dosen.test',
    email: 'dosen@example.test',
    password_hash: await hashPassword('Password-user-B'),
    mahasiswa: null,
    dosen: { tanggal_lahir: new Date('1980-03-04T00:00:00.000Z') },
    user_roles_diperoleh: [
      { role: { kode_peran: 'REVIEWER' } },
      { role: { kode_peran: 'PEMBIMBING' } },
    ],
  });
  const userBHash = userB.password_hash;
  const prisma = createFakePrisma([userA, userB]);
  const userBRoles = structuredClone(userB.user_roles_diperoleh);
  let resetToken;
  const mailService = { async sendPasswordReset(message) { resetToken = message.token; } };

  await withServer(prisma, mailService, async (baseUrl) => {
    const loginA = await loginRequest(baseUrl, userA.login_id, oldPassword);
    const loginB = await loginRequest(baseUrl, userB.login_id, 'Password-user-B');
    assert.equal(loginA.status, 200);
    assert.equal(loginB.status, 200);
    await forgotRequest(baseUrl, userA.email);
    const reset = await resetRequest(baseUrl, resetToken);
    assert.equal(reset.status, 200);
    assert.equal('accessToken' in reset.body.data, false);
    assert.equal('refreshToken' in reset.body.data, false);
    assert.equal((await meRequest(baseUrl, loginA.body.data.accessToken)).status, 401);
    assert.equal((await refreshRequest(baseUrl, loginA.body.data.refreshToken)).status, 401);
    assert.equal((await meRequest(baseUrl, loginB.body.data.accessToken)).status, 200);
    assert.equal((await loginRequest(baseUrl, userA.login_id, oldPassword)).status, 401);
    assert.equal((await loginRequest(baseUrl, userA.login_id, newPassword)).status, 200);
  });

  assert.equal(await verifyPassword(newPassword, userA.password_hash), true);
  assert.equal(userB.password_hash, userBHash);
  assert.deepEqual(userB.user_roles_diperoleh, userBRoles);
  assert.equal(prisma.state.sessions.filter((session) => session.user_id === 2 && session.revoked_at).length, 0);
});

test('FP-04: token salah, kedaluwarsa, dan sudah digunakan ditolak tanpa mengubah password', async () => {
  const passwordHash = await hashPassword(oldPassword);
  const user = createUser({ password_hash: passwordHash });
  const expired = createPasswordResetToken();
  const used = createPasswordResetToken();
  const prisma = createFakePrisma([user], { tokens: [
    { id: 1, user_id: 1, token_hash: hashPasswordResetToken(expired), expires_at: new Date(Date.now() - 1), used_at: null, created_at: new Date(Date.now() - 120000) },
    { id: 2, user_id: 1, token_hash: hashPasswordResetToken(used), expires_at: new Date(Date.now() + 60000), used_at: new Date(), created_at: new Date(Date.now() - 120000) },
  ] });

  await withServer(prisma, { async sendPasswordReset() {} }, async (baseUrl) => {
    assert.equal((await resetRequest(baseUrl, createPasswordResetToken())).status, 400);
    assert.equal((await resetRequest(baseUrl, expired)).status, 400);
    assert.equal((await resetRequest(baseUrl, used)).status, 400);
  });
  assert.equal(user.password_hash, passwordHash);
});

test('FP-05: dua reset bersamaan dengan token sama menghasilkan tepat satu keberhasilan', async () => {
  const user = createUser({ password_hash: await hashPassword(oldPassword) });
  const rawToken = createPasswordResetToken();
  const prisma = createFakePrisma([user], { tokens: [{
    id: 1,
    user_id: 1,
    token_hash: hashPasswordResetToken(rawToken),
    expires_at: new Date(Date.now() + 60000),
    used_at: null,
    created_at: new Date(Date.now() - 120000),
  }] });

  await withServer(prisma, { async sendPasswordReset() {} }, async (baseUrl) => {
    const results = await Promise.all([
      resetRequest(baseUrl, rawToken),
      resetRequest(baseUrl, rawToken),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
  });
});

test('FP-08: cooldown, rate limit per email, dan rate limit per IP bekerja', async () => {
  const user = createUser({ password_hash: await hashPassword(oldPassword) });
  const prisma = createFakePrisma([user]);
  let sent = 0;
  const mailService = { async sendPasswordReset() { sent += 1; } };

  await withServer(prisma, mailService, async (baseUrl) => {
    assert.equal((await forgotRequest(baseUrl, user.email)).status, 200);
    assert.equal((await forgotRequest(baseUrl, user.email)).status, 200);
    assert.equal((await forgotRequest(baseUrl, user.email)).status, 200);
    assert.equal((await forgotRequest(baseUrl, user.email)).status, 429);
  });
  assert.equal(sent, 1);
  assert.equal(prisma.state.tokens.length, 1);

  await withServer(createFakePrisma([]), mailService, async (baseUrl) => {
    for (let index = 0; index < 10; index += 1) {
      assert.equal((await forgotRequest(baseUrl, `unknown-${index}@example.test`)).status, 200);
    }
    assert.equal((await forgotRequest(baseUrl, 'unknown-10@example.test')).status, 429);
  });
});

test('FP-09: kegagalan SMTP tidak bocor, token baru dibersihkan, dan token lama tetap aktif', async () => {
  const user = createUser({ password_hash: await hashPassword(oldPassword) });
  const oldToken = createPasswordResetToken();
  const oldRecord = {
    id: 1,
    user_id: 1,
    token_hash: hashPasswordResetToken(oldToken),
    expires_at: new Date(Date.now() + 60000),
    used_at: null,
    created_at: new Date(Date.now() - 120000),
  };
  const prisma = createFakePrisma([user], { tokens: [oldRecord] });
  const secretMarker = 'smtp-secret-marker';
  const logged = [];
  const originalError = console.error;
  console.error = (...values) => logged.push(values.join(' '));
  try {
    await withServer(prisma, {
      async sendPasswordReset() { throw new Error(secretMarker); },
    }, async (baseUrl) => {
      const response = await forgotRequest(baseUrl, user.email);
      assert.equal(response.status, 200);
      assert.equal(JSON.stringify(response.body).includes(secretMarker), false);
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(prisma.state.tokens.length, 1);
  assert.equal(prisma.state.tokens[0].id, oldRecord.id);
  assert.equal(prisma.state.tokens[0].used_at, null);
  assert.equal(logged.join(' ').includes(secretMarker), false);
});

test('kebijakan tanggal lahir, validasi body, dan adapter SMTP aman', async () => {
  const user = createUser({ password_hash: await hashPassword(oldPassword) });
  const rawToken = createPasswordResetToken();
  const prisma = createFakePrisma([user], { tokens: [{
    id: 1,
    user_id: 1,
    token_hash: hashPasswordResetToken(rawToken),
    expires_at: new Date(Date.now() + 60000),
    used_at: null,
    created_at: new Date(Date.now() - 120000),
  }] });
  await withServer(prisma, { async sendPasswordReset() {} }, async (baseUrl) => {
    const birthDate = await resetRequest(baseUrl, rawToken, '20000102');
    assert.equal(birthDate.status, 400);
    assert.equal(birthDate.body.error.code, 'PASSWORD_POLICY_ERROR');
    const mismatch = await request(baseUrl, '/api/auth/reset-password', {
      token: rawToken,
      newPassword,
      confirmPassword: `${newPassword}-beda`,
    });
    assert.equal(mismatch.status, 400);
  });
  assert.equal(prisma.state.tokens[0].used_at, null);

  const sent = [];
  const mailService = createMailService({
    environment: {
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'sender@example.test',
      SMTP_APP_PASSWORD: 'not-a-real-secret',
      MAIL_FROM: 'sender@example.test',
      RESET_TOKEN_EXPIRES_MINUTES: '15',
    },
    createTransport(options) {
      assert.equal(options.secure, true);
      assert.equal(options.auth.user, 'sender@example.test');
      return { async sendMail(message) { sent.push(message); } };
    },
  });
  await mailService.sendPasswordReset({
    to: user.email,
    token: rawToken,
    expiresMinutes: 15,
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, user.email);
  assert.equal(sent[0].text.includes(rawToken), true);
});
