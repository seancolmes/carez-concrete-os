'use client';

import { Component, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Eye, EyeOff, Focus, RotateCcw } from 'lucide-react';
import type { Derived3DIssue, Derived3DPlanPoint, Derived3DScene, Derived3DSolid } from '@/lib/takeoff/conditions/derived3d';
import styles from './TakeoffDerived3DView.module.css';
import { Button } from '@/components/ui/button';
import { formatArchitecturalLength } from '@/lib/takeoff/lengthFormat';

type Props = {
  scene: Derived3DScene;
  viewState: Derived3DViewState;
  onViewStateChange: (value: Derived3DViewState | ((current: Derived3DViewState) => Derived3DViewState)) => void;
  memory: Derived3DViewMemory;
  activeSheetId: string | null;
  activeSheetLabel: string;
  selectedConditionVersionId: string | null;
  selectedMeasurementId: string | null;
  onSelectSolid: (solid: Derived3DSolid) => void;
  onJumpToIssue: (issue: Derived3DIssue) => void;
};

type Point3 = { x: number; y: number; z: number };
type ProjectedPoint = { x: number; y: number; depth: number };
type Camera = { yaw: number; pitch: number; zoom: number; panX: number; panY: number };
type Drag = { mode: 'orbit' | 'pan'; x: number; y: number; camera: Camera; pointerId: number; solidId: string | null } | null;
export type Derived3DViewState = { hidden: string[]; isolated: string | null; zone: string; elevation: string };
export type Derived3DViewMemory = Map<string, { camera: Camera; center: Point3 | null }>;
type RenderFace = {
  key: string;
  solid: Derived3DSolid;
  path: string;
  depth: number;
  opacity: number;
  top: boolean;
};

