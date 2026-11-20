import { toggleFinalisasiPage, toggleFinalisasiSelection } from '../../utils/finalisasiSelection.js';
import { useState } from 'react';
import ErrorBanner from '../../components/common/ErrorBanner.jsx';
import {
  BulkAssignSupervisorModal,
  FinalisasiKpSummaryCards,
  FinalisasiKpTable,
  FinalisasiKpToolbar,
  FinalisasiWorkspaceModal,
} from '../../components/kaprodi/finalisasi-kp/index.js';
import useKaprodiFinalisasiKpList from '../../hooks/useKaprodiFinalisasiKpList.js';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Halaman Finalisasi & Penetapan Pembimbing KP untuk Ketua Program Studi (Kaprodi)
 * Rute: /kaprodi/kp/finalisasi
 */
export default function FinalisasiPembimbingKpPage() {
  const toast = useToast();
  const list = useKaprodiFinalisasiKpList();

  // State pemilihan baris untuk aksi massal
  const [selectedApplications, setSelectedApplications] = useState([]);
  const selectedIds = selectedApplications.map((item) => item.id);

  // State Modal Workspace (Tahap 2)
  const [selectedPengajuanId, setSelectedPengajuanId] = useState(null);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);

  // State Modal Penetapan Massal (Tahap 3)
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  // Handler seleksi satu baris
  const handleToggleSelect = (id) => {
    const item = list.items.find((row) => row.id === id);
    setSelectedApplications((previous) => toggleFinalisasiSelection(previous, item));
  };

  const handleToggleSelectAll = () => {
    setSelectedApplications((previous) => toggleFinalisasiPage(previous, list.items));
  };

  // Handler filter cepat kartu ringkasan KPI
  const handleSelectQuickFilter = (status) => {
    setSelectedApplications([]);
    list.setStatusFinalisasi(status);
  };

  // Handler buka workspace per pengajuan
  const handleOpenAction = (item) => {
    setSelectedPengajuanId(item.id);
    setWorkspaceModalOpen(true);
  };

  // Navigasi antrean di dalam modal workspace
  const currentIndex = list.items.findIndex((item) => item.id === selectedPengajuanId);
  const queueIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
  const queueTotal = list.items.length;

  const handlePrevStudent = () => {
    if (currentIndex > 0) {
      setSelectedPengajuanId(list.items[currentIndex - 1].id);
    }
  };

  const handleNextStudent = () => {
    if (currentIndex >= 0 && currentIndex < list.items.length - 1) {
      setSelectedPengajuanId(list.items[currentIndex + 1].id);
    }
  };

  const handleCloseWorkspace = () => {
    setWorkspaceModalOpen(false);
    setSelectedPengajuanId(null);
  };

  // Handler buka modal penetapan massal (Tahap 3)
  const handleOpenBulkAssign = () => {
    if (selectedIds.length === 0) return;
    setBulkModalOpen(true);
  };

  const handleBulkSuccess = () => {
    setSelectedApplications([]);
    list.reload();
  };

  return (
    <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl space-y-6">
      {/* 1. Header Halaman */}
      <div className="border-b border-slate-900/[0.06] pb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Portal Ketua Program Studi
        </span>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Finalisasi & Penetapan Pembimbing KP
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-secondary">
          Pemeriksaan kelayakan terpadu (berkas, nilai akademik, verifikasi data diri, review proposal) dan penetapan Dosen Pembimbing Kerja Praktik.
        </p>
      </div>

      {/* Banner Pesan Error jika request gagal */}
      <ErrorBanner
        title="Gagal Memuat Antrean Finalisasi"
        message={list.error}
        onRetry={list.reload}
      />

      {/* KPI Summary Cards */}
      <FinalisasiKpSummaryCards
        counts={list.counts}
        activeFilter={list.query.status_finalisasi}
        onSelectFilter={handleSelectQuickFilter}
        loading={list.loading}
      />

      {/* Toolbar Pencarian & Filter */}
      <FinalisasiKpToolbar
        refreshing={list.refreshing}
        search={list.search}
        onSearchChange={list.setSearch}
        statusFinalisasi={list.query.status_finalisasi}
        onStatusFinalisasiChange={list.setStatusFinalisasi}
        sort={list.query.sort}
        onSortChange={list.setSort}
        onRefresh={list.reload}
        onReset={list.resetFilters}
        loading={list.loading}
        selectedCount={selectedIds.length}
        onOpenBulkAssign={handleOpenBulkAssign}
      />

      {/* Tabel Data Antrean Finalisasi */}
      <FinalisasiKpTable
        items={list.items}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onOpenAction={handleOpenAction}
        pagination={list.pagination}
        onPageChange={list.setPage}
        hasActiveFilter={Boolean(
          list.search.trim() ||
            list.query.status_finalisasi ||
            list.query.sort !== 'baru'
        )}
        onResetFilter={list.resetFilters}
      />

      {/* Workspace Modal Review Kelayakan, Penetapan & Penggantian Pembimbing (Tahap 2) */}
      <FinalisasiWorkspaceModal
        open={workspaceModalOpen}
        onClose={handleCloseWorkspace}
        pengajuanId={selectedPengajuanId}
        onSuccess={list.reload}
        queueIndex={queueIndex}
        queueTotal={queueTotal}
        onPrevStudent={handlePrevStudent}
        onNextStudent={handleNextStudent}
      />

      {/* Modal Penetapan Pembimbing Massal (Tahap 3) */}
      <BulkAssignSupervisorModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        selectedIds={selectedIds}
        items={selectedApplications}
        onSuccess={handleBulkSuccess}
      />
    </div>
  );
}
