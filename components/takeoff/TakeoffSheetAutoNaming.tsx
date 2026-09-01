'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { inferSheetMetadata, type PositionedPdfText } from '@/lib/takeoff/sheetMetadata';
import { applyAutomaticSheetMetadata } from '@/app/takeoff/[setId]/sheetMetadataActions';

type Props = {
  takeoffSetId: string;
  pdfUrl: string;
  initialSheets: any[];
  locked: boolean;
};

export function TakeoffSheetAutoNaming({ takeoffSetId, pdfUrl, initialSheets, locked }: Props) {
  const router = useRouter();
  const metadataKey = useMemo(
    () => initialSheets.map(sheet => `${sheet.page_number}:${sheet.sheet_number || ''}:${sheet.title || ''}`).join('|'),
    [initialSheets],
  );

  useEffect(() => {
    if (locked || !initialSheets.length) return;
    const unresolved = initialSheets
      .filter(sheet => !String(sheet.sheet_number || '').trim() || !String(sheet.title || '').trim())
      .map(sheet => Number(sheet.page_number))
      .filter(page => Number.isInteger(page) && page > 0);
    if (!unresolved.length) return;

    let cancelled = false;
    async function inferAndPersist() {
      let pdf: any = null;
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        pdf = await pdfjs.getDocument({ url: pdfUrl }).promise;
        const candidates: { pageNumber: number; sheetNumber: string | null; title: string | null }[] = [];

        for (const pageNumber of unresolved) {
          if (cancelled || pageNumber > pdf.numPages) break;
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });
          const textContent = await page.getTextContent();
          const positioned: PositionedPdfText[] = [];
          for (const raw of textContent.items as any[]) {
            const text = String(raw?.str || '').replace(/\s+/g, ' ').trim();
            const transform = Array.isArray(raw?.transform) ? raw.transform : null;
            if (!text || !transform || transform.length < 6) continue;
            const x = Number(transform[4]);
            const y = Number(transform[5]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            positioned.push({ text, x, y, pageWidth: viewport.width, pageHeight: viewport.height });
          }
          const metadata = inferSheetMetadata(positioned);
          if (metadata.sheetNumber || metadata.title) {
            candidates.push({ pageNumber, sheetNumber: metadata.sheetNumber, title: metadata.title });
          }
          page.cleanup();
        }

        if (cancelled || !candidates.length) return;
        const result = await applyAutomaticSheetMetadata(takeoffSetId, candidates);
        if (!cancelled && result.updated > 0) router.refresh();
      } catch (error) {
        console.warn('Automatic Takeoff sheet naming skipped.', error);
      } finally {
        if (pdf) await pdf.destroy?.();
      }
    }

    void inferAndPersist();
    return () => { cancelled = true; };
  }, [takeoffSetId, pdfUrl, locked, metadataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
