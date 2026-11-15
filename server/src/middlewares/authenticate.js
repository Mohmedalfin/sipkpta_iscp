import { findActiveUser } from '../services/auth.service.js';
import { getJwtConfig, verifyAccessToken } from '../security/jwt.js';

const unauthorized = {
  success: false,
  error: { code: 'UNAUTHORIZED', message: 'Autentikasi diperlukan.' },
};

export function authenticate(prisma) {
  return async (request, response, next) => {
    const authorization = request.get('Authorization');
    const cleaned = typeof authorization === 'string'
      ? authorization.trim().replace(/^(Bearer\s+)+/i, 'Bearer ')
      : null;
    const match = cleaned
      ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(cleaned)
      : null;
    if (!match) {
      response.status(401).json(unauthorized);
      return;
    }

    try {
      getJwtConfig();
    } catch (error) {
      next(error);
      return;
    }

    let tokenClaims;
    try {
      tokenClaims = await verifyAccessToken(match[1]);
    } catch {
      response.status(401).json(unauthorized);
      return;
    }

    try {
      const session = await prisma.authSession.findFirst({
        where: {
          id: tokenClaims.sessionId,
          user_id: tokenClaims.userId,
          revoked_at: null,
          expires_at: { gt: new Date() },
        },
        select: {
          id: true,
          role_version: true,
          active_role: { select: { kode_peran: true } },
        },
      });
      const sessionActiveRole = session?.active_role?.kode_peran ?? null;
      const user = session &&
        tokenClaims.activeRole === sessionActiveRole &&
        tokenClaims.roleVersion === session.role_version
        ? await findActiveUser(prisma, tokenClaims.userId, sessionActiveRole)
        : null;
      if (!user) {
        response.status(401).json(unauthorized);
        return;
      }

      request.auth = { user, sessionId: session.id, activeRole: sessionActiveRole };
      next();
    } catch (error) {
      next(error);
    }
  };
}
