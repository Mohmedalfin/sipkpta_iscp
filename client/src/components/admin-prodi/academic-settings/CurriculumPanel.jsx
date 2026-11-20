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
  inputClass,
  ListState,
  Pager,
  secondaryButton,
  SectionHeader,
} from './SettingsUi.jsx';
import {
  IconAcademicCap,
  IconClose,
  IconEdit,
  IconFunnel,
  IconInformationCircle,
  IconSearch,
} from '../../common/Icons.jsx';

const initial = {
  kode_kurikulum: '',
  nama_kurikulum: '',
  tahun_mulai_berlaku: '',
  keterangan: '',
  is_aktif: true,
};

export default function CurriculumPanel() {
  const toast = useToast();
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '', is_aktif: '' });
  const [searchInput, setSearchInput] = useState('');

  // Debounce input pencarian kurikulum (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => {
        const val = searchInput.trim();
        if (current.search === val) return current;
        return { ...current, search: val, page: 1 };
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '')
  );

  const list = useAcademicSettingsList('curriculum', query);
  const form = useAcademicSettingsEditor('curriculum', list.refresh, toast);

  const filter = (name, value) =>
    setFilters((current) => ({ ...current, [name]: value, page: 1 }));

  const handleResetFilters = () => {
    setSearchInput('');
    setFilters({ page: 1, limit: 20, search: '', is_aktif: '' });
  };

  const hasActiveFilters = Boolean(filters.search || filters.is_aktif || searchInput);

  const edit = (row) =>
    form.openEdit(row.id, {
      kode_kurikulum: row.kode_kurikulum,
      nama_kurikulum: row.nama_kurikulum,
      tahun_mulai_berlaku: String(row.tahun_mulai_berlaku),
      keterangan: row.keterangan || '',
      is_aktif: row.is_aktif,
    });

  const prepare = (values) => ({
    kode_kurikulum: values.kode_kurikulum.trim(),
    nama_kurikulum: values.nama_kurikulum.trim(),
    tahun_mulai_berlaku: Number(values.tahun_mulai_berlaku),
    keterangan: values.keterangan?.trim() || null,
    is_aktif: values.is_aktif,
  });

  const handleSave = (event) => {
    event.preventDefault();
    const { tahun_mulai_berlaku, kode_kurikulum, nama_kurikulum } = form.editor.values;
    if (!kode_kurikulum.trim() || !nama_kurikulum.trim()) {
      toast.error('Kode dan nama kurikulum wajib diisi.');
      return;
    }
    const yearNum = Number(tahun_mulai_berlaku);
    if (!yearNum || yearNum < 1900 || yearNum > 2100) {
      toast.error('Tahun mulai berlaku harus tahun yang valid (contoh: 2022).');
      return;
    }
    form.save(event, prepare);
  };

  return (
    <div className="space-y-5">
      {/* ================= 1. SECTION HEADER ================= */}
      <SectionHeader
        title="Master Kurikulum Program Studi"
        description="Kelola kurikulum referensi program studi untuk data akademik mahasiswa."
        onAdd={() => form.openCreate(initial)}
        addLabel="Tambah Kurikulum"
        onRefresh={list.refresh}
        refreshing={list.refreshing}
        badgeCount={list.pagination?.total_items ?? list.data.length}
        kicker="REFERENSI KURIKULUM"
      />

      {/* ================= 2. TOOLBAR FILTER & SEARCH (Mengikuti MahasiswaToolbar) ================= */}
      <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative z-20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Sisi Kiri: Search Input & Filter Dropdowns */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1 flex-wrap">
            {/* Search Box Kode / Nama Kurikulum */}
            <div className="relative flex-1 sm:max-w-xs min-w-[220px]">
              <label htmlFor="search-kurikulum" className="sr-only">
                Cari kode atau nama kurikulum
              </label>
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              <input
                id="search-kurikulum"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                maxLength={100}
                placeholder="Cari kode atau nama kurikulum…"
                className="w-full rounded-xl border border-slate-900/[0.12] bg-white/80 pl-10 pr-9 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
                  title="Hapus pencarian kurikulum"
                  aria-label="Hapus pencarian kurikulum"
                >
                  <IconClose className="size-3" />
                </button>
              )}
            </div>

            {/* Filter Dropdown Status */}
            <SettingsDropdownFilter
              value={filters.is_aktif}
              onChange={(val) => filter('is_aktif', val)}
              icon={IconFunnel}
              placeholder="Semua Status"
              minWidth="w-full sm:w-44"
              options={[
                { value: '', label: 'Semua Status' },
                { value: 'true', label: 'Kurikulum Aktif' },
                { value: 'false', label: 'Kurikulum Nonaktif' },
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
                title="Reset semua filter kurikulum"
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
              {list.pagination?.total_items ?? list.data.length} kurikulum
            </strong>
            {searchInput && (
              <span>
                {' '}• Pencarian <strong className="text-brand font-semibold">"{searchInput}"</strong>
              </span>
            )}
            {filters.is_aktif && (
              <span>
                {' '}• Status{' '}
                <strong className="text-brand font-semibold">
                  {filters.is_aktif === 'true' ? 'Aktif' : 'Nonaktif'}
                </strong>
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
        emptyTitle="Tidak Ada Kurikulum"
        emptyMessage="Belum ada data kurikulum yang sesuai dengan filter. Tambahkan master kurikulum baru untuk memulai."
        onRetry={list.refresh}
      />

      {/* ================= 5. TABEL DAFTAR KURIKULUM ================= */}
      {!list.loading && !list.error && list.data.length > 0 && (
        <div className="overflow-hidden rounded-[20px] border border-slate-900/[0.08] bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/[0.06] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="py-3.5 pl-6 pr-3">Kurikulum & Kode</th>
                  <th className="py-3.5 px-3">Tahun Berlaku</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Keterangan</th>
                  <th className="py-3.5 pl-3 pr-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.06] text-xs">
                {list.data.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/70 transition-colors duration-150"
                  >
                    {/* 1. Kurikulum & Kode */}
                    <td className="py-3.5 pl-6 pr-3 align-middle">
                      <div className="font-semibold text-xs sm:text-sm text-ink">
                        {row.nama_kurikulum}
                      </div>
                      <div className="text-[11px] font-mono text-muted mt-0.5">
                        Kode: {row.kode_kurikulum}
                      </div>
                    </td>

                    {/* 2. Tahun Berlaku */}
                    <td className="py-3.5 px-3 align-middle text-secondary whitespace-nowrap">
                      <span className="text-xs font-medium text-slate-800">Mulai Tahun {row.tahun_mulai_berlaku}</span>
                    </td>

                    {/* 3. Status */}
                    <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                      <AcademicStatusBadge status={row.is_aktif} />
                    </td>

                    {/* 4. Keterangan */}
                    <td className="py-3.5 px-3 align-middle text-secondary max-w-[240px]">
                      {row.keterangan ? (
                        <span className="text-[11px] text-muted truncate block" title={row.keterangan}>
                          {row.keterangan}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* 5. Aksi */}
                    <td className="py-3.5 pl-3 pr-6 align-middle text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => edit(row)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-brand hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Ubah kurikulum"
                        >
                          <IconEdit className="size-3.5 text-slate-500" />
                          <span>Ubah</span>
                        </button>
                        <StatusAction
                          resource="curriculum"
                          row={row}
                          refresh={list.refresh}
                          toast={toast}
                          label="Kurikulum"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line px-6">
            <Pager pagination={list.pagination}
              onPage={(page) => setFilters((current) => ({ ...current, page }))}
              unit="kurikulum" />
          </div>
        </div>
      )}

      {/* ================= 7. FORM MODAL CREATE / EDIT ================= */}
      <FormDialog
        title={form.editor?.id ? 'Ubah Master Kurikulum' : 'Tambah Kurikulum Baru'}
        subtitle={
          form.editor?.id
            ? 'Perbarui informasi kode, nama, dan tahun berlaku kurikulum prodi.'
            : 'Daftarkan kurikulum referensi baru untuk Program Studi.'
        }
        open={Boolean(form.editor)}
        onClose={form.close}
        onSubmit={handleSave}
        busy={form.busy}
        error={form.error}
        submitLabel={form.editor?.id ? 'Simpan Perubahan' : 'Daftarkan Kurikulum'}
      >
        {form.editor && (
          <div className="space-y-4">
            {/* Callout Info Ketentuan Master Kurikulum */}
            <div className="rounded-[14px] border border-blue-200/80 bg-blue-50/70 p-3.5 flex items-start gap-3 text-xs leading-relaxed text-blue-900">
              <IconInformationCircle className="size-4.5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-brand">Ketentuan Master Kurikulum Program Studi</p>
                <p className="text-slate-600 mt-0.5">
                  Kurikulum berfungsi sebagai data referensi akademik mahasiswa prodi. Perubahan atau penonaktifan kurikulum tidak akan membatalkan atau mengubah riwayat pengajuan mahasiswa yang sudah berjalan sebelumnya.
                </p>
              </div>
            </div>

            {/* Bagian 1: Identitas & Masa Berlaku Kurikulum */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  1. Identitas & Masa Berlaku Kurikulum
                </h3>
                <span className="text-[11px] text-muted font-normal">
                  Tanda bintang (<span className="text-rose-500 font-bold">*</span>) wajib diisi
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field
                  label="Kode Kurikulum"
                  name="kode_kurikulum"
                  value={form.editor.values.kode_kurikulum}
                  onChange={form.change}
                  required
                  autoFocus={!form.editor?.id}
                  maxLength={50}
                  placeholder="Contoh: KUR-2026"
                  helperText="Kode pengenal unik kurikulum (contoh: KUR-2022, KUR-2026)."
                />

                <Field
                  label="Tahun Mulai Berlaku"
                  name="tahun_mulai_berlaku"
                  value={form.editor.values.tahun_mulai_berlaku}
                  onChange={form.change}
                  type="number"
                  min={1900}
                  max={2100}
                  required
                  placeholder="Contoh: 2026"
                  helperText="Tahun akademik awal kurikulum diresmikan."
                />
              </div>

              <Field
                label="Nama Kurikulum"
                name="nama_kurikulum"
                value={form.editor.values.nama_kurikulum}
                onChange={form.change}
                required
                maxLength={150}
                placeholder="Contoh: Kurikulum Berbasis OBE 2026"
                helperText="Nama resmi kurikulum Program Studi Sistem Informasi."
              />
            </div>

            {/* Bagian 2: Catatan & Status Keaktifan */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  2. Catatan & Status Keaktifan
                </h3>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="keterangan"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Keterangan / Catatan Kurikulum
                </label>
                <textarea
                  id="keterangan"
                  name="keterangan"
                  value={form.editor.values.keterangan}
                  onChange={form.change}
                  maxLength={2000}
                  rows={3}
                  placeholder="Tuliskan catatan fokus konsentrasi, struktur peminatan, atau nomor SK penetapan kurikulum jika ada…"
                  className={`${inputClass} resize-none`}
                />
                <div className="flex items-center justify-between text-[11px] text-muted pt-0.5">
                  <span>Ditampilkan sebagai catatan referensi di modul akademik.</span>
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
                    Kurikulum Aktif (Dapat Dijadikan Rujukan Prodi)
                  </span>
                  <span className="text-secondary block mt-0.5 leading-relaxed text-[11px]">
                    Kurikulum yang aktif dapat ditetapkan ke mahasiswa baru atau dipakai saat pemetaan mata kuliah prasyarat.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </FormDialog>
    </div>
  );
}
