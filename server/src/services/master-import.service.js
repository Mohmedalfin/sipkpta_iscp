import { randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { authorizedProdiId as mahasiswaProdi, createMahasiswa } from './mahasiswa.service.js';
import { authorizedProdiId as dosenProdi, createDosen } from './dosen.service.js';

const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_JOBS = 25;
const jobs = new Map();
const FORMAT = {
  mahasiswa: {
    required: ['nim', 'nama', 'tanggal_lahir', 'email', 'angkatan'],
    optional: ['nik_kependudukan', 'tempat_lahir', 'no_telepon', 'alamat'],
    identity: 'nim',
  },
  dosen: {
    required: ['kode_dosen', 'nidn', 'nama', 'tanggal_lahir', 'email'],
    optional: ['no_telepon', 'jabatan_fungsional', 'is_homebase_si'],
    identity: 'kode_dosen',
  },
};

export class MasterImportError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function configuredLimit(name, fallback, maximum) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 && value <= maximum ? value : fallback;
}

export const IMPORT_MAX_BYTES = configuredLimit('CSV_IMPORT_MAX_BYTES', 5 * 1024 * 1024, 20 * 1024 * 1024);
export const IMPORT_MAX_ROWS = configuredLimit('CSV_IMPORT_MAX_ROWS', 1000, 10000);

function pruneJobs() {
  for (const [id, job] of jobs) {
    if (job.expiresAt <= Date.now() && job.state !== 'processing') jobs.delete(id);
  }
}

export function parseCsv(buffer, kind) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  const separatorHint = /^sep=([,;])(?:\r\n|\n|\r)/i.exec(text);
  const content = separatorHint ? text.slice(separatorHint[0].length) : text;
  const delimiters = separatorHint ? [separatorHint[1]] : [',', ';'];
  const format = FORMAT[kind];
  const allowed = new Set([...format.required, ...format.optional]);
  let records;
  let headers;
  let parsedWithWrongHeader = false;
  for (const delimiter of delimiters) {
    let candidate;
    try {
      candidate = parse(content, { delimiter, skip_empty_lines: true,
        info: true, raw: true, relax_column_count: false });
    } catch {
      continue;
    }
    if (!candidate.length) continue;
    const candidateHeaders = candidate[0].record.map((value) => value.trim());
    if (candidateHeaders.some((header) => !allowed.has(header)) ||
        new Set(candidateHeaders).size !== candidateHeaders.length ||
        format.required.some((header) => !candidateHeaders.includes(header))) {
      parsedWithWrongHeader = true;
      continue;
    }
    records = candidate;
    headers = candidateHeaders;
    break;
  }
  if (!records && parsedWithWrongHeader) {
    throw new MasterImportError(400, 'INVALID_CSV_HEADER', 'Header CSV tidak sesuai template.');
  }
  if (!records) throw new MasterImportError(400, 'INVALID_CSV', 'Struktur CSV tidak valid atau header tidak tersedia.');
  if (records.length - 1 > IMPORT_MAX_ROWS) {
    throw new MasterImportError(400, 'CSV_ROW_LIMIT', 'Jumlah baris CSV melebihi batas.');
  }
  if (records.length === 1) {
    throw new MasterImportError(400, 'INVALID_CSV', 'CSV tidak berisi data.');
  }
  const rows = records.slice(1).map(({ record, info, raw }) => {
    if (record.length !== headers.length) {
      throw new MasterImportError(400, 'INVALID_CSV', 'Jumlah kolom CSV tidak konsisten.');
    }
    if (record.some((value) => value.length > 32767)) {
      throw new MasterImportError(400, 'INVALID_CSV', 'Nilai CSV terlalu panjang untuk laporan Excel.');
    }
    const content = raw.replace(/\r\n$|\r$|\n$/, '');
    const internalLineBreaks = (content.match(/\r\n|\r|\n/g) ?? []).length;
    return {
      row: info.lines - internalLineBreaks + (separatorHint ? 1 : 0),
      values: Object.fromEntries(headers.map((header, index) => [header, record[index].trim()])),
    };
  });
  return { headers, rows };
}

function dateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addError(errors, row, field, message) {
  errors.push({ row, field, message });
}

