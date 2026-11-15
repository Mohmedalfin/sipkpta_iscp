import axios from 'axios';
import { clearSession, getSession, saveSession } from './session.js';

const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:5000',
  timeout: 5000,
});

api.interceptors.request.use((config) => {
  const token = getSession()?.accessToken;
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const session = getSession();
    const isAuthRequest = /\/api\/auth\/(?:login|refresh)$/.test(request?.url || '');
    if (error.response?.status !== 401 || request?._retried || isAuthRequest || !session) {
      return Promise.reject(error);
    }

    request._retried = true;
    try {
      refreshPromise ??= axios.post(
        `${api.defaults.baseURL}/api/auth/refresh`,
        { refreshToken: session.refreshToken },
        { timeout: api.defaults.timeout },
      ).then(({ data }) => saveSession(data.data)).finally(() => { refreshPromise = null; });
      const refreshed = await refreshPromise;
      request.headers.Authorization = `Bearer ${refreshed.accessToken}`;
      return api(request);
    } catch (refreshError) {
      clearSession();
      window.dispatchEvent(new Event('sipkita:session-expired'));
      return Promise.reject(refreshError);
    }
  },
);

export default api;
