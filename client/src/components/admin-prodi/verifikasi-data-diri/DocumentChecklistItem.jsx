import {
  IconDocumentText,
  IconExclamationTriangle,
  IconEye,
} from '../../common/Icons.jsx';
import StatusBadge from '../shared/StatusBadge.jsx';

export default function DocumentChecklistItem({
  doc,
  docTerkini,
  statusDokumen,
  isSelected,
  actionLoading,
  onSelect,
  onOpenRevision,
  onApproveDocument,
  formatFileSize,
  formatDate,
}) {
  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-[16px] border p-3.5 transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'border-slate-900/30 bg-white ring-1.5 ring-slate-900/15 shadow-xs'
          : 'border-slate-900/[0.08] bg-white/75 backdrop-blur-sm hover:bg-white hover:border-slate-900/[0.15]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className="size-8 rounded-full bg-white/80 border border-slate-900/[0.08] flex items-center justify-center shrink-0 mt-0.5 text-slate-700"
          >
            <IconDocumentText className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-ink leading-snug group-hover:text-brand transition-colors">
              {doc.nama_jenis}
            </p>
            {docTerkini ? (
              <p className="text-[10px] text-muted mt-0.5">
                Versi {docTerkini.versi} • {formatFileSize(docTerkini.file?.ukuran_bytes)} • Diunggah {formatDate(docTerkini.file?.diunggah_at)}
              </p>
            ) : (
              <p className="text-[10px] text-muted mt-0.5 italic">
                Belum diunggah oleh mahasiswa
              </p>
            )}
          </div>
        </div>

        {/* Status Badge per dokumen */}
        <div className="shrink-0">
          {doc.is_uploaded ? (
            <StatusBadge status={statusDokumen} size="sm" />
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/80 text-slate-500 border border-slate-900/[0.08]">
              Kosong
            </span>
          )}
        </div>
      </div>

      {/* Catatan Admin Perbaikan Terakhir (jika ada) */}
      {docTerkini?.catatan_admin && (
        <div className="mt-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
          <IconExclamationTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="font-bold">Catatan Perbaikan:</span> {docTerkini.catatan_admin}
          </div>
        </div>
      )}

      {/* Document Action Buttons */}
      {doc.is_uploaded && (
        <div className="mt-3 pt-2.5 border-t border-slate-900/[0.06] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline cursor-pointer"
          >
            <IconEye className="size-3.5" />
            <span>Lihat PDF</span>
          </button>

          <div className="flex items-center gap-1.5">
            {/* Tombol Minta Perbaikan */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenRevision();
              }}
              disabled={actionLoading}
              className="rounded-xl border border-amber-300/80 bg-amber-50/80 hover:bg-amber-100 text-amber-900 px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Minta revisi dokumen"
            >
              Minta Revisi
            </button>

            {/* Tombol Setujui */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApproveDocument();
              }}
              disabled={actionLoading || statusDokumen === 'TERVERIFIKASI'}
              className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                statusDokumen === 'TERVERIFIKASI'
                  ? 'border border-emerald-200/70 bg-emerald-50/80 text-emerald-800 cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-none'
              }`}
            >
              {statusDokumen === 'TERVERIFIKASI' ? 'Sudah ACC' : 'Setujui'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
