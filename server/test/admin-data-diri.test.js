import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/security/jwt.js';
import { hashPassword } from '../src/security/password.js';
import {
  parseAdminDataDiriQuery,
  parseDecisionBody,
  parsePositiveId,
  parseVerifyAllBody,
} from '../src/controllers/admin-data-diri.controller.js';
import { deriveVerificationStatus } from '../src/services/admin-data-diri.service.js';
import { REQUIRED_DOCUMENT_CODES } from '../src/services/data-diri.service.js';

function documents(statuses) {
  return REQUIRED_DOCUMENT_CODES.slice(0, statuses.length).map((code, index) => ({
    kode_jenis: code,
    is_terkini: true,
    status_dokumen: statuses[index],
  }));
}

test('parsePositiveId hanya menerima ID integer PostgreSQL positif', () => {
  assert.equal(parsePositiveId('1'), 1);
  assert.equal(parsePositiveId('2147483647'), 2147483647);
  for (const value of ['0', '-1', '01', '1.5', '2147483648', 'abc', undefined]) {
    assert.equal(parsePositiveId(value), null);
  }
});

test('query daftar memvalidasi pagination, pencarian, status, dan progres', () => {
  assert.deepEqual(parseAdminDataDiriQuery({}), {
    page: 1, limit: 20, search: '', status: '', lengkap: null,
  });
  assert.deepEqual(parseAdminDataDiriQuery({
    page: '2', limit: '10', search: '  Budi  ', status: 'BELUM_LENGKAP', lengkap: 'false',
  }), {
    page: 2, limit: 10, search: 'Budi', status: 'BELUM_LENGKAP', lengkap: false,
  });
  assert.equal(parseAdminDataDiriQuery({ limit: '101' }), null);
  assert.equal(parseAdminDataDiriQuery({ status: 'INVALID' }), null);
  assert.equal(parseAdminDataDiriQuery({ lengkap: '1' }), null);
  assert.equal(parseAdminDataDiriQuery({ unknown: 'x' }), null);
});

test('payload keputusan membatasi status, expectedVersion, dan catatan revisi', () => {
  assert.deepEqual(parseDecisionBody({
    status: 'PERLU_PERBAIKAN', catatan: '  PDF buram.  ', expectedVersion: 2,
  }), { status: 'PERLU_PERBAIKAN', note: 'PDF buram.', expectedVersion: 2 });
  assert.deepEqual(parseDecisionBody({ status: 'TERVERIFIKASI', expectedVersion: 1 }), {
    status: 'TERVERIFIKASI', note: null, expectedVersion: 1,
  });
  assert.equal(parseDecisionBody({ status: 'PERLU_PERBAIKAN', catatan: '  ', expectedVersion: 1 }), null);
  assert.equal(parseDecisionBody({ status: 'TERVERIFIKASI', expectedVersion: 0 }), null);
  assert.equal(parseDecisionBody({ status: 'TERVERIFIKASI', expectedVersion: 1, actorUserId: 9 }), null);
});

test('payload verifikasi semua mewajibkan tepat enam kode dan versi positif', () => {
  const expectedVersions = Object.fromEntries(REQUIRED_DOCUMENT_CODES.map((code) => [code, 1]));
  assert.deepEqual(parseVerifyAllBody({ expectedVersions }), { expectedVersions });
  assert.equal(parseVerifyAllBody({ expectedVersions: { ...expectedVersions, EXTRA: 1 } }), null);
  const incomplete = { ...expectedVersions };
  delete incomplete.KTP;
  assert.equal(parseVerifyAllBody({ expectedVersions: incomplete }), null);
  assert.equal(parseVerifyAllBody({ expectedVersions: { ...expectedVersions, KTP: 0 } }), null);
});

test('status agregat hanya menghitung enam dokumen terkini wajib', () => {
  assert.equal(deriveVerificationStatus(documents(Array(5).fill('TERVERIFIKASI'))), 'BELUM_LENGKAP');
  assert.equal(deriveVerificationStatus(documents([
    'TERVERIFIKASI', 'TERVERIFIKASI', 'PERLU_PERBAIKAN',
    'TERVERIFIKASI', 'TERVERIFIKASI', 'TERVERIFIKASI',
  ])), 'PERLU_PERBAIKAN');
  assert.equal(deriveVerificationStatus(documents([
    'TERVERIFIKASI', 'TERVERIFIKASI', 'BELUM_DIPERIKSA',
    'TERVERIFIKASI', 'TERVERIFIKASI', 'TERVERIFIKASI',
  ])), 'BELUM_DIVERIFIKASI');
  assert.equal(deriveVerificationStatus(documents(Array(6).fill('TERVERIFIKASI'))), 'TERVERIFIKASI');
  assert.equal(deriveVerificationStatus([
    ...documents(Array(6).fill('TERVERIFIKASI')),
    { kode_jenis: 'LAIN', is_terkini: true, status_dokumen: 'PERLU_PERBAIKAN' },
    { kode_jenis: 'KTP', is_terkini: false, status_dokumen: 'PERLU_PERBAIKAN' },
  ]), 'TERVERIFIKASI');
});

