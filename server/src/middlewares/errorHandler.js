export function notFound(_request, response) {
  response.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' },
  });
}

export function errorHandler(error, _request, response, _next) {
  if (response.headersSent) {
    return;
  }

  if (error.status === 503) {
    response.status(503).json({ status: 'error', database: 'disconnected' });
    return;
  }

  if (error.type === 'entity.parse.failed') {
    response.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'JSON tidak valid.' },
    });
    return;
  }

  if (error.type === 'entity.too.large') {
    response.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Ukuran request terlalu besar.' },
    });
    return;
  }

  // Error mentah dapat memuat body, token, password, atau URL koneksi.
  const safeNames = new Set(['Error', 'TypeError', 'RangeError',
    'PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError',
    'PrismaClientValidationError', 'PrismaClientInitializationError']);
  const safeCode = /^(P\d{4}|[0-9A-Z]{5}|ECONNREFUSED|ECONNRESET|ETIMEDOUT)$/.test(error.code ?? '')
    ? error.code : null;
  console.error('API request failed.', {
    method: _request.method,
    route: _request.route?.path ?? null,
    name: safeNames.has(error.name) ? error.name : 'Error',
    code: safeCode,
  });
  response.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Kesalahan server.' },
  });
}
