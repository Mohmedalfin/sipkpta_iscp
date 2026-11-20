import {
  IconCheckCircle,
  IconClock,
  IconExclamationTriangle,
  IconUser,
} from '../../common/Icons.jsx';
import { ALASAN_KELAYAKAN_LABEL } from '../../../services/kaprodiFinalisasiKp.js';

/**
 * Format tanggal Indonesia ringkas
 */
function formatShortDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '-';
  }
}

/**
 * Komponen Ringkasan Kelayakan Terpadu Penetapan Pembimbing KP
 * Didesain minimalis dan tenang, selaras dengan design system SIPKITA (kartu putih netral, border halus).
 *
 * @param {object} props
 * @param {object} props.detail - Objek data detail pengajuan dari backend
 * @param {boolean} [props.compact=false] - Tampilan ringkas tanpa rincian panjang
 */
export default function KelayakanChecklist({ detail, compact = false }) {
  if (!detail) return null;

  const alasan = Array.isArray(detail.alasan) ? detail.alasan : [];
  const reviewers = Array.isArray(detail.reviewer) ? detail.reviewer : [];

  const gates = [
    {
      id: 'ACC_ADMIN',
      title: 'ACC Administratif Admin Prodi',
      passed: !alasan.includes('ACC_ADMIN_BELUM_TERSEDIA') && detail.status_pengajuan === 'ACC',
      desc: ALASAN_KELAYAKAN_LABEL.ACC_ADMIN_BELUM_TERSEDIA,
    },
    {
      id: 'BERKAS',
      title: 'Berkas Persyaratan Lengkap',
      passed: !alasan.includes('BERKAS_BELUM_LENGKAP') && detail.status_pemeriksaan_berkas === 'OK_LENGKAP',
      desc: ALASAN_KELAYAKAN_LABEL.BERKAS_BELUM_LENGKAP,
    },
    {
      id: 'NILAI',
      title: 'Kelayakan Akademik & SKS',
      passed: !alasan.includes('NILAI_BELUM_LENGKAP') && detail.status_pemeriksaan_akademik === 'OK_LENGKAP',
      desc: ALASAN_KELAYAKAN_LABEL.NILAI_BELUM_LENGKAP,
    },
    {
      id: 'DATA_DIRI',
      title: 'Verifikasi Data Diri Mahasiswa',
      passed:
        !alasan.includes('DATA_DIRI_BELUM_TERVERIFIKASI') &&
        detail.mahasiswa?.verifikasi_data_diri?.status_verifikasi === 'TERVERIFIKASI',
      desc: ALASAN_KELAYAKAN_LABEL.DATA_DIRI_BELUM_TERVERIFIKASI,
    },
    {
      id: 'PROPOSAL',
      title: 'Proposal Terkini & Versi Topik',
      passed:
        !alasan.includes('PROPOSAL_TERKINI_TIDAK_TERSEDIA') &&
        Boolean(detail.proposal_terkini && detail.versi_topik),
      desc: ALASAN_KELAYAKAN_LABEL.PROPOSAL_TERKINI_TIDAK_TERSEDIA,
    },
    {
      id: 'REVIEWER_ASSIGNED',
      title: 'Dosen Reviewer Aktif Ditugaskan',
      passed: !alasan.includes('REVIEWER_AKTIF_BELUM_ADA') && detail.jumlah_reviewer_aktif > 0,
      desc: ALASAN_KELAYAKAN_LABEL.REVIEWER_AKTIF_BELUM_ADA,
    },
    {
      id: 'REVIEW_OUTCOME',
      title: 'Hasil Telaah Reviewer (Semua LAYAK)',
      passed:
        !alasan.includes('REVIEW_TERKINI_BELUM_LAYAK') &&
        detail.jumlah_reviewer_aktif > 0 &&
        detail.jumlah_layak_versi_terkini === detail.jumlah_reviewer_aktif,
      desc: ALASAN_KELAYAKAN_LABEL.REVIEW_TERKINI_BELUM_LAYAK,
    },
  ];

  const totalPassed = gates.filter((g) => g.passed).length;
  const isFullyEligible = totalPassed === gates.length;

  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 space-y-3.5 shadow-none">
      <div className="flex items-center justify-between border-b border-slate-900/[0.06] pb-2.5">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
          Pemeriksaan 7 Gerbang Kelayakan
        </span>
        <span
          className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold ${
            isFullyEligible ? 'text-emerald-700' : 'text-amber-700'
          }`}
        >
          {isFullyEligible ? (
            <IconCheckCircle className="size-3.5 text-emerald-600" />
          ) : (
            <IconExclamationTriangle className="size-3.5 text-amber-600" />
          )}
          <span>{totalPassed}/7 Terpenuhi</span>
        </span>
      </div>

      {/* Daftar Gerbang Ringkas */}
      <div className="space-y-1.5">
        {gates.map((gate) => (
          <div
            key={gate.id}
            className="flex items-center justify-between gap-2.5 py-1 text-xs text-ink"
          >
            <div className="flex items-center gap-2 min-w-0">
              {gate.passed ? (
                <IconCheckCircle className="size-3.5 text-emerald-600 shrink-0" />
              ) : (
                <IconExclamationTriangle className="size-3.5 text-amber-600 shrink-0" />
              )}
              <span className={`truncate text-xs ${gate.passed ? 'text-ink' : 'text-amber-900 font-medium'}`}>
                {gate.title}
              </span>
            </div>

            <span
              className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                gate.passed
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/60'
              }`}
            >
              {gate.passed ? 'Lolos' : 'Tertunda'}
            </span>
          </div>
        ))}
      </div>

      {/* Rincian Reviewer (jika ada) */}
      {!compact && reviewers.length > 0 && (
        <div className="pt-2.5 border-t border-slate-900/[0.06] space-y-2">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
            Catatan Telaah Reviewer ({reviewers.length})
          </span>
          <div className="space-y-1.5">
            {reviewers.map((rev) => {
              const dosen = rev.reviewer;
              const isLayak = rev.hasil_versi_terkini === 'LAYAK';
              const isBelum = rev.hasil_versi_terkini === 'BELUM_DIREVIEW';

              return (
                <div
                  key={rev.penugasan_id}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-900/[0.06] bg-slate-50/60 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-6 rounded-full bg-slate-200/70 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      <IconUser className="size-3" />
                    </div>
                    <span className="font-semibold text-ink truncate text-xs">
                      {dosen?.nama_lengkap || 'Dosen Reviewer'}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                      isLayak
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isBelum
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {isLayak ? (
                      <IconCheckCircle className="size-2.5 text-emerald-600" />
                    ) : (
                      <IconClock className="size-2.5 text-amber-600" />
                    )}
                    <span>{rev.hasil_versi_terkini}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
