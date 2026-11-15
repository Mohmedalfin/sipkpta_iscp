import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import { availability } from '../controllers/konfigurasi-akademik.controller.js';

export function createKetersediaanAkademikRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('MAHASISWA', 'ADMIN_PRODI', 'KAPRODI', 'REVIEWER'));
  router.get('/ketersediaan', availability(prisma));
  return router;
}
