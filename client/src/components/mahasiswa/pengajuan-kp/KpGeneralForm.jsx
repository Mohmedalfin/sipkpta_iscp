import {
  IconAcademicCap,
  IconBriefcase,
  IconDocumentText,
} from '../../common/Icons.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';

/**
 * Format nama dosen lengkap dengan gelar akademik
 */
function formatDosenName(dosen) {
  if (!dosen) return '-';
  const prefix = dosen.gelar_depan ? `${dosen.gelar_depan} ` : '';
  const suffix = dosen.gelar_belakang ? `, ${dosen.gelar_belakang}` : '';
  const nidn = dosen.nidn ? ` (NIDN: ${dosen.nidn})` : '';
  return `${prefix}${dosen.nama_lengkap || 'Dosen'}${suffix}${nidn}`;
}

/**
 * Komponen Formulir Pengajuan Kerja Praktik (KP) - Versi Bersih & Minimalis
 * Menghilangkan label tambahan yang membingungkan dan menampilkan ikon polos tanpa wadah/container.
 * 
 * @param {object} props
 * @param {object} props.formData - Objek state data formulir
 * @param {Function} props.onChange - Handler perubahan nilai field (name, value)
 * @param {object} props.errors - Objek pesan error validasi per field
 * @param {object|null} props.opsiForm - Data master tema dan dosen dari server
 * @param {boolean} [props.disabled] - Status nonaktif input saat sedang proses submit
 * @param {boolean} [props.readOnly] - Status hanya-baca jika pengajuan sudah dikirim
 */
