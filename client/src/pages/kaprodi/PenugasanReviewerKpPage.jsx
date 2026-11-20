import useKpQueue from '../../hooks/useKpQueue.js';
import { useEffect, useRef, useState } from 'react';
import ErrorBanner from '../../components/common/ErrorBanner.jsx';
import {
  AssignReviewerModal,
  BulkAssignReviewerModal,
  ReviewerKpSummaryCards,
  ReviewerKpTable,
  ReviewerKpToolbar,
} from '../../components/kaprodi/penugasan-reviewer-kp/index.js';
import {
  kaprodiReviewerKpErrorMessage,
} from '../../services/kaprodiReviewerKp.js';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Halaman Penugasan Reviewer KP untuk Ketua Program Studi (Kaprodi)
 * Rute: /kaprodi/kp/penugasan-reviewer
 */
export default function PenugasanReviewerKpPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    total_pages: 1,
  });

  // Filter States
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [statusPenugasan, setStatusPenugasan] = useState('');
  const [statusPengajuan, setStatusPengajuan] = useState('');
  const [sort, setSort] = useState('baru');
  const [activeQuickFilter, setActiveQuickFilter] = useState('ALL');

  // Multi-select for bulk assignment
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal Kerja Penugasan Individual (Tahap 2)
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedPengajuanId, setSelectedPengajuanId] = useState(null);

  // Modal Penugasan Massal (Tahap 3)
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  // KPI Summary Cards
  const [counts, setCounts] = useState({
    belumAda: 0,
    sudahAda: 0,
    sudahAcc: 0,
    total: 0,
  });

  // Debounce search input
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (val) => {
    setSearch(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setActiveSearch(val);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
  };

  /**
   * Mengambil data antrean pengajuan KP dari backend
   */
  const queue = useKpQueue('kaprodi', { page: pagination.page, limit: pagination.limit, q: activeSearch, status_penugasan_reviewer: statusPenugasan, status_pengajuan: statusPengajuan, sort });
  const loadData = queue.reload;
  useEffect(() => {
    if (queue.error) toast.error(kaprodiReviewerKpErrorMessage(queue.error));
  }, [queue.error, toast]);
  useEffect(() => {
    setLoading(queue.isPending || queue.isPlaceholderData);
    setError(queue.error ? kaprodiReviewerKpErrorMessage(queue.error) : '');
    if (queue.data) {
      setItems(queue.data.items || []);
      setPagination((old) => ({ ...old, total: queue.data.pagination?.total || 0,
        total_pages: queue.data.pagination?.total_pages || 1 }));
    }
  }, [queue.data, queue.error, queue.isPending, queue.isPlaceholderData]);
  useEffect(() => {
    if (!queue.summary) return;
    const rows = queue.summary.items || [];
    setCounts({
        belumAda: rows.filter((i) => !i.jumlah_reviewer_aktif).length,
        sudahAda: rows.filter((i) => i.jumlah_reviewer_aktif > 0).length,
        sudahAcc: rows.filter((i) => i.status_pemeriksaan_berkas === 'OK_LENGKAP' || i.status_pengajuan === 'ACC').length,
        total: queue.summary.pagination?.total || rows.length,
    });
  }, [queue.summary]);
  useEffect(() => () => clearTimeout(searchTimeoutRef.current), []);

  // Handler Ganti Halaman
  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  // Handler Filter Cepat dari Summary Cards
  const handleSelectQuickFilter = (cardId) => {
    setActiveQuickFilter(cardId);
    setPagination((prev) => ({ ...prev, page: 1 }));

    if (cardId === 'BELUM_ADA') {
      setStatusPenugasan('BELUM_ADA');
      setStatusPengajuan('');
    } else if (cardId === 'SUDAH_ADA') {
      setStatusPenugasan('SUDAH_ADA');
      setStatusPengajuan('');
    } else if (cardId === 'ACC') {
      setStatusPenugasan('');
      setStatusPengajuan('ACC');
    } else {
      setStatusPenugasan('');
      setStatusPengajuan('');
    }
  };

  // Handler Reset Filter
  const handleResetFilters = () => {
    setSearch('');
    setActiveSearch('');
    setStatusPenugasan('');
    setStatusPengajuan('');
    setSort('baru');
    setActiveQuickFilter('ALL');
    setSelectedIds([]);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Handler Checkbox Baris
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Handler Checkbox Select All Halaman Aktif
  const handleToggleSelectAll = () => {
    const currentPageIds = items.map((item) => item.id);
    const allSelected =
      currentPageIds.length > 0 &&
      currentPageIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  // Handler Buka Modal Penugasan Individual
  const handleOpenAssign = (item) => {
    setSelectedPengajuanId(item.id);
    setAssignModalOpen(true);
  };

  // Handler Tutup Modal Penugasan Individual
  const handleCloseAssignModal = () => {
    setAssignModalOpen(false);
    setSelectedPengajuanId(null);
  };

  // Hitung Index & Total untuk Navigasi Antrean Modal
  const queueIndex =
    selectedPengajuanId && items.length > 0
      ? items.findIndex((i) => i.id === selectedPengajuanId) + 1
      : 1;
  const queueTotal = items.length;

  const handlePrevStudent = () => {
    const currentIndex = items.findIndex((i) => i.id === selectedPengajuanId);
    if (currentIndex > 0) {
      setSelectedPengajuanId(items[currentIndex - 1].id);
    }
  };

  const handleNextStudent = () => {
    const currentIndex = items.findIndex((i) => i.id === selectedPengajuanId);
    if (currentIndex >= 0 && currentIndex < items.length - 1) {
      setSelectedPengajuanId(items[currentIndex + 1].id);
    }
  };

  // Handler Tombol Aksi Penugasan Massal
  const handleOpenBulkAssign = () => {
    if (!selectedIds.length) {
      toast.warning('Pilih minimal satu pengajuan mahasiswa pada tabel terlebih dahulu.');
      return;
    }
    setBulkModalOpen(true);
  };

  const handleBulkSuccess = () => {
    setSelectedIds([]);
    loadData();
  };

  return (
    <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl space-y-6">
      {/* 1. Header Halaman */}
      <div className="border-b border-slate-900/[0.06] pb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Portal Ketua Program Studi
        </span>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Penugasan Reviewer KP
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-secondary">
          Tetapkan dosen penelaah proposal Kerja Praktik untuk memvalidasi kelayakan akademik mahasiswa Program Studi.
        </p>
      </div>

      {/* Alert Error jika ada */}
      <ErrorBanner
        title="Gagal Memuat Data Penugasan Reviewer"
        message={error}
        onRetry={loadData}
      />

      {/* 1. Summary KPI Cards */}
      <ReviewerKpSummaryCards
        counts={counts}
        activeFilter={activeQuickFilter}
        onSelectFilter={handleSelectQuickFilter}
        loading={loading}
      />

      {/* 2. Toolbar & Filter */}
      <ReviewerKpToolbar
        refreshing={queue.refreshing}
        search={search}
        onSearchChange={handleSearchChange}
        statusPenugasan={statusPenugasan}
        onStatusPenugasanChange={(val) => {
          setStatusPenugasan(val);
          setActiveQuickFilter('ALL');
          setPagination((prev) => ({ ...prev, page: 1 }));
        }}
        statusPengajuan={statusPengajuan}
        onStatusPengajuanChange={(val) => {
          setStatusPengajuan(val);
          setActiveQuickFilter('ALL');
          setPagination((prev) => ({ ...prev, page: 1 }));
        }}
        sort={sort}
        onSortChange={(val) => {
          setSort(val);
          setPagination((prev) => ({ ...prev, page: 1 }));
        }}
        onRefresh={loadData}
        onReset={handleResetFilters}
        loading={loading}
        selectedCount={selectedIds.length}
        onOpenBulkAssign={handleOpenBulkAssign}
      />

      {/* 3. Data Table */}
      <ReviewerKpTable
        items={items}
        loading={loading}
        error={error}
        onRetry={loadData}
        pagination={pagination}
        onPageChange={handlePageChange}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onOpenAssign={handleOpenAssign}
        onResetFilter={handleResetFilters}
        hasActiveFilter={Boolean(
          activeSearch.trim() || statusPenugasan || statusPengajuan || sort !== 'baru'
        )}
      />

      {/* 4. Modal Kerja Penugasan Reviewer Individual (Tahap 2) */}
      <AssignReviewerModal
        open={assignModalOpen}
        onClose={handleCloseAssignModal}
        pengajuanId={selectedPengajuanId}
        onSuccess={loadData}
        queueIndex={queueIndex}
        queueTotal={queueTotal}
        onPrevStudent={handlePrevStudent}
        onNextStudent={handleNextStudent}
      />

      {/* 5. Modal Penugasan Reviewer Massal (Tahap 3) */}
      <BulkAssignReviewerModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        selectedIds={selectedIds}
        items={items}
        onSuccess={handleBulkSuccess}
      />
    </div>
  );
}