const DEFAULT_CAMERA: Camera = { yaw: -Math.PI / 4, pitch: -0.58, zoom: 1, panX: 0, panY: 0 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function boxCorners(solid: Derived3DSolid): Point3[] {
  if (solid.shape.kind !== 'box') return [];
  const shape = solid.shape;
  const halfLength = shape.length / 2;
  const halfWidth = shape.width / 2;
  const cos = Math.cos(shape.yawRad);
  const sin = Math.sin(shape.yawRad);
  const plan = [
    { x: -halfLength, z: -halfWidth },
    { x: halfLength, z: -halfWidth },
    { x: halfLength, z: halfWidth },
    { x: -halfLength, z: halfWidth },
  ].map(point => ({
    x: shape.centerX + point.x * cos - point.z * sin,
    z: shape.centerZ + point.x * sin + point.z * cos,
  }));
  return [
    ...plan.map(point => ({ ...point, y: shape.bottom })),
    ...plan.map(point => ({ ...point, y: shape.top })),
  ];
}

function solidPoints(solid: Derived3DSolid): Point3[] {
  if (solid.shape.kind === 'box') return boxCorners(solid);
  const plan = [solid.shape.outer, ...solid.shape.holes].flat();
  return [
    ...plan.map(point => ({ ...point, y: solid.shape.bottom })),
    ...(solid.shape.topOuter || solid.shape.outer).concat(...solid.shape.holes).map(point => ({ ...point, y: solid.shape.top })),
  ];
}

function sceneCenter(solids: Derived3DSolid[]) {
  const points = solids.flatMap(solidPoints);
  if (!points.length) return { x: 0, y: 0, z: 0 };
  return {
    x: (Math.min(...points.map(point => point.x)) + Math.max(...points.map(point => point.x))) / 2,
    y: (Math.min(...points.map(point => point.y)) + Math.max(...points.map(point => point.y))) / 2,
    z: (Math.min(...points.map(point => point.z)) + Math.max(...points.map(point => point.z))) / 2,
  };
}

function projectRaw(point: Point3, center: Point3, camera: Camera): ProjectedPoint {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const dz = point.z - center.z;
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const rx = dx * cosYaw - dz * sinYaw;
  const rz = dx * sinYaw + dz * cosYaw;
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const ry = dy * cosPitch - rz * sinPitch;
  const depth = dy * sinPitch + rz * cosPitch;
  return { x: rx, y: -ry, depth };
}

function polygonPath(points: ProjectedPoint[]) {
  return points.length ? `M ${points.map(point => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ')} Z` : '';
}

function ringPath(ring: Derived3DPlanPoint[], elevation: number, project: (point: Point3) => ProjectedPoint) {
  return polygonPath(ring.map(point => project({ ...point, y: elevation })));
}

function renderFaces(solids: Derived3DSolid[], project: (point: Point3) => ProjectedPoint): RenderFace[] {
  const faces: RenderFace[] = [];
  for (const solid of solids) {
    if (solid.shape.kind === 'box') {
      const vertices = boxCorners(solid).map(project);
      const faceIndices = [
        { indices: [4, 5, 6, 7], opacity: 0.72, top: true },
        { indices: [0, 3, 2, 1], opacity: 0.30, top: false },
        { indices: [0, 1, 5, 4], opacity: 0.42, top: false },
        { indices: [1, 2, 6, 5], opacity: 0.52, top: false },
        { indices: [2, 3, 7, 6], opacity: 0.36, top: false },
        { indices: [3, 0, 4, 7], opacity: 0.46, top: false },
      ];
      faceIndices.forEach((face, index) => {
        const points = face.indices.map(vertex => vertices[vertex]);
        faces.push({
          key: `${solid.id}:face:${index}`,
          solid,
          path: polygonPath(points),
          depth: points.reduce((total, point) => total + point.depth, 0) / points.length,
          opacity: face.opacity,
          top: face.top,
        });
      });
      continue;
    }

    const shape = solid.shape;
    const topRings = [shape.topOuter || shape.outer, ...shape.holes];
    const topPoints = (shape.topOuter || shape.outer).map(point => project({ ...point, y: shape.top }));
    faces.push({
      key: `${solid.id}:top`,
      solid,
      path: topRings.map(ring => ringPath(ring, shape.top, project)).join(' '),
      depth: topPoints.reduce((total, point) => total + point.depth, 0) / Math.max(1, topPoints.length),
      opacity: 0.68,
      top: true,
    });

    faces.push({ key: `${solid.id}:bottom`, solid, path: [shape.outer, ...shape.holes].map(ring => ringPath(ring, shape.bottom, project)).join(' '), depth: shape.outer.reduce((sum, point) => sum + project({ ...point, y: shape.bottom }).depth, 0) / shape.outer.length, opacity: 0.28, top: false });

    [shape.outer, ...shape.holes].forEach((ring, ringIndex) => {
      for (let index = 0; index < ring.length; index += 1) {
        const next = (index + 1) % ring.length;
        const world = [
          { ...ring[index], y: shape.bottom },
          { ...ring[next], y: shape.bottom },
          { ...(ringIndex === 0 && shape.topOuter ? shape.topOuter[next] : ring[next]), y: shape.top },
          { ...(ringIndex === 0 && shape.topOuter ? shape.topOuter[index] : ring[index]), y: shape.top },
        ];
        const points = world.map(project);
        faces.push({
          key: `${solid.id}:side:${ringIndex}:${index}`,
          solid,
          path: polygonPath(points),
          depth: points.reduce((total, point) => total + point.depth, 0) / points.length,
          opacity: ringIndex === 0 ? 0.44 : 0.30,
          top: false,
        });
      }
    });
  }
  return faces.sort((a, b) => a.depth - b.depth);
}

export class TakeoffDerived3DBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className={styles.unavailable} role="status"><strong>3D view unavailable</strong><span>Your 2D takeoff and quantity worksheet are available.</span><Button variant="outline" size="sm" onClick={() => this.setState({ failed: false })}>Retry 3D</Button></div>;
    return this.props.children;
  }
}

