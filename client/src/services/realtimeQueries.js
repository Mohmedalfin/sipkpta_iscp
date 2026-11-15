const families = ['kp-reviews', 'kp-detail', 'admin-kp-list', 'kaprodi-kp-list',
  'reviewer-kp-list', 'admin-kp-detail', 'kaprodi-kp-detail'];

export function isRealtimeQuery(key, events = null) {
  if (key[0] === 'notifications') return !events || events.some((event) => event.type === 'notifikasi.updated');
  if (!families.includes(key[0])) return false;
  if (!events) return true;
  return events.some((event) => {
    if (!['pengajuan.review.updated', 'pengajuan.administration.updated', 'pengajuan.assignment.updated'].includes(event.type)) return false;
    if (key[0].endsWith('-list')) return true;
    return key[1] === event.resource_id;
  });
}
