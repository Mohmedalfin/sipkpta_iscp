import { createHash, randomUUID } from 'node:crypto';
import { readPrivateDocument, removePrivateDocument, validatePdfDocument, writePrivateDocument } from './data-diri.service.js';
import { serializable } from './pengajuan-kp.service.js';
import { getBucketName, getSupabaseClient, isSupabaseStorageConfigured } from './storage.service.js';

export const BIMBINGAN = Object.freeze({
  OFFLINE: 'OFFLINE', ONLINE: 'ONLINE', DRAFT: 'DRAFT', MENUNGGU: 'MENUNGGU_VALIDASI',
  VALID: 'TERVALIDASI', REVISI: 'PERLU_PERBAIKAN', DITOLAK: 'DITOLAK',
  KIRIM: 'KIRIM', KIRIM_REVISI: 'KIRIM_REVISI', PERIKSA: 'PERIKSA',
});
const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const activeSupervisor = { jenis_penugasan: 'PEMBIMBING', status_penugasan: 'AKTIF' };
const privatePdfType = { maks_ukuran_mb: 5, format_diizinkan: ['PDF'] };

export class BimbinganError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const notFound = () => new BimbinganError(404, 'BIMBINGAN_NOT_FOUND', 'Bimbingan tidak ditemukan.');
const conflict = (message = 'Status atau versi bimbingan berubah; muat ulang.') =>
  new BimbinganError(409, 'BIMBINGAN_CONFLICT', message);

async function studentId(db, userId) {
  const row = await db.mahasiswa.findUnique({ where: { user_id: userId },
    select: { id: true, status_data: true } });
  if (!row || row.status_data !== 'AKTIF') throw new BimbinganError(403, 'PROFILE_UNAVAILABLE', 'Profil mahasiswa tidak aktif.');
  return row.id;
}

async function supervisorId(db, userId) {
  const row = await db.dosen.findUnique({ where: { user_id: userId },
    select: { id: true, status_data: true } });
  if (!row || row.status_data !== 'AKTIF') throw new BimbinganError(403, 'PROFILE_UNAVAILABLE', 'Profil pembimbing tidak aktif.');
  return row.id;
}

async function application(db, id, actorId, actor) {
  const scope = actor === 'student'
    ? { mahasiswa_id: await studentId(db, actorId) }
    : { penugasan_dosen: { some: { ...activeSupervisor, dosen_id: await supervisorId(db, actorId) } } };
  const row = await db.pengajuan.findFirst({ where: { id, ...scope, tahap_akademik: { kode_tahap: 'KP' } },
    select: { id: true, status_pengajuan: true, status_pengerjaan: true,
      tahap_akademik_id: true, periode_akademik_id: true, penyelesaian_tahap: { select: { id: true } },
      mahasiswa: { select: { id: true, nim: true, nama_lengkap: true } },
      versi_topik: { select: { judul_penelitian: true } },
      penugasan_dosen: { where: activeSupervisor, select: { id: true, dosen_id: true } } } });
  if (!row) throw notFound();
  return row;
}

function assertActive(row) {
  if (row.status_pengajuan !== 'ACC' || row.penyelesaian_tahap ||
      ['SELESAI', 'DITUTUP'].includes(row.status_pengerjaan) || row.penugasan_dosen.length !== 1) {
    throw new BimbinganError(409, 'BIMBINGAN_UNAVAILABLE', 'Pengajuan belum siap untuk bimbingan atau sudah selesai.');
  }
}

async function ownBimbingan(db, pengajuanId, id, actorId, actor) {
  const pengajuan = await application(db, pengajuanId, actorId, actor);
  const item = await db.bimbingan.findFirst({ where: { id, pengajuan_id: pengajuan.id } });
  if (!item) throw notFound();
  return { pengajuan, item };
}

