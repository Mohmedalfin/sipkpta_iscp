import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import JSZip from 'jszip';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/security/jwt.js';
import { REQUIRED_DOCUMENT_CODES } from '../src/services/data-diri.service.js';
import { subscribeToUser } from '../src/services/realtime.service.js';

const TEST_DATABASE = 'sipkita_test_kp_d1_spp_20261105070147_1066f27b';
const KP_DOCUMENTS = [
  ['BUKTI_BAYAR_PROPOSAL_KP', 'Bukti Pembayaran Proposal KP', 5, true],
  ['PROPOSAL_KP', 'Proposal KP', 10, true],
  ['BUKTI_SPP_VARIABEL_KP', 'Bukti Pembayaran SPP Variabel KP', 5, false],
  ['SERTIFIKAT_SOSIALISASI_KP', 'Sertifikat Sosialisasi KP', 5, false],
  ['SURAT_PERNYATAAN_SOSIALISASI_KP', 'Surat Pernyataan Pengganti Sosialisasi', 5, false],
];

function pdf(streamBytes = 0) {
  let content = '%PDF-1.4\n';
  const offsets = [0];
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>',
    `<< /Length ${streamBytes} >>\nstream\n${' '.repeat(streamBytes)}\nendstream`,
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

async function request(base, token, path, { method = 'GET', body, file, code, filename = 'dokumen.pdf' } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload;
  if (file !== undefined) {
    payload = new FormData();
    payload.set('kode_jenis', code);
    payload.set('file', new Blob([file], { type: 'application/pdf' }), filename);
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${base}/api/pengajuan${path}`, { method, headers, body: payload });
  const contentType = response.headers.get('content-type') || '';
  return {
    status: response.status,
    body: contentType.includes('application/json') ? await response.json() : await response.arrayBuffer(),
    headers: response.headers,
  };
}

async function adminRequest(base, token, path, { method = 'GET', body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}/api/admin-prodi/pengajuan${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status,
    body: response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : await response.arrayBuffer(),
    headers: response.headers };
}

async function kaprodiRequest(base, token, path, { method = 'GET', body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}/api/kaprodi${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status,
    body: response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : await response.arrayBuffer() };
}

async function reviewerRequest(base, token, path, { method = 'GET', body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}/api/reviewer${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status,
    body: response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : await response.arrayBuffer(),
    headers: response.headers };
}

async function notificationRequest(base, token, path, method = 'GET') {
  const response = await fetch(`${base}/api/notifikasi${path}`, {
    method, headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, body: await response.json() };
}

async function studentProposalRevision(base, token, id, expectedId, file, revisionNote) {
  const payload = new FormData();
  payload.set('expected_dokumen_pengajuan_id', String(expectedId));
  if (revisionNote !== undefined) payload.set('catatan_perbaikan', revisionNote);
  payload.set('file', new Blob([file], { type: 'application/pdf' }), 'proposal-review-revisi.pdf');
  const response = await fetch(`${base}/api/pengajuan/${id}/revisi-proposal`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: payload,
  });
  return { status: response.status, body: await response.json() };
}

async function ensureRole(prisma, code) {
  const role = await prisma.role.findUnique({ where: { kode_peran: code } });
  assert.ok(role, `Role ${code} harus tersedia pada baseline TEST.`);
  return role;
}

async function addPersonalDocuments(prisma, studentId, userId, codes) {
  const verification = await prisma.verifikasiDataDiri.upsert({
    where: { mahasiswa_id: studentId },
    create: { mahasiswa_id: studentId },
    update: {},
  });
  for (const code of codes) {
    const type = await prisma.jenisDokumen.findUnique({ where: { kode_jenis: code } });
    assert.ok(type, `Jenis Data Diri ${code} harus tersedia pada baseline TEST.`);
    const document = await prisma.dokumen.create({
      data: {
        diunggah_oleh_user_id: userId,
        nama_file_asli: `${code}.pdf`,
        storage_key: `data-diri/${randomUUID()}.pdf`,
        mime_type: 'application/pdf',
        ukuran_bytes: 100n,
      },
    });
    await prisma.dokumenDataDiri.create({
      data: {
        verifikasi_data_diri_id: verification.id,
        jenis_dokumen_id: type.id,
        dokumen_id: document.id,
      },
    });
  }
}

test('D2, E, F, G, dan H Pengajuan KP berjalan atomik pada PostgreSQL TEST terisolasi',
  { skip: process.env.SIPKITA_PENGAJUAN_KP_REAL_DB !== '1' }, async () => {
    assert.ok(process.env.DATABASE_URL, 'DATABASE_URL baseline diperlukan untuk membentuk URI TEST tanpa mencetak kredensial.');
    const target = new URL(process.env.DATABASE_URL);
    target.pathname = `/${TEST_DATABASE}`;
    target.searchParams.delete('schema');
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString() }) });
    const storageRoot = await mkdtemp(join(tmpdir(), 'sipkita-pengajuan-kp-'));
    const previousStorageRoot = process.env.SIPKITA_PRIVATE_STORAGE_DIR;
    const previousSecret = process.env.JWT_ACCESS_SECRET_BASE64;
    process.env.SIPKITA_PRIVATE_STORAGE_DIR = storageRoot;
    process.env.JWT_ACCESS_SECRET_BASE64 = randomBytes(32).toString('base64url');
    const tag = randomBytes(4).toString('hex');
    const ids = {
      users: [],
      students: [],
      sessions: [],
      theme: null,
      dosen: null,
      extraDosen: [],
      otherProdi: null,
      createdRequirements: [],
      createdDocumentTypes: [],
      createdSchedule: null,
      createdPeriod: null,
      createdStage: null,
    };
    let server;
    let unsubscribeRealtime = () => {};
    let unsubscribeNotifications = () => {};
    try {
      const [identity] = await prisma.$queryRaw`SELECT current_database() AS name`;
      assert.equal(identity.name, TEST_DATABASE);
      const migrations = await prisma.$queryRaw`
        SELECT migration_name
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        ORDER BY migration_name
      `;
      assert.equal(migrations.length, 6);
      assert.equal(migrations.at(-1).migration_name, '20261106000000_kurikulum_master');

      const [studentRole, adminRole, kaprodiRole, reviewerRole, pembimbingRole, prodi] = await Promise.all([
        ensureRole(prisma, 'MAHASISWA'),
        ensureRole(prisma, 'ADMIN_PRODI'),
        ensureRole(prisma, 'KAPRODI'),
        ensureRole(prisma, 'REVIEWER'),
        ensureRole(prisma, 'PEMBIMBING'),
        prisma.programStudi.findFirst({ orderBy: { id: 'asc' } }),
      ]);
      assert.ok(prodi, 'Program studi baseline TEST harus tersedia.');

      async function createUser(kind, role) {
        const user = await prisma.user.create({
          data: {
            login_id: `kp.d2.${kind}.${tag}`,
            email: `kp-d2-${kind}-${tag}@example.test`,
            password_hash: '$argon2id$v=19$m=19456,t=2,p=1$fixture$fixture',
          },
        });
        ids.users.push(user.id);
        await prisma.userRole.create({ data: { user_id: user.id, role_id: role.id } });
        return user;
      }

      const [userA, userB, adminUser, lecturerUser] = await Promise.all([
        createUser('a', studentRole),
        createUser('b', studentRole),
        createUser('admin', adminRole),
        prisma.user.create({
          data: {
            login_id: `kp.d2.dosen.${tag}`,
            email: `kp-d2-dosen-${tag}@example.test`,
            password_hash: '$argon2id$v=19$m=19456,t=2,p=1$fixture$fixture',
          },
        }),
      ]);
      ids.users.push(lecturerUser.id);
      const studentA = await prisma.mahasiswa.create({
        data: {
          user_id: userA.id,
          program_studi_id: prodi.id,
          nim: `D2A${tag}`,
          nama_lengkap: `Mahasiswa D2 A ${tag}`,
          tanggal_lahir: new Date('2002-01-01T00:00:00Z'),
        },
      });
      const studentB = await prisma.mahasiswa.create({
        data: {
          user_id: userB.id,
          program_studi_id: prodi.id,
          nim: `D2B${tag}`,
          nama_lengkap: `Mahasiswa D2 B ${tag}`,
          tanggal_lahir: new Date('2002-02-02T00:00:00Z'),
        },
      });
      ids.students.push(studentA.id, studentB.id);
      const lecturer = await prisma.dosen.create({
        data: {
          user_id: lecturerUser.id,
          program_studi_id: prodi.id,
          kode_dosen: `D2${tag}`,
          nama_lengkap: `Dosen D2 ${tag}`,
          tanggal_lahir: new Date('1980-01-01T00:00:00Z'),
        },
      });
      ids.dosen = lecturer.id;
      await prisma.userRole.create({ data: { user_id: lecturerUser.id, role_id: reviewerRole.id } });
      const kaprodiUser = await createUser('kaprodi', kaprodiRole);
      const reviewerUserB = await createUser('reviewer-b', reviewerRole);
      const reviewerUserC = await createUser('reviewer-c', reviewerRole);
      for (const [index, reviewerUser] of [reviewerUserB, reviewerUserC].entries()) {
        const reviewer = await prisma.dosen.create({ data: {
          user_id: reviewerUser.id, program_studi_id: prodi.id,
          kode_dosen: `D2R${index}${tag}`, nama_lengkap: `Reviewer ${index} ${tag}`,
          tanggal_lahir: new Date('1981-01-01T00:00:00Z'),
        } });
        ids.extraDosen.push(reviewer.id);
      }
      const theme = await prisma.temaPenelitian.create({
        data: { kode_tema: `D2_${tag}`, nama_tema: `Tema D2 ${tag}` },
      });
      ids.theme = theme.id;

      let stage = await prisma.tahapAkademik.findUnique({ where: { kode_tahap: 'KP' } });
      if (!stage) {
        stage = await prisma.tahapAkademik.create({
          data: { kode_tahap: 'KP', nama_tahap: 'Kerja Praktik', urutan: 1 },
        });
        ids.createdStage = stage.id;
      }
      let period = await prisma.periodeAkademik.findFirst({
        where: { tahun_ajaran: '2026/2027', semester: 'GANJIL' },
      });
      if (!period) {
        period = await prisma.periodeAkademik.create({
          data: {
            tahun_ajaran: '2026/2027',
            semester: 'GANJIL',
            tanggal_mulai: new Date('2026-08-01T00:00:00Z'),
            tanggal_selesai: new Date('2027-01-31T00:00:00Z'),
            status_periode: 'AKTIF',
          },
        });
        ids.createdPeriod = period.id;
      } else {
        assert.equal(period.status_periode, 'AKTIF');
      }
      let schedule = await prisma.jadwalProses.findFirst({
        where: {
          periode_akademik_id: period.id,
          tahap_akademik_id: stage.id,
          jenis_proses: 'PENGAJUAN_REGULER',
        },
      });
      if (!schedule) {
        schedule = await prisma.jadwalProses.create({
          data: {
            periode_akademik_id: period.id,
            tahap_akademik_id: stage.id,
            jenis_proses: 'PENGAJUAN_REGULER',
            tanggal_buka: new Date('2026-10-31T17:00:00.000Z'),
            tanggal_tutup: new Date('2027-01-31T16:59:00.000Z'),
            dibuat_oleh_user_id: adminUser.id,
          },
        });
        ids.createdSchedule = schedule.id;
      }
      assert.equal(schedule.is_aktif, true);

      for (const [index, [code, name, max, required]] of KP_DOCUMENTS.entries()) {
        let type = await prisma.jenisDokumen.findUnique({ where: { kode_jenis: code } });
        if (!type) {
          type = await prisma.jenisDokumen.create({
            data: {
              kode_jenis: code,
              nama_jenis: name,
              kategori_dokumen: 'PENGAJUAN',
              format_diizinkan: ['PDF'],
              maks_ukuran_mb: max,
            },
          });
          ids.createdDocumentTypes.push(type.id);
        }
        assert.equal(type.maks_ukuran_mb, max);
        let requirement = await prisma.persyaratanPengajuan.findFirst({
          where: {
            periode_akademik_id: period.id,
            tahap_akademik_id: stage.id,
            jenis_pengajuan: 'REGULER',
            pilihan_topik: 'BARU',
            jenis_dokumen_id: type.id,
          },
        });
        if (!requirement) {
          requirement = await prisma.persyaratanPengajuan.create({
            data: {
              periode_akademik_id: period.id,
              tahap_akademik_id: stage.id,
              jenis_pengajuan: 'REGULER',
              pilihan_topik: 'BARU',
              jenis_dokumen_id: type.id,
              is_wajib: required,
              urutan_tampil: index + 1,
            },
          });
          ids.createdRequirements.push(requirement.id);
        }
        assert.equal(requirement.is_wajib, required);
      }

      await addPersonalDocuments(prisma, studentA.id, userA.id, REQUIRED_DOCUMENT_CODES);
      await addPersonalDocuments(prisma, studentB.id, userB.id, REQUIRED_DOCUMENT_CODES.slice(0, -1));

      async function tokenFor(user, role) {
        const sessionId = randomUUID();
        ids.sessions.push(sessionId);
        await prisma.authSession.create({
          data: {
            id: sessionId,
            user_id: user.id,
            active_role_id: role.id,
            expires_at: new Date(Date.now() + 60 * 60 * 1000),
          },
        });
        return (await signAccessToken(user.id, sessionId, role.kode_peran, 0)).token;
      }
      const [tokenA, tokenB, adminToken, kaprodiToken, reviewerToken,
        reviewerTokenB, reviewerTokenC] = await Promise.all([
        tokenFor(userA, studentRole), tokenFor(userB, studentRole),
        tokenFor(adminUser, adminRole), tokenFor(kaprodiUser, kaprodiRole),
        tokenFor(lecturerUser, reviewerRole),
        tokenFor(reviewerUserB, reviewerRole), tokenFor(reviewerUserC, reviewerRole),
      ]);

      server = createApp({ prisma }).listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      const studentEvents = [];
      unsubscribeRealtime = subscribeToUser(userA.id, (event) => {
        if (event.resource_type === 'pengajuan') studentEvents.push(event);
      });
      const adminNotificationEvents = [];
      unsubscribeNotifications = subscribeToUser(adminUser.id, (event) => {
        if (event.type === 'notifikasi.updated') adminNotificationEvents.push(event);
      }, 'ADMIN_PRODI');
      assert.equal((await request(base, null, '/opsi-form?tahap=KP')).status, 401);
      assert.equal((await request(base, adminToken, '/opsi-form?tahap=KP')).status, 403);
      const options = await request(base, tokenA, '/opsi-form?tahap=KP');
      assert.equal(options.status, 200);
      assert.equal(options.body.data.jadwal.is_open, true);
      assert.equal(options.body.data.persyaratan.length, 5);
      assert.equal(options.body.data.data_diri.jumlah_terunggah, 6);

      const formA = {
        tema_penelitian_id: theme.id,
        judul_penelitian: 'Sistem Informasi Pengujian D2',
        objek_penelitian: 'Unit Pengujian',
        lokasi_penelitian: 'Yogyakarta',
        usulan_pembimbing_id: lecturer.id,
        ipk_saat_pengajuan: 3.5,
        jumlah_sks_saat_pengajuan: 100,
        memiliki_nilai_de: false,
        daftar_mk_nilai_de: null,
        sudah_bayar_spp_variabel: true,
      };
      const createdA = await request(base, tokenA, '/', { method: 'POST', body: formA });
      assert.equal(createdA.status, 201);
      const applicationA = createdA.body.data.id;
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}`)).status, 404);
      assert.equal(createdA.body.data.status_pengajuan, 'DRAFT');
      assert.equal((await request(base, tokenA, '/', { method: 'POST', body: formA })).status, 409);
      assert.equal((await request(base, tokenB, `/${applicationA}`)).status, 404);
      assert.equal((await request(base, tokenB, '/')).body.data.pagination.total, 0);
      assert.equal((await request(base, tokenA, '/')).body.data.pagination.total, 1);
      assert.equal((await request(base, tokenA, `/${applicationA}`, {
        method: 'PATCH', body: { ipk_saat_pengajuan: 4.1 },
      })).status, 400);
      const edited = await request(base, tokenA, `/${applicationA}`, {
        method: 'PATCH', body: { judul_penelitian: 'Sistem Informasi Pengujian D2 Revisi' },
      });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.data.versi_topik.nomor_versi, 2);
      assert.equal(await prisma.versiTopik.count({ where: { topik_penelitian_id: edited.body.data.topik_penelitian_id } }), 2);

      const validPdf = pdf();
      const fake = await request(base, tokenA, `/${applicationA}/dokumen`, {
        method: 'POST', code: 'BUKTI_SPP_VARIABEL_KP', file: Buffer.from('%PDF-1.4\nnot valid'),
      });
      assert.equal(fake.status, 400);
      const overFiveMbPdf = pdf(5 * 1024 * 1024);
      assert.equal((await request(base, tokenA, `/${applicationA}/dokumen`, {
        method: 'POST', code: 'BUKTI_BAYAR_PROPOSAL_KP', file: overFiveMbPdf,
      })).status, 400);
      assert.equal((await request(base, tokenA, `/${applicationA}/dokumen`, {
        method: 'POST', code: 'PROPOSAL_KP', file: overFiveMbPdf,
      })).status, 201);
      assert.equal((await request(base, tokenA, `/${applicationA}/dokumen`, {
        method: 'POST', code: 'PROPOSAL_KP', file: Buffer.alloc(10 * 1024 * 1024 + 1),
      })).status, 413);
      for (const code of ['BUKTI_BAYAR_PROPOSAL_KP', 'SERTIFIKAT_SOSIALISASI_KP']) {
        assert.equal((await request(base, tokenA, `/${applicationA}/dokumen`, {
          method: 'POST', code, file: validPdf,
        })).status, 201);
      }
      const replaced = await request(base, tokenA, `/${applicationA}/dokumen`, {
        method: 'POST', code: 'PROPOSAL_KP', file: validPdf, filename: 'proposal-revisi.pdf',
      });
      assert.equal(replaced.status, 201);
      assert.equal(replaced.body.data.nomor_versi, 2);
      const proposalHistory = await prisma.dokumenPengajuan.findMany({
        where: {
          pengajuan_id: applicationA,
          persyaratan_pengajuan: { jenis_dokumen: { kode_jenis: 'PROPOSAL_KP' } },
        },
        orderBy: { nomor_versi: 'asc' },
      });
      assert.deepEqual(proposalHistory.map((item) => [item.nomor_versi, item.is_terkini]), [[1, false], [2, true]]);
      const detail = await request(base, tokenA, `/${applicationA}`);
      const currentProposal = detail.body.data.dokumen_pengajuan.find((item) =>
        item.is_terkini && item.persyaratan_pengajuan.jenis_dokumen.kode_jenis === 'PROPOSAL_KP');
      const downloaded = await request(base, tokenA, `/${applicationA}/dokumen/${currentProposal.id}/file`);
      assert.equal(downloaded.status, 200);
      assert.deepEqual(Buffer.from(downloaded.body), validPdf);
      assert.equal(downloaded.headers.get('cache-control'), 'private, no-store');
      assert.equal((await request(base, tokenB, `/${applicationA}/dokumen/${currentProposal.id}/file`)).status, 404);

      assert.equal((await request(base, tokenA, `/${applicationA}/kirim`, {
        method: 'POST', body: { setuju_pernyataan: false },
      })).status, 400);
      let persisted = await prisma.pengajuan.findUnique({ where: { id: applicationA } });
      assert.equal(persisted.diajukan_at, null);
      assert.equal(await prisma.riwayatStatusPengajuan.count({ where: { pengajuan_id: applicationA } }), 0);
      const missingSpp = await request(base, tokenA, `/${applicationA}/kirim`, {
        method: 'POST', body: { setuju_pernyataan: true },
      });
      assert.equal(missingSpp.status, 422);
      assert.equal(missingSpp.body.error.code, 'INCOMPLETE_DOCUMENTS');
      assert.equal((await request(base, tokenA, `/${applicationA}/dokumen`, {
        method: 'POST', code: 'BUKTI_SPP_VARIABEL_KP', file: validPdf,
      })).status, 201);
      const submittedA = await request(base, tokenA, `/${applicationA}/kirim`, {
        method: 'POST', body: { setuju_pernyataan: true },
      });
      assert.equal(submittedA.status, 200);
      assert.equal(submittedA.body.data.status_pengajuan, 'DIAJUKAN');
      assert.equal(adminNotificationEvents.length, 1, 'Submit mengirim invalidasi inbox setelah commit.');
      assert.equal(submittedA.body.data.status_pemeriksaan_berkas, 'BELUM_DIPERIKSA');
      assert.equal(submittedA.body.data.status_pemeriksaan_akademik, 'BELUM_DIPERIKSA');
      assert.equal((await notificationRequest(base, null, '/')).status, 401);
      const adminInbox = await notificationRequest(base, adminToken, '/?page=1&limit=10&dibaca=false');
      assert.equal(adminInbox.status, 200);
      assert.equal(adminInbox.body.data.pagination.total, 1);
      assert.equal(adminInbox.body.data.items[0].kategori_notifikasi, 'PENGAJUAN_KP');
      assert.equal(typeof adminInbox.body.data.items[0].id, 'string');
      assert.equal((await notificationRequest(base, tokenA,
        `/${adminInbox.body.data.items[0].id}/dibaca`, 'PATCH')).status, 404);
      assert.equal((await notificationRequest(base, adminToken, '/belum-dibaca/count')).body.data.count, 1);
      const marked = await notificationRequest(base, adminToken,
        `/${adminInbox.body.data.items[0].id}/dibaca`, 'PATCH');
      assert.deepEqual([marked.status, marked.body.data.changed], [200, true]);
      assert.equal((await notificationRequest(base, adminToken,
        `/${adminInbox.body.data.items[0].id}/dibaca`, 'PATCH')).body.data.changed, false);
      assert.equal((await notificationRequest(base, adminToken, '/belum-dibaca/count')).body.data.count, 0);
      assert.equal((await notificationRequest(base, adminToken, '/?dibaca=true')).body.data.pagination.total, 1);
      assert.equal((await notificationRequest(base, adminToken, '/?page=0')).status, 400);
      assert.equal((await notificationRequest(base, adminToken, '/?page=2147483647&limit=100')).status, 400);
      assert.equal((await notificationRequest(base, adminToken, '/999999999999999999999/dibaca', 'PATCH')).status, 400);
      assert.equal((await notificationRequest(base, adminToken, '/?dibaca=invalid')).status, 400);
      assert.equal((await notificationRequest(base, adminToken, '/dibaca-semua', 'PATCH')).body.data.updated, 0);
      persisted = await prisma.pengajuan.findUnique({ where: { id: applicationA } });
      assert.ok(persisted.diajukan_at instanceof Date);
      assert.equal(persisted.diajukan_at.getTime(), persisted.pernyataan_kebenaran_disetujui_at.getTime());
      const historyA = await prisma.riwayatStatusPengajuan.findMany({ where: { pengajuan_id: applicationA } });
      assert.equal(historyA.length, 1);
      assert.deepEqual(
        [historyA[0].jenis_status, historyA[0].status_sebelum, historyA[0].status_sesudah, historyA[0].diubah_oleh_user_id],
        ['PENGAJUAN', 'DRAFT', 'DIAJUKAN', userA.id],
      );
      const notificationEventsBeforeRetry = adminNotificationEvents.length;
      const repeated = await Promise.all([1, 2].map(() => request(base, tokenA, `/${applicationA}/kirim`, {
        method: 'POST', body: { setuju_pernyataan: true },
      })));
      assert.deepEqual(repeated.map((item) => item.status), [200, 200]);
      assert.ok(repeated.every((item) => item.body.data.idempotent === true));
      assert.equal(adminNotificationEvents.length, notificationEventsBeforeRetry,
        'Retry submit tidak menerbitkan event notifikasi.');
      assert.equal(await prisma.riwayatStatusPengajuan.count({ where: { pengajuan_id: applicationA } }), 1);
      assert.equal((await notificationRequest(base, adminToken, '/?dibaca=true')).body.data.pagination.total, 1,
        'Submit idempotent tidak menambah notifikasi.');
      assert.equal((await request(base, tokenA, `/${applicationA}`, {
        method: 'PATCH', body: { judul_penelitian: 'Tidak Boleh' },
      })).status, 409);
      assert.equal((await request(base, tokenA, `/${applicationA}/dokumen`, {
        method: 'POST', code: 'PROPOSAL_KP', file: validPdf,
      })).status, 409);

      assert.equal((await adminRequest(base, null, '/')).status, 401);
      assert.equal((await adminRequest(base, tokenA, '/')).status, 403);
      const adminList = await adminRequest(base, adminToken, '/?status_pengajuan=DIAJUKAN');
      assert.equal(adminList.status, 200);
      assert.equal(adminList.body.data.pagination.total, 1);
      const adminDetail = await adminRequest(base, adminToken, `/${applicationA}`);
      assert.equal(adminDetail.status, 200);
      assert.equal(adminDetail.body.data.dokumen_pengajuan.length, 4);
      assert.equal(JSON.stringify(adminDetail.body).includes('storage_key'), false);
      const stale = adminDetail.body.data.snapshot;
      const adminFile = await adminRequest(base, adminToken,
        `/${applicationA}/dokumen/${currentProposal.id}/file`);
      assert.equal(adminFile.status, 200);
      assert.deepEqual(Buffer.from(adminFile.body), validPdf);
      assert.equal((await adminRequest(base, tokenB,
        `/${applicationA}/dokumen/${currentProposal.id}/file`)).status, 403);
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/pemeriksaan-berkas`, {
        method: 'PATCH', body: { status: 'BELUM_OK', expected_snapshot: stale },
      })).status, 400);
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/acc-lengkap`, {
        method: 'POST', body: { konfirmasi: true, expected_snapshot: stale },
      })).status, 409);
      const berkas = await adminRequest(base, adminToken, `/${applicationA}/pemeriksaan-berkas`, {
        method: 'PATCH', body: { status: 'BELUM_OK', catatan: 'Proposal perlu diperbaiki.', expected_snapshot: stale },
      });
      assert.equal(berkas.status, 200);
      assert.equal(studentEvents.at(-1).type, 'pengajuan.administration.updated');
      const afterCategoryEvents = studentEvents.length;
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/pemeriksaan-nilai`, {
        method: 'PATCH', body: { status: 'OK_LENGKAP', expected_snapshot: stale },
      })).status, 409);
      const afterBerkas = (await adminRequest(base, adminToken, `/${applicationA}`)).body.data;
      assert.equal(studentEvents.length, afterCategoryEvents, 'Snapshot stale tidak mengirim event.');
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/pemeriksaan-nilai`, {
        method: 'PATCH', body: { status: 'OK_LENGKAP', expected_snapshot: afterBerkas.snapshot },
      })).status, 200);
      const afterNilai = (await adminRequest(base, adminToken, `/${applicationA}`)).body.data;
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/pemeriksaan-nilai`, {
        method: 'PATCH', body: { status: 'BELUM_OK', catatan: 'IPK perlu dikoreksi.',
          expected_snapshot: afterNilai.snapshot },
      })).status, 200);
      const nilaiBelumOk = (await adminRequest(base, adminToken, `/${applicationA}`)).body.data;
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/pemeriksaan-nilai`, {
        method: 'PATCH', body: { status: 'OK_LENGKAP', expected_snapshot: nilaiBelumOk.snapshot },
      })).status, 409);
      assert.equal((await request(base, tokenA, `/${applicationA}/kirim-perbaikan`, {
        method: 'POST', body: { kategori: ['NILAI'] },
      })).status, 409);
      assert.equal((await request(base, tokenA, `/${applicationA}/perbaikan`, {
        method: 'PATCH', body: { ipk_saat_pengajuan: 3.75 },
      })).status, 200);
      assert.equal((await request(base, tokenA, `/${applicationA}/kirim-perbaikan`, {
        method: 'POST', body: { kategori: ['NILAI'] },
      })).status, 200);
      const nilaiDikirim = (await adminRequest(base, adminToken, `/${applicationA}`)).body.data;
      assert.equal(nilaiDikirim.status_pemeriksaan_berkas, 'BELUM_OK');
      assert.equal(nilaiDikirim.status_pemeriksaan_akademik, 'BELUM_DIPERIKSA');
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/pemeriksaan-nilai`, {
        method: 'PATCH', body: { status: 'OK_LENGKAP', expected_snapshot: nilaiDikirim.snapshot },
      })).status, 200);
      const afterNilaiRecheck = (await adminRequest(base, adminToken, `/${applicationA}`)).body.data;
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/acc-lengkap`, {
        method: 'POST', body: { konfirmasi: true, expected_snapshot: afterNilaiRecheck.snapshot },
      })).status, 409);
      assert.equal((await request(base, tokenA, `/${applicationA}/perbaikan`, {
        method: 'PATCH', body: { ipk_saat_pengajuan: 3.75 },
      })).status, 409);
      const revisedTitle = await request(base, tokenA, `/${applicationA}/perbaikan`, {
        method: 'PATCH', body: { judul_penelitian: 'Proposal KP telah direvisi' },
      });
      assert.equal(revisedTitle.status, 200);
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/pemeriksaan-berkas`, {
        method: 'PATCH', body: { status: 'OK_LENGKAP', expected_snapshot: afterNilaiRecheck.snapshot },
      })).status, 409);
      const beforeSend = (await adminRequest(base, adminToken, `/${applicationA}`)).body.data;
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/pemeriksaan-berkas`, {
        method: 'PATCH', body: { status: 'OK_LENGKAP', expected_snapshot: beforeSend.snapshot },
      })).status, 409);
      const sentRevision = await request(base, tokenA, `/${applicationA}/kirim-perbaikan`, {
        method: 'POST', body: { kategori: ['BERKAS'] },
      });
      assert.equal(sentRevision.status, 200);
      assert.equal((await request(base, tokenA, `/${applicationA}/kirim-perbaikan`, {
        method: 'POST', body: { kategori: ['BERKAS'] },
      })).status, 409);
      const afterSend = (await adminRequest(base, adminToken, `/${applicationA}`)).body.data;
      assert.equal(afterSend.status_pemeriksaan_berkas, 'BELUM_DIPERIKSA');
      assert.equal(afterSend.status_pemeriksaan_akademik, 'OK_LENGKAP');
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/pemeriksaan-berkas`, {
        method: 'PATCH', body: { status: 'OK_LENGKAP', expected_snapshot: afterSend.snapshot },
      })).status, 200);
      const adminReadyA = (await adminRequest(base, adminToken, `/${applicationA}`)).body.data;
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/keputusan`, {
        method: 'POST', body: { status: 'ACC', expected_snapshot: adminReadyA.snapshot },
      })).status, 409);
      await prisma.verifikasiDataDiri.update({ where: { mahasiswa_id: studentA.id },
        data: { status_verifikasi: 'TERVERIFIKASI' } });
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/keputusan`, {
        method: 'POST', body: { status: 'ACC', expected_snapshot: adminReadyA.snapshot },
      })).status, 409);
      const verifiedA = (await adminRequest(base, adminToken, `/${applicationA}`)).body.data;
      const manualDecision = await adminRequest(base, adminToken, `/${applicationA}/keputusan`, {
        method: 'POST', body: { status: 'ACC', expected_snapshot: verifiedA.snapshot },
      });
      assert.equal(manualDecision.status, 200);
      assert.equal(manualDecision.body.data.status_pengajuan, 'ACC');
      assert.equal((await adminRequest(base, adminToken, `/${applicationA}/keputusan`, {
        method: 'POST', body: { status: 'TIDAK_ACC', catatan: 'Terlambat', expected_snapshot: verifiedA.snapshot },
      })).status, 409);
      assert.equal((await request(base, tokenA, `/${applicationA}/perbaikan`, {
        method: 'PATCH', body: { judul_penelitian: 'Tidak diizinkan' },
      })).status, 409);

      const formB = { ...formA, judul_penelitian: 'Pengajuan SPP Tidak', sudah_bayar_spp_variabel: false };
      const createdB = await request(base, tokenB, '/', { method: 'POST', body: formB });
      assert.equal(createdB.status, 201);
      const applicationB = createdB.body.data.id;
      for (const code of ['BUKTI_BAYAR_PROPOSAL_KP', 'PROPOSAL_KP', 'SURAT_PERNYATAAN_SOSIALISASI_KP']) {
        assert.equal((await request(base, tokenB, `/${applicationB}/dokumen`, {
          method: 'POST', code, file: validPdf,
        })).status, 201);
      }
      const incompletePersonal = await request(base, tokenB, `/${applicationB}/kirim`, {
        method: 'POST', body: { setuju_pernyataan: true },
      });
      assert.equal(incompletePersonal.status, 422);
      assert.equal(incompletePersonal.body.error.code, 'INCOMPLETE_PERSONAL_DOCUMENTS');
      await addPersonalDocuments(prisma, studentB.id, userB.id, REQUIRED_DOCUMENT_CODES.slice(-1));
      const submittedB = await request(base, tokenB, `/${applicationB}/kirim`, {
        method: 'POST', body: { setuju_pernyataan: true },
      });
      assert.equal(submittedB.status, 200);
      assert.equal(submittedB.body.data.status_pengajuan, 'DIAJUKAN');
      assert.equal(await prisma.dokumenPengajuan.count({
        where: {
          pengajuan_id: applicationB,
          persyaratan_pengajuan: { jenis_dokumen: { kode_jenis: 'BUKTI_SPP_VARIABEL_KP' } },
        },
      }), 0);
      const detailB = (await adminRequest(base, adminToken, `/${applicationB}`)).body.data;
      assert.equal((await adminRequest(base, adminToken, `/${applicationB}/acc-lengkap`, {
        method: 'POST', body: { konfirmasi: true, expected_snapshot: detailB.snapshot },
      })).status, 409);
      await prisma.verifikasiDataDiri.update({ where: { mahasiswa_id: studentB.id },
        data: { status_verifikasi: 'TERVERIFIKASI' } });
      const verifiedB = (await adminRequest(base, adminToken, `/${applicationB}`)).body.data;
      const all = await Promise.all([1, 2].map(() => adminRequest(base, adminToken,
        `/${applicationB}/acc-lengkap`, {
          method: 'POST', body: { konfirmasi: true, expected_snapshot: verifiedB.snapshot },
        })));
      assert.deepEqual(all.map((result) => result.status).sort(), [200, 409]);
      const finalB = await prisma.pengajuan.findUnique({ where: { id: applicationB } });
      assert.deepEqual([finalB.status_pemeriksaan_berkas,
        finalB.status_pemeriksaan_akademik, finalB.status_pengajuan],
      ['OK_LENGKAP', 'OK_LENGKAP', 'ACC']);
      const finalHistory = await prisma.riwayatStatusPengajuan.findMany({
        where: { pengajuan_id: applicationB },
      });
      assert.equal(finalHistory.filter((item) => item.status_sesudah === 'ACC').length, 1);
      assert.equal(finalHistory.filter((item) => item.status_sesudah === 'OK_LENGKAP').length, 2);

      const userC = await createUser('c', studentRole);
      const studentC = await prisma.mahasiswa.create({ data: {
        user_id: userC.id, program_studi_id: prodi.id, nim: `D2C${tag}`,
        nama_lengkap: `Mahasiswa D2 C ${tag}`,
        tanggal_lahir: new Date('2002-03-03T00:00:00Z'),
      } });
      ids.students.push(studentC.id);
      await addPersonalDocuments(prisma, studentC.id, userC.id, REQUIRED_DOCUMENT_CODES);
      const tokenC = await tokenFor(userC, studentRole);
      const createdC = await request(base, tokenC, '/', {
        method: 'POST', body: { ...formA, judul_penelitian: 'Pengajuan KP ditolak' },
      });
      assert.equal(createdC.status, 201);
      const applicationC = createdC.body.data.id;
      for (const code of ['BUKTI_BAYAR_PROPOSAL_KP', 'PROPOSAL_KP',
        'SERTIFIKAT_SOSIALISASI_KP', 'BUKTI_SPP_VARIABEL_KP']) {
        assert.equal((await request(base, tokenC, `/${applicationC}/dokumen`, {
          method: 'POST', code, file: validPdf,
        })).status, 201);
      }
      assert.equal((await request(base, tokenC, `/${applicationC}/kirim`, {
        method: 'POST', body: { setuju_pernyataan: true },
      })).status, 200);
      const detailC = (await adminRequest(base, adminToken, `/${applicationC}`)).body.data;
      assert.equal((await adminRequest(base, adminToken, `/${applicationC}/keputusan`, {
        method: 'POST', body: { status: 'TIDAK_ACC', expected_snapshot: detailC.snapshot },
      })).status, 400);
      assert.equal((await adminRequest(base, adminToken, `/${applicationC}/keputusan`, {
        method: 'POST', body: { status: 'TIDAK_ACC', catatan: 'Syarat administratif tidak terpenuhi.',
          expected_snapshot: detailC.snapshot },
      })).status, 200);
      const rejectedC = await prisma.pengajuan.findUnique({ where: { id: applicationC } });
      assert.equal(rejectedC.status_pengajuan, 'TIDAK_ACC');
      assert.equal(rejectedC.catatan_keputusan, 'Syarat administratif tidak terpenuhi.');
      assert.equal((await adminRequest(base, adminToken, `/${applicationC}/acc-lengkap`, {
        method: 'POST', body: { konfirmasi: true, expected_snapshot: detailC.snapshot },
      })).status, 409);
      assert.equal((await request(base, tokenC, `/${applicationC}/perbaikan`, {
        method: 'PATCH', body: { judul_penelitian: 'Tidak boleh diubah' },
      })).status, 409);

      assert.equal((await kaprodiRequest(base, null, '/pengajuan')).status, 401);
      assert.equal((await kaprodiRequest(base, tokenA, '/pengajuan')).status, 403);
      assert.equal((await kaprodiRequest(base, adminToken, '/pengajuan')).status, 403);
      assert.equal((await kaprodiRequest(base, reviewerToken, '/pengajuan')).status, 403);
      const userD = await createUser('d', studentRole);
      const studentD = await prisma.mahasiswa.create({ data: {
        user_id: userD.id, program_studi_id: prodi.id, nim: `D2D${tag}`,
        nama_lengkap: `Mahasiswa D2 D ${tag}`,
        tanggal_lahir: new Date('2002-04-04T00:00:00Z'),
      } });
      ids.students.push(studentD.id);
      await addPersonalDocuments(prisma, studentD.id, userD.id, REQUIRED_DOCUMENT_CODES);
      const tokenD = await tokenFor(userD, studentRole);
      const createdD = await request(base, tokenD, '/', {
        method: 'POST', body: { ...formA, judul_penelitian: 'Pengajuan reviewer paralel' },
      });
      assert.equal(createdD.status, 201);
      const applicationD = createdD.body.data.id;
      assert.equal((await kaprodiRequest(base, kaprodiToken, `/pengajuan/${applicationD}/reviewer`, {
        method: 'POST', body: { dosen_ids: [lecturer.id] },
      })).status, 422);
      assert.equal((await kaprodiRequest(base, kaprodiToken, `/pengajuan/${applicationC}/reviewer`, {
        method: 'POST', body: { dosen_ids: [lecturer.id] },
      })).status, 422);
      for (const code of ['BUKTI_BAYAR_PROPOSAL_KP', 'PROPOSAL_KP',
        'SERTIFIKAT_SOSIALISASI_KP', 'BUKTI_SPP_VARIABEL_KP']) {
        assert.equal((await request(base, tokenD, `/${applicationD}/dokumen`, {
          method: 'POST', code, file: validPdf,
        })).status, 201);
      }
      assert.equal((await request(base, tokenD, `/${applicationD}/kirim`, {
        method: 'POST', body: { setuju_pernyataan: true },
      })).status, 200);
      const beforeReviewer = await prisma.pengajuan.findUnique({ where: { id: applicationD } });
      assert.deepEqual([beforeReviewer.status_pengajuan, beforeReviewer.status_pemeriksaan_berkas,
        beforeReviewer.status_pemeriksaan_akademik],
      ['DIAJUKAN', 'BELUM_DIPERIKSA', 'BELUM_DIPERIKSA']);
      const kpList = await kaprodiRequest(base, kaprodiToken,
        `/pengajuan?status_penugasan_reviewer=BELUM_ADA&q=${studentD.nim}`);
      assert.equal(kpList.status, 200);
      assert.equal(kpList.body.data.items.length, 1);
      assert.equal(kpList.body.data.items[0].jumlah_reviewer_aktif, 0);
      const kpDetail = await kaprodiRequest(base, kaprodiToken, `/pengajuan/${applicationD}`);
      assert.equal(kpDetail.status, 200);
      const proposalD = kpDetail.body.data.dokumen_pengajuan[0];
      assert.ok(proposalD?.id);
      assert.equal(JSON.stringify(kpDetail.body).includes('storage_key'), false);
      const reviewerFile = await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationD}/dokumen/${proposalD.id}/file`);
      assert.equal(reviewerFile.status, 200);
      assert.deepEqual(Buffer.from(reviewerFile.body), validPdf);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationD}/dokumen/${currentProposal.id}/file`)).status, 404);
      const candidates = await kaprodiRequest(base, kaprodiToken,
        `/kandidat-reviewer?pengajuan_id=${applicationD}`);
      assert.equal(candidates.status, 200);
      assert.ok(candidates.body.data.items.length >= 3);
      const concurrent = await Promise.all([1, 2].map(() => kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationD}/reviewer`, {
          method: 'POST', body: { dosen_ids: [lecturer.id] },
        })));
      assert.deepEqual(concurrent.map((result) => result.status), [200, 200]);
      assert.deepEqual(concurrent.map((result) => result.body.data.created).sort(), [0, 1]);
      const individual = await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationD}/reviewer`, {
          method: 'POST', body: { dosen_ids: [lecturer.id, ids.extraDosen[0]] },
        });
      assert.equal(individual.status, 200);
      assert.deepEqual([individual.body.data.created, individual.body.data.already_assigned], [1, 1]);
      const invalidBulk = await kaprodiRequest(base, kaprodiToken, '/penugasan-reviewer/bulk', {
        method: 'POST', body: { pengajuan_ids: [applicationB, applicationC], dosen_id: ids.extraDosen[1] },
      });
      assert.equal(invalidBulk.status, 422);
      assert.ok(invalidBulk.body.error.details.some((row) => row.pengajuan_id === applicationC));
      assert.equal(await prisma.penugasanDosen.count({ where: { pengajuan_id: applicationB,
        jenis_penugasan: 'REVIEWER' } }), 0);
      const bulk = await kaprodiRequest(base, kaprodiToken, '/penugasan-reviewer/bulk', {
        method: 'POST', body: { pengajuan_ids: [applicationA, applicationD], dosen_id: ids.extraDosen[1] },
      });
      assert.equal(bulk.status, 200);
      assert.deepEqual([bulk.body.data.created, bulk.body.data.already_assigned], [2, 0]);
      assert.equal(studentEvents.at(-1).type, 'pengajuan.assignment.updated');
      const afterAssignmentEvents = studentEvents.length;
      const assignmentNoticesBeforeRetry = await prisma.notifikasiPenerima.count({ where: {
        notifikasi: { kategori_notifikasi: 'PENUGASAN_REVIEWER_KP' },
      } });
      const repeatedBulk = await kaprodiRequest(base, kaprodiToken, '/penugasan-reviewer/bulk', {
        method: 'POST', body: { pengajuan_ids: [applicationA, applicationD], dosen_id: ids.extraDosen[1] },
      });
      assert.deepEqual([repeatedBulk.status, repeatedBulk.body.data.created,
        repeatedBulk.body.data.already_assigned], [200, 0, 2]);
      assert.equal(studentEvents.length, afterAssignmentEvents, 'Penugasan idempotent tidak mengirim ulang event.');
      assert.equal(await prisma.notifikasiPenerima.count({ where: {
        notifikasi: { kategori_notifikasi: 'PENUGASAN_REVIEWER_KP' },
      } }), assignmentNoticesBeforeRetry, 'Retry bulk tidak membuat notifikasi ganda.');
      const mixedBulk = await kaprodiRequest(base, kaprodiToken, '/penugasan-reviewer/bulk', {
        method: 'POST', body: { pengajuan_ids: [applicationA, applicationB],
          dosen_id: ids.extraDosen[1] },
      });
      assert.deepEqual([mixedBulk.status, mixedBulk.body.data.created,
        mixedBulk.body.data.already_assigned], [200, 1, 1]);
      const mixedRetry = await kaprodiRequest(base, kaprodiToken, '/penugasan-reviewer/bulk', {
        method: 'POST', body: { pengajuan_ids: [applicationA, applicationB],
          dosen_id: ids.extraDosen[1] },
      });
      assert.deepEqual([mixedRetry.status, mixedRetry.body.data.created,
        mixedRetry.body.data.already_assigned], [200, 0, 2]);
      const assignments = await kaprodiRequest(base, kaprodiToken,
        `/penugasan-reviewer?status=AKTIF&dosen_id=${ids.extraDosen[1]}`);
      assert.equal(assignments.status, 200);
      assert.equal(assignments.body.data.pagination.total, 3);
      const reviewersD = await kaprodiRequest(base, kaprodiToken, `/pengajuan/${applicationD}/reviewer`);
      assert.equal(reviewersD.status, 200);
      assert.equal(reviewersD.body.data.jumlah_reviewer_aktif, 3);
      assert.ok(reviewersD.body.data.items.every((row) => row.sumber_penugasan === 'KAPRODI' &&
        row.status_penugasan === 'AKTIF'));
      const assignmentToReplace = reviewersD.body.data.items.find((row) => row.dosen_id === lecturer.id);
      const assignmentToEnd = reviewersD.body.data.items.find((row) => row.dosen_id === ids.extraDosen[0]);
      async function historicalReview(assignmentId, reviewerUserId) {
        const review = await prisma.reviewProposal.create({ data: {
          penugasan_dosen_id: assignmentId, hasil_review: 'LAYAK',
          catatan_akhir: 'Fixture hasil review terdahulu',
        } });
        const history = await prisma.riwayatReview.create({ data: {
          review_proposal_id: review.id, putaran_ke: 1,
          dokumen_pengajuan_id: proposalD.id,
          versi_topik_id: kpDetail.body.data.versi_topik.id,
          hasil_review: 'LAYAK', catatan_reviewer: 'Proposal layak pada versi ini.',
          direview_oleh_user_id: reviewerUserId, reviewed_at: new Date(),
        } });
        return { reviewId: review.id, historyId: history.id };
      }
      const reviewEnded = await historicalReview(assignmentToEnd.id, reviewerUserB.id);
      const reviewReplaced = await historicalReview(assignmentToReplace.id, lecturerUser.id);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/penugasan-reviewer/${assignmentToEnd.id}`, {
          method: 'PATCH', body: { alasan: 'Reviewer berhalangan' },
        })).status, 200);
      assert.equal((await prisma.reviewProposal.findUnique({ where: { id: reviewEnded.reviewId } }))
        .hasil_review, 'LAYAK');
      assert.equal((await prisma.riwayatReview.findUnique({ where: { id: reviewEnded.historyId } }))
        .dokumen_pengajuan_id, proposalD.id);
      const endedAssignment = await prisma.penugasanDosen.findUnique({
        where: { id: assignmentToEnd.id },
      });
      assert.equal(endedAssignment.status_penugasan, 'NONAKTIF');
      assert.ok(endedAssignment.berakhir_at instanceof Date);
      assert.equal(endedAssignment.alasan_perubahan, 'Reviewer berhalangan');
      const failedReplace = await kaprodiRequest(base, kaprodiToken,
        `/penugasan-reviewer/${assignmentToReplace.id}/ganti`, {
          method: 'POST', body: { dosen_id_baru: ids.extraDosen[1], alasan: 'Konflik tugas' },
        });
      assert.equal(failedReplace.status, 409);
      assert.equal((await prisma.penugasanDosen.findUnique({ where: { id: assignmentToReplace.id } }))
        .status_penugasan, 'AKTIF');
      const replacement = await kaprodiRequest(base, kaprodiToken,
        `/penugasan-reviewer/${assignmentToReplace.id}/ganti`, {
          method: 'POST', body: { dosen_id_baru: ids.extraDosen[0], alasan: 'Pergantian Reviewer' },
        });
      assert.equal(replacement.status, 200);
      assert.equal((await prisma.penugasanDosen.findUnique({
        where: { id: assignmentToReplace.id },
      })).status_penugasan, 'NONAKTIF');
      assert.equal((await prisma.penugasanDosen.findUnique({
        where: { id: replacement.body.data.penugasan_baru_id },
      })).asal_penugasan_id, assignmentToReplace.id);
      assert.equal((await prisma.penugasanDosen.findUnique({
        where: { id: replacement.body.data.penugasan_baru_id },
      })).sumber_penugasan, 'KAPRODI');
      assert.equal((await prisma.reviewProposal.findUnique({ where: { id: reviewReplaced.reviewId } }))
        .hasil_review, 'LAYAK');
      assert.equal((await prisma.riwayatReview.findUnique({ where: { id: reviewReplaced.historyId } }))
        .dokumen_pengajuan_id, proposalD.id);
      assert.equal(await prisma.reviewProposal.count({ where: {
        penugasan_dosen_id: replacement.body.data.penugasan_baru_id,
      } }), 0);
      assert.equal(await prisma.auditLog.count({ where: { entitas: 'PenugasanDosen',
        entitas_id: BigInt(assignmentToReplace.id) } }), 1);
      const afterReviewer = await prisma.pengajuan.findUnique({ where: { id: applicationD } });
      assert.deepEqual([afterReviewer.status_pengajuan, afterReviewer.status_pemeriksaan_berkas,
        afterReviewer.status_pemeriksaan_akademik],
      ['DIAJUKAN', 'BELUM_DIPERIKSA', 'BELUM_DIPERIKSA']);
      assert.equal((await reviewerRequest(base, null, '/pengajuan')).status, 401);
      assert.equal((await reviewerRequest(base, tokenA, '/pengajuan')).status, 403);
      assert.equal((await reviewerRequest(base, reviewerToken, `/pengajuan/${applicationD}`)).status, 403);
      assert.equal((await reviewerRequest(base, reviewerTokenB, `/pengajuan/${applicationA}`)).status, 403);
      const reviewerList = await reviewerRequest(base, reviewerTokenC, '/pengajuan');
      assert.equal(reviewerList.status, 200);
      assert.equal(reviewerList.body.data.pagination.total, 3);
      assert.equal(reviewerList.body.data.jumlah_eligible_bulk, 3);
      const secondReviewerPage = await reviewerRequest(base, reviewerTokenC,
        '/pengajuan?page=2&limit=1&status_review=BELUM_DIREVIEW');
      assert.equal(secondReviewerPage.status, 200);
      assert.deepEqual(secondReviewerPage.body.data.pagination,
        { page: 2, limit: 1, total: 3, total_pages: 3 });
      assert.equal(secondReviewerPage.body.data.items.length, 1);
      assert.equal(secondReviewerPage.body.data.jumlah_eligible_bulk, 3);
      const reviewDetailD = await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationD}`);
      assert.equal(reviewDetailD.status, 200);
      assert.equal(reviewDetailD.body.data.review_saya, 'BELUM_DIREVIEW');
      const versionD1 = reviewDetailD.body.data.versi_proposal;
      let reviewDetailA = (await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationA}`)).body.data;
      const reviewDetailB = (await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationB}`)).body.data;
      const reviewerPdf = await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationD}/proposal/file`);
      assert.equal(reviewerPdf.status, 200);
      assert.deepEqual(Buffer.from(reviewerPdf.body), validPdf);
      assert.equal((await reviewerRequest(base, reviewerTokenB,
        `/pengajuan/${applicationA}/proposal/file`)).status, 403);
      assert.equal((await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationD}/review`, { method: 'POST', body: {
          hasil_review: 'TIDAK_LAYAK', expected_dokumen_pengajuan_id: versionD1.id,
          expected_versi_topik_id: versionD1.versi_topik_id,
        } })).status, 400);
      assert.equal((await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationD}/review`, { method: 'POST', body: {
          hasil_review: 'TIDAK_LAYAK', catatan_reviewer: 'Perjelas metode.',
          expected_dokumen_pengajuan_id: versionD1.id,
          expected_versi_topik_id: versionD1.versi_topik_id,
        } })).status, 200);
      const repeatedCorrection = await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationD}/review`, { method: 'POST', body: {
          hasil_review: 'TIDAK_LAYAK', catatan_reviewer: 'Perjelas metode.',
          expected_dokumen_pengajuan_id: versionD1.id,
          expected_versi_topik_id: versionD1.versi_topik_id,
        } });
      assert.equal(repeatedCorrection.body.data.result, 'already_reviewed');
      assert.equal((await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationD}/review`, { method: 'POST', body: {
          hasil_review: 'TIDAK_LAYAK', catatan_reviewer: 'Catatan berbeda.',
          expected_dokumen_pengajuan_id: versionD1.id,
          expected_versi_topik_id: versionD1.versi_topik_id,
        } })).status, 409);
      assert.equal((await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationD}/review`, { method: 'POST', body: {
          hasil_review: 'LAYAK', expected_dokumen_pengajuan_id: versionD1.id,
          expected_versi_topik_id: versionD1.versi_topik_id,
        } })).status, 409);
      assert.equal((await reviewerRequest(base, reviewerTokenB,
        `/pengajuan/${applicationD}/review`, { method: 'POST', body: {
          hasil_review: 'LAYAK', expected_dokumen_pengajuan_id: versionD1.id,
          expected_versi_topik_id: versionD1.versi_topik_id,
        } })).status, 200);
      const studentReviews = await request(base, tokenD, `/${applicationD}/review`);
      assert.equal(studentReviews.status, 200);
      assert.ok(studentReviews.body.data.items.some((item) =>
        item.hasil_versi_terkini === 'TIDAK_LAYAK'));
      assert.ok(studentReviews.body.data.items.some((item) =>
        item.hasil_versi_terkini === 'LAYAK'));
      assert.equal((await request(base, tokenA, `/${applicationD}/review`)).status, 404);
      assert.equal((await studentProposalRevision(base, null, applicationD,
        versionD1.id, validPdf, 'Catatan pribadi')).status, 401);
      assert.equal((await studentProposalRevision(base, tokenA, applicationD,
        versionD1.id, validPdf, 'Catatan pribadi')).status, 404);
      assert.equal((await studentProposalRevision(base, tokenD, applicationD,
        versionD1.id, validPdf, 'x'.repeat(5001))).status, 400);
      const revisionD = await studentProposalRevision(base, tokenD, applicationD,
        versionD1.id, validPdf, '  Metode diperjelas.  ');
      assert.equal(revisionD.status, 201);
      assert.equal(revisionD.body.data.nomor_versi, versionD1.nomor_versi + 1);
      assert.equal(revisionD.body.data.catatan_perbaikan, 'Metode diperjelas.');
      const detailD2 = (await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationD}`)).body.data;
      assert.equal(detailD2.proposal.catatan_perbaikan, 'Metode diperjelas.');
      assert.equal(detailD2.review_saya, 'BELUM_DIREVIEW');
      assert.equal(detailD2.riwayat_saya.length, 1);
      assert.equal(detailD2.rekap.review_selesai, false);
      const studentAfterRevision = (await request(base, tokenD,
        `/${applicationD}/review`)).body.data;
      assert.ok(studentAfterRevision.riwayat_revisi.some((item) =>
        item.dokumen_pengajuan_id === revisionD.body.data.dokumen_pengajuan_id &&
        item.catatan_perbaikan === 'Metode diperjelas.'));
      assert.ok(studentAfterRevision.items.filter((item) => item.status_penugasan === 'AKTIF')
        .every((item) => item.hasil_versi_terkini === 'BELUM_DIREVIEW'));
      assert.equal((await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationD}/review`, { method: 'POST', body: {
          hasil_review: 'LAYAK', expected_dokumen_pengajuan_id: versionD1.id,
          expected_versi_topik_id: versionD1.versi_topik_id,
        } })).status, 409);
      assert.equal((await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationA}/review`, { method: 'POST', body: {
          hasil_review: 'TIDAK_LAYAK', catatan_reviewer: 'Perbarui analisis proposal.',
          expected_dokumen_pengajuan_id: reviewDetailA.versi_proposal.id,
          expected_versi_topik_id: reviewDetailA.versi_proposal.versi_topik_id,
        } })).status, 200);
      assert.equal((await studentProposalRevision(base, tokenA, applicationA,
        reviewDetailA.versi_proposal.id, validPdf)).status, 201);
      reviewDetailA = (await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationA}`)).body.data;
      assert.equal(reviewDetailA.review_saya, 'BELUM_DIREVIEW');
      const adminAfterAccRevision = await prisma.pengajuan.findUnique({
        where: { id: applicationA },
      });
      assert.deepEqual([adminAfterAccRevision.status_pengajuan,
        adminAfterAccRevision.status_pemeriksaan_berkas,
        adminAfterAccRevision.status_pemeriksaan_akademik],
      ['ACC', 'OK_LENGKAP', 'OK_LENGKAP']);
      assert.ok(studentEvents.some((event) => event.resource_id === applicationA));
      const eventsBeforeRollback = studentEvents.length;
      const studentNoticesBeforeRollback = await prisma.notifikasiPenerima.count({
        where: { penerima_user_id: userA.id } });
      const staleBulk = await reviewerRequest(base, reviewerTokenC,
        '/review/bulk-layak', { method: 'POST', body: { konfirmasi: true, items: [
          { pengajuan_id: applicationA, expected_dokumen_pengajuan_id: reviewDetailA.versi_proposal.id },
          { pengajuan_id: applicationB, expected_dokumen_pengajuan_id: reviewDetailB.versi_proposal.id },
          { pengajuan_id: applicationD, expected_dokumen_pengajuan_id: versionD1.id },
        ] } });
      assert.equal(staleBulk.status, 409);
      assert.equal(await prisma.notifikasiPenerima.count({ where: { penerima_user_id: userA.id } }),
        studentNoticesBeforeRollback, 'Rollback bulk tidak meninggalkan notifikasi.');
      assert.equal(studentEvents.length, eventsBeforeRollback, 'Rollback tidak menerbitkan event.');
      assert.equal(await prisma.riwayatReview.count({ where: {
        direview_oleh_user_id: reviewerUserC.id,
        dokumen_pengajuan_id: reviewDetailA.versi_proposal.id,
      } }), 0);
      const validBulkBody = { konfirmasi: true, items: [
        { pengajuan_id: applicationA, expected_dokumen_pengajuan_id: reviewDetailA.versi_proposal.id },
        { pengajuan_id: applicationB, expected_dokumen_pengajuan_id: reviewDetailB.versi_proposal.id },
        { pengajuan_id: applicationD, expected_dokumen_pengajuan_id: detailD2.versi_proposal.id },
      ] };
      assert.equal((await reviewerRequest(base, reviewerTokenC,
        '/review/bulk-layak', { method: 'POST', body: { konfirmasi: true, items: [
          { pengajuan_id: applicationA, expected_dokumen_pengajuan_id: reviewDetailA.versi_proposal.id },
          { pengajuan_id: String(applicationA), expected_dokumen_pengajuan_id: reviewDetailA.versi_proposal.id },
        ] } })).status, 400);
      const reviewNoticesBeforeBulk = await prisma.notifikasiPenerima.count({ where: {
        penerima_user_id: userA.id,
        notifikasi: { kategori_notifikasi: 'REVIEW_PROPOSAL_KP' },
      } });
      const concurrentReview = await Promise.all([1, 2].map(() => reviewerRequest(base,
        reviewerTokenC, '/review/bulk-layak', { method: 'POST', body: validBulkBody })));
      assert.deepEqual(concurrentReview.map((item) => item.status), [200, 200]);
      assert.deepEqual(concurrentReview.map((item) => item.body.data.created).sort(), [0, 3]);
      assert.equal(await prisma.notifikasiPenerima.count({ where: {
        penerima_user_id: userA.id,
        notifikasi: { kategori_notifikasi: 'REVIEW_PROPOSAL_KP' },
      } }), reviewNoticesBeforeBulk + 1);
      assert.equal(studentEvents.length, eventsBeforeRollback + 1, 'Bulk commit memberi satu event per pengajuan pemilik.');
      const repeatedReview = await reviewerRequest(base, reviewerTokenC,
        '/review/bulk-layak', { method: 'POST', body: validBulkBody });
      assert.deepEqual([repeatedReview.status, repeatedReview.body.data.created,
        repeatedReview.body.data.already_layak], [200, 0, 3]);
      assert.equal(await prisma.notifikasiPenerima.count({ where: {
        penerima_user_id: userA.id,
        notifikasi: { kategori_notifikasi: 'REVIEW_PROPOSAL_KP' },
      } }), reviewNoticesBeforeBulk + 1, 'Review idempotent tidak menambah notifikasi.');
      const unreadBeforeAll = (await notificationRequest(base, tokenA,
        '/belum-dibaca/count')).body.data.count;
      assert.ok(unreadBeforeAll > 0);
      assert.equal((await notificationRequest(base, tokenA,
        '/dibaca-semua', 'PATCH')).body.data.updated, unreadBeforeAll);
      assert.equal((await notificationRequest(base, tokenA,
        '/belum-dibaca/count')).body.data.count, 0);
      assert.equal((await notificationRequest(base, tokenA,
        '/dibaca-semua', 'PATCH')).body.data.updated, 0);
      assert.equal(studentEvents.length, eventsBeforeRollback + 1, 'Request idempotent tidak menerbitkan event ganda.');
      assert.equal((await reviewerRequest(base, reviewerTokenB,
        `/pengajuan/${applicationD}/review`, { method: 'POST', body: {
          hasil_review: 'LAYAK', expected_dokumen_pengajuan_id: detailD2.versi_proposal.id,
          expected_versi_topik_id: detailD2.versi_proposal.versi_topik_id,
        } })).status, 200);
      const completedReview = (await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationD}`)).body.data;
      assert.equal(completedReview.rekap.review_selesai, true);
      const selectedZip = await reviewerRequest(base, reviewerTokenC,
        '/proposal/download-bulk', { method: 'POST', body: {
          scope: 'SELECTED', pengajuan_ids: [applicationA, applicationB],
        } });
      assert.equal(selectedZip.status, 200);
      assert.equal((await reviewerRequest(base, reviewerTokenC,
        '/proposal/download-bulk', { method: 'POST', body: {
          scope: 'SELECTED', pengajuan_ids: [applicationA, String(applicationA)],
        } })).status, 400);
      assert.ok(selectedZip.headers.get('content-type').includes('application/zip'));
      const zipTwo = await JSZip.loadAsync(Buffer.from(selectedZip.body));
      assert.equal(Object.keys(zipTwo.files).length, 2);
      for (const entry of Object.values(zipTwo.files)) {
        assert.match(entry.name, /^Proposal_KP_[A-Za-z0-9_-]+_\d+_V\d+\.pdf$/);
        assert.deepEqual(await entry.async('nodebuffer'), validPdf);
      }
      const allZip = await reviewerRequest(base, reviewerTokenC,
        '/proposal/download-bulk', { method: 'POST', body: { scope: 'ALL_ASSIGNED' } });
      assert.equal(allZip.status, 200);
      assert.equal(Object.keys((await JSZip.loadAsync(Buffer.from(allZip.body))).files).length, 3);
      assert.equal((await reviewerRequest(base, reviewerTokenB,
        '/proposal/download-bulk', { method: 'POST', body: {
          scope: 'SELECTED', pengajuan_ids: [applicationA],
        } })).status, 403);
      const proposalC = (await request(base, tokenC, `/${applicationC}`)).body.data
        .dokumen_pengajuan.find((row) => row.is_terkini &&
          row.persyaratan_pengajuan.jenis_dokumen.kode_jenis === 'PROPOSAL_KP');
      assert.equal((await studentProposalRevision(base, tokenC, applicationC,
        proposalC.id, validPdf)).status, 409);
      const adminAfterReview = await prisma.pengajuan.findUnique({ where: { id: applicationD } });
      assert.deepEqual([adminAfterReview.status_pengajuan,
        adminAfterReview.status_pemeriksaan_berkas,
        adminAfterReview.status_pemeriksaan_akademik],
      ['DIAJUKAN', 'BELUM_DIPERIKSA', 'BELUM_DIPERIKSA']);
      await prisma.userRole.delete({ where: { user_id_role_id: {
        user_id: lecturerUser.id, role_id: reviewerRole.id,
      } } });
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationB}/reviewer`, {
          method: 'POST', body: { dosen_ids: [lecturer.id] },
        })).status, 422);
      await prisma.userRole.create({ data: { user_id: lecturerUser.id, role_id: reviewerRole.id } });
      await prisma.dosen.update({ where: { id: ids.extraDosen[1] },
        data: { status_data: 'NONAKTIF' } });
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationB}/reviewer`, {
          method: 'POST', body: { dosen_ids: [ids.extraDosen[1]] },
        })).status, 422);
      await prisma.dosen.update({ where: { id: ids.extraDosen[1] },
        data: { status_data: 'AKTIF' } });
      // Fase H: semua penulisan tetap pada fixture PostgreSQL TEST yang terverifikasi.
      for (const lecturerId of [lecturerUser.id, reviewerUserB.id, reviewerUserC.id]) {
        await prisma.userRole.create({ data: { user_id: lecturerId, role_id: pembimbingRole.id } });
      }
      assert.equal((await kaprodiRequest(base, null, '/pengajuan-kp/finalisasi')).status, 401);
      assert.equal((await kaprodiRequest(base, tokenA, '/pengajuan-kp/finalisasi')).status, 403);
      assert.equal((await kaprodiRequest(base, adminToken, '/pembimbing-kp/kandidat')).status, 403);
      const readyA = await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationA}/finalisasi`);
      assert.equal(readyA.status, 200);
      assert.equal(readyA.body.data.status_finalisasi, 'SIAP_DITETAPKAN');
      assert.equal(readyA.body.data.jumlah_layak_versi_terkini, 1);
      const pendingReviewerH = await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationB}/reviewer`, { method: 'POST', body: {
          dosen_ids: [lecturer.id],
        } });
      assert.equal(pendingReviewerH.status, 200);
      const incompleteReviewH = (await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationB}/finalisasi`)).body.data;
      assert.equal(incompleteReviewH.status_finalisasi, 'BELUM_SIAP');
      assert.ok(incompleteReviewH.alasan.includes('REVIEW_TERKINI_BELUM_LAYAK'));
      const pendingAssignmentH = (await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationB}/reviewer`)).body.data.items.find((row) =>
        row.dosen_id === lecturer.id && row.status_penugasan === 'AKTIF');
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/penugasan-reviewer/${pendingAssignmentH.id}`, { method: 'PATCH', body: {
          alasan: 'Penugasan dibatalkan sebelum finalisasi.',
        } })).status, 200);
      const notReadyD = await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationD}/finalisasi`);
      assert.equal(notReadyD.body.data.status_finalisasi, 'BELUM_SIAP');
      assert.ok(notReadyD.body.data.alasan.includes('ACC_ADMIN_BELUM_TERSEDIA'));
      const readyList = await kaprodiRequest(base, kaprodiToken,
        '/pengajuan-kp/finalisasi?status_finalisasi=SIAP_DITETAPKAN&page=1&limit=2');
      assert.equal(readyList.status, 200);
      assert.equal(readyList.body.data.pagination.total, 2);
      const candidatesH = await kaprodiRequest(base, kaprodiToken,
        `/pembimbing-kp/kandidat?pengajuan_id=${applicationA}`);
      assert.equal(candidatesH.status, 200);
      assert.equal(candidatesH.body.data.items.find((row) => row.id === lecturer.id).is_usulan, true);
      const staleBulkH = await kaprodiRequest(base, kaprodiToken, '/pembimbing-kp/bulk', {
        method: 'POST', body: { konfirmasi: true, assignments: [
          { pengajuan_id: applicationA, dosen_id: ids.extraDosen[0],
            expected_dokumen_pengajuan_id: readyA.body.data.proposal_terkini.id },
          { pengajuan_id: applicationB, dosen_id: lecturer.id,
            expected_dokumen_pengajuan_id: 2147483647 },
        ] },
      });
      assert.equal(staleBulkH.status, 409);
      assert.equal(await prisma.penugasanDosen.count({ where: {
        pengajuan_id: applicationA, jenis_penugasan: 'PEMBIMBING',
      } }), 0);
      const invalidH = await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationD}/pembimbing`, { method: 'POST', body: {
          dosen_id: lecturer.id,
          expected_dokumen_pengajuan_id: notReadyD.body.data.proposal_terkini.id,
        } });
      assert.equal(invalidH.status, 409);
      // Simulasikan Admin ACC setelah seluruh review D selesai; jadwal submit tidak diperiksa H.
      await prisma.pengajuan.update({ where: { id: applicationD }, data: {
        status_pengajuan: 'ACC', status_pemeriksaan_berkas: 'OK_LENGKAP',
        status_pemeriksaan_akademik: 'OK_LENGKAP',
      } });
      await prisma.verifikasiDataDiri.update({ where: { mahasiswa_id: studentD.id },
        data: { status_verifikasi: 'TERVERIFIKASI' } });
      const readyB = (await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationB}/finalisasi`)).body.data;
      const readyD = (await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationD}/finalisasi`)).body.data;
      assert.equal(readyD.status_finalisasi, 'SIAP_DITETAPKAN');
      const bulkHBody = { konfirmasi: true, assignments: [
        { pengajuan_id: applicationA, dosen_id: ids.extraDosen[0],
          expected_dokumen_pengajuan_id: readyA.body.data.proposal_terkini.id },
        { pengajuan_id: applicationB, dosen_id: lecturer.id,
          expected_dokumen_pengajuan_id: readyB.proposal_terkini.id },
        { pengajuan_id: applicationD, dosen_id: lecturer.id,
          expected_dokumen_pengajuan_id: readyD.proposal_terkini.id },
      ] };
      const concurrentH = await Promise.all([1, 2].map(() => kaprodiRequest(base,
        kaprodiToken, '/pembimbing-kp/bulk', { method: 'POST', body: bulkHBody })));
      assert.deepEqual(concurrentH.map((row) => row.status).sort(), [200, 200]);
      assert.deepEqual(concurrentH.map((row) => row.body.data.created).sort(), [0, 3]);
      assert.equal(await prisma.penugasanDosen.count({ where: {
        pengajuan_id: { in: [applicationA, applicationB, applicationD] },
        jenis_penugasan: 'PEMBIMBING', status_penugasan: 'AKTIF',
      } }), 3);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationA}/pembimbing`, { method: 'POST', body: {
          dosen_id: ids.extraDosen[0],
          expected_dokumen_pengajuan_id: readyA.body.data.proposal_terkini.id,
        } })).body.data.result, 'already_assigned');
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationA}/pembimbing`, { method: 'POST', body: {
          dosen_id: lecturer.id,
          expected_dokumen_pengajuan_id: readyA.body.data.proposal_terkini.id,
        } })).status, 409);
      assert.equal((await request(base, tokenA, `/${applicationA}`)).body.data.pembimbing.dosen.id,
        ids.extraDosen[0]);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        '/pengajuan-kp/finalisasi?status_finalisasi=SUDAH_DITETAPKAN')).body.data
        .pagination.total, 3);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationA}/finalisasi`)).body.data.status_pengajuan, 'ACC');
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationA}/finalisasi`)).body.data.status_bimbingan, 'BELUM_DIMULAI');
      assert.equal((await studentProposalRevision(base, tokenA, applicationA,
        readyA.body.data.proposal_terkini.id, validPdf)).body.error.code, 'APPLICATION_FINALIZED');
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationA}/reviewer`, { method: 'POST', body: {
          dosen_ids: [lecturer.id],
        } })).body.error.code, 'APPLICATION_FINALIZED');
      const activeReviewerA = (await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationA}/reviewer`)).body.data.items.find((row) =>
        row.status_penugasan === 'AKTIF');
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/penugasan-reviewer/${activeReviewerA.id}`, { method: 'PATCH', body: {
          alasan: 'Tidak boleh setelah finalisasi.',
        } })).body.error.code, 'APPLICATION_FINALIZED');
      assert.equal((await reviewerRequest(base, reviewerTokenC,
        `/pengajuan/${applicationA}/review`, { method: 'POST', body: {
          hasil_review: 'LAYAK',
          expected_dokumen_pengajuan_id: readyA.body.data.proposal_terkini.id,
          expected_versi_topik_id: readyA.body.data.versi_topik.id,
        } })).body.error.code, 'APPLICATION_FINALIZED');
      const replacedH = await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationB}/pembimbing/ganti`, { method: 'POST', body: {
          dosen_baru_id: ids.extraDosen[1],
          alasan_penggantian: 'Koreksi penetapan sebelum bimbingan.',
        } });
      assert.equal(replacedH.status, 200);
      assert.equal((await prisma.penugasanDosen.findUnique({ where: {
        id: replacedH.body.data.penugasan_lama_id,
      } })).status_penugasan, 'NONAKTIF');
      assert.equal((await prisma.penugasanDosen.findUnique({ where: {
        id: replacedH.body.data.penugasan_baru_id,
      } })).asal_penugasan_id, replacedH.body.data.penugasan_lama_id);
      await prisma.bimbingan.create({ data: { pengajuan_id: applicationA,
        jenis_bimbingan: 'OFFLINE', status_bimbingan: 'DRAFT' } });
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationA}/finalisasi`)).body.data.status_bimbingan, 'SUDAH_DIMULAI');
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationA}/pembimbing/ganti`, { method: 'POST', body: {
          dosen_baru_id: lecturer.id, alasan_penggantian: 'Koreksi terlambat.',
        } })).body.error.code, 'SUPERVISION_STARTED');
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        '/pembimbing-kp/penugasan?status=AKTIF')).status, 200);
      assert.equal(await prisma.penugasanDosen.count({ where: {
        pengajuan_id: applicationB, jenis_penugasan: 'REVIEWER', status_penugasan: 'AKTIF',
      } }), 1);
      const anotherProdi = await prisma.programStudi.create({ data: {
        kode_prodi: `D2_OTHER_${tag}`, nama_prodi: `Prodi Lain ${tag}`,
        jenjang: prodi.jenjang, nama_fakultas: prodi.nama_fakultas,
        nama_perguruan_tinggi: prodi.nama_perguruan_tinggi,
      } });
      ids.otherProdi = anotherProdi.id;
      assert.equal((await kaprodiRequest(base, kaprodiToken, '/pengajuan')).status, 403);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        '/pengajuan-kp/finalisasi')).status, 403);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationA}/finalisasi`)).status, 403);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationA}/pembimbing`, { method: 'POST', body: {
          dosen_id: lecturer.id, expected_dokumen_pengajuan_id: readyA.body.data.proposal_terkini.id,
        } })).status, 403);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan-kp/${applicationA}/pembimbing/ganti`, { method: 'POST', body: {
          dosen_baru_id: lecturer.id, alasan_penggantian: 'Lintas Prodi.',
        } })).status, 403);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationD}`)).status, 403);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationD}/dokumen/${proposalD.id}/file`)).status, 403);
      assert.equal((await kaprodiRequest(base, kaprodiToken,
        `/pengajuan/${applicationB}/reviewer`, {
          method: 'POST', body: { dosen_ids: [lecturer.id] },
        })).status, 403);
      await prisma.programStudi.delete({ where: { id: anotherProdi.id } });
      ids.otherProdi = null;
    } finally {
      unsubscribeRealtime();
      unsubscribeNotifications();
      if (server) await new Promise((resolve) => server.close(resolve));
      try {
        if (ids.students.length) {
          const applications = await prisma.pengajuan.findMany({
            where: { mahasiswa_id: { in: ids.students } }, select: { id: true, topik_penelitian_id: true },
          });
          const applicationIds = applications.map((item) => item.id);
          const topicIds = applications.map((item) => item.topik_penelitian_id).filter(Boolean);
          const linkedDocuments = applicationIds.length ? await prisma.dokumenPengajuan.findMany({
            where: { pengajuan_id: { in: applicationIds } }, select: { dokumen_id: true },
          }) : [];
          if (applicationIds.length) {
            const reviewerAssignments = await prisma.penugasanDosen.findMany({
              where: { pengajuan_id: { in: applicationIds }, jenis_penugasan: 'REVIEWER' },
              select: { id: true },
            });
            if (reviewerAssignments.length) {
              const fixtureReviews = await prisma.reviewProposal.findMany({ where: {
                penugasan_dosen_id: { in: reviewerAssignments.map((row) => row.id) },
              }, select: { id: true } });
              if (fixtureReviews.length) {
                await prisma.riwayatReview.deleteMany({ where: {
                  review_proposal_id: { in: fixtureReviews.map((row) => row.id) },
                } });
                await prisma.reviewProposal.deleteMany({ where: {
                  id: { in: fixtureReviews.map((row) => row.id) },
                } });
              }
              await prisma.auditLog.deleteMany({ where: { entitas: 'PenugasanDosen',
                entitas_id: { in: reviewerAssignments.map((row) => BigInt(row.id)) } } });
            }
            await prisma.bimbingan.deleteMany({ where: { pengajuan_id: { in: applicationIds } } });
            const supervisorAssignments = await prisma.penugasanDosen.findMany({ where: {
              pengajuan_id: { in: applicationIds }, jenis_penugasan: 'PEMBIMBING',
            }, select: { id: true } });
            if (supervisorAssignments.length) await prisma.auditLog.deleteMany({ where: {
              entitas: 'PenugasanDosen', entitas_id: {
                in: supervisorAssignments.map((row) => BigInt(row.id)),
              },
            } });
            await prisma.penugasanDosen.deleteMany({ where: {
              asal_penugasan_id: { not: null }, pengajuan_id: { in: applicationIds },
            } });
            await prisma.penugasanDosen.deleteMany({ where: { pengajuan_id: { in: applicationIds } } });
            await prisma.auditLog.deleteMany({ where: { entitas: 'Pengajuan',
              entitas_id: { in: applicationIds.map((id) => BigInt(id)) },
              aksi: { startsWith: 'KP_REVISI_' } } });
            const proposalDocumentIds = await prisma.dokumenPengajuan.findMany({
              where: { pengajuan_id: { in: applicationIds } }, select: { id: true },
            });
            await prisma.auditLog.deleteMany({ where: { entitas: 'DokumenPengajuan',
              entitas_id: { in: proposalDocumentIds.map((row) => BigInt(row.id)) },
              aksi: 'KP_REVISI_PROPOSAL' } });
            await prisma.riwayatStatusPengajuan.deleteMany({ where: { pengajuan_id: { in: applicationIds } } });
            await prisma.dokumenPengajuan.deleteMany({ where: { pengajuan_id: { in: applicationIds } } });
            await prisma.pengajuan.deleteMany({ where: { id: { in: applicationIds } } });
          }
          if (topicIds.length) {
            await prisma.versiTopik.deleteMany({ where: { topik_penelitian_id: { in: topicIds } } });
            await prisma.topikPenelitian.deleteMany({ where: { id: { in: topicIds } } });
          }
          if (linkedDocuments.length) {
            await prisma.dokumen.deleteMany({ where: { id: { in: linkedDocuments.map((item) => item.dokumen_id) } } });
          }
          const verifications = await prisma.verifikasiDataDiri.findMany({
            where: { mahasiswa_id: { in: ids.students } }, select: { id: true },
          });
          if (verifications.length) {
            const personal = await prisma.dokumenDataDiri.findMany({
              where: { verifikasi_data_diri_id: { in: verifications.map((item) => item.id) } },
              select: { dokumen_id: true },
            });
            await prisma.dokumenDataDiri.deleteMany({
              where: { verifikasi_data_diri_id: { in: verifications.map((item) => item.id) } },
            });
            await prisma.verifikasiDataDiri.deleteMany({ where: { id: { in: verifications.map((item) => item.id) } } });
            if (personal.length) {
              await prisma.dokumen.deleteMany({ where: { id: { in: personal.map((item) => item.dokumen_id) } } });
            }
          }
        }
        if (ids.sessions.length) await prisma.authSession.deleteMany({ where: { id: { in: ids.sessions } } });
        if (ids.createdRequirements.length) {
          await prisma.persyaratanPengajuan.deleteMany({ where: { id: { in: ids.createdRequirements } } });
        }
        if (ids.createdSchedule) await prisma.jadwalProses.delete({ where: { id: ids.createdSchedule } });
        if (ids.theme) await prisma.temaPenelitian.deleteMany({ where: { id: ids.theme } });
        if (ids.dosen) await prisma.dosen.deleteMany({ where: { id: ids.dosen } });
        if (ids.extraDosen.length) await prisma.dosen.deleteMany({ where: {
          id: { in: ids.extraDosen },
        } });
        if (ids.students.length) await prisma.mahasiswa.deleteMany({ where: { id: { in: ids.students } } });
        if (ids.users.length) {
          const notifications = await prisma.notifikasi.findMany({ where: {
            OR: [{ dibuat_oleh_user_id: { in: ids.users } },
              { penerima: { some: { penerima_user_id: { in: ids.users } } } }],
          }, select: { id: true } });
          if (notifications.length) {
            const notificationIds = notifications.map((row) => row.id);
            await prisma.notifikasiPenerima.deleteMany({ where: {
              notifikasi_id: { in: notificationIds } } });
            await prisma.notifikasi.deleteMany({ where: { id: { in: notificationIds } } });
          }
          await prisma.userRole.deleteMany({ where: { user_id: { in: ids.users } } });
          await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
        }
        if (ids.createdDocumentTypes.length) {
          await prisma.jenisDokumen.deleteMany({ where: { id: { in: ids.createdDocumentTypes } } });
        }
        if (ids.createdPeriod) await prisma.periodeAkademik.delete({ where: { id: ids.createdPeriod } });
        if (ids.createdStage) await prisma.tahapAkademik.delete({ where: { id: ids.createdStage } });
        if (ids.otherProdi) await prisma.programStudi.delete({ where: { id: ids.otherProdi } });
        assert.equal(await prisma.user.count({ where: { login_id: { startsWith: 'kp.d2.' } } }), 0);
      } finally {
        await prisma.$disconnect();
        await rm(storageRoot, { recursive: true, force: true });
        if (previousStorageRoot === undefined) delete process.env.SIPKITA_PRIVATE_STORAGE_DIR;
        else process.env.SIPKITA_PRIVATE_STORAGE_DIR = previousStorageRoot;
        if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET_BASE64;
        else process.env.JWT_ACCESS_SECRET_BASE64 = previousSecret;
      }
    }
  });
