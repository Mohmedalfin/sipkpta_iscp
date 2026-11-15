import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { mkdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  isSupabaseStorageConfigured,
  uploadDocument as uploadToStorage,
  downloadDocument as downloadFromStorage,
  deleteDocument as deleteFromStorage,
} from './storage.service.js';

export const REQUIRED_DOCUMENT_CODES = ['IJAZAH', 'KK', 'KTP', 'AKTA', 'KTM', 'FORM_DATA_DIRI'];
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

export class DataDiriError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function privateStorageRoot() {
  const root = resolve(process.env.SIPKITA_PRIVATE_STORAGE_DIR || join(homedir(), '.sipkita', 'private-documents'));
  const pathFromRepository = relative(REPOSITORY_ROOT, root);
  if (!pathFromRepository || pathFromRepository === '..' ||
      (!pathFromRepository.startsWith(`..${sep}`) && !isAbsolute(pathFromRepository))) {
    throw new DataDiriError(500, 'STORAGE_UNAVAILABLE', 'Penyimpanan dokumen tidak tersedia.');
  }
  return root;
}

async function storagePath(storageKey, createDirectory = false) {
  const match = /^(data-diri|pengajuan|bimbingan)\/([0-9a-f-]{36}\.pdf)$/.exec(storageKey);
  if (!match) {
    throw new DataDiriError(500, 'STORAGE_UNAVAILABLE', 'Penyimpanan dokumen tidak tersedia.');
  }
  const root = privateStorageRoot();
  const namespace = match[1];
  if (createDirectory) await mkdir(join(root, namespace), { recursive: true, mode: 0o700 });
  const actualDirectory = await realpath(join(root, namespace));
  const pathFromRepository = relative(REPOSITORY_ROOT, actualDirectory);
  if (!pathFromRepository || pathFromRepository === '..' ||
      (!pathFromRepository.startsWith(`..${sep}`) && !isAbsolute(pathFromRepository))) {
    throw new DataDiriError(500, 'STORAGE_UNAVAILABLE', 'Penyimpanan dokumen tidak tersedia.');
  }
  return join(actualDirectory, match[2]);
}

async function ownProfile(prisma, userId) {
  const profile = await prisma.mahasiswa.findUnique({
    where: { user_id: userId },
    select: {
      id: true, user_id: true, nim: true, nama_lengkap: true, tanggal_lahir: true,
      no_telepon: true, alamat: true, tahun_angkatan: true, status_data: true,
      program_studi: { select: { id: true, kode_prodi: true, nama_prodi: true } },
      user: { select: { email: true, status_akun: true } },
    },
  });
  if (!profile || profile.user.status_akun !== 'AKTIF' || profile.status_data !== 'AKTIF') {
    throw new DataDiriError(404, 'PROFILE_NOT_FOUND', 'Profil mahasiswa tidak tersedia.');
  }
  return profile;
}

export async function requiredDocumentTypes(prisma) {
  const types = await prisma.jenisDokumen.findMany({
    where: { kode_jenis: { in: REQUIRED_DOCUMENT_CODES }, kategori_dokumen: 'DATA_DIRI', is_aktif: true },
    select: { id: true, kode_jenis: true, nama_jenis: true, format_diizinkan: true, maks_ukuran_mb: true },
  });
  if (types.length !== REQUIRED_DOCUMENT_CODES.length) {
    throw new DataDiriError(409, 'DOCUMENT_TYPES_UNAVAILABLE', 'Jenis dokumen data diri belum lengkap.');
  }
  return REQUIRED_DOCUMENT_CODES.map((code) => types.find((type) => type.kode_jenis === code));
}

function selectedType(types, code) {
  const type = types.find((item) => item.kode_jenis === code);
  if (!type) throw new DataDiriError(404, 'DOCUMENT_TYPE_NOT_FOUND', 'Jenis dokumen tidak ditemukan.');
  return type;
}

function publicProfile(profile) {
  return {
    id: profile.id, nim: profile.nim, nama_lengkap: profile.nama_lengkap,
    tanggal_lahir: profile.tanggal_lahir.toISOString().slice(0, 10),
    email: profile.user.email, no_telepon: profile.no_telepon, alamat: profile.alamat,
    tahun_angkatan: profile.tahun_angkatan, status_data: profile.status_data,
    program_studi: profile.program_studi,
  };
}