export function TakeoffDerived3DView({ scene, activeSheetId, activeSheetLabel, selectedConditionVersionId, selectedMeasurementId, onSelectSolid, onJumpToIssue, viewState, onViewStateChange, memory }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag>(null);
  const patternId = useId();
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [, invalidateCamera] = useState(0);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const cameraKey = `${scene.scopeKey}:${activeSheetId || 'none'}`;
  const remembered = memory.get(cameraKey);
  const camera = remembered?.camera || DEFAULT_CAMERA;
  const setCamera = (next: Camera | ((current: Camera) => Camera)) => {
    const current = memory.get(cameraKey);
    memory.set(cameraKey, { camera: typeof next === 'function' ? next(current?.camera || DEFAULT_CAMERA) : next, center: current?.center || null });
    invalidateCamera(n => n + 1);
  };
  const setCenter = (center: Point3) => { memory.set(cameraKey, { camera: memory.get(cameraKey)?.camera || DEFAULT_CAMERA, center }); invalidateCamera(n => n + 1); };

  useEffect(() => {
    const host = stageRef.current; if (!host) return;
    const update = () => setSize({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) });
    update(); const observer = new ResizeObserver(update); observer.observe(host); return () => observer.disconnect();
  }, []);
  const sheetSolids = useMemo(() => scene.solids.filter(solid => solid.sheetId === activeSheetId), [scene.solids, activeSheetId]);
  const zones = useMemo(() => [...new Set(sheetSolids.map(solid => solid.zone).filter((value): value is string => Boolean(value)))].sort(), [sheetSolids]);
  const elevations = useMemo(() => [...new Set(sheetSolids.map(s => s.shape.top))].sort((a, b) => a - b), [sheetSolids]);
  const visibleSolids = useMemo(() => sheetSolids.filter(solid => !viewState.hidden.includes(solid.conditionVersionId) && (!viewState.isolated || solid.conditionVersionId === viewState.isolated) && (viewState.zone === 'all' || solid.zone === viewState.zone) && (viewState.elevation === 'all' || String(solid.shape.top) === viewState.elevation)), [sheetSolids, viewState]);
  const sheetIssues = useMemo(() => scene.issues.filter(entry => !entry.sheetId || entry.sheetId === activeSheetId), [scene.issues, activeSheetId]);
  const center = remembered?.center || sceneCenter(sheetSolids);
  const fitScale = useMemo(() => {
    const points = sheetSolids.flatMap(solidPoints); if (!points.length) return 1;
    const radius = Math.max(1, ...points.map(p => Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z)));
    return Math.min(size.width, size.height) * 0.43 / radius;
  }, [sheetSolids, center.x, center.y, center.z, size]);
  const project = useMemo(() => (point: Point3): ProjectedPoint => {
    const raw = projectRaw(point, center, camera), scale = fitScale * camera.zoom;
    return { x: size.width / 2 + camera.panX + raw.x * scale, y: size.height / 2 + camera.panY + raw.y * scale, depth: raw.depth };
  }, [center.x, center.y, center.z, camera, fitScale, size]);
  const faces = useMemo(() => renderFaces(visibleSolids, project), [visibleSolids, project]);
  const resetView = () => { memory.set(cameraKey, { camera: DEFAULT_CAMERA, center: sceneCenter(sheetSolids) }); invalidateCamera(n => n + 1); };
  const showAll = () => onViewStateChange({ hidden: [], isolated: null, zone: 'all', elevation: 'all' });
  const toggleSelected = () => { if (selectedConditionVersionId) onViewStateChange(current => ({ ...current, isolated: null, hidden: current.hidden.includes(selectedConditionVersionId) ? current.hidden.filter(id => id !== selectedConditionVersionId) : [...current.hidden, selectedConditionVersionId] })); };
  const isolateSelected = () => { if (selectedConditionVersionId) onViewStateChange(current => ({ ...current, hidden: [], isolated: current.isolated === selectedConditionVersionId ? null : selectedConditionVersionId })); };
  const focusSelected = () => {
    const selection = sheetSolids.filter(s => s.measurementId === selectedMeasurementId || (!selectedMeasurementId && s.conditionVersionId === selectedConditionVersionId));
    if (selection.length) { setCenter(sceneCenter(selection)); setCamera(current => ({ ...current, panX: 0, panY: 0 })); }
  };
  const holdCount = sheetIssues.filter(issue => issue.severity === 'hold').length;
  const status = [scene.state === 'preview' ? 'Unsaved preview' : 'Saved model', holdCount ? 'Partial model' : '', !scene.coverage.checksComplete ? 'Checks incomplete' : ''].filter(Boolean).join(' · ');
  const sheetLabel = activeSheetLabel || 'Current sheet';
  if (scene.unavailable) return <div className={styles.empty} role="status"><strong>3D view unavailable</strong><span>The drawing and worksheet remain available. Reload to retry the model.</span></div>;
  return <div className={styles.viewer} data-issues-open={issuesOpen} aria-label="3D concrete verification">
    <div className={styles.toolbar}>
      <div className={styles.scope}><strong>{sheetLabel}</strong><span role="status">{status}</span></div>
      <label className={styles.filter}>Zone<select aria-label="3D zone" value={viewState.zone} onChange={event => onViewStateChange(current => ({ ...current, zone: event.target.value }))}><option value="all">All zones</option>{zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></label>
      <label className={styles.filter}>Top elevation<select aria-label="3D top elevation" value={viewState.elevation} onChange={event => onViewStateChange(current => ({ ...current, elevation: event.target.value }))}><option value="all">All elevations</option>{elevations.map(value => <option key={value} value={String(value)}>{formatArchitecturalLength(value)}</option>)}</select></label>
      <Button variant="ghost" size="icon-sm" onClick={toggleSelected} disabled={!selectedConditionVersionId} title="Hide or show selected Condition" aria-label="Hide or show selected Condition"><EyeOff size={16}/></Button>
      <Button variant="ghost" size="icon-sm" onClick={isolateSelected} disabled={!selectedConditionVersionId} aria-pressed={Boolean(viewState.isolated)} title="Isolate selected Condition" aria-label="Isolate selected Condition"><Focus size={16}/></Button>
      <Button variant="ghost" size="icon-sm" onClick={showAll} title="Show all" aria-label="Show all"><Eye size={16}/></Button>
      <Button variant="ghost" size="sm" onClick={focusSelected} disabled={!selectedMeasurementId}>Focus</Button>
      <Button variant="ghost" size="icon-sm" onClick={resetView} title="Reset 3D view" aria-label="Reset 3D view"><RotateCcw size={16}/></Button>
      <Button variant="outline" size="sm" aria-expanded={issuesOpen} onClick={() => setIssuesOpen(value => !value)}><AlertTriangle size={14}/>Issues {sheetIssues.length}</Button>
    </div>
    <div ref={stageRef} className={styles.stage} onContextMenu={event => event.preventDefault()} onWheel={event => { event.preventDefault(); setCamera(current => ({ ...current, zoom: clamp(current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), 0.1, 20) })); }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label="Read-only 3D concrete model" onPointerDown={event => {
        if (![0, 1, 2].includes(event.button)) return;
        const target = event.target as Element;
        dragRef.current = { mode: event.shiftKey || event.button !== 0 ? 'pan' : 'orbit', x: event.clientX, y: event.clientY, camera, pointerId: event.pointerId, solidId: target.closest('[data-solid-id]')?.getAttribute('data-solid-id') || null };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (Math.hypot(dx, dy) < 3) return;
        if (drag.mode === 'pan') setCamera({ ...drag.camera, panX: drag.camera.panX + dx, panY: drag.camera.panY + dy });
        else setCamera({ ...drag.camera, yaw: drag.camera.yaw + dx * 0.008, pitch: clamp(drag.camera.pitch + dy * 0.006, -1.45, 1.45) });
      }} onPointerUp={event => {
        const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3 && drag.solidId && drag.mode === 'orbit') { const solid = visibleSolids.find(s => s.id === drag.solidId); if (solid) onSelectSolid(solid); }
        dragRef.current = null;
      }} onPointerCancel={() => { dragRef.current = null; }}>
        <defs><pattern id={patternId} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--border)" strokeWidth="0.5"/></pattern></defs>
        <rect width={size.width} height={size.height} fill="var(--background)"/>
        <rect width={size.width} height={size.height} fill={`url(#${patternId})`}/>
        {faces.map(face => {
          const selected = selectedMeasurementId ? face.solid.measurementId === selectedMeasurementId : face.solid.conditionVersionId === selectedConditionVersionId;
          return <path key={face.key} data-solid-id={face.solid.id} d={face.path} fill={face.solid.color} fillOpacity={selected ? Math.min(0.92, face.opacity + 0.16) : face.opacity} fillRule="evenodd" stroke={selected ? 'var(--foreground)' : face.solid.color} strokeOpacity={selected ? 0.95 : 0.7} strokeWidth={selected ? 1.8 : 1} vectorEffect="non-scaling-stroke" className={styles.face} tabIndex={face.top ? 0 : undefined} role={face.top ? 'button' : undefined} aria-label={face.top ? `${face.solid.conditionName} — ${face.solid.measurementName}` : undefined} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectSolid(face.solid); } }} />;
        })}
      </svg>
      {!visibleSolids.length && <div className={styles.empty}><strong>{sheetSolids.length ? 'No visible concrete' : holdCount ? '3D inputs required' : 'No 3D concrete on this sheet'}</strong><span>{sheetSolids.length ? 'Restore visibility to review this sheet.' : holdCount ? 'Open Issues to resolve the missing inputs.' : 'Select a measured concrete Condition with dimensions and elevation.'}</span>{sheetSolids.length ? <Button variant="outline" size="sm" onClick={showAll}>Show all</Button> : holdCount ? <Button variant="outline" size="sm" onClick={() => setIssuesOpen(true)}>Open issues</Button> : null}</div>}
      <div className={styles.help}>Drag to orbit · Shift-drag to pan · Wheel to zoom</div>
    </div>
    {issuesOpen && <aside className={styles.issues} aria-label="3D verification issues">
      <header><strong>Verification · {sheetIssues.length}</strong><span>Current sheet and unassigned Conditions</span></header>
      <div className={styles.issueList}>{sheetIssues.length ? sheetIssues.map(entry => <button type="button" key={entry.id} onClick={() => onJumpToIssue(entry)} className={entry.severity === 'hold' ? styles.issueHold : styles.issueWarn}><AlertTriangle size={15}/><span><strong>{entry.code === '3d_input_required' ? '3D input required' : entry.code.replaceAll('_', ' ')}</strong><small>{entry.message}</small></span></button>) : <p className={styles.issueReady}>No issues found by supported checks on this sheet.</p>}</div>
    </aside>}
  </div>;
}
