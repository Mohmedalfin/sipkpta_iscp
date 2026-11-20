import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import useReviewerKpList from '../../hooks/useReviewerKpList.js';
import { useToast } from '../../context/ToastContext.jsx';
import ErrorBanner from '../../components/common/ErrorBanner.jsx';
import {
  BulkReviewModal,
  ReviewKpSummaryCards,
  ReviewKpToolbar,
  ReviewTaskTable,
  ReviewWorkspaceModal,
} from '../../components/reviewer/review-kp/index.js';
import {
  downloadReviewerZip,
  fetchReviewerTasks,
  reviewerError,
  saveReviewerBlob,
} from '../../services/reviewerKp.js';

/**
 * Halaman Utama Review Proposal KP oleh Dosen Reviewer
 * Rute: /reviewer/kp/review
 */
export default function ReviewKpPage() {
  const list = useReviewerKpList();
  const toast = useToast();

  const [selection, setSelection] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Metrik KPI Summary Cards
  const [counts, setCounts] = useState({
    belumDireview: 0,
    layak: 0,
    tidakLayak: 0,
    total: 0,
  });

  // Ambil metrik ringkasan keseluruhan penugasan reviewer aktif
  const summary = useQuery({ queryKey: ['reviewer-kp-list', { limit: 100 }],
    queryFn: ({ signal }) => fetchReviewerTasks({ limit: 100 }, { signal }),
    refetchInterval: 120000, refetchIntervalInBackground: false });
  useEffect(() => {
      const data = summary.data;
      if (!data) return;
      const allTasks = data?.items || [];
      const belumDireview = allTasks.filter((t) => t.review_saya === 'BELUM_DIREVIEW').length;
      const layak = allTasks.filter((t) => t.review_saya === 'LAYAK').length;
      const tidakLayak = allTasks.filter((t) => t.review_saya === 'TIDAK_LAYAK').length;

      setCounts({
        belumDireview,
        layak,
        tidakLayak,
        total: data?.pagination?.total ?? allTasks.length,
      });
  }, [summary.data]);

  const selected = list.items.filter((item) => selection.includes(item.pengajuan_id));
  const ready = !list.loading && !list.error;
  const canBulk =
    ready &&
    selected.length > 0 &&
    selected.length <= 50 &&
    selected.every((item) => item.eligible_layak_bulk);

  // Quick filter kartu metrik
  const activeQuickFilter = list.query.status_review || 'ALL';

  const handleSelectQuickFilter = (filterKey) => {
    setSelection([]);
    if (filterKey === 'ALL' || filterKey === activeQuickFilter) {
      list.setStatus('');
    } else {
      list.setStatus(filterKey);
    }
  };

  // Toggle pilihan satu baris
  const select = (id) => {
    setSelection((old) =>
      old.includes(id) ? old.filter((value) => value !== id) : [...old, id]
    );
  };

  // Toggle pilih semua baris pada halaman aktif
  const toggleSelectAll = () => {
    const currentPageIds = list.items.map((item) => item.pengajuan_id);
    const allSelected =
      currentPageIds.length > 0 && currentPageIds.every((id) => selection.includes(id));

    if (allSelected) {
      setSelection((old) => old.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelection((old) => Array.from(new Set([...old, ...currentPageIds])));
    }
  };

  // Refresh data dan metrik
  const reload = () => {
    setSelection([]);
    return list.reload();
  };

  // Reset seluruh filter
  const handleResetFilters = () => {
    setSelection([]);
    list.setSearch('');
    list.setStatus('');
  };

  // Hitung Index & Total untuk Navigasi Antrean Mahasiswa pada Modal
  const queueIndex =
    workspace && list.items.length > 0
      ? list.items.findIndex((i) => i.pengajuan_id === workspace) + 1
      : 1;
  const queueTotal = list.items.length;

  const handlePrevStudent = () => {
    const currentIndex = list.items.findIndex((i) => i.pengajuan_id === workspace);
    if (currentIndex > 0) {
      setWorkspace(list.items[currentIndex - 1].pengajuan_id);
    }
  };

  const handleNextStudent = () => {
    const currentIndex = list.items.findIndex((i) => i.pengajuan_id === workspace);
    if (currentIndex >= 0 && currentIndex < list.items.length - 1) {
      setWorkspace(list.items[currentIndex + 1].pengajuan_id);
    }
  };

  // Unduh berkas ZIP (terpilih atau seluruh tugas)
  const download = async (all = false) => {
    setBusy(true);
    try {
      const blob = await downloadReviewerZip(
        all ? null : selected.map((item) => item.pengajuan_id)
      );
      saveReviewerBlob(
        blob,
        all ? 'Semua_Proposal_KP_Reviewer.zip' : 'Proposal_KP_Pilihan.zip'
      );
      toast.success(
        all
          ? 'Seluruh berkas proposal berhasil diunduh dalam ZIP.'
          : `${selected.length} proposal pilihan berhasil diunduh dalam ZIP.`
      );
    } catch (error) {
      toast.error(await reviewerError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl space-y-6">
      {/* 1. Header Halaman */}
      <div className="border-b border-slate-900/[0.06] pb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Portal Dosen Reviewer
        </span>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Review Proposal KP
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-secondary">
          Periksa proposal Kerja Praktik mahasiswa yang ditugaskan kepada Anda dan berikan arahan perbaikan akademik.
        </p>
      </div>

      {/* Alert Error jika ada */}
      {list.error && (
        <ErrorBanner
          title="Gagal Memuat Antrean Review"
          message={list.error}
          onRetry={reload}
        />
      )}

      {/* 2. KPI Summary Cards */}
      <ReviewKpSummaryCards
        counts={counts}
        activeFilter={activeQuickFilter}
        onSelectFilter={handleSelectQuickFilter}
        loading={list.loading}
      />

      {/* 3. Toolbar & Filter */}
      <ReviewKpToolbar
        refreshing={list.refreshing || summary.isFetching}
        search={list.search}
        onSearchChange={(val) => {
          setSelection([]);
          list.setSearch(val);
        }}
        statusReview={list.query.status_review || ''}
        onStatusReviewChange={(val) => {
          setSelection([]);
          list.setStatus(val);
        }}
        onRefresh={reload}
        onReset={handleResetFilters}
        loading={list.loading}
        busy={busy}
        selectedCount={selected.length}
        canBulk={canBulk}
        onDownloadSelected={() => download(false)}
        onDownloadAll={() => download(true)}
        onOpenBulkReview={() => setBulkModalOpen(true)}
      />

      {/* 4. Data Table */}
      <ReviewTaskTable
        list={{
          ...list,
          setPage: (page) => {
            setSelection([]);
            list.setPage(page);
          },
        }}
        selected={selection}
        onSelect={select}
        onSelectAll={toggleSelectAll}
        onOpen={setWorkspace}
        onResetFilter={handleResetFilters}
      />

      {/* Modal Workspace Review */}
      {workspace !== null && (
        <ReviewWorkspaceModal
          key={workspace}
          id={workspace}
          initialItem={list.items.find((i) => i.pengajuan_id === workspace)}
          onClose={() => setWorkspace(null)}
          onSaved={() => {
            toast.success('Hasil review berhasil disimpan.');
            reload();
          }}
          queueIndex={queueIndex}
          queueTotal={queueTotal}
          onPrevStudent={handlePrevStudent}
          onNextStudent={handleNextStudent}
        />
      )}

      {/* Modal Konfirmasi Layak Massal (Bulk Layak) */}
      <BulkReviewModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        selected={selected}
        onSuccess={() => {
          setSelection([]);
          reload();
        }}
      />
    </div>
  );
}
