export const BIMBINGAN_QUERY = Object.freeze({
  context: 'bimbingan-context',
  list: 'bimbingan-list',
  detail: 'bimbingan-detail',
});

const families = ['kp-reviews', 'kp-detail', 'admin-kp-list', 'kaprodi-kp-list',
  'reviewer-kp-list', 'admin-kp-detail', 'kaprodi-kp-detail',
  'kaprodi-finalisasi-kp-list', 'kaprodi-finalisasi-kp-summary', 'kaprodi-finalisasi-kp-detail'];

export function isRealtimeQuery(key, events = null) {
  if (key[0] === 'notifications') return !events || events.some((event) => event.type === 'notifikasi.updated');
  if (key[0] === BIMBINGAN_QUERY.context) {
    return !events || events.some((event) => event.type === 'pengajuan.assignment.updated' ||
      event.type === 'pengajuan.administration.updated');
  }
  if (key[0] === BIMBINGAN_QUERY.list || key[0] === BIMBINGAN_QUERY.detail) {
    return !events || events.some((event) => event.resource_id === key[1] &&
      (event.type === 'bimbingan.updated' || event.type === 'bimbingan.draft.updated'));
  }
  if (!families.includes(key[0])) return false;
  if (!events) return true;
  return events.some((event) => {
    if (!['pengajuan.review.updated', 'pengajuan.administration.updated', 'pengajuan.assignment.updated'].includes(event.type)) return false;
    if (key[0].endsWith('-list') || key[0].endsWith('-summary')) return true;
    return key[1] === event.resource_id;
  });
}
