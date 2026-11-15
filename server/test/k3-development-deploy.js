import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const expectedDatabase = 'sipkita_dev';
const migration = '20261106000000_kurikulum_master';
const baseline = [
  '20261029174916_init_sipkita',
  '20261101000000_auth_sessions_refresh_tokens',
  '20261102000000_auth_session_active_role',
  '20261105000000_pengajuan_kp_admin_fields',
  '20261105010000_pengajuan_spp_variabel_declaration',
];
const serverRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const backupDirectory = 'D:\\laragon\\backups';
const pgDump = 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe';
const pgRestore = 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL tidak tersedia.');
const target = new URL(process.env.DATABASE_URL);
if (target.pathname !== `/${expectedDatabase}`) throw new Error('Target bukan sipkita_dev; operasi dihentikan.');

const connectionString = target.toString();
async function inspect() {
  const pool = new pg.Pool({ connectionString });
  try {
    const identity = await pool.query('SELECT current_database() AS name');
    if (identity.rows[0].name !== expectedDatabase) throw new Error('Identitas database tidak cocok.');
    const history = await pool.query('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations');
    if (history.rows.some((row) => !row.finished_at && !row.rolled_back_at)) {
      throw new Error('Ada migrasi gagal; operasi dihentikan.');
    }
    if (baseline.some((name) => !history.rows.some((row) => row.migration_name === name && row.finished_at))) {
      throw new Error('Lima migrasi baseline belum lengkap; operasi dihentikan.');
    }
    const k3Applied = history.rows.some((row) => row.migration_name === migration && row.finished_at);
    const k3Table = Boolean((await pool.query("SELECT to_regclass('public.kurikulum') AS name")).rows[0].name);
    if (k3Applied !== k3Table) throw new Error('Histori migrasi dan tabel K3 tidak konsisten.');
    const tables = ['program_studi', 'periode_akademik', 'jadwal_proses', 'pengajuan',
      'jenis_dokumen', 'persyaratan_pengajuan', 'users'];
    const counts = {};
    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*)::integer AS count FROM "${table}"`);
      counts[table] = result.rows[0].count;
    }
    const structure = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public'
        AND table_name <> 'kurikulum' AND table_name <> '_prisma_migrations'
      ORDER BY table_name, ordinal_position`);
    const structureHash = createHash('sha256').update(JSON.stringify(structure.rows)).digest('hex');
    return { k3Applied, k3Table, migrationCount: history.rows.filter((row) => row.finished_at).length,
      counts, structureHash };
  } finally { await pool.end(); }
}

function run(binary, args, env = process.env, quiet = false) {
  const result = spawnSync(binary, args, { cwd: serverRoot, env,
    stdio: quiet ? 'pipe' : 'inherit', encoding: quiet ? 'utf8' : undefined });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${binary} gagal (${result.status}): ${result.stderr || ''}`);
}

const before = await inspect();
console.log(`Database terverifikasi: ${expectedDatabase}; migrasi selesai: ${before.migrationCount}; K3: ${before.k3Applied}.`);
if (!process.argv.includes('--execute')) process.exit(0);
if (before.k3Applied || before.migrationCount !== baseline.length) {
  throw new Error('Kondisi awal berubah; migrasi tidak diterapkan.');
}
const sqlPath = resolve(serverRoot, 'prisma/migrations', migration, 'migration.sql');
const sql = await readFile(sqlPath, 'utf8');
const statements = sql.replace(/--[^\r\n]*/g, '').split(';').map((item) => item.trim()).filter(Boolean);
if (statements.length !== 3 ||
    !/^CREATE TABLE "kurikulum"\s*\(/i.test(statements[0]) ||
    !/^CREATE UNIQUE INDEX "kurikulum_program_studi_id_kode_kurikulum_key"\s+ON "kurikulum"/i.test(statements[1]) ||
    !/^ALTER TABLE "kurikulum" ADD CONSTRAINT "kurikulum_program_studi_id_fkey"/i.test(statements[2])) {
  throw new Error('SQL migrasi memuat operasi di luar tabel K3.');
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = resolve(backupDirectory, `${expectedDatabase}_before_k3_${stamp}.dump`);
const dumpEnv = { ...process.env, PGPASSWORD: decodeURIComponent(target.password) };
run(pgDump, ['-h', target.hostname, '-p', target.port || '5432', '-U', decodeURIComponent(target.username),
  '-d', expectedDatabase, '-Fc', '-f', backup], dumpEnv);
const backupSize = (await stat(backup)).size;
if (backupSize < 1024) throw new Error('Ukuran backup tidak wajar; migrasi dihentikan.');
const hash = createHash('sha256');
for await (const chunk of createReadStream(backup)) hash.update(chunk);
const digest = hash.digest('hex');
run(pgRestore, ['--list', backup], { ...dumpEnv, PGOPTIONS: '' }, true);
console.log(`Backup terverifikasi: ${backup}; ukuran ${backupSize} byte; SHA-256 ${digest}.`);
const preDeploy = await inspect();
if (JSON.stringify(preDeploy) !== JSON.stringify(before)) {
  throw new Error('Kondisi database berubah setelah backup; migrasi dihentikan.');
}
const cli = resolve(serverRoot, '../node_modules/prisma/build/index.js');
run(process.execPath, [cli, 'migrate', 'deploy'], { ...process.env, DATABASE_URL: connectionString });
const after = await inspect();
if (!after.k3Applied || !after.k3Table || after.migrationCount !== baseline.length + 1 ||
    JSON.stringify(after.counts) !== JSON.stringify(before.counts) ||
    after.structureHash !== before.structureHash) {
  throw new Error('Verifikasi pascamigrasi gagal; periksa database dan backup sebelum langkah lain.');
}
const pool = new pg.Pool({ connectionString });
try {
  const constraints = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid = 'public.kurikulum'::regclass`);
  const indexes = await pool.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'kurikulum'`);
  if (!constraints.rows.some((row) => row.contype === 'f' &&
      row.definition.includes('program_studi') && row.definition.includes('ON DELETE RESTRICT')) ||
      !indexes.rows.some((row) => row.indexname === 'kurikulum_program_studi_id_kode_kurikulum_key' &&
        row.indexdef.includes('UNIQUE'))) {
    throw new Error('FK atau unique index K3 tidak sesuai.');
  }
  console.log('K3 selesai: 6 migrasi; FK dan unique index terverifikasi; jumlah data dan struktur existing tetap.');
} finally { await pool.end(); }
