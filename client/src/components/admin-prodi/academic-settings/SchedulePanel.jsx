import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import boxIcon from '../../../assets/NoBackground Box.svg';
import { useToast } from '../../../context/ToastContext.jsx';
import { useAcademicSettingsList } from '../../../hooks/useAcademicSettingsList.js';
import { useAcademicSettingsEditor } from '../../../hooks/useAcademicSettingsEditor.js';
import { useFocusTrap } from '../../../hooks/useFocusTrap.js';
import { getAvailability, settingsError } from '../../../services/academicSettings.js';
import StatusAction from './StatusAction.jsx';
import AcademicStatusBadge from './AcademicStatusBadge.jsx';
import SettingsDropdownFilter from './SettingsDropdownFilter.jsx';
import {
  Field,
  FormDialog,
  formatDateTimeWib,
  inputClass,
  ListState,
  Pager,
  secondaryButton,
  SectionHeader,
} from './SettingsUi.jsx';
import {
  IconAcademicCap,
  IconCalendar,
  IconCalendarClock,
  IconCheckCircle,
  IconClose,
  IconEdit,
  IconExclamationCircle,
  IconFunnel,
  IconInformationCircle,
  IconLockClosed,
  IconSpinner,
} from '../../common/Icons.jsx';

const processes = [
  ['PENGAJUAN_REGULER', 'Pengajuan Reguler'],
  ['PENGAJUAN_PERPANJANGAN', 'Pengajuan Perpanjangan'],
];

const initial = {
  periode_akademik_id: '',
  tahap_akademik_id: '',
  jenis_proses: 'PENGAJUAN_REGULER',
  tanggal_buka: '',
  tanggal_tutup: '',
  is_aktif: true,
  keterangan: '',
};

const dateTimeLocal = (value) => (value ? String(value).slice(0, 16) : '');

