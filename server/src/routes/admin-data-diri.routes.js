import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRoles } from '../middlewares/authorizeRoles.js';
import {
  decideAdminDataDiriDocumentController,
  downloadAdminDataDiriDocumentController,
  getAdminDataDiriDetailController,
  listAdminDataDiriController,
  verifyAllAdminDataDiriController,
} from '../controllers/admin-data-diri.controller.js';

export function createAdminDataDiriRoutes({ prisma }) {
  const router = Router();
  router.use(authenticate(prisma), authorizeRoles('ADMIN_PRODI'));

  /**
   * @openapi
   * /api/admin-prodi/verifikasi-data-diri:
   *   get:
   *     tags:
   *       - Verifikasi Data Diri
   *     summary: Daftar verifikasi data diri mahasiswa
   *     description: Mengambil daftar mahasiswa yang berada dalam program studi Admin Prodi beserta status verifikasi data diri dan progres kelengkapan 6 dokumen wajib. Mendukung filter status agregat, filter kelengkapan, pencarian berdasarkan NIM atau nama lengkap, dan paginasi. Memerlukan Bearer Access Token JWT dengan role aktif ADMIN_PRODI.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *           minimum: 1
   *         description: Nomor halaman data yang diminta.
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           minimum: 1
   *           maximum: 100
   *         description: Jumlah data per halaman (maksimal 100).
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *           maxLength: 100
   *         description: Kata kunci pencarian parsial berdasarkan NIM atau nama lengkap mahasiswa.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum:
   *             - BELUM_LENGKAP
   *             - BELUM_DIVERIFIKASI
   *             - PERLU_PERBAIKAN
   *             - TERVERIFIKASI
   *         description: Filter status agregat verifikasi data diri mahasiswa.
   *       - in: query
   *         name: lengkap
   *         schema:
   *           type: boolean
   *         description: Filter kelengkapan unggahan 6 dokumen wajib (true untuk lengkap 6/6, false untuk belum lengkap).
   *     responses:
   *       200:
   *         description: Daftar verifikasi data diri mahasiswa berhasil diambil
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
   *                     $ref: '#/components/schemas/VerifikasiDataDiriListItem'
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       400:
   *         description: Parameter query tidak valid atau query asing terdeteksi
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: VALIDATION_ERROR
   *                 message: Data verifikasi tidak valid.
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
   *         description: Akses ditolak (role aktif bukan ADMIN_PRODI atau cakupan prodi tidak tersedia)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: FORBIDDEN
   *                 message: Akses ditolak untuk peran ini.
   */
  router.get('/', listAdminDataDiriController(prisma));

  /**
   * @openapi
   * /api/admin-prodi/verifikasi-data-diri/{mahasiswaId}:
   *   get:
   *     tags:
   *       - Verifikasi Data Diri
   *     summary: Detail data diri dan 6 berkas identitas mahasiswa
   *     description: Mengambil profil lengkap mahasiswa, status agregat verifikasi, dan rincian keenam berkas identitas wajib (IJAZAH, KK, KTP, AKTA, KTM, FORM_DATA_DIRI) yang mencakup metadata berkas terkini, catatan pemeriksaan, akun pemeriksa, serta riwayat seluruh versi sebelumnya. Memerlukan Bearer Access Token JWT dengan role aktif ADMIN_PRODI.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: mahasiswaId
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: ID internal mahasiswa dalam program studi yang dikelola.
   *     responses:
   *       200:
   *         description: Detail data diri dan verifikasi dokumen mahasiswa berhasil diambil
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/VerifikasiDataDiriDetail'
   *       400:
   *         description: Parameter mahasiswaId tidak valid
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: VALIDATION_ERROR
   *                 message: Data verifikasi tidak valid.
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
   *       404:
   *         description: Mahasiswa tidak ditemukan dalam program studi yang dikelola
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: MAHASISWA_NOT_FOUND
   *                 message: Mahasiswa tidak ditemukan.
   */
  router.get('/:mahasiswaId', getAdminDataDiriDetailController(prisma));

  /**
   * @openapi
   * /api/admin-prodi/verifikasi-data-diri/{mahasiswaId}/dokumen/{kodeJenis}/file:
   *   get:
   *     tags:
   *       - Verifikasi Data Diri
   *     summary: Unduh berkas fisik PDF dokumen data diri mahasiswa
   *     description: Mengunduh berkas PDF versi terkini untuk jenis dokumen data diri tertentu milik mahasiswa dari penyimpanan privat. Respons dialirkan dengan proteksi header keamanan (Cache-Control no-store dan X-Content-Type-Options nosniff). Memerlukan Bearer Access Token JWT dengan role aktif ADMIN_PRODI.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: mahasiswaId
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: ID internal mahasiswa.
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
   *         description: Kode unik jenis dokumen data diri yang ingin diunduh.
   *     responses:
   *       200:
   *         description: Berkas PDF berhasil diunduh
   *         content:
   *           application/pdf:
   *             schema:
   *               type: string
   *               format: binary
   *       400:
   *         description: Parameter permintaan tidak valid
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
   *       404:
   *         description: Mahasiswa, jenis dokumen, atau file tidak ditemukan
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
  router.get('/:mahasiswaId/dokumen/:kodeJenis/file', downloadAdminDataDiriDocumentController(prisma));

  /**
   * @openapi
   * /api/admin-prodi/verifikasi-data-diri/{mahasiswaId}/dokumen/{kodeJenis}:
   *   patch:
   *     tags:
   *       - Verifikasi Data Diri
   *     summary: Putuskan verifikasi berkas dokumen data diri
   *     description: Menetapkan status keputusan (TERVERIFIKASI atau PERLU_PERBAIKAN) untuk berkas versi terkini. Wajib menyertakan expectedVersion untuk menjamin keputusan didasarkan pada nomor versi yang dilihat admin saat ini. Bila status adalah PERLU_PERBAIKAN, field catatan wajib diisi. Keputusan yang sama bersifat idempoten dan tidak menduplikasi audit log. Memerlukan Bearer Access Token JWT dengan role aktif ADMIN_PRODI.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: mahasiswaId
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: ID internal mahasiswa.
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
   *         description: Kode jenis dokumen identitas yang diputuskan.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/VerifikasiKeputusanRequest'
   *           examples:
   *             perluPerbaikan:
   *               summary: Meminta perbaikan dokumen
   *               value:
   *                 status: PERLU_PERBAIKAN
   *                 catatan: Foto KTP buram dan nomor NIK tidak terbaca jelas.
   *                 expectedVersion: 1
   *             terverifikasi:
   *               summary: Menyetujui dokumen
   *               value:
   *                 status: TERVERIFIKASI
   *                 catatan: null
   *                 expectedVersion: 2
   *     responses:
   *       200:
   *         description: Keputusan verifikasi dokumen berhasil disimpan
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/VerifikasiKeputusanResponse'
   *       400:
   *         description: Payload tidak valid (catatan kosong saat PERLU_PERBAIKAN, expectedVersion bukan bilangan bulat positif, atau field tidak dikenal)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: VALIDATION_ERROR
   *                 message: Data verifikasi tidak valid.
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
   *       404:
   *         description: Mahasiswa, jenis dokumen, atau berkas tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: DOCUMENT_NOT_FOUND
   *                 message: Dokumen tidak ditemukan.
   *       409:
   *         description: Konflik versi dokumen atau status dokumen tidak dapat diproses
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             examples:
   *               staleVersion:
   *                 summary: Versi dokumen telah berubah
   *                 value:
   *                   success: false
   *                   error:
   *                     code: STALE_DOCUMENT_VERSION
   *                     message: Versi dokumen telah berubah; muat ulang detail.
   *               conflict:
   *                 summary: Dokumen berubah saat diperiksa
   *                 value:
   *                   success: false
   *                   error:
   *                     code: DOCUMENT_CONFLICT
   *                     message: Dokumen berubah saat diperiksa; coba lagi.
   */
  router.patch('/:mahasiswaId/dokumen/:kodeJenis', decideAdminDataDiriDocumentController(prisma));

  /**
   * @openapi
   * /api/admin-prodi/verifikasi-data-diri/{mahasiswaId}/verifikasi-semua:
   *   post:
   *     tags:
   *       - Verifikasi Data Diri
   *     summary: Verifikasi sekaligus keenam berkas data diri mahasiswa
   *     description: Menyetujui keenam berkas dokumen data diri wajib (IJAZAH, KK, KTP, AKTA, KTM, FORM_DATA_DIRI) milik seorang mahasiswa dalam satu transaksi atomik. Wajib menyertakan peta expectedVersions untuk seluruh 6 kode dokumen. Permintaan ditolak jika berkas belum lengkap (kurang dari 6), ada berkas yang berstatus PERLU_PERBAIKAN, atau ada ketidaksesuaian versi terkini. Memerlukan Bearer Access Token JWT dengan role aktif ADMIN_PRODI.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: mahasiswaId
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: ID internal mahasiswa.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/VerifikasiSemuaRequest'
   *           example:
   *             expectedVersions:
   *               IJAZAH: 1
   *               KK: 1
   *               KTP: 2
   *               AKTA: 1
   *               KTM: 1
   *               FORM_DATA_DIRI: 1
   *     responses:
   *       200:
   *         description: Seluruh dokumen berhasil diverifikasi dan status verifikasi menjadi TERVERIFIKASI
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/VerifikasiSemuaResponse'
   *       400:
   *         description: Format body expectedVersions tidak valid atau tidak memuat tepat 6 jenis dokumen wajib
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: VALIDATION_ERROR
   *                 message: Data verifikasi tidak valid.
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
   *       404:
   *         description: Mahasiswa tidak ditemukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             example:
   *               success: false
   *               error:
   *                 code: MAHASISWA_NOT_FOUND
   *                 message: Mahasiswa tidak ditemukan.
   *       409:
   *         description: Syarat verifikasi massal tidak terpenuhi (berkas belum lengkap, revisi tertunda, atau versi basi)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *             examples:
   *               documentsIncomplete:
   *                 summary: Dokumen belum lengkap 6/6
   *                 value:
   *                   success: false
   *                   error:
   *                     code: DOCUMENTS_INCOMPLETE
   *                     message: Enam dokumen wajib belum lengkap.
   *               revisionPending:
   *                 summary: Ada dokumen berstatus PERLU_PERBAIKAN
   *                 value:
   *                   success: false
   *                   error:
   *                     code: DOCUMENT_REVISION_PENDING
   *                     message: Masih ada dokumen yang perlu diperbaiki.
   *               staleVersion:
   *                 summary: Versi dokumen berubah
   *                 value:
   *                   success: false
   *                   error:
   *                     code: STALE_DOCUMENT_VERSION
   *                     message: Versi dokumen telah berubah; muat ulang detail.
   */
  router.post('/:mahasiswaId/verifikasi-semua', verifyAllAdminDataDiriController(prisma));

  return router;
}
