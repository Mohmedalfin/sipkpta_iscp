import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import {
  approveAllAdminKpController, decideAdminKpController, downloadAdminKpController,
  examineAdminKpController, getAdminKpController, listAdminKpController,
} from '../controllers/admin-pengajuan-kp.controller.js';

export function createAdminPengajuanKpRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('ADMIN_PRODI'));
  router.get('/', listAdminKpController(prisma));
  router.get('/:id', getAdminKpController(prisma));
  router.get('/:id/dokumen/:dokumenId/file', downloadAdminKpController(prisma));
  router.patch('/:id/pemeriksaan-berkas', examineAdminKpController(prisma, 'BERKAS'));
  router.patch('/:id/pemeriksaan-nilai', examineAdminKpController(prisma, 'NILAI'));
  router.post('/:id/keputusan', decideAdminKpController(prisma));
  router.post('/:id/acc-lengkap', approveAllAdminKpController(prisma));
  return router;
}
