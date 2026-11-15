import nodemailer from 'nodemailer';

function requiredValue(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Konfigurasi ${name} tidak valid.`);
  }
  return value.trim();
}

function readMailConfig(environment) {
  const host = requiredValue(environment.SMTP_HOST, 'SMTP_HOST');
  const port = Number(environment.SMTP_PORT);
  const secure = environment.SMTP_SECURE === 'true';
  const user = requiredValue(environment.SMTP_USER, 'SMTP_USER');
  const password = requiredValue(environment.SMTP_APP_PASSWORD, 'SMTP_APP_PASSWORD');
  const from = requiredValue(environment.MAIL_FROM, 'MAIL_FROM');

  if (!Number.isInteger(port) || port < 1 || port > 65535 ||
      !['true', 'false'].includes(environment.SMTP_SECURE)) {
    throw new Error('Konfigurasi port atau mode aman SMTP tidak valid.');
  }
  if (user.toLowerCase() !== from.toLowerCase()) {
    throw new Error('SMTP_USER dan MAIL_FROM harus memakai akun yang sama.');
  }

  let resetUrl = null;
  if (environment.PASSWORD_RESET_URL?.trim()) {
    resetUrl = new URL(environment.PASSWORD_RESET_URL.trim());
    if (!['http:', 'https:'].includes(resetUrl.protocol)) {
      throw new Error('Konfigurasi PASSWORD_RESET_URL tidak valid.');
    }
  }

  return { host, port, secure, user, password, from, resetUrl };
}

function resetInstructions(resetUrl, token) {
  if (!resetUrl) {
    return `Token reset: ${token}`;
  }
  const url = new URL(resetUrl);
  url.searchParams.set('token', token);
  return `Tautan reset: ${url.toString()}`;
}

export function createMailService({
  environment = process.env,
  createTransport = nodemailer.createTransport,
} = {}) {
  let transporter;
  let config;

  function getTransporter() {
    config ??= readMailConfig(environment);
    transporter ??= createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password.replace(/\s+/g, '') },
    });
    return transporter;
  }

  return {
    async sendPasswordReset({ to, token, expiresMinutes }) {
      const smtp = getTransporter();
      await smtp.sendMail({
        from: config.from,
        to,
        subject: 'Reset password SIPKITA',
        text: [
          'Permintaan reset password SIPKITA telah diterima.',
          resetInstructions(config.resetUrl, token),
          `Token berlaku selama ${expiresMinutes} menit dan hanya dapat digunakan satu kali.`,
          'Abaikan email ini jika Anda tidak meminta reset password.',
        ].join('\n\n'),
      });
    },
  };
}
