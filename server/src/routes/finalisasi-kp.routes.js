import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import {
  assignPembimbingKpBulkController, assignPembimbingKpController,
  getFinalisasiKpController, listFinalisasiKpController,
  listKandidatPembimbingKpController, listPenugasanPembimbingKpController,
  replacePembimbingKpController,
} from '../controllers/finalisasi-kp.controller.js';

export function createFinalisasiKpRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('KAPRODI'));
  router.get('/pengajuan-kp/finalisasi', listFinalisasiKpController(prisma));
  router.get('/pengajuan-kp/:id/finalisasi', getFinalisasiKpController(prisma));
  router.get('/pembimbing-kp/kandidat', listKandidatPembimbingKpController(prisma));
  router.post('/pengajuan-kp/:id/pembimbing', assignPembimbingKpController(prisma));
  router.post('/pembimbing-kp/bulk', assignPembimbingKpBulkController(prisma));
  router.get('/pembimbing-kp/penugasan', listPenugasanPembimbingKpController(prisma));
  router.post('/pengajuan-kp/:id/pembimbing/ganti', replacePembimbingKpController(prisma));
  return router;
}
