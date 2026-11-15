import { useQuery } from '@tanstack/react-query';
import { getKpReviews, pengajuanKpErrorMessage } from '../services/pengajuanKp.js';

export default function useKpReviews(application) {
  const enabled = Boolean(application && application.status_pengajuan !== 'DRAFT');
  const query = useQuery({ queryKey: ['kp-reviews', application?.id], enabled,
    queryFn: ({ signal }) => getKpReviews(application.id, { signal }),
    refetchInterval: 120000, refetchIntervalInBackground: false });
  return { reviews: enabled ? query.data ?? null : null,
    reviewError: enabled && query.error ? pengajuanKpErrorMessage(query.error, 'Hasil review belum dapat dimuat.') : '' };
}
