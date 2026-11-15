import { withNotificationPublication } from './notification-publication.service.js';
import { createNotifikasi, staffRecipients } from './notifikasi.service.js';
import { createHash, randomUUID } from 'node:crypto';
import { afterKpChange } from './realtime.service.js';
import {
  DataDiriError,
  REQUIRED_DOCUMENT_CODES,
  readPrivateDocument,
  removePrivateDocument,
  validatePdfDocument,
  writePrivateDocument,
} from './data-diri.service.js';

const TAHAP = 'KP';
const JENIS_PENGAJUAN = 'REGULER';
const PILIHAN_TOPIK = 'BARU';
const JENIS_PROSES = 'PENGAJUAN_REGULER';
const STATUS_DRAFT = 'DRAFT';
const STATUS_DIAJUKAN = 'DIAJUKAN';
const JENIS_STATUS = 'PENGAJUAN';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_TRANSACTION_ATTEMPTS = 3;
const REQUIRED_KP_DOCUMENTS = ['BUKTI_BAYAR_PROPOSAL_KP', 'PROPOSAL_KP'];
const SOCIAL_DOCUMENTS = ['SERTIFIKAT_SOSIALISASI_KP', 'SURAT_PERNYATAAN_SOSIALISASI_KP'];
const SPP_DOCUMENT = 'BUKTI_SPP_VARIABEL_KP';

export class PengajuanKpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function translatedStorageError(error) {
  if (error instanceof PengajuanKpError) return error;
  if (error instanceof DataDiriError) {
    return new PengajuanKpError(error.status, error.code, error.message);
  }
  return error;
}

export async function serializable(prisma, operation) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await withNotificationPublication(() =>
        prisma.$transaction(operation, { isolationLevel: 'Serializable' }));
    } catch (error) {
      if (error?.code !== 'P2034') throw error;
      if (attempt === MAX_TRANSACTION_ATTEMPTS) {
        throw new PengajuanKpError(409, 'CONCURRENT_UPDATE', 'Terjadi perubahan bersamaan; silakan coba lagi.');
      }
    }
  }
  throw new PengajuanKpError(409, 'CONCURRENT_UPDATE', 'Terjadi perubahan bersamaan; silakan coba lagi.');
}

async function ownStudent(prisma, userId) {
  const student = await prisma.mahasiswa.findUnique({
    where: { user_id: userId },
    select: {
      id: true,
      user_id: true,
      program_studi_id: true,
      nim: true,
      nama_lengkap: true,
      status_data: true,
      program_studi: { select: { id: true, kode_prodi: true, nama_prodi: true } },
      user: { select: { email: true, status_akun: true } },
    },
  });
  if (!student || student.status_data !== 'AKTIF' || student.user.status_akun !== 'AKTIF') {
    throw new PengajuanKpError(404, 'PROFILE_NOT_FOUND', 'Profil mahasiswa tidak tersedia.');
  }
  return student;
}

