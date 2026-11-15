import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'sipkita-api';
const AUDIENCE = 'sipkita-client';
const DEFAULT_EXPIRES_IN = 900;

export function getJwtConfig() {
  const encodedSecret = process.env.JWT_ACCESS_SECRET_BASE64;
  if (typeof encodedSecret !== 'string' || !/^[A-Za-z0-9_-]{43,}$/.test(encodedSecret)) {
    throw new Error('Konfigurasi JWT access secret tidak valid.');
  }

  const secret = Buffer.from(encodedSecret, 'base64url');
  if (secret.length < 32 || secret.toString('base64url') !== encodedSecret) {
    throw new Error('Konfigurasi JWT access secret tidak valid.');
  }

  const rawExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN_SECONDS;
  const expiresIn = rawExpiresIn === undefined ? DEFAULT_EXPIRES_IN : Number(rawExpiresIn);
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 3600) {
    throw new Error('Konfigurasi masa berlaku JWT tidak valid.');
  }

  return { secret, expiresIn, issuer: ISSUER, audience: AUDIENCE };
}

export async function signAccessToken(userId, sessionId, activeRole = null, roleVersion = 0) {
  if (typeof sessionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    throw new Error('ID sesi tidak valid.');
  }
  if (activeRole !== null && (typeof activeRole !== 'string' || !/^[A-Z][A-Z0-9_]{1,29}$/.test(activeRole))) {
    throw new Error('Role aktif tidak valid.');
  }
  if (!Number.isSafeInteger(roleVersion) || roleVersion < 0) {
    throw new Error('Versi role tidak valid.');
  }
  const config = getJwtConfig();
  const token = await new SignJWT({ sid: sessionId, role: activeRole, role_version: roleVersion })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(String(userId))
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime(`${config.expiresIn}s`)
    .setJti(randomUUID())
    .sign(config.secret);

  return { token, expiresIn: config.expiresIn };
}

export async function verifyAccessToken(token) {
  const config = getJwtConfig();
  const { payload } = await jwtVerify(token, config.secret, {
    algorithms: ['HS256'],
    issuer: config.issuer,
    audience: config.audience,
    maxTokenAge: `${config.expiresIn}s`,
    requiredClaims: ['sub', 'sid', 'role', 'role_version', 'iss', 'aud', 'iat', 'exp', 'jti'],
  });

  if (
    typeof payload.sub !== 'string' ||
    !/^[1-9]\d*$/.test(payload.sub) ||
    !Number.isSafeInteger(Number(payload.sub)) ||
    typeof payload.sid !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sid) ||
    (payload.role !== null && (typeof payload.role !== 'string' || !/^[A-Z][A-Z0-9_]{1,29}$/.test(payload.role))) ||
    !Number.isSafeInteger(payload.role_version) ||
    payload.role_version < 0 ||
    typeof payload.jti !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.jti) ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= payload.iat
  ) {
    throw new Error('Klaim JWT tidak valid.');
  }

  return {
    userId: Number(payload.sub),
    sessionId: payload.sid,
    activeRole: payload.role,
    roleVersion: payload.role_version,
  };
}
