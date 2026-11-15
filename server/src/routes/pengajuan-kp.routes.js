import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import { getOwnKpReviewsController, reviseOwnKpProposalController } from '../controllers/review-proposal-kp.controller.js';
import {
  createKpDraftController,
  downloadKpDocumentController,
  getKpFormOptionsController,
  getOwnKpApplicationController,
  listOwnKpApplicationsController,
  pengajuanUploadRateLimit,
  reviseOwnKpController,
  sendOwnKpRevisionController,
  submitKpApplicationController,
  updateKpDraftController,
  uploadKpDocumentController,
} from '../controllers/pengajuan-kp.controller.js';

export function createPengajuanKpRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('MAHASISWA'));

  router.get('/opsi-form', getKpFormOptionsController(prisma));
  router.get('/', listOwnKpApplicationsController(prisma));
  router.post('/', createKpDraftController(prisma));
  router.get('/:id', getOwnKpApplicationController(prisma));
  router.get('/:id/review', getOwnKpReviewsController(prisma));
  router.patch('/:id', updateKpDraftController(prisma));
  router.patch('/:id/perbaikan', reviseOwnKpController(prisma));
  router.post('/:id/dokumen', pengajuanUploadRateLimit, uploadKpDocumentController(prisma));
  router.get('/:id/dokumen/:dokumenId/file', downloadKpDocumentController(prisma));
  router.post('/:id/kirim', submitKpApplicationController(prisma));
  router.post('/:id/kirim-perbaikan', sendOwnKpRevisionController(prisma));
  router.post('/:id/revisi-proposal', pengajuanUploadRateLimit, reviseOwnKpProposalController(prisma));

  return router;
}
