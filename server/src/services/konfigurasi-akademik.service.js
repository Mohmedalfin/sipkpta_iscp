import { authorizedProdiId } from './mahasiswa.service.js';

export const JENIS_PROSES = Object.freeze(['PENGAJUAN_REGULER', 'PENGAJUAN_PERPANJANGAN']);
export const STATUS_PERIODE = Object.freeze(['DRAFT', 'AKTIF', 'NONAKTIF']);

export class KonfigurasiError extends Error {
  constructor(status, code, message) {
    super(message);
    Object.assign(this, { status, code });
  }
}

const fail = (status, code, message) => { throw new KonfigurasiError(status, code, message); };
const dbConflict = (error) => {
  if (error?.code === 'P2002') fail(409, 'DUPLICATE_CONFIGURATION', 'Kombinasi konfigurasi sudah ada.');
  if (error?.code === 'P2003') fail(409, 'CONFIGURATION_REFERENCED', 'Konfigurasi masih direferensikan.');
  throw error;
};

async function scoped(prisma) {
  await authorizedProdiId(prisma); // Model konfigurasi global; hanya aman saat tepat satu Prodi.
}

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function year(value) {
  if (typeof value !== 'string' || !/^(\d{4})\/(\d{4})$/.test(value)) return false;
  const [start, end] = value.split('/').map(Number);
  return end === start + 1;
}

function normalizePeriod(input) {
  const start = dateOnly(input.tanggal_mulai);
  const end = dateOnly(input.tanggal_selesai);
  if (!year(input.tahun_ajaran) || !['GANJIL', 'GENAP'].includes(input.semester) || !start || !end || start > end) {
    fail(400, 'VALIDATION_ERROR', 'Tahun, semester, atau rentang tanggal periode tidak valid.');
  }
  return { tahun_ajaran: input.tahun_ajaran, semester: input.semester, tanggal_mulai: start, tanggal_selesai: end };
}

async function periodUsage(tx, id) {
  const [jadwal, persyaratan, pengajuan] = await Promise.all([
    tx.jadwalProses.count({ where: { periode_akademik_id: id } }),
    tx.persyaratanPengajuan.count({ where: { periode_akademik_id: id } }),
    tx.pengajuan.count({ where: { periode_akademik_id: id } }),
  ]);
  return { jadwal, persyaratan, pengajuan };
}

const wibDate = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const wibTime = (date) => date ? new Date(date.getTime() + 7 * 60 * 60 * 1000)
  .toISOString().replace('Z', '+07:00') : null;
const periodCounts = { jadwal_proses: true, pengajuan: true };
function presentPeriod(row, now = new Date()) {
  const { _count, ...period } = row;
  const today = wibDate(now);
  return { ...period, is_berjalan: row.status_periode === 'AKTIF' &&
    row.tanggal_mulai.toISOString().slice(0, 10) <= today &&
    today <= row.tanggal_selesai.toISOString().slice(0, 10),
  is_mendatang: row.tanggal_mulai.toISOString().slice(0, 10) > today,
  jumlah: { jadwal: _count.jadwal_proses, pengajuan: _count.pengajuan } };
}