function dateOnly(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BimbinganError(400, 'INVALID_DATE', 'Tanggal harus YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BimbinganError(400, 'INVALID_DATE', 'Tanggal tidak valid.');
  return date;
}

function text(value, required = false) {
  if (value == null || value === '') {
    if (required) throw new BimbinganError(400, 'INVALID_RINGKASAN', 'Ringkasan wajib diisi.');
    return null;
  }
  if (typeof value !== 'string' || !value.trim() || value.length > 10000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
    throw new BimbinganError(400, 'INVALID_RINGKASAN', 'Ringkasan tidak valid.');
  }
  return value.trim();
}

function content(item, input, sending = false) {
  const ringkasan = Object.hasOwn(input, 'ringkasan') ? text(input.ringkasan) : item.ringkasan;
  const tanggal = Object.hasOwn(input, 'tanggal_bimbingan') ? dateOnly(input.tanggal_bimbingan) : item.tanggal_bimbingan;
  if (item.jenis_bimbingan === BIMBINGAN.ONLINE && tanggal) throw new BimbinganError(400, 'INVALID_DATE', 'Bimbingan online tidak memakai tanggal pertemuan.');
  if (sending) {
    text(ringkasan, true);
    if (item.jenis_bimbingan === BIMBINGAN.OFFLINE) {
      if (!tanggal) throw new BimbinganError(400, 'INVALID_DATE', 'Tanggal pertemuan wajib diisi.');
      const todayJakarta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (tanggal.toISOString().slice(0, 10) > todayJakarta) throw new BimbinganError(400, 'INVALID_DATE', 'Tanggal pertemuan tidak boleh di masa depan.');
    }
  }
  return { ringkasan, tanggal_bimbingan: tanggal };
}

function publicItem(item) {
  return { ...item, boleh_kirim: item.status_bimbingan === BIMBINGAN.DRAFT,
    boleh_revisi: item.status_bimbingan === BIMBINGAN.REVISI,
    boleh_validasi: item.status_bimbingan === BIMBINGAN.MENUNGGU,
    expected_versi_pengiriman: item.versi_pengiriman_terakhir };
}

function historyItem(row) {
  return { ...row, id: row.id.toString(), lampiran_bimbingan: row.lampiran_bimbingan?.map((file) => ({
    id: file.id, jenis_lampiran: file.jenis_lampiran, keterangan: file.keterangan,
    urutan_tampil: file.urutan_tampil, nama_file_asli: file.dokumen.nama_file_asli,
    ukuran_bytes: file.dokumen.ukuran_bytes.toString(),
  })) };
}

async function history(db, id) {
  return (await db.riwayatBimbingan.findMany({ where: { bimbingan_id: id }, orderBy: { id: 'asc' },
    select: { id: true, aksi: true, versi_pengiriman: true, status_sebelum: true, status_sesudah: true,
      tanggal_bimbingan_snapshot: true, ringkasan_snapshot: true, catatan: true, created_at: true,
      dilakukan_oleh_user_id: true,
      lampiran_bimbingan: { orderBy: { urutan_tampil: 'asc' }, select: { id: true,
        jenis_lampiran: true, keterangan: true, urutan_tampil: true,
        dokumen: { select: { nama_file_asli: true, ukuran_bytes: true } } } } } })).map(historyItem);
}

async function lock(db, id) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(20261113, ${id}::int) IS NULL AS locked`;
}

export async function createDraft(db, userId, pengajuanId, input) {
  return serializable(db, async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261108, ${pengajuanId}::int) IS NULL AS locked`;
    const pengajuan = await application(tx, pengajuanId, userId, 'student');
    assertActive(pengajuan);
    const value = content({ jenis_bimbingan: input.jenis_bimbingan, ringkasan: null, tanggal_bimbingan: null }, input);
    return publicItem(await tx.bimbingan.create({ data: { pengajuan_id: pengajuanId,
      jenis_bimbingan: input.jenis_bimbingan, ...value } }));
  });
}

export async function updateDraft(db, userId, pengajuanId, id, input) {
  return serializable(db, async (tx) => {
    await lock(tx, id);
    const { pengajuan, item } = await ownBimbingan(tx, pengajuanId, id, userId, 'student');
    assertActive(pengajuan);
    if (item.status_bimbingan !== BIMBINGAN.DRAFT) throw conflict();
    return publicItem(await tx.bimbingan.update({ where: { id }, data: content(item, input) }));
  });
}