async function configuredContext(prisma, { requireOpen = false, now = new Date() } = {}) {
  const schedules = await prisma.jadwalProses.findMany({
    where: {
      jenis_proses: JENIS_PROSES,
      is_aktif: true,
      tahap_akademik: { kode_tahap: TAHAP, is_aktif: true },
      periode_akademik: { status_periode: 'AKTIF' },
    },
    select: {
      id: true,
      tanggal_buka: true,
      tanggal_tutup: true,
      keterangan: true,
      tahap_akademik: { select: { id: true, kode_tahap: true, nama_tahap: true, urutan: true } },
      periode_akademik: {
        select: {
          id: true,
          tahun_ajaran: true,
          semester: true,
          tanggal_mulai: true,
          tanggal_selesai: true,
          status_periode: true,
        },
      },
    },
  });
  if (schedules.length !== 1) {
    throw new PengajuanKpError(
      409,
      'KP_CONFIGURATION_AMBIGUOUS',
      'Konfigurasi periode dan jadwal pengajuan KP tidak tersedia secara tunggal.',
    );
  }
  const schedule = schedules[0];
  const isOpen = now >= schedule.tanggal_buka && now <= schedule.tanggal_tutup;
  if (requireOpen && !isOpen) {
    throw new PengajuanKpError(409, 'SUBMISSION_WINDOW_CLOSED', 'Jadwal pengajuan KP sedang ditutup.');
  }
  const requirements = await prisma.persyaratanPengajuan.findMany({
    where: {
      periode_akademik_id: schedule.periode_akademik.id,
      tahap_akademik_id: schedule.tahap_akademik.id,
      jenis_pengajuan: JENIS_PENGAJUAN,
      pilihan_topik: PILIHAN_TOPIK,
      is_aktif: true,
      jenis_dokumen: { is_aktif: true },
    },
    orderBy: [{ urutan_tampil: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      is_wajib: true,
      petunjuk: true,
      urutan_tampil: true,
      jenis_dokumen: {
        select: {
          id: true,
          kode_jenis: true,
          nama_jenis: true,
          format_diizinkan: true,
          maks_ukuran_mb: true,
        },
      },
    },
  });
  const configuredCodes = new Set(requirements.map((item) => item.jenis_dokumen.kode_jenis));
  const expectedCodes = [...REQUIRED_KP_DOCUMENTS, SPP_DOCUMENT, ...SOCIAL_DOCUMENTS];
  if (requirements.length !== expectedCodes.length || expectedCodes.some((code) => !configuredCodes.has(code))) {
    throw new PengajuanKpError(409, 'KP_REQUIREMENTS_INCOMPLETE', 'Persyaratan dokumen KP belum lengkap.');
  }
  return { schedule, requirements, isOpen, now };
}

async function validateThemeAndSupervisor(prisma, student, input, current = {}) {
  const themeId = input.tema_penelitian_id ?? current.tema_penelitian_id;
  if (!Number.isInteger(themeId) || themeId < 1) {
    throw new PengajuanKpError(400, 'VALIDATION_ERROR', 'Tema penelitian tidak valid.');
  }
  const theme = await prisma.temaPenelitian.findFirst({
    where: { id: themeId, is_aktif: true },
    select: { id: true },
  });
  if (!theme) throw new PengajuanKpError(400, 'INVALID_THEME', 'Tema penelitian tidak aktif atau tidak ditemukan.');

  const supervisorId = Object.hasOwn(input, 'usulan_pembimbing_id')
    ? input.usulan_pembimbing_id
    : current.usulan_pembimbing_id;
  if (supervisorId !== null && supervisorId !== undefined) {
    const supervisor = await prisma.dosen.findFirst({
      where: {
        id: supervisorId,
        program_studi_id: student.program_studi_id,
        status_data: 'AKTIF',
        user: { status_akun: 'AKTIF' },
      },
      select: { id: true },
    });
    if (!supervisor) {
      throw new PengajuanKpError(400, 'INVALID_SUPERVISOR', 'Usulan dosen pembimbing tidak valid untuk program studi mahasiswa.');
    }
  }
  return { themeId, supervisorId: supervisorId ?? null };
}

function studentSummary(student) {
  return {
    id: student.id,
    nim: student.nim,
    nama_lengkap: student.nama_lengkap,
    email: student.user.email,
    program_studi: student.program_studi,
  };
}

function scheduleReason(schedule, now) {
  if (now < schedule.tanggal_buka) return 'Jadwal pengajuan belum dibuka.';
  if (now > schedule.tanggal_tutup) return 'Jadwal pengajuan sudah ditutup.';
  return null;
}

export async function getKpFormOptions(prisma, userId, tahap) {
  if (tahap !== TAHAP) {
    throw new PengajuanKpError(400, 'VALIDATION_ERROR', 'Tahap yang didukung hanya KP.');
  }
  const student = await ownStudent(prisma, userId);
  const context = await configuredContext(prisma);
  const [themes, supervisors, verification] = await Promise.all([
    prisma.temaPenelitian.findMany({
      where: { is_aktif: true },
      orderBy: [{ nama_tema: 'asc' }, { id: 'asc' }],
      select: { id: true, kode_tema: true, nama_tema: true, deskripsi: true },
    }),
    prisma.dosen.findMany({
      where: {
        program_studi_id: student.program_studi_id,
        status_data: 'AKTIF',
        user: { status_akun: 'AKTIF' },
      },
      orderBy: [{ nama_lengkap: 'asc' }, { id: 'asc' }],
      select: { id: true, kode_dosen: true, nidn: true, nama_lengkap: true },
    }),
    prisma.verifikasiDataDiri.findUnique({
      where: { mahasiswa_id: student.id },
      select: {
        status_verifikasi: true,
        dokumen_data_diri: {
          where: { is_terkini: true, jenis_dokumen: { kode_jenis: { in: REQUIRED_DOCUMENT_CODES } } },
          select: { jenis_dokumen: { select: { kode_jenis: true } } },
        },
      },
    }),
  ]);
  const uploadedCodes = new Set(verification?.dokumen_data_diri.map((item) => item.jenis_dokumen.kode_jenis) ?? []);
  return {
    mahasiswa: studentSummary(student),
    tahap: context.schedule.tahap_akademik,
    periode: context.schedule.periode_akademik,
    jadwal: {
      id: context.schedule.id,
      jenis_proses: JENIS_PROSES,
      tanggal_buka: context.schedule.tanggal_buka,
      tanggal_tutup: context.schedule.tanggal_tutup,
      is_open: context.isOpen,
      alasan_tutup: scheduleReason(context.schedule, context.now),
    },
    jenis_pengajuan: JENIS_PENGAJUAN,
    pilihan_topik: PILIHAN_TOPIK,
    tema: themes,
    kandidat_pembimbing: supervisors,
    persyaratan: context.requirements.map((item) => ({
      id: item.id,
      kode_jenis: item.jenis_dokumen.kode_jenis,
      nama_jenis: item.jenis_dokumen.nama_jenis,
      is_wajib: item.is_wajib,
      format_diizinkan: item.jenis_dokumen.format_diizinkan,
      maks_ukuran_mb: item.jenis_dokumen.maks_ukuran_mb,
      petunjuk: item.petunjuk,
      urutan_tampil: item.urutan_tampil,
    })),
    data_diri: {
      status_verifikasi: verification?.status_verifikasi ?? 'BELUM_DIVERIFIKASI',
      jumlah_wajib: REQUIRED_DOCUMENT_CODES.length,
      jumlah_terunggah: REQUIRED_DOCUMENT_CODES.filter((code) => uploadedCodes.has(code)).length,
      lengkap: REQUIRED_DOCUMENT_CODES.every((code) => uploadedCodes.has(code)),
      dokumen_kurang: REQUIRED_DOCUMENT_CODES.filter((code) => !uploadedCodes.has(code)),
    },
  };
}

function summarySelect() {
  return {
    id: true,
    nomor_pengajuan: true,
    jenis_pengajuan: true,
    pilihan_topik: true,
    status_pengajuan: true,
    status_pemeriksaan_berkas: true,
    status_pemeriksaan_akademik: true,
    diajukan_at: true,
    created_at: true,
    updated_at: true,
    periode_akademik: { select: { id: true, tahun_ajaran: true, semester: true } },
    tahap_akademik: { select: { id: true, kode_tahap: true, nama_tahap: true } },
    versi_topik: { select: { id: true, nomor_versi: true, judul_penelitian: true } },
  };
}

export async function listOwnKpApplications(prisma, userId, { page, limit, status }) {
  const student = await ownStudent(prisma, userId);
  const where = {
    mahasiswa_id: student.id,
    jenis_pengajuan: JENIS_PENGAJUAN,
    pilihan_topik: PILIHAN_TOPIK,
    tahap_akademik: { kode_tahap: TAHAP },
    ...(status ? { status_pengajuan: status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.pengajuan.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: summarySelect(),
    }),
    prisma.pengajuan.count({ where }),
  ]);
  return { items, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
}

export async function createKpDraft(prisma, userId, input) {
  const student = await ownStudent(prisma, userId);
  return serializable(prisma, async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261105, ${student.id}::int) IS NULL AS locked`;
    const lockedStudent = await ownStudent(tx, userId);
    const context = await configuredContext(tx, { requireOpen: true });
    const { themeId, supervisorId } = await validateThemeAndSupervisor(tx, lockedStudent, input);
    const existing = await tx.pengajuan.findFirst({
      where: {
        mahasiswa_id: lockedStudent.id,
        tahap_akademik_id: context.schedule.tahap_akademik.id,
        periode_akademik_id: context.schedule.periode_akademik.id,
        jenis_pengajuan: JENIS_PENGAJUAN,
        pilihan_topik: PILIHAN_TOPIK,
      },
      select: { id: true, status_pengajuan: true },
    });
    if (existing) {
      throw new PengajuanKpError(409, 'APPLICATION_ALREADY_EXISTS', 'Pengajuan KP pada periode ini sudah ada.', existing);
    }
    const topic = await tx.topikPenelitian.create({
      data: { mahasiswa_id: lockedStudent.id, tema_penelitian_id: themeId },
      select: { id: true },
    });
    const version = await tx.versiTopik.create({
      data: {
        topik_penelitian_id: topic.id,
        nomor_versi: 1,
        judul_penelitian: input.judul_penelitian,
        objek_penelitian: input.objek_penelitian ?? null,
        lokasi_penelitian: input.lokasi_penelitian ?? null,
      },
      select: { id: true },
    });
    return tx.pengajuan.create({
      data: {
        mahasiswa_id: lockedStudent.id,
        periode_akademik_id: context.schedule.periode_akademik.id,
        tahap_akademik_id: context.schedule.tahap_akademik.id,
        jenis_pengajuan: JENIS_PENGAJUAN,
        pilihan_topik: PILIHAN_TOPIK,
        topik_penelitian_id: topic.id,
        versi_topik_id: version.id,
        usulan_pembimbing_id: supervisorId,
        ipk_saat_pengajuan: input.ipk_saat_pengajuan ?? null,
        jumlah_sks_saat_pengajuan: input.jumlah_sks_saat_pengajuan ?? null,
        memiliki_nilai_de: input.memiliki_nilai_de ?? null,
        daftar_mk_nilai_de: input.daftar_mk_nilai_de ?? null,
        sudah_bayar_spp_variabel: input.sudah_bayar_spp_variabel ?? null,
      },
      select: summarySelect(),
    });
  });
}

async function ownedApplication(prisma, studentId, id, select) {
  const application = await prisma.pengajuan.findFirst({
    where: {
      id,
      mahasiswa_id: studentId,
      jenis_pengajuan: JENIS_PENGAJUAN,
      pilihan_topik: PILIHAN_TOPIK,
      tahap_akademik: { kode_tahap: TAHAP },
    },
    select,
  });
  if (!application) throw new PengajuanKpError(404, 'APPLICATION_NOT_FOUND', 'Pengajuan tidak ditemukan.');
  return application;
}

function detailSelect() {
  return {
    ...summarySelect(),
    topik_penelitian_id: true,
    usulan_pembimbing_id: true,
    ipk_saat_pengajuan: true,
    jumlah_sks_saat_pengajuan: true,
    memiliki_nilai_de: true,
    daftar_mk_nilai_de: true,
    sudah_bayar_spp_variabel: true,
    catatan_pemeriksaan_berkas: true,
    catatan_pemeriksaan_akademik: true,
    catatan_keputusan: true,
    pernyataan_kebenaran_disetujui_at: true,
    topik_penelitian: {
      select: {
        tema_penelitian: { select: { id: true, kode_tema: true, nama_tema: true } },
      },
    },
    versi_topik: {
      select: {
        id: true,
        nomor_versi: true,
        judul_penelitian: true,
        objek_penelitian: true,
        lokasi_penelitian: true,
        status_versi: true,
      },
    },
    usulan_pembimbing: { select: { id: true, kode_dosen: true, nidn: true, nama_lengkap: true } },
    dokumen_pengajuan: {
      orderBy: [{ persyaratan_pengajuan_id: 'asc' }, { nomor_versi: 'desc' }],
      select: {
        id: true,
        nomor_versi: true,
        is_terkini: true,
        status_pemeriksaan: true,
        catatan_pemeriksaan: true,
        created_at: true,
        persyaratan_pengajuan: {
          select: { jenis_dokumen: { select: { kode_jenis: true, nama_jenis: true } } },
        },
        dokumen: { select: { nama_file_asli: true, mime_type: true, ukuran_bytes: true } },
      },
    },
    riwayat_status: {
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        jenis_status: true,
        status_sebelum: true,
        status_sesudah: true,
        catatan: true,
        created_at: true,
      },
    },
    penugasan_dosen: { where: { jenis_penugasan: 'PEMBIMBING', status_penugasan: 'AKTIF' },
      select: { id: true, mulai_at: true, ditetapkan_oleh_user_id: true,
        dosen: { select: { id: true, kode_dosen: true, nama_lengkap: true } } } },
  };
}

function serializeApplication(application) {
  return {
    ...application,
    ipk_saat_pengajuan: application.ipk_saat_pengajuan === null
      ? null
      : Number(application.ipk_saat_pengajuan),
    dokumen_pengajuan: application.dokumen_pengajuan?.map((item) => ({
      ...item,
      id: Number(item.id),
      dokumen: { ...item.dokumen, ukuran_bytes: Number(item.dokumen.ukuran_bytes) },
    })),
    riwayat_status: application.riwayat_status?.map((item) => ({ ...item, id: item.id.toString() })),
    pembimbing: application.penugasan_dosen?.[0] ?? null,
    penugasan_dosen: undefined,
  };
}

export async function getOwnKpApplication(prisma, userId, id) {
  const student = await ownStudent(prisma, userId);
  return serializeApplication(await ownedApplication(prisma, student.id, id, detailSelect()));
}

export async function updateKpDraft(prisma, userId, id, input) {
  return serializable(prisma, async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261108, ${id}::int) IS NULL AS locked`;
    const lockedStudent = await ownStudent(tx, userId);
    const current = await ownedApplication(tx, lockedStudent.id, id, {
      id: true,
      status_pengajuan: true,
      topik_penelitian_id: true,
      usulan_pembimbing_id: true,
      topik_penelitian: { select: { tema_penelitian_id: true } },
      versi_topik: {
        select: {
          id: true,
          nomor_versi: true,
          judul_penelitian: true,
          objek_penelitian: true,
          lokasi_penelitian: true,
        },
      },
    });
    if (current.status_pengajuan !== STATUS_DRAFT) {
      throw new PengajuanKpError(409, 'APPLICATION_LOCKED', 'Pengajuan yang sudah dikirim tidak dapat diubah.');
    }
    const { themeId, supervisorId } = await validateThemeAndSupervisor(tx, lockedStudent, input, {
      tema_penelitian_id: current.topik_penelitian.tema_penelitian_id,
      usulan_pembimbing_id: current.usulan_pembimbing_id,
    });
    let topicId = current.topik_penelitian_id;
    let versionId = current.versi_topik.id;
    const versionValues = {
      judul_penelitian: input.judul_penelitian ?? current.versi_topik.judul_penelitian,
      objek_penelitian: Object.hasOwn(input, 'objek_penelitian')
        ? input.objek_penelitian
        : current.versi_topik.objek_penelitian,
      lokasi_penelitian: Object.hasOwn(input, 'lokasi_penelitian')
        ? input.lokasi_penelitian
        : current.versi_topik.lokasi_penelitian,
    };
    const themeChanged = themeId !== current.topik_penelitian.tema_penelitian_id;
    const versionChanged = ['judul_penelitian', 'objek_penelitian', 'lokasi_penelitian']
      .some((field) => Object.hasOwn(input, field) && versionValues[field] !== current.versi_topik[field]);
    if (themeChanged) {
      const topic = await tx.topikPenelitian.create({
        data: { mahasiswa_id: lockedStudent.id, tema_penelitian_id: themeId },
        select: { id: true },
      });
      topicId = topic.id;
      const version = await tx.versiTopik.create({
        data: { topik_penelitian_id: topicId, nomor_versi: 1, ...versionValues },
        select: { id: true },
      });
      versionId = version.id;
    } else if (versionChanged) {
      const version = await tx.versiTopik.create({
        data: {
          topik_penelitian_id: topicId,
          nomor_versi: current.versi_topik.nomor_versi + 1,
          ...versionValues,
        },
        select: { id: true },
      });
      versionId = version.id;
    }
    await tx.pengajuan.update({
      where: { id },
      data: {
        topik_penelitian_id: topicId,
        versi_topik_id: versionId,
        usulan_pembimbing_id: supervisorId,
        ...(Object.hasOwn(input, 'ipk_saat_pengajuan')
          ? { ipk_saat_pengajuan: input.ipk_saat_pengajuan }
          : {}),
        ...(Object.hasOwn(input, 'jumlah_sks_saat_pengajuan')
          ? { jumlah_sks_saat_pengajuan: input.jumlah_sks_saat_pengajuan }
          : {}),
        ...(Object.hasOwn(input, 'memiliki_nilai_de')
          ? { memiliki_nilai_de: input.memiliki_nilai_de }
          : {}),
        ...(Object.hasOwn(input, 'daftar_mk_nilai_de')
          ? { daftar_mk_nilai_de: input.daftar_mk_nilai_de }
          : {}),
        ...(Object.hasOwn(input, 'sudah_bayar_spp_variabel')
          ? { sudah_bayar_spp_variabel: input.sudah_bayar_spp_variabel }
          : {}),
      },
    });
    return serializeApplication(await ownedApplication(tx, lockedStudent.id, id, detailSelect()));
  });
}

