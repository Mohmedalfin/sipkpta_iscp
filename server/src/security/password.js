import * as argon2 from 'argon2';

export const ARGON2ID_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

const MINIMUM_PASSWORD_LENGTH = 8;

function assertValidPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password wajib berupa string tidak kosong.');
  }

  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error('Password tidak memenuhi syarat keamanan (minimal 8 karakter).');
  }
}

export function isArgon2idHash(storedHash) {
  return typeof storedHash === 'string' && storedHash.startsWith('$argon2id$');
}

export async function hashPassword(password) {
  assertValidPassword(password);
  return argon2.hash(password, ARGON2ID_OPTIONS);
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || !isArgon2idHash(storedHash)) {
    return false;
  }

  try {
    return await argon2.verify(storedHash, password);
  } catch {
    return false;
  }
}

export function passwordHashNeedsRehash(storedHash) {
  if (!isArgon2idHash(storedHash)) {
    return true;
  }

  try {
    return argon2.needsRehash(storedHash, ARGON2ID_OPTIONS);
  } catch {
    return true;
  }
}