function mapInput(kind, row, prodiId, validate, errors) {
  const value = row.values;
  const format = FORMAT[kind];
  for (const field of format.required) {
    if (!value[field]) addError(errors, row.row, field, `${field} wajib diisi`);
  }
  if (kind === 'mahasiswa' && value.nim && !/^\d{8,25}$/.test(value.nim)) {
    addError(errors, row.row, 'nim', 'NIM harus 8–25 digit');
  }
  if (kind === 'dosen' && value.kode_dosen && !/^[A-Za-z0-9._-]{3,25}$/.test(value.kode_dosen)) {
    addError(errors, row.row, 'kode_dosen', 'Kode dosen tidak valid');
  }
  if (kind === 'dosen' && value.nidn && !/^\d{1,20}$/.test(value.nidn)) {
    addError(errors, row.row, 'nidn', 'NIDN harus 1–20 digit');
  }
  if (value.nama && value.nama.length > 150) addError(errors, row.row, 'nama', 'Nama terlalu panjang');
  if (value.tanggal_lahir && !dateOnly(value.tanggal_lahir)) {
    addError(errors, row.row, 'tanggal_lahir', 'Tanggal lahir harus YYYY-MM-DD dan valid');
  }
  if (value.email && (value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) {
    addError(errors, row.row, 'email', 'Email tidak valid');
  }
  if (kind === 'mahasiswa' && value.nik_kependudukan && !/^\d{16}$/.test(value.nik_kependudukan)) {
    addError(errors, row.row, 'nik_kependudukan', 'NIK harus 16 digit');
  }
  for (const [field, maximum] of [
    ['no_telepon', 20],
    ...(kind === 'mahasiswa' ? [['tempat_lahir', 100], ['alamat', 5000]] : [['jabatan_fungsional', 100]]),
  ]) {
    if (value[field] && value[field].length > maximum) {
      addError(errors, row.row, field, `${field} terlalu panjang`);
    }
  }
  if (kind === 'mahasiswa' && value.angkatan &&
      (!/^\d{4}$/.test(value.angkatan) || Number(value.angkatan) < 1900 ||
       Number(value.angkatan) > new Date().getUTCFullYear() + 1)) {
    addError(errors, row.row, 'angkatan', 'Angkatan tidak valid');
  }
  if (kind === 'dosen' && value.is_homebase_si &&
      !['true', 'false'].includes(value.is_homebase_si.toLowerCase())) {
    addError(errors, row.row, 'is_homebase_si', 'Gunakan true atau false');
  }
  const input = kind === 'mahasiswa' ? {
    program_studi_id: prodiId, nim: value.nim, nama_lengkap: value.nama,
    tanggal_lahir: value.tanggal_lahir, email: value.email,
    tahun_angkatan: Number(value.angkatan),
    ...(value.nik_kependudukan ? { nik_kependudukan: value.nik_kependudukan } : {}),
    ...(value.tempat_lahir ? { tempat_lahir: value.tempat_lahir } : {}),
    ...(value.no_telepon ? { no_telepon: value.no_telepon } : {}),
    ...(value.alamat ? { alamat: value.alamat } : {}),
  } : {
    program_studi_id: prodiId, kode_dosen: value.kode_dosen, nidn: value.nidn,
    nama_lengkap: value.nama, tanggal_lahir: value.tanggal_lahir, email: value.email,
    ...(value.no_telepon ? { no_telepon: value.no_telepon } : {}),
    ...(value.jabatan_fungsional ? { jabatan_fungsional: value.jabatan_fungsional } : {}),
    ...(value.is_homebase_si ? { is_homebase_si: value.is_homebase_si.toLowerCase() === 'true' } : {}),
  };
  const parsed = validate(input, true);
  if (!parsed && !errors.some((error) => error.row === row.row)) {
    addError(errors, row.row, null, 'Data baris tidak sesuai aturan Master');
  }
  return parsed;
}

async function prodiIdFor(prisma, kind) {
  return kind === 'mahasiswa' ? mahasiswaProdi(prisma) : dosenProdi(prisma);
}

async function analyze(prisma, kind, rows, prodiId, validate) {
  const errors = [];
  const inputs = new Map();
  const seen = { identity: new Set(), email: new Set(), nidn: new Set(), nik: new Set() };
  for (const row of rows) {
    const input = mapInput(kind, row, prodiId, validate, errors);
    if (input) inputs.set(row.row, input);
    const identity = row.values[FORMAT[kind].identity];
    const email = row.values.email?.toLowerCase();
    const nidn = kind === 'dosen' ? row.values.nidn : null;
    const nik = kind === 'mahasiswa' ? row.values.nik_kependudukan : null;
    for (const [field, value, key] of [
      [FORMAT[kind].identity, identity, 'identity'], ['email', email, 'email'], ['nidn', nidn, 'nidn'],
      ['nik_kependudukan', nik, 'nik'],
    ]) {
      if (!value) continue;
      if (seen[key].has(value)) addError(errors, row.row, field, `${field} duplikat dalam CSV`);
      else seen[key].add(value);
    }
  }
  const loginIds = rows.map((row) => row.values[FORMAT[kind].identity]).filter(Boolean);
  const emails = rows.map((row) => row.values.email?.toLowerCase()).filter(Boolean);
  const existingUsers = await prisma.user.findMany({
    where: { OR: [{ login_id: { in: loginIds } }, { email: { in: emails, mode: 'insensitive' } }] },
    select: { login_id: true, email: true },
  });
  const existingLogins = new Set(existingUsers.map((user) => user.login_id));
  const existingEmails = new Set(existingUsers.map((user) => user.email.toLowerCase()));
  const existingNidn = kind === 'dosen' ? new Set((await prisma.dosen.findMany({
    where: { nidn: { in: rows.map((row) => row.values.nidn).filter(Boolean) } },
    select: { nidn: true },
  })).map((dosen) => dosen.nidn)) : new Set();
  const existingProfiles = kind === 'mahasiswa' ? await prisma.mahasiswa.findMany({
    where: { OR: [
      { nim: { in: loginIds } },
      { nik_kependudukan: { in: rows.map((row) => row.values.nik_kependudukan).filter(Boolean) } },
    ] },
    select: { nim: true, nik_kependudukan: true },
  }) : await prisma.dosen.findMany({
    where: { kode_dosen: { in: loginIds } }, select: { kode_dosen: true },
  });
  const existingProfileLogins = new Set(existingProfiles.map((profile) =>
    kind === 'mahasiswa' ? profile.nim : profile.kode_dosen));
  const existingNik = new Set(kind === 'mahasiswa' ? existingProfiles.map((profile) => profile.nik_kependudukan) : []);
  for (const row of rows) {
    if (existingLogins.has(row.values[FORMAT[kind].identity])) {
      addError(errors, row.row, FORMAT[kind].identity, 'Identitas login sudah terdaftar');
    }
    if (existingEmails.has(row.values.email?.toLowerCase())) {
      addError(errors, row.row, 'email', 'Email sudah terdaftar');
    }
    if (existingProfileLogins.has(row.values[FORMAT[kind].identity])) {
      addError(errors, row.row, FORMAT[kind].identity, 'Profil sudah terdaftar');
    }
    if (kind === 'mahasiswa' && row.values.nik_kependudukan &&
        existingNik.has(row.values.nik_kependudukan)) {
      addError(errors, row.row, 'nik_kependudukan', 'NIK sudah terdaftar');
    }
    if (kind === 'dosen' && existingNidn.has(row.values.nidn)) {
      addError(errors, row.row, 'nidn', 'NIDN sudah terdaftar');
    }
  }
  return { errors, inputs };
}

function summary(job) {
  const invalid = new Set(job.errors.map((error) => error.row)).size;
  return {
    previewId: job.id, total: job.rows.length, valid: job.rows.length - invalid,
    invalid, errors: job.errors,
    reportUrl: `/api/master/${job.kind}/import/${job.id}/errors.xlsx`,
  };
}

export async function previewImport(prisma, kind, actorUserId, file, validate) {
  pruneJobs();
  if (!FORMAT[kind] || !file || !/\.csv$/i.test(file.originalname) ||
      file.size === 0 || file.size > IMPORT_MAX_BYTES) {
    throw new MasterImportError(400, 'INVALID_CSV', 'File CSV tidak valid atau melebihi batas.');
  }
  if (jobs.size >= MAX_JOBS) {
    throw new MasterImportError(429, 'IMPORT_CAPACITY', 'Terlalu banyak preview aktif. Coba lagi nanti.');
  }
  const prodiId = await prodiIdFor(prisma, kind);
  let parsed;
  try {
    parsed = parseCsv(file.buffer, kind);
  } catch (error) {
    if (error instanceof MasterImportError) throw error;
    throw new MasterImportError(400, 'INVALID_CSV', 'File harus UTF-8 dan berformat CSV valid.');
  }
  const result = await analyze(prisma, kind, parsed.rows, prodiId, validate);
  const job = {
    id: randomUUID(), kind, actorUserId, prodiId, ...parsed,
    errors: result.errors, state: 'preview', expiresAt: Date.now() + JOB_TTL_MS,
  };
  jobs.set(job.id, job);
  const timer = setTimeout(() => {
    if (jobs.get(job.id) === job && job.state !== 'processing') jobs.delete(job.id);
  }, JOB_TTL_MS);
  timer.unref?.();
  return summary(job);
}

async function ownedJob(prisma, kind, actorUserId, id) {
  pruneJobs();
  const prodiId = await prodiIdFor(prisma, kind);
  const job = jobs.get(id);
  if (!job || job.kind !== kind || job.actorUserId !== actorUserId || job.prodiId !== prodiId) {
    throw new MasterImportError(404, 'IMPORT_NOT_FOUND', 'Preview impor tidak ditemukan atau kedaluwarsa.');
  }
  return job;
}

export async function confirmImport(prisma, kind, actorUserId, id, validate) {
  const job = await ownedJob(prisma, kind, actorUserId, id);
  if (job.state === 'done') return job.result;
  if (job.state !== 'preview') {
    throw new MasterImportError(409, 'IMPORT_IN_PROGRESS', 'Impor sedang diproses.');
  }
  job.state = 'processing';
  const errors = [];
  let imported = 0;
  try {
    const current = await analyze(prisma, kind, job.rows, job.prodiId, validate);
    errors.push(...current.errors);
    const invalidRows = new Set(errors.map((error) => error.row));
    for (const row of job.rows) {
      if (invalidRows.has(row.row)) continue;
      try {
        const input = current.inputs.get(row.row);
        if (kind === 'mahasiswa') await createMahasiswa(prisma, actorUserId, input);
        else await createDosen(prisma, input);
        imported++;
      } catch (error) {
        addError(errors, row.row, null, error.status === 409 ? 'Data sudah terdaftar saat impor' : 'Gagal menyimpan baris');
      }
    }
    job.errors = errors;
    const failed = new Set(errors.map((error) => error.row)).size;
    job.result = {
      previewId: job.id, total: job.rows.length, imported, failed, errors,
      reportUrl: `/api/master/${kind}/import/${job.id}/errors.xlsx`,
    };
    job.state = 'done';
    try {
      await prisma.auditLog.create({
        data: {
          aktor_user_id: actorUserId, aksi: 'IMPORT_MASTER_CSV',
          entitas: kind === 'mahasiswa' ? 'Mahasiswa' : 'Dosen',
          data_sesudah: { total: job.rows.length, imported, failed },
        },
      });
    } catch {
      // Impor per baris telah commit. Jangan membuat client mengulang seluruh job
      // hanya karena pencatatan audit gagal; tandai kegagalan secara eksplisit.
      job.result.auditRecorded = false;
    }
    return job.result;
  } catch (error) {
    if (job.state === 'processing') job.state = 'preview';
    throw error;
  }
}

export async function errorWorkbook(prisma, kind, actorUserId, id) {
  const job = await ownedJob(prisma, kind, actorUserId, id);
  if (job.state === 'processing') {
    throw new MasterImportError(409, 'IMPORT_IN_PROGRESS', 'Impor sedang diproses.');
  }
  const failedRows = new Set(job.errors.map((error) => error.row));
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data Bermasalah');
  const headers = [...job.headers, 'Nomor Baris CSV', 'Status', 'Catatan Kesalahan'];
  sheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(18, header.length + 3) }));
  sheet.getRow(1).font = { bold: true };
  for (const row of job.rows) {
    if (!failedRows.has(row.row)) continue;
    const notes = job.errors.filter((error) => error.row === row.row).map((error) => error.message);
    const excelRow = sheet.addRow([
      ...job.headers.map((header) => row.values[header]), row.row, 'GAGAL', notes.join('; '),
    ]);
    excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    excelRow.eachCell((cell, column) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      if (column <= job.headers.length) cell.numFmt = '@';
    });
  }
  return workbook.xlsx.writeBuffer();
}
