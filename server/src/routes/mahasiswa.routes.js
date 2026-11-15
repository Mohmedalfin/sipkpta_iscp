import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import { confirmImportController, importErrorsController, importRateLimit, previewImportController } from '../controllers/master-import.controller.js';
import {
  createMahasiswaController,
  getMahasiswaController,
  listMahasiswaController,
  updateMahasiswaController,
  changeMahasiswaStatusController,
  deleteMahasiswaController,
} from '../controllers/mahasiswa.controller.js';

export function createMahasiswaRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('ADMIN_PRODI'));
  /**
   * @openapi
   * /api/master/mahasiswa/import/preview:
   *   post:
   *     tags:
   *       - Master Mahasiswa
   *     summary: Unggah dan pratinjau impor CSV mahasiswa
   *     description: Mengunggah berkas CSV data mahasiswa untuk divalidasi dan menghasilkan preview sebelum dieksekusi ke database. Membutuhkan role ADMIN_PRODI.
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
   *                 description: Berkas CSV data mahasiswa dengan header yang sesuai.
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
   *         description: Berkas tidak valid atau format salah
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
  router.post('/import/preview', importRateLimit, previewImportController(prisma, 'mahasiswa'));

  /**
   * @openapi
   * /api/master/mahasiswa/import:
   *   post:
   *     tags:
   *       - Master Mahasiswa
   *     summary: Konfirmasi eksekusi impor mahasiswa
   *     description: Mengeksekusi impor data mahasiswa yang berstatus valid dari sesi preview sebelumnya ke tabel database.
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
   *                 description: UUID preview yang diperoleh dari endpoint /import/preview.
   *               confirmValidOnly:
   *                 type: boolean
   *                 example: true
   *                 description: Harus bernilai true untuk mengonfirmasi hanya baris valid yang disimpan.
   *     responses:
   *       200:
   *         description: Impor berhasil dikonfirmasi dan diproses
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
  router.post('/import', importRateLimit, confirmImportController(prisma, 'mahasiswa'));

  /**
   * @openapi
   * /api/master/mahasiswa/import/{previewId}/errors.xlsx:
   *   get:
   *     tags:
   *       - Master Mahasiswa
   *     summary: Unduh laporan baris data impor yang gagal (Excel)
   *     description: Mengunduh lembar kerja Excel (.xlsx) yang memuat daftar baris data mahasiswa yang gagal validasi beserta alasan kesalahannya.
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
  router.get('/import/:previewId/errors.xlsx', importErrorsController(prisma, 'mahasiswa'));

  /**
   * @openapi
   * /api/master/mahasiswa:
   *   get:
   *     tags:
   *       - Master Mahasiswa
   *     summary: Ambil daftar mahasiswa (Paginasi & Pencarian)
   *     description: Menampilkan daftar data mahasiswa terpaginasi dan mendukung pencarian berdasarkan NIM atau Nama Lengkap. Membutuhkan role ADMIN_PRODI.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Nomor halaman (bilangan bulat positif).
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
   *         description: Kata kunci pencarian pada NIM atau nama lengkap (maksimal 100 karakter).
   *       - in: query
   *         name: tahun_angkatan
   *         schema:
   *           type: integer
   *           example: 2023
   *         description: Filter daftar mahasiswa berdasarkan tahun angkatan (4 digit tahun, misal 2023).
   *     responses:
   *       200:
   *         description: Daftar mahasiswa berhasil diambil
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
   *                     $ref: '#/components/schemas/MahasiswaProfile'
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
   *       - Master Mahasiswa
   *     summary: Tambah akun dan profil mahasiswa baru
   *     description: Membuat akun User login (login_id = NIM), role MAHASISWA, password awal otomatis dari tanggal lahir DDMMYYYY (Argon2id), dan profil mahasiswa dalam satu transaksi database.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - nim
   *               - program_studi_id
   *               - email
   *               - nama_lengkap
   *               - tanggal_lahir
   *             properties:
   *               nim:
   *                 type: string
   *                 example: '2111522001'
   *                 description: Nomor Induk Mahasiswa (8-25 digit angka).
   *               program_studi_id:
   *                 type: integer
   *                 example: 1
   *                 description: ID program studi (saat ini bernilai 1 untuk SI).
   *               email:
   *                 type: string
   *                 format: email
   *                 example: fauzan@sipkita.test
   *               nama_lengkap:
   *                 type: string
   *                 example: Ahmad Fauzan
   *               tanggal_lahir:
   *                 type: string
   *                 format: date
   *                 example: '2003-08-17'
   *                 description: Format YYYY-MM-DD. Menjadi dasar password awal DDMMYYYY (contoh 17082003).
   *               nik_kependudukan:
   *                 type: string
   *                 nullable: true
   *                 example: '1371011708030001'
   *                 description: 16 digit angka NIK KTP (opsional).
   *               tempat_lahir:
   *                 type: string
   *                 nullable: true
   *                 example: Padang
   *               no_telepon:
   *                 type: string
   *                 nullable: true
   *                 example: '081234567890'
   *               alamat:
   *                 type: string
   *                 nullable: true
   *                 example: Jl. Kampus Limau Manis
   *               tahun_angkatan:
   *                 type: integer
   *                 nullable: true
   *                 example: 2023
   *     responses:
   *       201:
   *         description: Mahasiswa berhasil dibuat
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/MahasiswaProfile'
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
   *         description: NIM atau email sudah terdaftar sebelumnya
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.get('/', listMahasiswaController(prisma));

  /**
   * @openapi
   * /api/master/mahasiswa/{id}:
   *   get:
   *     tags:
   *       - Master Mahasiswa
   *     summary: Ambil detail profil mahasiswa
   *     description: Menampilkan informasi lengkap profil mahasiswa berdasarkan ID data mahasiswa.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID data mahasiswa.
   *     responses:
   *       200:
   *         description: Data mahasiswa berhasil ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/MahasiswaProfile'
   *       404:
   *         description: Mahasiswa tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *   patch:
   *     tags:
   *       - Master Mahasiswa
   *     summary: Perbarui sebagian data profil mahasiswa
   *     description: Memperbarui field profil mahasiswa yang diizinkan (email, nama_lengkap, tanggal_lahir, no_telepon, alamat, dll). Field nim dan program_studi_id tidak boleh diubah.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID data mahasiswa.
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
   *               nama_lengkap:
   *                 type: string
   *               tanggal_lahir:
   *                 type: string
   *                 format: date
   *               nik_kependudukan:
   *                 type: string
   *                 nullable: true
   *               tempat_lahir:
   *                 type: string
   *                 nullable: true
   *               no_telepon:
   *                 type: string
   *                 nullable: true
   *               alamat:
   *                 type: string
   *                 nullable: true
   *               tahun_angkatan:
   *                 type: integer
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Profil mahasiswa berhasil diperbarui
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/MahasiswaProfile'
   *       400:
   *         description: Field yang dikirim tidak sah atau tidak valid
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       404:
   *         description: Mahasiswa tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *   delete:
   *     tags:
   *       - Master Mahasiswa
   *     summary: Hapus data master mahasiswa
   *     description: Menghapus data profil mahasiswa dan akun pengguna jika belum memiliki riwayat akademik, verifikasi data diri, atau dependensi aktivitas.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID data mahasiswa.
   *     responses:
   *       204:
   *         description: Mahasiswa berhasil dihapus (No Content)
   *       403:
   *         description: Akun administratif dilindungi dari penghapusan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       404:
   *         description: Mahasiswa tidak ditemukan
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
  router.get('/:id', getMahasiswaController(prisma));
  router.post('/', createMahasiswaController(prisma));
  router.patch('/:id', updateMahasiswaController(prisma));

  /**
   * @openapi
   * /api/master/mahasiswa/{id}/status:
   *   patch:
   *     tags:
   *       - Master Mahasiswa
   *     summary: Ubah status keaktifan akun mahasiswa
   *     description: Mengubah status akun pengguna menjadi AKTIF atau NONAKTIF. Saat dinonaktifkan, seluruh sesi login yang ada akan langsung dicabut (revoked).
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID data mahasiswa.
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
   *         description: Mahasiswa tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.patch('/:id/status', changeMahasiswaStatusController(prisma));
  router.delete('/:id', deleteMahasiswaController(prisma));
  return router;
}
