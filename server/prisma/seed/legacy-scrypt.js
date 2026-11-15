import crypto from 'node:crypto';

const LEGACY_PARAMETERS = 'ln=14,r=8,p=1';

export function verifyLegacyScryptPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  if (
    parts.length !== 5 ||
    parts[1] !== 'scrypt' ||
    parts[2] !== LEGACY_PARAMETERS ||
    !/^[0-9a-f]+$/i.test(parts[3]) ||
    !/^[0-9a-f]+$/i.test(parts[4]) ||
    parts[3].length % 2 !== 0 ||
    parts[4].length % 2 !== 0
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(parts[3], 'hex');
    const originalKey = Buffer.from(parts[4], 'hex');
    const derivedKey = crypto.scryptSync(password, salt, originalKey.length, {
      N: 16384,
      r: 8,
      p: 1,
    });

    return crypto.timingSafeEqual(originalKey, derivedKey);
  } catch {
    return false;
  }
}
