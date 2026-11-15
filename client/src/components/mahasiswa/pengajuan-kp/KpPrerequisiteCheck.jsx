import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconExclamationTriangle,
} from '../../common/Icons.jsx';

/**
 * Pemetaan nama kode dokumen ke label ramah pengguna
 */
const DOKUMEN_NAMES = {
  KTP: 'KTP',
  KTM: 'KTM',
  KK: 'Kartu Keluarga',
  IJAZAH: 'Ijazah / SKL',
  AKTA: 'Akta Kelahiran',
  FORM_DATA_DIRI: 'Formulir Data Diri',
};

/**
 * Komponen Peringatan Prasyarat Berkas Data Diri Mahasiswa (Minimalist Strip)
 * - Jika data diri LENGKAP (6/6): Tidak menampilkan kartu besar (sudah terangkum di banner atas)
 * - Jika data diri BELUM LENGKAP: Menampilkan alert 1 baris ringkas dengan daftar dokumen yang kurang
 * 
 * @param {object} props
 * @param {object|null} props.dataDiri - Info Data Diri dari getKpFormOptions
 * @param {boolean} [props.loading] - State loading
 */
export default function KpPrerequisiteCheck({ dataDiri, loading = false }) {
  if (loading || !dataDiri) return null;

  // Jika sudah lengkap, tidak perlu memakan ruang vertikal dengan card besar
  if (dataDiri.lengkap) {
    return null;
  }

  const totalWajib = dataDiri.jumlah_wajib || 6;
  const totalUploaded = dataDiri.jumlah_terunggah || 0;
  const missingCodes = Array.isArray(dataDiri.dokumen_kurang) ? dataDiri.dokumen_kurang : [];

  return (
    <aside
      aria-label="Peringatan Dokumen Data Diri Belum Lengkap"
      className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50/70 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between text-xs text-amber-950"
    >
      <div className="flex items-center gap-2 min-w-0">
        <IconExclamationTriangle className="size-4 shrink-0 text-amber-700" />
        <span className="leading-snug">
          <strong>Perhatian:</strong> Berkas Data Diri Anda baru terunggah{' '}
          <strong>{totalUploaded}/{totalWajib}</strong>. Lengkapi seluruh berkas wajib sebelum mengirim pengajuan KP.
          {missingCodes.length > 0 && (
            <span className="ml-1 text-amber-900 font-medium">
              (Belum: {missingCodes.map((c) => DOKUMEN_NAMES[c] || c).join(', ')})
            </span>
          )}
        </span>
      </div>

      <div className="shrink-0 self-end sm:self-auto">
        <Link
          to="/mahasiswa/dokumen"
          className="inline-flex items-center gap-1 font-semibold text-amber-900 underline hover:text-amber-950"
        >
          Lengkapi Dokumen
          <IconArrowRight className="size-3" />
        </Link>
      </div>
    </aside>
  );
}
