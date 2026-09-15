export type PlanTextureSize = { width: number; height: number; scale: number };

export function computePlanTextureSize(pageWidth: number, pageHeight: number, viewportWidth: number, viewportHeight: number): PlanTextureSize {
  if (![pageWidth, pageHeight, viewportWidth, viewportHeight].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('The PDF texture needs valid page and viewport dimensions.');
  }
  const scale = Math.min(2 * Math.min(viewportWidth / pageWidth, viewportHeight / pageHeight), 4096 / Math.max(pageWidth, pageHeight));
  return { width: Math.max(1, Math.round(pageWidth * scale)), height: Math.max(1, Math.round(pageHeight * scale)), scale };
}

export async function renderPdfPageCanvas(pdfUrl: string, pageNumber: number, target: PlanTextureSize, signal?: AbortSignal): Promise<HTMLCanvasElement> {
  signal?.throwIfAborted();
  const pdfjs = await import('pdfjs-dist');
  signal?.throwIfAborted();
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const loadingTask = pdfjs.getDocument({ url: pdfUrl });
  let renderTask: ReturnType<import('pdfjs-dist').PDFPageProxy['render']> | undefined;
  let page: import('pdfjs-dist').PDFPageProxy | undefined;
  let destruction: Promise<void> | undefined;
  const destroy = () => destruction ??= loadingTask.destroy();
  const abort = () => { renderTask?.cancel(); void destroy().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    const pdf = await loadingTask.promise;
    page = await pdf.getPage(pageNumber);
    signal?.throwIfAborted();
    // Stored sheet dimensions may use another PDF display scale. Rasterize from
    // this page's intrinsic viewport so that the texture still respects the cap.
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(target.width / base.width, target.height / base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('PDF texture canvas is unavailable.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    renderTask = page.render({ canvasContext: context, viewport });
    await renderTask.promise;
    signal?.throwIfAborted();
    return canvas;
  } finally {
    signal?.removeEventListener('abort', abort);
    page?.cleanup();
    await destroy();
  }
}
