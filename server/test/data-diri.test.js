import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createApp } from '../src/app.js';
import { parseOwnProfile } from '../src/controllers/data-diri.controller.js';
import { REQUIRED_DOCUMENT_CODES } from '../src/services/data-diri.service.js';
import { signAccessToken } from '../src/security/jwt.js';
import { hashPassword } from '../src/security/password.js';

test('profil opsional hanya menerima dua field dan menormalisasi nilai', () => {
  assert.deepEqual(parseOwnProfile({ no_telepon: ' 0812-3456 7890 ', alamat: '  Jalan Kampus  ' }), {
    no_telepon: '081234567890', alamat: 'Jalan Kampus',
  });
  assert.deepEqual(parseOwnProfile({ no_telepon: '', alamat: null }), { no_telepon: null, alamat: null });
  for (const body of [{}, { nim: '00000001' }, { alamat: '<script>' }, { no_telepon: 'abc' },
    { no_telepon: 8123 }, { no_telepon: `+${'1'.repeat(20)}` }, { alamat: 'x'.repeat(5001) }]) {
    assert.equal(parseOwnProfile(body), null);
  }
});

function pdf() {
  let content = '%PDF-1.4\n';
  const offsets = [0];
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ];
  for (const [index, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = Buffer.byteLength(content);
  content += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map((offset) =>
    `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
}

async function request(base, token, path, { method = 'GET', body, file, filename = 'data.pdf', mime = 'application/pdf' } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload;
  if (file !== undefined) {
    payload = new FormData();
    payload.set('file', new Blob([file], { type: mime }), filename);
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${base}/api/mahasiswa${path}`, { method, headers, body: payload });
  return { status: response.status, body: response.headers.get('content-type')?.includes('application/json')
    ? await response.json() : await response.arrayBuffer(), headers: response.headers };
}

test('data diri: HTTP, versi, otorisasi, storage dan PostgreSQL terisolasi',
  { skip: process.env.SIPKITA_DATA_DIRI_REAL_DB !== '1' }, async () => {
    const source = new URL(process.env.DATABASE_URL);
    assert.equal(source.pathname, '/sipkita_dev');
    source.pathname = '/sipkita_master_import_test';
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: source.toString() }) });
    const storageRoot = await mkdtemp(join(tmpdir(), 'sipkita-data-diri-'));
    const oldStorageRoot = process.env.SIPKITA_PRIVATE_STORAGE_DIR;
    process.env.SIPKITA_PRIVATE_STORAGE_DIR = storageRoot;
    process.env.JWT_ACCESS_SECRET_BASE64 ||= randomBytes(32).toString('base64url');
    let server;
    let failure;
    let safeToClean = false;
    const ids = { users: [], profiles: [], types: [], roles: [], prodi: null };
    try {
      const counts = await Promise.all([
        prisma.user.count(), prisma.mahasiswa.count(), prisma.verifikasiDataDiri.count(),
        prisma.dokumen.count(), prisma.dokumenDataDiri.count(), prisma.role.count(),
        prisma.programStudi.count(), prisma.jenisDokumen.count(), prisma.authSession.count(),
      ]);
      assert.deepEqual(counts, Array(counts.length).fill(0));
      safeToClean = true;
      const prodi = await prisma.programStudi.create({ data: {
        kode_prodi: 'DIRI_TEST', nama_prodi: 'Prodi Test', jenjang: 'S1',
        nama_fakultas: 'Fakultas Test', nama_perguruan_tinggi: 'Universitas Test',
      } });
      ids.prodi = prodi.id;
      for (const code of ['MAHASISWA', 'ADMIN_PRODI']) {
        const role = await prisma.role.create({ data: { kode_peran: code, nama_peran: code } });
        ids.roles.push(role.id);
      }
      for (const code of REQUIRED_DOCUMENT_CODES) {
        const type = await prisma.jenisDokumen.create({ data: {
          kode_jenis: code, nama_jenis: code, kategori_dokumen: 'DATA_DIRI',
          format_diizinkan: ['pdf'], maks_ukuran_mb: 5,
        } });
        ids.types.push(type.id);
      }
      for (const index of [1, 2, 3]) {
        const user = await prisma.user.create({ data: {
          login_id: `diri.test.${index}`, email: `diri-${index}@example.test`,
          password_hash: await hashPassword(randomBytes(24).toString('base64url')),
        } });
        ids.users.push(user.id);
        const roleId = index === 3 ? ids.roles[1] : ids.roles[0];
        await prisma.userRole.create({ data: { user_id: user.id, role_id: roleId } });
        if (index !== 2) {
          const profile = await prisma.mahasiswa.create({ data: {
            user_id: user.id, program_studi_id: prodi.id, nim: `0000000${index}`,
            nama_lengkap: `Mahasiswa ${index}`, tanggal_lahir: new Date('2002-01-01T00:00:00Z'),
          } });
          ids.profiles.push(profile.id);
        }
      }
      const tokens = [];
      for (const [index, userId] of ids.users.entries()) {
        const id = randomUUID();
        const roleId = index === 2 ? ids.roles[1] : ids.roles[0];
        await prisma.authSession.create({ data: {
          id, user_id: userId, active_role_id: roleId,
          expires_at: new Date(Date.now() + 3600000),
        } });
        tokens.push((await signAccessToken(userId, id, index === 2 ? 'ADMIN_PRODI' : 'MAHASISWA', 0)).token);
      }
      server = createApp({ prisma }).listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      const path = '/me/data-diri';
      assert.equal((await request(base, null, path)).status, 401);
      assert.equal((await request(base, tokens[2], path)).status, 403);
      assert.equal((await request(base, tokens[1], path)).status, 404);
      const initial = await request(base, tokens[0], path);
      assert.equal(initial.status, 200);
      assert.equal(initial.body.data.kelengkapan.jumlah_terunggah, 0);
      assert.equal(JSON.stringify(initial.body).includes('password_hash'), false);
      assert.equal(JSON.stringify(initial.body).includes('storage_key'), false);
      assert.equal((await request(base, tokens[0], '/me/profil', {
        method: 'PATCH', body: { no_telepon: ' 0812-3456 7890 ', alamat: '  Jalan Kampus  ' },
      })).status, 200);
      assert.equal((await request(base, tokens[0], '/me/profil', {
        method: 'PATCH', body: { nim: '99999999', tanggal_lahir: '2000-01-01' },
      })).status, 400);
      const profile = await prisma.mahasiswa.findUnique({ where: { id: ids.profiles[0] } });
      assert.equal(profile.nim, '00000001');
      assert.equal(profile.no_telepon, '081234567890');
      assert.equal((await request(base, tokens[0], path)).body.data.kelengkapan.jumlah_terunggah, 0);

      const validFile = pdf();
      const fake = await request(base, tokens[0], `${path}/dokumen/IJAZAH`, {
        method: 'PUT', file: Buffer.from('%PDF-1.4\nnot a PDF'),
      });
      assert.equal(fake.status, 400);
      assert.equal((await request(base, tokens[0], `${path}/dokumen/LAIN`, {
        method: 'PUT', file: validFile,
      })).status, 404);
      assert.equal((await request(base, tokens[0], `${path}/dokumen/IJAZAH`, {
        method: 'PUT', file: validFile, filename: 'data.txt',
      })).status, 400);
      assert.equal((await request(base, tokens[0], `${path}/dokumen/IJAZAH`, {
        method: 'PUT', file: Buffer.alloc(5 * 1024 * 1024 + 1),
      })).status, 413);
      for (const [index, code] of REQUIRED_DOCUMENT_CODES.entries()) {
        const uploaded = await request(base, tokens[0], `${path}/dokumen/${code}`, {
          method: 'PUT', file: validFile,
        });
        assert.equal(uploaded.status, 201);
        assert.equal(uploaded.body.data.versi, 1);
        assert.equal(uploaded.body.data.status_dokumen, 'BELUM_DIPERIKSA');
        assert.equal((await request(base, tokens[0], path)).body.data.kelengkapan.jumlah_terunggah, index + 1);
      }
      const complete = (await request(base, tokens[0], path)).body.data;
      assert.equal(complete.kelengkapan.lengkap, true);
      assert.equal(complete.kelengkapan.sudah_diverifikasi, false);
      const documentCount = await prisma.dokumen.count();
      const versionCount = await prisma.dokumenDataDiri.count();
      const storedFileCount = (await readdir(join(storageRoot, 'data-diri'))).length;
      const invalidFiles = [
        Buffer.from('%PDF-1.4\nxref\nstartxref\n9\n%%EOF\n'),
        Buffer.from(validFile.toString().replace('/Root 1 0 R', '/Root 9 0 R')),
        Buffer.from(validFile.toString().replace('/Count 1', '/Count 0')),
        Buffer.alloc(0),
      ];
      for (const invalidFile of invalidFiles) {
        const failed = await request(base, tokens[0], `${path}/dokumen/KTP`, {
          method: 'PUT', file: invalidFile,
        });
        assert.equal(failed.status, 400);
        assert.equal(failed.body.error.code, 'INVALID_DOCUMENT');
        assert.equal(await prisma.dokumen.count(), documentCount);
        assert.equal(await prisma.dokumenDataDiri.count(), versionCount);
        assert.equal((await readdir(join(storageRoot, 'data-diri'))).length, storedFileCount);
        const currentKtp = (await request(base, tokens[0], path)).body.data.dokumen.find((item) =>
          item.kode_jenis === 'KTP');
        assert.equal(currentKtp.versi_terkini, 1);
      }
      const beforeOthers = await prisma.dokumenDataDiri.findMany({
        where: { verifikasi_data_diri: { mahasiswa_id: ids.profiles[0] }, is_terkini: true },
        select: { id: true, jenis_dokumen_id: true },
      });
      const replaced = await request(base, tokens[0], `${path}/dokumen/KTP`, { method: 'PUT', file: validFile });
      assert.equal(replaced.status, 201);
      assert.equal(replaced.body.data.versi, 2);
      const history = await prisma.dokumenDataDiri.findMany({
        where: { verifikasi_data_diri: { mahasiswa_id: ids.profiles[0] }, jenis_dokumen: { kode_jenis: 'KTP' } },
        orderBy: { versi: 'asc' },
      });
      assert.deepEqual(history.map((item) => [item.versi, item.is_terkini]), [[1, false], [2, true]]);
      const afterOthers = await prisma.dokumenDataDiri.findMany({
        where: { verifikasi_data_diri: { mahasiswa_id: ids.profiles[0] }, is_terkini: true },
        select: { id: true, jenis_dokumen_id: true },
      });
      assert.equal(afterOthers.filter((item) => beforeOthers.some((old) =>
        old.id === item.id && old.jenis_dokumen_id !== history[0].jenis_dokumen_id)).length, 5);
      const downloaded = await request(base, tokens[0], `${path}/dokumen/KTP/file`);
      assert.equal(downloaded.status, 200);
      assert.deepEqual(Buffer.from(downloaded.body), validFile);
      assert.equal(downloaded.headers.get('cache-control'), 'private, no-store');
      assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
      assert.equal((await request(base, tokens[1], `${path}/dokumen/KTP/file`)).status, 404);

      const parallel = await Promise.all([1, 2].map(() => request(base, tokens[0], `${path}/dokumen/KTP`, {
        method: 'PUT', file: validFile,
      })));
      assert.deepEqual(parallel.map((item) => item.status).sort(), [201, 201]);
      assert.equal(await prisma.dokumenDataDiri.count({ where: {
        verifikasi_data_diri: { mahasiswa_id: ids.profiles[0] },
        jenis_dokumen: { kode_jenis: 'KTP' }, is_terkini: true,
      } }), 1);
      assert.equal((await request(base, tokens[0], path)).body.data.dokumen.find((item) =>
        item.kode_jenis === 'KTP').versi_terkini, 4);
      await prisma.dokumenDataDiri.updateMany({ where: {
        verifikasi_data_diri: { mahasiswa_id: ids.profiles[0] },
        jenis_dokumen: { kode_jenis: 'KTP' }, is_terkini: true,
      }, data: { status_dokumen: 'PERLU_PERBAIKAN' } });
      assert.equal((await request(base, tokens[0], `${path}/dokumen/KTP`, {
        method: 'PUT', file: validFile,
      })).body.data.versi, 5);
      const fileCount = (await readdir(join(storageRoot, 'data-diri'))).length;
      await prisma.dokumenDataDiri.updateMany({ where: {
        verifikasi_data_diri: { mahasiswa_id: ids.profiles[0] },
        jenis_dokumen: { kode_jenis: 'KTP' }, is_terkini: true,
      }, data: { status_dokumen: 'TERVERIFIKASI' } });
      const documentCountBeforeLockedUpload = await prisma.dokumen.count();
      const versionCountBeforeLockedUpload = await prisma.dokumenDataDiri.count();
      assert.equal((await request(base, tokens[0], `${path}/dokumen/KTP`, {
        method: 'PUT', file: validFile,
      })).status, 409);
      assert.equal((await readdir(join(storageRoot, 'data-diri'))).length, fileCount);
      assert.equal(await prisma.dokumen.count(), documentCountBeforeLockedUpload);
      assert.equal(await prisma.dokumenDataDiri.count(), versionCountBeforeLockedUpload);
    } catch (error) {
      failure = error;
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      try {
        if (!safeToClean) throw new Error('Cleanup dilewati: database test tidak kosong sebelum tes.');
        const verifications = await prisma.verifikasiDataDiri.findMany({
          where: { mahasiswa_id: { in: ids.profiles } }, select: { id: true },
        });
        const verificationIds = verifications.map((item) => item.id);
        const documents = await prisma.dokumenDataDiri.findMany({
          where: { verifikasi_data_diri_id: { in: verificationIds } }, select: { dokumen_id: true },
        });
        await prisma.dokumenDataDiri.deleteMany({ where: { verifikasi_data_diri_id: { in: verificationIds } } });
        await prisma.dokumen.deleteMany({ where: { id: { in: documents.map((item) => item.dokumen_id) } } });
        await prisma.verifikasiDataDiri.deleteMany({ where: { id: { in: verificationIds } } });
        await prisma.authSession.deleteMany({ where: { user_id: { in: ids.users } } });
        await prisma.userRole.deleteMany({ where: { user_id: { in: ids.users } } });
        await prisma.mahasiswa.deleteMany({ where: { id: { in: ids.profiles } } });
        await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
        await prisma.jenisDokumen.deleteMany({ where: { id: { in: ids.types } } });
        await prisma.role.deleteMany({ where: { id: { in: ids.roles } } });
        if (ids.prodi) await prisma.programStudi.delete({ where: { id: ids.prodi } });
      } catch (error) { failure ??= error; }
      await prisma.$disconnect();
      try {
        const directory = join(storageRoot, 'data-diri');
        for (const name of await readdir(directory)) await unlink(join(directory, name));
        await rmdir(directory);
        await rmdir(storageRoot);
      } catch (error) { failure ??= error; }
      if (oldStorageRoot === undefined) delete process.env.SIPKITA_PRIVATE_STORAGE_DIR;
      else process.env.SIPKITA_PRIVATE_STORAGE_DIR = oldStorageRoot;
    }
    if (failure) throw failure;
  });
