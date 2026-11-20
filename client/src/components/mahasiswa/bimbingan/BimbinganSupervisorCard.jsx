import { IconAcademicCap, IconBriefcase, IconCalendarClock } from '../../common/Icons.jsx';
import puzzleIllustration from '../../../assets/vectorly-UNI-puzzle.png';

function formatDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return '-';
  }
}

/**
 * Kartu Rincian Dosen Pembimbing & Usulan Penelitian KP Aktif
 * Mengadopsi tata letak seimbang: Profil Dosen di kiri, Judul KP di kanan,
 * serta aksen logo puzzle yang menembus layout utama dan pembungkus judul KP.
 * 
 * @param {object} props
 * @param {object} props.application - Objek pengajuan KP aktif
 * @param {object} [props.pembimbing] - Data penugasan pembimbing
 */
export default function BimbinganSupervisorCard({ application, pembimbing }) {
  const dosen = pembimbing?.dosen || {};
  const dosenName = dosen.nama_lengkap || 'Dosen Pembimbing Belum Ditetapkan';
  const dosenCode = dosen.kode_dosen || '-';
  const judul = application?.versi_topik?.judul_penelitian || application?.judul_penelitian || 'Judul Penelitian Belum Ditentukan';
  const nomorPengajuan = application?.nomor_pengajuan || '-';

  const initials = dosenName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'DP';

  return (
    <section
      aria-label="Informasi Pembimbing dan Judul Kerja Praktik"
      className="group relative mt-3 sm:mt-4 overflow-visible rounded-[18px] border border-slate-900/[0.08] bg-white/80 backdrop-blur-sm p-4 sm:p-5 shadow-2xs transition-colors duration-150 hover:border-slate-300"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-1">
        {/* ================= SISI KIRI: PROFIL DOSEN PEMBIMBING ================= */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          {/* Avatar Inisial Dosen */}
          <div className="relative shrink-0">
            <div className="size-11 sm:size-12 rounded-full bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 font-bold text-sm tracking-tight shadow-2xs">
              {initials}
            </div>
            <span
              className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white"
              title="Dosen Pembimbing Aktif"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Dosen Pembimbing Resmi
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200/80 bg-indigo-50/70 px-2 py-0.2 text-[10px] font-semibold text-indigo-800">
                Kode: {dosenCode}
              </span>
            </div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-ink truncate" title={dosenName}>
              {dosenName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
              <span className="flex items-center gap-1.5">
                <IconBriefcase className="size-3.5 text-muted shrink-0" />
                Nomor Pengajuan: <code className="font-mono text-ink font-semibold">#{nomorPengajuan}</code>
              </span>
              {pembimbing?.mulai_at && (
                <span className="flex items-center gap-1.5">
                  <IconCalendarClock className="size-3.5 text-muted shrink-0" />
                  Ditetapkan: {formatDate(pembimbing.mulai_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ================= SISI KANAN: KOTAK JUDUL KP DENGAN LOGO MENEMBUS ================= */}
        <div className="relative w-full lg:max-w-md rounded-xl border border-slate-900/[0.06] bg-slate-50/75 p-3.5 sm:p-4 text-xs transition-colors group-hover:bg-slate-50">
          <div className="pr-12 sm:pr-14">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
              <IconAcademicCap className="size-3 text-muted shrink-0" />
              <span>Judul Kerja Praktik</span>
            </p>
            <p className="mt-1 font-semibold text-ink leading-relaxed line-clamp-2" title={judul}>
              &ldquo;{judul}&rdquo;
            </p>
          </div>

          {/* Logo Puzzle: Menembus pembungkus judul KP sekaligus batas atas layout utama */}
          <div className="absolute -top-3.5 -right-2 sm:-top-4 sm:-right-2.5 md:-top-4.5 md:-right-3 pointer-events-none select-none z-10">
            <img
              src={puzzleIllustration}
              alt=""
              aria-hidden="true"
              decoding="async"
              className="w-11 sm:w-13 md:w-15 object-contain drop-shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:-translate-y-1"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
