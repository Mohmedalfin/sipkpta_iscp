import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/security/jwt.js';
import {
  createDocumentType, createPeriod, createRequirement, createSchedule, getAvailability,
  getSchedule, scheduleStatus, setPeriodActive, updateRequirement,
} from '../src/services/konfigurasi-akademik.service.js';

const TEST_DATABASE = 'sipkita_test_kp_d1_spp_20261105070147_1066f27b';

async function api(base, path, token, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

test('Konfigurasi K1/K2 pada PostgreSQL TEST terisolasi',
  { skip: process.env.SIPKITA_CONFIG_REAL_DB !== '1' }, async () => {
    assert.ok(process.env.DATABASE_URL);
    const target = new URL(process.env.DATABASE_URL);
    target.pathname = `/${TEST_DATABASE}`;
    target.searchParams.delete('schema');
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString() }) });
    let periodId;
    let scheduleId;
    let regularScheduleId;
    let overlappingPeriodId;
    let futurePeriodId;
    let futureScheduleId;
    let createdProdiId;
    let createdStageId;
    let actorId;
    let requirementId;
    let createdTypeId;
    let customTypeId;
    let studentUserId;
    let studentId;
    let applicationId;
    const sessionIds = [];
    const createdRoleIds = [];
    let httpServer;
    const previousSecret = process.env.JWT_ACCESS_SECRET_BASE64;
    try {
      const [{ name }] = await prisma.$queryRaw`SELECT current_database() AS name`;
      assert.equal(name, TEST_DATABASE);
      const prodis = await prisma.programStudi.findMany({ select: { id: true }, take: 2 });
      assert.ok(prodis.length <= 1, 'Scope Prodi TEST harus tidak ambigu.');
      if (!prodis.length) {
        const prodi = await prisma.programStudi.create({ data: { kode_prodi: 'TEST_KONFIG',
          nama_prodi: 'Prodi Test Konfigurasi', jenjang: 'S1', nama_fakultas: 'Test',
          nama_perguruan_tinggi: 'Test' } });
        createdProdiId = prodi.id;
      }
      let stage = await prisma.tahapAkademik.findUnique({ where: { kode_tahap: 'KP' } });
      if (!stage) {
        stage = await prisma.tahapAkademik.create({ data: { kode_tahap: 'KP',
          nama_tahap: 'Kerja Praktik', urutan: 1 } });
        createdStageId = stage.id;
      }
      const tag = randomBytes(5).toString('hex');
      const actor = await prisma.user.create({ data: { login_id: `konfig-${tag}`,
        email: `konfig-${tag}@example.invalid`, password_hash: randomBytes(32).toString('hex') } });
      actorId = actor.id;
      const studentUser = await prisma.user.create({ data: { login_id: `konfig-student-${tag}`,
        email: `konfig-student-${tag}@example.invalid`, password_hash: randomBytes(32).toString('hex') } });
      studentUserId = studentUser.id;
      async function role(code) {
        let row = await prisma.role.findUnique({ where: { kode_peran: code } });
        if (!row) {
          row = await prisma.role.create({ data: { kode_peran: code, nama_peran: code } });
          createdRoleIds.push(row.id);
        }
        return row;
      }
      const adminRole = await role('ADMIN_PRODI');
      const studentRole = await role('MAHASISWA');
      await prisma.userRole.createMany({ data: [
        { user_id: actorId, role_id: adminRole.id },
        { user_id: studentUserId, role_id: studentRole.id },
      ] });
      process.env.JWT_ACCESS_SECRET_BASE64 = randomBytes(32).toString('base64url');
      async function token(userId, roleRow) {
        const sessionId = randomUUID();
        sessionIds.push(sessionId);
        await prisma.authSession.create({ data: { id: sessionId, user_id: userId,
          active_role_id: roleRow.id, expires_at: new Date(Date.now() + 3600000) } });
        return (await signAccessToken(userId, sessionId, roleRow.kode_peran, 0)).token;
      }
      const adminToken = await token(actorId, adminRole);
      const studentToken = await token(studentUserId, studentRole);
      httpServer = createApp({ prisma, mailService: {} }).listen(0, '127.0.0.1');
      await new Promise((resolve) => httpServer.once('listening', resolve));
      const base = `http://127.0.0.1:${httpServer.address().port}`;
      const period = await createPeriod(prisma, {
        tahun_ajaran: '2198/2199', semester: 'GANJIL',
        tanggal_mulai: '2198-11-01', tanggal_selesai: '2199-01-31',
      });
      periodId = period.id;
      assert.equal(period.status_periode, 'DRAFT');
      assert.equal((await api(base, '/api/admin-prodi/konfigurasi/periode-akademik', null)).status, 401);
      assert.equal((await api(base, '/api/admin-prodi/konfigurasi/periode-akademik', studentToken)).status, 403);
      const periodPage = await api(base,
        '/api/admin-prodi/konfigurasi/periode-akademik?page=1&limit=1&tahun_ajaran=2198%2F2199', adminToken);
      assert.equal(periodPage.status, 200);
      assert.equal(periodPage.body.data.pagination.limit, 1);
      assert.equal(periodPage.body.data.data[0].is_mendatang, true);
      assert.equal(periodPage.body.data.data[0].is_berjalan, false);
      assert.equal(typeof periodPage.body.data.data[0].jumlah.jadwal, 'number');
      assert.equal((await api(base, '/api/admin-prodi/konfigurasi/periode-akademik', adminToken,
        'POST', { tahun_ajaran: '2198/2199', semester: 'GANJIL', tanggal_mulai: 'invalid',
          tanggal_selesai: '2199-01-31' })).status, 400);
      assert.equal((await api(base, '/api/admin-prodi/konfigurasi/periode-akademik', studentToken,
        'POST', { tahun_ajaran: '2198/2199', semester: 'GANJIL', tanggal_mulai: '2198-11-01',
          tanggal_selesai: '2199-01-31' })).status, 403);
      assert.equal((await api(base, '/api/admin-prodi/konfigurasi/periode-akademik', adminToken,
        'POST', { tahun_ajaran: '2198/2199', semester: 'GANJIL', tanggal_mulai: '2198-11-01',
          tanggal_selesai: '2199-01-31' })).status, 409);
      await setPeriodActive(prisma, period.id, true);
      const overlapping = await createPeriod(prisma, {
        tahun_ajaran: '2199/2200', semester: 'GANJIL',
        tanggal_mulai: '2199-01-01', tanggal_selesai: '2199-03-01',
      });
      overlappingPeriodId = overlapping.id;
      await assert.rejects(() => setPeriodActive(prisma, overlapping.id, true),
        (error) => error.code === 'PERIOD_OVERLAP');
      await assert.rejects(() => createPeriod(prisma, {
        tahun_ajaran: '2198/2199', semester: 'GANJIL',
        tanggal_mulai: '2198-11-01', tanggal_selesai: '2199-01-31',
      }), (error) => error.code === 'DUPLICATE_CONFIGURATION');
      const schedule = await createSchedule(prisma, {
        periode_akademik_id: period.id, tahap_akademik_id: stage.id,
        jenis_proses: 'PENGAJUAN_PERPANJANGAN',
        tanggal_buka: '2198-11-01T00:00:00+07:00',
        tanggal_tutup: '2199-01-31T23:59:00+07:00',
        is_aktif: false, keterangan: null,
      }, actorId);
      scheduleId = schedule.id;
      const read = await getSchedule(prisma, schedule.id);
      assert.equal(read.tanggal_buka, '2198-11-01T00:00:00.000+07:00');
      assert.equal(read.tanggal_tutup, '2199-01-31T23:59:00.000+07:00');
      assert.equal(read.status_jadwal, 'NONAKTIF');
      const availability = await api(base,
        '/api/konfigurasi/akademik/ketersediaan?tahap=KP&jenis_proses=PENGAJUAN_PERPANJANGAN', adminToken);
      assert.equal(availability.status, 200);
      assert.equal(availability.body.data.status_jadwal, 'NONAKTIF');
      assert.equal(availability.body.data.is_open, false);
      assert.equal(availability.body.data.reason_code, 'JADWAL_NONAKTIF');
      assert.ok(availability.body.data.message);
      assert.equal(availability.body.data.periode.id, period.id);
      assert.match(availability.body.data.tanggal_buka, /\+07:00$/);
      assert.equal(availability.body.data.zona_waktu, 'Asia/Jakarta');
      const regular = await createSchedule(prisma, {
        periode_akademik_id: period.id, tahap_akademik_id: stage.id,
        jenis_proses: 'PENGAJUAN_REGULER',
        tanggal_buka: '2198-11-01T00:00:00+07:00',
        tanggal_tutup: '2199-01-31T23:59:00+07:00', is_aktif: true,
      }, actorId);
      regularScheduleId = regular.id;
      const regularRead = await getSchedule(prisma, regular.id);
      assert.equal(scheduleStatus({ ...regularRead, tanggal_buka: new Date(regularRead.tanggal_buka),
        tanggal_tutup: new Date(regularRead.tanggal_tutup) },
      new Date('2198-10-31T17:00:00Z')), 'DIBUKA');
      const schedulePage = await api(base,
        '/api/admin-prodi/konfigurasi/jadwal-proses?page=1&limit=1&jenis_proses=PENGAJUAN_REGULER', adminToken);
      assert.equal(schedulePage.status, 200);
      assert.equal(schedulePage.body.data.pagination.limit, 1);
      assert.match(schedulePage.body.data.data[0].tanggal_buka, /\+07:00$/);
      assert.equal((await api(base, '/api/admin-prodi/konfigurasi/jadwal-proses', adminToken,
        'POST', { periode_akademik_id: period.id, tahap_akademik_id: stage.id,
          jenis_proses: 'PENGAJUAN_REGULER', tanggal_buka: 'invalid',
          tanggal_tutup: '2199-01-31T23:59:00+07:00', is_aktif: true })).status, 400);
      assert.equal((await api(base, '/api/admin-prodi/konfigurasi/jadwal-proses', adminToken,
        'POST', { periode_akademik_id: period.id, tahap_akademik_id: stage.id,
          jenis_proses: 'PENGAJUAN_REGULER', tanggal_buka: '2198-11-01T00:00:00+07:00',
          tanggal_tutup: '2199-01-31T23:59:00+07:00', is_aktif: false })).status, 409);
      const future = await createPeriod(prisma, {
        tahun_ajaran: '2200/2201', semester: 'GANJIL',
        tanggal_mulai: '2200-11-01', tanggal_selesai: '2201-01-31',
      });
      futurePeriodId = future.id;
      await setPeriodActive(prisma, future.id, true);
      const prepared = await createSchedule(prisma, {
        periode_akademik_id: future.id, tahap_akademik_id: stage.id,
        jenis_proses: 'PENGAJUAN_REGULER',
        tanggal_buka: '2200-11-01T00:00:00+07:00',
        tanggal_tutup: '2201-01-31T23:59:00+07:00', is_aktif: false,
      }, actorId);
      futureScheduleId = prepared.id;
      assert.equal((await api(base,
        `/api/admin-prodi/konfigurasi/jadwal-proses/${prepared.id}/aktivasi`, adminToken, 'POST')).status, 409);
      await assert.rejects(() => createSchedule(prisma, {
        periode_akademik_id: future.id, tahap_akademik_id: stage.id,
        jenis_proses: 'PENGAJUAN_REGULER',
        tanggal_buka: '2200-11-01T00:00:00+07:00',
        tanggal_tutup: '2201-01-31T23:59:00+07:00', is_aktif: true,
      }, actorId), (error) => error.code === 'KP_REGULAR_AMBIGUOUS');
      const atOpen = new Date('2198-11-01T00:00:00Z');
      assert.equal((await getAvailability(prisma, 'KP', 'PENGAJUAN_REGULER', atOpen)).is_open, true);
      assert.equal((await getAvailability(prisma, 'KP', 'PENGAJUAN_PERPANJANGAN', atOpen)).status_jadwal, 'NONAKTIF');
      let proposalType = await prisma.jenisDokumen.findUnique({ where: { kode_jenis: 'PROPOSAL_KP' } });
      if (!proposalType) {
        proposalType = await createDocumentType(prisma, { kode_jenis: 'PROPOSAL_KP',
          nama_jenis: 'Proposal KP', format_diizinkan: ['pdf'], maks_ukuran_mb: 10 });
        createdTypeId = proposalType.id;
      }
      const requirementInput = { periode_akademik_id: period.id, tahap_akademik_id: stage.id,
        jenis_pengajuan: 'REGULER', pilihan_topik: 'BARU', jenis_dokumen_id: proposalType.id,
        is_wajib: true, boleh_gunakan_dokumen_sebelumnya: false, urutan_tampil: 1 };
      const requirement = await createRequirement(prisma, requirementInput);
      requirementId = requirement.id;
      await assert.rejects(() => createRequirement(prisma, requirementInput),
        (error) => error.code === 'DUPLICATE_CONFIGURATION');
      assert.equal((await updateRequirement(prisma, requirement.id, { petunjuk: 'Tes' })).petunjuk, 'Tes');
      assert.equal((await api(base, '/api/admin-prodi/konfigurasi/jenis-dokumen?is_aktif=true&page=1&limit=1',
        adminToken)).status, 200);
      const customType = await api(base, '/api/admin-prodi/konfigurasi/jenis-dokumen', adminToken,
        'POST', { kode_jenis: `TEST_KONFIG_${tag.toUpperCase()}`, nama_jenis: 'Dokumen Test',
          format_diizinkan: ['pdf'], maks_ukuran_mb: 5 });
      assert.equal(customType.status, 201);
      customTypeId = customType.body.data.id;
      assert.equal((await api(base, `/api/admin-prodi/konfigurasi/jenis-dokumen/${customTypeId}`,
        adminToken, 'PATCH', { maks_ukuran_mb: 7 })).status, 200);
      assert.equal((await api(base, `/api/admin-prodi/konfigurasi/jenis-dokumen/${proposalType.id}`,
        adminToken, 'PATCH', { maks_ukuran_mb: 5 })).status, 409);
      const filtered = await api(base,
        `/api/admin-prodi/konfigurasi/persyaratan-pengajuan?periode=${period.id}&jenis_dokumen=${proposalType.id}&page=1&limit=1`, adminToken);
      assert.equal(filtered.status, 200);
      assert.equal(filtered.body.data.pagination.total_items, 1);
      assert.equal((await api(base, '/api/admin-prodi/konfigurasi/persyaratan-pengajuan?page=0',
        adminToken)).status, 400);
      const unusedEdit = await api(base,
        `/api/admin-prodi/konfigurasi/persyaratan-pengajuan/${requirement.id}`,
        adminToken, 'PATCH', { urutan_tampil: 2 });
      assert.equal(unusedEdit.status, 200);
      assert.equal((await api(base,
        `/api/admin-prodi/konfigurasi/persyaratan-pengajuan/${requirement.id}`,
        adminToken, 'PATCH', { is_wajib: false })).status, 409);
      studentId = (await prisma.mahasiswa.create({ data: { user_id: studentUserId,
        program_studi_id: prodis[0]?.id ?? createdProdiId, nim: `9${Date.now()}`,
        nama_lengkap: 'Mahasiswa Test Konfigurasi', tanggal_lahir: new Date('2000-01-01T00:00:00Z') } })).id;
      applicationId = (await prisma.pengajuan.create({ data: { mahasiswa_id: studentId,
        periode_akademik_id: period.id, tahap_akademik_id: stage.id,
        jenis_pengajuan: 'REGULER', pilihan_topik: 'BARU' } })).id;
      const periodDetail = await api(base,
        `/api/admin-prodi/konfigurasi/periode-akademik/${period.id}`, adminToken);
      assert.equal(periodDetail.body.data.jumlah.pengajuan, 1);
      assert.equal(periodDetail.body.data.jumlah.jadwal, 2);
      const usedEdit = await api(base,
        `/api/admin-prodi/konfigurasi/persyaratan-pengajuan/${requirement.id}`,
        adminToken, 'PATCH', { urutan_tampil: 3 });
      assert.equal(usedEdit.status, 409);
      assert.equal((await api(base, `/api/admin-prodi/konfigurasi/periode-akademik/${period.id}`,
        adminToken, 'PATCH', { tanggal_selesai: '2199-02-01' })).status, 409);
      const dated = { ...read, is_aktif: true,
        tanggal_buka: new Date(read.tanggal_buka), tanggal_tutup: new Date(read.tanggal_tutup) };
      assert.equal(scheduleStatus(dated, new Date('2198-10-31T17:00:00Z')), 'DIBUKA');
      assert.equal(scheduleStatus(dated, new Date('2199-01-31T16:59:00Z')), 'DIBUKA');
      await assert.rejects(() => createSchedule(prisma, {
        periode_akademik_id: period.id, tahap_akademik_id: stage.id,
        jenis_proses: 'PENGAJUAN_PERPANJANGAN',
        tanggal_buka: '2198-11-01T00:00:00+07:00',
        tanggal_tutup: '2199-01-31T23:59:00+07:00', is_aktif: false,
      }, actorId), (error) => error.code === 'DUPLICATE_CONFIGURATION');
    } finally {
      if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
      if (applicationId) await prisma.pengajuan.delete({ where: { id: applicationId } });
      if (studentId) await prisma.mahasiswa.delete({ where: { id: studentId } });
      if (requirementId) await prisma.persyaratanPengajuan.delete({ where: { id: requirementId } });
      if (customTypeId) await prisma.jenisDokumen.delete({ where: { id: customTypeId } });
      if (createdTypeId) await prisma.jenisDokumen.delete({ where: { id: createdTypeId } });
      if (regularScheduleId) await prisma.jadwalProses.delete({ where: { id: regularScheduleId } });
      if (futureScheduleId) await prisma.jadwalProses.delete({ where: { id: futureScheduleId } });
      if (scheduleId) await prisma.jadwalProses.delete({ where: { id: scheduleId } });
      if (overlappingPeriodId) await prisma.periodeAkademik.delete({ where: { id: overlappingPeriodId } });
      if (futurePeriodId) await prisma.periodeAkademik.delete({ where: { id: futurePeriodId } });
      if (periodId) await prisma.periodeAkademik.delete({ where: { id: periodId } });
      if (sessionIds.length) await prisma.authSession.deleteMany({ where: { id: { in: sessionIds } } });
      if (studentUserId || actorId) await prisma.userRole.deleteMany({ where: {
        user_id: { in: [studentUserId, actorId].filter(Boolean) } } });
      if (studentUserId) await prisma.user.delete({ where: { id: studentUserId } });
      if (actorId) await prisma.user.delete({ where: { id: actorId } });
      if (createdRoleIds.length) await prisma.role.deleteMany({ where: { id: { in: createdRoleIds } } });
      if (createdStageId) await prisma.tahapAkademik.delete({ where: { id: createdStageId } });
      if (createdProdiId) await prisma.programStudi.delete({ where: { id: createdProdiId } });
      await prisma.$disconnect();
      if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET_BASE64;
      else process.env.JWT_ACCESS_SECRET_BASE64 = previousSecret;
    }
  });
