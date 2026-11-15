import ReviewStatus from './ReviewStatus.jsx';

/**
 * Format tanggal dan waktu Indonesia
 */
function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '-';
    return (
      new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).format(d) + ' WIB'
    );
  } catch {
    return '-';
  }
}

/**
 * Riwayat Putaran Review Mahasiswa oleh Reviewer Login
 *
 * @param {object} props
 * @param {Array} [props.items=[]] - Daftar riwayat telaah putaran terdahulu
 */
export default function ReviewHistory({ items = [] }) {
  return (
    <section className="pt-4 border-t border-slate-900/[0.08] space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
          Riwayat Telaah Saya
        </h4>
        <span className="text-[11px] font-mono font-semibold text-secondary bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
          {items.length} Putaran
        </span>
      </div>

      {!items.length ? (
        <p className="text-xs text-muted py-2">
          Belum ada riwayat hasil telaah terdahulu pada pengajuan ini.
        </p>
      ) : (
        <div className="space-y-2.5">
          {[...items].reverse().map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl border border-slate-900/[0.08] bg-white space-y-2 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-ink font-mono">
                  Putaran Ke-{item.putaran_ke}
                </span>
                <ReviewStatus value={item.hasil_review} />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-900/[0.05] text-xs text-secondary leading-relaxed whitespace-pre-wrap break-words">
                {item.catatan_reviewer || (
                  <span className="text-muted italic">Tidak ada catatan perbaikan tambahan.</span>
                )}
              </div>

              <p className="text-[10px] text-muted text-right font-mono">
                {formatDateTime(item.reviewed_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
