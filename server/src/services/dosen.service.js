import { hashPassword } from '../security/password.js';
import { changeMasterAccountStatus, deleteMasterAccount } from './master-account.service.js';

export class MasterDosenError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const dosenSelect = {
  id: true,
  user_id: true,
  program_studi_id: true,
  kode_dosen: true,
  nidn: true,
  nama_lengkap: true,
  no_telepon: true,
  tanggal_lahir: true,
  jabatan_fungsional: true,
  is_homebase_si: true,
  status_data: true,
  created_at: true,
  updated_at: true,
  user: { select: { email: true, status_akun: true } },
  program_studi: { select: { id: true, kode_prodi: true, nama_prodi: true } },
};

function publicDosen(record) {
  const { user, ...profile } = record;
  return { ...profile, email: user.email, status_akun: user.status_akun };
}

export async function authorizedProdiId(prisma) {
  // Belum ada pemetaan Admin Prodi ke ProgramStudi; saat multi-prodi, tolak akses.
  const prodi = await prisma.programStudi.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
    take: 2,
  });
  if (prodi.length !== 1) {
    throw new MasterDosenError(403, 'PRODI_SCOPE_UNAVAILABLE', 'Cakupan prodi tidak dapat ditentukan.');
  }
  return prodi[0].id;
}

function birthDatePassword(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}${month}${date.getUTCFullYear()}`;
}

function handlePrismaConflict(error) {
  if (error?.code === 'P2002') {
    throw new MasterDosenError(409, 'DOSEN_DUPLICATE', 'Kode dosen, NIDN, atau email sudah digunakan.');
  }
  throw error;
}

export async function listDosen(prisma, { page, limit, search }) {
  const prodiId = await authorizedProdiId(prisma);
  const where = {
    program_studi_id: prodiId,
    ...(search ? {
      OR: [
        { kode_dosen: { contains: search, mode: 'insensitive' } },
        { nidn: { contains: search } },
        { nama_lengkap: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };
  const scope = { program_studi_id: prodiId };
  const [records, total, all, active, homebase] = await prisma.$transaction([
    prisma.dosen.findMany({
      where,
      select: dosenSelect,
      orderBy: [{ id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dosen.count({ where }),
    prisma.dosen.count({ where: scope }),
    prisma.dosen.count({ where: { ...scope, user: { status_akun: 'AKTIF' } } }),
    prisma.dosen.count({ where: { ...scope, is_homebase_si: true } }),
  ]);
  return {
    data: records.map(publicDosen),
    pagination: { page, limit, total_items: total, total_pages: Math.ceil(total / limit) },
    summary: { total: all, aktif: active, nonaktif: all - active, homebase },
  };
}

export async function getDosen(prisma, id) {
  const prodiId = await authorizedProdiId(prisma);
  const record = await prisma.dosen.findFirst({
    where: { id, program_studi_id: prodiId },
    select: dosenSelect,
  });
  if (!record) {
    throw new MasterDosenError(404, 'DOSEN_NOT_FOUND', 'Dosen tidak ditemukan.');
  }
  return publicDosen(record);
}

export async function createDosen(prisma, input) {
  const prodiId = await authorizedProdiId(prisma);
  if (input.program_studi_id !== prodiId) {
    throw new MasterDosenError(403, 'PRODI_FORBIDDEN', 'Prodi tidak diizinkan.');
  }
  const passwordHash = await hashPassword(birthDatePassword(input.tanggal_lahir));
  try {
    const record = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          login_id: input.kode_dosen,
          email: input.email,
          password_hash: passwordHash,
          status_akun: 'AKTIF',
        },
        select: { id: true },
      });
      return tx.dosen.create({
        data: {
          user_id: user.id,
          program_studi_id: prodiId,
          kode_dosen: input.kode_dosen,
          nidn: input.nidn,
          nama_lengkap: input.nama_lengkap,
          no_telepon: input.no_telepon,
          tanggal_lahir: input.tanggal_lahir,
          jabatan_fungsional: input.jabatan_fungsional,
          is_homebase_si: input.is_homebase_si,
        },
        select: dosenSelect,
      });
    });
    return publicDosen(record);
  } catch (error) {
    handlePrismaConflict(error);
  }
}

export async function updateDosen(prisma, id, input) {
  const prodiId = await authorizedProdiId(prisma);
  try {
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.dosen.findFirst({
        where: { id, program_studi_id: prodiId },
        select: { id: true, user_id: true },
      });
      if (!existing) {
        throw new MasterDosenError(404, 'DOSEN_NOT_FOUND', 'Dosen tidak ditemukan.');
      }
      if (input.email !== undefined) {
        await tx.user.update({
          where: { id: existing.user_id },
          data: { email: input.email },
        });
      }
      const { email: _email, ...profileData } = input;
      return tx.dosen.update({
        where: { id },
        data: profileData,
        select: dosenSelect,
      });
    });
    return publicDosen(record);
  } catch (error) {
    handlePrismaConflict(error);
  }
}

export async function changeDosenStatus(prisma, id, actorUserId, status) {
  const prodiId = await authorizedProdiId(prisma);
  return changeMasterAccountStatus(prisma, {
    model: 'dosen', id, prodiId, actorUserId, status, ErrorType: MasterDosenError,
  });
}

export async function deleteDosen(prisma, id, actorUserId) {
  const prodiId = await authorizedProdiId(prisma);
  return deleteMasterAccount(prisma, {
    model: 'dosen', id, prodiId, actorUserId, ErrorType: MasterDosenError,
  });
}
