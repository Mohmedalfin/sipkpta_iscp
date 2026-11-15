import { hashPassword } from '../security/password.js';
import { changeMasterAccountStatus, deleteMasterAccount } from './master-account.service.js';

export class MasterMahasiswaError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const mahasiswaSelect = {
  id: true,
  user_id: true,
  program_studi_id: true,
  nim: true,
  nama_lengkap: true,
  nik_kependudukan: true,
  tempat_lahir: true,
  tanggal_lahir: true,
  no_telepon: true,
  alamat: true,
  tahun_angkatan: true,
  status_data: true,
  created_at: true,
  updated_at: true,
  user: { select: { email: true, status_akun: true } },
  program_studi: { select: { id: true, kode_prodi: true, nama_prodi: true } },
};

function publicMahasiswa(record) {
  const { user, ...profile } = record;
  return {
    ...profile,
    email: user.email,
    status_akun: user.status_akun,
  };
}

export async function authorizedProdiId(prisma) {
  // UserRole belum memiliki scope prodi. Saat lebih dari satu prodi ada,
  // tidak ada cara aman untuk menentukan prodi milik Admin Prodi.
  const prodi = await prisma.programStudi.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
    take: 2,
  });
  if (prodi.length !== 1) {
    throw new MasterMahasiswaError(403, 'PRODI_SCOPE_UNAVAILABLE', 'Cakupan prodi tidak dapat ditentukan.');
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
    throw new MasterMahasiswaError(409, 'MAHASISWA_DUPLICATE', 'NIM, email, atau identitas mahasiswa sudah digunakan.');
  }
  throw error;
}

export async function listMahasiswa(prisma, { page, limit, search, tahun_angkatan }) {
  const prodiId = await authorizedProdiId(prisma);
  const where = {
    program_studi_id: prodiId,
    ...(Number.isInteger(tahun_angkatan) ? { tahun_angkatan } : {}),
    ...(search ? {
      OR: [
        { nim: { contains: search } },
        { nama_lengkap: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };
  const prodiWhere = { program_studi_id: prodiId };
  const [records, total, totalProdi, aktif, nonaktif] = await prisma.$transaction([
    prisma.mahasiswa.findMany({
      where,
      select: mahasiswaSelect,
      orderBy: [{ id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.mahasiswa.count({ where }),
    prisma.mahasiswa.count({ where: prodiWhere }),
    prisma.mahasiswa.count({ where: { ...prodiWhere, user: { status_akun: 'AKTIF' } } }),
    prisma.mahasiswa.count({ where: { ...prodiWhere, user: { status_akun: 'NONAKTIF' } } }),
  ]);
  return {
    data: records.map(publicMahasiswa),
    pagination: { page, limit, total_items: total, total_pages: Math.ceil(total / limit) },
    summary: { total: totalProdi, aktif, nonaktif },
  };
}

export async function getMahasiswa(prisma, id) {
  const prodiId = await authorizedProdiId(prisma);
  const record = await prisma.mahasiswa.findFirst({
    where: { id, program_studi_id: prodiId },
    select: mahasiswaSelect,
  });
  if (!record) {
    throw new MasterMahasiswaError(404, 'MAHASISWA_NOT_FOUND', 'Mahasiswa tidak ditemukan.');
  }
  return publicMahasiswa(record);
}

export async function createMahasiswa(prisma, actorUserId, input) {
  const prodiId = await authorizedProdiId(prisma);
  if (input.program_studi_id !== prodiId) {
    throw new MasterMahasiswaError(403, 'PRODI_FORBIDDEN', 'Prodi tidak diizinkan.');
  }
  const passwordHash = await hashPassword(birthDatePassword(input.tanggal_lahir));
  try {
    const record = await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({
        where: { kode_peran: 'MAHASISWA' },
        select: { id: true },
      });
      if (!role) {
        throw new MasterMahasiswaError(503, 'ROLE_UNAVAILABLE', 'Role Mahasiswa belum tersedia.');
      }
      const user = await tx.user.create({
        data: {
          login_id: input.nim,
          email: input.email,
          password_hash: passwordHash,
          status_akun: 'AKTIF',
        },
        select: { id: true },
      });
      await tx.userRole.create({
        data: {
          user_id: user.id,
          role_id: role.id,
          assigned_by_user_id: actorUserId,
        },
      });
      return tx.mahasiswa.create({
        data: {
          user_id: user.id,
          program_studi_id: prodiId,
          nim: input.nim,
          nama_lengkap: input.nama_lengkap,
          tanggal_lahir: input.tanggal_lahir,
          nik_kependudukan: input.nik_kependudukan,
          tempat_lahir: input.tempat_lahir,
          no_telepon: input.no_telepon,
          alamat: input.alamat,
          tahun_angkatan: input.tahun_angkatan,
        },
        select: mahasiswaSelect,
      });
    });
    return publicMahasiswa(record);
  } catch (error) {
    handlePrismaConflict(error);
  }
}

export async function updateMahasiswa(prisma, id, input) {
  const prodiId = await authorizedProdiId(prisma);
  try {
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.mahasiswa.findFirst({
        where: { id, program_studi_id: prodiId },
        select: { id: true, user_id: true },
      });
      if (!existing) {
        throw new MasterMahasiswaError(404, 'MAHASISWA_NOT_FOUND', 'Mahasiswa tidak ditemukan.');
      }
      if (input.email !== undefined) {
        await tx.user.update({
          where: { id: existing.user_id },
          data: { email: input.email },
        });
      }
      const { email: _email, ...profileData } = input;
      return tx.mahasiswa.update({
        where: { id },
        data: profileData,
        select: mahasiswaSelect,
      });
    });
    return publicMahasiswa(record);
  } catch (error) {
    handlePrismaConflict(error);
  }
}

export async function changeMahasiswaStatus(prisma, id, actorUserId, status) {
  const prodiId = await authorizedProdiId(prisma);
  return changeMasterAccountStatus(prisma, {
    model: 'mahasiswa', id, prodiId, actorUserId, status, ErrorType: MasterMahasiswaError,
  });
}

export async function deleteMahasiswa(prisma, id, actorUserId) {
  const prodiId = await authorizedProdiId(prisma);
  return deleteMasterAccount(prisma, {
    model: 'mahasiswa', id, prodiId, actorUserId, ErrorType: MasterMahasiswaError,
  });
}
