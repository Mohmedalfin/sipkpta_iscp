import { createHash, randomBytes } from 'node:crypto';

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_LENGTH = 43;

export function createPasswordResetToken() {
  return randomBytes(RESET_TOKEN_BYTES).toString('base64url');
}

export function hashPasswordResetToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isPasswordResetToken(token) {
  return typeof token === 'string' &&
    token.length === RESET_TOKEN_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(token);
}