export default function SchedulePanel() {
  const toast = useToast();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    periode: '',
    tahap: '',
    jenis_proses: '',
    status: '',
  });

  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '')
  );

  const list = useAcademicSettingsList('schedules', query);
  const periods = useAcademicSettingsList('periods', { page: 1, limit: 100 });
  const stages = useAcademicSettingsList('stages');
  const form = useAcademicSettingsEditor('schedules', list.refresh, toast);

  // Availability Checker State
  const [showChecker, setShowChecker] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [check, setCheck] = useState({ tahap: 'KP', jenis_proses: 'PENGAJUAN_REGULER' });

  const filter = (name, value) =>
    setFilters((current) => ({ ...current, [name]: value, page: 1 }));

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
      periode: '',
      tahap: '',
      jenis_proses: '',
      status: '',
    });
  };

  const hasActiveFilters = Boolean(
    filters.periode || filters.tahap || filters.jenis_proses || filters.status
  );

  // Poll or fetch availability on stage/process change
  useEffect(() => {
    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    getAvailability(check.tahap, check.jenis_proses)
      .then((val) => {
        if (active) setAvailability(val);
      })
      .catch((err) => {
        if (active) setAvailabilityError(settingsError(err));
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [check.tahap, check.jenis_proses, list.data]);

  const edit = (row) =>
    form.openEdit(row.id, {
      periode_akademik_id: String(row.periode_akademik_id),
      tahap_akademik_id: String(row.tahap_akademik_id),
      jenis_proses: row.jenis_proses,
      tanggal_buka: dateTimeLocal(row.tanggal_buka),
      tanggal_tutup: dateTimeLocal(row.tanggal_tutup),
      original_buka: row.tanggal_buka,
      original_tutup: row.tanggal_tutup,
      is_aktif: row.is_aktif,
      keterangan: row.keterangan || '',
    });

  const prepare = (values) => ({
    periode_akademik_id: Number(values.periode_akademik_id),
    tahap_akademik_id: Number(values.tahap_akademik_id),
    jenis_proses: values.jenis_proses,
    tanggal_buka:
      values.original_buka && dateTimeLocal(values.original_buka) === values.tanggal_buka
        ? values.original_buka
        : values.tanggal_buka + ':00+07:00',
    tanggal_tutup:
      values.original_tutup && dateTimeLocal(values.original_tutup) === values.tanggal_tutup
        ? values.original_tutup
        : values.tanggal_tutup + ':00+07:00',
    is_aktif: values.is_aktif,
    keterangan: values.keterangan.trim() || null,
  });

  const handleSave = (event) => {
    event.preventDefault();
    const { tanggal_buka, tanggal_tutup } = form.editor.values;
    if (tanggal_buka && tanggal_tutup && tanggal_buka >= tanggal_tutup) {
      toast.error('Waktu buka harus lebih awal dari waktu tutup jadwal.');
      return;
    }
    form.save(event, prepare);
  };

  return (
    <div className="space-y-5">
      {/* ================= 1. SECTION HEADER ================= */}
      <SectionHeader
        title="Jadwal Proses Akademik"
        description="Kelola jadwal buka dan tutup pengajuan reguler serta perpanjangan per tahap."
        onAdd={() => form.openCreate(initial)}
        addLabel="Tambah Jadwal"
        onRefresh={list.refresh}
        refreshing={list.refreshing}
        badgeCount={list.pagination?.total_items ?? list.data.length}
        kicker="PENANGGALAN PROSES"
      />

      {/* ================= 2. TOOLBAR FILTER (Mengikuti MahasiswaToolbar) ================= */}
      <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative z-20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Sisi Kiri: Filter Dropdowns (Lebar stabil dan proporsional mencegah layout wrapping) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1 flex-wrap">
            {/* Filter Dropdown Periode */}
            <SettingsDropdownFilter
              value={filters.periode}
              onChange={(val) => filter('periode', val)}
              icon={IconCalendar}
              placeholder="Semua Periode"
              minWidth="w-full sm:w-44"
              options={[
                { value: '', label: 'Semua Periode' },
                ...periods.data.map((row) => ({
                  value: row.id,
                  label: `Semester ${row.semester} ${row.tahun_ajaran}`,
                })),
              ]}
            />

            {/* Filter Dropdown Tahap */}
            <SettingsDropdownFilter
              value={filters.tahap}
              onChange={(val) => filter('tahap', val)}
              icon={IconAcademicCap}
              placeholder="Semua Tahap"
              minWidth="w-full sm:w-36"
              options={[
                { value: '', label: 'Semua Tahap' },
                ...stages.data.map((row) => ({
                  value: row.id,
                  label: `${row.nama_tahap} (${row.kode_tahap})`,
                })),
              ]}
            />

            {/* Filter Dropdown Jenis Proses */}
            <SettingsDropdownFilter
              value={filters.jenis_proses}
              onChange={(val) => filter('jenis_proses', val)}
              icon={IconFunnel}
              placeholder="Semua Jenis Proses"
              minWidth="w-full sm:w-44"
              options={[
                { value: '', label: 'Semua Jenis Proses' },
                ...processes.map(([code, label]) => ({
                  value: code,
                  label: label,
                })),
              ]}
            />

            {/* Filter Dropdown Status */}
            <SettingsDropdownFilter
              value={filters.status}
              onChange={(val) => filter('status', val)}
              icon={IconCheckCircle}
              placeholder="Semua Status"
              minWidth="w-full sm:w-36"
              options={[
                { value: '', label: 'Semua Status' },
                { value: 'DIBUKA', label: 'Dibuka' },
                { value: 'BELUM_DIBUKA', label: 'Belum Dibuka' },
                { value: 'DITUTUP', label: 'Ditutup' },
                { value: 'NONAKTIF', label: 'Nonaktif' },
              ]}
            />
          </div>

          {/* Sisi Kanan: Reset Filter */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 min-h-[36px]">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50/70 transition-colors cursor-pointer"
                title="Reset semua filter jadwal"
              >
                <IconClose className="size-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Baris Informasi Hasil & Tombol Simulasi Live Minimalis */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900/[0.04] text-[11px] text-muted">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>Menampilkan hasil: </span>
            <strong className="text-ink font-semibold">
              {list.pagination?.total_items ?? list.data.length} jadwal
            </strong>
            {hasActiveFilters && (
              <span className="text-slate-500">
                (difilter)
              </span>
            )}
            {filters.periode && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-soft text-brand font-medium">
                Periode: {periods.data.find((p) => p.id === filters.periode)?.tahun_ajaran || 'Terpilih'}
              </span>
            )}
            {filters.tahap && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-soft text-brand font-medium">
                Tahap: {stages.data.find((s) => s.id === filters.tahap)?.kode_tahap || 'Terpilih'}
              </span>
            )}
            {filters.status && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-soft text-brand font-medium">
                Status: {filters.status}
              </span>
            )}
          </div>

          {/* Tombol Simulasi Waktu Nyata (Buka Modal tanpa menggeser layout) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowChecker(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-50 active:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-secondary hover:text-ink shadow-2xs transition-colors cursor-pointer"
              title="Uji ketersediaan formulir mahasiswa secara waktu nyata (live)"
            >
              <IconCalendarClock className="size-3.5 text-brand" />
              <span>Simulasi Ketersediaan Live</span>
              <span
                className={`size-2 rounded-full ${
                  availability?.is_open ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ================= 4. FEEDBACK STATES ================= */}
      <ListState
        loading={list.loading}
        error={list.error}
        empty={!list.data.length}
        emptyTitle="Tidak Ada Jadwal Proses"
        emptyMessage="Belum ada data jadwal proses yang sesuai dengan filter. Tambahkan jadwal baru untuk membuka pengajuan."
        onRetry={list.refresh}
      />

      {/* ================= 5. TABEL DAFTAR JADWAL PROSES ================= */}
      {!list.loading && !list.error && list.data.length > 0 && (
        <div className="overflow-hidden rounded-[20px] border border-slate-900/[0.08] bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/[0.06] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="py-3.5 pl-6 pr-3">Tahap & Jenis Proses</th>
                  <th className="py-3.5 px-3">Periode</th>
                  <th className="py-3.5 px-3">Jendela Waktu (WIB)</th>
                  <th className="py-3.5 px-3">Status Jadwal</th>
                  <th className="py-3.5 px-3">Keterangan</th>
                  <th className="py-3.5 pl-3 pr-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.06] text-xs">
                {list.data.map((row) => {
                  const processLabel =
                    processes.find(([code]) => code === row.jenis_proses)?.[1] ||
                    row.jenis_proses;

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/70 transition-colors duration-150 ${
                        row.is_open ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* 1. Tahap & Jenis Proses */}
                      <td className="py-3.5 pl-6 pr-3 align-middle">
                        <div className="font-semibold text-xs sm:text-sm text-ink">
                          {row.tahap_akademik?.nama_tahap || `Tahap #${row.tahap_akademik_id}`}
                        </div>
                        <div className="text-[11px] text-muted font-medium mt-0.5">
                          {processLabel}
                        </div>
                      </td>

                      {/* 2. Periode Akademik */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <div className="text-xs font-medium text-ink">
                          Semester {row.periode_akademik?.semester}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">
                          T.A. {row.periode_akademik?.tahun_ajaran}
                        </div>
                      </td>

                      {/* 3. Jendela Waktu */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <div className="text-xs text-ink font-medium">
                          {formatDateTimeWib(row.tanggal_buka)}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">
                          s.d. {formatDateTimeWib(row.tanggal_tutup)}
                        </div>
                      </td>

                      {/* 4. Status Jadwal */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <AcademicStatusBadge status={row.status_jadwal} />
                      </td>

                      {/* 5. Keterangan */}
                      <td className="py-3.5 px-3 align-middle text-secondary max-w-[180px]">
                        {row.keterangan ? (
                          <span className="text-[11px] text-muted truncate block" title={row.keterangan}>
                            {row.keterangan}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* 6. Aksi */}
                      <td className="py-3.5 pl-3 pr-6 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => edit(row)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-brand hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Ubah jadwal"
                          >
                            <IconEdit className="size-3.5 text-slate-500" />
                            <span>Ubah</span>
                          </button>
                          <StatusAction
                            resource="schedules"
                            row={row}
                            refresh={list.refresh}
                            toast={toast}
                            label="Jadwal"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line px-6">
            <Pager pagination={list.pagination}
              onPage={(page) => setFilters((current) => ({ ...current, page }))}
              unit="jadwal" />
          </div>
        </div>
      )}

      {/* ================= 7. FORM MODAL CREATE / EDIT ================= */}
      <FormDialog
        title={form.editor?.id ? 'Ubah Jadwal Proses' : 'Tambah Jadwal Proses'}
        subtitle={
          form.editor?.id
            ? 'Perbarui jendela waktu dan status jadwal proses akademik prodi.'
            : 'Atur tanggal dan jam buka/tutup pengajuan proses untuk mahasiswa.'
        }
        open={Boolean(form.editor)}
        onClose={form.close}
        onSubmit={handleSave}
        busy={form.busy}
        error={form.error}
        submitLabel={form.editor?.id ? 'Simpan Perubahan' : 'Daftarkan Jadwal'}
      >
        {form.editor && (
          <div className="space-y-4">
            {/* Callout Info Ketentuan Jendela Waktu Jadwal */}
            <div className="rounded-[14px] border border-blue-200/80 bg-blue-50/70 p-3.5 flex items-start gap-3 text-xs leading-relaxed text-blue-900">
              <IconInformationCircle className="size-4.5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-brand">Ketentuan Jendela Waktu Jadwal</p>
                <p className="text-slate-600 mt-0.5">
                  Sistem menggunakan acuan waktu nyata server (WIB) untuk membuka dan menutup akses formulir pengajuan mahasiswa secara otomatis. 
                </p>
              </div>
            </div>

            {/* Bagian 1: Konfigurasi Tahap & Periode Akademik */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  1. Konfigurasi Tahap & Periode Akademik
                </h3>
                <span className="text-[11px] text-muted font-normal">
                  Tanda bintang (<span className="text-rose-500 font-bold">*</span>) wajib diisi
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field
                  label="Periode Akademik"
                  name="periode_akademik_id"
                  value={form.editor.values.periode_akademik_id}
                  onChange={form.change}
                  required
                >
                  <option value="">Pilih Periode</option>
                  {periods.data.map((row) => (
                    <option key={row.id} value={row.id}>
                      Semester {row.semester} {row.tahun_ajaran} ({row.status_periode})
                    </option>
                  ))}
                </Field>

                <Field
                  label="Tahap Akademik"
                  name="tahap_akademik_id"
                  value={form.editor.values.tahap_akademik_id}
                  onChange={form.change}
                  required
                >
                  <option value="">Pilih Tahap</option>
                  {stages.data.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.nama_tahap} ({row.kode_tahap})
                    </option>
                  ))}
                </Field>
              </div>

              <Field
                label="Jenis Proses Pengajuan"
                name="jenis_proses"
                value={form.editor.values.jenis_proses}
                onChange={form.change}
                required
              >
                {processes.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Field>
            </div>

            {/* Bagian 2: Jendela Waktu Pelaksanaan (WIB) */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  2. Jendela Waktu Pelaksanaan (WIB)
                </h3>
                <span className="text-[11px] text-muted font-normal">
                  Waktu Indonesia Barat (UTC+7)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field
                  label="Tanggal & Waktu Buka"
                  name="tanggal_buka"
                  type="datetime-local"
                  value={form.editor.values.tanggal_buka}
                  onChange={form.change}
                  required
                />
                <Field
                  label="Tanggal & Waktu Tutup"
                  name="tanggal_tutup"
                  type="datetime-local"
                  value={form.editor.values.tanggal_tutup}
                  onChange={form.change}
                  required
                />
              </div>
            </div>

            {/* Bagian 3: Pengumuman & Status Keaktifan */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  3. Pengumuman & Status Keaktifan
                </h3>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="keterangan"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Keterangan / Pengumuman Jadwal
                </label>
                <textarea
                  id="keterangan"
                  name="keterangan"
                  value={form.editor.values.keterangan}
                  onChange={form.change}
                  maxLength={2000}
                  rows={3}
                  placeholder="Tuliskan catatan khusus atau petunjuk pengajuan bagi mahasiswa jika diperlukan…"
                  className={`${inputClass} resize-none`}
                />
                <div className="flex items-center justify-between text-[11px] text-muted pt-0.5">
                  <span>Ditampilkan sebagai petunjuk di formulir mahasiswa.</span>
                  <span>{(form.editor.values.keterangan || '').length}/2000</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-900/[0.08] bg-slate-50/70 p-3.5 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="is_aktif"
                  name="is_aktif"
                  checked={form.editor.values.is_aktif}
                  onChange={form.change}
                  className="size-4.5 rounded text-brand focus:ring-brand/30 cursor-pointer mt-0.5"
                />
                <label htmlFor="is_aktif" className="text-xs cursor-pointer select-none">
                  <span className="font-semibold text-ink block">
                    Jadwal Aktif (Dapat Diakses Sistem)
                  </span>
                  <span className="text-secondary block mt-0.5 leading-relaxed text-[11px]">
                    Bila dinonaktifkan, formulir pengajuan mahasiswa tetap terkunci meskipun rentang waktu kalender sedang berjalan.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </FormDialog>

      {/* ================= 7. MODAL SIMULASI KETERSEDIAAN MAHASISWA (WAKTU NYATA) ================= */}
      <AvailabilityModal
        open={showChecker}
        onClose={() => setShowChecker(false)}
        check={check}
        setCheck={setCheck}
        stages={stages}
        availability={availability}
        availabilityLoading={availabilityLoading}
        availabilityError={availabilityError}
      />
    </div>
  );
}

/**
 * Modal dialog simulasi ketersediaan formulir mahasiswa berdasarkan aturan server waktu nyata (WIB).
 * Menggunakan portal agar tidak memengaruhi flow/koordinat tata letak layout utama.
 */
function AvailabilityModal({
  open,
  onClose,
  check,
  setCheck,
  stages,
  availability,
  availabilityLoading,
  availabilityError,
}) {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, open, onClose);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs animate-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="availability-modal-title"
    >
      <section
        ref={modalRef}
        className="relative w-full max-w-xl max-h-[92vh] rounded-[22px] border border-slate-900/[0.12] bg-white flex flex-col overflow-hidden shadow-2xl text-ink"
      >
        {/* ================= 1. HEADER MODAL ================= */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-white/80 border-b border-slate-900/[0.08] shrink-0">
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <img
              src={boxIcon}
              alt=""
              className="size-11 sm:size-12 shrink-0 select-none pointer-events-none object-contain"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2
                id="availability-modal-title"
                className="text-base font-bold text-ink leading-tight truncate"
              >
                Simulasi Ketersediaan Pengajuan
              </h2>
              <p className="text-xs text-muted mt-0.5 truncate">
                Pemeriksaan waktu nyata (live) status formulir pengajuan mahasiswa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup simulasi"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Tutup (Esc)"
          >
            <IconClose className="size-4.5" />
          </button>
        </div>

        {/* ================= 2. ISI MODAL ================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Callout Info Aturan Penentuan Status */}
          <div className="rounded-[14px] border border-blue-200/80 bg-blue-50/70 p-3.5 flex items-start gap-3 text-xs leading-relaxed text-blue-900">
            <IconInformationCircle className="size-4.5 text-brand shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-brand">Aturan Penentuan Status Waktu Nyata</p>
              <p className="text-slate-600 mt-0.5">
                Status ketersediaan formulir dihitung langsung oleh server berdasarkan kombinasi <strong>Periode Aktif</strong>, <strong>Tahap Aktif</strong>, rentang tanggal <strong>Jadwal Proses</strong> aktif, dan jam server WIB saat ini.
              </p>
            </div>
          </div>

          {/* Bagian 1: Parameter Uji Simulasi */}
          <div className="space-y-3 pt-1">
            <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                1. Parameter Uji Simulasi
              </h3>
              <span className="text-[11px] text-muted font-normal">
                Pilih kombinasi tahap & jalur
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Tahap Akademik
                </label>
                <SettingsDropdownFilter
                  value={check.tahap}
                  onChange={(val) => setCheck((prev) => ({ ...prev, tahap: val }))}
                  icon={IconAcademicCap}
                  placeholder="Pilih Tahap"
                  minWidth="w-full"
                  options={stages.data
                    .filter((row) => ['KP', 'ISCP', 'TA'].includes(row.kode_tahap))
                    .map((row) => ({
                      value: row.kode_tahap,
                      label: `${row.nama_tahap} (${row.kode_tahap})`,
                    }))}
                />
                <p className="text-[10px] text-muted">Tahap pengajuan mahasiswa yang ingin diuji.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Jenis Proses Pengajuan
                </label>
                <SettingsDropdownFilter
                  value={check.jenis_proses}
                  onChange={(val) => setCheck((prev) => ({ ...prev, jenis_proses: val }))}
                  icon={IconFunnel}
                  placeholder="Pilih Proses"
                  minWidth="w-full"
                  options={processes.map(([code, label]) => ({
                    value: code,
                    label,
                  }))}
                />
                <p className="text-[10px] text-muted">Jalur pengajuan reguler baru atau perpanjangan.</p>
              </div>
            </div>
          </div>

          {/* Bagian 2: Hasil Respon Server */}
          <div className="space-y-3 pt-1">
            <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                2. Status Respon Server (WIB)
              </h3>
              <span className="text-[11px] font-mono text-muted">
                Live Server State
              </span>
            </div>

            <div>
              {availabilityLoading ? (
                <div className="flex items-center gap-3 p-4 text-xs text-secondary bg-slate-50 border border-slate-900/[0.08] rounded-xl">
                  <IconSpinner className="size-4.5 text-brand animate-spin shrink-0" />
                  <div>
                    <p className="font-semibold text-ink">Memeriksa Ketersediaan Jadwal…</p>
                    <p className="text-[11px] text-muted mt-0.5">Menghubungi endpoint ketersediaan server waktu nyata</p>
                  </div>
                </div>
              ) : availabilityError ? (
                <div className="flex items-start gap-3 p-4 text-xs text-rose-800 bg-rose-50/80 border border-rose-200 rounded-xl">
                  <IconExclamationCircle className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Gagal Memeriksa Ketersediaan</strong>
                    <span className="mt-0.5 block leading-relaxed">{availabilityError}</span>
                  </div>
                </div>
              ) : availability?.is_open ? (
                <div className="p-4 bg-emerald-50/90 border border-emerald-500/25 rounded-xl text-xs text-emerald-950 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="relative flex size-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-600" />
                      </span>
                      <span className="font-extrabold text-emerald-800 text-xs uppercase tracking-wide">
                        STATUS: SEDANG DIBUKA
                      </span>
                    </div>
                    <span className="rounded-full bg-emerald-100/90 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      Formulir Terbuka
                    </span>
                  </div>
                  <p className="text-emerald-900/90 leading-relaxed">
                    Mahasiswa yang memenuhi persyaratan dapat mengisi dan mengirimkan formulir <strong>{check.tahap}</strong> jalur <strong>{check.jenis_proses === 'PENGAJUAN_REGULER' ? 'Reguler' : 'Perpanjangan'}</strong>.
                  </p>
                  <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-800 font-medium">
                    <span>Batas Akhir Pengajuan:</span>
                    <strong>{formatDateTimeWib(availability.tanggal_tutup || availability.jadwal?.tanggal_tutup)}</strong>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50/90 border border-slate-900/[0.08] rounded-xl text-xs text-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <IconLockClosed className="size-4 text-slate-500 shrink-0" />
                      <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                        STATUS: {availability?.status_jadwal === 'BELUM_DIBUKA' ? 'BELUM DIBUKA' : availability?.status_jadwal === 'DITUTUP' ? 'SUDAH DITUTUP' : 'TIDAK TERSEDIA'}
                      </span>
                    </div>
                    <span className="rounded-full bg-slate-200/80 text-slate-700 px-2 py-0.5 text-[10px] font-bold">
                      Formulir Terkunci
                    </span>
                  </div>
                  <p className="text-secondary leading-relaxed">
                    {availability?.message || 'Pengajuan proses untuk kombinasi tahap dan jenis ini sedang tidak dibuka.'}
                  </p>
                  {availability?.tanggal_buka && (
                    <div className="pt-2 border-t border-slate-900/[0.06] flex items-center justify-between text-[11px] text-slate-600">
                      <span>Mulai Dibuka:</span>
                      <strong>{formatDateTimeWib(availability.tanggal_buka)}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= 3. FOOTER ================= */}
        <div className="flex items-center justify-end px-5 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-900/[0.08] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            Tutup Simulasi
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