async function lockPeriods(tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(71042026)`;
}

async function assertKpRegularUnambiguous(tx, periodId, stageId, kind, active, exceptId) {
  if (!active || kind !== 'PENGAJUAN_REGULER') return;
  const stage = await tx.tahapAkademik.findUnique({ where: { id: stageId } });
  const period = await tx.periodeAkademik.findUnique({ where: { id: periodId } });
  if (stage?.kode_tahap !== 'KP' || !stage.is_aktif || period?.status_periode !== 'AKTIF') return;
  const other = await tx.jadwalProses.findFirst({ where: {
    is_aktif: true, jenis_proses: 'PENGAJUAN_REGULER',
    ...(exceptId ? { id: { not: exceptId } } : {}),
    tahap_akademik: { kode_tahap: 'KP', is_aktif: true },
    periode_akademik: { status_periode: 'AKTIF' },
  }, select: { id: true } });
  if (other) fail(409, 'KP_REGULAR_AMBIGUOUS', 'Hanya satu jadwal KP Reguler boleh aktif agar Pengajuan KP tetap tersedia.');
}

async function assertNoOverlap(tx, candidate, exceptId) {
  const other = await tx.periodeAkademik.findFirst({ where: {
    status_periode: 'AKTIF', ...(exceptId ? { id: { not: exceptId } } : {}),
    tanggal_mulai: { lte: candidate.tanggal_selesai },
    tanggal_selesai: { gte: candidate.tanggal_mulai },
  }, select: { id: true } });
  if (other) fail(409, 'PERIOD_OVERLAP', 'Rentang periode aktif bertumpang tindih.');
}

export async function listPeriods(prisma, query) {
  await scoped(prisma);
  const where = { ...(query.tahun_ajaran ? { tahun_ajaran: { contains: query.tahun_ajaran } } : {}),
    ...(query.semester ? { semester: query.semester } : {}),
    ...(query.status ? { status_periode: query.status } : {}) };
  const [data, total] = await prisma.$transaction([
    prisma.periodeAkademik.findMany({ where, include: { _count: { select: periodCounts } },
      orderBy: [{ tanggal_mulai: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.periodeAkademik.count({ where }),
  ]);
  return { data: data.map((row) => presentPeriod(row)), pagination: { page: query.page,
    limit: query.limit, total_items: total, total_pages: Math.ceil(total / query.limit) } };
}

export async function getPeriod(prisma, id) {
  await scoped(prisma);
  const row = await prisma.periodeAkademik.findUnique({ where: { id }, include: { _count: { select: periodCounts } } });
  if (!row) fail(404, 'PERIOD_NOT_FOUND', 'Periode tidak ditemukan.');
  return presentPeriod(row);
}

export async function createPeriod(prisma, input) {
  await scoped(prisma);
  const data = normalizePeriod(input);
  try {
    const row = await prisma.periodeAkademik.create({ data });
    return getPeriod(prisma, row.id);
  } catch (error) { dbConflict(error); }
}

export async function updatePeriod(prisma, id, input) {
  await scoped(prisma);
  try { const row = await prisma.$transaction(async (tx) => {
    await lockPeriods(tx);
    const current = await tx.periodeAkademik.findUnique({ where: { id } });
    if (!current) fail(404, 'PERIOD_NOT_FOUND', 'Periode tidak ditemukan.');
    const data = normalizePeriod({ ...current, tanggal_mulai: current.tanggal_mulai.toISOString().slice(0, 10),
      tanggal_selesai: current.tanggal_selesai.toISOString().slice(0, 10), ...input });
    const changed = Object.keys(data).some((key) => String(data[key]) !== String(current[key]));
    if (changed && (await periodUsage(tx, id)).pengajuan > 0) fail(409, 'PERIOD_HAS_APPLICATIONS', 'Periode dengan Pengajuan tidak boleh diubah.');
    if (current.status_periode === 'AKTIF') await assertNoOverlap(tx, data, id);
    return tx.periodeAkademik.update({ where: { id }, data });
  }); return getPeriod(prisma, row.id); } catch (error) { dbConflict(error); }
}

export async function setPeriodActive(prisma, id, active) {
  await scoped(prisma);
  const updated = await prisma.$transaction(async (tx) => {
    await lockPeriods(tx);
    const row = await tx.periodeAkademik.findUnique({ where: { id } });
    if (!row) fail(404, 'PERIOD_NOT_FOUND', 'Periode tidak ditemukan.');
    const status = active ? 'AKTIF' : 'NONAKTIF';
    if (row.status_periode === status) return row;
    if (active) {
      await assertNoOverlap(tx, row, id);
      const kpSchedules = await tx.jadwalProses.findMany({ where: {
        periode_akademik_id: id, jenis_proses: 'PENGAJUAN_REGULER', is_aktif: true,
        tahap_akademik: { kode_tahap: 'KP', is_aktif: true },
      }, select: { id: true, tahap_akademik_id: true } });
      for (const item of kpSchedules) {
        const other = await tx.jadwalProses.findFirst({ where: {
          id: { not: item.id }, jenis_proses: 'PENGAJUAN_REGULER', is_aktif: true,
          tahap_akademik: { kode_tahap: 'KP', is_aktif: true },
          periode_akademik: { status_periode: 'AKTIF' },
        }, select: { id: true } });
        if (other) fail(409, 'KP_REGULAR_AMBIGUOUS', 'Nonaktifkan jadwal KP Reguler lama sebelum mengaktifkan periode baru.');
      }
    }
    return tx.periodeAkademik.update({ where: { id }, data: { status_periode: status } });
  });
  return getPeriod(prisma, updated.id);
}

export function scheduleStatus(row, now = new Date()) {
  if (!row) return 'BELUM_DIKONFIGURASI';
  if (!row.is_aktif || row.periode_akademik.status_periode !== 'AKTIF' || !row.tahap_akademik.is_aktif) return 'NONAKTIF';
  if (now < row.tanggal_buka) return 'BELUM_DIBUKA';
  if (now > row.tanggal_tutup) return 'DITUTUP';
  return 'DIBUKA';
}

export async function getAvailability(prisma, tahapCode, processCode, now = new Date()) {
  const tahap = await prisma.tahapAkademik.findUnique({ where: { kode_tahap: tahapCode } });
  if (!tahap) fail(404, 'STAGE_NOT_FOUND', 'Tahap tidak ditemukan.');
  const rows = await prisma.jadwalProses.findMany({ where: {
    tahap_akademik_id: tahap.id, jenis_proses: processCode,
  }, include: scheduleInclude, orderBy: { tanggal_buka: 'asc' } });
  const open = rows.filter((row) => scheduleStatus(row, now) === 'DIBUKA');
  if (open.length > 1) fail(409, 'SCHEDULE_AMBIGUOUS', 'Lebih dari satu jadwal sedang dibuka.');
  const row = open[0] ?? rows.find((item) =>
    item.periode_akademik.status_periode === 'AKTIF' && item.tanggal_buka >= now) ??
    rows.find((item) => item.tanggal_buka <= now && item.tanggal_tutup >= now) ?? rows.at(-1) ?? null;
  const status_jadwal = scheduleStatus(row, now);
  const messages = {
    BELUM_DIKONFIGURASI: `Jadwal ${processCode} ${tahapCode} belum dikonfigurasi.`,
    NONAKTIF: `Jadwal ${processCode} ${tahapCode} belum aktif.`,
    BELUM_DIBUKA: `Jadwal ${processCode} ${tahapCode} belum dibuka.`,
    DIBUKA: `Jadwal ${processCode} ${tahapCode} sedang dibuka.`,
    DITUTUP: `Jadwal ${processCode} ${tahapCode} telah ditutup.`,
  };
  return { tahap: tahapCode, jenis_proses: processCode, status_jadwal,
    is_open: status_jadwal === 'DIBUKA', reason_code: status_jadwal === 'DIBUKA' ? null :
      status_jadwal === 'BELUM_DIKONFIGURASI' ? 'JADWAL_BELUM_DIKONFIGURASI' : `JADWAL_${status_jadwal}`,
    message: messages[status_jadwal], periode: row?.periode_akademik ?? null,
    tanggal_buka: wibTime(row?.tanggal_buka), tanggal_tutup: wibTime(row?.tanggal_tutup),
    zona_waktu: 'Asia/Jakarta' };
}

const scheduleInclude = { periode_akademik: { select: { id: true, tahun_ajaran: true, semester: true, status_periode: true } },
  tahap_akademik: { select: { kode_tahap: true, nama_tahap: true, is_aktif: true } } };
const presentSchedule = (row) => ({ ...row, tanggal_buka: wibTime(row.tanggal_buka),
  tanggal_tutup: wibTime(row.tanggal_tutup), zona_waktu: 'Asia/Jakarta',
  status_jadwal: scheduleStatus(row), is_open: scheduleStatus(row) === 'DIBUKA' });

export async function listSchedules(prisma, query) {
  await scoped(prisma);
  const where = { ...(query.periode ? { periode_akademik_id: query.periode } : {}),
    ...(query.tahap ? { tahap_akademik_id: query.tahap } : {}),
    ...(query.jenis_proses ? { jenis_proses: query.jenis_proses } : {}) };
  const rows = await prisma.jadwalProses.findMany({ where, include: scheduleInclude, orderBy: { tanggal_buka: 'desc' } });
  const filtered = rows.map(presentSchedule).filter((row) => !query.status || row.status_jadwal === query.status);
  return { data: filtered.slice((query.page - 1) * query.limit, query.page * query.limit),
    pagination: { page: query.page, limit: query.limit, total_items: filtered.length,
      total_pages: Math.ceil(filtered.length / query.limit) } };
}

export async function getSchedule(prisma, id) {
  await scoped(prisma);
  const row = await prisma.jadwalProses.findUnique({ where: { id }, include: scheduleInclude });
  if (!row) fail(404, 'SCHEDULE_NOT_FOUND', 'Jadwal tidak ditemukan.');
  return presentSchedule(row);
}

async function normalizeSchedule(tx, input) {
  const buka = timestamp(input.tanggal_buka);
  const tutup = timestamp(input.tanggal_tutup);
  if (!JENIS_PROSES.includes(input.jenis_proses) || !buka || !tutup || buka >= tutup ||
      !Number.isSafeInteger(input.periode_akademik_id) || !Number.isSafeInteger(input.tahap_akademik_id) ||
      typeof input.is_aktif !== 'boolean' || input.keterangan != null &&
      (typeof input.keterangan !== 'string' || input.keterangan.length > 2000)) {
    fail(400, 'VALIDATION_ERROR', 'Konfigurasi jadwal tidak valid.');
  }
  const [periode, tahap] = await Promise.all([
    tx.periodeAkademik.findUnique({ where: { id: input.periode_akademik_id } }),
    tx.tahapAkademik.findUnique({ where: { id: input.tahap_akademik_id } }),
  ]);
  if (!periode || !tahap) fail(404, 'CONFIGURATION_REFERENCE_NOT_FOUND', 'Periode atau tahap tidak ditemukan.');
  return { periode_akademik_id: periode.id, tahap_akademik_id: tahap.id,
    jenis_proses: input.jenis_proses, tanggal_buka: buka, tanggal_tutup: tutup,
    is_aktif: input.is_aktif, keterangan: input.keterangan ?? null };
}

export async function createSchedule(prisma, input, actorId) {
  await scoped(prisma);
  try { const row = await prisma.$transaction(async (tx) => {
    await lockPeriods(tx);
    const data = await normalizeSchedule(tx, input);
    await assertKpRegularUnambiguous(tx, data.periode_akademik_id, data.tahap_akademik_id,
      data.jenis_proses, data.is_aktif);
    return tx.jadwalProses.create({ data: { ...data, dibuat_oleh_user_id: actorId } });
  }); return getSchedule(prisma, row.id); } catch (error) { dbConflict(error); }
}

export async function updateSchedule(prisma, id, input) {
  await scoped(prisma);
  try { const row = await prisma.$transaction(async (tx) => {
    await lockPeriods(tx);
    const current = await tx.jadwalProses.findUnique({ where: { id } });
    if (!current) fail(404, 'SCHEDULE_NOT_FOUND', 'Jadwal tidak ditemukan.');
    const data = await normalizeSchedule(tx, { ...current,
      tanggal_buka: current.tanggal_buka.toISOString(), tanggal_tutup: current.tanggal_tutup.toISOString(), ...input });
    await assertKpRegularUnambiguous(tx, data.periode_akademik_id, data.tahap_akademik_id,
      data.jenis_proses, data.is_aktif, id);
    return tx.jadwalProses.update({ where: { id }, data });
  }); return getSchedule(prisma, row.id); } catch (error) { dbConflict(error); }
}

export async function setScheduleActive(prisma, id, active) {
  await scoped(prisma);
  const updated = await prisma.$transaction(async (tx) => {
    await lockPeriods(tx);
    const current = await tx.jadwalProses.findUnique({ where: { id } });
    if (!current) fail(404, 'SCHEDULE_NOT_FOUND', 'Jadwal tidak ditemukan.');
    await assertKpRegularUnambiguous(tx, current.periode_akademik_id, current.tahap_akademik_id,
      current.jenis_proses, active, id);
    return tx.jadwalProses.update({ where: { id }, data: { is_aktif: active } });
  });
  return getSchedule(prisma, updated.id);
}

export async function listStages(prisma) {
  await scoped(prisma);
  return prisma.tahapAkademik.findMany({ orderBy: { urutan: 'asc' } });
}

export async function getStage(prisma, id) {
  await scoped(prisma);
  const row = await prisma.tahapAkademik.findUnique({ where: { id } });
  if (!row) fail(404, 'STAGE_NOT_FOUND', 'Tahap tidak ditemukan.');
  return row;
}

export async function listDocumentTypes(prisma, query) {
  await scoped(prisma);
  const where = { kategori_dokumen: 'PENGAJUAN',
    ...(query.is_aktif === null ? {} : { is_aktif: query.is_aktif }),
    ...(query.search ? { OR: [{ kode_jenis: { contains: query.search, mode: 'insensitive' } },
      { nama_jenis: { contains: query.search, mode: 'insensitive' } }] } : {}) };
  const [data, total] = await prisma.$transaction([
    prisma.jenisDokumen.findMany({ where, orderBy: { kode_jenis: 'asc' },
      skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.jenisDokumen.count({ where }),
  ]);
  return { data, pagination: { page: query.page, limit: query.limit,
    total_items: total, total_pages: Math.ceil(total / query.limit) } };
}

const kpDocumentSizes = new Map([
  ['PROPOSAL_KP', 10], ['BUKTI_BAYAR_PROPOSAL_KP', 5],
  ['BUKTI_SPP_VARIABEL_KP', 5], ['SERTIFIKAT_SOSIALISASI_KP', 5],
  ['SURAT_PERNYATAAN_SOSIALISASI_KP', 5],
]);
const kpRequiredDocuments = new Set(['PROPOSAL_KP', 'BUKTI_BAYAR_PROPOSAL_KP']);
function assertKpDocumentPolicy(input) {
  const size = kpDocumentSizes.get(input.kode_jenis);
  if (size && (input.maks_ukuran_mb !== size ||
      input.format_diizinkan.length !== 1 || input.format_diizinkan[0] !== 'pdf')) {
    fail(409, 'KP_DOCUMENT_POLICY', 'Format dan batas ukuran dokumen KP mengikuti aturan resmi.');
  }
}

export async function createDocumentType(prisma, input) {
  await scoped(prisma);
  const kode_jenis = typeof input.kode_jenis === 'string' ? input.kode_jenis.trim() : '';
  const nama_jenis = typeof input.nama_jenis === 'string' ? input.nama_jenis.trim() : '';
  if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(kode_jenis) || !nama_jenis || nama_jenis.length > 150 ||
    !Array.isArray(input.format_diizinkan) || !input.format_diizinkan.length ||
    input.format_diizinkan.some((item) => typeof item !== 'string' || !/^[a-z0-9]{1,12}$/.test(item)) ||
    !Number.isInteger(input.maks_ukuran_mb) || input.maks_ukuran_mb < 1 || input.maks_ukuran_mb > 32767 ||
    input.deskripsi != null && (typeof input.deskripsi !== 'string' || input.deskripsi.length > 2000) ||
    input.is_aktif !== undefined && typeof input.is_aktif !== 'boolean') {
    fail(400, 'VALIDATION_ERROR', 'Jenis dokumen tidak valid.');
  }
  assertKpDocumentPolicy({ ...input, kode_jenis });
  try { return await prisma.jenisDokumen.create({ data: {
    kode_jenis, nama_jenis, kategori_dokumen: 'PENGAJUAN',
    format_diizinkan: input.format_diizinkan, maks_ukuran_mb: input.maks_ukuran_mb,
    deskripsi: input.deskripsi ?? null, is_aktif: input.is_aktif ?? true,
  } }); } catch (error) { dbConflict(error); }
}

export async function updateDocumentType(prisma, id, input) {
  await scoped(prisma);
  if (input.kode_jenis !== undefined && !/^[A-Z][A-Z0-9_]{1,49}$/.test(input.kode_jenis) ||
    input.nama_jenis !== undefined && (typeof input.nama_jenis !== 'string' || !input.nama_jenis.trim() || input.nama_jenis.length > 150) ||
    input.format_diizinkan !== undefined && (!Array.isArray(input.format_diizinkan) || !input.format_diizinkan.length ||
      input.format_diizinkan.some((item) => typeof item !== 'string' || !/^[a-z0-9]{1,12}$/.test(item))) ||
    input.maks_ukuran_mb !== undefined && (!Number.isInteger(input.maks_ukuran_mb) || input.maks_ukuran_mb < 1) ||
    input.deskripsi !== undefined && input.deskripsi !== null &&
      (typeof input.deskripsi !== 'string' || input.deskripsi.length > 2000) ||
    input.is_aktif !== undefined && typeof input.is_aktif !== 'boolean') fail(400, 'VALIDATION_ERROR', 'Jenis dokumen tidak valid.');
  try { return await prisma.$transaction(async (tx) => {
    const current = await tx.jenisDokumen.findFirst({ where: { id, kategori_dokumen: 'PENGAJUAN' } });
    if (!current) fail(404, 'DOCUMENT_TYPE_NOT_FOUND', 'Jenis dokumen tidak ditemukan.');
    if (kpDocumentSizes.has(current.kode_jenis) && input.kode_jenis !== undefined &&
      input.kode_jenis !== current.kode_jenis) fail(409, 'KP_DOCUMENT_POLICY', 'Kode dokumen KP resmi tidak boleh diganti.');
    const next = { ...current, ...input };
    assertKpDocumentPolicy(next);
    const substantive = ['kode_jenis', 'nama_jenis', 'format_diizinkan', 'maks_ukuran_mb', 'is_aktif'];
    if (substantive.some((key) => Object.hasOwn(input, key) && JSON.stringify(input[key]) !== JSON.stringify(current[key]))) {
      const rules = await tx.persyaratanPengajuan.findMany({ where: { jenis_dokumen_id: id },
        select: { id: true, periode_akademik_id: true, tahap_akademik_id: true,
          jenis_pengajuan: true, pilihan_topik: true } });
      for (const rule of rules) {
        const [applications, documents] = await Promise.all([
          tx.pengajuan.count({ where: { periode_akademik_id: rule.periode_akademik_id,
            tahap_akademik_id: rule.tahap_akademik_id, jenis_pengajuan: rule.jenis_pengajuan,
            pilihan_topik: rule.pilihan_topik } }),
          tx.dokumenPengajuan.count({ where: { persyaratan_pengajuan_id: rule.id } }),
        ]);
        if (applications || documents) fail(409, 'DOCUMENT_TYPE_IN_USE', 'Jenis dokumen yang sudah digunakan tidak boleh diubah secara substansial.');
      }
    }
    return tx.jenisDokumen.update({ where: { id }, data: input });
  }); } catch (error) { dbConflict(error); }
}

export async function listRequirements(prisma, query) {
  await scoped(prisma);
  const where = {
    ...(query.periode ? { periode_akademik_id: query.periode } : {}),
    ...(query.tahap ? { tahap_akademik_id: query.tahap } : {}),
    ...(query.jenis_pengajuan ? { jenis_pengajuan: query.jenis_pengajuan } : {}),
    ...(query.pilihan_topik ? { pilihan_topik: query.pilihan_topik } : {}),
    ...(query.jenis_dokumen ? { jenis_dokumen_id: query.jenis_dokumen } : {}),
    ...(query.is_aktif === null ? {} : { is_aktif: query.is_aktif }),
    jenis_dokumen: { kategori_dokumen: 'PENGAJUAN' },
  };
  const [data, total] = await prisma.$transaction([
    prisma.persyaratanPengajuan.findMany({ where, include: { jenis_dokumen: true },
      orderBy: [{ urutan_tampil: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.persyaratanPengajuan.count({ where }),
  ]);
  return { data, pagination: { page: query.page, limit: query.limit,
    total_items: total, total_pages: Math.ceil(total / query.limit) } };
}

export async function createRequirement(prisma, input) {
  await scoped(prisma);
  if (!Number.isSafeInteger(input.periode_akademik_id) || !Number.isSafeInteger(input.tahap_akademik_id) ||
    !Number.isSafeInteger(input.jenis_dokumen_id) || !['REGULER'].includes(input.jenis_pengajuan) ||
    !['BARU', 'LANJUT'].includes(input.pilihan_topik) || typeof input.is_wajib !== 'boolean' ||
    typeof input.boleh_gunakan_dokumen_sebelumnya !== 'boolean' ||
    !Number.isInteger(input.urutan_tampil) || input.urutan_tampil < 1 || input.urutan_tampil > 32767 ||
    input.is_aktif !== undefined && typeof input.is_aktif !== 'boolean') fail(400, 'VALIDATION_ERROR', 'Persyaratan tidak valid.');
  const [periode, tahap, jenis] = await Promise.all([
    prisma.periodeAkademik.findUnique({ where: { id: input.periode_akademik_id } }),
    prisma.tahapAkademik.findUnique({ where: { id: input.tahap_akademik_id } }),
    prisma.jenisDokumen.findFirst({ where: { id: input.jenis_dokumen_id, kategori_dokumen: 'PENGAJUAN' } }),
  ]);
  if (!periode || !tahap || !jenis) fail(404, 'CONFIGURATION_REFERENCE_NOT_FOUND', 'Referensi persyaratan tidak ditemukan.');
  const approvedKpCodes = new Set(['BUKTI_BAYAR_PROPOSAL_KP', 'PROPOSAL_KP',
    'BUKTI_SPP_VARIABEL_KP', 'SERTIFIKAT_SOSIALISASI_KP', 'SURAT_PERNYATAAN_SOSIALISASI_KP']);
  if (tahap.kode_tahap !== 'KP' || input.pilihan_topik !== 'BARU' || !approvedKpCodes.has(jenis.kode_jenis) ||
    input.is_wajib !== kpRequiredDocuments.has(jenis.kode_jenis) ||
    input.boleh_gunakan_dokumen_sebelumnya || input.is_aktif === false) {
    fail(409, 'RULE_NOT_APPROVED', 'Persyaratan tahap atau jalur ini belum disetujui.');
  }
  const used = await prisma.pengajuan.count({ where: { periode_akademik_id: input.periode_akademik_id,
    tahap_akademik_id: input.tahap_akademik_id, jenis_pengajuan: input.jenis_pengajuan,
    pilihan_topik: input.pilihan_topik } });
  if (used) fail(409, 'REQUIREMENT_PERIOD_IN_USE', 'Persyaratan periode yang sudah memiliki Pengajuan tidak boleh ditambah.');
  try { return await prisma.persyaratanPengajuan.create({ data: { ...input, is_aktif: input.is_aktif ?? true } }); }
  catch (error) { dbConflict(error); }
}

export async function updateRequirement(prisma, id, input) {
  await scoped(prisma);
  return prisma.$transaction(async (tx) => {
    const current = await tx.persyaratanPengajuan.findUnique({ where: { id },
      include: { jenis_dokumen: true, tahap_akademik: true } });
    if (!current || current.jenis_dokumen.kategori_dokumen !== 'PENGAJUAN') fail(404, 'REQUIREMENT_NOT_FOUND', 'Persyaratan tidak ditemukan.');
    const allowed = ['is_wajib', 'boleh_gunakan_dokumen_sebelumnya', 'petunjuk', 'urutan_tampil', 'is_aktif'];
    if (Object.keys(input).some((key) => !allowed.includes(key)) ||
      input.petunjuk !== undefined && input.petunjuk !== null &&
        (typeof input.petunjuk !== 'string' || input.petunjuk.length > 2000) ||
      ['is_wajib', 'boleh_gunakan_dokumen_sebelumnya', 'is_aktif'].some((key) =>
        input[key] !== undefined && typeof input[key] !== 'boolean') ||
      input.urutan_tampil !== undefined && (!Number.isInteger(input.urutan_tampil) ||
        input.urutan_tampil < 1 || input.urutan_tampil > 32767)) {
      fail(400, 'VALIDATION_ERROR', 'Perubahan persyaratan tidak valid.');
    }
    const substantive = allowed.filter((key) => key !== 'petunjuk');
    const changed = substantive.some((key) => Object.hasOwn(input, key) && input[key] !== current[key]);
    if (changed) {
      if (current.tahap_akademik.kode_tahap === 'KP' && current.jenis_pengajuan === 'REGULER' &&
        current.pilihan_topik === 'BARU' && kpDocumentSizes.has(current.jenis_dokumen.kode_jenis) &&
        (input.is_wajib !== undefined && input.is_wajib !== kpRequiredDocuments.has(current.jenis_dokumen.kode_jenis) ||
          input.boleh_gunakan_dokumen_sebelumnya === true || input.is_aktif === false)) {
        fail(409, 'KP_DOCUMENT_POLICY', 'Aturan lima dokumen KP tidak boleh diubah.');
      }
      const [applications, documents] = await Promise.all([
        tx.pengajuan.count({ where: { periode_akademik_id: current.periode_akademik_id,
          tahap_akademik_id: current.tahap_akademik_id, jenis_pengajuan: current.jenis_pengajuan,
          pilihan_topik: current.pilihan_topik } }),
        tx.dokumenPengajuan.count({ where: { persyaratan_pengajuan_id: id } }),
      ]);
      if (applications || documents) fail(409, 'REQUIREMENT_LOCKED', 'Persyaratan yang sudah dipakai Pengajuan tidak boleh diubah.');
    }
    return tx.persyaratanPengajuan.update({ where: { id }, data: input });
  });
}
