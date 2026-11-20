import {
  IconCheckCircle,
  IconClock,
  IconDocumentText,
  IconExclamationTriangle,
} from '../../common/Icons.jsx';

/**
 * Kartu Ringkasan Progres & Target Minimal Bimbingan Mahasiswa
 * @param {object} props
 * @param {object|null} props.progres - Objek progres dari backend
 * @param {boolean} [props.loading] - State loading
 */
export default function BimbinganProgressCard({ progres, loading = false }) {
  const jumlah = progres?.jumlah || {
    tervalidasi: 0,
    menunggu_validasi: 0,
    perlu_perbaikan: 0,
    ditolak: 0,
    draft: 0,
  };

  const minimalTarget = progres?.minimal_bimbingan || 0;
  const isTargetConfigured = Boolean(progres?.target_terkonfigurasi && minimalTarget > 0);
  const isTargetMet = Boolean(progres?.memenuhi_minimum);

  const percent = isTargetConfigured
    ? Math.min(100, Math.round((jumlah.tervalidasi / minimalTarget) * 100))
    : 0;

  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white/75 backdrop-blur-sm p-4 sm:p-5 shadow-none space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Kolom Kiri: Progress Bar & Status Pemenuhan */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Capaian Sesi Akademik
              </span>
              <h3 className="text-base font-bold text-ink">
                {isTargetConfigured ? (
                  <>
                    <span className="text-brand text-lg">{jumlah.tervalidasi}</span>
                    <span className="text-secondary font-semibold text-sm"> / {minimalTarget} Bimbingan Tervalidasi</span>
                  </>
                ) : (
                  <>
                    <span className="text-brand text-lg">{jumlah.tervalidasi}</span>
                    <span className="text-secondary font-semibold text-sm"> Bimbingan Tervalidasi</span>
                  </>
                )}
              </h3>
            </div>

            {/* Badge Kelayakan */}
            {isTargetConfigured && (
              isTargetMet ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <IconCheckCircle className="size-3.5 text-emerald-600 shrink-0" />
                  Target Terpenuhi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                  <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                  {minimalTarget - jumlah.tervalidasi} sesi lagi
                </span>
              )
            )}
          </div>

          {/* Progress Bar Visual */}
          {isTargetConfigured && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-900/[0.04]">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    isTargetMet ? 'bg-emerald-500' : 'bg-brand'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted">
                <span>{percent}% terpenuhi</span>
                <span>Minimal {minimalTarget} sesi</span>
              </div>
            </div>
          )}
        </div>

        {/* Kolom Kanan: 4 Mini KPI Cards */}
        <div className="lg:col-span-6 xl:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Card 1: Tervalidasi */}
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Tervalidasi
              </span>
              <IconCheckCircle className="size-3.5 text-emerald-600" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-emerald-900">
              {jumlah.tervalidasi}
            </p>
          </div>

          {/* Card 2: Menunggu Review */}
          <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
                Menunggu
              </span>
              <IconClock className="size-3.5 text-brand" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-brand">
              {jumlah.menunggu_validasi}
            </p>
          </div>

          {/* Card 3: Perlu Revisi */}
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                Revisi
              </span>
              <IconExclamationTriangle className="size-3.5 text-amber-600" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-amber-900">
              {jumlah.perlu_perbaikan}
            </p>
          </div>

          {/* Card 4: Draf */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Draf
              </span>
              <IconDocumentText className="size-3.5 text-muted" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-slate-700">
              {jumlah.draft}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
