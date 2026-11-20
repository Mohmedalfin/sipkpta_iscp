import { refreshQueries } from '../utils/refreshQueries.js';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchReviewerTasks, reviewerError } from '../services/reviewerKp.js';

export default function useReviewerKpList() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ page: 1, limit: 15, q: '', status_review: '' });
  const client = useQueryClient();
  const [error, setError] = useState('');
  const params = { ...query };
  if (!params.status_review) delete params.status_review;
  const result = useQuery({ queryKey: ['reviewer-kp-list', params],
    queryFn: ({ signal }) => fetchReviewerTasks(params, { signal }),
    refetchInterval: 120000, refetchIntervalInBackground: false });
  useEffect(() => {
    const timer = setTimeout(() => setQuery((old) => ({ ...old, page: 1, q: search.trim() })), 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setError('');
    if (result.error) void reviewerError(result.error).then((message) => { if (active) setError(message); });
    return () => { active = false; };
  }, [result.error]);
  return { items: [], pagination: {}, ...result.data, loading: result.isPending, refreshing: result.isFetching, error, search, setSearch, query,
    setPage: (page) => setQuery((old) => ({ ...old, page })),
    setStatus: (status_review) => setQuery((old) => ({ ...old, page: 1, status_review })),
    reload: () => refreshQueries(client, ['reviewer-kp-list']) };
}
