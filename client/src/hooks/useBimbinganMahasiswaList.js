import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bimbinganErrorMessage, fetchBimbinganList } from '../services/bimbinganMahasiswa.js';
import { BIMBINGAN_QUERY } from '../services/realtimeQueries.js';

const LIMIT = 15;
const SEARCH_DELAY_MS = 350;
const initialFilters = { page: 1, status_bimbingan: '', jenis_bimbingan: '', q: '' };
const emptyPagination = { page: 1, limit: LIMIT, total: 0, total_pages: 1 };

export default function useBimbinganMahasiswaList(pengajuanId) {
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState('');
  const keyword = search.trim();

  useEffect(() => {
    if (keyword === filters.q) return undefined;
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, q: keyword, page: 1 }));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [keyword, filters.q]);

  const query = useQuery({
    queryKey: [BIMBINGAN_QUERY.list, pengajuanId, filters],
    enabled: Boolean(pengajuanId),
    queryFn: ({ signal }) => fetchBimbinganList(pengajuanId, { ...filters, limit: LIMIT }, { signal }),
    placeholderData: (previous, query) => query?.queryKey[1] === pengajuanId ? previous : undefined,
  });

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value, page: 1 }));
  };
  const resetFilters = () => {
    setSearch('');
    setFilters(initialFilters);
  };

  return {
    loading: Boolean(pengajuanId) && (query.isPending || query.isPlaceholderData),
    refreshing: query.isFetching,
    error: query.error ? bimbinganErrorMessage(query.error, 'Gagal memuat daftar catatan bimbingan.') : '',
    items: query.data?.items ?? [],
    progres: query.data?.progres ?? null,
    pagination: query.data?.pagination ?? emptyPagination,
    setPage: (page) => setFilters((current) => ({ ...current, page })),
    statusFilter: filters.status_bimbingan,
    setStatusFilter: (value) => updateFilter('status_bimbingan', value),
    jenisFilter: filters.jenis_bimbingan,
    setJenisFilter: (value) => updateFilter('jenis_bimbingan', value),
    search,
    setSearch: (value) => setSearch(value.slice(0, 100)),
    hasActiveFilter: Boolean(filters.status_bimbingan || filters.jenis_bimbingan || keyword),
    resetFilters,
    reload: () => query.refetch({ cancelRefetch: false }),
  };
}
