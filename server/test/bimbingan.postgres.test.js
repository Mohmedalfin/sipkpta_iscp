import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/security/jwt.js';
import { replacePembimbingKp } from '../src/services/finalisasi-kp.service.js';

const TEST_DATABASE = 'sipkita_test_kp_d1_spp_20261105070147_1066f27b';

function pdf() {
  let content = '%PDF-1.4\n';
  const offsets = [0];
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream'];
  for (const [index, value] of objects.entries()) {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${value}\nendobj\n`;
  }
  const xref = Buffer.byteLength(content);
  content += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map((offset) =>
    `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
}

test('Fase I HTTP dan transaksi pada PostgreSQL TEST',
  { skip: process.env.SIPKITA_BIMBINGAN_REAL_DB !== '1' }, async (t) => {
    assert.ok(process.env.DATABASE_URL);
    const target = new URL(process.env.DATABASE_URL);
    target.pathname = `/${TEST_DATABASE}`;
    target.searchParams.delete('schema');
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString() }) });
    const storageRoot = await mkdtemp(join(tmpdir(), 'sipkita-bimbingan-'));
    const oldStorageRoot = process.env.SIPKITA_PRIVATE_STORAGE_DIR;
    const oldJwt = process.env.JWT_ACCESS_SECRET_BASE64;
    process.env.SIPKITA_PRIVATE_STORAGE_DIR = storageRoot;
    process.env.JWT_ACCESS_SECRET_BASE64 = randomBytes(32).toString('base64url');
    const tag = randomBytes(4).toString('hex');
    const ids = { users: [], sessions: [], students: [], lecturers: [], applications: [],
      stage: null, period: null, secondPeriod: null, assignments: [] };
    let server;
    try {
      const [identity] = await db.$queryRaw`SELECT current_database() AS name`;
      assert.equal(identity.name, TEST_DATABASE);
      const migrations = await db.$queryRaw`SELECT migration_name FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
      assert.equal(migrations.length, 6);
      assert.equal(migrations.at(-1).migration_name, '20261106000000_kurikulum_master');
      const role = Object.fromEntries((await db.role.findMany({ where: { kode_peran: {
        in: ['MAHASISWA', 'PEMBIMBING', 'REVIEWER', 'KAPRODI'] } } })).map((item) => [item.kode_peran, item]));
      assert.equal(Object.keys(role).length, 4);
      const prodi = await db.programStudi.findFirst();
      assert.ok(prodi);

      async function user(label, roleCode, profile) {
        const account = await db.user.create({ data: { login_id: `i.${label}.${tag}`,
          email: `i-${label}-${tag}@example.test`, password_hash: 'fixture-only' } });
        ids.users.push(account.id);
        await db.userRole.create({ data: { user_id: account.id, role_id: role[roleCode].id } });
        if (profile === 'student') {
          const row = await db.mahasiswa.create({ data: { user_id: account.id,
            program_studi_id: prodi.id, nim: `I${label}${tag}`,
            nama_lengkap: `Mahasiswa ${label}`, tanggal_lahir: new Date('2002-01-01T00:00:00Z') } });
          ids.students.push(row.id);
          account.profileId = row.id;
        } else if (profile === 'lecturer') {
          const row = await db.dosen.create({ data: { user_id: account.id,
            program_studi_id: prodi.id, kode_dosen: `I${label}${tag}`,
            nama_lengkap: `Dosen ${label}`, tanggal_lahir: new Date('1980-01-01T00:00:00Z') } });
          ids.lecturers.push(row.id);
          account.profileId = row.id;
        }
        const sessionId = randomUUID();
        ids.sessions.push(sessionId);
        await db.authSession.create({ data: { id: sessionId, user_id: account.id,
          active_role_id: role[roleCode].id, expires_at: new Date(Date.now() + 3600000) } });
        account.token = (await signAccessToken(account.id, sessionId, roleCode, 0)).token;
        return account;
      }

      ids.stage = (await db.tahapAkademik.create({ data: { kode_tahap: `I${tag}`.slice(0, 10),
        nama_tahap: `Fixture I ${tag}`, urutan: 30000 } })).id;
      // Fase I hanya menerima kode KP; gunakan baseline bila ada, jika tidak buat fixture KP.
      const existingKp = await db.tahapAkademik.findUnique({ where: { kode_tahap: 'KP' } });
      if (!existingKp) {
        await db.tahapAkademik.delete({ where: { id: ids.stage } });
        ids.stage = (await db.tahapAkademik.create({ data: { kode_tahap: 'KP',
          nama_tahap: 'Kerja Praktik', urutan: 1 } })).id;
      } else {
        await db.tahapAkademik.delete({ where: { id: ids.stage } });
        ids.stage = null;
      }
      const stageId = existingKp?.id || ids.stage;
      ids.period = (await db.periodeAkademik.create({ data: { tahun_ajaran: `I${tag.slice(0, 3)}/2027`,
        semester: 'GANJIL', tanggal_mulai: new Date('2026-08-01T00:00:00Z'),
        tanggal_selesai: new Date('2027-01-31T00:00:00Z') } })).id;
      const student = await user('a', 'MAHASISWA', 'student');
      const outsider = await user('b', 'MAHASISWA', 'student');
      const mentor = await user('mentor', 'PEMBIMBING', 'lecturer');
      const otherMentor = await user('other', 'PEMBIMBING', 'lecturer');
      const reviewer = await user('review', 'REVIEWER', 'lecturer');
      const kaprodi = await user('kaprodi', 'KAPRODI');
      const application = await db.pengajuan.create({ data: { mahasiswa_id: student.profileId,
        periode_akademik_id: ids.period, tahap_akademik_id: stageId,
        jenis_pengajuan: 'REGULER', pilihan_topik: 'BARU', status_pengajuan: 'ACC' } });
      ids.applications.push(application.id);
      const assignment = await db.penugasanDosen.create({ data: { pengajuan_id: application.id,
        dosen_id: mentor.profileId, jenis_penugasan: 'PEMBIMBING', sumber_penugasan: 'KAPRODI' } });
      ids.assignments.push(assignment.id);
      server = createApp({ prisma: db }).listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      async function req(path, token, method = 'GET', body, files) {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        let payload;
        if (files) {
          payload = new FormData();
          if (body) for (const [key, value] of Object.entries(body)) payload.set(key, value);
          for (const file of files) payload.append('files', new Blob([file], { type: 'application/pdf' }), 'materi.pdf');
        } else if (body !== undefined) {
          headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body);
        }
        const response = await fetch(`${base}${path}`, { method, headers, body: payload });
        return { status: response.status,
          body: response.headers.get('content-type')?.includes('application/json')
            ? await response.json() : Buffer.from(await response.arrayBuffer()) };
      }
      const own = (suffix = '') => `/api/pengajuan/${application.id}/bimbingan${suffix}`;
      const supervisor = (suffix = '') => `/api/pembimbing/bimbingan${suffix}`;

      await t.test('auth, draft, offline dan online', async () => {
        assert.equal((await req(own(), null)).status, 401);
        assert.equal((await req(own(), reviewer.token)).status, 403);
        assert.equal((await req(own(), outsider.token)).status, 404);
        const created = await req(own(), student.token, 'POST', { jenis_bimbingan: 'OFFLINE',
          tanggal_bimbingan: '2026-11-10', ringkasan: 'Diskusi ERD' });
        assert.equal(created.status, 201);
        ids.first = created.body.data.id;
        assert.equal((await req(own(`/${ids.first}/kirim`), student.token, 'POST', {})).status, 200);
        const row = await db.bimbingan.findUnique({ where: { id: ids.first } });
        assert.equal(row.status_bimbingan, 'MENUNGGU_VALIDASI');
        assert.equal(await db.riwayatBimbingan.count({ where: { bimbingan_id: ids.first } }), 1);
        await assert.rejects(replacePembimbingKp(db, kaprodi.id, application.id,
          otherMentor.profileId, 'Uji guard'), { code: 'SUPERVISION_STARTED' });
        assert.equal((await req(own(`/${ids.first}`), student.token, 'PATCH', { ringkasan: 'Ganti' })).status, 409);
        const online = await req(own(), student.token, 'POST', { jenis_bimbingan: 'ONLINE', ringkasan: 'Materi awal' });
        assert.equal(online.status, 201); ids.second = online.body.data.id;
        assert.equal((await req(own(`/${ids.second}/kirim`), student.token, 'POST', {})).status, 200);
        assert.equal((await db.bimbingan.findUnique({ where: { id: ids.second } })).tanggal_bimbingan, null);
      });

      await t.test('otorisasi dan revisi dua putaran dengan lampiran versi', async () => {
        assert.equal((await req(supervisor(`/${ids.first}/keputusan`), reviewer.token,
          'POST', { hasil: 'TERVALIDASI', expected_versi_pengiriman: 1 })).status, 403);
        assert.equal((await req(supervisor(`/${ids.first}/keputusan`), otherMentor.token,
          'POST', { hasil: 'TERVALIDASI', expected_versi_pengiriman: 1 })).status, 404);
        assert.equal((await req(supervisor(`/${ids.first}/keputusan`), mentor.token,
          'POST', { hasil: 'PERLU_PERBAIKAN', expected_versi_pengiriman: 1 })).status, 400);
        assert.equal((await req(supervisor(`/${ids.first}/keputusan`), mentor.token,
          'POST', { hasil: 'PERLU_PERBAIKAN', expected_versi_pengiriman: 1,
            catatan: 'Perbaiki ringkasan' })).status, 200);
        const validPdf = pdf();
        assert.equal((await req(own(`/${ids.first}/revisi`), student.token, 'POST',
          { ringkasan: 'Diskusi ERD revisi 1' }, [validPdf])).status, 200);
        assert.equal((await req(supervisor(`/${ids.first}/keputusan`), mentor.token,
          'POST', { hasil: 'TERVALIDASI', expected_versi_pengiriman: 1 })).status, 409);
        assert.equal((await req(supervisor(`/${ids.first}/keputusan`), mentor.token,
          'POST', { hasil: 'PERLU_PERBAIKAN', expected_versi_pengiriman: 2,
            catatan: 'Perbaiki lagi' })).status, 200);
        assert.equal((await req(own(`/${ids.first}/revisi`), student.token, 'POST',
          { ringkasan: 'Diskusi ERD revisi 2' }, [validPdf])).status, 200);
        const history = await req(own(`/${ids.first}/riwayat`), student.token);
        assert.equal(history.status, 200);
        assert.deepEqual(history.body.data.map((event) => event.versi_pengiriman), [1, 1, 2, 2, 3]);
        const firstFile = history.body.data[2].lampiran_bimbingan[0].id;
        const lastFile = history.body.data[4].lampiran_bimbingan[0].id;
        assert.notEqual(firstFile, lastFile);
        assert.equal((await req(own(`/${ids.first}/lampiran/${firstFile}/file`), outsider.token)).status, 404);
        assert.equal((await req(own(`/${ids.first}`), outsider.token)).status, 404);
        assert.equal((await req(own(`/${ids.first}/riwayat`), outsider.token)).status, 404);
        assert.deepEqual((await req(own(`/${ids.first}/lampiran/${firstFile}/file`), student.token)).body, validPdf);
        assert.equal((await req(supervisor(`/${ids.first}/keputusan`), mentor.token,
          'POST', { hasil: 'TERVALIDASI', expected_versi_pengiriman: 3 })).status, 200);
        assert.equal((await req(supervisor(`/${ids.first}/keputusan`), mentor.token,
          'POST', { hasil: 'TERVALIDASI', expected_versi_pengiriman: 3, catatan: 'Berbeda' })).status, 409);
        assert.equal((await req(own(`/${ids.first}/revisi`), student.token, 'POST', {})).status, 409);
      });

      await t.test('PDF palsu, penolakan, progres, dan bulk atomik/idempotent', async () => {
        const bad = await req(own(), student.token, 'POST', { jenis_bimbingan: 'ONLINE', ringkasan: 'Tiga' });
        ids.third = bad.body.data.id;
        assert.equal((await req(own(`/${ids.third}/kirim`), student.token, 'POST', {}, [Buffer.from('fake')])).status, 400);
        assert.equal(await db.riwayatBimbingan.count({ where: { bimbingan_id: ids.third } }), 0);
        assert.equal((await req(own(`/${ids.third}/kirim`), student.token, 'POST', {})).status, 200);
        assert.equal((await req(supervisor(`/${ids.third}/keputusan`), mentor.token, 'POST',
          { hasil: 'DITOLAK', expected_versi_pengiriman: 1, catatan: 'Tidak sah' })).status, 200);
        assert.equal((await req(own(`/${ids.third}/revisi`), student.token, 'POST', {})).status, 409);
        const a = await req(own(), student.token, 'POST', { jenis_bimbingan: 'ONLINE', ringkasan: 'A' });
        const b = await req(own(), student.token, 'POST', { jenis_bimbingan: 'ONLINE', ringkasan: 'B' });
        ids.fourth = a.body.data.id; ids.fifth = b.body.data.id;
        for (const itemId of [ids.fourth, ids.fifth]) {
          assert.equal((await req(own(`/${itemId}/kirim`), student.token, 'POST', {})).status, 200);
        }
        const invalidBulk = { konfirmasi_sudah_diperiksa: true, items: [
          { bimbingan_id: ids.fourth, expected_versi_pengiriman: 1 },
          { bimbingan_id: ids.third, expected_versi_pengiriman: 1 }] };
        assert.equal((await req(supervisor('/bulk-validasi'), mentor.token, 'POST', invalidBulk)).status, 409);
        assert.equal((await db.bimbingan.findUnique({ where: { id: ids.fourth } })).status_bimbingan, 'MENUNGGU_VALIDASI');
        const bulk = { konfirmasi_sudah_diperiksa: true, items: [
          { bimbingan_id: ids.fourth, expected_versi_pengiriman: 1 },
          { bimbingan_id: ids.fifth, expected_versi_pengiriman: 1 }] };
        assert.equal((await req(supervisor('/bulk-validasi'), mentor.token, 'POST', bulk)).body.data.total_diperbarui, 2);
        assert.equal((await req(supervisor('/bulk-validasi'), mentor.token, 'POST', bulk)).body.data.total_idempotent, 2);
        assert.equal((await req(supervisor(`/${ids.fourth}/keputusan`), mentor.token, 'POST',
          { hasil: 'TERVALIDASI', expected_versi_pengiriman: 1 })).body.data.idempotent, true);
        const result = await req(own('/progres'), student.token);
        assert.equal(result.body.data.jumlah.tervalidasi, 3);
        assert.equal(result.body.data.jumlah.ditolak, 1);
        assert.equal(result.body.data.minimal_bimbingan, null);
        assert.equal(await db.riwayatBimbingan.count({ where: { bimbingan_id: ids.fourth } }), 2);
      });

      await t.test('pagination, gate pelaksanaan, PDF besar, dan request paralel', async () => {
        const page = await req(own('?page=1&limit=2&status_bimbingan=TERVALIDASI'), student.token);
        assert.equal(page.status, 200);
        assert.equal(page.body.data.items.length, 2);
        assert.equal(page.body.data.pagination.total, 3);
        assert.equal((await req(supervisor('?page=1&limit=1'), mentor.token)).body.data.items.length, 1);
        assert.equal((await req(own('?limit=1000'), student.token)).status, 400);
        const large = await req(own(), student.token, 'POST', { jenis_bimbingan: 'ONLINE', ringkasan: 'Besar' });
        ids.large = large.body.data.id;
        assert.equal((await req(own(`/${ids.large}/kirim`), student.token, 'POST', {},
          [Buffer.alloc(5 * 1024 * 1024 + 1)])).status, 413);
        assert.equal(await db.riwayatBimbingan.count({ where: { bimbingan_id: ids.large } }), 0);
        const noSupervisor = await db.penugasanDosen.update({ where: { id: assignment.id },
          data: { status_penugasan: 'NONAKTIF', berakhir_at: new Date() } });
        assert.equal(noSupervisor.status_penugasan, 'NONAKTIF');
        const filesBeforeRollback = (await readdir(join(storageRoot, 'bimbingan'))).length;
        assert.equal((await req(own(`/${ids.large}/kirim`), student.token, 'POST', {}, [pdf()])).status, 409);
        assert.equal((await readdir(join(storageRoot, 'bimbingan'))).length, filesBeforeRollback);
        assert.equal(await db.riwayatBimbingan.count({ where: { bimbingan_id: ids.large } }), 0);
        assert.equal((await req(own(), student.token, 'POST',
          { jenis_bimbingan: 'ONLINE', ringkasan: 'Terkunci' })).status, 409);
        await db.penugasanDosen.update({ where: { id: assignment.id },
          data: { status_penugasan: 'AKTIF', berakhir_at: null } });
        await db.pengajuan.update({ where: { id: application.id }, data: { status_pengajuan: 'DRAFT' } });
        assert.equal((await req(own(), student.token, 'POST',
          { jenis_bimbingan: 'ONLINE', ringkasan: 'Belum ACC' })).status, 409);
        await db.pengajuan.update({ where: { id: application.id }, data: { status_pengajuan: 'ACC' } });
        await db.pengajuan.update({ where: { id: application.id }, data: { status_pengerjaan: 'SELESAI' } });
        assert.equal((await req(own(), student.token, 'POST',
          { jenis_bimbingan: 'ONLINE', ringkasan: 'Selesai' })).status, 409);
        await db.pengajuan.update({ where: { id: application.id }, data: { status_pengerjaan: null } });
        const a = await req(own(), student.token, 'POST', { jenis_bimbingan: 'ONLINE', ringkasan: 'P1' });
        const b = await req(own(), student.token, 'POST', { jenis_bimbingan: 'ONLINE', ringkasan: 'P2' });
        const idsParallel = [a.body.data.id, b.body.data.id];
        for (const itemId of idsParallel) {
          assert.equal((await req(own(`/${itemId}/kirim`), student.token, 'POST', {})).status, 200);
        }
        const bulk = { konfirmasi_sudah_diperiksa: true,
          items: idsParallel.map((itemId) => ({ bimbingan_id: itemId, expected_versi_pengiriman: 1 })) };
        const results = await Promise.all([
          req(supervisor('/bulk-validasi'), mentor.token, 'POST', bulk),
          req(supervisor('/bulk-validasi'), mentor.token, 'POST', bulk),
        ]);
        assert.ok(results.every((result) => result.status === 200));
        for (const itemId of idsParallel) {
          assert.equal(await db.riwayatBimbingan.count({ where: { bimbingan_id: itemId } }), 2);
        }
        const concurrentDraft = await req(own(), student.token, 'POST',
          { jenis_bimbingan: 'ONLINE', ringkasan: 'Serentak' });
        const concurrentId = concurrentDraft.body.data.id;
        const submissions = await Promise.all([
          req(own(`/${concurrentId}/kirim`), student.token, 'POST', {}),
          req(own(`/${concurrentId}/kirim`), student.token, 'POST', {}),
        ]);
        assert.deepEqual(submissions.map((result) => result.status).sort(), [200, 409]);
        assert.equal(await db.riwayatBimbingan.count({ where: { bimbingan_id: concurrentId } }), 1);
      });

      await t.test('pengajuan dan periode lain tidak mencampur progres', async () => {
        ids.secondPeriod = (await db.periodeAkademik.create({ data: {
          tahun_ajaran: `J${tag.slice(0, 3)}/2028`, semester: 'GENAP',
          tanggal_mulai: new Date('2027-02-01T00:00:00Z'),
          tanggal_selesai: new Date('2027-07-31T00:00:00Z') } })).id;
        const next = await db.pengajuan.create({ data: { mahasiswa_id: student.profileId,
          periode_akademik_id: ids.secondPeriod, tahap_akademik_id: stageId,
          jenis_pengajuan: 'PERPANJANGAN', pilihan_topik: 'BARU', status_pengajuan: 'ACC',
          pengajuan_sebelumnya_id: application.id } });
        ids.applications.push(next.id);
        await db.penugasanDosen.create({ data: { pengajuan_id: next.id,
          dosen_id: mentor.profileId, jenis_penugasan: 'PEMBIMBING', sumber_penugasan: 'KAPRODI' } });
        const result = await req(`/api/pengajuan/${next.id}/bimbingan/progres`, student.token);
        assert.equal(result.status, 200);
        assert.equal(result.body.data.jumlah.tervalidasi, 0);
        assert.equal((await req(`/api/pengajuan/${next.id}/bimbingan/${ids.first}`, student.token)).status, 404);
      });
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      // Cleanup hanya record fixture yang dibuat setelah verifikasi nama TEST.
      if (ids.applications.length) {
        const rows = await db.bimbingan.findMany({ where: { pengajuan_id: { in: ids.applications } },
          select: { id: true } });
        const bimbinganIds = rows.map((row) => row.id);
        const events = await db.riwayatBimbingan.findMany({ where: { bimbingan_id: { in: bimbinganIds } },
          select: { id: true } });
        const eventIds = events.map((row) => row.id);
        const files = await db.lampiranBimbingan.findMany({ where: { riwayat_bimbingan_id: { in: eventIds } },
          select: { dokumen_id: true } });
        await db.lampiranBimbingan.deleteMany({ where: { riwayat_bimbingan_id: { in: eventIds } } });
        await db.riwayatBimbingan.deleteMany({ where: { bimbingan_id: { in: bimbinganIds } } });
        await db.bimbingan.deleteMany({ where: { id: { in: bimbinganIds } } });
        await db.dokumen.deleteMany({ where: { id: { in: files.map((row) => row.dokumen_id) } } });
        await db.penugasanDosen.deleteMany({ where: { pengajuan_id: { in: ids.applications } } });
        await db.pengajuan.deleteMany({ where: { id: { in: ids.applications } } });
      }
      await db.authSession.deleteMany({ where: { id: { in: ids.sessions } } });
      await db.mahasiswa.deleteMany({ where: { id: { in: ids.students } } });
      await db.dosen.deleteMany({ where: { id: { in: ids.lecturers } } });
      await db.userRole.deleteMany({ where: { user_id: { in: ids.users } } });
      await db.user.deleteMany({ where: { id: { in: ids.users } } });
      if (ids.period) await db.periodeAkademik.delete({ where: { id: ids.period } });
      if (ids.secondPeriod) await db.periodeAkademik.delete({ where: { id: ids.secondPeriod } });
      if (ids.stage) await db.tahapAkademik.delete({ where: { id: ids.stage } });
      await db.$disconnect();
      await rm(storageRoot, { recursive: true, force: true });
      if (oldStorageRoot === undefined) delete process.env.SIPKITA_PRIVATE_STORAGE_DIR;
      else process.env.SIPKITA_PRIVATE_STORAGE_DIR = oldStorageRoot;
      if (oldJwt === undefined) delete process.env.JWT_ACCESS_SECRET_BASE64;
      else process.env.JWT_ACCESS_SECRET_BASE64 = oldJwt;
    }
  });
