import { useEffect, useState } from 'react';
import { fetchReviewerTasks, reviewerError } from '../services/reviewerKp.js';

export default function useReviewerKpList() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ page: 1, limit: 15, q: '', status_review: '' });
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ items: [], pagination: {}, loading: true, error: '' });
  useEffect(() => {
    const timer = setTimeout(() => setQuery((old) => ({ ...old, page: 1, q: search.trim() })), 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setState((old) => ({ ...old, loading: true, error: '' }));
    const params = { ...query };
    if (!params.status_review) delete params.status_review;
    fetchReviewerTasks(params, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setState({ ...data, loading: false, error: '' });
    }).catch(async (error) => {
      const message = await reviewerError(error);
      if (!controller.signal.aborted) setState((old) => ({ ...old, loading: false, error: message }));
    });
    return () => controller.abort();
  }, [query, version]);
  return { ...state, search, setSearch, query,
    setPage: (page) => setQuery((old) => ({ ...old, page })),
    setStatus: (status_review) => setQuery((old) => ({ ...old, page: 1, status_review })),
    reload: () => setVersion((old) => old + 1) };
}
