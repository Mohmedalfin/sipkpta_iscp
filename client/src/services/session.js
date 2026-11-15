const SESSION_KEY = 'sipkita.auth.session';

function isUser(value) {
  return value && Number.isInteger(value.id) && typeof value.login_id === 'string' &&
    Array.isArray(value.roles) && value.roles.length > 0 &&
    value.roles.every((role) => typeof role === 'string') &&
    (value.activeRole === null || value.roles.includes(value.activeRole));
}

function isSession(value) {
  return value && typeof value.accessToken === 'string' && value.accessToken.length > 0 &&
    typeof value.refreshToken === 'string' && value.refreshToken.length > 0 && isUser(value.user);
}

export function getSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (isSession(value)) return value;
  } catch {
    // Sesi rusak diperlakukan sebagai tidak terautentikasi.
  }
  sessionStorage.removeItem(SESSION_KEY);
  return null;
}

export function saveSession(data) {
  const current = getSession();
  const session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? current?.refreshToken,
    tokenType: data.tokenType ?? current?.tokenType ?? 'Bearer',
    expiresIn: data.expiresIn ?? current?.expiresIn ?? null,
    user: data.user,
  };
  if (!isSession(session)) throw new Error('Respons autentikasi tidak valid.');
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
