/** Pesan bisnis dapat ditangani modul sebelum memakai fallback teknis ini. */
export function apiErrorMessage(error, {
  fallback = 'Permintaan belum dapat diproses. Coba lagi.',
  networkMessage = 'Koneksi ke server gagal. Periksa jaringan Anda.',
  timeoutMessage,
} = {}) {
  const message = error?.response?.data?.error?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (timeoutMessage && ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) return timeoutMessage;
  if (error?.message && !error.response) return networkMessage;
  return fallback;
}

/** Error endpoint berkas dikirim Axios sebagai Blob, termasuk respons JSON gagal. */
export async function apiBlobErrorMessage(error, options) {
  if (error?.response?.data instanceof Blob) {
    try {
      const data = JSON.parse(await error.response.data.text());
      return apiErrorMessage({ response: { data } }, options);
    } catch { return apiErrorMessage({ response: {} }, options); }
  }
  return apiErrorMessage(error, options);
}
