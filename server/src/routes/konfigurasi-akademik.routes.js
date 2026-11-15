import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import {
  periodCreate, periodDetail, periodsIndex, periodToggle, periodUpdate,
  scheduleCreate, scheduleDetail, schedulesIndex, scheduleToggle, scheduleUpdate,
  stagesIndex, stageDetail, documentTypesIndex, documentTypeCreate, documentTypeUpdate,
  requirementsIndex, requirementCreate, requirementUpdate,
  kurikulumIndex, kurikulumDetail, kurikulumCreate, kurikulumUpdate,
} from '../controllers/konfigurasi-akademik.controller.js';

export function createKonfigurasiAkademikRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('ADMIN_PRODI'));
  router.get('/periode-akademik', periodsIndex(prisma));
  router.post('/periode-akademik', periodCreate(prisma));
  router.get('/periode-akademik/:id', periodDetail(prisma));
  router.patch('/periode-akademik/:id', periodUpdate(prisma));
  router.post('/periode-akademik/:id/aktivasi', periodToggle(prisma, true));
  router.post('/periode-akademik/:id/nonaktivasi', periodToggle(prisma, false));
  router.get('/jadwal-proses', schedulesIndex(prisma));
  router.post('/jadwal-proses', scheduleCreate(prisma));
  router.get('/jadwal-proses/:id', scheduleDetail(prisma));
  router.patch('/jadwal-proses/:id', scheduleUpdate(prisma));
  router.post('/jadwal-proses/:id/aktivasi', scheduleToggle(prisma, true));
  router.post('/jadwal-proses/:id/nonaktivasi', scheduleToggle(prisma, false));
  router.get('/tahap-akademik', stagesIndex(prisma));
  router.get('/tahap-akademik/:id', stageDetail(prisma));
  router.get('/jenis-dokumen', documentTypesIndex(prisma));
  router.post('/jenis-dokumen', documentTypeCreate(prisma));
  router.patch('/jenis-dokumen/:id', documentTypeUpdate(prisma));
  router.get('/persyaratan-pengajuan', requirementsIndex(prisma));
  router.post('/persyaratan-pengajuan', requirementCreate(prisma));
  router.patch('/persyaratan-pengajuan/:id', requirementUpdate(prisma));
  router.get('/kurikulum', kurikulumIndex(prisma));
  router.post('/kurikulum', kurikulumCreate(prisma));
  router.get('/kurikulum/:id', kurikulumDetail(prisma));
  router.patch('/kurikulum/:id', kurikulumUpdate(prisma));
  return router;
}
