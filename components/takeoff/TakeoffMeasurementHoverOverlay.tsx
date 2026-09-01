'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { DrawingGeometry, NormalizedPoint } from '@/lib/takeoff/geometry';
import { formatTakeoffMeasurement } from '@/lib/takeoff/lengthFormat';
import styles from './TakeoffMeasurementHoverOverlay.module.css';

type Props = {
  measurements: any[];
  outputs: any[];
  assemblies: any[];
  versions: any[];
  pageWidth: number;
  pageHeight: number;
  tool: string;
  panning: boolean;
  spaceHeld: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  onSelectMeasurement: (measurement: any) => void;
  onEditMeasurement: (measurement: any) => void;
};

type HoverState = { measurement: any; left: number; top: number };

const CONCRETE = /concrete|ready.?mix/;
const REINFORCING = /rebar|reinforc|mesh/;
const FORMWORK = /form|shor|brace/;
const quantity = (value: unknown, digits = 2) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });
const textKey = (output: any) => `${output.component_key || ''} ${output.label || ''}`.toLowerCase();

const normalizedPoints = (points: any): NormalizedPoint[] => Array.isArray(points)
  ? points.filter((point: any) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)))
    .map((point: any) => ({ x: Number(point.x), y: Number(point.y) }))
  : [];

const drawingGeometry = (raw: any): DrawingGeometry | null => {
  if (!raw || !['polyline', 'polygon', 'count'].includes(raw.type)) return null;
  const points = normalizedPoints(raw.points);
  if (!points.length) return null;
  const holes = raw.type === 'polygon' && Array.isArray(raw.holes)
    ? raw.holes.map(normalizedPoints).filter((hole: NormalizedPoint[]) => hole.length >= 3)
    : undefined;
  return { type: raw.type, points, ...(holes?.length ? { holes } : {}) } as DrawingGeometry;
};

const pathForGeometry = (geometry: DrawingGeometry, width: number, height: number) => {
  const ring = (points: NormalizedPoint[]) => points.length
    ? `M ${points.map(point => `${point.x * width} ${point.y * height}`).join(' L ')} Z`
    : '';
  return [ring(geometry.points), ...(geometry.holes || []).map(ring)].filter(Boolean).join(' ');
};

const categoryValue = (outputs: any[], match: RegExp) => {
  const relevant = outputs.filter(output => match.test(textKey(output)) && (output.is_active !== false || output.pricing_status === 'missing_input'));
  if (!relevant.length) return '—';
  if (relevant.some(output => output.pricing_status === 'missing_input')) return 'HOLD';
  const totals = new Map<string, number>();
  for (const output of relevant.filter(output => output.is_active !== false)) {
    const unit = String(output.production_unit || '').toUpperCase() || 'EA';
    totals.set(unit, (totals.get(unit) || 0) + Number(output.production_quantity || 0));
  }
  return [...totals].map(([unit, value]) => `${quantity(value)} ${unit}`).join(' + ') || '—';
};

const missingLabels = (outputs: any[]) => [...new Set(outputs.flatMap(output => {
  if (output.pricing_status !== 'missing_input') return [];
  const missing = Array.isArray(output.formula_trace?.missing_inputs) ? output.formula_trace.missing_inputs : [];
  return missing.map((input: any) => String(input?.label || '').trim()).filter(Boolean);
}))];

const dimensionSummary = (measurement: any) => {
  const values = measurement.variables || {};
  const width = Number(values.width_in);
  const depth = Number(values.depth_in);
  const thickness = Number(values.thickness_in);
  const height = Number(values.height_in);
  if (width > 0 && depth > 0) return `${quantity(width)}″ W × ${quantity(depth)}″ D`;
  if (width > 0 && height > 0) return `${quantity(width)}″ W × ${quantity(height)}″ H`;
  if (thickness > 0) return `${quantity(thickness)}″ thick`;
  if (width > 0) return `${quantity(width)}″ wide`;
  return null;
};

