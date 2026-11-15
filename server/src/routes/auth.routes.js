import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { activeRoleController, loginController, logoutController, meController, refreshController } from '../controllers/auth.controller.js';
import { forgotPasswordController, resetPasswordController } from '../controllers/password-reset.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { createHash } from 'node:crypto';

function rateLimitHandler(message) {
  return (_request, response) => {
    response.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message },
    });
  };
}

export function createAuthRoutes({ prisma, mailService }) {
  const router = Router();
  const loginRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: rateLimitHandler('Terlalu banyak permintaan login.'),
  });
  const failedLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: rateLimitHandler('Terlalu banyak percobaan login.'),
  });
  const forgotIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: rateLimitHandler('Terlalu banyak permintaan reset password.'),
  });
  const forgotEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (request) => createHash('sha256')
      .update(typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : 'invalid')
      .digest('hex'),
    handler: rateLimitHandler('Terlalu banyak permintaan reset password.'),
  });
  const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: rateLimitHandler('Terlalu banyak percobaan reset password.'),
  });

  /**
   * @openapi
   * /api/auth/login:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Login pengguna
   *     description: Mengautentikasi pengguna dengan login_id (NIM/Kode Dosen/username admin) dan password. Mengembalikan Access Token JWT dan menyetel Refresh Token pada cookie HTTP-only (sipkita_refresh_token).
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - login_id
   *               - password
   *             properties:
   *               login_id:
   *                 type: string
   *                 example: admin.prodi
   *                 description: NIM mahasiswa, Kode Dosen, atau ID login akun admin.
   *               password:
   *                 type: string
   *                 format: password
   *                 example: admin123
   *     responses:
   *       200:
   *         description: Login berhasil
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
   *                     accessToken:
   *                       type: string
   *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *                     user:
   *                       $ref: '#/components/schemas/UserInfo'
   *       400:
   *         description: Validasi request gagal
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       401:
   *         description: Kredensial tidak valid atau akun nonaktif
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       429:
   *         description: Terlalu banyak percobaan login (rate limited)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.post('/login', loginRequestLimiter, loginController(prisma, failedLoginLimiter));

  /**
   * @openapi
   * /api/auth/forgot-password:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Permintaan tautan/token reset password
   *     description: Mengirim instruksi reset password ke email terdaftar via SMTP. Dilindungi anti-enumeration (respons selalu 200 sama baik email terdaftar maupun tidak) dan rate limiting.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: mahasiswa@sipkita.test
   *     responses:
   *       200:
   *         description: Permintaan diterima (pesan generik anti-enumeration)
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
   *                     message:
   *                       type: string
   *                       example: Jika email terdaftar, instruksi reset password akan dikirim.
   *       400:
   *         description: Format email tidak valid
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       429:
   *         description: Terlalu banyak permintaan reset password (rate limit tercapai)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.post('/forgot-password', forgotIpLimiter, forgotEmailLimiter, forgotPasswordController(prisma, mailService));

  /**
   * @openapi
   * /api/auth/reset-password:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Eksekusi reset password baru
   *     description: Mereset password pengguna menggunakan token dari email. Memvalidasi kebijakan keamanan (bukan tanggal lahir) dan mencabut seluruh sesi login lama setelah berhasil.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *               - newPassword
   *               - confirmPassword
   *             properties:
   *               token:
   *                 type: string
   *                 example: xK9_L20mPaB-8qY1v7w5rT3uIoP9aZbC4dEfGhIjKlM
   *                 description: Token 43 karakter base64url yang diterima via email.
   *               newPassword:
   *                 type: string
   *                 format: password
   *                 example: PasswordBaru123!
   *                 description: Minimal 8 karakter, maksimal 1024 karakter.
   *               confirmPassword:
   *                 type: string
   *                 format: password
   *                 example: PasswordBaru123!
   *                 description: Harus sama persis dengan newPassword.
   *     responses:
   *       200:
   *         description: Password berhasil direset
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
   *                     message:
   *                       type: string
   *                       example: Password berhasil diperbarui. Silakan login kembali.
   *       400:
   *         description: Token tidak valid/kedaluwarsa, password melanggar kebijakan tanggal lahir, atau body salah
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   *       429:
   *         description: Terlalu banyak percobaan reset password
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.post('/reset-password', resetLimiter, resetPasswordController(prisma));

  /**
   * @openapi
   * /api/auth/refresh:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Perbarui Access Token
   *     description: Memperbarui JWT Access Token menggunakan Refresh Token dari cookie HTTP-only atau body JSON.
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               refreshToken:
   *                 type: string
   *                 description: Refresh token (opsional jika sudah ada di cookie sipkita_refresh_token).
   *     responses:
   *       200:
   *         description: Token berhasil diperbarui
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
   *                     accessToken:
   *                       type: string
   *                     user:
   *                       $ref: '#/components/schemas/UserInfo'
   *       401:
   *         description: Refresh token tidak valid, kedaluwarsa, atau terdeteksi reused
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.post('/refresh', refreshController(prisma));

  /**
   * @openapi
   * /api/auth/logout:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Logout pengguna
   *     description: Mencabut sesi login aktif di database dan menghapus cookie refresh token.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       204:
   *         description: Logout berhasil (No Content)
   *       401:
   *         description: Autentikasi diperlukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.post('/logout', authenticate(prisma), logoutController(prisma));

  /**
   * @openapi
   * /api/auth/active-role:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Ganti peran aktif (Active Role)
   *     description: Mengubah role aktif untuk sesi login saat ini bagi pengguna multi-role. Mengembalikan Access Token baru dengan klaim role yang diperbarui.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - role_id
   *             properties:
   *               role_id:
   *                 type: integer
   *                 example: 3
   *                 description: ID role yang ingin diaktifkan.
   *     responses:
   *       200:
   *         description: Role aktif berhasil diubah
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
   *                     accessToken:
   *                       type: string
   *                     active_role:
   *                       $ref: '#/components/schemas/RoleInfo'
   *       400:
   *         description: Body tidak valid
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
   *         description: Role tidak dimiliki oleh pengguna
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.post('/active-role', authenticate(prisma), activeRoleController(prisma));

  /**
   * @openapi
   * /api/auth/me:
   *   get:
   *     tags:
   *       - Auth
   *     summary: Ambil profil akun saat ini
   *     description: Mengambil data profil pengguna yang terautentikasi beserta daftar role yang dimiliki dan role aktif.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Profil pengguna berhasil diambil
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
   *                     user:
   *                       $ref: '#/components/schemas/UserInfo'
   *       401:
   *         description: Autentikasi diperlukan
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponseError'
   */
  router.get('/me', authenticate(prisma), meController);
  return router;
}
