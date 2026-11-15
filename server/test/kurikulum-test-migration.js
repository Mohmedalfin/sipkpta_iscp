import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import pg from 'pg';

const database = 'sipkita_test_kp_d1_spp_20261105070147_1066f27b';
const migration = '20261106000000_kurikulum_master';
const baseline = [
  '20261029174916_init_sipkita',
  '20261101000000_auth_sessions_refresh_tokens',
  '20261102000000_auth_session_active_role',
  '20261105000000_pengajuan_kp_admin_fields',
  '20261105010000_pengajuan_spp_variabel_declaration',
];

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL baseline tidak tersedia.');
const target = new URL(process.env.DATABASE_URL);
target.pathname = `/${database}`;
target.searchParams.delete('schema');
const connectionString = target.toString();

async function inspect() {
  const pool = new pg.Pool({ connectionString });
  try {
    const identity = await pool.query('SELECT current_database() AS name');
    if (identity.rows[0].name !== database) throw new Error('Target bukan PostgreSQL TEST yang ditetapkan.');
    const history = await pool.query('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations');
    if (history.rows.some((row) => !row.finished_at && !row.rolled_back_at)) {
      throw new Error('Ada migrasi TEST yang gagal; operasi dihentikan.');
    }
    if (baseline.some((name) => !history.rows.some((row) => row.migration_name === name && row.finished_at))) {
      throw new Error('Baseline lima migrasi TEST belum lengkap; operasi dihentikan.');
    }
    const table = await pool.query("SELECT to_regclass('public.kurikulum') AS name");
    return { applied: history.rows.some((row) => row.migration_name === migration && row.finished_at),
      table: Boolean(table.rows[0].name), count: history.rows.filter((row) => row.finished_at).length };
  } finally { await pool.end(); }
}

const before = await inspect();
console.log(`TEST terverifikasi; migrasi selesai: ${before.count}; K3 diterapkan: ${before.applied}.`);
if (before.applied !== before.table) throw new Error('Status tabel dan histori migrasi K3 tidak konsisten.');
if (process.argv.includes('--apply') && !before.applied) {
  if (before.count !== baseline.length) throw new Error('Histori TEST berubah dari baseline yang diharapkan.');
  const cli = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../node_modules/prisma/build/index.js');
  const result = spawnSync(process.execPath, [cli, 'migrate', 'deploy'], {
    cwd: resolve(fileURLToPath(new URL('.', import.meta.url)), '..'),
    env: { ...process.env, DATABASE_URL: connectionString }, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Prisma migrate deploy gagal (${result.status}).`);
}
const after = await inspect();
if (process.argv.includes('--apply') && (!after.applied || !after.table)) {
  throw new Error('Migrasi K3 tidak terverifikasi pada TEST.');
}
console.log(`TEST akhir: K3 diterapkan: ${after.applied}; tabel tersedia: ${after.table}.`);
