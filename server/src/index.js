import 'dotenv/config';
import app from './app.js';
import { disconnectPrisma } from './config/prisma.js';

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