export async function getDataDiri(prisma, userId) {
  const profile = await ownProfile(prisma, userId);
  const types = await requiredDocumentTypes(prisma);
  const verification = await prisma.verifikasiDataDiri.findUnique({
    where: { mahasiswa_id: profile.id },
    select: {
      status_verifikasi: true,
      dokumen_data_diri: {
        where: { is_terkini: true },
        select: { jenis_dokumen_id: true, versi: true, status_dokumen: true, catatan_admin: true },
      },
    },
  });
  const documents = types.map((type) => {
    const current = verification?.dokumen_data_diri.find((item) => item.jenis_dokumen_id === type.id);
    return {
      kode_jenis: type.kode_jenis, nama_jenis: type.nama_jenis,
      is_uploaded: Boolean(current), versi_terkini: current?.versi ?? null,
      status_dokumen: current?.status_dokumen ?? null, catatan_admin: current?.catatan_admin ?? null,
    };
  });
  const uploaded = documents.filter((item) => item.is_uploaded).length;
  return {
    profil: publicProfile(profile), dokumen: documents,
    kelengkapan: {
      jumlah_wajib: REQUIRED_DOCUMENT_CODES.length, jumlah_terunggah: uploaded,
      lengkap: uploaded === REQUIRED_DOCUMENT_CODES.length,
      sudah_diverifikasi: verification?.status_verifikasi === 'TERVERIFIKASI',
    },
  };
}

export async function updateOwnProfile(prisma, userId, input) {
  const profile = await ownProfile(prisma, userId);
  const updated = await prisma.mahasiswa.update({
    where: { id: profile.id }, data: input,
    select: { no_telepon: true, alamat: true },
  });
  return updated;
}

export async function validatePdfDocument(file, type, absoluteMaxBytes = MAX_PDF_BYTES) {
  const name = basename(file?.originalname || '');
  if (!file || !/\.pdf$/i.test(name) || name.length > 255 || /[\x00-\x1f\x7f]/.test(name) ||
      file.mimetype !== 'application/pdf' || !Buffer.isBuffer(file.buffer) ||
      file.buffer.length === 0 || file.buffer.length > absoluteMaxBytes ||
      (type.maks_ukuran_mb !== null &&
        (!Number.isInteger(type.maks_ukuran_mb) || type.maks_ukuran_mb < 1 ||
          file.buffer.length > type.maks_ukuran_mb * 1024 * 1024)) ||
      (type.format_diizinkan.length > 0 && !type.format_diizinkan.some((format) =>
        ['PDF', '.PDF', 'APPLICATION/PDF'].includes(format.toUpperCase())))) {
    throw new DataDiriError(400, 'INVALID_DOCUMENT', 'Berkas PDF tidak valid atau melebihi batas.');
  }
  const content = file.buffer.toString('latin1');
  const trailer = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(content.slice(-2048));
  const xrefOffset = trailer ? Number(trailer[1]) : -1;
  if (!/^%PDF-(?:1\.[0-7]|2\.0)\r?\n/.test(content.slice(0, 16)) ||
      !Number.isSafeInteger(xrefOffset) || xrefOffset < 8 || xrefOffset >= file.buffer.length ||
      !/^(?:xref\b|\d+\s+\d+\s+obj\b)/.test(content.slice(xrefOffset, xrefOffset + 32))) {
    throw new DataDiriError(400, 'INVALID_DOCUMENT', 'Isi berkas bukan PDF yang valid.');
  }
  const loadingTask = getDocument({
    data: new Uint8Array(file.buffer), stopAtErrors: true, useSystemFonts: false,
    disableFontFace: true, verbosity: 0,
  });
  let document;
  try {
    document = await loadingTask.promise;
    if (document.numPages < 1) throw new Error('PDF tanpa halaman.');
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      await page.getOperatorList();
    }
  } catch {
    throw new DataDiriError(400, 'INVALID_DOCUMENT', 'Isi berkas bukan PDF yang valid.');
  } finally {
    await (document ? document.destroy() : loadingTask.destroy()).catch(() => {});
  }
  return name;
}

