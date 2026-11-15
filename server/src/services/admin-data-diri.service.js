import { authorizedProdiId } from './mahasiswa.service.js';
import {
  REQUIRED_DOCUMENT_CODES,
  readStoredDataDiriDocument,
  requiredDocumentTypes,
} from './data-diri.service.js';

const DOCUMENT_STATUSES = new Set(['BELUM_DIPERIKSA', 'TERVERIFIKASI', 'PERLU_PERBAIKAN']);
export const VERIFICATION_FILTERS = new Set([
  'BELUM_LENGKAP', 'BELUM_DIVERIFIKASI', 'PERLU_PERBAIKAN', 'TERVERIFIKASI',
]);

export class AdminDataDiriError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function scopedProdiId(prisma) {
  try {
    return await authorizedProdiId(prisma);
  } catch (error) {
    if (error?.code === 'PRODI_SCOPE_UNAVAILABLE') {
      throw new AdminDataDiriError(error.status, error.code, error.message);
    }
    throw error;
  }
}

function currentDocuments(verification) {
  return verification?.dokumen_data_diri?.filter((item) => item.is_terkini) ?? [];
}

export function deriveVerificationStatus(documents) {
  const byCode = new Map();
  for (const document of documents) {
    const code = document.jenis_dokumen?.kode_jenis ?? document.kode_jenis;
    if (REQUIRED_DOCUMENT_CODES.includes(code) && document.is_terkini !== false) byCode.set(code, document);
  }
  const required = REQUIRED_DOCUMENT_CODES.map((code) => byCode.get(code)).filter(Boolean);
  if (required.length < REQUIRED_DOCUMENT_CODES.length) return 'BELUM_LENGKAP';
  if (required.some((item) => item.status_dokumen === 'PERLU_PERBAIKAN')) return 'PERLU_PERBAIKAN';
  if (required.every((item) => item.status_dokumen === 'TERVERIFIKASI')) return 'TERVERIFIKASI';
  return 'BELUM_DIVERIFIKASI';
}

function storedAggregateStatus(documents) {
  const derived = deriveVerificationStatus(documents);
  return derived === 'BELUM_LENGKAP' ? 'BELUM_DIVERIFIKASI' : derived;
}

function publicExaminer(user) {
  return user ? { id: user.id, login_id: user.login_id } : null;
}

function publicDocument(record) {
  return {
    id: record.id,
    versi: record.versi,
    is_terkini: record.is_terkini,
    status_dokumen: record.status_dokumen,
    catatan_admin: record.catatan_admin,
    diperiksa_at: record.diperiksa_at,
    pemeriksa: publicExaminer(record.pemeriksa),
    file: {
      nama_file_asli: record.dokumen.nama_file_asli,
      mime_type: record.dokumen.mime_type,
      ukuran_bytes: Number(record.dokumen.ukuran_bytes),
      diunggah_at: record.dokumen.created_at,
    },
  };
}

