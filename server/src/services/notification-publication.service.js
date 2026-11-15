import { AsyncLocalStorage } from 'node:async_hooks';
import { publishNotificationChanges } from './realtime.service.js';

const recipients = new AsyncLocalStorage();

export function rememberNotificationRecipients(userIds) {
  const pending = recipients.getStore();
  if (pending) for (const id of userIds) pending.add(id);
}

export async function withNotificationPublication(operation) {
  const pending = new Set();
  const result = await recipients.run(pending, operation);
  // The transaction has committed. Delivery is best effort and cannot change its result.
  if (pending.size) {
    try { publishNotificationChanges(pending); }
    catch { console.error('Realtime notification publication failed.'); }
  }
  return result;
}
