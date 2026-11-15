import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import {
  countNotifikasiController, listNotifikasiController,
  readAllNotifikasiController, readNotifikasiController,
} from '../controllers/notifikasi.controller.js';

export function createNotifikasiRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma));
  router.get('/', listNotifikasiController(prisma));
  router.get('/belum-dibaca/count', countNotifikasiController(prisma));
  router.patch('/dibaca-semua', readAllNotifikasiController(prisma));
  router.patch('/:id/dibaca', readNotifikasiController(prisma));
  return router;
}