export async function listAdminDataDiri(prisma, { page, limit, search, status, lengkap }) {
  await requiredDocumentTypes(prisma);
  const prodiId = await scopedProdiId(prisma);
  const currentRequired = (extra = {}) => ({ is_terkini: true,
    jenis_dokumen: { kode_jenis: { in: REQUIRED_DOCUMENT_CODES } }, ...extra });
  const hasDocument = (filter) => ({ verifikasi_data_diri: {
    is: { dokumen_data_diri: { some: filter } },
  } });
  const complete = { AND: REQUIRED_DOCUMENT_CODES.map((code) =>
    hasDocument({ is_terkini: true, jenis_dokumen: { kode_jenis: code } })) };
  const needsCorrection = hasDocument(currentRequired({ status_dokumen: 'PERLU_PERBAIKAN' }));
  const notVerified = hasDocument(currentRequired({ status_dokumen: { not: 'TERVERIFIKASI' } }));
  const statusWhere = {
    BELUM_LENGKAP: { NOT: complete },
    PERLU_PERBAIKAN: { AND: [complete, needsCorrection] },
    TERVERIFIKASI: { AND: [complete, { NOT: notVerified }] },
    BELUM_DIVERIFIKASI: { AND: [complete, { NOT: needsCorrection }, notVerified] },
  };
  const scope = { program_studi_id: prodiId };
  const baseWhere = { ...scope, ...(search ? { OR: [
    { nim: { contains: search } },
    { nama_lengkap: { contains: search, mode: 'insensitive' } },
  ] } : {}) };
  const where = { AND: [baseWhere,
    ...(status ? [statusWhere[status]] : []),
    ...(lengkap === null ? [] : [lengkap ? complete : { NOT: complete }]),
  ] };
  const [records, total, incomplete, pending, correction, verified] = await Promise.all([
    prisma.mahasiswa.findMany({
    where,
    select: {
      id: true,
      nim: true,
      nama_lengkap: true,
      status_data: true,
      user: { select: { status_akun: true } },
      program_studi: { select: { id: true, kode_prodi: true, nama_prodi: true } },
      verifikasi_data_diri: {
        select: {
          status_verifikasi: true,
          diperiksa_at: true,
          diverifikasi_at: true,
          dokumen_data_diri: {
            where: { is_terkini: true },
            select: {
              is_terkini: true,
              status_dokumen: true,
              jenis_dokumen: { select: { kode_jenis: true } },
            },
          },
        },
      },
    },
    orderBy: [{ nama_lengkap: 'asc' }, { id: 'asc' }],
    skip: (page - 1) * limit,
    take: limit,
  }),
    prisma.mahasiswa.count({ where }),
    ...['BELUM_LENGKAP', 'BELUM_DIVERIFIKASI', 'PERLU_PERBAIKAN', 'TERVERIFIKASI']
      .map((key) => prisma.mahasiswa.count({ where: { AND: [scope, statusWhere[key]] } })),
  ]);

  const normalized = records.map((record) => {
    const documents = currentDocuments(record.verifikasi_data_diri);
    const uploaded = new Set(documents.map((item) => item.jenis_dokumen.kode_jenis)
      .filter((code) => REQUIRED_DOCUMENT_CODES.includes(code))).size;
    const derivedStatus = deriveVerificationStatus(documents);
    return {
      id: record.id,
      nim: record.nim,
      nama_lengkap: record.nama_lengkap,
      status_data: record.status_data,
      status_akun: record.user.status_akun,
      program_studi: record.program_studi,
      status_verifikasi: derivedStatus,
      jumlah_terunggah: uploaded,
      jumlah_wajib: REQUIRED_DOCUMENT_CODES.length,
      lengkap: uploaded === REQUIRED_DOCUMENT_CODES.length,
      diperiksa_at: record.verifikasi_data_diri?.diperiksa_at ?? null,
      diverifikasi_at: record.verifikasi_data_diri?.diverifikasi_at ?? null,
    };
  });
  return {
    data: normalized,
    pagination: { page, limit, total_items: total, total_pages: Math.ceil(total / limit) },
    summary: { belumLengkap: incomplete, belumDiverifikasi: pending,
      perluPerbaikan: correction, terverifikasi: verified },
  };
}

async function scopedStudent(prisma, mahasiswaId, select) {
  const prodiId = await scopedProdiId(prisma);
  const student = await prisma.mahasiswa.findFirst({
    where: { id: mahasiswaId, program_studi_id: prodiId },
    select,
  });
  if (!student) {
    throw new AdminDataDiriError(404, 'MAHASISWA_NOT_FOUND', 'Mahasiswa tidak ditemukan.');
  }
  return student;
}

