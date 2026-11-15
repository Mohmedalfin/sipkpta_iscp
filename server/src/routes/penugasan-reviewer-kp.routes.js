import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import {
  assignKpReviewerBulkController, assignKpReviewersController,
  deactivateKpReviewerController, downloadKpForReviewerController,
  getKpForReviewerController, listKpForReviewerController,
  listKpReviewersController, listReviewerAssignmentsController,
  listReviewerCandidatesController, replaceKpReviewerController,
} from '../controllers/penugasan-reviewer-kp.controller.js';

export function createPenugasanReviewerKpRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('KAPRODI'));
  router.get('/pengajuan', listKpForReviewerController(prisma));
  router.get('/pengajuan/:id', getKpForReviewerController(prisma));
  router.get('/pengajuan/:id/dokumen/:dokumenId/file', downloadKpForReviewerController(prisma));
  router.get('/pengajuan/:id/reviewer', listKpReviewersController(prisma));
  router.post('/pengajuan/:id/reviewer', assignKpReviewersController(prisma));
  router.get('/kandidat-reviewer', listReviewerCandidatesController(prisma));
  router.get('/penugasan-reviewer', listReviewerAssignmentsController(prisma));
  router.post('/penugasan-reviewer/bulk', assignKpReviewerBulkController(prisma));
  router.patch('/penugasan-reviewer/:id', deactivateKpReviewerController(prisma));
  router.post('/penugasan-reviewer/:id/ganti', replaceKpReviewerController(prisma));
  return router;
}