function validPdf() {
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

async function http(base, token, path, { method = 'GET', body, file } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload;
  if (file) {
    payload = new FormData();
    payload.set('file', new Blob([file], { type: 'application/pdf' }), 'data.pdf');
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${base}/api${path}`, { method, headers, body: payload });
  const result = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : await response.arrayBuffer();
  return { status: response.status, body: result, headers: response.headers };
}

test('verifikasi Admin Prodi: HTTP, transaksi, audit, revisi, dan PostgreSQL terisolasi',
  { skip: process.env.SIPKITA_ADMIN_DATA_DIRI_REAL_DB !== '1' }, async () => {
    const source = new URL(process.env.DATABASE_URL);
    assert.equal(source.pathname, '/sipkita_dev');
    source.pathname = '/sipkita_master_import_test';
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: source.toString() }) });
    const storageRoot = await mkdtemp(join(tmpdir(), 'sipkita-admin-data-diri-'));
    const oldStorageRoot = process.env.SIPKITA_PRIVATE_STORAGE_DIR;
    process.env.SIPKITA_PRIVATE_STORAGE_DIR = storageRoot;
    process.env.JWT_ACCESS_SECRET_BASE64 ||= randomBytes(32).toString('base64url');
    let server;
    let failure;
    let safeToClean = false;
    const ids = { users: [], profiles: [], types: [], roles: [], prodi: null, extraProdi: null };
    try {
      const countModels = [
        'user', 'mahasiswa', 'verifikasiDataDiri', 'dokumen', 'dokumenDataDiri',
        'role', 'programStudi', 'jenisDokumen', 'authSession', 'auditLog',
      ];
      const beforeCounts = await Promise.all(countModels.map((model) => prisma[model].count()));
      assert.deepEqual(beforeCounts, Array(beforeCounts.length).fill(0));
      safeToClean = true;

      const prodi = await prisma.programStudi.create({ data: {
        kode_prodi: 'VERIF_TEST', nama_prodi: 'Prodi Verifikasi Test', jenjang: 'S1',
        nama_fakultas: 'Fakultas Test', nama_perguruan_tinggi: 'Universitas Test',
      } });
      ids.prodi = prodi.id;
      for (const code of ['ADMIN_PRODI', 'MAHASISWA']) {
        const role = await prisma.role.create({ data: { kode_peran: code, nama_peran: code } });
        ids.roles.push(role.id);
      }
      for (const code of REQUIRED_DOCUMENT_CODES) {
        const type = await prisma.jenisDokumen.create({ data: {
          kode_jenis: code,
          nama_jenis: code,
          kategori_dokumen: 'DATA_DIRI',
          format_diizinkan: ['pdf'],
          maks_ukuran_mb: 5,
        } });
        ids.types.push(type.id);
      }
      for (const index of [0, 1, 2, 3]) {
        const user = await prisma.user.create({ data: {
          login_id: `verif.test.${index}`,
          email: `verif-${index}@example.test`,
          password_hash: await hashPassword(randomBytes(24).toString('base64url')),
        } });
        ids.users.push(user.id);
        const isAdmin = index === 0 || index === 3;
        const roleId = isAdmin ? ids.roles[0] : ids.roles[1];
        await prisma.userRole.create({ data: { user_id: user.id, role_id: roleId } });
        if (!isAdmin) {
          const profile = await prisma.mahasiswa.create({ data: {
            user_id: user.id,
            program_studi_id: prodi.id,
            nim: `9911000${index}`,
            nama_lengkap: `Mahasiswa Verifikasi ${index}`,
            tanggal_lahir: new Date('2002-01-01T00:00:00Z'),
          } });
          ids.profiles.push(profile.id);
        }
      }
      const tokens = [];
      for (const [index, userId] of ids.users.entries()) {
        const sessionId = randomUUID();
        const isAdmin = index === 0 || index === 3;
        const roleId = isAdmin ? ids.roles[0] : ids.roles[1];
        const role = isAdmin ? 'ADMIN_PRODI' : 'MAHASISWA';
        await prisma.authSession.create({ data: {
          id: sessionId,
          user_id: userId,
          active_role_id: roleId,
          expires_at: new Date(Date.now() + 3600000),
        } });
        tokens.push((await signAccessToken(userId, sessionId, role, 0)).token);
      }

      server = createApp({ prisma }).listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      const adminPrefix = '/admin-prodi/verifikasi-data-diri';
      const completeId = ids.profiles[0];
      const incompleteId = ids.profiles[1];
      const file = validPdf();

      assert.equal((await http(base, null, adminPrefix)).status, 401);
      assert.equal((await http(base, tokens[1], adminPrefix)).status, 403);
      assert.equal((await http(base, tokens[0], `${adminPrefix}/999999`)).status, 404);

      for (const code of REQUIRED_DOCUMENT_CODES) {
        assert.equal((await http(base, tokens[1], `/mahasiswa/me/data-diri/dokumen/${code}`, {
          method: 'PUT', file,
        })).status, 201);
      }
      for (const code of REQUIRED_DOCUMENT_CODES.slice(0, 5)) {
        assert.equal((await http(base, tokens[2], `/mahasiswa/me/data-diri/dokumen/${code}`, {
          method: 'PUT', file,
        })).status, 201);
      }

      const list = await http(base, tokens[0], `${adminPrefix}?status=BELUM_DIVERIFIKASI&lengkap=true`);
      assert.equal(list.status, 200);
      assert.deepEqual(list.body.data.map((item) => item.id), [completeId]);
      assert.equal(list.body.meta.pagination.total_items, 1);
      assert.deepEqual(list.body.meta.summary, {
        belumLengkap: 1, belumDiverifikasi: 1, perluPerbaikan: 0, terverifikasi: 0,
      });
      const incompleteList = await http(base, tokens[0], `${adminPrefix}?status=BELUM_LENGKAP`);
      assert.deepEqual(incompleteList.body.data.map((item) => item.id), [incompleteId]);
      assert.equal(incompleteList.body.meta.pagination.total_items, 1);
      const paged = await http(base, tokens[0], `${adminPrefix}?page=2&limit=1`);
      assert.equal(paged.body.data.length, 1);
      assert.equal(paged.body.meta.pagination.total_items, 2);

      const detail = await http(base, tokens[0], `${adminPrefix}/${completeId}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.data.dokumen.length, 6);
      assert.equal(detail.body.data.kelengkapan.jumlah_terunggah, 6);
      assert.equal(JSON.stringify(detail.body).includes('storage_key'), false);
      assert.equal(JSON.stringify(detail.body).includes('password_hash'), false);
      const downloaded = await http(base, tokens[0], `${adminPrefix}/${completeId}/dokumen/KTP/file`);
      assert.equal(downloaded.status, 200);
      assert.deepEqual(Buffer.from(downloaded.body), file);
      assert.equal(downloaded.headers.get('cache-control'), 'private, no-store');

      const versions1 = Object.fromEntries(REQUIRED_DOCUMENT_CODES.map((code) => [code, 1]));
      assert.equal((await http(base, tokens[0], `${adminPrefix}/${completeId}/dokumen/KTP`, {
        method: 'PATCH', body: { status: 'PERLU_PERBAIKAN', expectedVersion: 1 },
      })).status, 400);
      for (const code of REQUIRED_DOCUMENT_CODES.filter((item) => item !== 'KTP')) {
        assert.equal((await http(base, tokens[0], `${adminPrefix}/${completeId}/dokumen/${code}`, {
          method: 'PATCH', body: { status: 'TERVERIFIKASI', expectedVersion: 1 },
        })).status, 200);
      }
      const repair = await http(base, tokens[0], `${adminPrefix}/${completeId}/dokumen/KTP`, {
        method: 'PATCH',
        body: { status: 'PERLU_PERBAIKAN', catatan: 'Foto KTP buram.', expectedVersion: 1 },
      });
      assert.equal(repair.status, 200);
      assert.equal(repair.body.data.status_verifikasi, 'PERLU_PERBAIKAN');
      const repairQueue = await http(base, tokens[0], `${adminPrefix}?status=PERLU_PERBAIKAN`);
      assert.deepEqual(repairQueue.body.data.map((item) => item.id), [completeId]);
      assert.equal(repairQueue.body.meta.summary.perluPerbaikan, 1);

      const beforeFailedBulk = await prisma.dokumenDataDiri.findMany({
        where: { verifikasi_data_diri: { mahasiswa_id: completeId }, is_terkini: true },
        orderBy: { jenis_dokumen_id: 'asc' },
        select: { id: true, status_dokumen: true, diperiksa_at: true },
      });
      const failedBulk = await http(base, tokens[0], `${adminPrefix}/${completeId}/verifikasi-semua`, {
        method: 'POST', body: { expectedVersions: versions1 },
      });
      assert.equal(failedBulk.status, 409);
      assert.equal(failedBulk.body.error.code, 'DOCUMENT_REVISION_PENDING');
      assert.deepEqual(await prisma.dokumenDataDiri.findMany({
        where: { verifikasi_data_diri: { mahasiswa_id: completeId }, is_terkini: true },
        orderBy: { jenis_dokumen_id: 'asc' },
        select: { id: true, status_dokumen: true, diperiksa_at: true },
      }), beforeFailedBulk);

      const revised = await http(base, tokens[1], '/mahasiswa/me/data-diri/dokumen/KTP', {
        method: 'PUT', file,
      });
      assert.equal(revised.status, 201);
      assert.equal(revised.body.data.versi, 2);
      const headerAfterRevision = await prisma.verifikasiDataDiri.findUnique({
        where: { mahasiswa_id: completeId }, select: { status_verifikasi: true },
      });
      assert.equal(headerAfterRevision.status_verifikasi, 'BELUM_DIVERIFIKASI');
      const history = await prisma.dokumenDataDiri.findMany({
        where: { verifikasi_data_diri: { mahasiswa_id: completeId }, jenis_dokumen: { kode_jenis: 'KTP' } },
        orderBy: { versi: 'asc' },
        select: { versi: true, is_terkini: true, status_dokumen: true, catatan_admin: true },
      });
      assert.deepEqual(history, [
        { versi: 1, is_terkini: false, status_dokumen: 'PERLU_PERBAIKAN', catatan_admin: 'Foto KTP buram.' },
        { versi: 2, is_terkini: true, status_dokumen: 'BELUM_DIPERIKSA', catatan_admin: null },
      ]);
      const revisedDetail = await http(base, tokens[0], `${adminPrefix}/${completeId}`);
      const ktpDetail = revisedDetail.body.data.dokumen.find((item) => item.kode_jenis === 'KTP');
      assert.equal(ktpDetail.dokumen_terkini.versi, 2);
      assert.equal(ktpDetail.riwayat_versi.length, 2);
      assert.equal(ktpDetail.riwayat_versi[1].catatan_admin, 'Foto KTP buram.');
      assert.equal((await http(base, tokens[0], `${adminPrefix}/${completeId}/dokumen/KTP`, {
        method: 'PATCH', body: { status: 'TERVERIFIKASI', expectedVersion: 1 },
      })).status, 409);

      const preserved = await prisma.dokumenDataDiri.findFirst({
        where: {
          verifikasi_data_diri: { mahasiswa_id: completeId },
          jenis_dokumen: { kode_jenis: 'IJAZAH' },
          is_terkini: true,
        },
        select: { diperiksa_oleh_user_id: true, diperiksa_at: true },
      });
      const versions2 = { ...versions1, KTP: 2 };
      const verifiedAll = await http(base, tokens[0], `${adminPrefix}/${completeId}/verifikasi-semua`, {
        method: 'POST', body: { expectedVersions: versions2 },
      });
      assert.equal(verifiedAll.status, 200);
      assert.equal(verifiedAll.body.data.status_verifikasi, 'TERVERIFIKASI');
      assert.equal(verifiedAll.body.data.jumlah_diperbarui, 1);
      assert.deepEqual(await prisma.dokumenDataDiri.findFirst({
        where: {
          verifikasi_data_diri: { mahasiswa_id: completeId },
          jenis_dokumen: { kode_jenis: 'IJAZAH' },
          is_terkini: true,
        },
        select: { diperiksa_oleh_user_id: true, diperiksa_at: true },
      }), preserved);
      const auditBeforeRepeat = await prisma.auditLog.count({ where: { aktor_user_id: ids.users[0] } });
      const repeated = await http(base, tokens[0], `${adminPrefix}/${completeId}/verifikasi-semua`, {
        method: 'POST', body: { expectedVersions: versions2 },
      });
      assert.equal(repeated.status, 200);
      assert.equal(repeated.body.data.idempotent, true);
      assert.equal(await prisma.auditLog.count({ where: { aktor_user_id: ids.users[0] } }), auditBeforeRepeat);

      const reopen = await http(base, tokens[0], `${adminPrefix}/${completeId}/dokumen/KTP`, {
        method: 'PATCH',
        body: { status: 'PERLU_PERBAIKAN', catatan: 'Perlu scan ulang.', expectedVersion: 2 },
      });
      assert.equal(reopen.status, 200);
      assert.equal(reopen.body.data.status_verifikasi, 'PERLU_PERBAIKAN');
      const reopenedHeader = await prisma.verifikasiDataDiri.findUnique({
        where: { mahasiswa_id: completeId },
        select: { diverifikasi_at: true },
      });
      assert.equal(reopenedHeader.diverifikasi_at, null);
      assert.equal((await http(base, tokens[1], '/mahasiswa/me/data-diri/dokumen/KTP', {
        method: 'PUT', file,
      })).body.data.versi, 3);

      const adminIds = [ids.users[0], ids.users[3]];
      const auditBeforeParallel = await prisma.auditLog.count({ where: { aktor_user_id: { in: adminIds } } });
      const parallel = await Promise.all([tokens[0], tokens[3]].map((token) => http(
        base,
        token,
        `${adminPrefix}/${completeId}/dokumen/KTP`,
        { method: 'PATCH', body: { status: 'TERVERIFIKASI', expectedVersion: 3 } },
      )));
      assert.deepEqual(parallel.map((item) => item.status), [200, 200]);
      assert.equal(parallel.filter((item) => item.body.data.idempotent).length, 1);
      assert.equal(await prisma.auditLog.count({ where: { aktor_user_id: { in: adminIds } } }), auditBeforeParallel + 1);
      const finalHeader = await prisma.verifikasiDataDiri.findUnique({
        where: { mahasiswa_id: completeId },
        select: { status_verifikasi: true, diperiksa_oleh_user_id: true, diverifikasi_at: true },
      });
      assert.equal(finalHeader.status_verifikasi, 'TERVERIFIKASI');
      assert.ok(adminIds.includes(finalHeader.diperiksa_oleh_user_id));
      assert.ok(finalHeader.diverifikasi_at instanceof Date);

      const incompleteVersions = Object.fromEntries(REQUIRED_DOCUMENT_CODES.map((code) => [code, 1]));
      const incompleteBefore = await prisma.dokumenDataDiri.findMany({
        where: { verifikasi_data_diri: { mahasiswa_id: incompleteId } },
        select: { id: true, status_dokumen: true },
      });
      const incompleteBulk = await http(base, tokens[0], `${adminPrefix}/${incompleteId}/verifikasi-semua`, {
        method: 'POST', body: { expectedVersions: incompleteVersions },
      });
      assert.equal(incompleteBulk.status, 409);
      assert.equal(incompleteBulk.body.error.code, 'DOCUMENTS_INCOMPLETE');
      assert.deepEqual(await prisma.dokumenDataDiri.findMany({
        where: { verifikasi_data_diri: { mahasiswa_id: incompleteId } },
        select: { id: true, status_dokumen: true },
      }), incompleteBefore);

      const extraProdi = await prisma.programStudi.create({ data: {
        kode_prodi: 'VERIF_TEST_2', nama_prodi: 'Prodi Lain', jenjang: 'S1',
        nama_fakultas: 'Fakultas Test', nama_perguruan_tinggi: 'Universitas Test',
      } });
      ids.extraProdi = extraProdi.id;
      const scopeDenied = await http(base, tokens[0], adminPrefix);
      assert.equal(scopeDenied.status, 403);
      assert.equal(scopeDenied.body.error.code, 'PRODI_SCOPE_UNAVAILABLE');
      await prisma.programStudi.delete({ where: { id: extraProdi.id } });
      ids.extraProdi = null;
    } catch (error) {
      failure = error;
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      try {
        if (!safeToClean) throw new Error('Cleanup dilewati: database test tidak kosong sebelum tes.');
        await prisma.auditLog.deleteMany({ where: { aktor_user_id: { in: ids.users } } });
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
        if (ids.extraProdi) await prisma.programStudi.delete({ where: { id: ids.extraProdi } });
        if (ids.prodi) await prisma.programStudi.delete({ where: { id: ids.prodi } });
        const afterCounts = await Promise.all([
          prisma.user.count(), prisma.mahasiswa.count(), prisma.verifikasiDataDiri.count(),
          prisma.dokumen.count(), prisma.dokumenDataDiri.count(), prisma.role.count(),
          prisma.programStudi.count(), prisma.jenisDokumen.count(), prisma.authSession.count(),
          prisma.auditLog.count(),
        ]);
        assert.deepEqual(afterCounts, Array(afterCounts.length).fill(0));
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
