import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconArrowRight,
  IconClipboardCheck,
  IconExclamationCircle,
  IconInformationCircle,
} from '../../components/common/Icons.jsx';
import QueueSummaryCards from '../../components/admin-prodi/verifikasi-data-diri/QueueSummaryCards.jsx';
import ReviewWorkspaceModal from '../../components/admin-prodi/verifikasi-data-diri/ReviewWorkspaceModal.jsx';
import StatusBadge from '../../components/admin-prodi/shared/StatusBadge.jsx';
import VerificationToolbar from '../../components/admin-prodi/verifikasi-data-diri/VerificationToolbar.jsx';
import AdminPagination from '../../components/admin-prodi/shared/AdminPagination.jsx';
import {
  adminDataDiriErrorMessage,
  fetchAdminDataDiriList,
} from '../../services/adminDataDiri.js';
import { useToast } from '../../context/ToastContext.jsx';

function formatDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Skeleton placeholder rows for initial load to prevent layout shifts.
 */
function TableSkeletonRows({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-900/[0.04]">
          <td className="py-4 pl-6 pr-3">
            <div className="space-y-1.5 max-w-[200px]">
              <div className="h-3.5 bg-slate-200/70 rounded w-4/5" />
              <div className="h-2.5 bg-slate-200/50 rounded w-1/2" />
            </div>
          </td>
          <td className="py-4 px-3">
            <div className="space-y-1.5 max-w-[130px]">
              <div className="h-2.5 bg-slate-200/60 rounded w-full" />
              <div className="h-1.5 bg-slate-200/40 rounded-full w-full" />
            </div>
          </td>
          <td className="py-4 px-3">
            <div className="h-6 w-28 bg-slate-200/60 rounded-full" />
          </td>
          <td className="py-4 px-3">
            <div className="h-3 w-20 bg-slate-200/50 rounded" />
          </td>
          <td className="py-4 pl-3 pr-8 text-right">
            <div className="h-7 w-28 bg-slate-200/60 rounded-xl inline-block" />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function VerifikasiDataDiriPage() {
  const toast = useToast();

  // Differentiate initial mount loading from in-place background fetching
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total_items: 0,
    total_pages: 1,
  });

  // Filter States
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState(''); // '' | 'BELUM_DIVERIFIKASI' | 'PERLU_PERBAIKAN' | 'BELUM_LENGKAP' | 'TERVERIFIKASI'
  const [page, setPage] = useState(1);

  // Counter summary metrics state
  const [counts, setCounts] = useState({
    belumDiverifikasi: 0,
    perluPerbaikan: 0,
    belumLengkap: 0,
    terverifikasi: 0,
  });

  // Anti-race condition request sequence tracker
  const requestSeqRef = useRef(0);
  const requestControllerRef = useRef(null);

  // Review Workspace Modal State
  const [reviewModal, setReviewModal] = useState({
    open: false,
    studentId: null,
    queueIndex: 0,
  });

  // Debounce search input
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (val) => {
    setSearchInput(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setActiveSearch(val.trim());
      setPage(1);
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setPage(1);
  };

  // Main list fetch with race-condition prevention & smooth transitions
  const loadStudentList = useCallback(async () => {
    const currentSeq = ++requestSeqRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsFetching(true);
    setError('');

    try {
      const response = await fetchAdminDataDiriList({
        page,
        limit: 15,
        search: activeSearch,
        status: activeStatus,
        signal: controller.signal,
      });

      // Ignore response if a newer search/filter request was started
      if (currentSeq !== requestSeqRef.current) return;

      setStudents(response.data || []);
      if (response.meta?.summary) setCounts(response.meta.summary);
      setPagination(response.meta?.pagination || { page: 1, limit: 15, total_items: 0, total_pages: 1 });
    } catch (err) {
      if (currentSeq !== requestSeqRef.current) return;
      if (err.code === 'ERR_CANCELED') return;
      const msg = adminDataDiriErrorMessage(err, 'Gagal memuat daftar verifikasi data diri mahasiswa.');
      setError(msg);
      toast.error(msg);
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setInitialLoading(false);
        setIsFetching(false);
      }
    }
  }, [page, activeSearch, activeStatus, toast]);

  useEffect(() => {
    loadStudentList();
    return () => { requestSeqRef.current += 1; requestControllerRef.current?.abort(); };
  }, [loadStudentList]);

  // Handler: Select quick filter from cards or tabs
  const handleSelectStatusFilter = (statusKey) => {
    if (activeStatus === statusKey) return;
    setActiveStatus(statusKey);
    setPage(1);
  };

  // Open Workspace Modal
  const handleOpenReview = (studentId, index) => {
    setReviewModal({
      open: true,
      studentId,
      queueIndex: index,
    });
  };

  // Prev / Next queue handlers
  const handlePrevStudent = () => {
    if (reviewModal.queueIndex > 0) {
      const nextIndex = reviewModal.queueIndex - 1;
      setReviewModal({
        open: true,
        studentId: students[nextIndex].id,
        queueIndex: nextIndex,
      });
    }
  };

  const handleNextStudent = () => {
    if (reviewModal.queueIndex < students.length - 1) {
      const nextIndex = reviewModal.queueIndex + 1;
      setReviewModal({
        open: true,
        studentId: students[nextIndex].id,
        queueIndex: nextIndex,
      });
    }
  };

  // After approval or revision in modal, silently reload table and counts
  const handleStatusUpdated = () => {
    loadStudentList();
  };

  // Stable total count of all students across statuses
  const totalAllStudents =
    counts.belumDiverifikasi +
    counts.perluPerbaikan +
    counts.belumLengkap +
    counts.terverifikasi;

  // Active search indicator
  const isSearchActive = searchInput !== activeSearch || (isFetching && Boolean(activeSearch));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3">
      {/* 1. Header Halaman */}
      <div className="border-b border-slate-900/[0.06] pb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Portal Administrasi
        </span>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Verifikasi Data Diri Mahasiswa
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-secondary">
          Pusat validasi keabsahan berkas 6 dokumen identitas resmi mahasiswa sebelum memulai siklus KP, ISCP, atau TA.
        </p>
      </div>

      {/* 2. Notice Banner */}
      <div className="rounded-[16px] border border-slate-900/[0.08] bg-white/65 p-4 flex items-start gap-3 shadow-none">
        <IconInformationCircle className="size-4.5 text-slate-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink leading-snug">
            Alur Pemeriksaan Berkas Akademik
          </p>
          <p className="text-xs text-secondary/90 leading-relaxed mt-0.5">
            Mahasiswa yang telah mengunggah lengkap 6 berkas masuk ke dalam status <strong>Menunggu Verifikasi</strong>. Gunakan tombol <strong>Periksa Berkas</strong> untuk membuka ruang telaah PDF, meminta perbaikan jika ada berkas yang buram/salah, atau melakukan verifikasi sekaligus.
          </p>
        </div>
      </div>

      {/* 3. Kartu Ringkasan Antrean (Queue Summary Cards) */}
      <QueueSummaryCards
        activeFilter={activeStatus}
        onSelectFilter={handleSelectStatusFilter}
        counts={counts}
      />

      {/* 4. Toolbar: Search Bar, Filter Tabs & Actions */}
      <VerificationToolbar
        searchInput={searchInput}
        isSearchActive={isSearchActive}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        onRefresh={() => {
          loadStudentList();
        }}
        isFetching={isFetching}
        activeStatus={activeStatus}
        onSelectStatusFilter={handleSelectStatusFilter}
        totalAllStudents={totalAllStudents}
        paginationTotalItems={pagination.total_items}
        counts={counts}
      />

      {/* 5. Main Data Table */}
      <div className="relative rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm overflow-hidden shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs table-fixed min-w-[840px]">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
              <col className="w-[15%]" />
              <col className="w-[19%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-900/[0.08] bg-slate-50/80 text-[11px] font-mono font-bold uppercase tracking-wider text-muted">
                <th scope="col" className="py-3.5 pl-6 pr-3">Mahasiswa</th>
                <th scope="col" className="py-3.5 px-3">Kelengkapan Berkas</th>
                <th scope="col" className="py-3.5 px-3">Status Verifikasi</th>
                <th scope="col" className="py-3.5 px-3">Pemeriksaan Terakhir</th>
                <th scope="col" className="py-3.5 pl-3 pr-8 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/[0.06]">
              {initialLoading ? (
                <TableSkeletonRows count={5} />
              ) : error ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <IconExclamationCircle className="size-10 text-danger mx-auto mb-2" />
                    <p className="text-sm font-bold text-ink">Gagal Menampilkan Data</p>
                    <p className="text-xs text-secondary mt-1">{error}</p>
                    <button
                      type="button"
                      onClick={loadStudentList}
                      className="mt-4 rounded-xl bg-brand text-white px-4 py-2 text-xs font-bold hover:bg-brand-hover transition-colors cursor-pointer"
                    >
                      Coba Lagi
                    </button>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="size-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <IconClipboardCheck className="size-6" />
                    </div>
                    <p className="text-sm font-bold text-ink">Tidak Ada Mahasiswa Ditemukan</p>
                    <p className="text-xs text-secondary mt-1 max-w-sm mx-auto">
                      {activeSearch || activeStatus
                        ? 'Tidak ada data mahasiswa yang cocok dengan kriteria pencarian atau filter yang dipilih.'
                        : 'Saat ini belum ada data mahasiswa yang terdaftar dalam program studi.'}
                    </p>
                    {(activeSearch || activeStatus) && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClearSearch();
                          setActiveStatus('');
                        }}
                        className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-secondary hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Reset Semua Filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                students.map((student, index) => {
                  const isComplete = student.lengkap;

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      {/* Mahasiswa Info */}
                      <td className="py-4 pl-6 pr-3">
                        <div className="min-w-0">
                          <p className="font-bold text-ink text-xs truncate group-hover:text-brand transition-colors">
                            {student.nama_lengkap}
                          </p>
                          <p className="text-[11px] font-mono text-muted mt-0.5">
                            {student.nim}
                          </p>
                        </div>
                      </td>

                      {/* Kelengkapan Berkas (0-6) */}
                      <td className="py-4 px-3">
                        <div className="space-y-1 max-w-[130px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-secondary">
                              {student.jumlah_terunggah} dari {student.jumlah_wajib} Berkas
                            </span>
                            <span
                              className={`font-bold font-mono text-[10px] ${
                                isComplete ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              {isComplete ? '100%' : `${Math.round((student.jumlah_terunggah / student.jumlah_wajib) * 100)}%`}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-900/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isComplete ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${(student.jumlah_terunggah / student.jumlah_wajib) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status Verifikasi Badge */}
                      <td className="py-4 px-3">
                        <StatusBadge status={student.status_verifikasi} />
                      </td>

                      {/* Tanggal Terakhir */}
                      <td className="py-4 px-3 text-secondary">
                        <span className="text-[11px]">
                          {formatDate(student.diverifikasi_at || student.diperiksa_at)}
                        </span>
                      </td>

                      {/* Action Button: Periksa Berkas */}
                      <td className="py-4 pl-3 pr-8 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenReview(student.id, index)}
                          className="group/btn whitespace-nowrap inline-flex items-center gap-1.5 rounded-xl border border-blue-200/80 bg-blue-50/80 hover:bg-blue-600 hover:border-blue-600 text-blue-700 hover:text-white px-3.5 py-1.5 text-xs font-semibold shadow-none transition-all duration-150 cursor-pointer"
                        >
                          <span>Periksa Berkas</span>
                          <IconArrowRight className="size-3 text-blue-500 group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-all duration-150" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Pagination Footer Bar */}
        {!initialLoading && !error && pagination.total_items > 0 && (
          <div className="border-t border-line px-6">
            <AdminPagination pagination={pagination} onPageChange={setPage}
              loading={isFetching} unit="mahasiswa" />
          </div>
        )}
      </div>

      {/* 7. Review Workspace Modal (Option A) */}
      <ReviewWorkspaceModal
        open={reviewModal.open}
        studentId={reviewModal.studentId}
        onClose={() => setReviewModal({ open: false, studentId: null, queueIndex: 0 })}
        onStatusUpdated={handleStatusUpdated}
        queueIndex={reviewModal.queueIndex}
        queueTotal={students.length}
        onPrevStudent={handlePrevStudent}
        onNextStudent={handleNextStudent}
      />
    </div>
  );
}
