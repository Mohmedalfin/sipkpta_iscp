import { useEffect, useState } from 'react';
import { useToast } from '../../../context/ToastContext.jsx';
import { useAcademicSettingsList } from '../../../hooks/useAcademicSettingsList.js';
import { useAcademicSettingsEditor } from '../../../hooks/useAcademicSettingsEditor.js';
import StatusAction from './StatusAction.jsx';
import AcademicStatusBadge from './AcademicStatusBadge.jsx';
import SettingsDropdownFilter from './SettingsDropdownFilter.jsx';
import {
  Field,
  FormDialog,
  formatDateIndo,
  inputClass,
  ListState,
  Pager,
  secondaryButton,
  SectionHeader,
} from './SettingsUi.jsx';
import {
  IconCalendar,
  IconClose,
  IconEdit,
  IconFunnel,
  IconInformationCircle,
  IconSearch,
} from '../../common/Icons.jsx';

const initial = {
  tahun_ajaran: '',
  semester: 'GANJIL',
  tanggal_mulai: '',
  tanggal_selesai: '',
};

const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');

export default function PeriodPanel({ onPeriodChange }) {
  const toast = useToast();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    semester: '',
    tahun_ajaran: '',
  });
  const [yearInput, setYearInput] = useState('');

  // Debounce input pencarian tahun ajaran (300ms) agar responsif dan tidak membebani network
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => {
        const val = yearInput.trim();
        if (current.tahun_ajaran === val) return current;
        return { ...current, tahun_ajaran: val, page: 1 };
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [yearInput]);

  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '')
  );

  const list = useAcademicSettingsList('periods', query);

  const handleRefresh = () => {
    list.refresh();
    onPeriodChange?.();
  };

  const form = useAcademicSettingsEditor('periods', handleRefresh, toast);

  const filter = (name, value) =>
    setFilters((current) => ({ ...current, [name]: value, page: 1 }));

  const handleResetFilters = () => {
    setYearInput('');
    setFilters({ page: 1, limit: 20, status: '', semester: '', tahun_ajaran: '' });
  };

  const hasActiveFilters = Boolean(
    filters.status || filters.semester || filters.tahun_ajaran || yearInput
  );

  const edit = (row) =>
    form.openEdit(row.id, {
      tahun_ajaran: row.tahun_ajaran,
      semester: row.semester,
      tanggal_mulai: dateOnly(row.tanggal_mulai),
      tanggal_selesai: dateOnly(row.tanggal_selesai),
    });

  const handleSave = (event) => {
    event.preventDefault();
    const { tanggal_mulai, tanggal_selesai, tahun_ajaran } = form.editor.values;
    if (tanggal_mulai && tanggal_selesai && tanggal_mulai > tanggal_selesai) {
      toast.error('Tanggal mulai tidak boleh melewati tanggal selesai.');
      return;
    }
    if (!/^\d{4}\/\d{4}$/.test(tahun_ajaran.trim())) {
      toast.error('Format tahun ajaran harus YYYY/YYYY (contoh: 2026/2027).');
      return;
    }
    form.save(event);
  };

  return (
    <div className="space-y-5">
      {/* ================= 1. SECTION HEADER ================= */}
      <SectionHeader
        title="Periode Akademik"
        description="Kelola kalender semester akademik dan status keaktifan pengajuan prodi."
        onAdd={() => form.openCreate(initial)}
        addLabel="Tambah Periode"
        onRefresh={handleRefresh}
        badgeCount={list.pagination?.total_items ?? list.data.length}
        kicker="KALENDER AKADEMIK"
      />

      {/* ================= 2. TOOLBAR FILTER & SEARCH (Mengikuti MahasiswaToolbar) ================= */}
      <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative z-20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Sisi Kiri: Search Input & Filter Dropdowns */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1 flex-wrap">
            {/* Search Box Tahun Ajaran */}
            <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
              <label htmlFor="search-tahun" className="sr-only">
                Cari tahun ajaran
              </label>
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              <input
                id="search-tahun"
                type="text"
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                maxLength={9}
                placeholder="Cari tahun (2026/2027)…"
                className="w-full rounded-xl border border-slate-900/[0.12] bg-white/80 pl-10 pr-9 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
              />
              {yearInput && (
                <button
                  type="button"
                  onClick={() => setYearInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
                  title="Hapus pencarian tahun"
                  aria-label="Hapus pencarian tahun"
                >
                  <IconClose className="size-3" />
                </button>
              )}
            </div>

            {/* Filter Dropdown Semester */}
            <SettingsDropdownFilter
              value={filters.semester}
              onChange={(val) => filter('semester', val)}
              icon={IconCalendar}
              placeholder="Semua Semester"
              minWidth="w-full sm:w-44"
              options={[
                { value: '', label: 'Semua Semester' },
                { value: 'GANJIL', label: 'Semester Ganjil' },
                { value: 'GENAP', label: 'Semester Genap' },
              ]}
            />

            {/* Filter Dropdown Status */}
            <SettingsDropdownFilter
              value={filters.status}
              onChange={(val) => filter('status', val)}
              icon={IconFunnel}
              placeholder="Semua Status"
              minWidth="w-full sm:w-40"
              options={[
                { value: '', label: 'Semua Status' },
                { value: 'AKTIF', label: 'Status Aktif' },
                { value: 'DRAFT', label: 'Status Draft' },
                { value: 'NONAKTIF', label: 'Status Nonaktif' },
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
                title="Reset semua filter dan pencarian"
              >
                <IconClose className="size-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Baris Informasi Hasil / Active Filter Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900/[0.04] text-[11px] text-muted">
          <div>
            <span>Menampilkan hasil: </span>
            <strong className="text-ink font-semibold">
              {list.pagination?.total_items ?? list.data.length} periode
            </strong>
            {yearInput && (
              <span>
                {' '}• Tahun <strong className="text-brand font-semibold">"{yearInput}"</strong>
              </span>
            )}
            {filters.semester && (
              <span>
                {' '}• Semester <strong className="text-brand font-semibold">{filters.semester}</strong>
              </span>
            )}
            {filters.status && (
              <span>
                {' '}• Status <strong className="text-brand font-semibold">{filters.status}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ================= 4. FEEDBACK STATES ================= */}
      <ListState
        loading={list.loading}
        error={list.error}
        empty={!list.data.length}
        emptyTitle="Tidak Ada Periode Akademik"
        emptyMessage="Belum ada data periode yang sesuai dengan filter. Tambahkan periode baru untuk memulai."
        onRetry={list.refresh}
      />

      {/* ================= 5. TABEL DAFTAR PERIODE ================= */}
      {!list.loading && !list.error && list.data.length > 0 && (
        <div className="overflow-hidden rounded-[20px] border border-slate-900/[0.08] bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/[0.06] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="py-3.5 pl-6 pr-3">Tahun & Semester</th>
                  <th className="py-3.5 px-3">Rentang Kalender</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Keterkaitan Data</th>
                  <th className="py-3.5 pl-3 pr-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.06] text-xs">
                {list.data.map((row) => {
                  const isCurrent = row.status_periode === 'AKTIF' || row.is_berjalan;
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/70 transition-colors duration-150 ${
                        isCurrent ? 'bg-blue-50/20' : ''
                      }`}
                    >
                      {/* 1. Tahun & Semester */}
                      <td className="py-3.5 pl-6 pr-3 align-middle">
                        <div className="font-semibold text-xs sm:text-sm text-ink">
                          Semester {row.semester} {row.tahun_ajaran}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">
                          {row.is_berjalan ? (
                            <span className="inline-flex items-center gap-1 font-medium text-brand">
                              <span className="size-1.5 rounded-full bg-brand animate-pulse" />
                              Sedang Berjalan
                            </span>
                          ) : row.is_mendatang ? (
                            <span className="text-secondary font-medium">Periode Mendatang</span>
                          ) : (
                            <span className="text-slate-400">Tahun Ajaran {row.tahun_ajaran}</span>
                          )}
                        </div>
                      </td>

                      {/* 2. Rentang Kalender */}
                      <td className="py-3.5 px-3 align-middle text-secondary whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <IconCalendar className="size-3.5 text-muted shrink-0" />
                          <span>
                            {formatDateIndo(row.tanggal_mulai)} – {formatDateIndo(row.tanggal_selesai)}
                          </span>
                        </div>
                      </td>

                      {/* 3. Status */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <AcademicStatusBadge status={row.status_periode} />
                      </td>

                      {/* 4. Keterkaitan Data */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <div className="text-xs text-secondary flex items-center gap-1.5">
                          <span className="font-semibold text-ink">{row.jumlah?.jadwal ?? 0}</span>
                          <span className="text-muted text-[11px]">Jadwal</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-semibold text-ink">{row.jumlah?.pengajuan ?? 0}</span>
                          <span className="text-muted text-[11px]">Pengajuan</span>
                        </div>
                      </td>

                      {/* 5. Aksi */}
                      <td className="py-3.5 pl-3 pr-6 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => edit(row)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-brand hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Ubah data periode"
                          >
                            <IconEdit className="size-3.5 text-slate-500" />
                            <span>Ubah</span>
                          </button>
                          <StatusAction
                            resource="periods"
                            row={row}
                            refresh={handleRefresh}
                            toast={toast}
                            label="Periode"
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
              unit="periode" />
          </div>
        </div>
      )}

      {/* ================= 7. FORM MODAL CREATE / EDIT ================= */}
      <FormDialog
        title={form.editor?.id ? 'Ubah Periode Akademik' : 'Tambah Periode Akademik'}
        subtitle={
          form.editor?.id
            ? 'Perbarui data kalender dan rentang tanggal periode semester akademik.'
            : 'Daftarkan periode semester baru untuk administrasi proses KP/ISCP/TA.'
        }
        open={Boolean(form.editor)}
        onClose={form.close}
        onSubmit={handleSave}
        busy={form.busy}
        error={form.error}
        submitLabel={form.editor?.id ? 'Simpan Perubahan' : 'Daftarkan Periode'}
      >
        {form.editor && (
          <div className="space-y-4">
            {/* Callout Info Ketentuan Kalender Akademik */}
            <div className="rounded-[14px] border border-blue-200/80 bg-blue-50/70 p-3.5 flex items-start gap-3 text-xs leading-relaxed text-blue-900">
              <IconInformationCircle className="size-4.5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-brand">Ketentuan Kalender Akademik</p>
                <p className="text-slate-600 mt-0.5">
                  Periode semester menjadi acuan utama ketersediaan seluruh alur pengajuan KP, ISCP, dan TA. Pastikan format tahun ajaran sesuai standar <code className="font-mono text-slate-800 bg-white/70 px-1 py-0.5 rounded border border-blue-200/60">YYYY/YYYY</code> dan rentang tanggal mencakup seluruh masa perkuliahan semester.
                </p>
              </div>
            </div>

            {/* Bagian 1: Identitas Periode & Semester */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  1. Identitas Periode & Semester
                </h3>
                <span className="text-[11px] text-muted font-normal">
                  Tanda bintang (<span className="text-rose-500 font-bold">*</span>) wajib diisi
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field
                  label="Tahun Ajaran"
                  name="tahun_ajaran"
                  value={form.editor.values.tahun_ajaran}
                  onChange={form.change}
                  required
                  autoFocus={!form.editor?.id}
                  placeholder="Contoh: 2026/2027"
                  maxLength={9}
                  helperText="Format: 4 digit tahun / 4 digit tahun (contoh: 2026/2027)."
                />

                <Field
                  label="Semester Akademik"
                  name="semester"
                  value={form.editor.values.semester}
                  onChange={form.change}
                  required
                >
                  <option value="GANJIL">Semester Ganjil</option>
                  <option value="GENAP">Semester Genap</option>
                </Field>
              </div>
            </div>

            {/* Bagian 2: Rentang Kalender Pelaksanaan */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  2. Rentang Kalender Pelaksanaan
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field
                  label="Tanggal Mulai"
                  name="tanggal_mulai"
                  type="date"
                  value={form.editor.values.tanggal_mulai}
                  onChange={form.change}
                  required
                  helperText="Awal dimulainya kalender semester."
                />
                <Field
                  label="Tanggal Selesai"
                  name="tanggal_selesai"
                  type="date"
                  value={form.editor.values.tanggal_selesai}
                  onChange={form.change}
                  required
                  helperText="Batas akhir kalender semester."
                />
              </div>
            </div>
          </div>
        )}
      </FormDialog>
    </div>
  );
}
