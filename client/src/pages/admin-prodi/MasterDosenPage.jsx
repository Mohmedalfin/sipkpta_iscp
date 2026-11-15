import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconArrowUpTray,
  IconCheckCircle,
  IconInformationCircle,
  IconLockClosed,
  IconTrash,
  IconUserPlus,
} from '../../components/common/Icons.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import DosenSummaryCards from '../../components/admin-prodi/master-dosen/DosenSummaryCards.jsx';
import DosenToolbar from '../../components/admin-prodi/master-dosen/DosenToolbar.jsx';
import DosenTable from '../../components/admin-prodi/master-dosen/DosenTable.jsx';
import AdminPagination from '../../components/admin-prodi/shared/AdminPagination.jsx';
import DosenFormModal from '../../components/admin-prodi/master-dosen/DosenFormModal.jsx';
import DosenDetailModal from '../../components/admin-prodi/master-dosen/DosenDetailModal.jsx';
import DosenImportModal from '../../components/admin-prodi/master-dosen/DosenImportModal.jsx';
import {
  changeDosenStatus,
  deleteDosen,
  dosenErrorMessage,
  fetchDosenList,
} from '../../services/masterDosen.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function MasterDosenPage() {
  const toast = useToast();

  // State Data & Loading
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [lecturers, setLecturers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 1,
  });

  // Filter & Search States
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);

  // Metrik Counts State
  const [counts, setCounts] = useState({
    total: 0,
    aktif: 0,
    nonaktif: 0,
    homebase: 0,
  });

  // Modal & Dialog States (Tahap 2)
  const [formModal, setFormModal] = useState({
    open: false,
    mode: 'create', // 'create' | 'edit'
    lecturer: null,
  });

  const [detailModal, setDetailModal] = useState({
    open: false,
    lecturer: null,
  });

  const [statusDialog, setStatusDialog] = useState({
    open: false,
    lecturer: null,
    targetStatus: 'AKTIF',
    loading: false,
  });

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    lecturer: null,
    loading: false,
  });

  const [importModalOpen, setImportModalOpen] = useState(false);

  // Anti-race condition sequence tracker
  const requestSeqRef = useRef(0);
  const requestControllerRef = useRef(null);

  // Debounced search handling
  const searchTimeoutRef = useRef(null);
  useEffect(() => {
    return () => clearTimeout(searchTimeoutRef.current);
  }, []);

  const handleSearchChange = (val) => {
    setSearchInput(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setActiveSearch(val.trim());
      setPage(1);
    }, 300);
  };

  const handleClearSearch = () => {
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = null;
    setSearchInput('');
    setActiveSearch('');
    setPage(1);
  };

  // Main list fetch
  const loadDosenList = useCallback(async () => {
    const currentSeq = ++requestSeqRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsFetching(true);

    try {
      const response = await fetchDosenList({
        page,
        limit: 20,
        search: activeSearch,
      }, { signal: controller.signal });

      if (currentSeq !== requestSeqRef.current) return;

      setLecturers(response.items || []);
      if (response.summary) setCounts(response.summary);
      setPagination(
        response.pagination || {
          page: 1,
          limit: 20,
          total_items: 0,
          total_pages: 1,
        }
      );
    } catch (err) {
      if (currentSeq !== requestSeqRef.current) return;
      if (err.code === 'ERR_CANCELED') return;
      const msg = dosenErrorMessage(err, 'Gagal memuat daftar data dosen.');
      toast.error(msg);
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setInitialLoading(false);
        setIsFetching(false);
      }
    }
  }, [page, activeSearch, toast]);

  useEffect(() => {
    loadDosenList();
    return () => { requestSeqRef.current += 1; requestControllerRef.current?.abort(); };
  }, [loadDosenList]);

  // ================= ACTION HANDLERS (Tahap 2) =================

  // Buka Modal Tambah Dosen Baru
  const handleOpenAddModal = () => {
    setFormModal({
      open: true,
      mode: 'create',
      lecturer: null,
    });
  };

  const handleCloseFormModal = useCallback(() => {
    setFormModal((prev) => ({ ...prev, open: false }));
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setDetailModal((prev) => ({ ...prev, open: false }));
  }, []);

  // Buka Modal Detail Dosen
  const handleViewLecturer = (lecturer) => {
    setDetailModal({
      open: true,
      lecturer,
    });
  };

  // Buka Modal Edit Profil Dosen
  const handleEditLecturer = (lecturer) => {
    setFormModal({
      open: true,
      mode: 'edit',
      lecturer,
    });
  };

  // Buka Dialog Konfirmasi Ubah Status Akun
  const handleToggleStatus = (lecturer) => {
    const targetStatus = lecturer.status_akun === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
    setStatusDialog({
      open: true,
      lecturer,
      targetStatus,
      loading: false,
    });
  };

  // Eksekusi Konfirmasi Ubah Status Akun
  const handleConfirmStatusChange = async () => {
    if (!statusDialog.lecturer || statusDialog.loading) return;

    setStatusDialog((prev) => ({ ...prev, loading: true }));
    try {
      await changeDosenStatus(statusDialog.lecturer.id, statusDialog.targetStatus);
      toast.success(
        `Status akun dosen ${statusDialog.lecturer.nama_lengkap} berhasil diubah menjadi ${statusDialog.targetStatus}.`
      );
      setStatusDialog({
        open: false,
        lecturer: null,
        targetStatus: 'AKTIF',
        loading: false,
      });
      loadDosenList();
    } catch (err) {
      const msg = dosenErrorMessage(err, 'Gagal mengubah status akun dosen.');
      toast.error(msg);
      setStatusDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Buka Dialog Konfirmasi Hapus Dosen
  const handleDeleteLecturer = (lecturer) => {
    setDeleteDialog({
      open: true,
      lecturer,
      loading: false,
    });
  };

  // Eksekusi Konfirmasi Hapus Dosen
  const handleConfirmDelete = async () => {
    if (!deleteDialog.lecturer || deleteDialog.loading) return;

    setDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      await deleteDosen(deleteDialog.lecturer.id);
      toast.success(
        `Data dosen ${deleteDialog.lecturer.nama_lengkap} (${deleteDialog.lecturer.kode_dosen}) berhasil dihapus.`
      );
      setDeleteDialog({
        open: false,
        lecturer: null,
        loading: false,
      });

      // Jika item di halaman ini tersisa 1 dan bukan halaman 1, mundurkan ke halaman sebelumnya
      if (lecturers.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        loadDosenList();
      }
    } catch (err) {
      const errorCode = err?.response?.data?.error?.code;
      if (errorCode === 'MASTER_HAS_REFERENCES') {
        toast.warning(
          `Dosen ${deleteDialog.lecturer.nama_lengkap} tidak dapat dihapus karena telah tercatat dalam riwayat pengajuan, bimbingan, atau penugasan reviewer di sistem SIPKITA. Anda disarankan untuk mengubah status akun menjadi NONAKTIF.`
        );
      } else {
        const msg = dosenErrorMessage(err, 'Gagal menghapus data dosen.');
        toast.error(msg);
      }
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Callback sukses setelah submit form create/edit
  const handleFormSuccess = () => {
    loadDosenList();
  };

  // Buka Modal Impor CSV (Tahap 3)
  const handleOpenImportModal = () => {
    setImportModalOpen(true);
  };

  const handleCloseImportModal = useCallback(() => {
    setImportModalOpen(false);
  }, []);

  const handleImportSuccess = () => {
    loadDosenList();
  };

  const isSearchActive = searchInput !== activeSearch || (isFetching && Boolean(activeSearch));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      {/* 1. Header Halaman & Action Bar (Sesuai Referensi-4) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900/[0.06] pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Portal Administrasi
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Data Dosen
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-secondary">
            Kelola basis data dosen, akun pengguna, jabatan fungsional, dan status keaktifan akademik.
          </p>
        </div>

        {/* Action Buttons Kanan Atas */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Tombol Impor CSV (Tahap 3) */}
          <button
            type="button"
            onClick={handleOpenImportModal}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            title="Impor banyak data dosen via berkas CSV"
          >
            <IconArrowUpTray className="size-3.5 text-slate-500" />
            <span>Import CSV</span>
          </button>

          {/* Tombol Tambah Dosen (Tahap 2) */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Tambah data dosen baru secara manual"
          >
            <IconUserPlus className="size-3.5 text-white" />
            <span>Tambah Dosen</span>
          </button>
        </div>
      </div>

      {/* 2. Banner Notifikasi / Petunjuk Administrasi */}
      <div className="rounded-[16px] border border-slate-900/[0.08] bg-white/65 p-3.5 sm:p-4 flex items-start gap-3 shadow-none">
        <IconInformationCircle className="size-4.5 text-slate-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink leading-snug">
            Pengelolaan Data Induk Tenaga Pengajar & Pembimbing
          </p>
          <p className="text-xs text-secondary/90 leading-relaxed mt-0.5">
            Setiap dosen yang didaftarkan otomatis dibuatkan akun login dengan <em>login_id</em> berupa Kode Dosen dan kata sandi awal berbasis tanggal lahir (<code className="font-mono text-slate-700">DDMMYYYY</code>). Data dosen ini menjadi rujukan utama penugasan Reviewer Proposal dan penetapan Dosen Pembimbing KP/ISCP/TA.
          </p>
        </div>
      </div>

      {/* 3. Kartu Ringkasan Metrik (Summary Cards) */}
      <DosenSummaryCards counts={counts} />

      {/* 4. Toolbar Pencarian */}
      <DosenToolbar
        searchInput={searchInput}
        isSearchActive={isSearchActive}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        onRefresh={() => {
          loadDosenList();
        }}
        isFetching={isFetching}
        totalItems={pagination.total_items}
      />

      {/* 5. Tabel Data Dosen */}
      <DosenTable
        lecturers={lecturers}
        loading={initialLoading || isFetching}
        onView={handleViewLecturer}
        onEdit={handleEditLecturer}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteLecturer}
        footer={pagination.total_items > 0 && <AdminPagination
          pagination={pagination}
          onPageChange={setPage}
          loading={isFetching}
          unit="dosen"
        />}
      />

      {/* ================= MODAL & DIALOG (Tahap 2) ================= */}

      {/* Modal Formulir Tambah / Edit Dosen */}
      <DosenFormModal
        open={formModal.open}
        mode={formModal.mode}
        initialData={formModal.lecturer}
        onClose={handleCloseFormModal}
        onSuccess={handleFormSuccess}
      />

      {/* Modal Rincian Profil Dosen */}
      <DosenDetailModal
        open={detailModal.open}
        lecturer={detailModal.lecturer}
        onClose={handleCloseDetailModal}
        onEdit={handleEditLecturer}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteLecturer}
      />

      {/* Modal Wizard Impor Massal CSV Dosen (Tahap 3) */}
      <DosenImportModal
        open={importModalOpen}
        onClose={handleCloseImportModal}
        onSuccess={handleImportSuccess}
      />

      {/* Dialog Konfirmasi Ubah Status Akun Dosen */}
      <ConfirmDialog
        open={statusDialog.open}
        onClose={() => {
          if (!statusDialog.loading) {
            setStatusDialog((prev) => ({ ...prev, open: false }));
          }
        }}
        onConfirm={handleConfirmStatusChange}
        loading={statusDialog.loading}
        variant={statusDialog.targetStatus === 'NONAKTIF' ? 'warning' : 'primary'}
        badge={
          statusDialog.targetStatus === 'NONAKTIF'
            ? 'Konfirmasi • Penonaktifan Akun'
            : 'Konfirmasi • Pengaktifan Akun'
        }
        title={
          statusDialog.targetStatus === 'NONAKTIF'
            ? 'Nonaktifkan Akun Dosen?'
            : 'Aktifkan Akun Dosen?'
        }
        description={
          statusDialog.lecturer ? (
            statusDialog.targetStatus === 'NONAKTIF' ? (
              <span>
                Apakah Anda yakin ingin menonaktifkan akun{' '}
                <strong>{statusDialog.lecturer.nama_lengkap}</strong> (Kode:{' '}
                <span className="font-mono">{statusDialog.lecturer.kode_dosen}</span>)? Sesi login dosen
                akan dicabut dan dosen tidak dapat masuk ke sistem sampai diaktifkan kembali.
              </span>
            ) : (
              <span>
                Aktifkan kembali akun dosen{' '}
                <strong>{statusDialog.lecturer.nama_lengkap}</strong> (Kode:{' '}
                <span className="font-mono">{statusDialog.lecturer.kode_dosen}</span>)? Dosen akan dapat
                kembali login ke portal SIPKITA.
              </span>
            )
          ) : (
            'Apakah Anda yakin ingin mengubah status akun dosen ini?'
          )
        }
        confirmLabel={
          statusDialog.targetStatus === 'NONAKTIF' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'
        }
        cancelLabel="Batal"
        confirmIcon={
          statusDialog.targetStatus === 'NONAKTIF' ? (
            <IconLockClosed className="size-4 shrink-0" />
          ) : (
            <IconCheckCircle className="size-4 shrink-0" />
          )
        }
      />

      {/* Dialog Konfirmasi Hapus Dosen */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => {
          if (!deleteDialog.loading) {
            setDeleteDialog((prev) => ({ ...prev, open: false }));
          }
        }}
        onConfirm={handleConfirmDelete}
        loading={deleteDialog.loading}
        variant="danger"
        badge="Tindakan Permanen • Hapus Data"
        title="Hapus Data Dosen?"
        description={
          deleteDialog.lecturer ? (
            <span>
              Apakah Anda yakin ingin menghapus data dosen{' '}
              <strong>{deleteDialog.lecturer.nama_lengkap}</strong> (Kode:{' '}
              <span className="font-mono">{deleteDialog.lecturer.kode_dosen}</span>) secara permanen?
              Tindakan ini tidak dapat dibatalkan jika dosen belum memiliki riwayat bimbingan atau penugasan reviewer.
            </span>
          ) : (
            'Apakah Anda yakin ingin menghapus dosen ini?'
          )
        }
        confirmLabel="Hapus Dosen"
        cancelLabel="Batal"
        confirmIcon={<IconTrash className="size-4 shrink-0" />}
      />
    </div>
  );
}