export function TakeoffMeasurementHoverOverlay({
  measurements,
  outputs,
  assemblies,
  versions,
  pageWidth,
  pageHeight,
  tool,
  panning,
  spaceHeld,
  viewportRef,
  onSelectMeasurement,
  onEditMeasurement,
}: Props) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const versionMap = useMemo(() => new Map(versions.map((version: any) => [version.id, version])), [versions]);
  const assemblyMap = useMemo(() => new Map(assemblies.map((assembly: any) => [assembly.id, assembly])), [assemblies]);
  const outputsByMeasurement = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const output of outputs) {
      const list = map.get(output.measurement_id) || [];
      list.push(output);
      map.set(output.measurement_id, list);
    }
    return map;
  }, [outputs]);

  useEffect(() => {
    if (tool !== 'select' || panning || spaceHeld) setHover(null);
  }, [tool, panning, spaceHeld]);

  const show = (event: React.PointerEvent<SVGGElement>, measurement: any) => {
    if (tool !== 'select' || panning || spaceHeld) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const cardWidth = 292;
    const cardHeight = 184;
    let left = event.clientX + 14;
    let top = event.clientY + 14;
    if (left + cardWidth > rect.right - 8) left = event.clientX - cardWidth - 14;
    if (top + cardHeight > rect.bottom - 8) top = event.clientY - cardHeight - 14;
    left = Math.max(rect.left + 8, Math.min(left, rect.right - cardWidth - 8));
    top = Math.max(rect.top + 8, Math.min(top, rect.bottom - cardHeight - 8));
    setHover({ measurement, left, top });
  };

  const hoveredOutputs = hover ? outputsByMeasurement.get(hover.measurement.id) || [] : [];
  const hoveredVersion: any = hover ? versionMap.get(hover.measurement.assembly_version_id) : null;
  const hoveredAssembly: any = hoveredVersion ? assemblyMap.get(hoveredVersion.assembly_id) : null;
  const holds = hover ? missingLabels(hoveredOutputs) : [];
  const priceHold = hoveredOutputs.some(output => ['missing_price', 'missing_labor_rate'].includes(output.pricing_status));
  const status = holds.length ? `Input hold · ${holds.join(', ')}` : priceHold ? 'Price missing' : 'Ready';
  const dimensions = hover ? dimensionSummary(hover.measurement) : null;

  return <>
    <g pointerEvents={tool === 'select' && !panning && !spaceHeld ? 'all' : 'none'}>
      {measurements.map(measurement => {
        const geometry = drawingGeometry(measurement.geometry);
        if (!geometry) return null;
        const pointerHandlers = {
          onPointerEnter: (event: React.PointerEvent<SVGGElement>) => show(event, measurement),
          onPointerMove: (event: React.PointerEvent<SVGGElement>) => show(event, measurement),
          onPointerLeave: () => setHover(current => current?.measurement.id === measurement.id ? null : current),
          onClick: (event: React.MouseEvent<SVGGElement>) => {
            if (tool !== 'select') return;
            event.stopPropagation();
            onSelectMeasurement(measurement);
          },
          onDoubleClick: (event: React.MouseEvent<SVGGElement>) => {
            if (tool !== 'select') return;
            event.stopPropagation();
            onEditMeasurement(measurement);
          },
        };
        return <g key={`hover-${measurement.id}`} {...pointerHandlers}>
          {geometry.type === 'polygon' && <path
            d={pathForGeometry(geometry, pageWidth, pageHeight)}
            fill="transparent"
            fillRule="evenodd"
            stroke="transparent"
            strokeWidth="14"
            vectorEffect="non-scaling-stroke"
            pointerEvents="all"
          />}
          {geometry.type === 'polyline' && <polyline
            points={geometry.points.map(point => `${point.x * pageWidth},${point.y * pageHeight}`).join(' ')}
            fill="none"
            stroke="transparent"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="stroke"
          />}
          {geometry.type === 'count' && geometry.points.map((point, index) => <circle
            key={index}
            cx={point.x * pageWidth}
            cy={point.y * pageHeight}
            r="14"
            fill="transparent"
            pointerEvents="all"
          />)}
        </g>;
      })}
    </g>

    {hover && typeof document !== 'undefined' && createPortal(<div
      className={styles.card}
      style={{ left: hover.left, top: hover.top }}
      role="tooltip"
      aria-label={`${hover.measurement.name} takeoff details`}
    >
      <div className={styles.head}>
        <div><strong>{hover.measurement.name}</strong><span>{hoveredAssembly ? `${hoveredAssembly.code} · ${hoveredAssembly.name}` : 'Takeoff measurement'}</span></div>
        <b>{formatTakeoffMeasurement(hover.measurement.raw_quantity, hover.measurement.raw_unit)}</b>
      </div>
      {dimensions && <div className={styles.dimensions}>{dimensions}</div>}
      <div className={styles.outputs}>
        <span><small>Concrete</small><b>{categoryValue(hoveredOutputs, CONCRETE)}</b></span>
        <span><small>Reinforcing</small><b>{categoryValue(hoveredOutputs, REINFORCING)}</b></span>
        <span><small>Formwork</small><b>{categoryValue(hoveredOutputs, FORMWORK)}</b></span>
      </div>
      <div className={`${styles.status} ${holds.length || priceHold ? styles.statusHold : styles.statusReady}`}>{status}</div>
    </div>, document.body)}
  </>;
}
