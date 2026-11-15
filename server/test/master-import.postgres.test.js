import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/security/jwt.js';
import { hashPassword, verifyPassword } from '../src/security/password.js';
import { confirmImport } from '../src/services/master-import.service.js';

const shouldRun = process.env.SIPKITA_IMPORT_REAL_DB === '1';

async function counts(prisma) {
  const [users, mahasiswa, dosen, userRoles, sessions, refreshTokens, audits] = await Promise.all([
    prisma.user.count(), prisma.mahasiswa.count(), prisma.dosen.count(),
    prisma.userRole.count(), prisma.authSession.count(), prisma.refreshToken.count(),
    prisma.auditLog.count(),
  ]);
  return { users, mahasiswa, dosen, userRoles, sessions, refreshTokens, audits };
}

function csv(headers, rows) {
  const quote = (value) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(quote).join(',')).join('\r\n');
}

async function request(base, path, { method = 'GET', token, body, file } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload;
  if (file !== undefined) {
    payload = new FormData();
    payload.set('file', new Blob([file], { type: 'text/csv' }), 'master.csv');
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${base}${path}`, { method, headers, body: payload });
  return { status: response.status, body: await response.json() };
}

test('Import CSV Master: preview, commit, laporan dan otorisasi PostgreSQL terisolasi',
  { skip: !shouldRun }, async () => {
    const sourceUrl = new URL(process.env.DATABASE_URL);
    assert.equal(sourceUrl.pathname, '/sipkita_dev');
    sourceUrl.pathname = '/sipkita_master_import_test';
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: sourceUrl.toString() }) });
    let server;
    let failure;
    let safeToClean = false;
    try {
      assert.deepEqual(await counts(prisma), {
        users: 0, mahasiswa: 0, dosen: 0, userRoles: 0,
        sessions: 0, refreshTokens: 0, audits: 0,
      });
      assert.equal(await prisma.programStudi.count(), 0);
      assert.equal(await prisma.role.count(), 0);
      safeToClean = true;
      const prodi = await prisma.programStudi.create({
        data: {
          kode_prodi: 'IMPORT_TEST', nama_prodi: 'Prodi Import Test', jenjang: 'S1',
          nama_fakultas: 'Fakultas Test', nama_perguruan_tinggi: 'Universitas Test',
        },
      });
      const adminRole = await prisma.role.create({
        data: { kode_peran: 'ADMIN_PRODI', nama_peran: 'Admin Prodi Test' },
      });
      const studentRole = await prisma.role.create({
        data: { kode_peran: 'MAHASISWA', nama_peran: 'Mahasiswa Test' },
      });
      const reviewerRole = await prisma.role.create({
        data: { kode_peran: 'REVIEWER', nama_peran: 'Reviewer Test' },
      });
      const admin = await prisma.user.create({
        data: {
          login_id: 'import.admin', email: 'import-admin@example.test',
          password_hash: await hashPassword(randomBytes(24).toString('base64url')),
        },
      });
      await prisma.userRole.create({ data: { user_id: admin.id, role_id: adminRole.id } });
      await prisma.userRole.create({ data: { user_id: admin.id, role_id: reviewerRole.id } });
      const otherAdmin = await prisma.user.create({
        data: { login_id: 'import.other', email: 'import-other@example.test',
          password_hash: await hashPassword(randomBytes(24).toString('base64url')) },
      });
      await prisma.userRole.create({ data: { user_id: otherAdmin.id, role_id: adminRole.id } });
      const adminSessionId = randomUUID();
      const reviewerSessionId = randomUUID();
      const otherSessionId = randomUUID();
      for (const [id, roleId] of [[adminSessionId, adminRole.id], [reviewerSessionId, reviewerRole.id]]) {
        await prisma.authSession.create({
          data: { id, user_id: admin.id, active_role_id: roleId,
            expires_at: new Date(Date.now() + 3600000) },
        });
      }
      await prisma.authSession.create({
        data: { id: otherSessionId, user_id: otherAdmin.id, active_role_id: adminRole.id,
          expires_at: new Date(Date.now() + 3600000) },
      });
      const existing = await prisma.user.create({
        data: {
          login_id: '00000999', email: 'existing@example.test',
          password_hash: await hashPassword('01012002'), status_akun: 'NONAKTIF',
        },
      });
      process.env.JWT_ACCESS_SECRET_BASE64 ||= randomBytes(32).toString('base64url');
      const adminToken = (await signAccessToken(admin.id, adminSessionId, 'ADMIN_PRODI', 0)).token;
      const reviewerToken = (await signAccessToken(admin.id, reviewerSessionId, 'REVIEWER', 0)).token;
      const otherToken = (await signAccessToken(otherAdmin.id, otherSessionId, 'ADMIN_PRODI', 0)).token;
      const appPrisma = prisma.$extends({
        query: {
          mahasiswa: {
            async create({ args, query }) {
              if (args.data.nim === '00002001') throw new Error('Simulasi gagal insert profil');
              return query(args);
            },
          },
        },
      });
      server = createApp({ prisma: appPrisma }).listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;

      const headers = ['nim', 'nama', 'tanggal_lahir', 'email', 'angkatan'];
      const rows = Array.from({ length: 200 }, (_unused, index) => [
        String(index + 1).padStart(8, '0'), index === 0 ? 'Nama, Pertama' : `Nama ${index + 1}`,
        '2002-01-01', `student-${index + 1}@example.test`, '2020',
      ]);
      rows[4][0] = rows[0][0];
      rows[5][3] = rows[0][3];
      rows[6][0] = existing.login_id;
      rows[7][2] = '';
      rows[7][3] = 'invalid-email';
      rows[8][2] = '2002-02-30';
      const beforePreview = await counts(prisma);
      assert.equal((await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', file: csv(headers, rows),
      })).status, 401);
      assert.equal((await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: reviewerToken, file: csv(headers, rows),
      })).status, 403);
      const preview = await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: adminToken, file: `\uFEFF${csv(headers, rows)}`,
      });
      assert.equal(preview.status, 200);
      assert.equal(preview.body.data.total, 200);
      assert.equal(preview.body.data.valid, 195);
      assert.equal(preview.body.data.invalid, 5);
      assert.equal(preview.body.data.errors.filter((error) => error.row === 9).length, 2);
      assert.deepEqual(await counts(prisma), beforePreview);
      const excelPreview = await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: adminToken,
        file: 'sep=;\r\nnim;nama;tanggal_lahir;email;angkatan\r\n00003001;"Nama; Excel";2002-01-01;excel@example.test;2020\r\n',
      });
      assert.equal(excelPreview.status, 200);
      assert.equal(excelPreview.body.data.total, 1);
      assert.equal(excelPreview.body.data.valid, 1);
      assert.deepEqual(await counts(prisma), beforePreview);
      const id = preview.body.data.previewId;
      assert.equal((await request(base, '/api/master/mahasiswa/import', {
        method: 'POST', token: otherToken, body: { previewId: id, confirmValidOnly: true },
      })).status, 404);
      assert.equal((await fetch(`${base}/api/master/mahasiswa/import/${id}/errors.xlsx`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      })).status, 404);
      assert.equal((await request(base, '/api/master/mahasiswa/import', {
        method: 'POST', token: adminToken, body: { previewId: id, confirmValidOnly: false },
      })).status, 400);
      assert.deepEqual(await counts(prisma), beforePreview);

      const previewReport = await fetch(`${base}/api/master/mahasiswa/import/${id}/errors.xlsx`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(previewReport.status, 200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await previewReport.arrayBuffer());
      const sheet = workbook.getWorksheet('Data Bermasalah');
      assert.equal(sheet.rowCount, 6);
      assert.equal(sheet.getRow(2).getCell(1).value, '00000001');
      assert.equal(sheet.getRow(2).getCell(6).value, 6);
      assert.equal(sheet.getRow(2).getCell(7).value, 'GAGAL');

      const confirmed = await request(base, '/api/master/mahasiswa/import', {
        method: 'POST', token: adminToken, body: { previewId: id, confirmValidOnly: true },
      });
      assert.equal(confirmed.status, 200);
      assert.equal(confirmed.body.data.imported, 195);
      assert.equal(confirmed.body.data.failed, 5);
      assert.equal(await prisma.mahasiswa.count(), 195);
      assert.equal(await prisma.userRole.count({ where: { role_id: studentRole.id } }), 195);
      assert.equal(JSON.stringify(confirmed.body).includes('password_hash'), false);
      const first = await prisma.user.findUnique({ where: { login_id: '00000001' } });
      const second = await prisma.user.findUnique({ where: { login_id: '00000002' } });
      assert.equal(await verifyPassword('01012002', first.password_hash), true);
      assert.notEqual(first.password_hash, second.password_hash);
      const login = await request(base, '/api/auth/login', {
        method: 'POST', body: { login_id: '00000001', password: '01012002' },
      });
      assert.equal(login.status, 200);
      const beforeRepeat = await counts(prisma);
      const repeated = await request(base, '/api/master/mahasiswa/import', {
        method: 'POST', token: adminToken, body: { previewId: id, confirmValidOnly: true },
      });
      assert.deepEqual(repeated.body.data, confirmed.body.data);
      assert.deepEqual(await counts(prisma), beforeRepeat);

      const brokenHeader = await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: adminToken, file: 'nim,nama\n1,A',
      });
      assert.equal(brokenHeader.status, 400);
      const multiline = await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: adminToken,
        file: csv(headers, [['00003001', 'Nama\nDua Baris', '2002-02-30', 'multi@example.test', '2020']]),
      });
      assert.equal(multiline.status, 200);
      assert.equal(multiline.body.data.errors[0].row, 2);
      assert.equal((await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: adminToken,
        file: csv(headers, Array.from({ length: 1001 }, (_unused, index) => [
          String(index + 10000).padStart(8, '0'), 'Banyak', '2002-01-01',
          `many-${index}@example.test`, '2020',
        ])),
      })).status, 400);
      assert.equal((await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: adminToken, file: csv(headers, []),
      })).status, 400);
      assert.equal((await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: adminToken, file: 'x'.repeat(5 * 1024 * 1024 + 1),
      })).status, 400);
      assert.deepEqual(await counts(prisma), beforeRepeat);

      const changed = await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: adminToken,
        file: csv(headers, [['00001001', 'Baru', '2002-01-01', 'new@example.test', '2020']]),
      });
      assert.equal(changed.status, 200);
      await prisma.user.create({
        data: { login_id: '00001001', email: 'concurrent@example.test',
          password_hash: await hashPassword('01012002') },
      });
      const changedCommit = await request(base, '/api/master/mahasiswa/import', {
        method: 'POST', token: adminToken,
        body: { previewId: changed.body.data.previewId, confirmValidOnly: true },
      });
      assert.equal(changedCommit.status, 200);
      assert.equal(changedCommit.body.data.imported, 0);
      assert.equal(changedCommit.body.data.failed, 1);
      const expiring = await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: adminToken,
        file: csv(headers, [['00001002', 'Expired', '2002-01-01', 'expired@example.test', '2020']]),
      });
      assert.equal(expiring.status, 200);
      const realNow = Date.now;
      try {
        Date.now = () => realNow() + 31 * 60 * 1000;
        await assert.rejects(
          confirmImport(prisma, 'mahasiswa', admin.id, expiring.body.data.previewId, null),
          (error) => error.code === 'IMPORT_NOT_FOUND',
        );
      } finally {
        Date.now = realNow;
      }

      const rollbackHeaders = [...headers, 'nik_kependudukan'];
      const rollbackPreview = await request(base, '/api/master/mahasiswa/import/preview', {
        method: 'POST', token: adminToken,
        file: csv(rollbackHeaders, [
          ['00002001', 'Rollback', '2002-01-01', 'rollback@example.test', '2020', '1234567890123456'],
          ['00002002', 'Berhasil', '2002-01-01', 'success@example.test', '2020', ''],
        ]),
      });
      assert.equal(rollbackPreview.status, 200);
      assert.equal(rollbackPreview.body.data.valid, 2);
      const rollbackCommit = await request(base, '/api/master/mahasiswa/import', {
        method: 'POST', token: adminToken,
        body: { previewId: rollbackPreview.body.data.previewId, confirmValidOnly: true },
      });
      assert.equal(rollbackCommit.status, 200);
      assert.equal(rollbackCommit.body.data.imported, 1);
      assert.equal(rollbackCommit.body.data.failed, 1);
      assert.equal(await prisma.user.count({ where: { login_id: '00002001' } }), 0);
      assert.equal(await prisma.user.count({ where: { login_id: '00002002' } }), 1);
      const finalReportResponse = await fetch(
        `${base}/api/master/mahasiswa/import/${rollbackPreview.body.data.previewId}/errors.xlsx`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      assert.equal(finalReportResponse.status, 200);
      const finalWorkbook = new ExcelJS.Workbook();
      await finalWorkbook.xlsx.load(await finalReportResponse.arrayBuffer());
      const finalSheet = finalWorkbook.getWorksheet('Data Bermasalah');
      assert.equal(finalSheet.rowCount, 2);
      assert.equal(finalSheet.getRow(2).getCell(1).value, '00002001');

      const dosenHeaders = ['kode_dosen', 'nidn', 'nama', 'tanggal_lahir', 'email'];
      const dosenPreview = await request(base, '/api/master/dosen/import/preview', {
        method: 'POST', token: adminToken,
        file: csv(dosenHeaders, [
          ['D001', '000123', 'Dosen Satu', '1980-04-05', 'dosen1@example.test'],
          ['D002', '000124', '=HYPERLINK("bad")', '1980-04-05', 'invalid-email'],
          ['D003', '000123', 'Duplikat NIDN', '1980-04-05', 'dosen3@example.test'],
        ]),
      });
      assert.equal(dosenPreview.status, 200);
      assert.equal(dosenPreview.body.data.valid, 1);
      assert.equal(dosenPreview.body.data.invalid, 2);
      const dosenReportResponse = await fetch(
        `${base}/api/master/dosen/import/${dosenPreview.body.data.previewId}/errors.xlsx`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      const dosenWorkbook = new ExcelJS.Workbook();
      await dosenWorkbook.xlsx.load(await dosenReportResponse.arrayBuffer());
      const formulaCell = dosenWorkbook.getWorksheet('Data Bermasalah').getRow(2).getCell(3);
      assert.equal(formulaCell.value, '=HYPERLINK("bad")');
      assert.equal(formulaCell.type, ExcelJS.ValueType.String);
      const dosenCommit = await request(base, '/api/master/dosen/import', {
        method: 'POST', token: adminToken,
        body: { previewId: dosenPreview.body.data.previewId, confirmValidOnly: true },
      });
      assert.equal(dosenCommit.status, 200);
      assert.equal(dosenCommit.body.data.imported, 1);
      assert.equal(dosenCommit.body.data.failed, 2);
      assert.equal(await prisma.dosen.count({ where: { kode_dosen: 'D001', nidn: '000123' } }), 1);
      const dosenUser = await prisma.user.findUnique({ where: { login_id: 'D001' } });
      assert.equal(await verifyPassword('05041980', dosenUser.password_hash), true);
      assert.equal(await prisma.userRole.count({ where: { user_id: dosenUser.id } }), 0);
      assert.equal((await request(base, '/api/master/dosen/import', {
        method: 'POST', token: reviewerToken,
        body: { previewId: dosenPreview.body.data.previewId, confirmValidOnly: true },
      })).status, 403);
      await prisma.programStudi.create({
        data: { kode_prodi: 'IMPORT_OTHER', nama_prodi: 'Prodi Lain', jenjang: 'S1',
          nama_fakultas: 'Fakultas Test', nama_perguruan_tinggi: 'Universitas Test' },
      });
      assert.equal((await request(base, '/api/master/dosen/import/preview', {
        method: 'POST', token: adminToken,
        file: csv(dosenHeaders, [['D004', '000125', 'Dosen Baru', '1980-04-05', 'dosen4@example.test']]),
      })).status, 403);
      assert.equal((await request(base, '/api/master/mahasiswa/import', {
        method: 'POST', token: adminToken, body: { previewId: id, confirmValidOnly: true },
      })).status, 403);
    } catch (error) {
      failure = error;
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      try {
        if (!safeToClean) throw new Error('Cleanup dilewati: database test tidak kosong sebelum tes.');
        const userIds = (await prisma.user.findMany({ select: { id: true } })).map((user) => user.id);
        const sessionIds = (await prisma.authSession.findMany({ select: { id: true } })).map((session) => session.id);
        if (sessionIds.length) await prisma.refreshToken.deleteMany({ where: { session_id: { in: sessionIds } } });
        if (userIds.length) await prisma.auditLog.deleteMany({ where: { aktor_user_id: { in: userIds } } });
        if (sessionIds.length) await prisma.authSession.deleteMany({ where: { id: { in: sessionIds } } });
        if (userIds.length) {
          await prisma.mahasiswa.deleteMany({ where: { user_id: { in: userIds } } });
          await prisma.dosen.deleteMany({ where: { user_id: { in: userIds } } });
          await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
          await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
        await prisma.role.deleteMany({ where: { kode_peran: { in: ['ADMIN_PRODI', 'MAHASISWA', 'REVIEWER'] } } });
        await prisma.programStudi.deleteMany({ where: { kode_prodi: { in: ['IMPORT_TEST', 'IMPORT_OTHER'] } } });
        assert.deepEqual(await counts(prisma), {
          users: 0, mahasiswa: 0, dosen: 0, userRoles: 0,
          sessions: 0, refreshTokens: 0, audits: 0,
        });
      } catch (cleanupError) {
        failure ??= cleanupError;
      }
      await prisma.$disconnect();
    }
    if (failure) throw failure;
  });