async function filesForSubmission(files) {
  if (!Array.isArray(files) || files.length > MAX_FILES) throw new BimbinganError(400, 'INVALID_DOCUMENT', 'Maksimal tiga lampiran PDF.');
  const prepared = [];
  for (const file of files) {
    try { prepared.push({ file, name: await validatePdfDocument(file, privatePdfType, MAX_FILE_BYTES) }); }
    catch (error) { throw new BimbinganError(error.status || 400, error.code || 'INVALID_DOCUMENT', error.message); }
  }
  return prepared;
}

export async function submit(db, userId, pengajuanId, id, input, files = [], revision = false) {
  const prepared = await filesForSubmission(files);
  if (prepared.length && isSupabaseStorageConfigured()) {
    const { data: bucket, error } = await getSupabaseClient().storage.getBucket(getBucketName());
    if (error || bucket?.public !== false) {
      throw new BimbinganError(503, 'PRIVATE_STORAGE_UNAVAILABLE', 'Penyimpanan lampiran privat tidak tersedia.');
    }
  }
  const stored = [];
  try {
    for (const entry of prepared) {
      const key = `bimbingan/${randomUUID()}.pdf`;
      await writePrivateDocument(key, entry.file.buffer);
      stored.push({ ...entry, key });
    }
    return await serializable(db, async (tx) => {
      await lock(tx, id);
      const { pengajuan, item } = await ownBimbingan(tx, pengajuanId, id, userId, 'student');
      assertActive(pengajuan);
      if (item.status_bimbingan !== (revision ? BIMBINGAN.REVISI : BIMBINGAN.DRAFT)) throw conflict();
      const value = content(item, input, true);
      const version = item.versi_pengiriman_terakhir + 1;
      if (version > 32767) throw conflict('Batas versi pengiriman tercapai.');
      const now = new Date();
      const updated = await tx.bimbingan.update({ where: { id }, data: { ...value,
        status_bimbingan: BIMBINGAN.MENUNGGU, versi_pengiriman_terakhir: version,
        ...(revision ? {} : { diajukan_pertama_at: now }),
        catatan_pembimbing_terakhir: null, diperiksa_oleh_user_id: null, diperiksa_at: null } });
      const event = await tx.riwayatBimbingan.create({ data: { bimbingan_id: id,
        dilakukan_oleh_user_id: userId, aksi: revision ? BIMBINGAN.KIRIM_REVISI : BIMBINGAN.KIRIM,
        versi_pengiriman: version, status_sebelum: item.status_bimbingan,
        status_sesudah: BIMBINGAN.MENUNGGU, tanggal_bimbingan_snapshot: value.tanggal_bimbingan,
        ringkasan_snapshot: value.ringkasan } });
      for (const [index, entry] of stored.entries()) {
        const document = await tx.dokumen.create({ data: { diunggah_oleh_user_id: userId,
          nama_file_asli: entry.name, storage_key: entry.key, mime_type: 'application/pdf',
          ukuran_bytes: BigInt(entry.file.buffer.length),
          checksum_sha256: createHash('sha256').update(entry.file.buffer).digest('hex') } });
        await tx.lampiranBimbingan.create({ data: { riwayat_bimbingan_id: event.id,
          dokumen_id: document.id, jenis_lampiran: 'MATERI', urutan_tampil: index + 1 } });
      }
      return publicItem(updated);
    });
  } catch (error) {
    for (const entry of stored) {
      try { await removePrivateDocument(entry.key, { strict: true }); }
      catch { console.error('Gagal membersihkan lampiran bimbingan setelah transaksi gagal.'); }
    }
    throw error;
  }
}

async function decide(tx, item, userId, result, note) {
  const now = new Date();
  await tx.bimbingan.update({ where: { id: item.id }, data: { status_bimbingan: result,
    catatan_pembimbing_terakhir: note, diperiksa_oleh_user_id: userId, diperiksa_at: now } });
  await tx.riwayatBimbingan.create({ data: { bimbingan_id: item.id,
    dilakukan_oleh_user_id: userId, aksi: BIMBINGAN.PERIKSA,
    versi_pengiriman: item.versi_pengiriman_terakhir, status_sebelum: item.status_bimbingan,
    status_sesudah: result, tanggal_bimbingan_snapshot: item.tanggal_bimbingan,
    ringkasan_snapshot: item.ringkasan, catatan: note } });
}

