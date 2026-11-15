import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import { verifyAccessToken } from '../security/jwt.js';
import { findActiveUser } from '../services/auth.service.js';
import { canReceiveKpEvent, subscribeToUser } from '../services/realtime.service.js';

export function createRealtimeRoutes({ prisma, heartbeatMs = 20000 }) {
  const router = Router();
  router.get('/events', authenticate(prisma), authorizeRoles('MAHASISWA', 'ADMIN_PRODI', 'KAPRODI', 'REVIEWER', 'PEMBIMBING'), (request, response) => {
    const { user, sessionId } = request.auth;
    const token = request.get('Authorization').trim().replace(/^(Bearer\s+)+/i, '');
    let closed = false;
    let checking = false;
    let timer;
    let unsubscribe = () => {};
    function close() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      unsubscribe();
      response.end();
    }
    async function authorized() {
      try {
        const claims = await verifyAccessToken(token);
        const session = await prisma.authSession.findFirst({ where: { id: sessionId,
          user_id: user.id, revoked_at: null, expires_at: { gt: new Date() },
          role_version: claims.roleVersion, active_role: { kode_peran: user.activeRole } }, select: { id: true } });
        return Boolean(session && await findActiveUser(prisma, user.id, user.activeRole));
      } catch { return false; }
    }
    function write(frame) {
      if (!closed && !response.write(frame)) close();
    }
    response.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-store',
      'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
    response.flushHeaders();
    unsubscribe = subscribeToUser(user.id, async (event) => {
      if (closed) return;
      if (!await authorized()) return close();
      if (event.type !== 'notifikasi.updated' && !await canReceiveKpEvent(prisma, user, event)) return;
      write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
    }, user.activeRole, { onDisconnect: close });
    write('event: ready\ndata: {}\n\n');
    if (closed) return;
    timer = setInterval(async () => {
      if (checking || closed) return;
      checking = true;
      try {
        if (!await authorized()) close();
        else write(': heartbeat\n\n');
      } finally { checking = false; }
    }, heartbeatMs);
    request.on('close', close);
    response.on('error', close);
  });
  return router;
}
