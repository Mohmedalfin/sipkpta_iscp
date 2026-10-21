import { getPrisma } from '../config/prisma.js';

export function getHealth(_request, response) {
  response.status(200).json({ status: 'ok', message: 'SIPKITA API aktif' });
}

export async function getDatabaseHealth(_request, response, next) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return response.status(503).json({ status: 'error', database: 'disconnected' });
    }

    await prisma.$queryRaw`SELECT 1`;
    return response.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    // The central handler logs the error locally and sends only a safe response.
    error.status = 503;
    next(error);
  }
}
