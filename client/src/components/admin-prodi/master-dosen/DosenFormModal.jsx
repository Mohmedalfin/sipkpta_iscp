import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconClose,
  IconExclamationCircle,
  IconInformationCircle,
  IconLockClosed,
  IconSpinner,
} from '../../common/Icons.jsx';
import boxIcon from '../../../assets/NoBackground Box.svg';
import { useFocusTrap } from '../../../hooks/useFocusTrap.js';
import {
  createDosen,
  updateDosen,
  dosenErrorMessage,
} from '../../../services/masterDosen.js';
import { useToast } from '../../../context/ToastContext.jsx';

/**
 * Format string tanggal dari format ISO atau objek Date menjadi YYYY-MM-DD
 * untuk kompatibilitas dengan input type="date".
 */
function toDateInputValue(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '';
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

const JABATAN_RECOMMENDATIONS = [
  'Tenaga Pengajar',
  'Asisten Ahli',
  'Lektor',
  'Lektor Kepala',
  'Guru Besar / Profesor',
];

export default function DosenFormModal({
  open,
  mode = 'create', // 'create' | 'edit'
  initialData = null,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const modalRef = useRef(null);
  const isCreate = mode === 'create';

  // Form Field States
  const [formData, setFormData] = useState({
    kode_dosen: '',
    nidn: '',
    nama_lengkap: '',
    email: '',
    tanggal_lahir: '',
    no_telepon: '',
    jabatan_fungsional: '',
    is_homebase_si: true,
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Callback stabil untuk menutup modal saat tombol Escape ditekan
  const handleEscapeClose = useCallback(() => {
    if (!submitting) onClose();
  }, [submitting, onClose]);

  // Hook Focus Trap untuk aksesibilitas modal (menjaga fokus & tombol Escape)
  useFocusTrap(modalRef, open, handleEscapeClose);

  // Sinkronisasi data saat modal terbuka atau data target berubah
  useEffect(() => {
    if (!open) return;

    setServerError('');
    setFieldErrors({});

    if (isCreate || !initialData) {
      setFormData({
        kode_dosen: '',
        nidn: '',
        nama_lengkap: '',
        email: '',
        tanggal_lahir: '',
        no_telepon: '',
        jabatan_fungsional: 'Tenaga Pengajar',
        is_homebase_si: true,
      });
    } else {
      setFormData({
        kode_dosen: initialData.kode_dosen || '',
        nidn: initialData.nidn || '',
        nama_lengkap: initialData.nama_lengkap || '',
        email: initialData.email || '',
        tanggal_lahir: toDateInputValue(initialData.tanggal_lahir),
        no_telepon: initialData.no_telepon || '',
        jabatan_fungsional: initialData.jabatan_fungsional || '',
        is_homebase_si: Boolean(initialData.is_homebase_si),
      });
    }
  }, [open, isCreate, initialData]);

  if (!open) return null;

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({ ...prev, [name]: val }));

    // Hapus error inline field jika user mulai memperbaiki
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (serverError) setServerError('');
  };

  // Validasi Sisi Klien
  const validateForm = () => {
    const errors = {};

    if (isCreate) {
      if (!formData.kode_dosen || !formData.kode_dosen.trim()) {
        errors.kode_dosen = 'Kode Dosen wajib diisi.';
      } else if (!/^[A-Za-z0-9._-]{3,25}$/.test(formData.kode_dosen.trim())) {
        errors.kode_dosen = 'Kode Dosen harus 3-25 karakter (huruf, angka, titik, strip, underscore).';
      }
    }

    if (formData.nidn && formData.nidn.trim()) {
      if (!/^\d{1,20}$/.test(formData.nidn.trim())) {
        errors.nidn = 'NIDN harus berupa 1-20 digit angka.';
      }
    }

    if (!formData.nama_lengkap || !formData.nama_lengkap.trim()) {
      errors.nama_lengkap = 'Nama lengkap wajib diisi.';
    } else if (formData.nama_lengkap.trim().length > 150) {
      errors.nama_lengkap = 'Nama lengkap maksimal 150 karakter.';
    }

    if (!formData.email || !formData.email.trim()) {
      errors.email = 'Alamat email wajib diisi.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Format alamat email tidak valid.';
    } else if (formData.email.trim().length > 254) {
      errors.email = 'Email terlalu panjang (maksimal 254 karakter).';
    }

    if (!formData.tanggal_lahir) {
      errors.tanggal_lahir = 'Tanggal lahir wajib diisi.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.tanggal_lahir)) {
      errors.tanggal_lahir = 'Format tanggal lahir tidak valid (YYYY-MM-DD).';
    }

    if (formData.no_telepon && formData.no_telepon.trim().length > 20) {
      errors.no_telepon = 'Nomor telepon maksimal 20 karakter.';
    }

    if (formData.jabatan_fungsional && formData.jabatan_fungsional.trim().length > 100) {
      errors.jabatan_fungsional = 'Jabatan fungsional maksimal 100 karakter.';
    }

    return errors;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstField = Object.keys(errors)[0];
      const el = modalRef.current?.querySelector(`[name="${firstField}"]`);
      if (el) el.focus();
      return;
    }

    setSubmitting(true);
    setServerError('');

    try {
      const profilePayload = {
        nama_lengkap: formData.nama_lengkap.trim(),
        email: formData.email.trim().toLowerCase(),
        tanggal_lahir: formData.tanggal_lahir,
        nidn: formData.nidn?.trim() || null,
        no_telepon: formData.no_telepon?.trim() || null,
        jabatan_fungsional: formData.jabatan_fungsional?.trim() || null,
        is_homebase_si: Boolean(formData.is_homebase_si),
      };

      if (isCreate) {
        // Kontrak POST /api/master/dosen
        const payload = {
          kode_dosen: formData.kode_dosen.trim(),
          program_studi_id: 1, // Sistem Informasi (sesuai scope authorizedProdi)
          ...profilePayload,
        };

        const result = await createDosen(payload);
        toast.success(`Dosen baru ${result.nama_lengkap} (${result.kode_dosen}) berhasil didaftarkan!`);
        if (onSuccess) onSuccess(result);
        onClose();
      } else {
        // Kontrak PATCH /api/master/dosen/:id (kode_dosen dan program_studi_id tidak boleh disertakan)
        const result = await updateDosen(initialData.id, profilePayload);
        toast.success(`Profil dosen ${result.nama_lengkap} berhasil diperbarui.`);
        if (onSuccess) onSuccess(result);
        onClose();
      }
    } catch (err) {
      const msg = dosenErrorMessage(err, 'Gagal menyimpan data dosen.');
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs animate-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dosen-form-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[92vh] rounded-[22px] border border-slate-900/[0.12] bg-white flex flex-col overflow-hidden shadow-2xl text-ink"
      >
        {/* ================= 1. HEADER MODAL ================= */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-white/80 border-b border-slate-900/[0.08] shrink-0">
          <div className="flex items-center gap-3.5">
            <img
              src={boxIcon}
              alt=""
              className="size-11 sm:size-12 shrink-0 select-none pointer-events-none object-contain"
              aria-hidden="true"
            />
            <div>
              <h2
                id="dosen-form-modal-title"
                className="text-base sm:text-lg font-bold text-ink leading-snug"
              >
                {isCreate ? 'Tambah Dosen Baru' : 'Edit Data Dosen'}
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                {isCreate
                  ? 'Daftarkan data dosen dan buatkan akun login otomatis'
                  : `Perbarui profil akademik dosen: ${initialData?.nama_lengkap || ''}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            title="Tutup formulir (Esc)"
            aria-label="Tutup formulir"
          >
            <IconClose className="size-4.5" />
          </button>
        </div>

        {/* ================= 2. FORMULIR (SCROLLABLE BODY) ================= */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Banner Galat Server */}
          {serverError && (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50/80 p-3.5 flex items-start gap-3 text-xs text-rose-800">
              <IconExclamationCircle className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Penyimpanan Dosen Gagal</p>
                <p className="mt-0.5">{serverError}</p>
              </div>
            </div>
          )}

          {/* Banner Informasi Akun untuk Tambah Baru */}
          {isCreate && (
            <div className="rounded-[14px] border border-blue-200 bg-blue-50/70 p-3.5 flex items-start gap-3 text-xs text-blue-900">
              <IconInformationCircle className="size-4.5 text-brand shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <p className="font-semibold">Informasi Pembuatan Akun Otomatis</p>
                <p className="mt-0.5 text-blue-900/90">
                  Sistem akan membuat akun login aktif dengan <strong>Login ID</strong> menggunakan <em>Kode Dosen</em> dan kata sandi awal berbasis <em>Tanggal Lahir</em> berformat <code className="font-mono font-bold text-blue-950">DDMMYYYY</code> (contoh: lahir 14 Mei 1982 → sandi: <code className="font-mono font-bold text-blue-950">14051982</code>).
                </p>
              </div>
            </div>
          )}

          {/* BAGIAN 1: Identitas Akademik & Login */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-900/[0.06]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                1. Identitas Akademik & Akun Login
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field: Kode Dosen */}
              <div>
                <label
                  htmlFor="dosen-kode"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Kode Dosen (Login ID) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="dosen-kode"
                    name="kode_dosen"
                    type="text"
                    disabled={!isCreate}
                    value={formData.kode_dosen}
                    onChange={handleChange}
                    placeholder="Contoh: DSN001 / ANDI"
                    className={`w-full rounded-xl border px-3 py-2 text-xs font-mono transition-colors focus:outline-none ${
                      !isCreate
                        ? 'border-slate-900/[0.08] bg-slate-100 text-slate-500 cursor-not-allowed pr-8'
                        : fieldErrors.kode_dosen
                        ? 'border-rose-400 bg-rose-50/30 text-ink focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                        : 'border-slate-900/[0.12] bg-white text-ink focus:border-brand focus:ring-2 focus:ring-brand/20'
                    }`}
                  />
                  {!isCreate && (
                    <IconLockClosed
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
                      title="Kode Dosen tidak dapat diubah setelah terdaftar"
                    />
                  )}
                </div>
                {fieldErrors.kode_dosen && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    {fieldErrors.kode_dosen}
                  </p>
                )}
                {!isCreate && (
                  <p className="mt-1 text-[10px] text-muted">
                    Kode Dosen terkunci karena berfungsi sebagai Login ID sistem.
                  </p>
                )}
              </div>

              {/* Field: NIDN */}
              <div>
                <label
                  htmlFor="dosen-nidn"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  NIDN <span className="text-muted font-normal text-[11px]">(Opsional)</span>
                </label>
                <input
                  id="dosen-nidn"
                  name="nidn"
                  type="text"
                  value={formData.nidn}
                  onChange={handleChange}
                  placeholder="Contoh: 0014058201"
                  className={`w-full rounded-xl border px-3 py-2 text-xs font-mono transition-colors focus:outline-none ${
                    fieldErrors.nidn
                      ? 'border-rose-400 bg-rose-50/30 text-ink focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] bg-white text-ink focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.nidn && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    {fieldErrors.nidn}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted">
                  Nomor Induk Dosen Nasional (1-20 digit angka).
                </p>
              </div>

              {/* Field: Nama Lengkap */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="dosen-nama"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Lengkap & Gelar <span className="text-rose-500">*</span>
                </label>
                <input
                  id="dosen-nama"
                  name="nama_lengkap"
                  type="text"
                  value={formData.nama_lengkap}
                  onChange={handleChange}
                  placeholder="Contoh: Dr. Eng. Andi Pratama, S.T., M.T."
                  className={`w-full rounded-xl border px-3 py-2 text-xs font-medium transition-colors focus:outline-none ${
                    fieldErrors.nama_lengkap
                      ? 'border-rose-400 bg-rose-50/30 text-ink focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] bg-white text-ink focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.nama_lengkap && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    {fieldErrors.nama_lengkap}
                  </p>
                )}
              </div>

              {/* Field: Email */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="dosen-email"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Alamat Email Resmi <span className="text-rose-500">*</span>
                </label>
                <input
                  id="dosen-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Contoh: dosen.andi@uty.ac.id"
                  className={`w-full rounded-xl border px-3 py-2 text-xs font-mono transition-colors focus:outline-none ${
                    fieldErrors.email
                      ? 'border-rose-400 bg-rose-50/30 text-ink focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] bg-white text-ink focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    {fieldErrors.email}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted">
                  Email digunakan untuk pengiriman notifikasi dan pemulihan akun.
                </p>
              </div>
            </div>
          </div>

          {/* BAGIAN 2: Jabatan & Status Kepegawaian */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-900/[0.06]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                2. Jabatan & Status Homebase
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field: Jabatan Fungsional */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="dosen-jabatan"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Jabatan Fungsional <span className="text-muted font-normal text-[11px]">(Opsional)</span>
                </label>
                <input
                  id="dosen-jabatan"
                  name="jabatan_fungsional"
                  type="text"
                  list="jabatan-dosen-list"
                  value={formData.jabatan_fungsional}
                  onChange={handleChange}
                  placeholder="Pilih atau ketik jabatan fungsional…"
                  className={`w-full rounded-xl border px-3 py-2 text-xs font-medium transition-colors focus:outline-none ${
                    fieldErrors.jabatan_fungsional
                      ? 'border-rose-400 bg-rose-50/30 text-ink focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] bg-white text-ink focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                <datalist id="jabatan-dosen-list">
                  {JABATAN_RECOMMENDATIONS.map((jab) => (
                    <option key={jab} value={jab} />
                  ))}
                </datalist>
                {fieldErrors.jabatan_fungsional && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    {fieldErrors.jabatan_fungsional}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted">
                  Contoh: Tenaga Pengajar, Asisten Ahli, Lektor, Lektor Kepala, Guru Besar.
                </p>
              </div>

              {/* Field: Homebase SI Switch Card */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="dosen-homebase"
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    formData.is_homebase_si
                      ? 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50/70'
                      : 'border-slate-900/[0.08] bg-slate-50/60 hover:bg-slate-100/60'
                  }`}
                >
                  <input
                    id="dosen-homebase"
                    name="is_homebase_si"
                    type="checkbox"
                    checked={formData.is_homebase_si}
                    onChange={handleChange}
                    className="size-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">
                        Dosen Homebase Program Studi Sistem Informasi
                      </span>
                      {formData.is_homebase_si && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          Homebase SI
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-secondary mt-0.5 leading-snug">
                      Tandai jika dosen merupakan tenaga pengajar tetap di Program Studi Sistem Informasi. Kosongkan bila berstatus dosen prodi lain atau dosen mitra eksternal.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* BAGIAN 3: Biodata & Kontak */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-900/[0.06]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                3. Biodata & Kontak
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field: Tanggal Lahir */}
              <div>
                <label
                  htmlFor="dosen-lahir"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Tanggal Lahir <span className="text-rose-500">*</span>
                </label>
                <input
                  id="dosen-lahir"
                  name="tanggal_lahir"
                  type="date"
                  value={formData.tanggal_lahir}
                  onChange={handleChange}
                  className={`w-full rounded-xl border px-3 py-2 text-xs font-medium transition-colors focus:outline-none ${
                    fieldErrors.tanggal_lahir
                      ? 'border-rose-400 bg-rose-50/30 text-ink focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] bg-white text-ink focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.tanggal_lahir && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    {fieldErrors.tanggal_lahir}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted">
                  {isCreate
                    ? 'Menjadi kata sandi awal akun login (format DDMMYYYY).'
                    : 'Format tanggal resmi (YYYY-MM-DD).'}
                </p>
              </div>

              {/* Field: Nomor Telepon */}
              <div>
                <label
                  htmlFor="dosen-telepon"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nomor Telepon / WhatsApp <span className="text-muted font-normal text-[11px]">(Opsional)</span>
                </label>
                <input
                  id="dosen-telepon"
                  name="no_telepon"
                  type="tel"
                  value={formData.no_telepon}
                  onChange={handleChange}
                  placeholder="Contoh: 081234567890"
                  className={`w-full rounded-xl border px-3 py-2 text-xs font-mono transition-colors focus:outline-none ${
                    fieldErrors.no_telepon
                      ? 'border-rose-400 bg-rose-50/30 text-ink focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] bg-white text-ink focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.no_telepon && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    {fieldErrors.no_telepon}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted">
                  Nomor aktif untuk koordinasi bimbingan dan review.
                </p>
              </div>
            </div>
          </div>
        </form>

        {/* ================= 3. FOOTER MODAL (STICKY ACTIONS) ================= */}
        <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-4 bg-slate-50/80 border-t border-slate-900/[0.08] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <IconSpinner className="size-3.5 text-white" />
                <span>Menyimpan…</span>
              </>
            ) : (
              <span>{isCreate ? 'Daftarkan Dosen' : 'Simpan Perubahan'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

