import { login, logout, refresh, selectActiveRole } from '../services/auth.service.js';
import { isRefreshToken } from '../security/refreshToken.js';

function isValidLoginBody(body) {
  return body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Object.keys(body).every((key) => key === 'login_id' || key === 'password') &&
    typeof body.login_id === 'string' &&
    body.login_id.length >= 1 &&
    body.login_id.length <= 50 &&
    /^[A-Za-z0-9._-]+$/.test(body.login_id) &&
    typeof body.password === 'string' &&
    body.password.length >= 8 &&
    body.password.length <= 1024;
}

export function loginController(prisma, failedLoginLimiter) {
  return async (request, response, next) => {
    if (!isValidLoginBody(request.body)) {
      response.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Data login tidak valid.' },
      });
      return;
    }

    try {
      const result = await login(prisma, request.body.login_id, request.body.password);
      if (!result) {
        failedLoginLimiter(request, response, (error) => {
          if (error) return next(error);
          response.status(401).json({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Login ID atau password tidak valid.',
            },
          });
        });
        return;
      }

      response.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}

export function meController(request, response) {
  response.status(200).json({ success: true, data: { user: request.auth.user } });
}

export function activeRoleController(prisma) {
  return async (request, response, next) => {
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || typeof body.role !== 'string' ||
        !/^[A-Z][A-Z0-9_]{1,29}$/.test(body.role)) {
      response.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Role aktif tidak valid.' },
      });
      return;
    }

    try {
      const result = await selectActiveRole(
        prisma,
        request.auth.user.id,
        request.auth.sessionId,
        body.role
      );
      if (!result) {
        response.status(403).json({
          success: false,
          error: { code: 'ROLE_NOT_OWNED', message: 'Role tidak dimiliki pengguna.' },
        });
        return;
      }
      response.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}

export function refreshController(prisma) {
  return async (request, response, next) => {
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !isRefreshToken(body.refreshToken)) {
      response.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Refresh token tidak valid.' },
      });
      return;
    }

    try {
      const result = await refresh(prisma, body.refreshToken);
      if (result.status !== 'ok') {
        response.status(401).json({
          success: false,
          error: {
            code: result.status === 'reused' ? 'REFRESH_TOKEN_REUSED' : 'INVALID_REFRESH_TOKEN',
            message: 'Sesi tidak valid. Silakan login kembali.',
          },
        });
        return;
      }
      response.status(200).json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  };
}

export function logoutController(prisma) {
  return async (request, response, next) => {
    if (request.body && (typeof request.body !== 'object' || Array.isArray(request.body) || Object.keys(request.body).length > 0)) {
      response.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Logout tidak menerima body.' },
      });
      return;
    }
    try {
      await logout(prisma, request.auth.user.id, request.auth.sessionId);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}
