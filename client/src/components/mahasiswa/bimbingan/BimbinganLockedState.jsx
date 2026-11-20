import { Link } from 'react-router-dom';
import { IconArrowRight, IconBriefcase, IconLockClosed } from '../../common/Icons.jsx';

/**
 * Tampilan status terkunci ketika mahasiswa belum memiliki pengajuan KP berstatus ACC
 * atau belum ditetapkan dosen pembimbing resmi oleh Kaprodi.
 * 
 * @param {object} props
 * @param {string} [props.reason] - Keterangan penyebab terkunci
 * @param {object} [props.application] - Data pengajuan saat ini jika ada
 */
export default function BimbinganLockedState({ reason, application }) {
  const statusPengajuan = application?.status_pengajuan;

  let customTitle = 'Modul Bimbingan Belum Aktif';
  let customDesc =
    'Fitur pencatatan bimbingan akademik akan terbuka otomatis setelah proposal Kerja Praktik Anda disetujui (ACC) oleh Ketua Program Studi dan Dosen Pembimbing resmi telah ditetapkan.';

  if (statusPengajuan === 'DIAJUKAN') {
    customTitle = 'Menunggu Persetujuan Pengajuan KP';
    customDesc =
      'Pengajuan Kerja Praktik Anda saat ini sedang dalam proses pemeriksaan berkas/akademik dan menunggu keputusan persetujuan akhir (ACC) oleh Ketua Program Studi.';
  } else if (statusPengajuan === 'ACC' && !application?.pembimbing) {
    customTitle = 'Menunggu Penetapan Dosen Pembimbing';
    customDesc =
      'Proposal KP Anda telah disetujui (ACC). Ketua Program Studi saat ini sedang dalam proses penetapan Dosen Pembimbing untuk Anda.';
  }

  return (
    <div className="rounded-[22px] border border-slate-900/[0.08] bg-white/80 backdrop-blur-sm p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 shadow-none">
      <div className="size-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mx-auto mb-4 text-amber-700">
        <IconLockClosed className="size-7" />
      </div>

      <h2 className="text-lg sm:text-xl font-extrabold text-ink">
        {customTitle}
      </h2>

      <p className="mt-2 text-xs sm:text-sm text-secondary leading-relaxed max-w-lg mx-auto">
        {reason || customDesc}
      </p>

      {/* Action shortcuts */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/mahasiswa/pengajuan/kp"
          className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-pressed text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <IconBriefcase className="size-3.5 text-white" />
          <span>Lihat Status Pengajuan KP</span>
          <IconArrowRight className="size-3.5 text-white" />
        </Link>

        <Link
          to="/mahasiswa/dashboard"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.12] bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-secondary hover:text-ink transition-colors cursor-pointer"
        >
          <span>Ke Dashboard Mahasiswa</span>
        </Link>
      </div>
    </div>
  );
}