function mayUpload(application) {
  return application.status_pengajuan === STATUS_DRAFT ||
    (application.status_pengajuan === STATUS_DIAJUKAN &&
      application.status_pemeriksaan_berkas === 'BELUM_OK');
}

export async function reviseOwnKpApplication(prisma, userId, id, input) {
  return serializable(prisma, async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261108, ${id}::int) IS NULL AS locked`;
    const student = await ownStudent(tx, userId);
    const current = await ownedApplication(tx, student.id, id, {
      id: true, status_pengajuan: true, status_pemeriksaan_berkas: true,
      status_pemeriksaan_akademik: true, topik_penelitian_id: true,
      versi_topik: { select: { id: true, nomor_versi: true, judul_penelitian: true,
        objek_penelitian: true, lokasi_penelitian: true } },
      ipk_saat_pengajuan: true, jumlah_sks_saat_pengajuan: true,
      memiliki_nilai_de: true, daftar_mk_nilai_de: true,
    });
    if (current.status_pengajuan !== STATUS_DIAJUKAN) {
      throw new PengajuanKpError(409, 'APPLICATION_LOCKED', 'Pengajuan tidak dapat diperbaiki.');
    }
    const titleFields = ['judul_penelitian', 'objek_penelitian', 'lokasi_penelitian'];
    const valueFields = ['ipk_saat_pengajuan', 'jumlah_sks_saat_pengajuan',
      'memiliki_nilai_de', 'daftar_mk_nilai_de'];
    const fields = Object.keys(input);
    if (!fields.length || fields.some((field) => ![...titleFields, ...valueFields].includes(field)) ||
      fields.some((field) => titleFields.includes(field)) && current.status_pemeriksaan_berkas !== 'BELUM_OK' ||
      fields.some((field) => valueFields.includes(field)) && current.status_pemeriksaan_akademik !== 'BELUM_OK') {
      throw new PengajuanKpError(409, 'REVISION_NOT_ALLOWED', 'Kategori tersebut tidak terbuka untuk perbaikan.');
    }
    const changes = fields.filter((field) => {
      const oldValue = titleFields.includes(field) ? current.versi_topik[field] : current[field];
      return String(oldValue ?? '') !== String(input[field] ?? '');
    });
    if (!changes.length) throw new PengajuanKpError(409, 'NO_REVISION', 'Tidak ada perubahan data.');
    const titleChanges = changes.filter((field) => titleFields.includes(field));
    if (titleChanges.length) {
      const next = await tx.versiTopik.create({ data: {
        topik_penelitian_id: current.topik_penelitian_id,
        nomor_versi: current.versi_topik.nomor_versi + 1,
        judul_penelitian: input.judul_penelitian ?? current.versi_topik.judul_penelitian,
        objek_penelitian: Object.hasOwn(input, 'objek_penelitian')
          ? input.objek_penelitian : current.versi_topik.objek_penelitian,
        lokasi_penelitian: Object.hasOwn(input, 'lokasi_penelitian')
          ? input.lokasi_penelitian : current.versi_topik.lokasi_penelitian,
      }, select: { id: true } });
      await tx.pengajuan.update({ where: { id }, data: { versi_topik_id: next.id } });
      await tx.auditLog.create({ data: {
        aktor_user_id: userId, aksi: 'KP_REVISI_BERKAS', entitas: 'Pengajuan', entitas_id: BigInt(id),
        data_sebelum: { versi_topik_id: current.versi_topik.id },
        data_sesudah: { versi_topik_id: next.id, fields: titleChanges },
      } });
    }
    const valueChanges = changes.filter((field) => valueFields.includes(field));
    if (valueChanges.length) {
      const before = Object.fromEntries(valueChanges.map((field) =>
        [field, field === 'ipk_saat_pengajuan' && current[field] !== null
          ? Number(current[field]) : current[field]]));
      await tx.pengajuan.update({ where: { id }, data: Object.fromEntries(
        valueChanges.map((field) => [field, input[field]]),
      ) });
      await tx.auditLog.create({ data: {
        aktor_user_id: userId, aksi: 'KP_REVISI_NILAI', entitas: 'Pengajuan', entitas_id: BigInt(id),
        data_sebelum: before,
        data_sesudah: Object.fromEntries(valueChanges.map((field) => [field, input[field]])),
      } });
    }
    return { id, changed_fields: changes, status_pengajuan: STATUS_DIAJUKAN };
  });
}

export function sendOwnKpRevision(prisma, userId, id, categories) {
  return afterKpChange(prisma, 'pengajuan.administration.updated',
    () => sendRevision(prisma, userId, id, categories), [id]);
}

async function sendRevision(prisma, userId, id, categories) {
  return serializable(prisma, async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261108, ${id}::int) IS NULL AS locked`;
    const student = await ownStudent(tx, userId);
    const current = await ownedApplication(tx, student.id, id, {
      id: true, status_pengajuan: true, status_pemeriksaan_berkas: true,
      status_pemeriksaan_akademik: true, diperiksa_berkas_at: true,
      akademik_diperiksa_at: true,
    });
    if (current.status_pengajuan !== STATUS_DIAJUKAN) {
      throw new PengajuanKpError(409, 'APPLICATION_LOCKED', 'Pengajuan tidak dapat diperbaiki.');
    }
    const audit = await tx.auditLog.findMany({
      where: { entitas: 'Pengajuan', entitas_id: BigInt(id),
        aksi: { in: categories.map((category) => `KP_REVISI_${category}`) } },
      orderBy: { created_at: 'desc' },
      select: { aksi: true, created_at: true },
    });
    for (const category of categories) {
      const berkas = category === 'BERKAS';
      const status = berkas ? current.status_pemeriksaan_berkas : current.status_pemeriksaan_akademik;
      const reviewedAt = berkas ? current.diperiksa_berkas_at : current.akademik_diperiksa_at;
      const revised = audit.find((item) => item.aksi === `KP_REVISI_${category}`);
      if (status !== 'BELUM_OK' || !revised || !reviewedAt || revised.created_at <= reviewedAt) {
        throw new PengajuanKpError(409, 'REVISION_NOT_READY', `Perbaikan ${category} belum dapat dikirim.`);
      }
    }
    const now = new Date();
    for (const category of categories) {
      const berkas = category === 'BERKAS';
      await tx.pengajuan.update({ where: { id }, data: berkas
        ? { status_pemeriksaan_berkas: 'BELUM_DIPERIKSA' }
        : { status_pemeriksaan_akademik: 'BELUM_DIPERIKSA' } });
      await tx.riwayatStatusPengajuan.create({ data: {
        pengajuan_id: id, jenis_status: category, status_sebelum: 'BELUM_OK',
        status_sesudah: 'BELUM_DIPERIKSA', diubah_oleh_user_id: userId,
        catatan: 'Perbaikan dikirim oleh mahasiswa.', created_at: now,
      } });
    }
    return { id, status_pengajuan: STATUS_DIAJUKAN, kategori_dikirim: categories };
  });
}