export async function getAdminDataDiriDetail(prisma, mahasiswaId) {
  const types = await requiredDocumentTypes(prisma);
  const student = await scopedStudent(prisma, mahasiswaId, {
    id: true,
    nim: true,
    nama_lengkap: true,
    status_data: true,
    user: { select: { status_akun: true } },
    program_studi: { select: { id: true, kode_prodi: true, nama_prodi: true } },
    verifikasi_data_diri: {
      select: {
        id: true,
        status_verifikasi: true,
        catatan_admin: true,
        diajukan_at: true,
        diperiksa_at: true,
        diverifikasi_at: true,
        pemeriksa: { select: { id: true, login_id: true } },
        dokumen_data_diri: {
          select: {
            id: true,
            jenis_dokumen_id: true,
            versi: true,
            is_terkini: true,
            status_dokumen: true,
            catatan_admin: true,
            diperiksa_at: true,
            pemeriksa: { select: { id: true, login_id: true } },
            dokumen: {
              select: {
                nama_file_asli: true,
                mime_type: true,
                ukuran_bytes: true,
                created_at: true,
              },
            },
          },
          orderBy: [{ jenis_dokumen_id: 'asc' }, { versi: 'desc' }],
        },
      },
    },
  });
  const verification = student.verifikasi_data_diri;
  const allDocuments = verification?.dokumen_data_diri ?? [];
  const documents = types.map((type) => {
    const versions = allDocuments.filter((item) => item.jenis_dokumen_id === type.id);
    const current = versions.find((item) => item.is_terkini);
    return {
      kode_jenis: type.kode_jenis,
      nama_jenis: type.nama_jenis,
      is_uploaded: Boolean(current),
      dokumen_terkini: current ? publicDocument(current) : null,
      riwayat_versi: versions.map(publicDocument),
    };
  });
  const current = documents.flatMap((item) => item.dokumen_terkini
    ? [{ ...item.dokumen_terkini, kode_jenis: item.kode_jenis }]
    : []);
  return {
    mahasiswa: {
      id: student.id,
      nim: student.nim,
      nama_lengkap: student.nama_lengkap,
      status_data: student.status_data,
      status_akun: student.user.status_akun,
      program_studi: student.program_studi,
    },
    verifikasi: {
      status_verifikasi: deriveVerificationStatus(current),
      catatan_admin: verification?.catatan_admin ?? null,
      diajukan_at: verification?.diajukan_at ?? null,
      diperiksa_at: verification?.diperiksa_at ?? null,
      diverifikasi_at: verification?.diverifikasi_at ?? null,
      pemeriksa: publicExaminer(verification?.pemeriksa),
    },
    kelengkapan: {
      jumlah_wajib: REQUIRED_DOCUMENT_CODES.length,
      jumlah_terunggah: current.length,
      lengkap: current.length === REQUIRED_DOCUMENT_CODES.length,
    },
    dokumen: documents,
  };
}

async function currentScopedDocument(prisma, mahasiswaId, code) {
  if (!REQUIRED_DOCUMENT_CODES.includes(code)) {
    throw new AdminDataDiriError(404, 'DOCUMENT_TYPE_NOT_FOUND', 'Jenis dokumen tidak ditemukan.');
  }
  const student = await scopedStudent(prisma, mahasiswaId, {
    id: true,
    verifikasi_data_diri: {
      select: {
        id: true,
        dokumen_data_diri: {
          where: { is_terkini: true, jenis_dokumen: { kode_jenis: code } },
          select: {
            id: true,
            versi: true,
            status_dokumen: true,
            catatan_admin: true,
            dokumen: { select: { storage_key: true } },
            jenis_dokumen: { select: { id: true, kode_jenis: true } },
          },
        },
      },
    },
  });
  const document = student.verifikasi_data_diri?.dokumen_data_diri[0];
  if (!document) {
    throw new AdminDataDiriError(404, 'DOCUMENT_NOT_FOUND', 'Dokumen tidak ditemukan.');
  }
  return { student, document };
}

export async function downloadAdminDataDiriDocument(prisma, mahasiswaId, code) {
  if (!REQUIRED_DOCUMENT_CODES.includes(code)) {
    throw new AdminDataDiriError(404, 'DOCUMENT_TYPE_NOT_FOUND', 'Jenis dokumen tidak ditemukan.');
  }
  await requiredDocumentTypes(prisma);
  const { document } = await currentScopedDocument(prisma, mahasiswaId, code);
  return {
    bytes: await readStoredDataDiriDocument(document.dokumen.storage_key),
    filename: `${code.toLowerCase()}.pdf`,
  };
}

function assertDecision(status, note) {
  if (!['TERVERIFIKASI', 'PERLU_PERBAIKAN'].includes(status)) {
    throw new AdminDataDiriError(400, 'VALIDATION_ERROR', 'Keputusan dokumen tidak valid.');
  }
  if (status === 'PERLU_PERBAIKAN' && !note) {
    throw new AdminDataDiriError(400, 'VALIDATION_ERROR', 'Catatan perbaikan wajib diisi.');
  }
}

function sameDecision(document, status, note) {
  return document.status_dokumen === status && (document.catatan_admin ?? null) === note;
}

async function refreshAggregate(tx, verification, actorUserId, now) {
  const documents = await tx.dokumenDataDiri.findMany({
    where: { verifikasi_data_diri_id: verification.id, is_terkini: true },
    select: {
      is_terkini: true,
      status_dokumen: true,
      jenis_dokumen: { select: { kode_jenis: true } },
    },
  });
  const status = storedAggregateStatus(documents);
  const verifiedAt = status === 'TERVERIFIKASI'
    ? (verification.status_verifikasi === 'TERVERIFIKASI' && verification.diverifikasi_at
      ? verification.diverifikasi_at
      : now)
    : null;
  await tx.verifikasiDataDiri.update({
    where: { id: verification.id },
    data: {
      status_verifikasi: status,
      diperiksa_oleh_user_id: actorUserId,
      diperiksa_at: now,
      diverifikasi_at: verifiedAt,
    },
  });
  return status;
}

