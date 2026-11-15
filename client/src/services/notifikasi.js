import api from './api.js';

export async function getUnreadCount({ signal } = {}) {
  const { data } = await api.get('/api/notifikasi/belum-dibaca/count', { signal });
  return data.data.count;
}

export async function getNotifications(page, { signal } = {}) {
  const { data } = await api.get('/api/notifikasi', {
    params: { page, limit: 8 }, signal,
  });
  return data.data;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/api/notifikasi/${encodeURIComponent(id)}/dibaca`);
  return data.data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch('/api/notifikasi/dibaca-semua');
  return data.data;
}
