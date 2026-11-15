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
  IconClose,
  IconDocumentText,
  IconEdit,
  IconFunnel,
  IconInformationCircle,
  IconSearch,
} from '../../common/Icons.jsx';

const initial = {
  kode_jenis: '',
  nama_jenis: '',
  deskripsi: '',
  format_diizinkan: 'pdf',
  maks_ukuran_mb: '5',
  is_aktif: true,
};

export default function DocumentTypesPanel() {
  const toast = useToast();
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '', is_aktif: '' });
  const [searchInput, setSearchInput] = useState('');

  // Debounce input pencarian jenis dokumen (300ms)
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

  const list = useAcademicSettingsList('documents', query);
  const form = useAcademicSettingsEditor('documents', list.refresh, toast);

  const filter = (name, value) =>
    setFilters((current) => ({ ...current, [name]: value, page: 1 }));

  const handleResetFilters = () => {
    setSearchInput('');
    setFilters({ page: 1, limit: 20, search: '', is_aktif: '' });
  };

  const hasActiveFilters = Boolean(filters.search || filters.is_aktif || searchInput);

  const edit = (row) =>
    form.openEdit(row.id, {
      kode_jenis: row.kode_jenis,
      nama_jenis: row.nama_jenis,
      deskripsi: row.deskripsi || '',
      format_diizinkan: Array.isArray(row.format_diizinkan)
        ? row.format_diizinkan.join(', ')
        : String(row.format_diizinkan || ''),
      maks_ukuran_mb: String(row.maks_ukuran_mb ?? '5'),
      is_aktif: row.is_aktif,
    });

  const prepare = (values) => ({
    kode_jenis: values.kode_jenis.trim().toUpperCase(),
    nama_jenis: values.nama_jenis.trim(),
    deskripsi: values.deskripsi?.trim() || null,
    format_diizinkan: values.format_diizinkan
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
    maks_ukuran_mb: Number(values.maks_ukuran_mb),
    is_aktif: values.is_aktif,
  });

  const handleSave = (event) => {
    event.preventDefault();
    const { kode_jenis, nama_jenis, format_diizinkan, maks_ukuran_mb } = form.editor.values;
    if (!kode_jenis.trim() || !nama_jenis.trim()) {
      toast.error('Kode dan nama jenis dokumen wajib diisi.');
      return;
    }
    const formats = format_diizinkan.split(',').map((f) => f.trim()).filter(Boolean);
    if (!formats.length) {
      toast.error('Minimal sertakan 1 format ekstensi file yang diizinkan (misal: pdf).');
      return;
    }
    const maxSize = Number(maks_ukuran_mb);
    if (!maxSize || maxSize <= 0 || maxSize > 100) {
      toast.error('Ukuran maksimal berkas harus antara 1 sampai 100 MB.');
      return;
    }
    form.save(event, prepare);
  };

  return (
    <div className="space-y-5">
      {/* ================= 1. SECTION HEADER ================= */}
      <SectionHeader
        title="Master Jenis Dokumen Pengajuan"
        description="Kelola master berkas persyaratan pengajuan akademik mahasiswa prodi."
        onAdd={() => form.openCreate(initial)}
        addLabel="Tambah Jenis Dokumen"
        onRefresh={list.refresh}
        badgeCount={list.pagination?.total_items ?? list.data.length}
        kicker="MASTER DOKUMEN"
      />

      {/* ================= 2. TOOLBAR FILTER & SEARCH (Mengikuti MahasiswaToolbar) ================= */}
      <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative z-20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Sisi Kiri: Search Input & Filter Dropdowns */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1 flex-wrap">
            {/* Search Box Nama / Kode Dokumen */}
            <div className="relative flex-1 sm:max-w-xs min-w-[220px]">
              <label htmlFor="search-dokumen" className="sr-only">
                Cari nama atau kode dokumen
              </label>
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              <input
                id="search-dokumen"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                maxLength={100}
                placeholder="Cari nama atau kode dokumen…"
                className="w-full rounded-xl border border-slate-900/[0.12] bg-white/80 pl-10 pr-9 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
                  title="Hapus pencarian dokumen"
                  aria-label="Hapus pencarian dokumen"
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
                { value: 'true', label: 'Dokumen Aktif' },
                { value: 'false', label: 'Dokumen Nonaktif' },
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
                title="Reset semua filter dokumen"
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
              {list.pagination?.total_items ?? list.data.length} jenis dokumen
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
        emptyTitle="Tidak Ada Jenis Dokumen"
        emptyMessage="Belum ada data jenis dokumen yang sesuai dengan filter. Tambahkan jenis dokumen baru untuk memulai."
        onRetry={list.refresh}
      />

      {/* ================= 5. TABEL DAFTAR JENIS DOKUMEN ================= */}
      {!list.loading && !list.error && list.data.length > 0 && (
        <div className="overflow-hidden rounded-[20px] border border-slate-900/[0.08] bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/[0.06] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="py-3.5 pl-6 pr-3">Nama & Kode Dokumen</th>
                  <th className="py-3.5 px-3">Format File</th>
                  <th className="py-3.5 px-3">Maks. Ukuran</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Deskripsi</th>
                  <th className="py-3.5 pl-3 pr-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.06] text-xs">
                {list.data.map((row) => {
                  const formatList = Array.isArray(row.format_diizinkan)
                    ? row.format_diizinkan
                    : [row.format_diizinkan];

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 transition-colors duration-150"
                    >
                      {/* 1. Nama & Kode */}
                      <td className="py-3.5 pl-6 pr-3 align-middle">
                        <div className="font-semibold text-xs sm:text-sm text-ink">
                          {row.nama_jenis}
                        </div>
                        <div className="text-[11px] font-mono text-muted mt-0.5">
                          {row.kode_jenis}
                        </div>
                      </td>

                      {/* 2. Format Diizinkan */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {formatList.map((ext, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-mono font-bold text-brand uppercase border border-blue-200/60"
                            >
                              .{ext}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* 3. Ukuran Maksimal */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap text-secondary font-medium">
                        <span className="text-xs text-slate-700">
                          Maks. {row.maks_ukuran_mb} MB
                        </span>
                      </td>

                      {/* 4. Status */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <AcademicStatusBadge status={row.is_aktif} />
                      </td>

                      {/* 5. Deskripsi */}
                      <td className="py-3.5 px-3 align-middle text-secondary max-w-[220px]">
                        {row.deskripsi ? (
                          <span className="text-[11px] text-muted truncate block" title={row.deskripsi}>
                            {row.deskripsi}
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
                            title="Ubah jenis dokumen"
                          >
                            <IconEdit className="size-3.5 text-slate-500" />
                            <span>Ubah</span>
                          </button>
                          <StatusAction
                            resource="documents"
                            row={row}
                            refresh={list.refresh}
                            toast={toast}
                            label="Jenis dokumen"
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
              unit="jenis dokumen" />
          </div>
        </div>
      )}

      {/* ================= 7. FORM MODAL CREATE / EDIT ================= */}
      <FormDialog
        title={form.editor?.id ? 'Ubah Jenis Dokumen' : 'Tambah Jenis Dokumen'}
        subtitle={
          form.editor?.id
            ? 'Perbarui ketentuan format berkas dan batas ukuran unggah dokumen.'
            : 'Daftarkan jenis dokumen baru untuk persyaratan pengajuan akademik prodi.'
        }
        open={Boolean(form.editor)}
        onClose={form.close}
        onSubmit={handleSave}
        busy={form.busy}
        error={form.error}
        submitLabel={form.editor?.id ? 'Simpan Perubahan' : 'Daftarkan Dokumen'}
      >
        {form.editor && (
          <div className="space-y-4">
            {/* Callout Info Ketentuan Master Dokumen */}
            <div className="rounded-[14px] border border-blue-200/80 bg-blue-50/70 p-3.5 flex items-start gap-3 text-xs leading-relaxed text-blue-900">
              <IconInformationCircle className="size-4.5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-brand">Ketentuan Master Jenis Dokumen</p>
                <p className="text-slate-600 mt-0.5">
                  Jenis dokumen mendefinisikan jenis berkas yang dapat diunggah mahasiswa (seperti Proposal, Surat Mitra, atau Bukti Bayar). Konfigurasi ekstensi dan batas ukuran file akan divalidasi langsung oleh sistem saat mahasiswa mengunggah berkas.
                </p>
              </div>
            </div>

            {/* Bagian 1: Identitas Jenis Dokumen */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  1. Identitas Jenis Dokumen
                </h3>
                <span className="text-[11px] text-muted font-normal">
                  Tanda bintang (<span className="text-rose-500 font-bold">*</span>) wajib diisi
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field
                  label="Kode Jenis Dokumen"
                  name="kode_jenis"
                  value={form.editor.values.kode_jenis}
                  onChange={form.change}
                  required
                  autoFocus={!form.editor?.id}
                  placeholder="Contoh: PROPOSAL_KP"
                  maxLength={100}
                />

                <Field
                  label="Nama Jenis Dokumen"
                  name="nama_jenis"
                  value={form.editor.values.nama_jenis}
                  onChange={form.change}
                  required
                  maxLength={150}
                  placeholder="Contoh: Proposal Kerja Praktik"
                />
              </div>
            </div>

            {/* Bagian 2: Ketentuan File Unggahan */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  2. Ketentuan File Unggahan
                </h3>
                <span className="text-[11px] text-muted font-normal">
                  Validasi format & ukuran berkas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field
                  label="Format Ekstensi Diizinkan"
                  name="format_diizinkan"
                  value={form.editor.values.format_diizinkan}
                  onChange={form.change}
                  required
                  placeholder="Contoh: pdf, jpg, png"
                  helperText="Pisahkan dengan koma jika lebih dari satu (contoh: pdf, jpg)."
                />

                <Field
                  label="Ukuran Maksimal Berkas (MB)"
                  name="maks_ukuran_mb"
                  type="number"
                  min={1}
                  max={100}
                  value={form.editor.values.maks_ukuran_mb}
                  onChange={form.change}
                  required
                  placeholder="Contoh: 5"
                  helperText="Batas maksimal ukuran unggahan dalam satuan Megabyte."
                />
              </div>
            </div>

            {/* Bagian 3: Petunjuk & Status Keaktifan */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  3. Petunjuk Pengunggahan & Keaktifan
                </h3>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="deskripsi"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Deskripsi / Petunjuk Pengunggahan
                </label>
                <textarea
                  id="deskripsi"
                  name="deskripsi"
                  value={form.editor.values.deskripsi}
                  onChange={form.change}
                  maxLength={2000}
                  rows={3}
                  placeholder="Tuliskan petunjuk khusus, ketentuan cap basah, format scan dokumen, atau instruksi legalisir bagi mahasiswa…"
                  className={`${inputClass} resize-none`}
                />
                <div className="flex items-center justify-between text-[11px] text-muted pt-0.5">
                  <span>Ditampilkan sebagai instruksi di area unggah mahasiswa.</span>
                  <span>{(form.editor.values.deskripsi || '').length}/2000</span>
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
                    Dokumen Aktif (Dapat Dipilih di Persyaratan Pengajuan)
                  </span>
                  <span className="text-secondary block mt-0.5 leading-relaxed text-[11px]">
                    Bila dinonaktifkan, jenis dokumen ini tidak dapat dikonfigurasi ke dalam aturan persyaratan pengajuan tahap baru.
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