export default function KpGeneralForm({
  formData,
  onChange,
  errors = {},
  opsiForm = null,
  disabled = false,
  readOnly = false,
}) {
  const temaOptions = Array.isArray(opsiForm?.tema_penelitian) ? opsiForm.tema_penelitian : [];
  const dosenOptions = Array.isArray(opsiForm?.dosen_pembimbing) ? opsiForm.dosen_pembimbing : [];

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    onChange(name, value);
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    onChange(name, value === '' ? '' : value);
  };

  const handleBooleanChange = (name, value) => {
    onChange(name, value);
    if (name === 'memiliki_nilai_de' && value === false) {
      onChange('daftar_mk_nilai_de', '');
    }
  };

  return (
    <div className="space-y-5">
      {/* ============================================================ */}
      {/* SEKSI 1: Tempat & Mitra Kerja Praktik                        */}
      {/* ============================================================ */}
      <section
        aria-labelledby="section-mitra-heading"
        className="rounded-xl border border-line bg-white p-5 shadow-2xs"
      >
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <IconBriefcase className="size-5 text-brand" />
          <h3 id="section-mitra-heading" className="text-sm font-bold text-ink sm:text-base">
            1. Tempat & Mitra Kerja Praktik
          </h3>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Objek Penelitian / Instansi */}
          <div className="sm:col-span-2">
            <label
              htmlFor="objek_penelitian"
              className="block text-xs font-semibold text-ink sm:text-sm"
            >
              Instansi & Objek KP <span className="text-danger">*</span>
            </label>
            <input
              id="objek_penelitian"
              name="objek_penelitian"
              type="text"
              required
              disabled={disabled || readOnly}
              value={formData.objek_penelitian || ''}
              onChange={handleTextChange}
              placeholder="Contoh: PT Telekomunikasi Indonesia - Divisi Digital Service"
              className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-ink placeholder:text-muted transition focus:outline-hidden ${
                errors.objek_penelitian
                  ? 'border-danger focus:ring-2 focus:ring-danger/20'
                  : 'border-line focus:border-brand focus:ring-2 focus:ring-brand/20'
              } ${disabled || readOnly ? 'bg-subtle text-secondary' : 'bg-white'}`}
            />
            {errors.objek_penelitian && (
              <p className="mt-1 text-xs font-medium text-danger">
                {errors.objek_penelitian}
              </p>
            )}
          </div>

          {/* Lokasi / Kota */}
          <div className="sm:col-span-2">
            <label
              htmlFor="lokasi_penelitian"
              className="block text-xs font-semibold text-ink sm:text-sm"
            >
              Lokasi / Kota Pelaksanaan <span className="text-danger">*</span>
            </label>
            <input
              id="lokasi_penelitian"
              name="lokasi_penelitian"
              type="text"
              required
              disabled={disabled || readOnly}
              value={formData.lokasi_penelitian || ''}
              onChange={handleTextChange}
              placeholder="Contoh: Kota Yogyakarta"
              className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-ink placeholder:text-muted transition focus:outline-hidden ${
                errors.lokasi_penelitian
                  ? 'border-danger focus:ring-2 focus:ring-danger/20'
                  : 'border-line focus:border-brand focus:ring-2 focus:ring-brand/20'
              } ${disabled || readOnly ? 'bg-subtle text-secondary' : 'bg-white'}`}
            />
            {errors.lokasi_penelitian && (
              <p className="mt-1 text-xs font-medium text-danger">
                {errors.lokasi_penelitian}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SEKSI 2: Topik & Usulan Pembimbing                           */}
      {/* ============================================================ */}
      <section
        aria-labelledby="section-topik-heading"
        className="rounded-xl border border-line bg-white p-5 shadow-2xs"
      >
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <IconDocumentText className="size-5 text-brand" />
          <h3 id="section-topik-heading" className="text-sm font-bold text-ink sm:text-base">
            2. Topik & Usulan Dosen Pembimbing
          </h3>
        </div>

        <div className="mt-4 space-y-4">
          {/* Tema Penelitian */}
          <div>
            <label
              htmlFor="tema_penelitian_id"
              className="block text-xs font-semibold text-ink sm:text-sm mb-1.5"
            >
              Tema Penelitian <span className="text-danger">*</span>
            </label>
            <CustomSelect
              id="tema_penelitian_id"
              value={formData.tema_penelitian_id || ''}
              options={temaOptions.map((tema) => ({
                value: tema.id,
                label: tema.nama_tema,
              }))}
              onChange={(val) => onChange('tema_penelitian_id', val ? Number(val) : '')}
              placeholder="Pilih Tema Penelitian"
              disabled={disabled || readOnly}
              hasError={Boolean(errors.tema_penelitian_id)}
            />
            {errors.tema_penelitian_id && (
              <p className="mt-1 text-xs font-medium text-danger">
                {errors.tema_penelitian_id}
              </p>
            )}
          </div>

          {/* Usulan Judul KP */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="judul_penelitian"
                className="block text-xs font-semibold text-ink sm:text-sm"
              >
                Usulan Judul KP <span className="text-danger">*</span>
              </label>
              <span className="text-[11px] text-muted">
                {(formData.judul_penelitian || '').length} karakter
              </span>
            </div>
            <textarea
              id="judul_penelitian"
              name="judul_penelitian"
              rows={3}
              required
              disabled={disabled || readOnly}
              value={formData.judul_penelitian || ''}
              onChange={handleTextChange}
              placeholder="Contoh: Rancang Bangun Sistem Informasi Pengelolaan Presensi Pegawai Berbasis Web pada Dinas Kominfo DIY"
              className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-ink placeholder:text-muted transition focus:outline-hidden ${
                errors.judul_penelitian
                  ? 'border-danger focus:ring-2 focus:ring-danger/20'
                  : 'border-line focus:border-brand focus:ring-2 focus:ring-brand/20'
              } ${disabled || readOnly ? 'bg-subtle text-secondary' : 'bg-white'}`}
            />
            {errors.judul_penelitian && (
              <p className="mt-1 text-xs font-medium text-danger">
                {errors.judul_penelitian}
              </p>
            )}
          </div>

          {/* Usulan Dosen Pembimbing */}
          <div>
            <label
              htmlFor="usulan_pembimbing_id"
              className="block text-xs font-semibold text-ink sm:text-sm mb-1.5"
            >
              Usulan Dosen Pembimbing <span className="text-danger">*</span>
            </label>
            <CustomSelect
              id="usulan_pembimbing_id"
              value={formData.usulan_pembimbing_id || ''}
              options={dosenOptions.map((dosen) => ({
                value: dosen.id,
                label: formatDosenName(dosen),
                subtitle: dosen.nidn ? `NIDN: ${dosen.nidn}` : undefined,
              }))}
              onChange={(val) => onChange('usulan_pembimbing_id', val ? Number(val) : '')}
              placeholder="Pilih Usulan Dosen Pembimbing"
              disabled={disabled || readOnly}
              hasError={Boolean(errors.usulan_pembimbing_id)}
              searchable={true}
            />
            {errors.usulan_pembimbing_id && (
              <p className="mt-1 text-xs font-medium text-danger">
                {errors.usulan_pembimbing_id}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SEKSI 3: Kelayakan Akademik                                  */}
      {/* ============================================================ */}
      <section
        aria-labelledby="section-akademik-heading"
        className="rounded-xl border border-line bg-white p-5 shadow-2xs"
      >
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <IconAcademicCap className="size-5 text-brand" />
          <h3 id="section-akademik-heading" className="text-sm font-bold text-ink sm:text-base">
            3. Data Kelayakan Akademik
          </h3>
        </div>

        <div className="mt-4 space-y-4">
          {/* Grid IPK & SKS */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* IPK Kumulatif */}
            <div>
              <label
                htmlFor="ipk_saat_pengajuan"
                className="block text-xs font-semibold text-ink sm:text-sm"
              >
                IPK Terakhir <span className="text-danger">*</span>
              </label>
              <input
                id="ipk_saat_pengajuan"
                name="ipk_saat_pengajuan"
                type="number"
                step="0.01"
                min="0"
                max="4"
                required
                disabled={disabled || readOnly}
                value={formData.ipk_saat_pengajuan ?? ''}
                onChange={handleNumberChange}
                placeholder="Contoh: 3.45"
                className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-ink placeholder:text-muted transition focus:outline-hidden ${
                  errors.ipk_saat_pengajuan
                    ? 'border-danger focus:ring-2 focus:ring-danger/20'
                    : 'border-line focus:border-brand focus:ring-2 focus:ring-brand/20'
                } ${disabled || readOnly ? 'bg-subtle text-secondary' : 'bg-white'}`}
              />
              {errors.ipk_saat_pengajuan && (
                <p className="mt-1 text-xs font-medium text-danger">
                  {errors.ipk_saat_pengajuan}
                </p>
              )}
            </div>

            {/* Jumlah SKS */}
            <div>
              <label
                htmlFor="jumlah_sks_saat_pengajuan"
                className="block text-xs font-semibold text-ink sm:text-sm"
              >
                Total SKS Lulus <span className="text-danger">*</span>
              </label>
              <input
                id="jumlah_sks_saat_pengajuan"
                name="jumlah_sks_saat_pengajuan"
                type="number"
                step="1"
                min="0"
                max="200"
                required
                disabled={disabled || readOnly}
                value={formData.jumlah_sks_saat_pengajuan ?? ''}
                onChange={handleNumberChange}
                placeholder="Contoh: 90"
                className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-ink placeholder:text-muted transition focus:outline-hidden ${
                  errors.jumlah_sks_saat_pengajuan
                    ? 'border-danger focus:ring-2 focus:ring-danger/20'
                    : 'border-line focus:border-brand focus:ring-2 focus:ring-brand/20'
                } ${disabled || readOnly ? 'bg-subtle text-secondary' : 'bg-white'}`}
              />
              {errors.jumlah_sks_saat_pengajuan && (
                <p className="mt-1 text-xs font-medium text-danger">
                  {errors.jumlah_sks_saat_pengajuan}
                </p>
              )}
            </div>
          </div>

          {/* Konfirmasi Nilai D / E */}
          <div className="pt-1">
            <label className="block text-xs font-semibold text-ink sm:text-sm">
              Apakah memiliki Mata Kuliah dengan Nilai D atau E? <span className="text-danger">*</span>
            </label>

            <div className="mt-2 flex items-center gap-5">
              <label className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm text-ink">
                <input
                  type="radio"
                  name="memiliki_nilai_de"
                  disabled={disabled || readOnly}
                  checked={formData.memiliki_nilai_de === false}
                  onChange={() => handleBooleanChange('memiliki_nilai_de', false)}
                  className="size-4 text-brand focus:ring-brand"
                />
                <span>Tidak ada</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm text-ink">
                <input
                  type="radio"
                  name="memiliki_nilai_de"
                  disabled={disabled || readOnly}
                  checked={formData.memiliki_nilai_de === true}
                  onChange={() => handleBooleanChange('memiliki_nilai_de', true)}
                  className="size-4 text-brand focus:ring-brand"
                />
                <span>Ya, ada</span>
              </label>
            </div>

            {errors.memiliki_nilai_de && (
              <p className="mt-1 text-xs font-medium text-danger">
                {errors.memiliki_nilai_de}
              </p>
            )}

            {formData.memiliki_nilai_de === true && (
              <div className="mt-3">
                <input
                  id="daftar_mk_nilai_de"
                  name="daftar_mk_nilai_de"
                  type="text"
                  required
                  disabled={disabled || readOnly}
                  value={formData.daftar_mk_nilai_de || ''}
                  onChange={handleTextChange}
                  placeholder="Sebutkan mata kuliah dan nilainya (Contoh: Basis Data: D, PBO: E)"
                  className={`w-full rounded-lg border px-3 py-2 text-xs sm:text-sm text-ink placeholder:text-muted transition focus:outline-hidden ${
                    errors.daftar_mk_nilai_de
                      ? 'border-danger focus:ring-2 focus:ring-danger/20'
                      : 'border-line focus:border-brand focus:ring-2 focus:ring-brand/20'
                  } ${disabled || readOnly ? 'bg-subtle text-secondary' : 'bg-white'}`}
                />
                {errors.daftar_mk_nilai_de && (
                  <p className="mt-1 text-xs font-medium text-danger">
                    {errors.daftar_mk_nilai_de}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Konfirmasi SPP Variabel */}
          <div className="border-t border-line/60 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label className="block text-xs font-semibold text-ink sm:text-sm">
                Sudah Membayar SPP Variabel Semester Ini? <span className="text-danger">*</span>
              </label>
              <span className="text-[11px] text-muted">
                (Wajib upload bukti jika memilih Sudah)
              </span>
            </div>

            <div className="mt-2 flex items-center gap-5">
              <label className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm text-ink">
                <input
                  type="radio"
                  name="sudah_bayar_spp_variabel"
                  disabled={disabled || readOnly}
                  checked={formData.sudah_bayar_spp_variabel === false}
                  onChange={() => handleBooleanChange('sudah_bayar_spp_variabel', false)}
                  className="size-4 text-brand focus:ring-brand"
                />
                <span>Belum / Tidak</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm text-ink">
                <input
                  type="radio"
                  name="sudah_bayar_spp_variabel"
                  disabled={disabled || readOnly}
                  checked={formData.sudah_bayar_spp_variabel === true}
                  onChange={() => handleBooleanChange('sudah_bayar_spp_variabel', true)}
                  className="size-4 text-brand focus:ring-brand"
                />
                <span>Sudah Bayar</span>
              </label>
            </div>

            {errors.sudah_bayar_spp_variabel && (
              <p className="mt-1 text-xs font-medium text-danger">
                {errors.sudah_bayar_spp_variabel}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