export async function uploadOwnDocument(prisma, userId, code, file) {
  if (!REQUIRED_DOCUMENT_CODES.includes(code)) selectedType([], code);
  const profile = await ownProfile(prisma, userId);
  const type = selectedType(await requiredDocumentTypes(prisma), code);
  const originalName = await validatePdfDocument(file, type);
  const storageKey = `data-diri/${randomUUID()}.pdf`;
  const path = await storagePath(storageKey, true);
  try {
    await writeFile(path, file.buffer, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    await unlink(path).catch(() => {});
    throw error;
  }
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261103, ${profile.id}::int) IS NULL AS locked`;
      const verification = await tx.verifikasiDataDiri.upsert({
        where: { mahasiswa_id: profile.id },
        create: { mahasiswa_id: profile.id }, update: {},
        select: { id: true, status_verifikasi: true },
      });
      if (verification.status_verifikasi === 'TERVERIFIKASI') {
        throw new DataDiriError(409, 'DOCUMENT_LOCKED', 'Dokumen yang terverifikasi tidak dapat diganti.');
      }
      const current = await tx.dokumenDataDiri.findFirst({
        where: { verifikasi_data_diri_id: verification.id, jenis_dokumen_id: type.id, is_terkini: true },
        select: { id: true, versi: true, status_dokumen: true },
      });
      if (current && !['BELUM_DIPERIKSA', 'PERLU_PERBAIKAN'].includes(current.status_dokumen)) {
        throw new DataDiriError(409, 'DOCUMENT_LOCKED', 'Dokumen yang terverifikasi tidak dapat diganti.');
      }
      if (current) await tx.dokumenDataDiri.update({ where: { id: current.id }, data: { is_terkini: false } });
      const document = await tx.dokumen.create({
        data: {
          diunggah_oleh_user_id: userId, nama_file_asli: originalName,
          storage_key: storageKey, mime_type: 'application/pdf',
          ukuran_bytes: BigInt(file.buffer.length),
          checksum_sha256: createHash('sha256').update(file.buffer).digest('hex'),
        },
        select: { id: true },
      });
      const version = await tx.dokumenDataDiri.create({
        data: {
          verifikasi_data_diri_id: verification.id, jenis_dokumen_id: type.id,
          dokumen_id: document.id, versi: (current?.versi ?? 0) + 1,
        },
        select: { versi: true, status_dokumen: true },
      });
      const currentDocuments = await tx.dokumenDataDiri.findMany({
        where: { verifikasi_data_diri_id: verification.id, is_terkini: true },
        select: { status_dokumen: true },
      });
      await tx.verifikasiDataDiri.update({
        where: { id: verification.id },
        data: {
          status_verifikasi: currentDocuments.some((item) => item.status_dokumen === 'PERLU_PERBAIKAN')
            ? 'PERLU_PERBAIKAN'
            : 'BELUM_DIVERIFIKASI',
          diverifikasi_at: null,
        },
      });
      return { kode_jenis: code, versi: version.versi, status_dokumen: version.status_dokumen };
    });
  } catch (error) {
    await removePrivateDocument(storageKey).catch(() => {});
    await unlink(path).catch(() => {});
    if (error?.code === 'P2002') {
      throw new DataDiriError(409, 'DOCUMENT_CONFLICT', 'Unggah bersamaan; silakan coba lagi.');
    }
    throw error;
  }
}

export async function downloadOwnDocument(prisma, userId, code) {
  if (!REQUIRED_DOCUMENT_CODES.includes(code)) selectedType([], code);
  const profile = await ownProfile(prisma, userId);
  const type = selectedType(await requiredDocumentTypes(prisma), code);
  const verification = await prisma.verifikasiDataDiri.findUnique({
    where: { mahasiswa_id: profile.id }, select: { id: true },
  });
  const current = verification && await prisma.dokumenDataDiri.findFirst({
    where: { verifikasi_data_diri_id: verification.id, jenis_dokumen_id: type.id, is_terkini: true },
    select: { dokumen: { select: { storage_key: true, mime_type: true } } },
  });
  if (!current) throw new DataDiriError(404, 'DOCUMENT_NOT_FOUND', 'Dokumen tidak ditemukan.');
  const bytes = await readStoredDataDiriDocument(current.dokumen.storage_key);
  return { bytes, filename: `${code.toLowerCase()}.pdf` };
}

export async function writePrivateDocument(storageKey, bytes) {
  if (isSupabaseStorageConfigured()) {
    await uploadToStorage(storageKey, bytes, 'application/pdf');
    return storageKey;
  }
  const path = await storagePath(storageKey, true);
  try {
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    await unlink(path).catch(() => {});
    throw error;
  }
  return path;
}

export async function removePrivateDocument(storageKey, { strict = false } = {}) {
  if (isSupabaseStorageConfigured()) {
    if (strict) await deleteFromStorage(storageKey);
    else await deleteFromStorage(storageKey).catch(() => {});
  }
  try {
    const path = await storagePath(storageKey);
    await unlink(path).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
  } catch (error) {
    if (strict && error?.code !== 'ENOENT' && !isSupabaseStorageConfigured()) throw error;
    // Ignore storagePath parsing error if already deleted or cloud-only
  }
}

export async function readPrivateDocument(storageKey) {
  if (isSupabaseStorageConfigured()) {
    try {
      return await downloadFromStorage(storageKey);
    } catch (error) {
      // Fallback to local storage if file exists locally
      if (error?.code === 'DOCUMENT_NOT_FOUND' || error?.status === 404) {
        try {
          return await readFile(await storagePath(storageKey));
        } catch {
          throw new DataDiriError(404, 'DOCUMENT_NOT_FOUND', 'Dokumen tidak ditemukan.');
        }
      }
      throw error;
    }
  }
  try {
    return await readFile(await storagePath(storageKey));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new DataDiriError(404, 'DOCUMENT_NOT_FOUND', 'Dokumen tidak ditemukan.');
    }
    throw error;
  }
}

export const readStoredDataDiriDocument = readPrivateDocument;
