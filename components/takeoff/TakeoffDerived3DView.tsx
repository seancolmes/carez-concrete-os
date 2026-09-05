'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Focus, RotateCcw } from 'lucide-react';
import type { Derived3DIssue, Derived3DPlanPoint, Derived3DScene, Derived3DSolid } from '@/lib/takeoff/conditions/derived3d';
import styles from './TakeoffDerived3DView.module.css';

type Props = {
  scene: Derived3DScene;
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
type Drag = { mode: 'orbit' | 'pan'; x: number; y: number; camera: Camera; pointerId: number } | null;
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
    ...plan.map(point => ({ ...point, y: solid.shape.top })),
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
    const topRings = [shape.outer, ...shape.holes];
    const topPoints = shape.outer.map(point => project({ ...point, y: shape.top }));
    faces.push({
      key: `${solid.id}:top`,
      solid,
      path: topRings.map(ring => ringPath(ring, shape.top, project)).join(' '),
      depth: topPoints.reduce((total, point) => total + point.depth, 0) / Math.max(1, topPoints.length),
      opacity: 0.68,
      top: true,
    });

    [shape.outer, ...shape.holes].forEach((ring, ringIndex) => {
      for (let index = 0; index < ring.length; index += 1) {
        const next = (index + 1) % ring.length;
        const world = [
          { ...ring[index], y: shape.bottom },
          { ...ring[next], y: shape.bottom },
          { ...ring[next], y: shape.top },
          { ...ring[index], y: shape.top },
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

export function TakeoffDerived3DView({
  scene,
  activeSheetId,
  activeSheetLabel,
  selectedConditionVersionId,
  selectedMeasurementId,
  onSelectSolid,
  onJumpToIssue,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [viewCenter, setViewCenter] = useState<Point3 | null>(null);
  const [zone, setZone] = useState('all');
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [isolated, setIsolated] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setSize({ width: Math.max(320, host.clientWidth), height: Math.max(260, host.clientHeight) });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setZone('all');
    setHidden(new Set());
    setIsolated(null);
    setCamera(DEFAULT_CAMERA);
    setViewCenter(null);
  }, [activeSheetId]);

  const sheetSolids = useMemo(
    () => scene.solids.filter(solid => !activeSheetId || solid.sheetId === activeSheetId),
    [scene.solids, activeSheetId],
  );
  const zones = useMemo(
    () => [...new Set(sheetSolids.map(solid => solid.zone).filter((value): value is string => Boolean(value)))].sort(),
    [sheetSolids],
  );
  const visibleSolids = useMemo(() => sheetSolids.filter(solid => {
    if (zone !== 'all' && solid.zone !== zone) return false;
    if (isolated && solid.conditionVersionId !== isolated) return false;
    return !hidden.has(solid.conditionVersionId);
  }), [sheetSolids, zone, isolated, hidden]);
  const visibleIssues = useMemo(
    () => scene.issues.filter(entry => !activeSheetId || !entry.sheetId || entry.sheetId === activeSheetId),
    [scene.issues, activeSheetId],
  );

  const framingKey = useMemo(() => [
    activeSheetId || 'all',
    zone,
    isolated || '',
    [...hidden].sort().join(','),
    visibleSolids.map(solid => solid.id).sort().join('|'),
  ].join('::'), [activeSheetId, zone, isolated, hidden, visibleSolids]);

  useEffect(() => {
    setViewCenter(sceneCenter(visibleSolids.length ? visibleSolids : sheetSolids));
  }, [framingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const center = viewCenter ?? sceneCenter(visibleSolids.length ? visibleSolids : sheetSolids);
  const fitScale = useMemo(() => {
    const points = (visibleSolids.length ? visibleSolids : sheetSolids).flatMap(solidPoints);
    if (!points.length) return 1;
    const projected = points.map(point => projectRaw(point, center, camera));
    const spanX = Math.max(1, Math.max(...projected.map(point => point.x)) - Math.min(...projected.map(point => point.x)));
    const spanY = Math.max(1, Math.max(...projected.map(point => point.y)) - Math.min(...projected.map(point => point.y)));
    return Math.max(0.25, Math.min((size.width * 0.72) / spanX, (size.height * 0.72) / spanY));
  }, [visibleSolids, sheetSolids, center, camera.yaw, camera.pitch, size]);

  const project = useMemo(() => (point: Point3): ProjectedPoint => {
    const raw = projectRaw(point, center, camera);
    const scale = fitScale * camera.zoom;
    return {
      x: size.width / 2 + camera.panX + raw.x * scale,
      y: size.height / 2 + camera.panY + raw.y * scale,
      depth: raw.depth,
    };
  }, [center, camera, fitScale, size]);
  const faces = useMemo(() => renderFaces(visibleSolids, project), [visibleSolids, project]);

  const resetView = () => {
    setViewCenter(sceneCenter(visibleSolids.length ? visibleSolids : sheetSolids));
    setCamera(DEFAULT_CAMERA);
  };
  const toggleSelected = () => {
    if (!selectedConditionVersionId) return;
    setIsolated(null);
    setHidden(current => {
      const next = new Set(current);
      if (next.has(selectedConditionVersionId)) next.delete(selectedConditionVersionId);
      else next.add(selectedConditionVersionId);
      return next;
    });
  };
  const isolateSelected = () => {
    if (!selectedConditionVersionId) return;
    setHidden(new Set());
    setIsolated(current => current === selectedConditionVersionId ? null : selectedConditionVersionId);
  };
  const showAll = () => { setHidden(new Set()); setIsolated(null); };

  return <div ref={hostRef} className={styles.viewer} aria-label="Derived 3D concrete verification viewer">
    <div className={styles.toolbar}>
      <div className={styles.scope}><strong>Derived 3D</strong><span>{activeSheetLabel || 'Current sheet'} · hash {scene.hash}</span></div>
      <label className={styles.zoneFilter}><span>Zone</span><select value={zone} onChange={event => setZone(event.target.value)}><option value="all">All zones</option>{zones.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <button type="button" onClick={toggleSelected} disabled={!selectedConditionVersionId} title="Hide or show selected Condition"><EyeOff size={14}/>Hide</button>
      <button type="button" onClick={isolateSelected} disabled={!selectedConditionVersionId} className={isolated ? styles.activeTool : ''} title="Isolate selected Condition"><Focus size={14}/>Isolate</button>
      <button type="button" onClick={showAll} title="Show all Conditions"><Eye size={14}/>Show all</button>
      <button type="button" onClick={resetView} title="Reset 3D view"><RotateCcw size={14}/>Reset</button>
    </div>

    <div className={styles.stage} onContextMenu={event => event.preventDefault()} onWheel={event => {
      event.preventDefault();
      setCamera(current => ({ ...current, zoom: clamp(current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), 0.25, 8) }));
    }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label="Read-only axonometric projection of concrete Conditions" onPointerDown={event => {
        if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
        const mode = event.shiftKey || event.button !== 0 ? 'pan' : 'orbit';
        dragRef.current = { mode, x: event.clientX, y: event.clientY, camera, pointerId: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (drag.mode === 'pan') setCamera({ ...drag.camera, panX: drag.camera.panX + dx, panY: drag.camera.panY + dy });
        else setCamera({ ...drag.camera, yaw: drag.camera.yaw + dx * 0.008, pitch: clamp(drag.camera.pitch + dy * 0.006, -1.35, -0.12) });
      }} onPointerUp={event => {
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
      }} onPointerCancel={() => { dragRef.current = null; }}>
        <defs><pattern id="carez-3d-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#18222d" strokeWidth="1"/></pattern></defs>
        <rect width={size.width} height={size.height} fill="#080d12"/>
        <rect width={size.width} height={size.height} fill="url(#carez-3d-grid)"/>
        {faces.map(face => {
          const selected = face.solid.measurementId === selectedMeasurementId || face.solid.conditionVersionId === selectedConditionVersionId;
          return <path
            key={face.key}
            d={face.path}
            fill={face.solid.color}
            fillOpacity={selected ? Math.min(0.92, face.opacity + 0.16) : face.opacity}
            fillRule="evenodd"
            stroke={selected ? '#f5f8fb' : face.solid.color}
            strokeOpacity={selected ? 0.95 : 0.86}
            strokeWidth={selected ? 1.8 : 1}
            vectorEffect="non-scaling-stroke"
            className={styles.face}
            onPointerDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); onSelectSolid(face.solid); }}
          />;
        })}
      </svg>

      {!sheetSolids.length && <div className={styles.empty}><strong>3D verification unavailable on this sheet</strong><span>Carez will not invent dimensions, elevation, or scale. Resolve the listed holds and keep measuring in 2D.</span></div>}
      <div className={styles.help}>Drag to orbit · Shift-drag to pan · Wheel to zoom · 2D geometry remains authoritative</div>
    </div>

    <aside className={styles.issues} aria-label="3D verification issues">
      <header><span><AlertTriangle size={13}/><strong>Verification</strong></span><b>{visibleIssues.length}</b></header>
      <div className={styles.issueList}>{visibleIssues.length ? visibleIssues.map(entry => <button type="button" key={entry.id} onClick={() => onJumpToIssue(entry)} className={entry.severity === 'hold' ? styles.issueHold : styles.issueWarn}>
        <AlertTriangle size={13}/><span><strong>{entry.code === '3d_input_required' ? '3D input required' : entry.code.replaceAll('_', ' ')}</strong><small>{entry.message}</small></span>
      </button>) : <div className={styles.issueReady}>No 3D verification issues on this sheet.</div>}</div>
    </aside>
  </div>;
}
