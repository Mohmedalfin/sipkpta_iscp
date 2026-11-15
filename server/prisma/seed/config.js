import 'dotenv/config';

/**
 * Validasi lingkungan development dan ketersediaan variabel SIPKITA_DEV_SEED_PASSWORD.
 * Mencegah eksekusi pada environment non-development atau target database yang tidak aman.
 */
export function validateSeedEnvironment() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      "NODE_ENV wajib bernilai 'development'. Operasi fixture development dibatalkan."
    );
  }

  const seedPassword = process.env.SIPKITA_DEV_SEED_PASSWORD;
  if (!seedPassword || seedPassword.trim() === '') {
    throw new Error(
      "Variabel lingkungan 'SIPKITA_DEV_SEED_PASSWORD' belum disetel. Seeder dihentikan untuk menjaga keamanan kredensial akun development."
    );
  }

  if (seedPassword.length < 8) {
    throw new Error(
      "Nilai 'SIPKITA_DEV_SEED_PASSWORD' tidak memenuhi syarat minimum keamanan (panjang minimal 8 karakter)."
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Variabel lingkungan 'DATABASE_URL' tidak ditemukan.");
  }

  let dbHost = '';
  let dbName = '';
  try {
    const parsed = new URL(databaseUrl);
    dbHost = parsed.hostname;
    dbName = parsed.pathname.replace(/^\//, '');
  } catch (err) {
    throw new Error(`Format DATABASE_URL tidak valid: ${err.message}`);
  }

  // Pengaman: host harus localhost/127.0.0.1/::1 dan nama db harus bertarget development
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(dbHost);
  const isDevDb = /dev|test/i.test(dbName) && !/prod|production/i.test(dbName);

  if (!isLocalHost || !isDevDb) {
    throw new Error(
      `Target database (${dbHost}/${dbName}) tidak teridentifikasi sebagai database development lokal yang aman. Seeder dibatalkan untuk keselamatan data.`
    );
  }

  return {
    seedPassword,
    dbHost,
    dbName,
  };
}
