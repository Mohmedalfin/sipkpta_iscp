import 'dotenv/config';
import { getPrisma, disconnectPrisma } from '../src/config/prisma.js';

const themes = Object.freeze([
  { kode_tema: 'SMART_APP_SUPPORTING_IS', nama_tema: 'Smart Aplication Supporting Information System' },
  { kode_tema: 'AUDIT_SYSTEM_INFORMATION', nama_tema: 'Audit System Information' },
  { kode_tema: 'DEVELOPMENT_INFORMATION_SYS', nama_tema: 'Development Information System' },
]);

function expectedDatabase() {
  const args = process.argv.slice(2);
  const name = args[1];
  if (args.length !== 2 || args[0] !== 'apply' || !name ||
    !/^sipkita_(?:dev|test(?:_[a-zA-Z0-9_]+)?)$/.test(name)) {
    throw new Error('Gunakan apply sipkita_dev (atau nama database TEST SIPKITA).');
  }
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
    decodeURIComponent(url.pathname.slice(1)) !== name) {
    throw new Error('Target DATABASE_URL bukan database lokal yang diharapkan.');
  }
  return name;
}

async function seedThemes(prisma) {
  return prisma.$transaction(async (tx) => {
    const codes = themes.map((theme) => theme.kode_tema);
    const names = themes.map((theme) => theme.nama_tema);
    const existing = await tx.temaPenelitian.findMany({
      where: { OR: [{ kode_tema: { in: codes } }, { nama_tema: { in: names } }] },
    });
    let created = 0;
    for (const theme of themes) {
      const byCode = existing.find((row) => row.kode_tema === theme.kode_tema);
      const byName = existing.find((row) => row.nama_tema === theme.nama_tema);
      if (byCode || byName) {
        if (!byCode || !byName || byCode.id !== byName.id || !byCode.is_aktif) {
          throw new Error('Tema existing bentrok atau nonaktif: ' + theme.kode_tema);
        }
        continue;
      }
      await tx.temaPenelitian.create({ data: theme });
      created += 1;
    }
    return { created, validated: themes.length - created };
  });
}

async function main() {
  const expected = expectedDatabase();
  const prisma = getPrisma();
  if (!prisma) throw new Error('Koneksi database tidak tersedia.');
  try {
    const [database] = await prisma.$queryRaw`SELECT current_database() AS name`;
    if (database.name !== expected) throw new Error('Database aktif tidak sesuai target.');
    const result = await seedThemes(prisma);
    console.log(JSON.stringify({ database: expected, ...result }));
  } finally {
    await disconnectPrisma();
  }
}

main().catch((error) => {
  console.error('[Seed Tema Penelitian Gagal]', error.message);
  process.exitCode = 1;
});
