import useKpQueue from '../../hooks/useKpQueue.js';
import { useEffect, useRef, useState } from 'react';
import ErrorBanner from '../../components/common/ErrorBanner.jsx';
import {
  KpAdminSummaryCards,
  KpAdminTable,
  KpAdminToolbar,
  KpAdminWorkspaceModal,
} from '../../components/admin-prodi/verifikasi-pengajuan-kp/index.js';
import {
  adminPengajuanKpErrorMessage,
} from '../../services/adminPengajuanKp.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function VerifikasiPengajuanKpPage() {
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
  const [statusPengajuan, setStatusPengajuan] = useState('');
  const [statusBerkas, setStatusBerkas] = useState('');
  const [statusNilai, setStatusNilai] = useState('');
  const [activeQuickFilter, setActiveQuickFilter] = useState('ALL');

  // Metrik Summary Cards
  const [counts, setCounts] = useState({
    perluDiperiksa: 0,
    perluPerbaikan: 0,
    siapPutusan: 0,
    sudahAcc: 0,
  });

  // Workspace Modal State
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [selectedPengajuanId, setSelectedPengajuanId] = useState(null);

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
  const queue = useKpQueue('admin', { page: pagination.page, limit: pagination.limit, search: activeSearch, status_pengajuan: statusPengajuan, status_berkas: statusBerkas, status_nilai: statusNilai });
  const loadData = queue.reload;
  useEffect(() => {
    if (queue.error) toast.error(adminPengajuanKpErrorMessage(queue.error));
  }, [queue.error, toast]);
  useEffect(() => {
    setLoading(queue.isPending || queue.isPlaceholderData);
    setError(queue.error ? adminPengajuanKpErrorMessage(queue.error) : '');
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
        perluDiperiksa: rows.filter((i) => i.status_pengajuan === 'DIAJUKAN' && (i.status_pemeriksaan_berkas === 'BELUM_DIPERIKSA' || i.status_pemeriksaan_akademik === 'BELUM_DIPERIKSA')).length,
        perluPerbaikan: rows.filter((i) => i.status_pemeriksaan_berkas === 'BELUM_OK' || i.status_pemeriksaan_akademik === 'BELUM_OK').length,
        siapPutusan: rows.filter((i) => i.status_pengajuan === 'DIAJUKAN' && i.status_pemeriksaan_berkas === 'OK_LENGKAP' && i.status_pemeriksaan_akademik === 'OK_LENGKAP').length,
        sudahAcc: rows.filter((i) => i.status_pengajuan === 'ACC').length,
    });
  }, [queue.summary]);
  useEffect(() => () => clearTimeout(searchTimeoutRef.current), []);

  // Handler klik kartu metrik cepat
  const handleSelectQuickFilter = (filterId) => {
    if (activeQuickFilter === filterId) {
      // Toggle off
      setActiveQuickFilter('ALL');
      setStatusPengajuan('');
      setStatusBerkas('');
      setStatusNilai('');
    } else {
      setActiveQuickFilter(filterId);
      if (filterId === 'DIAJUKAN') {
        setStatusPengajuan('DIAJUKAN');
        setStatusBerkas('');
        setStatusNilai('');
      } else if (filterId === 'BELUM_OK') {
        setStatusPengajuan('');
        setStatusBerkas('BELUM_OK');
        setStatusNilai('');
      } else if (filterId === 'SIAP_ACC') {
        setStatusPengajuan('DIAJUKAN');
        setStatusBerkas('OK_LENGKAP');
        setStatusNilai('OK_LENGKAP');
      } else if (filterId === 'ACC') {
        setStatusPengajuan('ACC');
        setStatusBerkas('');
        setStatusNilai('');
      }
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Reset semua filter
  const handleResetFilters = () => {
    setSearch('');
    setActiveSearch('');
    setStatusPengajuan('');
    setStatusBerkas('');
    setStatusNilai('');
    setActiveQuickFilter('ALL');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Buka Modal Workspace
  const handleOpenWorkspace = (id) => {
    setSelectedPengajuanId(id);
    setWorkspaceOpen(true);
  };

  // Tutup Modal Workspace
  const handleCloseWorkspace = () => {
    setWorkspaceOpen(false);
    setSelectedPengajuanId(null);
  };

  // Callback setelah status atau keputusan diubah di modal
  const handleStatusUpdated = () => {
    loadData();
  };

  // Navigasi antrean di dalam modal workspace
  const currentQueueIndex = items.findIndex((i) => i.id === selectedPengajuanId);

  const handlePrevQueueItem = () => {
    if (currentQueueIndex > 0) {
      setSelectedPengajuanId(items[currentQueueIndex - 1].id);
    }
  };

  const handleNextQueueItem = () => {
    if (currentQueueIndex >= 0 && currentQueueIndex < items.length - 1) {
      setSelectedPengajuanId(items[currentQueueIndex + 1].id);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl space-y-6">
      {/* ============================================================ */}
      {/* Header Halaman                                               */}
      {/* ============================================================ */}
      <div className="border-b border-line pb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Portal Administrasi Program Studi
        </span>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Verifikasi Pengajuan Kerja Praktik (KP)
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-secondary">
          Pemeriksaan berkas persyaratan, validasi kelayakan data akademik, dan persetujuan (ACC Administratif) pengajuan Kerja Praktik mahasiswa.
        </p>
      </div>

      {/* ============================================================ */}
      {/* 1. Kartu Ringkasan Metrik Antrean                            */}
      {/* ============================================================ */}
      <KpAdminSummaryCards
        counts={counts}
        activeFilter={activeQuickFilter}
        onSelectFilter={handleSelectQuickFilter}
        loading={loading && items.length === 0}
      />

      {/* ============================================================ */}
      {/* 2. Toolbar Pencarian & Filter                                */}
      {/* ============================================================ */}
      <KpAdminToolbar
        refreshing={queue.refreshing}
        search={search}
        onSearchChange={handleSearchChange}
        statusPengajuan={statusPengajuan}
        statusBerkas={statusBerkas}
        statusNilai={statusNilai}
        onStatusPengajuanChange={(val) => {
          setStatusPengajuan(val);
          setActiveQuickFilter('CUSTOM');
          setPagination((p) => ({ ...p, page: 1 }));
        }}
        onStatusBerkasChange={(val) => {
          setStatusBerkas(val);
          setActiveQuickFilter('CUSTOM');
          setPagination((p) => ({ ...p, page: 1 }));
        }}
        onStatusNilaiChange={(val) => {
          setStatusNilai(val);
          setActiveQuickFilter('CUSTOM');
          setPagination((p) => ({ ...p, page: 1 }));
        }}
        onRefresh={loadData}
        onReset={handleResetFilters}
        loading={loading}
      />

      {/* ============================================================ */}
      {/* 3. Pesan Error (jika ada)                                    */}
      {/* ============================================================ */}
      {error && (
        <ErrorBanner
          title="Gagal Memuat Antrean Pengajuan KP"
          message={error}
          onRetry={loadData}
        />
      )}

      {/* ============================================================ */}
      {/* 4. Tabel Daftar Antrean Pengajuan KP                         */}
      {/* ============================================================ */}
      <KpAdminTable
        items={items}
        pagination={pagination}
        onPageChange={(newPage) => setPagination((prev) => ({ ...prev, page: newPage }))}
        onOpenDetail={handleOpenWorkspace}
        loading={loading}
        error={error}
        onRetry={loadData}
        hasActiveFilter={Boolean(activeSearch.trim() || statusPengajuan || statusBerkas || statusNilai)}
        onResetFilter={handleResetFilters}
      />

      {/* ============================================================ */}
      {/* 5. Modal Workspace Pemeriksaan Layar Penuh                   */}
      {/* ============================================================ */}
      <KpAdminWorkspaceModal
        open={workspaceOpen}
        pengajuanId={selectedPengajuanId}
        queueIndex={currentQueueIndex >= 0 ? currentQueueIndex : 0}
        queueTotal={items.length}
        onPrevStudent={handlePrevQueueItem}
        onNextStudent={handleNextQueueItem}
        onClose={handleCloseWorkspace}
        onStatusUpdated={handleStatusUpdated}
      />
    </div>
  );
}

