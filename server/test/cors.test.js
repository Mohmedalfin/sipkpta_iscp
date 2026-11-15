import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';

async function withServer(run) {
  const server = createApp({ prisma: {} }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function preflight(baseUrl, origin) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
}

test('CORS development mengizinkan kedua origin loopback dan menolak origin lain', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousClientOrigin = process.env.CLIENT_ORIGIN;
  process.env.NODE_ENV = 'development';
  process.env.CLIENT_ORIGIN = 'http://localhost:5173';
  try {
    await withServer(async (baseUrl) => {
      for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
        const response = await preflight(baseUrl, origin);
        assert.equal(response.status, 204);
        assert.equal(response.headers.get('access-control-allow-origin'), origin);
        assert.match(response.headers.get('access-control-allow-methods'), /POST/);
      }
      const rejected = await preflight(baseUrl, 'https://example.test');
      assert.equal(rejected.headers.get('access-control-allow-origin'), null);
    });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousClientOrigin === undefined) delete process.env.CLIENT_ORIGIN;
    else process.env.CLIENT_ORIGIN = previousClientOrigin;
  }
});

test('CORS production hanya mengizinkan origin yang dikonfigurasi', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousClientOrigin = process.env.CLIENT_ORIGIN;
  process.env.NODE_ENV = 'production';
  process.env.CLIENT_ORIGIN = 'https://sipkita.example, https://admin.sipkita.example';
  try {
    await withServer(async (baseUrl) => {
      const allowed = await preflight(baseUrl, 'https://admin.sipkita.example');
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://admin.sipkita.example');
      const rejected = await preflight(baseUrl, 'http://127.0.0.1:5173');
      assert.equal(rejected.headers.get('access-control-allow-origin'), null);
    });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousClientOrigin === undefined) delete process.env.CLIENT_ORIGIN;
    else process.env.CLIENT_ORIGIN = previousClientOrigin;
  }
});
