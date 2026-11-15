import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotifications, getUnreadCount, markAllNotificationsRead,
  markNotificationRead } from '../services/notifikasi.js';

const keys = { count: ['notifications', 'count'], list: (page) => ['notifications', 'list', page] };

export function useNotifications(open, page) {
  const client = useQueryClient();
  const count = useQuery({ queryKey: keys.count, queryFn: getUnreadCount,
    refetchInterval: 120000, refetchIntervalInBackground: false });
  const list = useQuery({ queryKey: keys.list(page),
    queryFn: ({ signal }) => getNotifications(page, { signal }), enabled: open });

  async function readOne(id) {
    await markNotificationRead(id);
    await client.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function readAll() {
    await markAllNotificationsRead();
    await client.invalidateQueries({ queryKey: ['notifications'] });
  }

  return { count, list, readOne, readAll };
}
