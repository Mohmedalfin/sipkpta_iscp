import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchReviewerCandidates } from '../services/kaprodiReviewerKp.js';
import { fetchSupervisorCandidates } from '../services/kaprodiFinalisasiKp.js';

export default function useModalCandidates(kind, open, applicationId) {
  const fetchCandidates = kind === 'reviewer' ? fetchReviewerCandidates : fetchSupervisorCandidates;
  const client = useQueryClient();
  useEffect(() => () => {
    const key = ['kp-modal-candidates', kind, applicationId ?? null];
    const query = client.getQueryCache().find({ queryKey: key, exact: true });
    // Do not cancel a request still shared by another open modal.
    if (query && query.getObserversCount() <= 1) void client.cancelQueries({ queryKey: key, exact: true });
  }, [client, kind, applicationId, open]);
  return useQuery({
    queryKey: ['kp-modal-candidates', kind, applicationId ?? null],
    enabled: Boolean(open),
    queryFn: ({ signal }) => fetchCandidates({ limit: 100,
      ...(applicationId ? { pengajuan_id: applicationId } : {}) }, { signal }),
    staleTime: 30000,
  });
}
