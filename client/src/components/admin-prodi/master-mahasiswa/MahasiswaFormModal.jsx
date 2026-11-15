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
  createMahasiswa,
  updateMahasiswa,
  mahasiswaErrorMessage,
} from '../../../services/masterMahasiswa.js';
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

export default function MahasiswaFormModal({
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
    nim: '',
    nama_lengkap: '',
    email: '',
    tanggal_lahir: '',
    nik_kependudukan: '',
    tempat_lahir: '',
    no_telepon: '',
    alamat: '',
    tahun_angkatan: '',
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

  // Sinkronisasi data saat modal terbuka
  useEffect(() => {
    if (!open) return;

    setServerError('');
    setFieldErrors({});

    if (isCreate || !initialData) {
      setFormData({
        nim: '',
        nama_lengkap: '',
        email: '',
        tanggal_lahir: '',
        nik_kependudukan: '',
        tempat_lahir: '',
        no_telepon: '',
        alamat: '',
        tahun_angkatan: new Date().getFullYear().toString(),
      });
    } else {
      setFormData({
        nim: initialData.nim || '',
        nama_lengkap: initialData.nama_lengkap || '',
        email: initialData.email || '',
        tanggal_lahir: toDateInputValue(initialData.tanggal_lahir),
        nik_kependudukan: initialData.nik_kependudukan || '',
        tempat_lahir: initialData.tempat_lahir || '',
        no_telepon: initialData.no_telepon || '',
        alamat: initialData.alamat || '',
        tahun_angkatan: initialData.tahun_angkatan ? initialData.tahun_angkatan.toString() : '',
      });
    }
  }, [open, isCreate, initialData]);

  if (!open) return null;

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

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
    const currentYear = new Date().getUTCFullYear();

    if (isCreate) {
      if (!formData.nim || !formData.nim.trim()) {
        errors.nim = 'NIM wajib diisi.';
      } else if (!/^\d{8,25}$/.test(formData.nim.trim())) {
        errors.nim = 'NIM harus berupa 8-25 digit angka.';
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

    if (formData.nik_kependudukan && formData.nik_kependudukan.trim()) {
      if (!/^\d{16}$/.test(formData.nik_kependudukan.trim())) {
        errors.nik_kependudukan = 'NIK kependudukan harus tepat 16 digit angka.';
      }
    }

    if (formData.tempat_lahir && formData.tempat_lahir.length > 100) {
      errors.tempat_lahir = 'Tempat lahir maksimal 100 karakter.';
    }

    if (formData.no_telepon && formData.no_telepon.length > 20) {
      errors.no_telepon = 'Nomor telepon maksimal 20 karakter.';
    }

    if (formData.alamat && formData.alamat.length > 5000) {
      errors.alamat = 'Alamat maksimal 5000 karakter.';
    }

    if (formData.tahun_angkatan && formData.tahun_angkatan.trim()) {
      const yearNum = Number(formData.tahun_angkatan.trim());
      if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > currentYear + 1) {
        errors.tahun_angkatan = `Tahun angkatan harus antara 1900 dan ${currentYear + 1}.`;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!validateForm()) {
      toast.warning('Mohon periksa kembali isian formulir yang ditandai merah.');
      return;
    }

    setSubmitting(true);
    setServerError('');

    try {
      const profilePayload = {
        nama_lengkap: formData.nama_lengkap.trim(),
        email: formData.email.trim().toLowerCase(),
        tanggal_lahir: formData.tanggal_lahir,
        nik_kependudukan: formData.nik_kependudukan.trim() || null,
        tempat_lahir: formData.tempat_lahir.trim() || null,
        no_telepon: formData.no_telepon.trim() || null,
        alamat: formData.alamat.trim() || null,
        tahun_angkatan: formData.tahun_angkatan.trim() ? Number(formData.tahun_angkatan.trim()) : null,
      };

      if (isCreate) {
        // Kontrak POST /api/master/mahasiswa
        const payload = {
          nim: formData.nim.trim(),
          program_studi_id: 1, // Sistem Informasi (sesuai scope authorizedProdi)
          ...profilePayload,
        };

        const result = await createMahasiswa(payload);
        toast.success(`Mahasiswa baru ${result.nama_lengkap} (${result.nim}) berhasil didaftarkan!`);
        if (onSuccess) onSuccess(result);
        onClose();
      } else {
        // Kontrak PATCH /api/master/mahasiswa/:id (tidak boleh menyertakan nim dan program_studi_id)
        const result = await updateMahasiswa(initialData.id, profilePayload);
        toast.success(`Profil mahasiswa ${result.nama_lengkap} berhasil diperbarui.`);
        if (onSuccess) onSuccess(result);
        onClose();
      }
    } catch (err) {
      const msg = mahasiswaErrorMessage(err, 'Gagal menyimpan data mahasiswa.');
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
      aria-labelledby="mahasiswa-form-modal-title"
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
              <h2 id="mahasiswa-form-modal-title" className="text-base font-bold text-ink leading-tight">
                {isCreate ? 'Tambah Mahasiswa Baru' : 'Edit Profil Mahasiswa'}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {isCreate
                  ? 'Daftarkan identitas mahasiswa dan buat akun pengguna otomatis.'
                  : `Perbarui informasi profil mahasiswa NIM: ${initialData?.nim || '-'}.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
            title="Tutup Formulir (Esc)"
            aria-label="Tutup Formulir"
          >
            <IconClose className="size-4.5" />
          </button>
        </div>

        {/* ================= 2. ISI FORMULIR (SCROLLABLE) ================= */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Callout Info Kata Sandi Awal (Hanya Tampil Saat Tambah Baru) */}
          {isCreate && (
            <div className="rounded-[14px] border border-blue-200/80 bg-blue-50/70 p-3.5 flex items-start gap-3 text-xs leading-relaxed text-blue-900">
              <IconInformationCircle className="size-4.5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-brand">Ketentuan Pembuatan Akun Otomatis</p>
                <p className="text-slate-600 mt-0.5">
                  Akun login mahasiswa akan dibuatkan langsung dengan <em>Login ID</em> berupa <strong>NIM</strong> dan kata sandi awal berbasis <strong>Tanggal Lahir</strong> berformat <code className="font-mono text-slate-800 bg-white/70 px-1 py-0.5 rounded border border-blue-200/60">DDMMYYYY</code> (contoh: lahir 15 Mei 2003 = kata sandi <span className="font-mono font-semibold">15052003</span>).
                </p>
              </div>
            </div>
          )}

          {/* Banner Error Server */}
          {serverError && (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50/80 p-3.5 flex items-start gap-3 text-xs text-rose-800">
              <IconExclamationCircle className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Penyimpanan Data Gagal</p>
                <p className="mt-0.5">{serverError}</p>
              </div>
            </div>
          )}

          {/* Bagian 1: Identitas Akademik & Akun */}
          <div className="space-y-3.5">
            <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                1. Identitas Akademik & Akun
              </h3>
              <span className="text-[11px] text-muted font-normal">
                Tanda bintang (<span className="text-rose-500 font-bold">*</span>) wajib diisi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Field NIM */}
              <div>
                <label htmlFor="field-nim" className="block text-xs font-semibold text-slate-700 mb-1">
                  NIM (Nomor Induk Mahasiswa) <span className="text-rose-500 font-bold">*</span>
                </label>
                {isCreate ? (
                  <input
                    id="field-nim"
                    name="nim"
                    type="text"
                    inputMode="numeric"
                    required
                    autoFocus
                    value={formData.nim}
                    onChange={handleChange}
                    placeholder="Contoh: 1202200001"
                    maxLength={25}
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs text-ink placeholder:text-slate-400 bg-white/90 focus:outline-none transition-all ${
                      fieldErrors.nim
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                        : 'border-slate-900/[0.12] focus:border-brand focus:ring-2 focus:ring-brand/20'
                    }`}
                  />
                ) : (
                  <div className="relative">
                    <input
                      id="field-nim"
                      type="text"
                      disabled
                      value={formData.nim}
                      className="w-full rounded-xl border border-slate-900/[0.08] bg-slate-100/80 px-3.5 py-2 pr-8 text-xs font-mono font-semibold text-slate-500 cursor-not-allowed select-none"
                    />
                    <IconLockClosed className="size-3.5 text-slate-400 absolute right-3 top-2.5" />
                  </div>
                )}
                {fieldErrors.nim ? (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.nim}</p>
                ) : (
                  <p className="text-[10px] text-muted mt-1">
                    {isCreate ? '8-25 digit angka. Menjadi Login ID mahasiswa.' : 'NIM bersifat permanen dan tidak dapat diubah.'}
                  </p>
                )}
              </div>

              {/* Field Program Studi (Read-only prodi Sistem Informasi) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Program Studi
                </label>
                <div className="flex items-center justify-between rounded-xl border border-slate-900/[0.08] bg-slate-100/70 px-3.5 py-2 text-xs text-slate-600">
                  <span className="font-semibold text-ink">Sistem Informasi</span>
                  <span className="text-[10px] bg-white border border-slate-900/[0.08] rounded-md px-1.5 py-0.5 text-slate-500">
                    Prodi Anda
                  </span>
                </div>
                <p className="text-[10px] text-muted mt-1">
                  Otomatis terhubung ke Program Studi Sistem Informasi.
                </p>
              </div>

              {/* Field Nama Lengkap */}
              <div className="sm:col-span-2">
                <label htmlFor="field-nama" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Mahasiswa <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  id="field-nama"
                  name="nama_lengkap"
                  type="text"
                  required
                  autoFocus={!isCreate}
                  value={formData.nama_lengkap}
                  onChange={handleChange}
                  placeholder="Contoh: Muhammad Rafli Pratama"
                  maxLength={150}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs text-ink placeholder:text-slate-400 bg-white/90 focus:outline-none transition-all ${
                    fieldErrors.nama_lengkap
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.nama_lengkap && (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.nama_lengkap}</p>
                )}
              </div>

              {/* Field Email */}
              <div>
                <label htmlFor="field-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Email Akun <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  id="field-email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Contoh: m.rafli@student.ac.id"
                  maxLength={254}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs text-ink placeholder:text-slate-400 bg-white/90 focus:outline-none transition-all ${
                    fieldErrors.email
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.email ? (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p>
                ) : (
                  <p className="text-[10px] text-muted mt-1">
                    Digunakan untuk notifikasi dan pemulihan akun.
                  </p>
                )}
              </div>

              {/* Field Tahun Angkatan */}
              <div>
                <label htmlFor="field-angkatan" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tahun Angkatan
                </label>
                <input
                  id="field-angkatan"
                  name="tahun_angkatan"
                  type="number"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={formData.tahun_angkatan}
                  onChange={handleChange}
                  placeholder="Contoh: 2024"
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs text-ink placeholder:text-slate-400 bg-white/90 focus:outline-none transition-all ${
                    fieldErrors.tahun_angkatan
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.tahun_angkatan ? (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.tahun_angkatan}</p>
                ) : (
                  <p className="text-[10px] text-muted mt-1">
                    Tahun masuk mahasiswa (4 digit angka).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bagian 2: Biodata & Kontak Pribadi */}
          <div className="space-y-3.5 pt-2">
            <div className="border-b border-slate-900/[0.06] pb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                2. Biodata & Kontak Pribadi
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Field Tanggal Lahir */}
              <div>
                <label htmlFor="field-tanggal-lahir" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Lahir <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  id="field-tanggal-lahir"
                  name="tanggal_lahir"
                  type="date"
                  required
                  value={formData.tanggal_lahir}
                  onChange={handleChange}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs text-ink placeholder:text-slate-400 bg-white/90 focus:outline-none transition-all ${
                    fieldErrors.tanggal_lahir
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.tanggal_lahir ? (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.tanggal_lahir}</p>
                ) : (
                  <p className="text-[10px] text-muted mt-1">
                    Format: Hari/Bulan/Tahun (dasar pembuatan sandi awal).
                  </p>
                )}
              </div>

              {/* Field Tempat Lahir */}
              <div>
                <label htmlFor="field-tempat-lahir" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tempat Lahir
                </label>
                <input
                  id="field-tempat-lahir"
                  name="tempat_lahir"
                  type="text"
                  value={formData.tempat_lahir}
                  onChange={handleChange}
                  placeholder="Contoh: Bandung"
                  maxLength={100}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs text-ink placeholder:text-slate-400 bg-white/90 focus:outline-none transition-all ${
                    fieldErrors.tempat_lahir
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.tempat_lahir && (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.tempat_lahir}</p>
                )}
              </div>

              {/* Field NIK Kependudukan */}
              <div>
                <label htmlFor="field-nik" className="block text-xs font-semibold text-slate-700 mb-1">
                  NIK Kependudukan (KTP)
                </label>
                <input
                  id="field-nik"
                  name="nik_kependudukan"
                  type="text"
                  inputMode="numeric"
                  value={formData.nik_kependudukan}
                  onChange={handleChange}
                  placeholder="Contoh: 3201012345670001"
                  maxLength={16}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs text-ink placeholder:text-slate-400 bg-white/90 focus:outline-none transition-all ${
                    fieldErrors.nik_kependudukan
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.nik_kependudukan ? (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.nik_kependudukan}</p>
                ) : (
                  <p className="text-[10px] text-muted mt-1">16 digit nomor NIK (opsional).</p>
                )}
              </div>

              {/* Field Nomor Telepon */}
              <div>
                <label htmlFor="field-telepon" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  id="field-telepon"
                  name="no_telepon"
                  type="tel"
                  value={formData.no_telepon}
                  onChange={handleChange}
                  placeholder="Contoh: 081234567890"
                  maxLength={20}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs text-ink placeholder:text-slate-400 bg-white/90 focus:outline-none transition-all ${
                    fieldErrors.no_telepon
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.no_telepon && (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.no_telepon}</p>
                )}
              </div>

              {/* Field Alamat Lengkap */}
              <div className="sm:col-span-2">
                <label htmlFor="field-alamat" className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Tempat Tinggal / Domisili
                </label>
                <textarea
                  id="field-alamat"
                  name="alamat"
                  rows={2}
                  value={formData.alamat}
                  onChange={handleChange}
                  placeholder="Alamat lengkap mahasiswa (jalan, kelurahan, kecamatan, kota)..."
                  maxLength={5000}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs text-ink placeholder:text-slate-400 bg-white/90 focus:outline-none transition-all resize-none ${
                    fieldErrors.alamat
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-900/[0.12] focus:border-brand focus:ring-2 focus:ring-brand/20'
                  }`}
                />
                {fieldErrors.alamat && (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.alamat}</p>
                )}
              </div>
            </div>
          </div>

          {/* Hidden Submit Button to allow Enter key to submit */}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>

        {/* ================= 3. FOOTER AKSI MODAL ================= */}
        <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-900/[0.08] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <IconSpinner className="size-3.5" />
                <span>Menyimpan…</span>
              </>
            ) : (
              <span>{isCreate ? 'Daftarkan Mahasiswa' : 'Simpan Perubahan'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

