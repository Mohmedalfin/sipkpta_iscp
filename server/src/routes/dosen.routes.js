import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import { confirmImportController, importErrorsController, importRateLimit, previewImportController } from '../controllers/master-import.controller.js';
import {
  createDosenController,
  getDosenController,
  listDosenController,
  updateDosenController,
  changeDosenStatusController,
  deleteDosenController,
} from '../controllers/dosen.controller.js';

export function createDosenRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('ADMIN_PRODI'));
  /**
   * @openapi
   * /api/master/dosen/import/preview:
   *   post:
   *     tags:
   *       - Master Dosen
   *     summary: Unggah dan pratinjau impor CSV dosen
   *     description: Mengunggah berkas CSV data dosen untuk divalidasi dan menghasilkan preview statistik validitas sebelum disimpan ke database. Membutuhkan role ADMIN_PRODI.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - file
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: Berkas CSV data dosen.
   *     responses:
   *       200:
   *         description: Preview impor berhasil dibuat
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ImportPreviewResult'
   *       400:
   *         description: Berkas CSV tidak valid atau format salah
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       401:
   *         description: Autentikasi diperlukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       403:
   *         description: Akses ditolak (bukan ADMIN_PRODI)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       429:
   *         description: Terlalu banyak permintaan impor
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.post('/import/preview', importRateLimit, previewImportController(prisma, 'dosen'));

  /**
   * @openapi
   * /api/master/dosen/import:
   *   post:
   *     tags:
   *       - Master Dosen
   *     summary: Konfirmasi eksekusi impor dosen
   *     description: Mengeksekusi penyimpanan data dosen yang lolos validasi dari sesi preview ke database.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - previewId
   *               - confirmValidOnly
   *             properties:
   *               previewId:
   *                 type: string
   *                 format: uuid
   *                 example: a1b2c3d4-e5f6-7890-abcd-ef1234567890
   *               confirmValidOnly:
   *                 type: boolean
   *                 example: true
   *     responses:
   *       200:
   *         description: Impor data dosen berhasil diproses
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ImportConfirmResult'
   *       400:
   *         description: Request konfirmasi tidak valid
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       401:
   *         description: Autentikasi diperlukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       403:
   *         description: Akses ditolak (bukan ADMIN_PRODI)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.post('/import', importRateLimit, confirmImportController(prisma, 'dosen'));

  /**
   * @openapi
   * /api/master/dosen/import/{previewId}/errors.xlsx:
   *   get:
   *     tags:
   *       - Master Dosen
   *     summary: Unduh laporan baris data impor yang gagal (Excel)
   *     description: Mengunduh berkas Excel (.xlsx) berisi rincian baris data dosen yang ditolak sistem beserta pesan kegagalannya.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: previewId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: UUID preview sesi impor.
   *     responses:
   *       200:
   *         description: File Excel laporan error berhasil diunduh
   *         content:
   *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
   *             schema:
   *               type: string
   *               format: binary
   *       400:
   *         description: UUID preview tidak valid
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       401:
   *         description: Autentikasi diperlukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.get('/import/:previewId/errors.xlsx', importErrorsController(prisma, 'dosen'));

  /**
   * @openapi
   * /api/master/dosen:
   *   get:
   *     tags:
   *       - Master Dosen
   *     summary: Ambil daftar dosen (Paginasi & Pencarian)
   *     description: Menampilkan daftar data dosen terpaginasi dan mendukung pencarian berdasarkan Kode Dosen, NIDN, atau Nama Lengkap. Membutuhkan role ADMIN_PRODI.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Nomor halaman.
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Jumlah data per halaman (maksimal 100).
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Kata kunci pencarian pada Kode Dosen, NIDN, atau nama lengkap.
   *     responses:
   *       200:
   *         description: Daftar dosen berhasil diambil
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/DosenProfile'
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       400:
   *         description: Parameter query tidak valid
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       401:
   *         description: Autentikasi diperlukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       403:
   *         description: Akses ditolak (bukan ADMIN_PRODI)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *   post:
   *     tags:
   *       - Master Dosen
   *     summary: Tambah akun dan profil dosen baru
   *     description: Membuat akun User login (login_id = Kode Dosen), password awal otomatis dari tanggal lahir DDMMYYYY (Argon2id), dan profil dosen dalam satu transaksi database.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - kode_dosen
   *               - program_studi_id
   *               - email
   *               - nama_lengkap
   *               - tanggal_lahir
   *             properties:
   *               kode_dosen:
   *                 type: string
   *                 example: DSN001
   *                 description: Kode dosen unik (3-25 karakter, alfanumerik/titik/strip/underscore). Menjadi login_id.
   *               program_studi_id:
   *                 type: integer
   *                 example: 1
   *                 description: ID program studi (1 untuk Sistem Informasi).
   *               email:
   *                 type: string
   *                 format: email
   *                 example: dosen.andi@sipkita.test
   *               nama_lengkap:
   *                 type: string
   *                 example: Dr. Eng. Andi Pratama, S.T., M.T.
   *               tanggal_lahir:
   *                 type: string
   *                 format: date
   *                 example: '1982-05-14'
   *                 description: Format YYYY-MM-DD. Menjadi dasar password awal DDMMYYYY (contoh 14051982).
   *               nidn:
   *                 type: string
   *                 nullable: true
   *                 example: '0014058201'
   *                 description: NIDN dosen 1-20 digit (opsional).
   *               no_telepon:
   *                 type: string
   *                 nullable: true
   *                 example: '081234567890'
   *               jabatan_fungsional:
   *                 type: string
   *                 nullable: true
   *                 example: Lektor Kepala
   *               is_homebase_si:
   *                 type: boolean
   *                 default: false
   *                 example: true
   *     responses:
   *       201:
   *         description: Dosen berhasil dibuat
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/DosenProfile'
   *       400:
   *         description: Validasi input gagal
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       403:
   *         description: Prodi tidak diizinkan atau bukan ADMIN_PRODI
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       409:
   *         description: Kode dosen, NIDN, atau email sudah digunakan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.get('/', listDosenController(prisma));

  /**
   * @openapi
   * /api/master/dosen/{id}:
   *   get:
   *     tags:
   *       - Master Dosen
   *     summary: Ambil detail profil dosen
   *     description: Menampilkan informasi lengkap profil dosen berdasarkan ID data dosen.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID data dosen.
   *     responses:
   *       200:
   *         description: Data dosen berhasil ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/DosenProfile'
   *       404:
   *         description: Dosen tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *   patch:
   *     tags:
   *       - Master Dosen
   *     summary: Perbarui sebagian data profil dosen
   *     description: Memperbarui field profil dosen yang diizinkan (email, nidn, nama_lengkap, no_telepon, tanggal_lahir, jabatan_fungsional, is_homebase_si). Field kode_dosen dan program_studi_id tidak boleh diubah.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID data dosen.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               nidn:
   *                 type: string
   *                 nullable: true
   *               nama_lengkap:
   *                 type: string
   *               no_telepon:
   *                 type: string
   *                 nullable: true
   *               tanggal_lahir:
   *                 type: string
   *                 format: date
   *               jabatan_fungsional:
   *                 type: string
   *                 nullable: true
   *               is_homebase_si:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Profil dosen berhasil diperbarui
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/DosenProfile'
   *       400:
   *         description: Field yang dikirim tidak sah atau tidak valid
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       404:
   *         description: Dosen tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *   delete:
   *     tags:
   *       - Master Dosen
   *     summary: Hapus data master dosen
   *     description: Menghapus data dosen dan akun terkait jika belum memiliki dependensi riwayat (usulan pembimbing, penugasan dosen, log aktivitas, dll).
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID data dosen.
   *     responses:
   *       204:
   *         description: Dosen berhasil dihapus (No Content)
   *       403:
   *         description: Akun administratif dilindungi dari penghapusan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       404:
   *         description: Dosen tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       409:
   *         description: Data memiliki riwayat atau relasi penting sehingga tidak dapat dihapus
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.get('/:id', getDosenController(prisma));
  router.post('/', createDosenController(prisma));
  router.patch('/:id', updateDosenController(prisma));

  /**
   * @openapi
   * /api/master/dosen/{id}/status:
   *   patch:
   *     tags:
   *       - Master Dosen
   *     summary: Ubah status keaktifan akun dosen
   *     description: Mengubah status akun pengguna dosen menjadi AKTIF atau NONAKTIF. Saat dinonaktifkan, seluruh sesi login yang ada akan dicabut (revoked).
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID data dosen.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - status_akun
   *             properties:
   *               status_akun:
   *                 type: string
   *                 enum: ['AKTIF', 'NONAKTIF']
   *                 example: NONAKTIF
   *     responses:
   *       200:
   *         description: Status akun berhasil diubah
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: integer
   *                     user_id:
   *                       type: integer
   *                     status_akun:
   *                       type: string
   *                     status_data:
   *                       type: string
   *       400:
   *         description: Nilai status tidak valid
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       404:
   *         description: Dosen tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.patch('/:id/status', changeDosenStatusController(prisma));
  router.delete('/:id', deleteDosenController(prisma));
  return router;
}
