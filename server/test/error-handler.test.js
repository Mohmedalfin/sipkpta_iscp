import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../src/middlewares/errorHandler.js';

test('diagnostik 500 mencatat kode teknis tanpa message, body, token, atau URL aktual', () => {
  const original = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  let status;
  let body;
  try {
    const error = Object.assign(new Error('PRIVATE_MARKER'), {
      name: 'PrismaClientKnownRequestError', code: 'P2022',
    });
    errorHandler(error, { method: 'GET', route: { path: '/:id' },
      originalUrl: '/PRIVATE_MARKER', body: { token: 'PRIVATE_MARKER' } }, {
      status(value) { status = value; return this; },
      json(value) { body = value; },
    });
    assert.equal(status, 500);
    assert.equal(body.error.code, 'INTERNAL_ERROR');
    assert.deepEqual(logs[0][1], { method: 'GET', route: '/:id',
      name: 'PrismaClientKnownRequestError', code: 'P2022' });
    assert.equal(JSON.stringify([logs, body]).includes('PRIVATE_MARKER'), false);
  } finally { console.error = original; }
});