function checkDecision(item, userId, expected, result, note = null) {
  if (item.versi_pengiriman_terakhir !== expected) throw conflict();
  if (item.status_bimbingan === result && item.diperiksa_oleh_user_id === userId &&
      item.catatan_pembimbing_terakhir === note) return false;
  if (item.status_bimbingan !== BIMBINGAN.MENUNGGU) throw conflict();
  return true;
}

export async function decision(db, userId, id, input) {
  return serializable(db, async (tx) => {
    await lock(tx, id);
    const item = await tx.bimbingan.findUnique({ where: { id } });
    if (!item) throw notFound();
    const pengajuan = await application(tx, item.pengajuan_id, userId, 'supervisor');
    assertActive(pengajuan);
    const change = checkDecision(item, userId, input.expected_versi_pengiriman,
      input.hasil, input.catatan || null);
    if (change) await decide(tx, item, userId, input.hasil, input.catatan || null);
    return { bimbingan_id: id, status_bimbingan: input.hasil,
      versi_pengiriman: item.versi_pengiriman_terakhir, idempotent: !change };
  });
}

export async function bulkValidate(db, userId, items) {
  return serializable(db, async (tx) => {
    let changed = 0;
    for (const { bimbingan_id: id, expected_versi_pengiriman: expected } of [...items].sort((a, b) => a.bimbingan_id - b.bimbingan_id)) {
      await lock(tx, id);
      const item = await tx.bimbingan.findUnique({ where: { id } });
      if (!item) throw notFound();
      const pengajuan = await application(tx, item.pengajuan_id, userId, 'supervisor');
      assertActive(pengajuan);
      if (checkDecision(item, userId, expected, BIMBINGAN.VALID)) {
        await decide(tx, item, userId, BIMBINGAN.VALID, null);
        changed += 1;
      }
    }
    return { hasil: 'BERHASIL', total_dipilih: items.length,
      total_diperbarui: changed, total_idempotent: items.length - changed };
  });
}

export async function progress(db, userId, pengajuanId) {
  const pengajuan = await application(db, pengajuanId, userId, 'student');
  const [counts, rule] = await Promise.all([
    db.bimbingan.groupBy({ by: ['status_bimbingan'], where: { pengajuan_id: pengajuanId }, _count: { id: true } }),
    db.aturanPenyelesaianTahap.findUnique({ where: { tahap_akademik_id_periode_akademik_id: {
      tahap_akademik_id: pengajuan.tahap_akademik_id,
      periode_akademik_id: pengajuan.periode_akademik_id } },
    select: { minimal_bimbingan: true, is_aktif: true } }),
  ]);
  const count = (status) => counts.find((row) => row.status_bimbingan === status)?._count.id || 0;
  const minimum = rule?.is_aktif ? rule.minimal_bimbingan : null;
  return { pengajuan_id: pengajuanId, jumlah: { tervalidasi: count(BIMBINGAN.VALID),
    menunggu_validasi: count(BIMBINGAN.MENUNGGU), perlu_perbaikan: count(BIMBINGAN.REVISI),
    ditolak: count(BIMBINGAN.DITOLAK), draft: count(BIMBINGAN.DRAFT) },
  minimal_bimbingan: minimum, target_terkonfigurasi: minimum !== null,
  memenuhi_minimum: minimum === null ? null : count(BIMBINGAN.VALID) >= minimum,
  zona_waktu: 'Asia/Jakarta' };
}

const listSelect = { id: true, pengajuan_id: true, jenis_bimbingan: true, tanggal_bimbingan: true,
  ringkasan: true, status_bimbingan: true, versi_pengiriman_terakhir: true,
  catatan_pembimbing_terakhir: true, diajukan_pertama_at: true, diperiksa_at: true,
  created_at: true, updated_at: true,
  pengajuan: { select: { nomor_pengajuan: true, periode_akademik_id: true,
    mahasiswa: { select: { id: true, nim: true, nama_lengkap: true } },
    versi_topik: { select: { judul_penelitian: true } } } } };

