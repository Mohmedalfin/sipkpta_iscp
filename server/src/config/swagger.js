import swaggerJSDoc from 'swagger-jsdoc';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'SIPKITA REST API',
    version: '1.0.0',
    description:
      'Dokumentasi resmi REST API Sistem Informasi Pengelolaan Kerja Praktik (KP), Information Systems Capstone Project (ISCP), dan Tugas Akhir (TA) — Program Studi Sistem Informasi.',
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Server Development Lokal',
    },
  ],
  tags: [
    {
      name: 'Auth',
      description: 'Autentikasi akun, sesi login JWT, pergantian active role, dan reset password.',
    },
    {
      name: 'Master Mahasiswa',
      description: 'Pengelolaan data induk profil mahasiswa, akun pengguna terkait, dan impor data massal (Kewenangan: ADMIN_PRODI).',
    },
    {
      name: 'Master Dosen',
      description: 'Pengelolaan data induk profil dosen, status akun, penghapusan aman, dan impor data massal (Kewenangan: ADMIN_PRODI).',
    },
    {
      name: 'Verifikasi Data Diri',
      description: 'Pemeriksaan berkas data diri mahasiswa, pengunduhan berkas privat, verifikasi individual per berkas, dan persetujuan massal 6 dokumen identitas (Kewenangan: ADMIN_PRODI).',
    },
    {
      name: 'Data Diri Mahasiswa',
      description: 'Pengelolaan data diri, pembaruan kontak profil, pemantauan kelengkapan status berkas, dan pengunggahan berkas PDF 6 dokumen identitas wajib (Kewenangan: MAHASISWA).',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Masukkan Access Token JWT yang diperoleh saat login atau refresh.',
      },
    },
    schemas: {
      ApiResponseSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
        },
      },
      ApiResponseError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Data permintaan tidak valid.' },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total_items: { type: 'integer', example: 45 },
              total_pages: { type: 'integer', example: 3 },
            },
            required: ['page', 'limit', 'total_items', 'total_pages'],
          },
        },
      },
      RoleInfo: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 2 },
          kode_peran: { type: 'string', example: 'MAHASISWA' },
          nama_peran: { type: 'string', example: 'Mahasiswa' },
        },
      },
      UserInfo: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 10 },
          login_id: { type: 'string', example: '2111522001' },
          email: { type: 'string', format: 'email', example: 'mahasiswa@sipkita.test' },
          status_akun: { type: 'string', enum: ['AKTIF', 'NONAKTIF'], example: 'AKTIF' },
          roles: {
            type: 'array',
            items: { $ref: '#/components/schemas/RoleInfo' },
          },
          active_role: { $ref: '#/components/schemas/RoleInfo' },
        },
      },
      ProgramStudiInfo: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          kode_prodi: { type: 'string', example: 'SI' },
          nama_prodi: { type: 'string', example: 'Sistem Informasi' },
        },
      },
      MahasiswaProfile: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          user_id: { type: 'integer', example: 12 },
          program_studi_id: { type: 'integer', example: 1 },
          nim: { type: 'string', example: '2111522001' },
          nama_lengkap: { type: 'string', example: 'Ahmad Fauzan' },
          nik_kependudukan: { type: 'string', nullable: true, example: '1371011708030001' },
          tempat_lahir: { type: 'string', nullable: true, example: 'Padang' },
          tanggal_lahir: { type: 'string', format: 'date-time', example: '2003-08-17T00:00:00.000Z' },
          no_telepon: { type: 'string', nullable: true, example: '081234567890' },
          alamat: { type: 'string', nullable: true, example: 'Jl. Kampus Limau Manis' },
          tahun_angkatan: { type: 'integer', nullable: true, example: 2023 },
          status_data: { type: 'string', example: 'AKTIF' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          email: { type: 'string', format: 'email', example: 'fauzan@sipkita.test' },
          status_akun: { type: 'string', enum: ['AKTIF', 'NONAKTIF'], example: 'AKTIF' },
          program_studi: { $ref: '#/components/schemas/ProgramStudiInfo' },
        },
      },
      DosenProfile: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          user_id: { type: 'integer', example: 8 },
          program_studi_id: { type: 'integer', example: 1 },
          kode_dosen: { type: 'string', example: 'DSN001' },
          nidn: { type: 'string', nullable: true, example: '0014058201' },
          nama_lengkap: { type: 'string', example: 'Dr. Eng. Andi Pratama, S.T., M.T.' },
          no_telepon: { type: 'string', nullable: true, example: '081234567890' },
          tanggal_lahir: { type: 'string', format: 'date-time', example: '1982-05-14T00:00:00.000Z' },
          jabatan_fungsional: { type: 'string', nullable: true, example: 'Lektor Kepala' },
          is_homebase_si: { type: 'boolean', example: true },
          status_data: { type: 'string', example: 'AKTIF' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          email: { type: 'string', format: 'email', example: 'dosen.andi@sipkita.test' },
          status_akun: { type: 'string', enum: ['AKTIF', 'NONAKTIF'], example: 'AKTIF' },
          program_studi: { $ref: '#/components/schemas/ProgramStudiInfo' },
        },
      },
      ImportPreviewResult: {
        type: 'object',
        properties: {
          previewId: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
          batchId: { type: 'integer', example: 1 },
          totalRows: { type: 'integer', example: 50 },
          validRows: { type: 'integer', example: 48 },
          errorRows: { type: 'integer', example: 2 },
          expiresAt: { type: 'string', format: 'date-time' },
          sampleValid: { type: 'array', items: { type: 'object' } },
          sampleErrors: { type: 'array', items: { type: 'object' } },
        },
      },
      ImportConfirmResult: {
        type: 'object',
        properties: {
          batchId: { type: 'integer', example: 1 },
          totalImported: { type: 'integer', example: 48 },
          status: { type: 'string', example: 'SELESAI' },
        },
      },
      VerifikasiDataDiriListItem: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nim: { type: 'string', example: '2111522001' },
          nama_lengkap: { type: 'string', example: 'Ahmad Fauzan' },
          status_data: { type: 'string', example: 'AKTIF' },
          status_akun: { type: 'string', enum: ['AKTIF', 'NONAKTIF'], example: 'AKTIF' },
          program_studi: { $ref: '#/components/schemas/ProgramStudiInfo' },
          status_verifikasi: {
            type: 'string',
            enum: ['BELUM_LENGKAP', 'BELUM_DIVERIFIKASI', 'PERLU_PERBAIKAN', 'TERVERIFIKASI'],
            example: 'BELUM_DIVERIFIKASI',
          },
          jumlah_terunggah: { type: 'integer', example: 6 },
          jumlah_wajib: { type: 'integer', example: 6 },
          lengkap: { type: 'boolean', example: true },
          diperiksa_at: { type: 'string', format: 'date-time', nullable: true },
          diverifikasi_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      DokumenFileInfo: {
        type: 'object',
        properties: {
          nama_file_asli: { type: 'string', example: 'ktp_fauzan.pdf' },
          mime_type: { type: 'string', example: 'application/pdf' },
          ukuran_bytes: { type: 'integer', example: 1048576 },
          diunggah_at: { type: 'string', format: 'date-time', example: '2026-11-04T08:00:00.000Z' },
        },
      },
      PemeriksaInfo: {
        type: 'object',
        nullable: true,
        properties: {
          id: { type: 'integer', example: 5 },
          login_id: { type: 'string', example: 'admin.prodi' },
        },
      },
      DokumenDetailVersion: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 12 },
          versi: { type: 'integer', example: 1 },
          is_terkini: { type: 'boolean', example: true },
          status_dokumen: {
            type: 'string',
            enum: ['BELUM_DIPERIKSA', 'TERVERIFIKASI', 'PERLU_PERBAIKAN'],
            example: 'BELUM_DIPERIKSA',
          },
          catatan_admin: { type: 'string', nullable: true, example: null },
          diperiksa_at: { type: 'string', format: 'date-time', nullable: true },
          pemeriksa: { $ref: '#/components/schemas/PemeriksaInfo' },
          file: { $ref: '#/components/schemas/DokumenFileInfo' },
        },
      },
      VerifikasiDokumenDetailItem: {
        type: 'object',
        properties: {
          kode_jenis: {
            type: 'string',
            enum: ['IJAZAH', 'KK', 'KTP', 'AKTA', 'KTM', 'FORM_DATA_DIRI'],
            example: 'KTP',
          },
          nama_jenis: { type: 'string', example: 'Kartu Tanda Penduduk' },
          is_uploaded: { type: 'boolean', example: true },
          dokumen_terkini: {
            allOf: [{ $ref: '#/components/schemas/DokumenDetailVersion' }],
            nullable: true,
          },
          riwayat_versi: {
            type: 'array',
            items: { $ref: '#/components/schemas/DokumenDetailVersion' },
          },
        },
      },
      VerifikasiDataDiriDetail: {
        type: 'object',
        properties: {
          mahasiswa: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              nim: { type: 'string', example: '2111522001' },
              nama_lengkap: { type: 'string', example: 'Ahmad Fauzan' },
              status_data: { type: 'string', example: 'AKTIF' },
              status_akun: { type: 'string', enum: ['AKTIF', 'NONAKTIF'], example: 'AKTIF' },
              program_studi: { $ref: '#/components/schemas/ProgramStudiInfo' },
            },
          },
          verifikasi: {
            type: 'object',
            properties: {
              status_verifikasi: {
                type: 'string',
                enum: ['BELUM_LENGKAP', 'BELUM_DIVERIFIKASI', 'PERLU_PERBAIKAN', 'TERVERIFIKASI'],
                example: 'BELUM_DIVERIFIKASI',
              },
              catatan_admin: { type: 'string', nullable: true, example: null },
              diajukan_at: { type: 'string', format: 'date-time', nullable: true },
              diperiksa_at: { type: 'string', format: 'date-time', nullable: true },
              diverifikasi_at: { type: 'string', format: 'date-time', nullable: true },
              pemeriksa: { $ref: '#/components/schemas/PemeriksaInfo' },
            },
          },
          kelengkapan: {
            type: 'object',
            properties: {
              jumlah_wajib: { type: 'integer', example: 6 },
              jumlah_terunggah: { type: 'integer', example: 6 },
              lengkap: { type: 'boolean', example: true },
            },
          },
          dokumen: {
            type: 'array',
            items: { $ref: '#/components/schemas/VerifikasiDokumenDetailItem' },
          },
        },
      },
      VerifikasiKeputusanRequest: {
        type: 'object',
        required: ['status', 'expectedVersion'],
        properties: {
          status: {
            type: 'string',
            enum: ['TERVERIFIKASI', 'PERLU_PERBAIKAN'],
            example: 'PERLU_PERBAIKAN',
            description: 'Status verifikasi yang diputuskan untuk versi terkini.',
          },
          catatan: {
            type: 'string',
            nullable: true,
            maxLength: 2000,
            example: 'Foto KTP buram dan nomor NIK tidak terbaca jelas.',
            description: 'Catatan perbaikan. Wajib diisi bila status bernilai PERLU_PERBAIKAN.',
          },
          expectedVersion: {
            type: 'integer',
            minimum: 1,
            example: 1,
            description: 'Nomor versi dokumen yang dilihat oleh admin untuk mencegah konflik/race condition.',
          },
        },
      },
      VerifikasiKeputusanResponse: {
        type: 'object',
        properties: {
          kode_jenis: { type: 'string', example: 'KTP' },
          versi: { type: 'integer', example: 1 },
          status_dokumen: {
            type: 'string',
            enum: ['TERVERIFIKASI', 'PERLU_PERBAIKAN'],
            example: 'PERLU_PERBAIKAN',
          },
          catatan_admin: { type: 'string', nullable: true, example: 'Foto KTP buram dan nomor NIK tidak terbaca jelas.' },
          status_verifikasi: {
            type: 'string',
            enum: ['BELUM_LENGKAP', 'BELUM_DIVERIFIKASI', 'PERLU_PERBAIKAN', 'TERVERIFIKASI'],
            example: 'PERLU_PERBAIKAN',
          },
          idempotent: { type: 'boolean', example: false },
        },
      },
      VerifikasiSemuaRequest: {
        type: 'object',
        required: ['expectedVersions'],
        properties: {
          expectedVersions: {
            type: 'object',
            required: ['IJAZAH', 'KK', 'KTP', 'AKTA', 'KTM', 'FORM_DATA_DIRI'],
            properties: {
              IJAZAH: { type: 'integer', minimum: 1, example: 1 },
              KK: { type: 'integer', minimum: 1, example: 1 },
              KTP: { type: 'integer', minimum: 1, example: 2 },
              AKTA: { type: 'integer', minimum: 1, example: 1 },
              KTM: { type: 'integer', minimum: 1, example: 1 },
              FORM_DATA_DIRI: { type: 'integer', minimum: 1, example: 1 },
            },
            description: 'Peta nomor versi terkini dari tepat keenam jenis dokumen wajib yang sedang dilihat oleh admin.',
          },
        },
      },
      VerifikasiSemuaResponse: {
        type: 'object',
        properties: {
          status_verifikasi: { type: 'string', example: 'TERVERIFIKASI' },
          jumlah_diperbarui: { type: 'integer', example: 6 },
          idempotent: { type: 'boolean', example: false },
        },
      },
      MahasiswaDataDiriDokumenItem: {
        type: 'object',
        properties: {
          kode_jenis: {
            type: 'string',
            enum: ['IJAZAH', 'KK', 'KTP', 'AKTA', 'KTM', 'FORM_DATA_DIRI'],
            example: 'IJAZAH',
          },
          nama_jenis: { type: 'string', example: 'Ijazah Terakhir' },
          is_uploaded: { type: 'boolean', example: true },
          versi_terkini: { type: 'integer', nullable: true, example: 1 },
          status_dokumen: {
            type: 'string',
            enum: ['BELUM_DIPERIKSA', 'TERVERIFIKASI', 'PERLU_PERBAIKAN'],
            nullable: true,
            example: 'BELUM_DIPERIKSA',
          },
          catatan_admin: { type: 'string', nullable: true, example: null },
        },
      },
      MahasiswaDataDiriResponse: {
        type: 'object',
        properties: {
          profil: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              nim: { type: 'string', example: '2111522001' },
              nama_lengkap: { type: 'string', example: 'Ahmad Fauzan' },
              tanggal_lahir: { type: 'string', format: 'date', example: '2003-08-17' },
              email: { type: 'string', format: 'email', example: 'mahasiswa@sipkita.test' },
              no_telepon: { type: 'string', nullable: true, example: '081234567890' },
              alamat: { type: 'string', nullable: true, example: 'Jl. Kampus Limau Manis No. 15' },
              tahun_angkatan: { type: 'integer', example: 2023 },
              status_data: { type: 'string', example: 'AKTIF' },
              program_studi: { $ref: '#/components/schemas/ProgramStudiInfo' },
            },
          },
          dokumen: {
            type: 'array',
            items: { $ref: '#/components/schemas/MahasiswaDataDiriDokumenItem' },
          },
          kelengkapan: {
            type: 'object',
            properties: {
              jumlah_wajib: { type: 'integer', example: 6 },
              jumlah_terunggah: { type: 'integer', example: 6 },
              lengkap: { type: 'boolean', example: true },
              sudah_diverifikasi: { type: 'boolean', example: false },
            },
          },
        },
      },
      MahasiswaProfilUpdateRequest: {
        type: 'object',
        properties: {
          no_telepon: {
            type: 'string',
            nullable: true,
            example: '081234567890',
            description: 'Nomor telepon aktif mahasiswa (8-20 digit angka, tanda + di awal diperbolehkan).',
          },
          alamat: {
            type: 'string',
            nullable: true,
            maxLength: 5000,
            example: 'Jl. Kampus Limau Manis No. 15, Padang',
            description: 'Alamat tempat tinggal mahasiswa saat ini.',
          },
        },
      },
      MahasiswaProfilUpdateResponse: {
        type: 'object',
        properties: {
          no_telepon: { type: 'string', nullable: true, example: '081234567890' },
          alamat: { type: 'string', nullable: true, example: 'Jl. Kampus Limau Manis No. 15, Padang' },
        },
      },
      MahasiswaUploadDokumenResponse: {
        type: 'object',
        properties: {
          kode_jenis: {
            type: 'string',
            enum: ['IJAZAH', 'KK', 'KTP', 'AKTA', 'KTM', 'FORM_DATA_DIRI'],
            example: 'KTP',
          },
          versi: { type: 'integer', example: 2 },
          status_dokumen: { type: 'string', example: 'BELUM_DIPERIKSA' },
        },
      },
    },
  },
};

const routesGlob = join(__dirname, '../routes/*.js').replace(/\\/g, '/');

const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [routesGlob, './src/routes/*.js'],
};

export const openapiSpecification = swaggerJSDoc(swaggerOptions);
