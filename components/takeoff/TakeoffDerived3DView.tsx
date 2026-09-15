'use client';

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Eye, EyeOff, Focus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { Derived3DIssue, Derived3DPlanPoint, Derived3DScene, Derived3DSheetPlane, Derived3DSolid } from '@/lib/takeoff/conditions/derived3d';
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
type ViewFrame = { center: Point3; fitRadius: number; referenceElevation: number };
export type Derived3DViewState = { hidden: string[]; isolated: string | null; zone: string; elevation: string };
export type Derived3DViewMemory = Map<string, { camera: Camera; center: Point3 | null; fitRadius: number | null; referenceElevation: number | null }>;
type RenderFace = {
  key: string;
  solid: Derived3DSolid;
  path: string;
  depth: number;
  opacity: number;
  top: boolean;
};

type SheetProjection = {
  matrix: string;
  corners: ProjectedPoint[];
};

const MIN_CAMERA_PITCH = -1.38;
const MAX_CAMERA_PITCH = -0.32;
const MIN_CAMERA_ZOOM = 0.18;
const MAX_CAMERA_ZOOM = 12;
const DEFAULT_CAMERA: Camera = { yaw: -Math.PI / 4, pitch: -0.72, zoom: 1, panX: 0, panY: 0 };
const PLAN_DATUM_ELEVATION = 0;
const MAX_PLAN_TEXTURE_DIMENSION = 3072;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalizeCamera = (camera: Camera): Camera => ({
  ...camera,
  pitch: clamp(camera.pitch, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH),
  zoom: clamp(camera.zoom, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM),
});

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

function frameForSolids(solids: Derived3DSolid[], preferredReference?: number | null): ViewFrame {
  const center = sceneCenter(solids);
  const points = solids.flatMap(solidPoints);
  const fitRadius = Math.max(1, ...points.map(point => Math.hypot(point.x - center.x, point.y - center.y, point.z - center.z)));
  const referenceElevation = Number.isFinite(preferredReference) ? Number(preferredReference) : PLAN_DATUM_ELEVATION;
  return { center, fitRadius, referenceElevation };
}

function sheetPlanePoints(plane: Derived3DSheetPlane | null | undefined): Point3[] {
  if (!plane?.worldWidth || !plane.worldHeight) return [];
  return [
    { x: 0, y: PLAN_DATUM_ELEVATION, z: 0 },
    { x: plane.worldWidth, y: PLAN_DATUM_ELEVATION, z: 0 },
    { x: plane.worldWidth, y: PLAN_DATUM_ELEVATION, z: plane.worldHeight },
    { x: 0, y: PLAN_DATUM_ELEVATION, z: plane.worldHeight },
  ];
}

