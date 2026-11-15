export function authorizeRoles(...allowedRoles) {
  const allowed = new Set(allowedRoles);

  return (request, response, next) => {
    if (!request.auth?.user) {
      response.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Autentikasi diperlukan.' },
      });
      return;
    }

    if (
      allowed.size === 0 ||
      typeof request.auth.activeRole !== 'string' ||
      !allowed.has(request.auth.activeRole)
    ) {
      response.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Akses tidak diizinkan.' },
      });
      return;
    }

    next();
  };
}
