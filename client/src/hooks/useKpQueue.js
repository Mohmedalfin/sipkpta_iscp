import { refreshQueries } from '../utils/refreshQueries.js';
import { useCallback } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminKpApplications } from '../services/adminPengajuanKp.js';
import { fetchKaprodiKpApplications } from '../services/kaprodiReviewerKp.js';

export default function useKpQueue(kind, params) {
  const client = useQueryClient();
  const fetchList = kind === 'admin' ? fetchAdminKpApplications : fetchKaprodiKpApplications;
  const family = `${kind}-kp-list`;
  const query = useQuery({ queryKey: [family, params],
    queryFn: ({ signal }) => fetchList(params, { signal }), placeholderData: keepPreviousData,
    refetchInterval: 120000, refetchIntervalInBackground: false });
  const summary = useQuery({ queryKey: [family, { page: 1, limit: 100 }],
    queryFn: ({ signal }) => fetchList({ page: 1, limit: 100 }, { signal }),
    refetchInterval: 120000, refetchIntervalInBackground: false });
  const reload = useCallback(() => refreshQueries(client, [family]), [client, family]);
  return { ...query, refreshing: query.isFetching || summary.isFetching, summary: summary.data, reload };
}
