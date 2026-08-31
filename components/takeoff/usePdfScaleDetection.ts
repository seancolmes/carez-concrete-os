'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { detectScaleCandidates, type ScaleCandidate } from '@/lib/takeoff/scaleRegions';

export function usePdfScaleDetection(pdfRef: MutableRefObject<any>, pdfReady: boolean, pageNumber: number) {
  const cacheRef = useRef(new Map<number, ScaleCandidate[]>());
  const [candidates, setCandidates] = useState<ScaleCandidate[]>([]);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'ready' | 'none' | 'error'>('idle');

  useEffect(() => {
    if (!pdfReady || !pdfRef.current) return;
    const cached = cacheRef.current.get(pageNumber);
    if (cached) {
      setCandidates(cached);
      setStatus(cached.length ? 'ready' : 'none');
      return;
    }

    let cancelled = false;
    async function scan() {
      setCandidates([]);
      setStatus('scanning');
      try {
        const page = await pdfRef.current.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const detected = detectScaleCandidates(content.items as any[], viewport.width, viewport.height, pageNumber);
        page.cleanup();
        if (cancelled) return;
        cacheRef.current.set(pageNumber, detected);
        setCandidates(detected);
        setStatus(detected.length ? 'ready' : 'none');
      } catch {
        if (!cancelled) {
          setCandidates([]);
          setStatus('error');
        }
      }
    }
    void scan();
    return () => { cancelled = true; };
  }, [pdfReady, pageNumber, pdfRef]);

  return { candidates, status };
}
