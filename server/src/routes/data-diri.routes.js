import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import {
  dataDiriUploadRateLimit, downloadOwnDocumentController, getDataDiriController,
  updateOwnProfileController, uploadOwnDocumentController,
} from '../controllers/data-diri.controller.js';

export function createDataDiriRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('MAHASISWA'));

  /**
   * @openapi
   * /api/mahasiswa/me/data-diri:
   *   get:
   *     tags:
   *       - Data Diri Mahasiswa
   *     summary: Ambil data diri dan status 6 dokumen identitas mahasiswa
   *     description: Mengambil informasi profil pribadi mahasiswa yang sedang login beserta status kelengkapan 6 dokumen identitas wajib (IJAZAH, KK, KTP, AKTA, KTM, FORM_DATA_DIRI), versi terkini tiap berkas, dan catatan perbaikan dari admin jika ada. Memerlukan Bearer Access Token JWT dengan role aktif MAHASISWA.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Data diri dan status kelengkapan dokumen berhasil diambil
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/MahasiswaDataDiriResponse'
   *       401:
   *         description: Autentikasi diperlukan (token tidak valid atau tidak disertakan)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: UNAUTHORIZED
   *                 message: Token autentikasi diperlukan.
   *       403:
   *         description: Akses ditolak (role aktif bukan MAHASISWA)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: FORBIDDEN
   *                 message: Akses ditolak untuk peran ini.
   *       404:
   *         description: Profil mahasiswa tidak ditemukan atau berstatus nonaktif
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: PROFILE_NOT_FOUND
   *                 message: Profil mahasiswa tidak tersedia.
   *       409:
   *         description: Jenis dokumen data diri belum lengkap dikonfigurasi di master
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: DOCUMENT_TYPES_UNAVAILABLE
   *                 message: Jenis dokumen data diri belum lengkap.
   */
  router.get('/me/data-diri', getDataDiriController(prisma));

  /**
   * @openapi
   * /api/mahasiswa/me/profil:
   *   patch:
   *     tags:
   *       - Data Diri Mahasiswa
   *     summary: Perbarui kontak data diri profil mahasiswa
   *     description: Memperbarui nomor telepon dan/atau alamat domisili tempat tinggal mahasiswa yang sedang login. Hanya menerima field no_telepon dan alamat. Memerlukan Bearer Access Token JWT dengan role aktif MAHASISWA.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/MahasiswaProfilUpdateRequest'
   *           example:
   *             no_telepon: '081234567890'
   *             alamat: 'Jl. Kampus Limau Manis No. 15, Padang'
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
   *                   $ref: '#/components/schemas/MahasiswaProfilUpdateResponse'
   *       400:
   *         description: Format kontak tidak valid (nomor telepon tidak sesuai pola angka, panjang alamat > 5000 karakter, atau field tidak dikenal)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: VALIDATION_ERROR
   *                 message: Data profil tidak valid.
   *       401:
   *         description: Autentikasi diperlukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       403:
   *         description: Akses ditolak (bukan MAHASISWA)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       404:
   *         description: Profil mahasiswa tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: PROFILE_NOT_FOUND
   *                 message: Profil mahasiswa tidak tersedia.
   */
  router.patch('/me/profil', updateOwnProfileController(prisma));

  /**
   * @openapi
   * /api/mahasiswa/me/data-diri/dokumen/{kodeJenis}:
   *   put:
   *     tags:
   *       - Data Diri Mahasiswa
   *     summary: Unggah atau revisi berkas PDF dokumen data diri
   *     description: Mengunggah berkas PDF untuk salah satu dari 6 dokumen identitas wajib (IJAZAH, KK, KTP, AKTA, KTM, FORM_DATA_DIRI). Berkas dikirim dalam format multipart/form-data dengan batas ukuran maksimal 5 MiB. Sistem memvalidasi keabsahan struktur dokumen PDF. Jika dokumen sebelumnya berstatus BELUM_DIPERIKSA atau PERLU_PERBAIKAN, unggahan baru otomatis membuat nomor versi selanjutnya (versi terkini) dan mengarsipkan versi lama. Dokumen yang telah berstatus TERVERIFIKASI dikunci dari penggantian. Dibatasi rate limit maksimal 30 unggahan per jam. Memerlukan Bearer Access Token JWT dengan role aktif MAHASISWA.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: kodeJenis
   *         required: true
   *         schema:
   *           type: string
   *           enum:
   *             - IJAZAH
   *             - KK
   *             - KTP
   *             - AKTA
   *             - KTM
   *             - FORM_DATA_DIRI
   *         description: Kode unik jenis dokumen data diri yang diunggah.
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
   *                 description: Berkas PDF asli dengan ukuran maksimal 5 MiB.
   *     responses:
   *       201:
   *         description: Berkas PDF berhasil diunggah dan disimpan
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/MahasiswaUploadDokumenResponse'
   *       400:
   *         description: Berkas PDF tidak valid, struktur rusak, atau berkas bukan PDF asli
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             examples:
   *               invalidDoc:
   *                 summary: Berkas bukan PDF valid
   *                 value:
   *                   success: false
   *                   error:
   *                     code: INVALID_DOCUMENT
   *                     message: Berkas PDF tidak valid atau melebihi batas.
   *       401:
   *         description: Autentikasi diperlukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       403:
   *         description: Akses ditolak (bukan MAHASISWA)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       404:
   *         description: Profil mahasiswa atau jenis dokumen tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: DOCUMENT_TYPE_NOT_FOUND
   *                 message: Jenis dokumen tidak ditemukan.
   *       409:
   *         description: Dokumen terkunci karena telah berstatus TERVERIFIKASI atau konflik unggah bersamaan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: DOCUMENT_LOCKED
   *                 message: Dokumen yang terverifikasi tidak dapat diganti.
   *       413:
   *         description: Ukuran berkas melebihi batas 5 MiB
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: INVALID_DOCUMENT
   *                 message: Berkas PDF tidak valid atau melebihi batas.
   *       415:
   *         description: Format request tidak didukung (wajib multipart/form-data)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: UNSUPPORTED_MEDIA_TYPE
   *                 message: Gunakan multipart/form-data.
   *       429:
   *         description: Terlalu banyak unggahan (maksimal 30 unggahan per jam)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: RATE_LIMITED
   *                 message: Terlalu banyak unggahan dokumen.
   */
  router.put('/me/data-diri/dokumen/:kodeJenis', dataDiriUploadRateLimit, uploadOwnDocumentController(prisma));

  /**
   * @openapi
   * /api/mahasiswa/me/data-diri/dokumen/{kodeJenis}/file:
   *   get:
   *     tags:
   *       - Data Diri Mahasiswa
   *     summary: Unduh berkas fisik PDF dokumen data diri milik sendiri
   *     description: Mengunduh berkas fisik PDF versi terkini milik mahasiswa yang sedang login dari penyimpanan privat berotorisasi. Respons dialirkan dengan proteksi header keamanan (Cache-Control no-store dan X-Content-Type-Options nosniff). Memerlukan Bearer Access Token JWT dengan role aktif MAHASISWA.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: kodeJenis
   *         required: true
   *         schema:
   *           type: string
   *           enum:
   *             - IJAZAH
   *             - KK
   *             - KTP
   *             - AKTA
   *             - KTM
   *             - FORM_DATA_DIRI
   *         description: Kode unik jenis dokumen data diri yang diunduh.
   *     responses:
   *       200:
   *         description: Berkas PDF dokumen berhasil dialirkan
   *         content:
   *           application/pdf:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         description: Autentikasi diperlukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       403:
   *         description: Akses ditolak (bukan MAHASISWA)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       404:
   *         description: Profil mahasiswa, jenis dokumen, atau file belum pernah diunggah
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: DOCUMENT_NOT_FOUND
   *                 message: Dokumen tidak ditemukan.
   */
  router.get('/me/data-diri/dokumen/:kodeJenis/file', downloadOwnDocumentController(prisma));

  return router;
}
