import { isPasswordResetToken } from '../security/resetToken.js';
import { requestPasswordReset, resetPassword } from '../services/password-reset.service.js';

const GENERIC_FORGOT_MESSAGE = 'Jika email terdaftar, instruksi reset password akan dikirim.';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  const normalized = email.trim();
  return normalized.length >= 3 && normalized.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function forgotPasswordController(prisma, mailService) {
  return async (request, response, next) => {
    const body = request.body;
    if (!isPlainObject(body) || Object.keys(body).length !== 1 || !isValidEmail(body.email)) {
      response.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email tidak valid.' },
      });
      return;
    }

    try {
      await requestPasswordReset(prisma, mailService, body.email.trim().toLowerCase());
      response.status(200).json({ success: true, data: { message: GENERIC_FORGOT_MESSAGE } });
    } catch (error) {
      next(error);
    }
  };
}

export function resetPasswordController(prisma) {
  return async (request, response, next) => {
    const body = request.body;
    const validBody = isPlainObject(body) && Object.keys(body).length === 3 &&
      isPasswordResetToken(body.token) &&
      typeof body.newPassword === 'string' && body.newPassword.length >= 8 &&
      body.newPassword.length <= 1024 &&
      typeof body.confirmPassword === 'string' && body.confirmPassword === body.newPassword;
    if (!validBody) {
      response.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Data reset password tidak valid.' },
      });
      return;
    }

    try {
      const result = await resetPassword(prisma, body.token, body.newPassword);
      if (result.status === 'birth_date') {
        response.status(400).json({
          success: false,
          error: { code: 'PASSWORD_POLICY_ERROR', message: 'Password baru tidak memenuhi kebijakan keamanan.' },
        });
        return;
      }
      if (result.status !== 'ok') {
        response.status(400).json({
          success: false,
          error: { code: 'INVALID_RESET_TOKEN', message: 'Token reset tidak valid atau sudah kedaluwarsa.' },
        });
        return;
      }
      response.status(200).json({
        success: true,
        data: { message: 'Password berhasil diperbarui. Silakan login kembali.' },
      });
    } catch (error) {
      next(error);
    }
  };
}