export async function uploadKpDocument(prisma, userId, id, code, file) {
  const student = await ownStudent(prisma, userId);
  const application = await ownedApplication(prisma, student.id, id, {
    id: true,
    status_pengajuan: true,
    status_pemeriksaan_berkas: true,
    periode_akademik_id: true,
    tahap_akademik_id: true,
    jenis_pengajuan: true,
    pilihan_topik: true,
  });
  if (!mayUpload(application)) {
    throw new PengajuanKpError(409, 'APPLICATION_LOCKED', 'Pengajuan yang sudah dikirim tidak dapat diubah.');
  }
  const requirement = await prisma.persyaratanPengajuan.findFirst({
    where: {
      periode_akademik_id: application.periode_akademik_id,
      tahap_akademik_id: application.tahap_akademik_id,
      jenis_pengajuan: application.jenis_pengajuan,
      pilihan_topik: application.pilihan_topik,
      is_aktif: true,
      jenis_dokumen: { kode_jenis: code, is_aktif: true },
    },
    select: {
      id: true,
      jenis_dokumen: {
        select: { kode_jenis: true, format_diizinkan: true, maks_ukuran_mb: true },
      },
    },
  });
  if (!requirement) {
    throw new PengajuanKpError(400, 'INVALID_DOCUMENT_TYPE', 'Jenis dokumen bukan persyaratan pengajuan ini.');
  }
  let originalName;
  try {
    originalName = await validatePdfDocument(file, requirement.jenis_dokumen, MAX_UPLOAD_BYTES);
  } catch (error) {
    throw translatedStorageError(error);
  }
  const storageKey = `pengajuan/${randomUUID()}.pdf`;
  try {
    await writePrivateDocument(storageKey, file.buffer);
    return await serializable(prisma, async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261108, ${id}::int) IS NULL AS locked`;
      const lockedStudent = await ownStudent(tx, userId);
      const locked = await ownedApplication(tx, lockedStudent.id, id, {
        id: true,
        status_pengajuan: true,
        status_pemeriksaan_berkas: true,
        periode_akademik_id: true,
        tahap_akademik_id: true,
        jenis_pengajuan: true,
        pilihan_topik: true,
      });
      if (!mayUpload(locked)) {
        throw new PengajuanKpError(409, 'APPLICATION_LOCKED', 'Pengajuan yang sudah dikirim tidak dapat diubah.');
      }
      const activeRequirement = await tx.persyaratanPengajuan.findFirst({
        where: {
          id: requirement.id,
          periode_akademik_id: locked.periode_akademik_id,
          tahap_akademik_id: locked.tahap_akademik_id,
          jenis_pengajuan: locked.jenis_pengajuan,
          pilihan_topik: locked.pilihan_topik,
          is_aktif: true,
          jenis_dokumen: { kode_jenis: code, is_aktif: true },
        },
        select: { id: true },
      });
      if (!activeRequirement) {
        throw new PengajuanKpError(409, 'APPLICATION_CONTEXT_CHANGED', 'Persyaratan pengajuan telah berubah.');
      }
      const current = await tx.dokumenPengajuan.findFirst({
        where: { pengajuan_id: id, persyaratan_pengajuan_id: requirement.id, is_terkini: true },
        select: { id: true, nomor_versi: true },
      });
      if (current) {
        await tx.dokumenPengajuan.update({ where: { id: current.id }, data: { is_terkini: false } });
      }
      const document = await tx.dokumen.create({
        data: {
          diunggah_oleh_user_id: userId,
          nama_file_asli: originalName,
          storage_key: storageKey,
          mime_type: 'application/pdf',
          ukuran_bytes: BigInt(file.buffer.length),
          checksum_sha256: createHash('sha256').update(file.buffer).digest('hex'),
        },
        select: { id: true },
      });
      const version = await tx.dokumenPengajuan.create({
        data: {
          pengajuan_id: id,
          persyaratan_pengajuan_id: requirement.id,
          dokumen_id: document.id,
          nomor_versi: (current?.nomor_versi ?? 0) + 1,
        },
        select: { id: true, nomor_versi: true, is_terkini: true, status_pemeriksaan: true },
      });
      if (locked.status_pengajuan === STATUS_DIAJUKAN) {
        await tx.auditLog.create({ data: {
          aktor_user_id: userId,
          aksi: 'KP_REVISI_BERKAS', entitas: 'Pengajuan', entitas_id: BigInt(id),
          data_sebelum: { dokumen_pengajuan_id: current?.id ?? null },
          data_sesudah: { dokumen_pengajuan_id: version.id, kode_jenis: code },
        } });
      }
      return { ...version, kode_jenis: code };
    });
  } catch (error) {
    await removePrivateDocument(storageKey).catch(() => {});
    if (error?.code === 'P2002' || error?.code === 'P2034') {
      throw new PengajuanKpError(409, 'DOCUMENT_CONFLICT', 'Unggah bersamaan; silakan coba lagi.');
    }
    throw translatedStorageError(error);
  }
}

export async function downloadKpDocument(prisma, userId, id, documentId) {
  const student = await ownStudent(prisma, userId);
  await ownedApplication(prisma, student.id, id, { id: true });
  const linked = await prisma.dokumenPengajuan.findFirst({
    where: { id: documentId, pengajuan_id: id },
    select: {
      dokumen: { select: { storage_key: true, nama_file_asli: true, mime_type: true } },
    },
  });
  if (!linked) throw new PengajuanKpError(404, 'DOCUMENT_NOT_FOUND', 'Dokumen tidak ditemukan.');
  try {
    return {
      bytes: await readPrivateDocument(linked.dokumen.storage_key),
      filename: linked.dokumen.nama_file_asli,
      mimeType: linked.dokumen.mime_type,
    };
  } catch (error) {
    throw translatedStorageError(error);
  }
}

function requireSubmitForm(application) {
  const missing = [];
  if (!application.topik_penelitian?.tema_penelitian?.is_aktif) missing.push('tema_penelitian_id');
  if (!application.versi_topik?.judul_penelitian?.trim()) missing.push('judul_penelitian');
  if (!application.versi_topik?.objek_penelitian?.trim()) missing.push('objek_penelitian');
  if (!application.versi_topik?.lokasi_penelitian?.trim()) missing.push('lokasi_penelitian');
  if (!application.usulan_pembimbing) missing.push('usulan_pembimbing_id');
  const ipk = application.ipk_saat_pengajuan === null ? null : Number(application.ipk_saat_pengajuan);
  if (ipk === null || !Number.isFinite(ipk) || ipk < 0 || ipk > 4) missing.push('ipk_saat_pengajuan');
  if (!Number.isInteger(application.jumlah_sks_saat_pengajuan) || application.jumlah_sks_saat_pengajuan < 0) {
    missing.push('jumlah_sks_saat_pengajuan');
  }
  if (typeof application.memiliki_nilai_de !== 'boolean') missing.push('memiliki_nilai_de');
  if (application.memiliki_nilai_de === true && !application.daftar_mk_nilai_de?.trim()) {
    missing.push('daftar_mk_nilai_de');
  }
  if (typeof application.sudah_bayar_spp_variabel !== 'boolean') missing.push('sudah_bayar_spp_variabel');
  if (missing.length) {
    throw new PengajuanKpError(422, 'INCOMPLETE_FORM', 'Formulir pengajuan belum lengkap.', { missing });
  }
}

function requireSubmitDocuments(application, requirements) {
  const currentCodes = new Set(application.dokumen_pengajuan.map(
    (item) => item.persyaratan_pengajuan.jenis_dokumen.kode_jenis,
  ));
  const configured = new Set(requirements.map((item) => item.jenis_dokumen.kode_jenis));
  const missing = REQUIRED_KP_DOCUMENTS.filter((code) => configured.has(code) && !currentCodes.has(code));
  if (application.sudah_bayar_spp_variabel && !currentCodes.has(SPP_DOCUMENT)) missing.push(SPP_DOCUMENT);
  if (!SOCIAL_DOCUMENTS.some((code) => currentCodes.has(code))) {
    missing.push(`${SOCIAL_DOCUMENTS[0]}|${SOCIAL_DOCUMENTS[1]}`);
  }
  if (!application.sudah_bayar_spp_variabel && currentCodes.has(SPP_DOCUMENT)) {
    throw new PengajuanKpError(
      422,
      'INCONSISTENT_SPP_DECLARATION',
      'Deklarasi SPP tidak konsisten dengan bukti yang diunggah.',
    );
  }
  if (missing.length) {
    throw new PengajuanKpError(422, 'INCOMPLETE_DOCUMENTS', 'Dokumen pengajuan belum lengkap.', { missing });
  }
}

export function submitKpApplication(prisma, userId, id, setujuPernyataan) {
  return afterKpChange(prisma, 'pengajuan.administration.updated',
    () => submitApplication(prisma, userId, id, setujuPernyataan), [id]);
}

async function submitApplication(prisma, userId, id, setujuPernyataan) {
  if (setujuPernyataan !== true) {
    throw new PengajuanKpError(400, 'STATEMENT_REQUIRED', 'Pernyataan kebenaran data wajib disetujui.');
  }
  return serializable(prisma, async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261108, ${id}::int) IS NULL AS locked`;
    const lockedStudent = await ownStudent(tx, userId);
    const application = await ownedApplication(tx, lockedStudent.id, id, {
      id: true,
      status_pengajuan: true,
      periode_akademik_id: true,
      tahap_akademik_id: true,
      jenis_pengajuan: true,
      pilihan_topik: true,
      ipk_saat_pengajuan: true,
      jumlah_sks_saat_pengajuan: true,
      memiliki_nilai_de: true,
      daftar_mk_nilai_de: true,
      sudah_bayar_spp_variabel: true,
      status_pemeriksaan_berkas: true,
      status_pemeriksaan_akademik: true,
      diajukan_at: true,
      pernyataan_kebenaran_disetujui_at: true,
      topik_penelitian: { select: { tema_penelitian: { select: { is_aktif: true } } } },
      versi_topik: {
        select: { judul_penelitian: true, objek_penelitian: true, lokasi_penelitian: true },
      },
      usulan_pembimbing: {
        select: {
          id: true,
          program_studi_id: true,
          status_data: true,
          user: { select: { status_akun: true } },
        },
      },
      dokumen_pengajuan: {
        where: { is_terkini: true },
        select: {
          id: true,
          persyaratan_pengajuan: {
            select: { jenis_dokumen: { select: { kode_jenis: true } } },
          },
        },
      },
    });
    if (application.status_pengajuan === STATUS_DIAJUKAN) {
      return {
        id: application.id,
        status_pengajuan: application.status_pengajuan,
        diajukan_at: application.diajukan_at,
        pernyataan_kebenaran_disetujui_at: application.pernyataan_kebenaran_disetujui_at,
        idempotent: true,
      };
    }
    if (application.status_pengajuan !== STATUS_DRAFT) {
      throw new PengajuanKpError(409, 'INVALID_STATUS_TRANSITION', 'Status pengajuan tidak dapat dikirim.');
    }
    const context = await configuredContext(tx, { requireOpen: true });
    if (
      application.periode_akademik_id !== context.schedule.periode_akademik.id ||
      application.tahap_akademik_id !== context.schedule.tahap_akademik.id ||
      application.jenis_pengajuan !== JENIS_PENGAJUAN ||
      application.pilihan_topik !== PILIHAN_TOPIK
    ) {
      throw new PengajuanKpError(409, 'APPLICATION_CONTEXT_CHANGED', 'Konteks pengajuan tidak lagi sesuai konfigurasi aktif.');
    }
    if (
      application.usulan_pembimbing?.program_studi_id !== lockedStudent.program_studi_id ||
      application.usulan_pembimbing?.status_data !== 'AKTIF' ||
      application.usulan_pembimbing?.user.status_akun !== 'AKTIF'
    ) {
      application.usulan_pembimbing = null;
    }
    requireSubmitForm(application);

    const verification = await tx.verifikasiDataDiri.findUnique({
      where: { mahasiswa_id: lockedStudent.id },
      select: {
        dokumen_data_diri: {
          where: { is_terkini: true, jenis_dokumen: { kode_jenis: { in: REQUIRED_DOCUMENT_CODES } } },
          select: { jenis_dokumen: { select: { kode_jenis: true } } },
        },
      },
    });
    const dataDiriCodes = new Set(verification?.dokumen_data_diri.map(
      (item) => item.jenis_dokumen.kode_jenis,
    ) ?? []);
    const missingDataDiri = REQUIRED_DOCUMENT_CODES.filter((code) => !dataDiriCodes.has(code));
    if (missingDataDiri.length) {
      throw new PengajuanKpError(422, 'INCOMPLETE_PERSONAL_DOCUMENTS', 'Dokumen Data Diri belum lengkap.', {
        missing: missingDataDiri,
      });
    }
    requireSubmitDocuments(application, context.requirements);

    const duplicate = await tx.pengajuan.findFirst({
      where: {
        id: { not: id },
        mahasiswa_id: lockedStudent.id,
        tahap_akademik_id: application.tahap_akademik_id,
        periode_akademik_id: application.periode_akademik_id,
        jenis_pengajuan: JENIS_PENGAJUAN,
        pilihan_topik: PILIHAN_TOPIK,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new PengajuanKpError(409, 'APPLICATION_ALREADY_EXISTS', 'Pengajuan KP pada periode ini sudah ada.');
    }
    if (
      application.status_pemeriksaan_berkas !== 'BELUM_DIPERIKSA' ||
      application.status_pemeriksaan_akademik !== 'BELUM_DIPERIKSA'
    ) {
      throw new PengajuanKpError(409, 'REVIEW_STATUS_CHANGED', 'Status pemeriksaan draft tidak valid.');
    }
    const serverTimestamp = new Date();
    const updated = await tx.pengajuan.update({
      where: { id },
      data: {
        status_pengajuan: STATUS_DIAJUKAN,
        diajukan_at: serverTimestamp,
        pernyataan_kebenaran_disetujui_at: serverTimestamp,
      },
      select: {
        id: true,
        status_pengajuan: true,
        status_pemeriksaan_berkas: true,
        status_pemeriksaan_akademik: true,
        diajukan_at: true,
        pernyataan_kebenaran_disetujui_at: true,
      },
    });
    await tx.riwayatStatusPengajuan.create({
      data: {
        pengajuan_id: id,
        jenis_status: JENIS_STATUS,
        status_sebelum: STATUS_DRAFT,
        status_sesudah: STATUS_DIAJUKAN,
        diubah_oleh_user_id: userId,
        catatan: 'Pengajuan dikirim oleh mahasiswa.',
      },
    });
    const [admins, kaprodis] = await Promise.all([
      staffRecipients(tx, lockedStudent.program_studi_id, 'ADMIN_PRODI'),
      staffRecipients(tx, lockedStudent.program_studi_id, 'KAPRODI'),
    ]);
    // Separate routes keep each role's notification actionable.
    await createNotifikasi(tx, { kategori: 'PENGAJUAN_KP', judul: 'Pengajuan KP baru',
      pesan: 'Pengajuan KP baru siap diperiksa.', route: '/admin-prodi/verifikasi-pengajuan-kp',
      actorUserId: userId, recipientIds: admins });
    await createNotifikasi(tx, { kategori: 'PENGAJUAN_KP', judul: 'Pengajuan KP baru',
      pesan: 'Pengajuan KP baru tersedia untuk penugasan Reviewer.',
      route: '/kaprodi/kp/penugasan-reviewer', actorUserId: userId, recipientIds: kaprodis.filter((id) => !admins.includes(id)) });
    return { ...updated, idempotent: false };
  });
}
