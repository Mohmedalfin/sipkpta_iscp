export function notFound(_request, response) {
  response.status(404).json({ status: 'error', message: 'Endpoint tidak ditemukan' });
}

export function errorHandler(error, _request, response, _next) {
  console.error('API error:', error);

  if (response.headersSent) {
    return;
  }

  if (error.status === 503) {
    response.status(503).json({ status: 'error', database: 'disconnected' });
    return;
  }

  if (error.type === 'entity.parse.failed') {
    response.status(400).json({ status: 'error', message: 'JSON tidak valid' });
    return;
  }

  response.status(500).json({ status: 'error', message: 'Kesalahan server' });
}
