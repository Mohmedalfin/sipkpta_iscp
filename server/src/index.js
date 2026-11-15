import 'dotenv/config';
import app from './app.js';
import { disconnectPrisma } from './config/prisma.js';
import { getJwtConfig } from './security/jwt.js';

try {
  getJwtConfig();
} catch (error) {
  console.error(
    `SIPKITA API gagal dimulai: ${error.message} Atur JWT_ACCESS_SECRET_BASE64 dari minimal 32 byte acak atau periksa JWT_ACCESS_EXPIRES_IN_SECONDS (1 sampai 3600). Lihat README.md.`
  );
  process.exit(1);
}
const port = Number(process.env.PORT) || 5000;
const server = app.listen(port, () => {
  console.log(`SIPKITA API berjalan di http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