export async function decideAdminDataDiriDocument(
  prisma,
  { mahasiswaId, code, status, note, expectedVersion, actorUserId },
) {
  assertDecision(status, note);
  if (!REQUIRED_DOCUMENT_CODES.includes(code)) {
    throw new AdminDataDiriError(404, 'DOCUMENT_TYPE_NOT_FOUND', 'Jenis dokumen tidak ditemukan.');
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261103, ${mahasiswaId}::int) IS NULL AS locked`;
    await requiredDocumentTypes(tx);
    const prodiId = await scopedProdiId(tx);
    const student = await tx.mahasiswa.findFirst({
      where: { id: mahasiswaId, program_studi_id: prodiId },
      select: {
        id: true,
        verifikasi_data_diri: {
          select: {
            id: true,
            status_verifikasi: true,
            diverifikasi_at: true,
            dokumen_data_diri: {
              where: { is_terkini: true, jenis_dokumen: { kode_jenis: code } },
              select: { id: true, versi: true, status_dokumen: true, catatan_admin: true },
            },
          },
        },
      },
    });
    if (!student) {
      throw new AdminDataDiriError(404, 'MAHASISWA_NOT_FOUND', 'Mahasiswa tidak ditemukan.');
    }
    const verification = student.verifikasi_data_diri;
    const document = verification?.dokumen_data_diri[0];
    if (!document) {
      throw new AdminDataDiriError(404, 'DOCUMENT_NOT_FOUND', 'Dokumen tidak ditemukan.');
    }
    if (!DOCUMENT_STATUSES.has(document.status_dokumen)) {
      throw new AdminDataDiriError(409, 'DOCUMENT_STATUS_INVALID', 'Status dokumen tidak dapat diproses.');
    }
    if (document.versi !== expectedVersion) {
      throw new AdminDataDiriError(409, 'STALE_DOCUMENT_VERSION', 'Versi dokumen telah berubah; muat ulang detail.');
    }
    if (sameDecision(document, status, note)) {
      return {
        kode_jenis: code,
        versi: document.versi,
        status_dokumen: document.status_dokumen,
        catatan_admin: document.catatan_admin,
        status_verifikasi: verification.status_verifikasi,
        idempotent: true,
      };
    }
    const now = new Date();
    const updated = await tx.dokumenDataDiri.updateMany({
      where: {
        id: document.id,
        versi: expectedVersion,
        is_terkini: true,
        status_dokumen: document.status_dokumen,
      },
      data: {
        status_dokumen: status,
        catatan_admin: note,
        diperiksa_oleh_user_id: actorUserId,
        diperiksa_at: now,
      },
    });
    if (updated.count !== 1) {
      throw new AdminDataDiriError(409, 'DOCUMENT_CONFLICT', 'Dokumen berubah saat diperiksa; coba lagi.');
    }
    const aggregateStatus = await refreshAggregate(tx, verification, actorUserId, now);
    await tx.auditLog.create({
      data: {
        aktor_user_id: actorUserId,
        aksi: 'VERIFIKASI_DOKUMEN_DATA_DIRI',
        entitas: 'DOKUMEN_DATA_DIRI',
        entitas_id: BigInt(document.id),
        data_sebelum: {
          mahasiswa_id: mahasiswaId,
          kode_jenis: code,
          versi: document.versi,
          status_dokumen: document.status_dokumen,
          catatan_admin: document.catatan_admin,
        },
        data_sesudah: {
          mahasiswa_id: mahasiswaId,
          kode_jenis: code,
          versi: document.versi,
          status_dokumen: status,
          catatan_admin: note,
          status_verifikasi: aggregateStatus,
        },
      },
    });
    return {
      kode_jenis: code,
      versi: document.versi,
      status_dokumen: status,
      catatan_admin: note,
      status_verifikasi: aggregateStatus,
      idempotent: false,
    };
  });
}

export async function verifyAllAdminDataDiri(
  prisma,
  { mahasiswaId, expectedVersions, actorUserId },
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261103, ${mahasiswaId}::int) IS NULL AS locked`;
    await requiredDocumentTypes(tx);
    const prodiId = await scopedProdiId(tx);
    const student = await tx.mahasiswa.findFirst({
      where: { id: mahasiswaId, program_studi_id: prodiId },
      select: {
        id: true,
        verifikasi_data_diri: {
          select: {
            id: true,
            status_verifikasi: true,
            diverifikasi_at: true,
            dokumen_data_diri: {
              where: { is_terkini: true },
              select: {
                id: true,
                versi: true,
                is_terkini: true,
                status_dokumen: true,
                catatan_admin: true,
                diperiksa_oleh_user_id: true,
                diperiksa_at: true,
                jenis_dokumen: { select: { kode_jenis: true } },
              },
            },
          },
        },
      },
    });
    if (!student) {
      throw new AdminDataDiriError(404, 'MAHASISWA_NOT_FOUND', 'Mahasiswa tidak ditemukan.');
    }
    const verification = student.verifikasi_data_diri;
    const documents = currentDocuments(verification)
      .filter((item) => REQUIRED_DOCUMENT_CODES.includes(item.jenis_dokumen.kode_jenis));
    const byCode = new Map(documents.map((item) => [item.jenis_dokumen.kode_jenis, item]));
    if (byCode.size !== REQUIRED_DOCUMENT_CODES.length) {
      throw new AdminDataDiriError(409, 'DOCUMENTS_INCOMPLETE', 'Enam dokumen wajib belum lengkap.');
    }
    for (const code of REQUIRED_DOCUMENT_CODES) {
      if (byCode.get(code).versi !== expectedVersions[code]) {
        throw new AdminDataDiriError(409, 'STALE_DOCUMENT_VERSION', 'Versi dokumen telah berubah; muat ulang detail.');
      }
    }
    if (documents.some((item) => item.status_dokumen === 'PERLU_PERBAIKAN')) {
      throw new AdminDataDiriError(409, 'DOCUMENT_REVISION_PENDING', 'Masih ada dokumen yang perlu diperbaiki.');
    }
    if (documents.some((item) => !DOCUMENT_STATUSES.has(item.status_dokumen))) {
      throw new AdminDataDiriError(409, 'DOCUMENT_STATUS_INVALID', 'Status dokumen tidak dapat diproses.');
    }
    const pending = documents.filter((item) => item.status_dokumen === 'BELUM_DIPERIKSA');
    if (pending.length === 0 && verification.status_verifikasi === 'TERVERIFIKASI') {
      return { status_verifikasi: 'TERVERIFIKASI', jumlah_diperbarui: 0, idempotent: true };
    }
    const now = new Date();
    for (const document of pending) {
      const updated = await tx.dokumenDataDiri.updateMany({
        where: {
          id: document.id,
          versi: document.versi,
          is_terkini: true,
          status_dokumen: 'BELUM_DIPERIKSA',
        },
        data: {
          status_dokumen: 'TERVERIFIKASI',
          catatan_admin: null,
          diperiksa_oleh_user_id: actorUserId,
          diperiksa_at: now,
        },
      });
      if (updated.count !== 1) {
        throw new AdminDataDiriError(409, 'DOCUMENT_CONFLICT', 'Dokumen berubah saat diperiksa; coba lagi.');
      }
    }
    const aggregateStatus = await refreshAggregate(tx, verification, actorUserId, now);
    if (aggregateStatus !== 'TERVERIFIKASI') {
      throw new AdminDataDiriError(409, 'DOCUMENT_CONFLICT', 'Status dokumen berubah saat diperiksa; coba lagi.');
    }
    await tx.auditLog.create({
      data: {
        aktor_user_id: actorUserId,
        aksi: 'VERIFIKASI_SEMUA_DATA_DIRI',
        entitas: 'VERIFIKASI_DATA_DIRI',
        entitas_id: BigInt(verification.id),
        data_sebelum: {
          mahasiswa_id: mahasiswaId,
          status_verifikasi: verification.status_verifikasi,
          dokumen_diperbarui: pending.map((item) => ({
            kode_jenis: item.jenis_dokumen.kode_jenis,
            versi: item.versi,
            status_dokumen: item.status_dokumen,
          })),
        },
        data_sesudah: {
          mahasiswa_id: mahasiswaId,
          status_verifikasi: aggregateStatus,
          versi: expectedVersions,
        },
      },
    });
    return {
      status_verifikasi: aggregateStatus,
      jumlah_diperbarui: pending.length,
      idempotent: false,
    };
  });
}
