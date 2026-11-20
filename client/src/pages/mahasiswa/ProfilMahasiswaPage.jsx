import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconAcademicCap,
  IconArrowRight,
  IconCalendar,
  IconCheckCircle,
  IconDocumentText,
  IconExclamationCircle,
  IconExclamationTriangle,
  IconInformationCircle,
  IconLockClosed,
  IconMail,
  IconMapPin,
  IconPhone,
  IconSpinner,
  IconUser,
} from '../../components/common/Icons.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { dataDiriErrorMessage, fetchMyDataDiri, updateMyProfile } from '../../services/dataDiri.js';
import stickFigureImg from '../../assets/Stick Figure Planning with Checklist.png';

function formatIndonesianDate(isoDateString) {
  if (!isoDateString) return '-';
  try {
    const [year, month, day] = isoDateString.split('-');
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${parseInt(day, 10)} ${months[monthIndex]} ${year}`;
    }
    return isoDateString;
  } catch {
    return isoDateString;
  }
}

export default function ProfilMahasiswaPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const [formData, setFormData] = useState({
    no_telepon: '',
    alamat: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyDataDiri();
      setData(res);
      setFormData({
        no_telepon: res.profil.no_telepon || '',
        alamat: res.profil.alamat || '',
      });
      setFieldErrors({});
    } catch (err) {
      const msg = dataDiriErrorMessage(err, 'Gagal memuat profil mahasiswa.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const hasChanges = useMemo(() => {
    if (!data?.profil) return false;
    const initialPhone = data.profil.no_telepon || '';
    const initialAddress = data.profil.alamat || '';
    return formData.no_telepon !== initialPhone || formData.alamat !== initialAddress;
  }, [data, formData]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    const phone = formData.no_telepon.trim();
    if (phone) {
      const normalizedPhone = phone.replace(/[\s()-]/g, '');
      if (!/^\+?\d{8,20}$/.test(normalizedPhone)) {
        errors.no_telepon = 'Format nomor telepon tidak valid (masukkan 8–20 digit angka).';
      }
    }

    const address = formData.alamat.trim();
    if (address) {
      if (address.length > 5000) {
        errors.alamat = 'Alamat terlalu panjang (maksimal 5.000 karakter).';
      }
      if (/[<>]/.test(address)) {
        errors.alamat = 'Karakter < dan > tidak diperbolehkan.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm() || submitting || !hasChanges) return;

    setSubmitting(true);
    try {
      const payload = {
        no_telepon: formData.no_telepon.trim() || null,
        alamat: formData.alamat.trim() || null,
      };
      const updated = await updateMyProfile(payload);
      setData((prev) => ({
        ...prev,
        profil: {
          ...prev.profil,
          no_telepon: updated.no_telepon,
          alamat: updated.alamat,
        },
      }));
      setFormData({
        no_telepon: updated.no_telepon || '',
        alamat: updated.alamat || '',
      });
      toast.success('Data kontak dan domisili berhasil diperbarui!');
    } catch (err) {
      const msg = dataDiriErrorMessage(err, 'Gagal menyimpan perubahan profil.');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    if (!data?.profil) return;
    setFormData({
      no_telepon: data.profil.no_telepon || '',
      alamat: data.profil.alamat || '',
    });
    setFieldErrors({});
  };

  // State: Loading Skeleton
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl space-y-6 animate-pulse">
        <div className="border-b border-slate-900/[0.06] pb-5">
          <div className="h-3 w-28 bg-slate-200/60 rounded mb-2" />
          <div className="h-7 w-48 bg-slate-200/60 rounded mb-2" />
          <div className="h-3.5 w-80 bg-slate-200/40 rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <div className="h-64 rounded-[18px] bg-white/60 border border-slate-900/[0.06]" />
            <div className="h-44 rounded-[18px] bg-white/60 border border-slate-900/[0.06]" />
          </div>
          <div className="lg:col-span-8 space-y-6">
            <div className="h-60 rounded-[18px] bg-white/60 border border-slate-900/[0.06]" />
            <div className="h-64 rounded-[18px] bg-white/60 border border-slate-900/[0.06]" />
          </div>
        </div>
      </div>
    );
  }

  // State: Error
  if (error || !data?.profil) {
    return (
      <div className="mx-auto w-full max-w-md my-12 text-center">
        <div className="p-8 rounded-[18px] border border-slate-900/[0.08] bg-white/75 shadow-none flex flex-col items-center">
          <IconExclamationCircle className="size-8 text-danger mb-3" />
          <h2 className="text-base font-bold text-ink">Gagal Memuat Profil</h2>
          <p className="mt-2 text-xs text-secondary leading-relaxed">
            {error || 'Data profil tidak dapat ditemukan.'}
          </p>
          <button
            type="button"
            onClick={loadData}
            className="mt-5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-semibold shadow-none transition-colors cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const { profil, kelengkapan } = data;
  const initials = profil.nama_lengkap
    ? profil.nama_lengkap.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'M';
  const progressPercent = kelengkapan
    ? Math.round((kelengkapan.jumlah_terunggah / kelengkapan.jumlah_wajib) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl space-y-6">
      {/* 1. Header Halaman */}
      <div className="border-b border-slate-900/[0.06] pb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Profil Mahasiswa
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Profil Saya
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-secondary">
          Kelola informasi kontak pribadi dan tinjau data identitas akademik resmi Anda.
        </p>
      </div>

      {/* 2. Notice Banner - Translucent Flat Surface */}
      <div className="rounded-[16px] border border-slate-900/[0.08] bg-white/65 p-4 flex items-start gap-3 shadow-none">
        <IconInformationCircle className="size-4.5 text-slate-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink leading-snug">
            Data Akademik Bersifat Resmi & Terverifikasi
          </p>
          <p className="text-xs text-secondary/90 leading-relaxed mt-0.5">
            Perubahan nama lengkap, NIM, tanggal lahir, atau program studi dikelola terpusat oleh Admin Program Studi. Hubungi sekretariat prodi bila terdapat ketidaksesuaian data master.
          </p>
        </div>
      </div>

      {/* 3. Main Grid (2 Kolom Asimetris: 4 vs 8) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ==================== KOLOM KIRI (Hero & Dokumen Summary) ==================== */}
        <div className="lg:col-span-4 space-y-6">
          {/* Kartu 1: Identitas Ringkas Mahasiswa */}
          <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 p-6 shadow-none flex flex-col items-start text-left">
            {/* Header: Foto Profil (Kiri) & Stick Figure Asset (Kanan) */}
            <div className="flex items-start justify-between w-full gap-3">
              {/* Bulatan Avatar (Rata Kiri) */}
              <div className="relative mb-3.5">
                <div className="size-16 rounded-full bg-white/80 border border-slate-900/[0.08] flex items-center justify-center text-slate-800 font-bold text-lg tracking-tight">
                  {initials}
                </div>
                <span
                  className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white"
                  title="Status Mahasiswa Aktif"
                  aria-hidden="true"
                />
              </div>

              {/* Icon Asset Stick Figure (Di Kanan, Diperbesar Sedikit) */}
              <div className="shrink-0 -mt-1 -mr-1">
                <img
                  src={stickFigureImg}
                  alt="Ilustrasi Perencanaan Akademik"
                  className="size-20 sm:size-22 object-contain select-none pointer-events-none drop-shadow-xs"
                />
              </div>
            </div>

            {/* Nama Lengkap & NIM (Rata Kiri Sejajar dengan Ikon di Bawah) */}
            <h2 className="text-base font-bold text-ink leading-tight">
              {profil.nama_lengkap}
            </h2>
            <p className="text-xs text-muted mt-1 font-mono">
              {profil.nim}
            </p>

            {/* Chips info - Rata Kiri */}
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-slate-900/[0.08] bg-white/70 px-3 py-0.5 text-xs font-medium text-slate-700">
                {profil.program_studi?.nama_prodi || 'Sistem Informasi'}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-900/[0.08] bg-white/70 px-3 py-0.5 text-xs font-medium text-slate-600">
                Angkatan {profil.tahun_angkatan}
              </span>
            </div>

            <div className="mt-5 w-full pt-4 border-t border-slate-900/[0.06] text-left space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted flex items-center gap-1.5">
                  <IconMail className="size-3.5 text-slate-400" />
                  Email Akun
                </span>
                <span className="font-medium text-ink truncate max-w-[170px]" title={profil.email}>
                  {profil.email}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted flex items-center gap-1.5">
                  <IconCheckCircle className="size-3.5 text-emerald-600" />
                  Status Akun
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {profil.status_data || 'AKTIF'}
                </span>
              </div>
            </div>
          </div>

          {/* Kartu 2: Mini Card Progres Dokumen */}
          <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 p-6 shadow-none">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-900/[0.06]">
              <div className="flex items-center gap-2">
                <IconDocumentText className="size-4.5 text-slate-600 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-ink">Dokumen Identitas</h3>
                  <p className="text-[10px] text-muted">Syarat 6 Berkas Wajib</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-700 bg-white/80 px-2.5 py-0.5 rounded-full border border-slate-900/[0.08]">
                {kelengkapan.jumlah_terunggah} / {kelengkapan.jumlah_wajib}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] font-medium text-secondary mb-1.5">
                <span>Kelengkapan Berkas</span>
                <span className="font-bold text-ink">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-900/[0.06] overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Status Verifikasi Badge */}
            <div className="mt-3.5 flex items-center gap-2 p-2.5 rounded-xl border border-slate-900/[0.06] bg-white/60 text-[11px]">
              {kelengkapan.sudah_diverifikasi ? (
                <>
                  <IconCheckCircle className="size-4 text-emerald-600 shrink-0" />
                  <span className="font-medium text-emerald-800">
                    Berkas telah diverifikasi Admin Prodi
                  </span>
                </>
              ) : kelengkapan.lengkap ? (
                <>
                  <IconInformationCircle className="size-4 text-slate-600 shrink-0" />
                  <span className="font-medium text-secondary">
                    Berkas lengkap diunggah, menunggu verifikasi
                  </span>
                </>
              ) : (
                <>
                  <IconExclamationTriangle className="size-4 text-amber-600 shrink-0" />
                  <span className="font-medium text-amber-900">
                    Belum lengkap ({kelengkapan.jumlah_wajib - kelengkapan.jumlah_terunggah} berkas belum diunggah)
                  </span>
                </>
              )}
            </div>

            {/* Shortcut Link to /mahasiswa/dokumen */}
            <Link
              to="/mahasiswa/dokumen"
              className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-900/[0.08] bg-white/70 hover:bg-white text-xs font-semibold text-slate-700 px-3 py-2 transition-colors cursor-pointer"
            >
              <span>Kelola Dokumen Data Diri</span>
              <IconArrowRight className="size-3.5 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* ==================== KOLOM KANAN (Master Data & Editable Form) ==================== */}
        <div className="lg:col-span-8 space-y-6">
          {/* Kartu 3: Data Akademik Resmi (Clean Minimalist Grid) */}
          <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 p-6 sm:p-7 shadow-none">
            <div className="flex items-center justify-between pb-4 border-b border-slate-900/[0.06] mb-6">
              <div className="flex items-center gap-2.5">
                <IconAcademicCap className="size-4.5 text-slate-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-ink">Data Akademik Resmi</h2>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-900/[0.08] bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      <IconLockClosed className="size-2.5 text-slate-400" />
                      Terkunci
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Informasi master terdaftar di Pangkalan Data UTY
                  </p>
                </div>
              </div>
            </div>

            {/* Grid Bersih & Lapang Tanpa Kotak-Kotak AI Slop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              {/* NIM */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <IconUser className="size-3.5 text-slate-400 shrink-0" />
                  <span>Nomor Induk Mahasiswa (NIM)</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink pl-5">{profil.nim}</p>
              </div>

              {/* Nama Lengkap */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <IconUser className="size-3.5 text-slate-400 shrink-0" />
                  <span>Nama Lengkap</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink pl-5 truncate" title={profil.nama_lengkap}>
                  {profil.nama_lengkap}
                </p>
              </div>

              {/* Program Studi */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <IconAcademicCap className="size-3.5 text-slate-400 shrink-0" />
                  <span>Program Studi</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink pl-5">
                  {profil.program_studi?.nama_prodi} ({profil.program_studi?.kode_prodi})
                </p>
              </div>

              {/* Tahun Angkatan */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <IconCalendar className="size-3.5 text-slate-400 shrink-0" />
                  <span>Tahun Angkatan</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink pl-5">{profil.tahun_angkatan}</p>
              </div>

              {/* Tanggal Lahir */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <IconCalendar className="size-3.5 text-slate-400 shrink-0" />
                  <span>Tanggal Lahir</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink pl-5">
                  {formatIndonesianDate(profil.tanggal_lahir)}
                </p>
              </div>

              {/* Email Institusi */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <IconMail className="size-3.5 text-slate-400 shrink-0" />
                  <span>Email Mahasiswa</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink pl-5 truncate" title={profil.email}>
                  {profil.email}
                </p>
              </div>
            </div>
          </div>

          {/* Kartu 4: Formulir Kontak & Domisili Mandiri (Dapat Diubah) */}
          <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 p-6 sm:p-7 shadow-none">
            <div className="flex items-center justify-between pb-4 border-b border-slate-900/[0.06] mb-6">
              <div className="flex items-center gap-2.5">
                <IconPhone className="size-4.5 text-slate-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-ink">Informasi Kontak & Domisili</h2>
                    <span className="inline-flex items-center rounded-full border border-slate-900/[0.08] bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Dapat Diubah
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Pastikan kontak selalu aktif untuk keperluan koordinasi bimbingan dan pengajuan
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4.5">
              {/* Input Nomor Telepon / WhatsApp */}
              <div>
                <label
                  htmlFor="no_telepon"
                  className="block text-xs font-semibold text-ink mb-1.5"
                >
                  Nomor WhatsApp / Telepon
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <IconPhone className="size-4" />
                  </div>
                  <input
                    id="no_telepon"
                    type="tel"
                    value={formData.no_telepon}
                    onChange={(e) => handleInputChange('no_telepon', e.target.value)}
                    placeholder="Contoh: 081234567890"
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.no_telepon)}
                    className="w-full h-9.5 rounded-xl border border-slate-900/[0.08] bg-white/70 pl-9 pr-3.5 text-xs text-ink placeholder:text-xs placeholder:text-slate-400 outline-none transition-colors focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand/20 disabled:bg-slate-50/50 disabled:opacity-70"
                  />
                </div>
                {fieldErrors.no_telepon ? (
                  <p className="mt-1 text-[11px] font-medium text-danger flex items-center gap-1">
                    <IconExclamationCircle className="size-3.5 shrink-0" />
                    <span>{fieldErrors.no_telepon}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-muted">
                    Format 8–20 digit angka. Simbol strip dan spasi diperbolehkan.
                  </p>
                )}
              </div>

              {/* Input Alamat Domisili */}
              <div>
                <label
                  htmlFor="alamat"
                  className="block text-xs font-semibold text-ink mb-1.5"
                >
                  Alamat Domisili
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none text-slate-400">
                    <IconMapPin className="size-4" />
                  </div>
                  <textarea
                    id="alamat"
                    rows={3}
                    value={formData.alamat}
                    onChange={(e) => handleInputChange('alamat', e.target.value)}
                    placeholder="Contoh: Jl. Ringroad Utara, Jombor, Sleman, D.I. Yogyakarta"
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.alamat)}
                    className="w-full rounded-xl border border-slate-900/[0.08] bg-white/70 pl-9 pr-3.5 py-2.5 text-xs text-ink placeholder:text-xs placeholder:text-slate-400 outline-none transition-colors focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand/20 disabled:bg-slate-50/50 disabled:opacity-70"
                  />
                </div>
                {fieldErrors.alamat ? (
                  <p className="mt-1 text-[11px] font-medium text-danger flex items-center gap-1">
                    <IconExclamationCircle className="size-3.5 shrink-0" />
                    <span>{fieldErrors.alamat}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-muted">
                    Masukkan alamat tinggal / kost Anda saat ini (maks. 5.000 karakter).
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-900/[0.06]">
                {hasChanges && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    disabled={submitting}
                    className="rounded-xl border border-slate-900/[0.08] bg-white/70 hover:bg-white px-4 py-2 text-xs font-semibold text-secondary transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                )}

                <button
                  type="submit"
                  disabled={submitting || !hasChanges}
                  className="rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-5 py-2 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-none"
                >
                  {submitting && <IconSpinner className="size-3.5" />}
                  <span>{submitting ? 'Menyimpan…' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
