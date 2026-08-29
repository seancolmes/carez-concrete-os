'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crosshair, Hand, MousePointer2, Minus, Plus, RotateCcw, Ruler, Trash2, Undo2, Check, X } from 'lucide-react';
import { createDrawingMeasurement, deleteDrawingMeasurement, initializeTakeoffSheets, saveSheetCalibration } from '@/app/takeoff/[setId]/actions';
import { measureDrawingGeometry, roundMeasurement, type DrawingGeometry, type NormalizedPoint } from '@/lib/takeoff/geometry';
import styles from './TakeoffDrawingWorkspace.module.css';

type Tool = 'select' | 'pan' | 'calibrate' | 'draw';
type Props = {
  takeoffSet: any;
  estimate: any;
  pdfUrl: string;
  sourceTitle: string;
  initialSheets: any[];
  initialMeasurements: any[];
  measurementSummaries: any[];
  assemblies: any[];
  versions: any[];
  variables: any[];
  sections: any[];
  riskClasses: any[];
  locked: boolean;
};

type RenderBox = { width: number; height: number; pdfWidth: number; pdfHeight: number };

const palette = ['#65a1ff','#75d5a7','#f2b969','#e58ca4','#9d8cff','#6fd3df','#f08a76','#b1cf68'];
const qty = (n: any, digits = 2) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: digits });
const money = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));

