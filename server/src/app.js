import express from 'express';
import cors from 'cors';
import { apiReference } from '@scalar/express-api-reference';
import { getPrisma } from './config/prisma.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { createMailService } from './services/mail.service.js';
import { createMahasiswaRoutes } from './routes/mahasiswa.routes.js';
import { createDosenRoutes } from './routes/dosen.routes.js';
import { createDataDiriRoutes } from './routes/data-diri.routes.js';
import { createAdminDataDiriRoutes } from './routes/admin-data-diri.routes.js';
import { createPengajuanKpRoutes } from './routes/pengajuan-kp.routes.js';
import { createAdminPengajuanKpRoutes } from './routes/admin-pengajuan-kp.routes.js';
import { createPenugasanReviewerKpRoutes } from './routes/penugasan-reviewer-kp.routes.js';
import { createReviewProposalKpRoutes } from './routes/review-proposal-kp.routes.js';
import { createRealtimeRoutes } from './routes/realtime.routes.js';
import { createNotifikasiRoutes } from './routes/notifikasi.routes.js';
import { createFinalisasiKpRoutes } from './routes/finalisasi-kp.routes.js';
import { createBimbinganMahasiswaRoutes } from './routes/bimbingan-mahasiswa.routes.js';
import { createBimbinganPembimbingRoutes } from './routes/bimbingan-pembimbing.routes.js';
import { createKonfigurasiAkademikRoutes } from './routes/konfigurasi-akademik.routes.js';
import { createKetersediaanAkademikRoutes } from './routes/ketersediaan-akademik.routes.js';
import { openapiSpecification } from './config/swagger.js';

function allowedClientOrigins() {
  const configured = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = new Set(configured);
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }
  return origins;
}

export function createApp({ prisma = getPrisma(), mailService = createMailService() } = {}) {
  const app = express();
  app.locals.prisma = prisma;
  const clientOrigins = allowedClientOrigins();

  app.disable('x-powered-by');
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || clientOrigins.has(origin));
    },
  }));
  app.use(express.json({ limit: '16kb' }));

  // Endpoint OpenAPI JSON
  app.get(['/openapi.json', '/api/openapi.json'], (_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.json(openapiSpecification);
  });

  // Scalar API Reference Documentation
  const docsMiddleware = apiReference({
    theme: 'purple',
    spec: {
      content: openapiSpecification,
    },
  });
  app.use('/docs', docsMiddleware);
  app.use('/api/docs', docsMiddleware);

  app.use('/api/auth', createAuthRoutes({ prisma, mailService }));
  app.use('/api/master/mahasiswa', createMahasiswaRoutes({ prisma }));
  app.use('/api/master/dosen', createDosenRoutes({ prisma }));
  app.use('/api/mahasiswa', createDataDiriRoutes({ prisma }));
  app.use('/api/admin-prodi/verifikasi-data-diri', createAdminDataDiriRoutes({ prisma }));
  app.use('/api/pengajuan', createPengajuanKpRoutes({ prisma }));
  app.use('/api/pengajuan', createBimbinganMahasiswaRoutes({ prisma }));
  app.use('/api/pembimbing', createBimbinganPembimbingRoutes({ prisma }));
  app.use('/api/admin-prodi/pengajuan', createAdminPengajuanKpRoutes({ prisma }));
  app.use('/api/admin-prodi/konfigurasi', createKonfigurasiAkademikRoutes({ prisma }));
  app.use('/api/konfigurasi/akademik', createKetersediaanAkademikRoutes({ prisma }));
  app.use('/api/kaprodi', createPenugasanReviewerKpRoutes({ prisma }));
  app.use('/api/kaprodi', createFinalisasiKpRoutes({ prisma }));
  app.use('/api/reviewer', createReviewProposalKpRoutes({ prisma }));
  app.use('/api/realtime', createRealtimeRoutes({ prisma }));
  app.use('/api/notifikasi', createNotifikasiRoutes({ prisma }));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp();
