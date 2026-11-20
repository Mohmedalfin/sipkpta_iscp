import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import {
  attachmentController, bimbinganUploadRateLimit, createDraftController,
  detailStudentController, historyStudentController, listStudentController,
  studentContextController, progressController, submitController, updateDraftController,
} from '../controllers/bimbingan.controller.js';

export function createBimbinganMahasiswaRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('MAHASISWA'));
  router.get('/bimbingan/konteks', studentContextController);
  router.get('/:pengajuanId/bimbingan/progres', progressController);
  router.get('/:pengajuanId/bimbingan', listStudentController);
  router.post('/:pengajuanId/bimbingan', createDraftController);
  router.get('/:pengajuanId/bimbingan/:id/riwayat', historyStudentController);
  router.get('/:pengajuanId/bimbingan/:id/lampiran/:lampiranId/file', attachmentController('student'));
  router.get('/:pengajuanId/bimbingan/:id', detailStudentController);
  router.patch('/:pengajuanId/bimbingan/:id', updateDraftController);
  router.post('/:pengajuanId/bimbingan/:id/kirim', bimbinganUploadRateLimit, submitController());
  router.post('/:pengajuanId/bimbingan/:id/revisi', bimbinganUploadRateLimit, submitController(true));
  return router;
}