function hashColor(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function geometryPoints(geometry: any): NormalizedPoint[] {
  if (!geometry || !Array.isArray(geometry.points)) return [];
  return geometry.points.filter((p: any) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y))).map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function TakeoffDrawingWorkspace(props: Props) {
  const { takeoffSet, pdfUrl, sourceTitle, initialSheets, initialMeasurements, measurementSummaries, assemblies, versions, variables, sections, riskClasses, locked } = props;
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const initializingRef = useRef(false);

  const [pdfReady, setPdfReady] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState(Number(takeoffSet.page_count || initialSheets.length || 0));
  const [pageNumber, setPageNumber] = useState(initialSheets[0]?.page_number || 1);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(900);
  const [renderBox, setRenderBox] = useState<RenderBox | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [draftPoints, setDraftPoints] = useState<NormalizedPoint[]>([]);
  const [hoverPoint, setHoverPoint] = useState<NormalizedPoint | null>(null);
  const [calibrationPoints, setCalibrationPoints] = useState<NormalizedPoint[]>([]);
  const [knownDistanceFt, setKnownDistanceFt] = useState('10');
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>(assemblies[0]?.id || '');
  const [objectName, setObjectName] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [riskClassCode, setRiskClassCode] = useState('');
  const [location, setLocation] = useState('');
  const [drawingReference, setDrawingReference] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Loading PDF plans...');
  const [panning, setPanning] = useState(false);

  const latestVersionByAssembly = useMemo(() => {
    const map = new Map<string, any>();
    for (const version of versions) if (!map.has(version.assembly_id)) map.set(version.assembly_id, version);
    return map;
  }, [versions]);
  const assemblyMap = useMemo(() => new Map(assemblies.map((a: any) => [a.id, a])), [assemblies]);
  const versionMap = useMemo(() => new Map(versions.map((v: any) => [v.id, v])), [versions]);
  const selectedAssembly = assemblyMap.get(selectedAssemblyId) as any;
  const selectedVersion = selectedAssembly ? latestVersionByAssembly.get(selectedAssembly.id) : null;
  const selectedVariables = useMemo(() => selectedVersion ? variables.filter((v: any) => v.assembly_version_id === selectedVersion.id) : [], [selectedVersion, variables]);
  const currentSheet = useMemo(() => initialSheets.find((s: any) => Number(s.page_number) === pageNumber) || null, [initialSheets, pageNumber]);
  const currentMeasurements = useMemo(() => initialMeasurements.filter((m: any) => m.sheet_id === currentSheet?.id), [initialMeasurements, currentSheet]);
  const currentScale = currentSheet?.scale_status === 'calibrated';

  const summaryMap = useMemo(() => {
    const map = new Map<string, { mh: number; cost: number; missing: number }>();
    for (const row of measurementSummaries) {
      const prior = map.get(row.measurement_id) || { mh: 0, cost: 0, missing: 0 };
      prior.mh += Number(row.estimated_man_hours || 0);
      prior.cost += Number(row.direct_cost || 0);
      if (['missing_price', 'missing_labor_rate'].includes(row.pricing_status)) prior.missing += 1;
      map.set(row.measurement_id, prior);
    }
    return map;
  }, [measurementSummaries]);

  useEffect(() => {
    if (!selectedVersion) return;
    const next: Record<string, string> = {};
    for (const variable of selectedVariables) {
      if (variable.variable_key === 'perimeter_lf' && selectedAssembly?.primary_measurement === 'SF') continue;
      next[variable.variable_key] = variable.default_value === null || variable.default_value === undefined ? '' : String(variable.default_value);
    }
    setVariableValues(next);
    setRiskClassCode(selectedVersion.default_risk_class_code || '');
    setObjectName('');
    setDraftPoints([]);
    setHoverPoint(null);
  }, [selectedVersion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      try {
        setMessage('Loading PDF plans...');
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const pdf = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (cancelled) { await pdf.destroy(); return; }
        pdfRef.current = pdf;
        setPdfPageCount(pdf.numPages);
        setPdfReady(true);
        setMessage(`${pdf.numPages} sheet${pdf.numPages === 1 ? '' : 's'} loaded.`);

        const sheetComplete = initialSheets.length === pdf.numPages && initialSheets.every((s: any) => Number(s.page_width || 0) > 0 && Number(s.page_height || 0) > 0);
        if (!sheetComplete && !locked && !initializingRef.current) {
          initializingRef.current = true;
          const pages: { pageNumber: number; width: number; height: number }[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            pages.push({ pageNumber: i, width: viewport.width, height: viewport.height });
            page.cleanup();
          }
          await initializeTakeoffSheets(takeoffSet.id, pages);
          setMessage('Drawing sheets prepared.');
          router.refresh();
        }
      } catch (error: any) {
        setMessage(error?.message || 'Could not load PDF plans.');
      }
    }
    loadPdf();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
      const pdf = pdfRef.current;
      pdfRef.current = null;
      if (pdf) void pdf.destroy?.();
    };
  }, [pdfUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setFitWidth(Math.max(280, el.clientWidth - 36));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfReady || !pdfRef.current || !canvasRef.current) return;
    let cancelled = false;
    async function render() {
      try {
        renderTaskRef.current?.cancel?.();
        const page = await pdfRef.current.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const fitScale = Math.min(3, Math.max(0.12, fitWidth / base.width));
        const scale = fitScale * zoom;
        const viewport = page.getViewport({ scale });
        if (cancelled) return;
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas is unavailable.');
        const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setRenderBox({ width: viewport.width, height: viewport.height, pdfWidth: base.width, pdfHeight: base.height });
        const task = page.render({ canvasContext: context, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
        renderTaskRef.current = task;
        await task.promise;
        page.cleanup();
      } catch (error: any) {
        if (error?.name !== 'RenderingCancelledException') setMessage(error?.message || 'Could not render this PDF page.');
      }
    }
    render();
    return () => { cancelled = true; renderTaskRef.current?.cancel?.(); };
  }, [pdfReady, pageNumber, zoom, fitWidth]);

  const overlayPoint = useCallback((event: React.PointerEvent<SVGSVGElement>): NormalizedPoint | null => {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }, []);

  const preview = useMemo(() => {
    if (!renderBox || !selectedAssembly || !currentSheet || !draftPoints.length) return null;
    const type = selectedAssembly.primary_measurement === 'SF' ? 'polygon' : selectedAssembly.primary_measurement === 'EA' ? 'count' : 'polyline';
    const required = type === 'polygon' ? 3 : type === 'polyline' ? 2 : 1;
    if (draftPoints.length < required) return null;
    try {
      const measured = measureDrawingGeometry({ type, points: draftPoints } as DrawingGeometry, renderBox.pdfWidth, renderBox.pdfHeight, currentSheet.calibration);
      return { ...measured, quantity: roundMeasurement(measured.quantity), perimeterLf: roundMeasurement(measured.perimeterLf) };
    } catch { return type === 'count' ? { quantity: draftPoints.length, unit: 'EA', perimeterLf: 0 } : null; }
  }, [draftPoints, renderBox, selectedAssembly, currentSheet]);

  const finishDraft = useCallback(async () => {
    if (locked || busy || !selectedAssembly || !selectedVersion || !currentSheet || !renderBox) return;
    const geometryType: DrawingGeometry['type'] = selectedAssembly.primary_measurement === 'SF' ? 'polygon' : selectedAssembly.primary_measurement === 'EA' ? 'count' : 'polyline';
    const minimum = geometryType === 'polygon' ? 3 : geometryType === 'polyline' ? 2 : 1;
    if (draftPoints.length < minimum) { setMessage(`${selectedAssembly.primary_measurement} measurement needs at least ${minimum} point${minimum === 1 ? '' : 's'}.`); return; }
    if (!objectName.trim()) { setMessage('Name this concrete object before saving it.'); return; }
    if (geometryType !== 'count' && !currentScale) { setMessage('Calibrate this sheet before measuring length or area.'); return; }
    setBusy(true);
    try {
      const result = await createDrawingMeasurement({
        takeoffSetId: takeoffSet.id,
        sheetId: currentSheet.id,
        estimateSectionId: sectionId || null,
        assemblyVersionId: selectedVersion.id,
        name: objectName.trim(),
        location: location.trim() || null,
        drawingReference: drawingReference.trim() || null,
        riskClassCode: riskClassCode || null,
        variables: variableValues,
        geometry: { type: geometryType, points: draftPoints },
      });
      setMessage(`Saved ${objectName}: ${qty(result.quantity)} ${result.unit}${result.perimeterLf ? ` · ${qty(result.perimeterLf)} LF perimeter` : ''}.`);
      setDraftPoints([]);
      setHoverPoint(null);
      setObjectName('');
      setTool('select');
      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || 'Could not save drawing measurement.');
    } finally { setBusy(false); }
  }, [locked, busy, selectedAssembly, selectedVersion, currentSheet, renderBox, draftPoints, objectName, currentScale, takeoffSet.id, sectionId, location, drawingReference, riskClassCode, variableValues, router]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === 'Escape') { setDraftPoints([]); setCalibrationPoints([]); setHoverPoint(null); setTool('select'); return; }
      if (event.key === 'Backspace' || (event.ctrlKey && event.key.toLowerCase() === 'z')) {
        if (draftPoints.length) { event.preventDefault(); setDraftPoints(points => points.slice(0, -1)); }
        else if (calibrationPoints.length) { event.preventDefault(); setCalibrationPoints(points => points.slice(0, -1)); }
        return;
      }
      if (event.key === 'Enter' && tool === 'draw') { event.preventDefault(); void finishDraft(); return; }
      if (event.key.toLowerCase() === 'v') setTool('select');
      if (event.key.toLowerCase() === 'h') setTool('pan');
      if (event.key.toLowerCase() === 'c' && !locked) { setCalibrationPoints([]); setTool('calibrate'); }
      if (event.key.toLowerCase() === 'm' && !locked) setTool('draw');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [draftPoints.length, calibrationPoints.length, tool, locked, finishDraft]);

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (tool === 'pan' || event.button === 1) {
      event.preventDefault();
      const viewport = viewportRef.current;
      if (!viewport) return;
      panRef.current = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      setPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (locked && tool !== 'select') return;
    const point = overlayPoint(event);
    if (!point) return;
    if (tool === 'calibrate') {
      setCalibrationPoints(points => points.length >= 2 ? [point] : [...points, point]);
      return;
    }
    if (tool === 'draw') {
      if (!selectedAssembly) { setMessage('Choose a concrete assembly first.'); return; }
      if (selectedAssembly.primary_measurement !== 'EA' && !currentScale) { setMessage('Calibrate this sheet before measuring LF or SF.'); return; }
      setDraftPoints(points => [...points, point]);
      return;
    }
    if (tool === 'select') setSelectedMeasurementId(null);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (panRef.current && panning) {
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.scrollLeft = panRef.current.left - (event.clientX - panRef.current.x);
      viewport.scrollTop = panRef.current.top - (event.clientY - panRef.current.y);
      return;
    }
    if (tool === 'draw' || tool === 'calibrate') setHoverPoint(overlayPoint(event));
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (panRef.current) {
      panRef.current = null;
      setPanning(false);
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    }
  }

  async function saveCalibration() {
    if (locked || busy || !currentSheet || !renderBox) return;
    if (calibrationPoints.length !== 2) { setMessage('Click two endpoints of a known dimension first.'); return; }
    const known = Number(knownDistanceFt);
    if (!(known > 0)) { setMessage('Enter the known distance in feet.'); return; }
    setBusy(true);
    try {
      await saveSheetCalibration({ sheetId: currentSheet.id, pageWidth: renderBox.pdfWidth, pageHeight: renderBox.pdfHeight, points: calibrationPoints, knownDistanceFt: known });
      setCalibrationPoints([]);
      setHoverPoint(null);
      setTool('select');
      setMessage(`Scale saved from ${qty(known)} FT known dimension.`);
      router.refresh();
    } catch (error: any) { setMessage(error?.message || 'Could not save sheet scale.'); }
    finally { setBusy(false); }
  }

  async function removeSelected() {
    if (!selectedMeasurementId || locked || busy) return;
    setBusy(true);
    try {
      await deleteDrawingMeasurement(selectedMeasurementId, takeoffSet.id);
      setMessage('Takeoff object and its generated estimate lines were removed.');
      setSelectedMeasurementId(null);
      router.refresh();
    } catch (error: any) { setMessage(error?.message || 'Could not delete object.'); }
    finally { setBusy(false); }
  }

  function changePage(next: number) {
    setPageNumber(next);
    setDraftPoints([]);
    setCalibrationPoints([]);
    setHoverPoint(null);
    setSelectedMeasurementId(null);
    setTool('select');
    setZoom(1);
  }

  const selectedMeasurement = initialMeasurements.find((m: any) => m.id === selectedMeasurementId) || null;
  const selectedSummary = selectedMeasurement ? summaryMap.get(selectedMeasurement.id) : null;
  const pageEntries = Array.from({ length: pdfPageCount || initialSheets.length || 1 }, (_, index) => {
    const number = index + 1;
    return initialSheets.find((s: any) => Number(s.page_number) === number) || { id: `pending-${number}`, page_number: number, scale_status: 'uncalibrated' };
  });

  const drawingTypeLabel = selectedAssembly?.primary_measurement === 'SF' ? 'Area Polygon' : selectedAssembly?.primary_measurement === 'EA' ? 'Count Points' : 'Linear Polyline';
  const overlayClass = tool === 'pan' ? (panning ? styles.overlayPanning : styles.overlayPan) : tool === 'select' ? styles.overlaySelect : '';
  const draftRenderPoints = hoverPoint && (tool === 'draw' || tool === 'calibrate') ? [...(tool === 'draw' ? draftPoints : calibrationPoints), hoverPoint] : (tool === 'draw' ? draftPoints : calibrationPoints);

  return <section className="section">
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <div className={styles.panelHeader}><div className={styles.panelTitle}>Drawing Sheets</div><div className={styles.panelMeta}>{sourceTitle} · {pdfPageCount || '…'} pages</div></div>
        <div className={styles.sheetList}>{pageEntries.map((sheet: any) => {
          const objects = initialMeasurements.filter((m: any) => m.sheet_id === sheet.id).length;
          return <button key={sheet.page_number} type="button" className={`${styles.sheetButton} ${pageNumber === sheet.page_number ? styles.sheetButtonActive : ''}`} onClick={() => changePage(sheet.page_number)}>
            <span className={styles.pageBadge}>{sheet.sheet_number || `P${sheet.page_number}`}</span>
            <span><span className={styles.sheetName}>{sheet.title || `PDF Page ${sheet.page_number}`}</span><span className={`${styles.sheetStatus} ${sheet.scale_status === 'calibrated' ? styles.sheetStatusReady : styles.sheetStatusHold}`}>{sheet.scale_status === 'calibrated' ? 'SCALE READY' : 'NEEDS SCALE'} · {objects} object{objects === 1 ? '' : 's'}</span></span>
          </button>;
        })}</div>
      </aside>

      <div className={styles.center}>
        <div className={styles.toolbar}>
          <button type="button" title="Select (V)" className={`${styles.toolButton} ${tool === 'select' ? styles.toolButtonActive : ''}`} onClick={() => setTool('select')}><MousePointer2 size={15}/> Select</button>
          <button type="button" title="Pan (H)" className={`${styles.toolButton} ${tool === 'pan' ? styles.toolButtonActive : ''}`} onClick={() => setTool('pan')}><Hand size={15}/> Pan</button>
          <button type="button" disabled={locked} title="Calibrate scale (C)" className={`${styles.toolButton} ${tool === 'calibrate' ? styles.toolButtonActive : ''}`} onClick={() => { setCalibrationPoints([]); setTool('calibrate'); }}><Ruler size={15}/> Calibrate</button>
          <button type="button" disabled={locked || !selectedAssembly} title="Measure (M)" className={`${styles.toolButton} ${tool === 'draw' ? styles.toolButtonActive : ''}`} onClick={() => { setDraftPoints([]); setTool('draw'); }}><Crosshair size={15}/> {drawingTypeLabel || 'Measure'}</button>
          <button type="button" disabled={!draftPoints.length && !calibrationPoints.length} className={styles.toolButton} title="Undo point (Backspace / Ctrl+Z)" onClick={() => tool === 'calibrate' ? setCalibrationPoints(p => p.slice(0,-1)) : setDraftPoints(p => p.slice(0,-1))}><Undo2 size={15}/> Undo</button>
          {tool === 'draw' && <button type="button" disabled={busy || !draftPoints.length} className={styles.toolButton} title="Finish measurement (Enter)" onClick={() => void finishDraft()}><Check size={15}/> Finish</button>}
          {(tool === 'draw' || tool === 'calibrate') && <button type="button" className={styles.toolButton} onClick={() => { setDraftPoints([]); setCalibrationPoints([]); setHoverPoint(null); setTool('select'); }}><X size={15}/> Cancel</button>}
          <span className={styles.toolbarSpacer}/>
          <button type="button" className={styles.toolButton} onClick={() => setZoom(z => Math.max(.35, Number((z - .15).toFixed(2))))}><Minus size={14}/></button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button type="button" className={styles.toolButton} onClick={() => setZoom(z => Math.min(3.5, Number((z + .15).toFixed(2))))}><Plus size={14}/></button>
          <button type="button" title="Fit width" className={styles.toolButton} onClick={() => setZoom(1)}><RotateCcw size={14}/></button>
        </div>

        <div ref={viewportRef} className={styles.canvasViewport}>
          {!renderBox && <div className={styles.loading}>{message}</div>}
          <div className={styles.paper} style={renderBox ? { width: renderBox.width, height: renderBox.height } : { width: 1, height: 1 }}>
            <canvas ref={canvasRef} className={styles.pdfCanvas}/>
            {renderBox && <svg
              className={`${styles.overlay} ${overlayClass}`}
              viewBox={`0 0 ${renderBox.pdfWidth} ${renderBox.pdfHeight}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={() => { if (!panning) setHoverPoint(null); }}
            >
              {currentMeasurements.map((measurement: any) => {
                const points = geometryPoints(measurement.geometry);
                if (!points.length) return null;
                const version: any = versionMap.get(measurement.assembly_version_id);
                const assembly: any = version ? assemblyMap.get(version.assembly_id) : null;
                const color = hashColor(assembly?.code || measurement.assembly_version_id || measurement.id);
                const selected = selectedMeasurementId === measurement.id;
                const coords = points.map(p => `${p.x * renderBox.pdfWidth},${p.y * renderBox.pdfHeight}`).join(' ');
                const first = points[0];
                const onSelect = (event: React.MouseEvent) => { if (tool === 'select') { event.stopPropagation(); setSelectedMeasurementId(measurement.id); } };
                return <g key={measurement.id} onClick={onSelect} style={{ cursor: tool === 'select' ? 'pointer' : undefined }}>
                  {measurement.geometry?.type === 'polygon' && <polygon points={coords} fill={`${color}30`} stroke={color} strokeWidth={selected ? 3.2 : 2} vectorEffect="non-scaling-stroke"/>}
                  {measurement.geometry?.type === 'polyline' && <polyline points={coords} fill="none" stroke={color} strokeWidth={selected ? 4 : 2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}
                  {measurement.geometry?.type === 'count' && points.map((p, i) => <g key={i}><circle cx={p.x * renderBox.pdfWidth} cy={p.y * renderBox.pdfHeight} r={selected ? 6 : 5} fill={`${color}55`} stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/><line x1={p.x*renderBox.pdfWidth-5} y1={p.y*renderBox.pdfHeight} x2={p.x*renderBox.pdfWidth+5} y2={p.y*renderBox.pdfHeight} stroke={color} vectorEffect="non-scaling-stroke"/><line x1={p.x*renderBox.pdfWidth} y1={p.y*renderBox.pdfHeight-5} x2={p.x*renderBox.pdfWidth} y2={p.y*renderBox.pdfHeight+5} stroke={color} vectorEffect="non-scaling-stroke"/></g>)}
                  <g transform={`translate(${first.x * renderBox.pdfWidth} ${first.y * renderBox.pdfHeight})`}><rect x="5" y="-17" width={Math.max(74, Math.min(190, measurement.name.length*6+62))} height="19" rx="4" fill="rgba(5,11,20,.88)" stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke"/><text x="10" y="-4" fill="#f3f7ff" fontSize="9" fontWeight="700">{measurement.name} · {qty(measurement.raw_quantity)} {measurement.raw_unit}</text></g>
                </g>;
              })}

              {tool === 'draw' && draftRenderPoints.length > 0 && <g pointerEvents="none">
                {selectedAssembly?.primary_measurement === 'SF' && draftRenderPoints.length >= 2 && <polygon points={draftRenderPoints.map(p=>`${p.x*renderBox.pdfWidth},${p.y*renderBox.pdfHeight}`).join(' ')} fill="rgba(95,134,239,.17)" stroke="#79a0ff" strokeWidth="2" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
                {selectedAssembly?.primary_measurement === 'LF' && draftRenderPoints.length >= 2 && <polyline points={draftRenderPoints.map(p=>`${p.x*renderBox.pdfWidth},${p.y*renderBox.pdfHeight}`).join(' ')} fill="none" stroke="#79a0ff" strokeWidth="2.5" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
                {(selectedAssembly?.primary_measurement === 'EA' ? draftPoints : draftPoints).map((p,i)=><circle key={i} cx={p.x*renderBox.pdfWidth} cy={p.y*renderBox.pdfHeight} r="4" fill="#79a0ff" stroke="#06101d" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}
              </g>}

              {tool === 'calibrate' && draftRenderPoints.length > 0 && <g pointerEvents="none">
                {draftRenderPoints.length >= 2 && <line x1={draftRenderPoints[0].x*renderBox.pdfWidth} y1={draftRenderPoints[0].y*renderBox.pdfHeight} x2={draftRenderPoints[1].x*renderBox.pdfWidth} y2={draftRenderPoints[1].y*renderBox.pdfHeight} stroke="#f3bd62" strokeWidth="2.5" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
                {calibrationPoints.map((p,i)=><circle key={i} cx={p.x*renderBox.pdfWidth} cy={p.y*renderBox.pdfHeight} r="5" fill="#f3bd62" stroke="#06101d" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}
              </g>}
            </svg>}
          </div>
          {message && <div className={styles.message}>{message}</div>}
        </div>
      </div>

      <aside className={styles.inspector}>
        <div className={styles.panelHeader}><div className={styles.panelTitle}>Takeoff Inspector</div><div className={styles.panelMeta}>{currentSheet ? `Page ${currentSheet.page_number} · ${currentScale ? 'calibrated' : 'scale required'}` : 'Preparing sheet metadata'}</div></div>
        <div className={styles.inspectorBody}>
          <div className={styles.group}>
            <div className={styles.groupTitle}>Sheet Scale</div>
            {currentScale ? <div className={styles.statusGood}>Scale calibrated · {qty(currentSheet?.calibration?.known_distance_ft)} FT known dimension · {qty(currentSheet?.calibration?.ft_per_pdf_unit, 5)} ft/PDF-unit.</div> : <div className={styles.statusWarn}>LF and SF takeoff stays blocked until this page is calibrated from a known dimension.</div>}
            {!locked && <><label className={styles.field}><span>Known Distance (FT)</span><input value={knownDistanceFt} onChange={e=>setKnownDistanceFt(e.target.value)} inputMode="decimal"/></label><div className={styles.buttonRow}><button type="button" className={styles.secondary} onClick={()=>{setCalibrationPoints([]);setTool('calibrate')}}>Pick 2 Points</button><button type="button" className={styles.primary} disabled={calibrationPoints.length!==2||busy} onClick={()=>void saveCalibration()}>Save Scale</button></div><div className={styles.panelMeta}>Use an explicit dimension line on this sheet. Do not calibrate from a guessed wall length.</div></>}
          </div>

          <div className={styles.group}>
            <div className={styles.groupTitle}>Concrete Assembly</div>
            <label className={styles.field}><span>Assembly</span><select value={selectedAssemblyId} disabled={locked} onChange={e=>{setSelectedAssemblyId(e.target.value);setTool('select')}}>{assemblies.map((a:any)=><option key={a.id} value={a.id}>{a.code} — {a.name} ({a.primary_measurement})</option>)}</select></label>
            {selectedVersion && <div className={styles.statusInfo}>V{selectedVersion.version_no} · {selectedVersion.source_label || 'Carez assembly'}<br/>{selectedVersion.source_reference}</div>}
            <label className={styles.field}><span>Object / Area Name</span><input value={objectName} disabled={locked} onChange={e=>setObjectName(e.target.value)} placeholder={selectedAssembly?.name || 'North Wall'}/></label>
            <div className={styles.inline}><label className={styles.field}><span>Scope Area</span><select value={sectionId} disabled={locked} onChange={e=>setSectionId(e.target.value)}><option value="">Unassigned</option>{sections.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className={styles.field}><span>L&I Phase</span><select value={riskClassCode} disabled={locked} onChange={e=>setRiskClassCode(e.target.value)}><option value="">Review</option>{riskClasses.map((r:any)=><option key={`${r.code}-${r.tax_year}`} value={r.code}>{r.code}</option>)}</select></label></div>
            <label className={styles.field}><span>Location / Zone</span><input value={location} disabled={locked} onChange={e=>setLocation(e.target.value)} placeholder="Garage / NW / Phase 1"/></label>
            <label className={styles.field}><span>Drawing Reference (optional)</span><input value={drawingReference} disabled={locked} onChange={e=>setDrawingReference(e.target.value)} placeholder={`Page ${pageNumber} / Detail ...`}/></label>
            {selectedVariables.map((variable:any)=>{
              if (variable.variable_key==='perimeter_lf' && selectedAssembly?.primary_measurement==='SF') return <div key={variable.id} className={styles.statusInfo}><strong>Formed perimeter:</strong> {preview ? `${qty(preview.perimeterLf)} LF from polygon geometry` : 'Carez will derive this automatically from the slab polygon.'}</div>;
              return <label className={styles.field} key={variable.id}><span>{variable.label}{variable.unit?` (${variable.unit})`:''}</span><input type={variable.value_type==='number'?'number':'text'} step="any" min={variable.min_value??undefined} max={variable.max_value??undefined} value={variableValues[variable.variable_key]??''} disabled={locked} onChange={e=>setVariableValues(v=>({...v,[variable.variable_key]:e.target.value}))} placeholder={variable.default_value===null?'Required from plans':undefined}/><small>{variable.help_text}</small></label>;
            })}
            {preview && <div className={styles.statusGood}><strong>Measured:</strong> {qty(preview.quantity)} {preview.unit}{preview.perimeterLf?` · ${qty(preview.perimeterLf)} LF perimeter`:''}. Server will recompute this geometry before it reaches the estimate.</div>}
            {!locked && <div className={styles.buttonRow}><button type="button" className={styles.primary} onClick={()=>{setDraftPoints([]);setTool('draw')}}>Start {drawingTypeLabel}</button><button type="button" className={styles.secondary} disabled={!draftPoints.length||busy} onClick={()=>void finishDraft()}>Finish / Save</button></div>}
          </div>

          <div className={styles.group}>
            <div className={styles.groupTitle}>Objects on This Sheet</div>
            {currentMeasurements.length===0?<div className={styles.panelMeta}>No graphical takeoff objects on this page yet.</div>:<div className={styles.objectList}>{currentMeasurements.map((m:any)=>{const version:any=versionMap.get(m.assembly_version_id);const assembly:any=version?assemblyMap.get(version.assembly_id):null;const summary=summaryMap.get(m.id);return <button type="button" key={m.id} className={`${styles.objectButton} ${selectedMeasurementId===m.id?styles.objectSelected:''}`} onClick={()=>{setSelectedMeasurementId(m.id);setTool('select')}}><div className={styles.objectTitle}>{m.name}</div><div className={styles.objectMeta}>{assembly?.code||'Assembly'} · {qty(m.raw_quantity)} {m.raw_unit} · {qty(summary?.mh,1)} MH · {money(summary?.cost)}</div></button>})}</div>}
            {selectedMeasurement && <><div className={selectedSummary?.missing?styles.statusWarn:styles.statusGood}><strong>{selectedMeasurement.name}</strong><br/>{qty(selectedMeasurement.raw_quantity)} {selectedMeasurement.raw_unit} · {qty(selectedSummary?.mh,1)} MH · {money(selectedSummary?.cost)}{selectedSummary?.missing?` · ${selectedSummary.missing} price hold(s)`:''}</div>{!locked&&<button type="button" className={styles.danger} disabled={busy} onClick={()=>void removeSelected()}><Trash2 size={13}/> Delete Object + Estimate Lines</button>}</>}
          </div>

          <div className={styles.group}>
            <div className={styles.groupTitle}>Keyboard</div>
            <div className={styles.shortcut}><kbd>V</kbd><span>Select</span><kbd>H</kbd><span>Pan</span><kbd>C</kbd><span>Calibrate</span><kbd>M</kbd><span>Measure</span><kbd>Enter</kbd><span>Finish measurement</span><kbd>Esc</kbd><span>Cancel</span><kbd>⌫</kbd><span>Undo last point</span></div>
          </div>
        </div>
      </aside>
    </div>
  </section>;
}
