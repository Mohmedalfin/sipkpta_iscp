import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowUpTray,
  IconCheckCircle,
  IconInformationCircle,
  IconLockClosed,
  IconTrash,
  IconUserPlus,
} from '../../components/common/Icons.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import ErrorBanner from '../../components/common/ErrorBanner.jsx';
import MahasiswaSummaryCards from '../../components/admin-prodi/master-mahasiswa/MahasiswaSummaryCards.jsx';
import MahasiswaToolbar from '../../components/admin-prodi/master-mahasiswa/MahasiswaToolbar.jsx';
import MahasiswaTable from '../../components/admin-prodi/master-mahasiswa/MahasiswaTable.jsx';
import AdminPagination from '../../components/admin-prodi/shared/AdminPagination.jsx';
import MahasiswaFormModal from '../../components/admin-prodi/master-mahasiswa/MahasiswaFormModal.jsx';
import MahasiswaDetailModal from '../../components/admin-prodi/master-mahasiswa/MahasiswaDetailModal.jsx';
import MahasiswaImportModal from '../../components/admin-prodi/master-mahasiswa/MahasiswaImportModal.jsx';
import {
  changeMahasiswaStatus,
  deleteMahasiswa,
  fetchMahasiswaList,
  mahasiswaErrorMessage,
} from '../../services/masterMahasiswa.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function MasterMahasiswaPage() {
  const toast = useToast();

  // State Data & Loading
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [loadedListKey, setLoadedListKey] = useState(null);
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 1,
  });

  // Filter & Search States
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedAngkatan, setSelectedAngkatan] = useState('');
  const [page, setPage] = useState(1);

  // Metrik Counts State
  const [counts, setCounts] = useState({
    total: 0,
    aktif: 0,
    nonaktif: 0,
  });

  // Modal & Dialog States (Tahap 2)
  const [formModal, setFormModal] = useState({
    open: false,
    mode: 'create', // 'create' | 'edit'
    student: null,
  });

  const [detailModal, setDetailModal] = useState({
    open: false,
    student: null,
  });

  const [statusDialog, setStatusDialog] = useState({
    open: false,
    student: null,
    targetStatus: 'AKTIF',
    loading: false,
  });

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    student: null,
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

  const handleSelectAngkatan = (val) => {
    setSelectedAngkatan(val);
    setPage(1);
  };

  const listKey = JSON.stringify([page, activeSearch, selectedAngkatan]);

  // Main list fetch
  const loadStudentList = useCallback(async () => {
    const currentSeq = ++requestSeqRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsFetching(true);

    try {
      const response = await fetchMahasiswaList({
        page,
        limit: 20,
        search: activeSearch,
        tahun_angkatan: selectedAngkatan || null,
      }, { signal: controller.signal });

      if (currentSeq !== requestSeqRef.current) return;

      setError('');
      setLoadedListKey(listKey);
      setStudents(response.items || []);
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
      const msg = mahasiswaErrorMessage(err, 'Gagal memuat daftar data mahasiswa.');
      setError(msg);
      toast.error(msg);
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setInitialLoading(false);
        setIsFetching(false);
      }
    }
  }, [page, activeSearch, selectedAngkatan, listKey, toast]);

  useEffect(() => {
    loadStudentList();
    return () => { requestSeqRef.current += 1; requestControllerRef.current?.abort(); };
  }, [loadStudentList]);

  // Generate dynamic list of available angkatan years
  const availableAngkatan = useMemo(() => {
    const yearsSet = new Set([2026, 2025, 2024, 2023, 2022, 2021, 2020]);
    students.forEach((s) => {
      if (s.tahun_angkatan && Number.isInteger(s.tahun_angkatan)) {
        yearsSet.add(s.tahun_angkatan);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [students]);

  // ================= ACTION HANDLERS =================

  // Buka Modal Tambah Mahasiswa Baru
  const handleOpenAddModal = () => {
    setFormModal({
      open: true,
      mode: 'create',
      student: null,
    });
  };

  const handleCloseFormModal = useCallback(() => {
    setFormModal((prev) => ({ ...prev, open: false }));
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setDetailModal((prev) => ({ ...prev, open: false }));
  }, []);

  // Buka Modal Impor CSV (Tahap 3)
  const handleOpenImportModal = () => {
    setImportModalOpen(true);
  };

  const handleCloseImportModal = useCallback(() => {
    setImportModalOpen(false);
  }, []);

  const handleImportSuccess = () => {
    loadStudentList();
  };

  // Buka Modal Detail Mahasiswa
  const handleViewStudent = (student) => {
    setDetailModal({
      open: true,
      student,
    });
  };

  // Buka Modal Edit Profil Mahasiswa
  const handleEditStudent = (student) => {
    setFormModal({
      open: true,
      mode: 'edit',
      student,
    });
  };

  // Buka Dialog Konfirmasi Ubah Status Akun
  const handleToggleStatus = (student) => {
    const targetStatus = student.status_akun === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
    setStatusDialog({
      open: true,
      student,
      targetStatus,
      loading: false,
    });
  };

  // Eksekusi Konfirmasi Ubah Status Akun
  const handleConfirmStatusChange = async () => {
    if (!statusDialog.student || statusDialog.loading) return;

    setStatusDialog((prev) => ({ ...prev, loading: true }));
    try {
      await changeMahasiswaStatus(statusDialog.student.id, statusDialog.targetStatus);
      toast.success(
        `Status akun mahasiswa ${statusDialog.student.nama_lengkap} berhasil diubah menjadi ${statusDialog.targetStatus}.`
      );
      setStatusDialog({
        open: false,
        student: null,
        targetStatus: 'AKTIF',
        loading: false,
      });
      loadStudentList();
    } catch (err) {
      const msg = mahasiswaErrorMessage(err, 'Gagal mengubah status akun mahasiswa.');
      toast.error(msg);
      setStatusDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Buka Dialog Konfirmasi Hapus Mahasiswa
  const handleDeleteStudent = (student) => {
    setDeleteDialog({
      open: true,
      student,
      loading: false,
    });
  };

  // Eksekusi Konfirmasi Hapus Mahasiswa
  const handleConfirmDelete = async () => {
    if (!deleteDialog.student || deleteDialog.loading) return;

    setDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      await deleteMahasiswa(deleteDialog.student.id);
      toast.success(
        `Data mahasiswa ${deleteDialog.student.nama_lengkap} (${deleteDialog.student.nim}) berhasil dihapus.`
      );
      setDeleteDialog({
        open: false,
        student: null,
        loading: false,
      });

      // Jika item di halaman ini tersisa 1 dan bukan halaman 1, mundurkan ke halaman sebelumnya
      if (students.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        loadStudentList();
      }
    } catch (err) {
      const errorCode = err?.response?.data?.error?.code;
      if (errorCode === 'MASTER_HAS_REFERENCES') {
        toast.warning(
          'Mahasiswa tidak dapat dihapus karena sudah memiliki riwayat akademik atau dokumen aktif. Anda disarankan untuk mengubah status akun menjadi NONAKTIF.'
        );
      } else {
        const msg = mahasiswaErrorMessage(err, 'Gagal menghapus data mahasiswa.');
        toast.error(msg);
      }
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Callback sukses setelah submit form create/edit
  const handleFormSuccess = () => {
    loadStudentList();
  };

  const isSearchActive = searchInput !== activeSearch || (isFetching && Boolean(activeSearch));

  return (
    <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl space-y-6">
      {/* 1. Header Halaman & Action Bar (Sesuai Referensi-4) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900/[0.06] pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Portal Administrasi
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Data Mahasiswa
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-secondary">
            Kelola basis data identitas mahasiswa, akun pengguna, dan status keaktifan akademik.
          </p>
        </div>

        {/* Action Buttons Kanan Atas */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Tombol Impor CSV (Tahap 3) */}
          <button
            type="button"
            onClick={handleOpenImportModal}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            title="Impor banyak data mahasiswa via berkas CSV"
          >
            <IconArrowUpTray className="size-3.5 text-slate-500" />
            <span>Import CSV</span>
          </button>

          {/* Tombol Tambah Mahasiswa (Primary Blue) */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Tambah data mahasiswa baru secara manual"
          >
            <IconUserPlus className="size-3.5 text-white" />
            <span>Tambah Mahasiswa</span>
          </button>
        </div>
      </div>

      {/* 2. Banner Notifikasi / Petunjuk Administrasi */}
      <div className="rounded-[16px] border border-slate-900/[0.08] bg-white/65 p-3.5 sm:p-4 flex items-start gap-3 shadow-none">
        <IconInformationCircle className="size-4.5 text-slate-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink leading-snug">
            Pengelolaan Data Induk Mahasiswa
          </p>
          <p className="text-xs text-secondary/90 leading-relaxed mt-0.5">
            Setiap mahasiswa yang didaftarkan otomatis dibuatkan akun login dengan <em>login_id</em> berupa NIM dan kata sandi awal berbasis tanggal lahir (<code className="font-mono text-slate-700">DDMMYYYY</code>). Gunakan filter angkatan untuk meninjau mahasiswa berdasarkan tahun masuk akademik.
          </p>
        </div>
      </div>

      {/* 3. Kartu Ringkasan Metrik (Summary Cards) */}
      <MahasiswaSummaryCards
        counts={counts}
        selectedAngkatan={selectedAngkatan}
      />

      {/* 4. Toolbar Pencarian & Filter Angkatan */}
      <MahasiswaToolbar
        searchInput={searchInput}
        isSearchActive={isSearchActive}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        selectedAngkatan={selectedAngkatan}
        onSelectAngkatan={handleSelectAngkatan}
        availableAngkatan={availableAngkatan}
        onRefresh={loadStudentList}
        isFetching={isFetching}
        totalItems={pagination.total_items}
      />

      {/* Error Banner jika fetch gagal */}
      {error && (
        <ErrorBanner
          title="Gagal Memuat Data Mahasiswa"
          message={error}
          onRetry={loadStudentList}
        />
      )}

      {/* 5. Tabel Data Mahasiswa */}
      <MahasiswaTable
        refreshing={isFetching}
        students={students}
        loading={initialLoading || (isFetching && loadedListKey !== listKey)}
        error={error}
        onRetry={loadStudentList}
        hasActiveFilter={Boolean(activeSearch || selectedAngkatan)}
        onResetFilter={() => {
          handleClearSearch();
          setSelectedAngkatan('');
        }}
        onView={handleViewStudent}
        onEdit={handleEditStudent}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteStudent}
        footer={pagination.total_items > 0 && <AdminPagination
          pagination={pagination}
          onPageChange={setPage}
          loading={isFetching}
          unit="mahasiswa"
        />}
      />

      {/* ================= MODAL & DIALOG TAHAP 2 ================= */}

      {/* Modal Formulir Mahasiswa (Tambah / Edit) */}
      <MahasiswaFormModal
        open={formModal.open}
        mode={formModal.mode}
        initialData={formModal.student}
        onClose={handleCloseFormModal}
        onSuccess={handleFormSuccess}
      />

      {/* Modal Rincian Detail Profil Mahasiswa */}
      <MahasiswaDetailModal
        open={detailModal.open}
        student={detailModal.student}
        onClose={handleCloseDetailModal}
        onEdit={(student) => {
          setDetailModal((prev) => ({ ...prev, open: false }));
          handleEditStudent(student);
        }}
        onToggleStatus={(student) => {
          setDetailModal((prev) => ({ ...prev, open: false }));
          handleToggleStatus(student);
        }}
      />

      {/* Modal Wizard Impor Massal CSV (Tahap 3) */}
      <MahasiswaImportModal
        open={importModalOpen}
        onClose={handleCloseImportModal}
        onSuccess={handleImportSuccess}
      />

      {/* Dialog Konfirmasi Ubah Status Akun */}
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
            ? 'Nonaktifkan Akun Mahasiswa?'
            : 'Aktifkan Akun Mahasiswa?'
        }
        description={
          statusDialog.student ? (
            statusDialog.targetStatus === 'NONAKTIF' ? (
              <span>
                Apakah Anda yakin ingin menonaktifkan akun{' '}
                <strong>{statusDialog.student.nama_lengkap}</strong> (NIM:{' '}
                <span className="font-mono">{statusDialog.student.nim}</span>)? Sesi login mahasiswa
                akan dicabut dan mahasiswa tidak dapat masuk ke sistem sampai diaktifkan kembali.
              </span>
            ) : (
              <span>
                Aktifkan kembali akun mahasiswa{' '}
                <strong>{statusDialog.student.nama_lengkap}</strong> (NIM:{' '}
                <span className="font-mono">{statusDialog.student.nim}</span>)? Mahasiswa akan dapat
                kembali login ke portal SIPKITA.
              </span>
            )
          ) : (
            'Apakah Anda yakin ingin mengubah status akun mahasiswa ini?'
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

      {/* Dialog Konfirmasi Hapus Mahasiswa */}
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
        title="Hapus Data Mahasiswa?"
        description={
          deleteDialog.student ? (
            <span>
              Apakah Anda yakin ingin menghapus data mahasiswa{' '}
              <strong>{deleteDialog.student.nama_lengkap}</strong> (NIM:{' '}
              <span className="font-mono">{deleteDialog.student.nim}</span>) secara permanen?
              Tindakan ini tidak dapat dibatalkan jika mahasiswa belum memiliki riwayat proposal atau dokumen akademik.
            </span>
          ) : (
            'Apakah Anda yakin ingin menghapus mahasiswa ini?'
          )
        }
        confirmLabel="Hapus Mahasiswa"
        cancelLabel="Batal"
        confirmIcon={<IconTrash className="size-4 shrink-0" />}
      />
    </div>
  );
}
