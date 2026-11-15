import { authorizedProdiId } from './mahasiswa.service.js';

export class KurikulumError extends Error {
  constructor(status, code, message) {
    super(message);
    Object.assign(this, { status, code });
  }
}

function invalid(message = 'Data kurikulum tidak valid.') {
  throw new KurikulumError(400, 'VALIDATION_ERROR', message);
}

function normalize(input, creating = false) {
  const data = {};
  if (creating || Object.hasOwn(input, 'kode_kurikulum')) {
    if (typeof input.kode_kurikulum !== 'string' ||
      !/^[A-Z0-9][A-Z0-9_-]{1,49}$/.test(input.kode_kurikulum.trim())) invalid('Kode kurikulum tidak valid.');
    data.kode_kurikulum = input.kode_kurikulum.trim();
  }
  if (creating || Object.hasOwn(input, 'nama_kurikulum')) {
    if (typeof input.nama_kurikulum !== 'string' || !input.nama_kurikulum.trim() ||
      input.nama_kurikulum.trim().length > 150) invalid('Nama kurikulum tidak valid.');
    data.nama_kurikulum = input.nama_kurikulum.trim();
  }
  if (creating || Object.hasOwn(input, 'tahun_mulai_berlaku')) {
    if (!Number.isInteger(input.tahun_mulai_berlaku) || input.tahun_mulai_berlaku < 1900 ||
      input.tahun_mulai_berlaku > 9999) invalid('Tahun mulai berlaku tidak valid.');
    data.tahun_mulai_berlaku = input.tahun_mulai_berlaku;
  }
  if (Object.hasOwn(input, 'keterangan')) {
    if (input.keterangan !== null && (typeof input.keterangan !== 'string' ||
      input.keterangan.length > 2000)) invalid('Keterangan tidak valid.');
    data.keterangan = input.keterangan;
  }
  if (Object.hasOwn(input, 'is_aktif')) {
    if (typeof input.is_aktif !== 'boolean') invalid('Status kurikulum tidak valid.');
    data.is_aktif = input.is_aktif;
  }
  return data;
}

function handleConflict(error) {
  if (error?.code === 'P2002') {
    throw new KurikulumError(409, 'KURIKULUM_DUPLICATE', 'Kode kurikulum sudah digunakan pada Prodi ini.');
  }
  throw error;
}

export async function listKurikulum(prisma, query) {
  const prodiId = await authorizedProdiId(prisma);
  const where = { program_studi_id: prodiId,
    ...(query.is_aktif === null ? {} : { is_aktif: query.is_aktif }),
    ...(query.search ? { OR: [
      { kode_kurikulum: { contains: query.search, mode: 'insensitive' } },
      { nama_kurikulum: { contains: query.search, mode: 'insensitive' } },
    ] } : {}) };
  const [data, total] = await prisma.$transaction([
    prisma.kurikulum.findMany({ where, orderBy: [{ tahun_mulai_berlaku: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.kurikulum.count({ where }),
  ]);
  return { data, pagination: { page: query.page, limit: query.limit,
    total_items: total, total_pages: Math.ceil(total / query.limit) } };
}

export async function getKurikulum(prisma, id) {
  const prodiId = await authorizedProdiId(prisma);
  const row = await prisma.kurikulum.findFirst({ where: { id, program_studi_id: prodiId } });
  if (!row) throw new KurikulumError(404, 'KURIKULUM_NOT_FOUND', 'Kurikulum tidak ditemukan.');
  return row;
}

export async function createKurikulum(prisma, input) {
  const prodiId = await authorizedProdiId(prisma);
  const data = normalize(input, true);
  try { return await prisma.kurikulum.create({ data: { ...data, program_studi_id: prodiId } }); }
  catch (error) { handleConflict(error); }
}

export async function updateKurikulum(prisma, id, input) {
  const prodiId = await authorizedProdiId(prisma);
  const data = normalize(input);
  const row = await prisma.kurikulum.findFirst({ where: { id, program_studi_id: prodiId }, select: { id: true } });
  if (!row) throw new KurikulumError(404, 'KURIKULUM_NOT_FOUND', 'Kurikulum tidak ditemukan.');
  try { return await prisma.kurikulum.update({ where: { id }, data }); }
  catch (error) { handleConflict(error); }
}
