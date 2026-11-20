import {
  IconCheckCircle,
  IconClock,
  IconExclamationTriangle,
  IconUsers,
} from '../../common/Icons.jsx';

/**
 * Badge status finalisasi penetapan pembimbing oleh Kaprodi
 * Nilai status: 'SIAP_DITETAPKAN' | 'SUDAH_DITETAPKAN' | 'BELUM_SIAP'
 */
export function FinalisasiStatusBadge({ status, reasons = [] }) {
  if (status === 'SIAP_DITETAPKAN') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-semibold"
        title="Seluruh syarat kelayakan terpenuhi. Siap ditetapkan dosen pembimbingnya."
      >
        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <IconCheckCircle className="size-3 text-emerald-600" />
        <span>Siap Ditetapkan</span>
      </span>
    );
  }

  if (status === 'SUDAH_DITETAPKAN') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 px-2.5 py-0.5 text-xs font-semibold"
        title="Dosen Pembimbing aktif telah ditetapkan oleh Kaprodi."
      >
        <span>Sudah Ditetapkan</span>
      </span>
    );
  }

  // Fallback / BELUM_SIAP
  const countKendala = Array.isArray(reasons) ? reasons.length : 0;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-0.5 text-xs font-semibold"
      title={countKendala > 0 ? `${countKendala} syarat/proses kelayakan belum terpenuhi.` : 'Belum siap ditetapkan.'}
    >
      <span className="size-1.5 rounded-full bg-amber-500" />
      <IconExclamationTriangle className="size-3 text-amber-600" />
      <span>Belum Siap</span>
      {countKendala > 0 && (
        <span className="ml-0.5 rounded-full bg-amber-200/70 text-amber-900 px-1.5 py-0.2 text-[10px] font-bold font-mono">
          {countKendala}
        </span>
      )}
    </span>
  );
}

/**
 * Badge status pelaksanaan bimbingan KP oleh mahasiswa & pembimbing
 * Nilai status: 'SUDAH_DIMULAI' | 'BELUM_DIMULAI'
 */
export function BimbinganStatusBadge({ status }) {
  if (status === 'SUDAH_DIMULAI') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200/70 px-2 py-0.5 text-[11px] font-medium"
        title="Kegiatan bimbingan sudah dimulai. Dosen pembimbing terkunci."
      >
        <span className="size-1.5 rounded-full bg-purple-500" />
        <span>Bimbingan Berjalan</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 px-2 py-0.5 text-[11px] font-medium"
      title="Belum ada aktivitas bimbingan tercatat. Pembimbing masih dapat disesuaikan."
    >
      <span className="size-1.5 rounded-full bg-slate-400" />
      <span>Belum Mulai</span>
    </span>
  );
}

/**
 * Badge nomor versi proposal
 */
export function ProposalVersionBadge({ version = 1 }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100/90 text-slate-700 border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold font-mono tracking-tight">
      v{version}
    </span>
  );
}

/**
 * Badge status review kelayakan proposal oleh Reviewer
 */
export function ReviewerProgressBadge({ totalReviewer = 0, totalLayak = 0 }) {
  if (totalReviewer === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
        <IconClock className="size-3 text-amber-500" />
        <span>Belum ada reviewer</span>
      </span>
    );
  }

  const allLayak = totalReviewer > 0 && totalLayak === totalReviewer;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
        allLayak ? 'text-emerald-700 font-semibold' : 'text-slate-600'
      }`}
    >
      {allLayak ? (
        <IconCheckCircle className="size-3 text-emerald-600" />
      ) : (
        <IconClock className="size-3 text-amber-500" />
      )}
      <span>
        Reviewer: <strong className="font-mono">{totalLayak}/{totalReviewer}</strong> Layak
      </span>
    </span>
  );
}
