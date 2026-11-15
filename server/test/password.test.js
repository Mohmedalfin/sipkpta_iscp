import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hashPassword,
  isArgon2idHash,
  passwordHashNeedsRehash,
  verifyPassword,
} from '../src/security/password.js';
import { verifyLegacyScryptPassword } from '../prisma/seed/legacy-scrypt.js';

const TEST_PASSWORD = 'SIPKITA-test-password';

test('hashPassword menghasilkan PHC Argon2id dengan parameter yang disepakati', async () => {
  const hash = await hashPassword(TEST_PASSWORD);

  assert.equal(isArgon2idHash(hash), true);
  assert.match(hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(passwordHashNeedsRehash(hash), false);
});

test('verifyPassword menerima password benar dan menolak password salah', async () => {
  const hash = await hashPassword(TEST_PASSWORD);

  assert.equal(await verifyPassword(TEST_PASSWORD, hash), true);
  assert.equal(await verifyPassword(`${TEST_PASSWORD}-salah`, hash), false);
  assert.equal(await verifyPassword(TEST_PASSWORD, '$scrypt$legacy'), false);
});

test('password yang sama menghasilkan salt dan hash berbeda', async () => {
  const [firstHash, secondHash] = await Promise.all([
    hashPassword(TEST_PASSWORD),
    hashPassword(TEST_PASSWORD),
  ]);

  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword(TEST_PASSWORD, firstHash), true);
  assert.equal(await verifyPassword(TEST_PASSWORD, secondHash), true);
});

test('verifier legacy scrypt hanya menerima format dan password yang benar', () => {
  const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
  const derivedKey = crypto.scryptSync(TEST_PASSWORD, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
  const legacyHash = `$scrypt$ln=14,r=8,p=1$${salt.toString('hex')}$${derivedKey.toString('hex')}`;

  assert.equal(verifyLegacyScryptPassword(TEST_PASSWORD, legacyHash), true);
  assert.equal(verifyLegacyScryptPassword(`${TEST_PASSWORD}-salah`, legacyHash), false);
  assert.equal(verifyLegacyScryptPassword(TEST_PASSWORD, '$scrypt$invalid'), false);
});
