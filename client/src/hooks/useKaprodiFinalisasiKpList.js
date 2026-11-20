import { refreshQueries } from '../utils/refreshQueries.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchKaprodiFinalisasiKpList,
  kaprodiFinalisasiKpErrorMessage,
} from '../services/kaprodiFinalisasiKp.js';

/**
 * Custom hook untuk manajemen data antrean finalisasi & penetapan pembimbing KP oleh Kaprodi
 * Menyediakan state pencarian ter-debounce, filter, pagination, metrik KPI, dan integrasi React Query.
 */
export default function useKaprodiFinalisasiKpList() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({
    page: 1,
    limit: 15,
    q: '',
    status_finalisasi: '',
    sort: 'baru',
  });

  // Debounce input pencarian (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((prev) => ({
        ...prev,
        page: 1,
        q: search.trim(),
      }));
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  // Query parameter yang bersih untuk request list
  const activeParams = useMemo(() => {
    const p = {
      page: query.page,
      limit: query.limit,
      sort: query.sort,
    };
    if (query.q) p.q = query.q;
    if (query.status_finalisasi) p.status_finalisasi = query.status_finalisasi;
    return p;
  }, [query]);

  // React Query antrean utama dengan pagination
  const listQuery = useQuery({
    queryKey: ['kaprodi-finalisasi-kp-list', activeParams],
    queryFn: ({ signal }) => fetchKaprodiFinalisasiKpList(activeParams, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
  });

  // React Query untuk kalkulasi ringkasan metrik KPI global (tanpa filter status)
  const summaryQuery = useQuery({
    queryKey: ['kaprodi-finalisasi-kp-summary'],
    queryFn: ({ signal }) => fetchKaprodiFinalisasiKpList({ page: 1, limit: 1 }, { signal }),
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
  });

  // Hitung metrik KPI ringkasan
  const counts = useMemo(() => {
    if (summaryQuery.data?.summary) return summaryQuery.data.summary;
    const allItems = summaryQuery.data?.items || [];
    const belumSiap = allItems.filter((i) => i.status_finalisasi === 'BELUM_SIAP').length;
    const siapDitetapkan = allItems.filter((i) => i.status_finalisasi === 'SIAP_DITETAPKAN').length;
    const sudahDitetapkan = allItems.filter((i) => i.status_finalisasi === 'SUDAH_DITETAPKAN').length;
    const total = summaryQuery.data?.pagination?.total ?? allItems.length;

    return {
      belumSiap,
      siapDitetapkan,
      sudahDitetapkan,
      total,
    };
  }, [summaryQuery.data]);

  // Pesan error terformat
  const errorMessage = useMemo(() => {
    if (!listQuery.error) return '';
    return kaprodiFinalisasiKpErrorMessage(listQuery.error);
  }, [listQuery.error]);

  // Handler perubahan halaman
  const setPage = useCallback((newPage) => {
    setQuery((prev) => ({ ...prev, page: newPage }));
  }, []);

  // Handler filter status finalisasi
  const setStatusFinalisasi = useCallback((status) => {
    setQuery((prev) => ({
      ...prev,
      page: 1,
      status_finalisasi: status,
    }));
  }, []);

  // Handler pengurutan
  const setSort = useCallback((sortOrder) => {
    setQuery((prev) => ({
      ...prev,
      page: 1,
      sort: sortOrder,
    }));
  }, []);

  // Handler reset seluruh filter
  const resetFilters = useCallback(() => {
    setSearch('');
    setQuery({
      page: 1,
      limit: 15,
      q: '',
      status_finalisasi: '',
      sort: 'baru',
    });
  }, []);

  // Reload cache query
  const reload = useCallback(() => {
    return refreshQueries(queryClient, ['kaprodi-finalisasi-kp-list', 'kaprodi-finalisasi-kp-summary']);
  }, [queryClient]);

  const items = listQuery.data?.items || [];
  const pagination = listQuery.data?.pagination || {
    page: query.page,
    limit: query.limit,
    total: 0,
    total_pages: 1,
  };

  return {
    items,
    pagination,
    refreshing: listQuery.isFetching || summaryQuery.isFetching,
    loading: listQuery.isPending || listQuery.isPlaceholderData,
    error: errorMessage,
    search,
    setSearch,
    query,
    counts,
    setPage,
    setStatusFinalisasi,
    setSort,
    resetFilters,
    reload,
  };
}
