import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { IconSpinner } from './Icons.jsx';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function PdfPreview({ url, title }) {
  const canvasRef = useRef(null);
  const [document, setDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadingTask = getDocument({ url });

    setDocument(null);
    setPageNumber(1);
    setLoading(true);
    setError('');

    loadingTask.promise
      .then((pdfDocument) => {
        if (!active) {
          pdfDocument.destroy();
          return;
        }
        setDocument(pdfDocument);
      })
      .catch(() => {
        if (active) {
          setError('Pratinjau PDF tidak dapat ditampilkan. Unduh berkas untuk membukanya di perangkat Anda.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
      loadingTask.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!document) return undefined;

    let active = true;
    let page;
    let renderTask;

    async function renderPage() {
      try {
        setLoading(true);
        setError('');
        page = await document.getPage(pageNumber);
        if (!active) return;

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d', { alpha: false });
        if (!canvas || !context) throw new Error('Canvas tidak tersedia.');

        const viewport = page.getViewport({ scale: 1.35 });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
        });
        await renderTask.promise;
      } catch (renderError) {
        if (active && renderError?.name !== 'RenderingCancelledException') {
          setError('Halaman PDF tidak dapat dirender. Unduh berkas untuk membukanya di perangkat Anda.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    renderPage();
    return () => {
      active = false;
      renderTask?.cancel();
      page?.cleanup();
    };
  }, [document, pageNumber]);

  if (error) {
    return (
      <div className="grid h-full place-items-center p-6 text-center" role="alert">
        <p className="max-w-md text-sm leading-6 text-secondary">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-slate-900/[0.08] bg-white" aria-label={`Pratinjau ${title}`}>
      {document && (
        <div className="flex min-h-11 items-center justify-center gap-3 border-b border-slate-900/[0.08] bg-white px-3 text-xs text-secondary">
          <button
            type="button"
            className="rounded-lg border border-line px-3 py-1.5 font-semibold text-secondary disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
            disabled={pageNumber <= 1 || loading}
          >
            Sebelumnya
          </button>
          <span aria-live="polite">Halaman {pageNumber} dari {document.numPages}</span>
          <button
            type="button"
            className="rounded-lg border border-line px-3 py-1.5 font-semibold text-secondary disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setPageNumber((page) => Math.min(document.numPages, page + 1))}
            disabled={pageNumber >= document.numPages || loading}
          >
            Berikutnya
          </button>
        </div>
      )}

      <div className="relative flex-1 overflow-auto bg-slate-200/60 p-3 sm:p-5">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-slate-100/80" role="status">
            <span className="flex items-center gap-2 text-xs text-secondary">
              <IconSpinner className="size-5 text-brand" /> Memuat halaman PDF…
            </span>
          </div>
        )}
        <canvas ref={canvasRef} className="mx-auto block h-auto max-w-full bg-white shadow-sm" />
      </div>
    </div>
  );
}
