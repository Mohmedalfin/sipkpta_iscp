import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import {
  bulkLayakReviewerKpController, downloadReviewerKpProposalController,
  downloadReviewerKpZipController, getReviewerKpHistoryController,
  getReviewerKpTaskController, listReviewerKpTasksController,
  submitReviewerKpReviewController,
} from '../controllers/review-proposal-kp.controller.js';

export function createReviewProposalKpRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('REVIEWER'));
  router.get('/pengajuan', listReviewerKpTasksController(prisma));
  router.get('/pengajuan/:id', getReviewerKpTaskController(prisma));
  router.get('/pengajuan/:id/proposal/file', downloadReviewerKpProposalController(prisma));
  router.get('/pengajuan/:id/riwayat', getReviewerKpHistoryController(prisma));
  router.post('/pengajuan/:id/review', submitReviewerKpReviewController(prisma));
  router.post('/review/bulk-layak', bulkLayakReviewerKpController(prisma));
  router.post('/proposal/download-bulk', downloadReviewerKpZipController(prisma));
  return router;
}
