import { useState } from 'react';
import { useToast } from '../../../context/ToastContext.jsx';
import { useAcademicSettingsList } from '../../../hooks/useAcademicSettingsList.js';
import { useAcademicSettingsEditor } from '../../../hooks/useAcademicSettingsEditor.js';
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
  IconCalendar,
  IconClipboardCheck,
  IconClose,
  IconDocumentText,
  IconEdit,
  IconFunnel,
  IconInformationCircle,
} from '../../common/Icons.jsx';

const kpCodes = new Set([
  'PROPOSAL_KP',
  'BUKTI_BAYAR_PROPOSAL_KP',
  'BUKTI_SPP_VARIABEL_KP',
  'SERTIFIKAT_SOSIALISASI_KP',
  'SURAT_PERNYATAAN_SOSIALISASI_KP',
]);

const requiredCodes = new Set(['PROPOSAL_KP', 'BUKTI_BAYAR_PROPOSAL_KP']);

export default function RequirementsPanel() {
  const toast = useToast();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    periode: '',
    tahap: '',
    jenis_pengajuan: '',
    pilihan_topik: '',
  });

  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '')
  );

  const list = useAcademicSettingsList('requirements', query);
  const periods = useAcademicSettingsList('periods', { page: 1, limit: 100 });
  const stages = useAcademicSettingsList('stages');
  const documents = useAcademicSettingsList('documents', { page: 1, limit: 100 });
  const form = useAcademicSettingsEditor('requirements', list.refresh, toast);

  const filter = (name, value) =>
    setFilters((current) => ({ ...current, [name]: value, page: 1 }));

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
      periode: '',
      tahap: '',
      jenis_pengajuan: '',
      pilihan_topik: '',
    });
  };

  const hasActiveFilters = Boolean(
    filters.periode || filters.tahap || filters.pilihan_topik
  );

  const kp = stages.data.find((row) => row.kode_tahap === 'KP');
  const eligible = documents.data.filter(
    (row) => row.is_aktif && kpCodes.has(row.kode_jenis)
  );

  const openCreate = () =>
    form.openCreate({
      periode_akademik_id: '',
      tahap_akademik_id: kp?.id || '',
      jenis_pengajuan: 'REGULER',
      pilihan_topik: 'BARU',
      jenis_dokumen_id: '',
      petunjuk: '',
      urutan_tampil: '1',
    });

  const edit = (row) =>
    form.openEdit(row.id, {
      petunjuk: row.petunjuk || '',
      urutan_tampil: String(row.urutan_tampil),
      documentName: row.jenis_dokumen?.nama_jenis,
      isWajib: row.is_wajib,
    });

  const prepare = (values) => {
    if (form.editor.id !== null) {
      return {
        petunjuk: values.petunjuk?.trim() || null,
        urutan_tampil: Number(values.urutan_tampil),
      };
    }
    const document = eligible.find(
      (row) => row.id === Number(values.jenis_dokumen_id)
    );
    return {
      periode_akademik_id: Number(values.periode_akademik_id),
      tahap_akademik_id: Number(values.tahap_akademik_id),
      jenis_pengajuan: 'REGULER',
      pilihan_topik: 'BARU',
      jenis_dokumen_id: Number(values.jenis_dokumen_id),
      is_wajib: requiredCodes.has(document?.kode_jenis),
      boleh_gunakan_dokumen_sebelumnya: false,
      is_aktif: true,
      petunjuk: values.petunjuk?.trim() || null,
      urutan_tampil: Number(values.urutan_tampil),
    };
  };

  const periodName = (id) => {
    const period = periods.data.find((row) => row.id === id);
    return period ? `Semester ${period.semester} ${period.tahun_ajaran}` : `Periode #${id}`;
  };

  const stageCode = (id) => {
    const stage = stages.data.find((row) => row.id === id);
    return stage ? stage.kode_tahap : `Tahap #${id}`;
  };

  const handleSave = (event) => {
    event.preventDefault();
    const { urutan_tampil } = form.editor.values;
    const orderNum = Number(urutan_tampil);
    if (!orderNum || orderNum <= 0) {
      toast.error('Urutan tampil harus berupa angka positif minimal 1.');
      return;
    }
    form.save(event, prepare);
  };

  return (
    <div className="space-y-5">
      {/* ================= 1. SECTION HEADER ================= */}
      <SectionHeader
        title="Persyaratan Dokumen Pengajuan"
        description="Kelola ketentuan berkas wajib dan opsional per tahap pengajuan akademik."
        onAdd={kp && eligible.length ? openCreate : undefined}
        addLabel="Tambah Persyaratan KP"
        onRefresh={list.refresh}
        refreshing={list.refreshing}
        badgeCount={list.pagination?.total_items ?? list.data.length}
        kicker="PERSYARATAN BERKAS"
      />

      {(periods.error || stages.error || documents.error) && (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800">
          Pilihan master referensi (periode/tahap/dokumen) belum dapat dimuat lengkap. Segarkan halaman jika ingin menambahkan data baru.
        </div>
      )}

      {/* ================= 2. TOOLBAR FILTER (Mengikuti MahasiswaToolbar) ================= */}
      <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-3.5 relative z-20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Sisi Kiri: Filter Dropdowns */}
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

            {/* Filter Dropdown Jalur Topik */}
            <SettingsDropdownFilter
              value={filters.pilihan_topik}
              onChange={(val) => filter('pilihan_topik', val)}
              icon={IconFunnel}
              placeholder="Semua Jalur Topik"
              minWidth="w-full sm:w-40"
              options={[
                { value: '', label: 'Semua Jalur Topik' },
                { value: 'BARU', label: 'Jalur Baru' },
                { value: 'LANJUT', label: 'Jalur Lanjut' },
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
                title="Reset semua filter persyaratan"
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
              {list.pagination?.total_items ?? list.data.length} persyaratan
            </strong>
            {hasActiveFilters && (
              <span className="text-slate-500 ml-1">
                (difilter)
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted">Filter aktif:</span>
              {filters.periode && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-soft text-brand font-medium">
                  Periode: {periods.data.find((p) => p.id === filters.periode)?.tahun_ajaran || 'Terpilih'}
                </span>
              )}
              {filters.tahap && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-soft text-brand font-medium">
                  Tahap: {stages.data.find((s) => s.id === filters.tahap)?.kode_tahap || 'Terpilih'}
                </span>
              )}
              {filters.pilihan_topik && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-soft text-brand font-medium">
                  Topik: {filters.pilihan_topik === 'BARU' ? 'Jalur Baru' : 'Jalur Lanjut'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================= 4. FEEDBACK STATES ================= */}
      <ListState
        loading={list.loading}
        error={list.error}
        empty={!list.data.length}
        emptyTitle="Tidak Ada Persyaratan Pengajuan"
        emptyMessage="Belum ada data persyaratan yang sesuai dengan filter yang dipilih."
        onRetry={list.refresh}
      />

      {/* ================= 5. TABEL DAFTAR PERSYARATAN ================= */}
      {!list.loading && !list.error && list.data.length > 0 && (
        <div className="overflow-hidden rounded-[20px] border border-slate-900/[0.08] bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/[0.06] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="py-3.5 pl-6 pr-3">Dokumen & Keharusan</th>
                  <th className="py-3.5 px-3">Target Pengajuan</th>
                  <th className="py-3.5 px-3">Urutan</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Petunjuk Pengunggahan</th>
                  <th className="py-3.5 pl-3 pr-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.06] text-xs">
                {list.data.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/70 transition-colors duration-150"
                  >
                    {/* 1. Dokumen & Keharusan */}
                    <td className="py-3.5 pl-6 pr-3 align-middle">
                      <div className="font-semibold text-xs sm:text-sm text-ink">
                        {row.jenis_dokumen?.nama_jenis || `Dokumen #${row.jenis_dokumen_id}`}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <AcademicStatusBadge status={row.is_wajib ? 'WAJIB' : 'OPSIONAL'} size="sm" />
                        {row.jenis_dokumen?.kode_jenis && (
                          <span className="font-mono text-[10px] text-muted">
                            ({row.jenis_dokumen.kode_jenis})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. Target Pengajuan */}
                    <td className="py-3.5 px-3 align-middle whitespace-nowrap text-secondary">
                      <div className="text-xs font-medium text-slate-800">
                        {periodName(row.periode_akademik_id)}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {stageCode(row.tahap_akademik_id)} • {row.jenis_pengajuan} / {row.pilihan_topik}
                      </div>
                    </td>

                    {/* 3. Urutan Form */}
                    <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                      <span className="text-xs font-semibold text-slate-700">
                        #{row.urutan_tampil}
                      </span>
                    </td>

                    {/* 4. Status */}
                    <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                      <AcademicStatusBadge status={row.is_aktif} />
                    </td>

                    {/* 5. Petunjuk Pengunggahan */}
                    <td className="py-3.5 px-3 align-middle text-secondary max-w-[220px]">
                      {row.petunjuk ? (
                        <span className="text-[11px] text-muted truncate block" title={row.petunjuk}>
                          {row.petunjuk}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* 6. Aksi */}
                    <td className="py-3.5 pl-3 pr-6 align-middle text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => edit(row)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-brand hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Ubah petunjuk atau urutan tampil"
                      >
                        <IconEdit className="size-3.5 text-slate-500" />
                        <span>Ubah</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line px-6">
            <Pager pagination={list.pagination}
              onPage={(page) => setFilters((current) => ({ ...current, page }))}
              unit="persyaratan" />
          </div>
        </div>
      )}

      {/* ================= 7. FORM MODAL CREATE / EDIT ================= */}
      <FormDialog
        title={form.editor?.id ? 'Ubah Persyaratan Dokumen' : 'Tambah Persyaratan Dokumen KP'}
        subtitle={
          form.editor?.id
            ? `Sesuaikan petunjuk pengunggahan dan nomor urut tampil untuk ${form.editor.values.documentName || 'dokumen persyaratan'}.`
            : 'Petakan dokumen baru ke periode semester dan tahap Kerja Praktik prodi.'
        }
        open={Boolean(form.editor)}
        onClose={form.close}
        onSubmit={handleSave}
        busy={form.busy}
        error={form.error}
        submitLabel={form.editor?.id ? 'Simpan Perubahan' : 'Daftarkan Persyaratan'}
      >
        {form.editor && (
          <div className="space-y-4">
            {/* Callout Info Ketentuan Persyaratan */}
            <div className="rounded-[14px] border border-blue-200/80 bg-blue-50/70 p-3.5 flex items-start gap-3 text-xs leading-relaxed text-blue-900">
              <IconInformationCircle className="size-4.5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-brand">
                  {form.editor.id === null ? 'Ketentuan Pemetaan Persyaratan KP' : 'Ubah Pengaturan Berkas Persyaratan'}
                </p>
                <p className="text-slate-600 mt-0.5">
                  {form.editor.id === null
                    ? 'Konfigurasi ini menetapkan berkas persyaratan untuk Tahap Kerja Praktik (KP) pada jalur Pengajuan Reguler (Jalur Baru). Status keharusan (Wajib atau Opsional) ditentukan otomatis dari ketentuan resmi master jenis dokumen.'
                    : 'Anda dapat memperbarui urutan posisi tampil berkas pada halaman mahasiswa dan menambahkan petunjuk pengunggahan spesifik untuk berkas ini.'}
                </p>
              </div>
            </div>

            {/* Bagian 1: Pemetaan Dokumen / Dokumen Terpilih */}
            {form.editor.id === null ? (
              <div className="space-y-3 pt-1">
                <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    1. Pemetaan Dokumen & Periode Akademik
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
                    helperText="Pilih semester akademik pelaksanaan."
                  >
                    <option value="">Pilih Periode Akademik</option>
                    {periods.data.map((row) => (
                      <option key={row.id} value={row.id}>
                        Semester {row.semester} {row.tahun_ajaran} ({row.status_periode})
                      </option>
                    ))}
                  </Field>

                  <Field
                    label="Jenis Dokumen yang Disyaratkan"
                    name="jenis_dokumen_id"
                    value={form.editor.values.jenis_dokumen_id}
                    onChange={form.change}
                    required
                    helperText="Pilih jenis dokumen KP yang disyaratkan."
                  >
                    <option value="">Pilih Dokumen</option>
                    {eligible.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.nama_jenis} ({requiredCodes.has(row.kode_jenis) ? 'Wajib' : 'Opsional'})
                      </option>
                    ))}
                  </Field>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    1. Dokumen Persyaratan Terpilih
                  </h3>
                </div>

                <div className="rounded-xl border border-slate-900/[0.08] bg-slate-50/70 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                      <IconDocumentText className="size-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-ink block">
                        {form.editor.values.documentName || 'Dokumen Persyaratan'}
                      </span>
                      <span className="text-[11px] text-muted block mt-0.5">
                        Tahap Kerja Praktik (KP) • Pengajuan Reguler
                      </span>
                    </div>
                  </div>
                  <AcademicStatusBadge status={form.editor.values.isWajib ? 'WAJIB' : 'OPSIONAL'} size="sm" />
                </div>
              </div>
            )}

            {/* Bagian 2: Urutan Tampil & Petunjuk Pengunggahan */}
            <div className="space-y-3 pt-1">
              <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  2. Urutan & Petunjuk Pengunggahan
                </h3>
              </div>

              <Field
                label="Urutan Posisi pada Formulir Mahasiswa"
                name="urutan_tampil"
                type="number"
                min={1}
                max={100}
                value={form.editor.values.urutan_tampil}
                onChange={form.change}
                required
                helperText="Nomor urut posisi berkas ini muncul di formulir mahasiswa (contoh: 1, 2, 3, dst.)."
              />

              <div className="space-y-1">
                <label
                  htmlFor="petunjuk"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Petunjuk Khusus Pengunggahan Mahasiswa
                </label>
                <textarea
                  id="petunjuk"
                  name="petunjuk"
                  value={form.editor.values.petunjuk}
                  onChange={form.change}
                  maxLength={2000}
                  rows={3}
                  placeholder="Tuliskan petunjuk khusus, format berkas, atau catatan yang akan dibaca mahasiswa saat mengunggah berkas ini…"
                  className={`${inputClass} resize-none`}
                />
                <div className="flex items-center justify-between text-[11px] text-muted pt-0.5">
                  <span>Opsional. Ditampilkan sebagai petunjuk di bawah kolom unggah mahasiswa.</span>
                  <span>{(form.editor.values.petunjuk || '').length}/2000</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </FormDialog>
    </div>
  );
}
