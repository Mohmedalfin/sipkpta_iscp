import {
  approveAllAdminKp, decideAdminKpApplication, downloadAdminKpDocument,
  examineAdminKpCategory, getAdminKpApplication, listAdminKpApplications,
} from '../services/admin-pengajuan-kp.service.js';

function invalid(response) {
  response.status(400).json({ success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Data pemeriksaan tidak valid.' } });
}

function failure(error, response, next) {
  if (!Number.isInteger(error?.status) || typeof error?.code !== 'string') return next(error);
  response.status(error.status).json({ success: false,
    error: { code: error.code, message: error.message } });
}

function positiveId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2147483647 ? parsed : null;
}

function snapshot(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function note(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (normalized.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(normalized)) return undefined;
  return normalized || null;
}

function parseBody(body, kind) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  const expectedSnapshot = snapshot(body.expected_snapshot);
  if (!expectedSnapshot) return null;
  if (kind === 'all') {
    return keys.length === 2 && body.konfirmasi === true &&
      keys.every((key) => ['expected_snapshot', 'konfirmasi'].includes(key))
      ? { expectedSnapshot } : null;
  }
  if (keys.some((key) => !['expected_snapshot', 'status', 'catatan'].includes(key)) ||
    !Object.hasOwn(body, 'status')) return null;
  const normalizedNote = note(body.catatan);
  if (normalizedNote === undefined) return null;
  const allowed = kind === 'category' ? ['BELUM_OK', 'OK_LENGKAP'] : ['ACC', 'TIDAK_ACC'];
  if (!allowed.includes(body.status) ||
    ['BELUM_OK', 'TIDAK_ACC'].includes(body.status) && !normalizedNote) return null;
  return { status: body.status, note: normalizedNote, expectedSnapshot };
}

function parseQuery(query) {
  if (!query || Object.keys(query).some((key) =>
    !['page', 'limit', 'search', 'status_berkas', 'status_nilai', 'status_pengajuan'].includes(key))) return null;
  const page = query.page === undefined ? 1 : positiveId(query.page);
  const limit = query.limit === undefined ? 20 : positiveId(query.limit);
  const search = query.search === undefined ? '' :
    (typeof query.search === 'string' ? query.search.trim() : null);
  const categoryStatuses = ['BELUM_DIPERIKSA', 'BELUM_OK', 'OK_LENGKAP'];
  if (!page || !limit || limit > 100 || search === null || search.length > 100 ||
      query.status_berkas && !categoryStatuses.includes(query.status_berkas) ||
      query.status_nilai && !categoryStatuses.includes(query.status_nilai) ||
      query.status_pengajuan && !['DIAJUKAN', 'ACC', 'TIDAK_ACC'].includes(query.status_pengajuan)) return null;
  return { page, limit, search, status_berkas: query.status_berkas || null,
    status_nilai: query.status_nilai || null, status_pengajuan: query.status_pengajuan || null };
}

export function listAdminKpController(prisma) {
  return async (request, response, next) => {
    const query = parseQuery(request.query);
    if (!query) return invalid(response);
    try { response.status(200).json({ success: true,
      data: await listAdminKpApplications(prisma, query) }); }
    catch (error) { failure(error, response, next); }
  };
}

export function getAdminKpController(prisma) {
  return async (request, response, next) => {
    const id = positiveId(request.params.id);
    if (!id) return invalid(response);
    try { response.status(200).json({ success: true, data: await getAdminKpApplication(prisma, id) }); }
    catch (error) { failure(error, response, next); }
  };
}

export function downloadAdminKpController(prisma) {
  return async (request, response, next) => {
    const id = positiveId(request.params.id);
    const documentId = positiveId(request.params.dokumenId);
    if (!id || !documentId) return invalid(response);
    try {
      const file = await downloadAdminKpDocument(prisma, id, documentId);
      response.set({ 'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${file.filename.replace(/["\\\r\n]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
      response.status(200).send(file.bytes);
    } catch (error) { failure(error, response, next); }
  };
}

export function examineAdminKpController(prisma, category) {
  return async (request, response, next) => {
    const id = positiveId(request.params.id);
    const body = parseBody(request.body, 'category');
    if (!id || !body) return invalid(response);
    try { response.status(200).json({ success: true,
      data: await examineAdminKpCategory(prisma, {
        id, category, ...body, actorUserId: request.auth.user.id,
      }) }); }
    catch (error) { failure(error, response, next); }
  };
}

export function decideAdminKpController(prisma) {
  return async (request, response, next) => {
    const id = positiveId(request.params.id);
    const body = parseBody(request.body, 'decision');
    if (!id || !body) return invalid(response);
    try { response.status(200).json({ success: true,
      data: await decideAdminKpApplication(prisma, { id, ...body,
        actorUserId: request.auth.user.id }) }); }
    catch (error) { failure(error, response, next); }
  };
}

export function approveAllAdminKpController(prisma) {
  return async (request, response, next) => {
    const id = positiveId(request.params.id);
    const body = parseBody(request.body, 'all');
    if (!id || !body) return invalid(response);
    try { response.status(200).json({ success: true,
      data: await approveAllAdminKp(prisma, { id, ...body,
        actorUserId: request.auth.user.id }) }); }
    catch (error) { failure(error, response, next); }
  };
}
