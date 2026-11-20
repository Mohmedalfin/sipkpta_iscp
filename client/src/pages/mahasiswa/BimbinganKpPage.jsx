import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bimbinganErrorMessage, fetchBimbinganContext } from '../../services/bimbinganMahasiswa.js';
import { BIMBINGAN_QUERY, isRealtimeQuery } from '../../services/realtimeQueries.js';
import ErrorBanner from '../../components/common/ErrorBanner.jsx';
import TableSkeletonRows from '../../components/common/TableSkeletonRows.jsx';
import useBimbinganMahasiswaList from '../../hooks/useBimbinganMahasiswaList.js';
import {
  BimbinganDetailModal,
  BimbinganFormModal,
  BimbinganLockedState,
  BimbinganProgressCard,
  BimbinganSupervisorCard,
  BimbinganTable,
  BimbinganToolbar,
} from '../../components/mahasiswa/bimbingan/index.js';

export default function BimbinganKpPage() {
  const context = useQuery({
    queryKey: [BIMBINGAN_QUERY.context],
    queryFn: ({ signal }) => fetchBimbinganContext({ signal }),
  });
  const activeApplication = context.data;
  const pengajuanId = activeApplication?.bimbingan_aktif ? activeApplication.id : null;
  const appError = context.error
    ? bimbinganErrorMessage(context.error, 'Gagal memverifikasi status pengajuan Kerja Praktik Anda.')
    : '';

  return (
    <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl space-y-6">
      <div className="border-b border-slate-900/[0.06] pb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Portal Akademik Mahasiswa
        </span>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Bimbingan Kerja Praktik
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-secondary">
          Catat sesi konsultasi tatap muka maupun daring, pantau pemenuhan target minimal bimbingan, dan tinjau arahan Dosen Pembimbing Anda.
        </p>
      </div>
      {appError && (
        <ErrorBanner
          title="Gagal Memuat Data Bimbingan"
          message={appError}
          onRetry={() => context.refetch({ cancelRefetch: false })}
        />
      )}
      {context.isPending ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 rounded-[18px] bg-white/70 border border-slate-900/[0.06]" />
          <div className="h-32 rounded-[18px] bg-white/70 border border-slate-900/[0.06]" />
          <div className="h-64 rounded-[18px] bg-white/70 border border-slate-900/[0.06]" />
        </div>
      ) : pengajuanId ? (
        <ActiveBimbingan
          key={pengajuanId}
          application={activeApplication}
          context={context}
        />
      ) : activeApplication !== undefined && (
        <BimbinganLockedState application={activeApplication} />
      )}
    </div>
  );
}

function ActiveBimbingan({ application, context }) {
  const pengajuanId = application.id;
  const supervisor = application.pembimbing?.dosen;
  const topikJudul = application.versi_topik?.judul_penelitian ?? '';
  const list = useBimbinganMahasiswaList(pengajuanId);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [detailId, setDetailId] = useState(null);

  function handleFormChange(type = 'bimbingan.updated') {
    const events = [{ type, resource_id: pengajuanId }];
    void queryClient.invalidateQueries({
      predicate: (query) => isRealtimeQuery(query.queryKey, events),
    }, { cancelRefetch: false });
  }

  async function handleManualRefresh() {
    const result = await context.refetch({ cancelRefetch: false });
    if (result.isSuccess && result.data?.bimbingan_aktif && result.data.id === pengajuanId) {
      await list.reload();
    }
  }

  function openRevision(item) {
    setDetailId(null);
    setForm({ mode: 'revision', item });
  }

  return (
    <>
      <BimbinganSupervisorCard application={application} pembimbing={application.pembimbing} />
      <BimbinganProgressCard progres={list.progres} loading={list.loading && !list.progres} />
      <BimbinganToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        statusFilter={list.statusFilter}
        onStatusFilterChange={list.setStatusFilter}
        jenisFilter={list.jenisFilter}
        onJenisFilterChange={list.setJenisFilter}
        onRefresh={handleManualRefresh}
        refreshing={context.isFetching || list.refreshing}
        onReset={list.resetFilters}
        hasActiveFilter={list.hasActiveFilter}
        onOpenCreate={() => setForm({ mode: 'create' })}
      />
      <BimbinganTable
        items={list.items}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        hasActiveFilter={list.hasActiveFilter}
        onResetFilter={list.resetFilters}
        pagination={list.pagination}
        onPageChange={list.setPage}
        onOpenDetail={(item) => setDetailId(item.id)}
        onEditDraft={(item) => setForm({ mode: 'edit_draft', item })}
        onRevise={openRevision}
      />
      {form && (
        <BimbinganFormModal
          isOpen
          onClose={() => setForm(null)}
          pengajuanId={pengajuanId}
          initialData={form.item}
          mode={form.mode}
          onSuccess={handleFormChange}
          supervisor={supervisor}
          topikJudul={topikJudul}
        />
      )}
      {detailId && (
        <BimbinganDetailModal
          key={detailId}
          isOpen
          onClose={() => setDetailId(null)}
          pengajuanId={pengajuanId}
          bimbinganId={detailId}
          supervisor={supervisor}
          topikJudul={topikJudul}
          onOpenRevision={openRevision}
        />
      )}
    </>
  );
}
