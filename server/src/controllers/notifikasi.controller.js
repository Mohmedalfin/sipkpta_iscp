import {
  countUnreadNotifikasi, listNotifikasi, markAllNotifikasiRead, markNotifikasiRead,
} from '../services/notifikasi.service.js';

function invalid(response) {
  response.status(400).json({ success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Parameter notifikasi tidak valid.' } });
}

function positive(value, maximum) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= maximum ? number : null;
}

function notificationId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const id = BigInt(value);
  return id <= 9223372036854775807n ? id : null;
}

function send(operation) {
  return async (request, response, next) => {
    try { response.json({ success: true, data: await operation(request) }); }
    catch (error) {
      if (!Number.isInteger(error?.status)) return next(error);
      response.status(error.status).json({ success: false,
        error: { code: error.code, message: error.message } });
    }
  };
}

export function listNotifikasiController(prisma) {
  return async (request, response, next) => {
    const { page = '1', limit = '20', dibaca } = request.query;
    if (Object.keys(request.query).some((key) => !['page', 'limit', 'dibaca'].includes(key)) ||
      !positive(page, 2147483647) || !positive(limit, 100) ||
      (Number(page) - 1) * Number(limit) > 2147483647 ||
      (dibaca !== undefined && dibaca !== 'true' && dibaca !== 'false')) return invalid(response);
    try {
      response.json({ success: true, data: await listNotifikasi(prisma, request.auth.user.id,
        { page: Number(page), limit: Number(limit), dibaca: dibaca === undefined ? null : dibaca === 'true' }) });
    } catch (error) { next(error); }
  };
}

export const countNotifikasiController = (prisma) => send((request) =>
  countUnreadNotifikasi(prisma, request.auth.user.id));

export function readNotifikasiController(prisma) {
  return (request, response, next) => {
    const id = notificationId(request.params.id);
    if (!id) return invalid(response);
    return send((req) => markNotifikasiRead(prisma, req.auth.user.id, id))(request, response, next);
  };
}

export const readAllNotifikasiController = (prisma) => send((request) =>
  markAllNotifikasiRead(prisma, request.auth.user.id));