export async function listStudent(db, userId, pengajuanId, query) {
  await application(db, pengajuanId, userId, 'student');
  const where = { pengajuan_id: pengajuanId,
    ...(query.jenis_bimbingan ? { jenis_bimbingan: query.jenis_bimbingan } : {}),
    ...(query.status_bimbingan ? { status_bimbingan: query.status_bimbingan } : {}) };
  const [items, total] = await Promise.all([
    db.bimbingan.findMany({ where, select: listSelect, orderBy: { id: 'desc' },
      skip: (query.page - 1) * query.limit, take: query.limit }),
    db.bimbingan.count({ where }),
  ]);
  return { items: items.map(publicItem), pagination: { page: query.page, limit: query.limit,
    total, total_pages: Math.ceil(total / query.limit) }, progres: await progress(db, userId, pengajuanId) };
}

export async function listSupervisor(db, userId, query) {
  const dosenId = await supervisorId(db, userId);
  const where = { pengajuan: { tahap_akademik: { kode_tahap: 'KP' },
    penugasan_dosen: { some: { ...activeSupervisor, dosen_id: dosenId } },
    ...(query.pengajuan_id ? { id: query.pengajuan_id } : {}),
    ...(query.mahasiswa_id ? { mahasiswa_id: query.mahasiswa_id } : {}),
    ...(query.periode_id ? { periode_akademik_id: query.periode_id } : {}),
    ...(query.q ? { OR: [
      { mahasiswa: { nama_lengkap: { contains: query.q, mode: 'insensitive' } } },
      { mahasiswa: { nim: { contains: query.q, mode: 'insensitive' } } },
      { versi_topik: { judul_penelitian: { contains: query.q, mode: 'insensitive' } } },
    ] } : {}) },
    ...(query.jenis_bimbingan ? { jenis_bimbingan: query.jenis_bimbingan } : {}),
    ...(query.status_bimbingan ? { status_bimbingan: query.status_bimbingan } : {}) };
  const [items, total] = await Promise.all([
    db.bimbingan.findMany({ where, select: listSelect, orderBy: { id: 'desc' },
      skip: (query.page - 1) * query.limit, take: query.limit }),
    db.bimbingan.count({ where }),
  ]);
  return { items: items.map(publicItem), pagination: { page: query.page, limit: query.limit,
    total, total_pages: Math.ceil(total / query.limit) } };
}

export async function detailStudent(db, userId, pengajuanId, id) {
  const { item } = await ownBimbingan(db, pengajuanId, id, userId, 'student');
  return { ...publicItem(item), riwayat: await history(db, id) };
}

export async function detailSupervisor(db, userId, id) {
  const item = await db.bimbingan.findUnique({ where: { id } });
  if (!item) throw notFound();
  await application(db, item.pengajuan_id, userId, 'supervisor');
  return { ...publicItem(item), riwayat: await history(db, id) };
}

export async function historyStudent(db, userId, pengajuanId, id) {
  await ownBimbingan(db, pengajuanId, id, userId, 'student');
  return history(db, id);
}

export async function attachment(db, userId, id, attachmentId, actor, pengajuanId = null) {
  const item = await db.bimbingan.findUnique({ where: { id }, select: { pengajuan_id: true } });
  if (!item || (pengajuanId !== null && item.pengajuan_id !== pengajuanId)) throw notFound();
  await application(db, item.pengajuan_id, userId, actor);
  const file = await db.lampiranBimbingan.findFirst({ where: { id: attachmentId,
    riwayat_bimbingan: { bimbingan_id: id, aksi: { in: [BIMBINGAN.KIRIM, BIMBINGAN.KIRIM_REVISI] } } },
  select: { dokumen: { select: { storage_key: true, nama_file_asli: true } } } });
  if (!file) throw notFound();
  return { bytes: await readPrivateDocument(file.dokumen.storage_key), filename: file.dokumen.nama_file_asli };
}
