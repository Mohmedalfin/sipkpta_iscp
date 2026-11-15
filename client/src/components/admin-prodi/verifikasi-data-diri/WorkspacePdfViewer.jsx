import { lazy, Suspense } from 'react';
import {
  IconDocumentText,
  IconExclamationCircle,
  IconSpinner,
} from '../../common/Icons.jsx';

const PdfPreview = lazy(() => import('../../common/PdfPreview.jsx'));

export default function WorkspacePdfViewer({ mobileTab, selectedDoc, selectedDocCode, previewState }) {
  return (
    <div
      className={`flex-1 min-h-0 h-full flex flex-col bg-slate-50/50 overflow-hidden ${
        mobileTab === 'docs' ? 'hidden lg:flex' : 'flex'
      }`}
    >
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/80 backdrop-blur-sm border-b border-slate-900/[0.08] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <IconDocumentText className="size-4 text-brand shrink-0" />
          <span className="text-xs font-bold text-ink truncate">
            {selectedDoc ? selectedDoc.nama_jenis : 'Pilih dokumen untuk melihat pratinjau'}
          </span>
          {selectedDoc?.dokumen_terkini && (
            <span className="text-[10px] font-mono text-muted">
              (Versi {selectedDoc.dokumen_terkini.versi})
            </span>
          )}
        </div>

        {previewState.url && (
          <a
            href={previewState.url}
            download={`${selectedDocCode || 'dokumen'}.pdf`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.08] bg-white/80 hover:bg-white px-3 py-1.5 text-[11px] font-semibold text-secondary transition-colors"
            title="Unduh berkas PDF"
          >
            <span>Unduh PDF</span>
          </a>
        )}
      </div>

      {/* PDF Viewer Body */}
      <div className="flex-1 relative flex items-center justify-center p-3 overflow-hidden">
        {previewState.loading ? (
          <div className="flex flex-col items-center gap-2 text-xs text-secondary">
            <IconSpinner className="size-7 text-brand" />
            <span>Memuat pratinjau dokumen…</span>
          </div>
        ) : previewState.error ? (
          <div className="p-6 max-w-md text-center bg-white/85 backdrop-blur-sm rounded-[18px] border border-slate-900/[0.08] shadow-none">
            <IconExclamationCircle className="size-8 text-amber-500 mx-auto mb-2" />
            <p className="text-xs text-secondary">{previewState.error}</p>
          </div>
        ) : previewState.url ? (
          <Suspense
            fallback={
              <div className="flex items-center gap-2 text-xs text-secondary" role="status">
                <IconSpinner className="size-6 text-brand" />
                <span>Menyiapkan dokumen…</span>
              </div>
            }
          >
            <PdfPreview url={previewState.url} title={selectedDoc?.nama_jenis} />
          </Suspense>
        ) : (
          <div className="text-center p-6 text-secondary text-xs">
            <IconDocumentText className="size-10 text-slate-300 mx-auto mb-2" />
            <p>Pilih salah satu dokumen dari daftar di sebelah kiri untuk melihat isi berkas PDF.</p>
          </div>
        )}
      </div>
    </div>
  );
}