function frameForScene(solids: Derived3DSolid[], plane: Derived3DSheetPlane | null | undefined): ViewFrame {
  const points = [...sheetPlanePoints(plane), ...solids.flatMap(solidPoints)];
  if (!points.length) return { center: { x: 0, y: 0, z: 0 }, fitRadius: 1, referenceElevation: PLAN_DATUM_ELEVATION };
  const center = {
    x: (Math.min(...points.map(point => point.x)) + Math.max(...points.map(point => point.x))) / 2,
    y: (Math.min(...points.map(point => point.y)) + Math.max(...points.map(point => point.y))) / 2,
    z: (Math.min(...points.map(point => point.z)) + Math.max(...points.map(point => point.z))) / 2,
  };
  return {
    center,
    fitRadius: Math.max(1, ...points.map(point => Math.hypot(point.x - center.x, point.y - center.y, point.z - center.z))),
    referenceElevation: PLAN_DATUM_ELEVATION,
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
        { indices: [4, 5, 6, 7], opacity: 0.88, top: true },
        { indices: [0, 3, 2, 1], opacity: 0.24, top: false },
        { indices: [0, 1, 5, 4], opacity: 0.50, top: false },
        { indices: [1, 2, 6, 5], opacity: 0.60, top: false },
        { indices: [2, 3, 7, 6], opacity: 0.42, top: false },
        { indices: [3, 0, 4, 7], opacity: 0.54, top: false },
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
      opacity: 0.86,
      top: true,
    });

    faces.push({ key: `${solid.id}:bottom`, solid, path: [shape.outer, ...shape.holes].map(ring => ringPath(ring, shape.bottom, project)).join(' '), depth: shape.outer.reduce((sum, point) => sum + project({ ...point, y: shape.bottom }).depth, 0) / shape.outer.length, opacity: 0.22, top: false });

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
          opacity: ringIndex === 0 ? 0.52 : 0.34,
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
  const planImageUrlRef = useRef<string | null>(null);
  const [planImageUrl, setPlanImageUrl] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [, invalidateCamera] = useState(0);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const cameraKey = `${scene.scopeKey}:${activeSheetId || 'none'}`;

  useEffect(() => {
    const host = stageRef.current; if (!host) return;
    const update = () => setSize({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) });
    update(); const observer = new ResizeObserver(update); observer.observe(host); return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (planImageUrlRef.current) {
      URL.revokeObjectURL(planImageUrlRef.current);
      planImageUrlRef.current = null;
    }
    setPlanImageUrl(null);
    const capture = () => {
      const stage = stageRef.current;
      const root = stage?.closest('[data-context-tab][data-view-mode]') as HTMLElement | null;
      const source = root?.querySelector<HTMLCanvasElement>('canvas');
      if (!source || source.width < 2 || source.height < 2) return;
      try {
        const ratio = Math.min(1, MAX_PLAN_TEXTURE_DIMENSION / source.width, MAX_PLAN_TEXTURE_DIMENSION / source.height);
        const texture = document.createElement('canvas');
        texture.width = Math.max(1, Math.round(source.width * ratio));
        texture.height = Math.max(1, Math.round(source.height * ratio));
        const context = texture.getContext('2d', { alpha: false });
        if (!context) return;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(source, 0, 0, texture.width, texture.height);
        texture.toBlob(blob => {
          if (cancelled || !blob) return;
          const next = URL.createObjectURL(blob);
          if (cancelled) { URL.revokeObjectURL(next); return; }
          if (planImageUrlRef.current) URL.revokeObjectURL(planImageUrlRef.current);
          planImageUrlRef.current = next;
          setPlanImageUrl(next);
        }, 'image/png');
      } catch {
        // The derived model remains usable even if a browser blocks canvas texture capture.
      }
    };
    const timers = [120, 500, 1200].map(delay => window.setTimeout(capture, delay));
    return () => {
      cancelled = true;
      timers.forEach(timer => window.clearTimeout(timer));
      if (planImageUrlRef.current) {
        URL.revokeObjectURL(planImageUrlRef.current);
        planImageUrlRef.current = null;
      }
    };
  }, [activeSheetId]);

  const sheetSolids = useMemo(() => scene.solids.filter(solid => solid.sheetId === activeSheetId), [scene.solids, activeSheetId]);
  const sheetPlane = activeSheetId ? scene.sheetPlanes[activeSheetId] || null : null;
  const selectedSolid = useMemo(() => sheetSolids.find(solid => solid.measurementId === selectedMeasurementId) || sheetSolids.find(solid => solid.conditionVersionId === selectedConditionVersionId) || null, [sheetSolids, selectedConditionVersionId, selectedMeasurementId]);
  const autoFrame = useMemo(() => frameForScene(sheetSolids, sheetPlane), [sheetSolids, sheetPlane]);
  const remembered = memory.get(cameraKey);
  const camera = normalizeCamera(remembered?.camera || DEFAULT_CAMERA);
  const center = remembered?.center || autoFrame.center;
  const fitRadius = remembered?.fitRadius || autoFrame.fitRadius;
  const referenceElevation = remembered?.referenceElevation ?? autoFrame.referenceElevation;

  useEffect(() => {
    if ((!sheetSolids.length && !sheetPlane) || memory.has(cameraKey)) return;
    memory.set(cameraKey, { camera: DEFAULT_CAMERA, center: autoFrame.center, fitRadius: autoFrame.fitRadius, referenceElevation: autoFrame.referenceElevation });
    invalidateCamera(value => value + 1);
  }, [cameraKey, memory, sheetSolids.length, sheetPlane, autoFrame.center.x, autoFrame.center.y, autoFrame.center.z, autoFrame.fitRadius, autoFrame.referenceElevation]);

  const currentMemory = () => {
    const current = memory.get(cameraKey);
    if (!current) return { camera: DEFAULT_CAMERA, center: autoFrame.center, fitRadius: autoFrame.fitRadius, referenceElevation: autoFrame.referenceElevation };
    return { ...current, camera: normalizeCamera(current.camera) };
  };
  const setCamera = (next: Camera | ((current: Camera) => Camera)) => {
    const current = currentMemory();
    const resolved = typeof next === 'function' ? next(current.camera) : next;
    memory.set(cameraKey, { ...current, camera: normalizeCamera(resolved) });
    invalidateCamera(value => value + 1);
  };
  const setFrame = (frame: ViewFrame, nextCamera?: Camera) => {
    const current = currentMemory();
    memory.set(cameraKey, { camera: normalizeCamera(nextCamera || current.camera), center: frame.center, fitRadius: frame.fitRadius, referenceElevation: current.referenceElevation ?? frame.referenceElevation });
    invalidateCamera(value => value + 1);
  };

  const zones = useMemo(() => [...new Set(sheetSolids.map(solid => solid.zone).filter((value): value is string => Boolean(value)))].sort(), [sheetSolids]);
  const elevations = useMemo(() => [...new Set(sheetSolids.map(solid => solid.shape.top))].sort((a, b) => a - b), [sheetSolids]);
  const visibleSolids = useMemo(() => sheetSolids.filter(solid => !viewState.hidden.includes(solid.conditionVersionId) && (!viewState.isolated || solid.conditionVersionId === viewState.isolated) && (viewState.zone === 'all' || solid.zone === viewState.zone) && (viewState.elevation === 'all' || String(solid.shape.top) === viewState.elevation)), [sheetSolids, viewState]);
  const sheetIssues = useMemo(() => scene.issues.filter(entry => !entry.sheetId || entry.sheetId === activeSheetId), [scene.issues, activeSheetId]);
  const selectedConditionIssues = useMemo(() => selectedConditionVersionId ? scene.issues.filter(entry => entry.conditionVersionId === selectedConditionVersionId) : [], [scene.issues, selectedConditionVersionId]);
  const selectedInputIssue = useMemo(() => selectedConditionIssues.find(issue => issue.severity === 'hold' && issue.code === '3d_input_required') || null, [selectedConditionIssues]);
  const selectedUnsupportedIssue = useMemo(() => selectedConditionIssues.find(issue => issue.severity === 'hold' && issue.code === 'unsupported_projection') || null, [selectedConditionIssues]);
  const selectedHasSolid = useMemo(() => Boolean(selectedConditionVersionId && sheetSolids.some(solid => solid.conditionVersionId === selectedConditionVersionId)), [sheetSolids, selectedConditionVersionId]);
  const selectedHidden = Boolean(selectedConditionVersionId && viewState.hidden.includes(selectedConditionVersionId));
  const hasVisibilityFilters = Boolean(viewState.hidden.length || viewState.isolated || viewState.zone !== 'all' || viewState.elevation !== 'all');
  const fitScale = Math.min(size.width, size.height) * 0.46 / Math.max(1, fitRadius);
  const project = useMemo(() => (point: Point3): ProjectedPoint => {
    const raw = projectRaw(point, center, camera), scale = fitScale * camera.zoom;
    return { x: size.width / 2 + camera.panX + raw.x * scale, y: size.height / 2 + camera.panY + raw.y * scale, depth: raw.depth };
  }, [center.x, center.y, center.z, camera, fitScale, size]);
  const faces = useMemo(() => renderFaces(visibleSolids, project), [visibleSolids, project]);
  const sheetProjection = useMemo<SheetProjection | null>(() => {
    if (!sheetPlane?.worldWidth || !sheetPlane.worldHeight || !(sheetPlane.pageWidth > 0) || !(sheetPlane.pageHeight > 0)) return null;
    const origin = project({ x: 0, y: PLAN_DATUM_ELEVATION, z: 0 });
    const right = project({ x: sheetPlane.worldWidth, y: PLAN_DATUM_ELEVATION, z: 0 });
    const bottom = project({ x: 0, y: PLAN_DATUM_ELEVATION, z: sheetPlane.worldHeight });
    const far = project({ x: sheetPlane.worldWidth, y: PLAN_DATUM_ELEVATION, z: sheetPlane.worldHeight });
    const a = (right.x - origin.x) / sheetPlane.pageWidth;
    const b = (right.y - origin.y) / sheetPlane.pageWidth;
    const c = (bottom.x - origin.x) / sheetPlane.pageHeight;
    const d = (bottom.y - origin.y) / sheetPlane.pageHeight;
    return { matrix: `matrix(${a} ${b} ${c} ${d} ${origin.x} ${origin.y})`, corners: [origin, right, far, bottom] };
  }, [sheetPlane, project]);

  const resetView = () => {
    const frame = frameForScene(sheetSolids, sheetPlane);
    memory.set(cameraKey, { camera: DEFAULT_CAMERA, center: frame.center, fitRadius: frame.fitRadius, referenceElevation: frame.referenceElevation });
    invalidateCamera(value => value + 1);
  };
  const showAll = () => onViewStateChange({ hidden: [], isolated: null, zone: 'all', elevation: 'all' });
  const toggleSelected = () => { if (selectedConditionVersionId) onViewStateChange(current => ({ ...current, isolated: null, hidden: current.hidden.includes(selectedConditionVersionId) ? current.hidden.filter(id => id !== selectedConditionVersionId) : [...current.hidden, selectedConditionVersionId] })); };
  const isolateSelected = () => { if (selectedConditionVersionId) onViewStateChange(current => ({ ...current, hidden: [], isolated: current.isolated === selectedConditionVersionId ? null : selectedConditionVersionId })); };
  const focusSelected = () => {
    const selection = sheetSolids.filter(solid => solid.measurementId === selectedMeasurementId || (!selectedMeasurementId && solid.conditionVersionId === selectedConditionVersionId));
    if (!selection.length) return;
    const frame = frameForSolids(selection, currentMemory().referenceElevation);
    setFrame(frame, { ...camera, panX: 0, panY: 0 });
  };
  const holdCount = sheetIssues.filter(issue => issue.severity === 'hold').length;
  const baseStatus = selectedUnsupportedIssue && !selectedHasSolid ? '3D unavailable' : selectedInputIssue && !selectedHasSolid ? 'Inputs required' : scene.state === 'preview' ? 'Unsaved preview' : sheetSolids.length ? 'Current model' : 'No modeled scope';
  const status = [baseStatus, holdCount && sheetSolids.length ? 'Partial model' : '', sheetProjection && !planImageUrl ? 'Plan loading' : '', !scene.coverage.checksComplete ? 'Checks incomplete' : ''].filter(Boolean).join(' · ');
  const sheetLabel = activeSheetLabel || 'Current sheet';
  if (scene.unavailable) return <div className={styles.empty} role="status"><strong>3D view unavailable</strong><span>The drawing and worksheet remain available. Reload to retry the model.</span></div>;
  return <div className={styles.viewer} data-issues-open={issuesOpen} aria-label="3D concrete verification">
    <div className={styles.toolbar}>
      <div className={styles.scope}><strong>{sheetLabel}</strong><span role="status">{status}</span></div>
      <div className={styles.primaryTools}>
        <Button variant="ghost" size="icon-sm" onClick={resetView} title="Home / reset 3D view" aria-label="Home / reset 3D view"><RotateCcw size={16}/></Button>
        <Button variant="ghost" size="sm" onClick={focusSelected} disabled={!selectedSolid} title="Focus selected takeoff"><Focus size={14}/>Focus</Button>
        <Button variant="ghost" size="icon-sm" onClick={toggleSelected} disabled={!selectedConditionVersionId} title={selectedHidden?'Show selected takeoff':'Hide selected takeoff'} aria-label={selectedHidden?'Show selected takeoff':'Hide selected takeoff'}>{selectedHidden?<Eye size={16}/>:<EyeOff size={16}/>}</Button>
        <details className={styles.filtersMenu}>
          <summary><SlidersHorizontal size={14}/>Filters</summary>
          <div className={styles.filtersPanel}>
            <label className={styles.filter}>Zone<select aria-label="3D zone" value={viewState.zone} onChange={event => onViewStateChange(current => ({ ...current, zone: event.target.value }))}><option value="all">All zones</option>{zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></label>
            <label className={styles.filter}>Top elevation<select aria-label="3D top elevation" value={viewState.elevation} onChange={event => onViewStateChange(current => ({ ...current, elevation: event.target.value }))}><option value="all">All elevations</option>{elevations.map(value => <option key={value} value={String(value)}>{formatArchitecturalLength(value)}</option>)}</select></label>
            <div className={styles.filterActions}>
              <Button variant="ghost" size="sm" onClick={isolateSelected} disabled={!selectedConditionVersionId} aria-pressed={Boolean(viewState.isolated)}><Focus size={14}/>Isolate</Button>
              <Button variant="ghost" size="sm" onClick={showAll} disabled={!hasVisibilityFilters}><Eye size={14}/>Show all</Button>
            </div>
          </div>
        </details>
        <Button variant="outline" size="sm" aria-expanded={issuesOpen} onClick={() => setIssuesOpen(value => !value)}><AlertTriangle size={14}/>3D checks {sheetIssues.length}</Button>
      </div>
    </div>
    <div ref={stageRef} className={styles.stage} onContextMenu={event => event.preventDefault()} onWheel={event => { event.preventDefault(); setCamera(current => ({ ...current, zoom: current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12) })); }}>
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
        else setCamera({ ...drag.camera, yaw: drag.camera.yaw + dx * 0.008, pitch: clamp(drag.camera.pitch + dy * 0.006, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH) });
      }} onPointerUp={event => {
        const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3 && drag.solidId && drag.mode === 'orbit') { const solid = visibleSolids.find(solid => solid.id === drag.solidId); if (solid) onSelectSolid(solid); }
        dragRef.current = null;
      }} onPointerCancel={() => { dragRef.current = null; }}>
        <rect width={size.width} height={size.height} fill="var(--background)"/>
        {sheetProjection ? <g className={styles.sheetPlane} pointerEvents="none" aria-label={`PDF plan reference plane at ${formatArchitecturalLength(PLAN_DATUM_ELEVATION)}`}>
          <polygon className={styles.sheetSurface} points={sheetProjection.corners.map(point => `${point.x},${point.y}`).join(' ')} vectorEffect="non-scaling-stroke"/>
          {planImageUrl ? <image className={styles.planImage} href={planImageUrl} x="0" y="0" width={sheetPlane!.pageWidth} height={sheetPlane!.pageHeight} preserveAspectRatio="none" transform={sheetProjection.matrix} opacity="0.98"/> : null}
        </g> : null}
        {faces.map(face => {
          const selected = selectedMeasurementId ? face.solid.measurementId === selectedMeasurementId : face.solid.conditionVersionId === selectedConditionVersionId;
          const faceClass = [styles.face, face.top ? styles.faceTop : styles.faceSide, selected ? styles.faceSelected : ''].filter(Boolean).join(' ');
          return <path key={face.key} data-solid-id={face.solid.id} d={face.path} fill={face.solid.color} fillOpacity={selected ? Math.min(0.98, face.opacity + 0.10) : face.opacity} fillRule="evenodd" stroke={selected ? 'var(--foreground)' : face.solid.color} strokeOpacity={selected ? 1 : 0.88} strokeWidth={selected ? 2.2 : 1.1} vectorEffect="non-scaling-stroke" className={faceClass} tabIndex={face.top ? 0 : undefined} role={face.top ? 'button' : undefined} aria-label={face.top ? `${face.solid.conditionName} — ${face.solid.measurementName}` : undefined} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectSolid(face.solid); } }} />;
        })}
      </svg>
      {visibleSolids.length>0&&!selectedHasSolid&&(selectedInputIssue||selectedUnsupportedIssue)&&<div className={styles.selectedIssue} role="status"><AlertTriangle size={16}/><div><strong>{selectedInputIssue?'Selected takeoff needs a 3D input':'Selected takeoff is not modeled'}</strong><span>{(selectedInputIssue||selectedUnsupportedIssue)?.message}</span></div>{selectedInputIssue?<Button variant="outline" size="sm" onClick={()=>onJumpToIssue(selectedInputIssue)}>Resolve input</Button>:<Button variant="outline" size="sm" onClick={()=>setIssuesOpen(true)}>Open 3D checks</Button>}</div>}
      {!visibleSolids.length && <div className={styles.empty}>{sheetSolids.length?<><strong>No visible concrete</strong><span>Restore visibility to review this sheet.</span><Button variant="outline" size="sm" onClick={showAll}>Show all</Button></>:selectedUnsupportedIssue?<><strong>3D unavailable for this Condition</strong><span>{selectedUnsupportedIssue.message}</span><Button variant="outline" size="sm" onClick={()=>setIssuesOpen(true)}>Open 3D checks</Button></>:selectedInputIssue?<><strong>3D input required</strong><span>{selectedInputIssue.message}</span><Button variant="outline" size="sm" onClick={()=>onJumpToIssue(selectedInputIssue)}>Resolve input</Button></>:holdCount?<><strong>3D checks require attention</strong><span>{sheetIssues.find(issue=>issue.severity==='hold')?.message||'Resolve the current 3D checks before this scope can be modeled.'}</span><Button variant="outline" size="sm" onClick={()=>setIssuesOpen(true)}>Open 3D checks</Button></>:selectedConditionVersionId&&selectedMeasurementId?<><strong>No modeled scope on this sheet</strong><span>The selected measured Condition does not currently project a supported solid on {sheetLabel}.</span></>:<><strong>No 3D concrete on this sheet</strong><span>Select a measured concrete Condition to review its derived model.</span></>}</div>}
      <div className={styles.help}>Plan datum {formatArchitecturalLength(PLAN_DATUM_ELEVATION)} · Drag to orbit · Shift-drag to pan · Wheel to zoom</div>
    </div>
    {issuesOpen && <aside className={styles.issues} aria-label="3D verification issues">
      <header><strong>3D checks · {sheetIssues.length}</strong><span>Current sheet and unassigned Conditions</span></header>
      <div className={styles.issueList}>{sheetIssues.length ? sheetIssues.map(entry => <button type="button" key={entry.id} onClick={() => onJumpToIssue(entry)} className={entry.severity === 'hold' ? styles.issueHold : styles.issueWarn}><AlertTriangle size={15}/><span><strong>{entry.code === '3d_input_required' ? '3D input required' : entry.code.replaceAll('_', ' ')}</strong><small>{entry.message}</small></span></button>) : <p className={styles.issueReady}>No issues found by supported checks on this sheet.</p>}</div>
    </aside>}
  </div>;
}
