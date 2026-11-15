import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconCheckCircle,
  IconDocumentText,
  IconHome,
  IconLockClosed,
  IconUserCircle,
} from '../../common/Icons.jsx';

/**
 * Format tanggal Indonesia untuk jadwal
 */
function formatIndonesianDate(isoString) {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(date) + ' WIB';
  } catch {
    return '-';
  }
}

/**
 * Komponen State Terkunci ketika Jadwal Pengajuan KP Mahasiswa Belum Dibuka / Sudah Ditutup
 * 
 * @param {object} props
 * @param {object|null} props.jadwal - Data jadwal dari opsi-form
 * @param {object|null} props.dataDiri - Info kelengkapan data diri mahasiswa
 */
export default function KpLockedState({ jadwal, dataDiri }) {
  const isDataDiriLengkap = Boolean(dataDiri?.lengkap);

  return (
    <section
      aria-labelledby="locked-state-heading"
      className="mx-auto w-full max-w-3xl space-y-6 py-4"
    >
      {/* Kartu Utama Status Terkunci */}
      <div className="rounded-2xl border border-line bg-white p-6 text-center shadow-xs sm:p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 shadow-xs sm:size-20">
          <IconLockClosed className="size-8 sm:size-10" />
        </div>

        <h1
          id="locked-state-heading"
          className="mt-5 text-xl font-bold text-ink sm:text-2xl"
        >
          Pengajuan Kerja Praktik Sedang Ditutup
        </h1>

        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-secondary sm:text-base">
          Saat ini portal pengajuan Kerja Praktik (KP) untuk Program Studi Sistem Informasi sedang tidak dibuka. Anda tidak dapat membuat draf baru maupun mengirimkan pengajuan di luar jadwal resmi.
        </p>

        {/* Informasi Jadwal Terkonfigurasi */}
        {jadwal && (
          <div className="mx-auto mt-6 max-w-lg rounded-xl border border-line bg-subtle/70 p-4 text-left text-xs sm:text-sm">
            <h2 className="font-semibold text-ink">
              Informasi Periode Akademik Terakhir:
            </h2>
            <dl className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted">Tahun & Semester</dt>
                <dd className="font-medium text-ink">
                  {jadwal.tahun_ajaran || '-'} {jadwal.semester || ''}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Status Pendaftaran</dt>
                <dd className="inline-flex items-center gap-1 font-semibold text-danger">
                  <span className="size-1.5 rounded-full bg-danger" /> Ditutup
                </dd>
              </div>
              <div>
                <dt className="text-muted">Waktu Mulai Buka</dt>
                <dd className="font-medium text-ink">
                  {formatIndonesianDate(jadwal.tgl_mulai)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Batas Akhir Selesai</dt>
                <dd className="font-medium text-ink">
                  {formatIndonesianDate(jadwal.tgl_selesai)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Tombol Aksi Navigasi */}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/mahasiswa/dokumen"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-hover focus:outline-hidden focus:ring-2 focus:ring-brand/40"
          >
            <IconDocumentText className="size-4" />
            Lengkapi Dokumen Data Diri
            <IconArrowRight className="size-4" />
          </Link>

          <Link
            to="/mahasiswa/dashboard"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-5 py-2.5 text-sm font-semibold text-secondary shadow-xs transition hover:bg-subtle focus:outline-hidden"
          >
            <IconHome className="size-4" />
            Kembali ke Beranda
          </Link>
        </div>
      </div>

      {/* Kartu Panduan Persiapan Mahasiswa */}
      <div className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-sm font-bold text-ink sm:text-base">
          Langkah Persiapan Sebelum Jadwal Dibuka
        </h2>
        <p className="mt-1 text-xs text-secondary sm:text-sm">
          Manfaatkan waktu tunggu ini untuk melengkapi prasyarat administrasi agar Anda dapat langsung mengirimkan pengajuan saat jadwal dibuka:
        </p>

        <ul className="mt-4 space-y-3">
          {/* Item 1: Data Diri */}
          <li className="flex items-start gap-3 rounded-lg border border-line p-3 text-xs sm:text-sm">
            <span
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                isDataDiriLengkap
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isDataDiriLengkap ? (
                <IconCheckCircle className="size-4" />
              ) : (
                <IconUserCircle className="size-4" />
              )}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink">
                  1. Periksa Kelengkapan 6 Berkas Data Diri
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isDataDiriLengkap
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {isDataDiriLengkap ? '6/6 Lengkap' : `${dataDiri?.jumlah_terunggah || 0}/6 Terunggah`}
                </span>
              </div>
              <p className="mt-1 text-secondary">
                Pengajuan KP mensyaratkan keenam dokumen Data Diri (KTP, KTM, KK, Ijazah, Akta, Formulir) telah diunggah di sistem.
              </p>
            </div>
          </li>

          {/* Item 2: Proposal */}
          <li className="flex items-start gap-3 rounded-lg border border-line p-3 text-xs sm:text-sm">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-brand">
              <IconDocumentText className="size-4" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-ink">
                2. Siapkan Naskah Proposal KP (Format PDF, Maks. 10 MB)
              </p>
              <p className="mt-1 text-secondary">
                Susun usulan judul, latar belakang permasalahan, objek/instansi mitra KP, dan metode kerja praktik sesuai pedoman Program Studi.
              </p>
            </div>
          </li>

          {/* Item 3: Administrasi Biaya & Pembimbing */}
          <li className="flex items-start gap-3 rounded-lg border border-line p-3 text-xs sm:text-sm">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
              <IconCheckCircle className="size-4" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-ink">
                3. Siapkan Bukti Pembayaran & Sertifikat Sosialisasi
              </p>
              <p className="mt-1 text-secondary">
                Pastikan Anda telah memiliki bukti pembayaran proposal KP, bukti SPP Variabel (jika memilih opsi Ya), serta Sertifikat Sosialisasi KP atau Surat Pernyataan Sosialisasi.
              </p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}

