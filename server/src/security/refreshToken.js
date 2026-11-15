import { createHash, randomBytes } from 'node:crypto';

export const REFRESH_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function createRefreshToken() {
  return randomBytes(32).toString('base64url');
}

export function isRefreshToken(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function hashRefreshToken(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
