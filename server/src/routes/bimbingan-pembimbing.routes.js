import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import {
  attachmentController, bulkController, decisionController,
  detailSupervisorController, listSupervisorController,
} from '../controllers/bimbingan.controller.js';

export function createBimbinganPembimbingRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('PEMBIMBING'));
  router.get('/bimbingan', listSupervisorController);
  router.post('/bimbingan/bulk-validasi', bulkController);
  router.get('/bimbingan/:id/lampiran/:lampiranId/file', attachmentController('supervisor'));
  router.get('/bimbingan/:id', detailSupervisorController);
  router.post('/bimbingan/:id/keputusan', decisionController);
  return router;
}
