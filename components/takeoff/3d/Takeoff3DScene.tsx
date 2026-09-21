'use client';

import { useEffect, useState, type RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import type { Derived3DIssue, Derived3DSheetPlane, Derived3DSolid } from '@/lib/takeoff/conditions/derived3d/contracts';
import type { Takeoff3DCameraMemory } from '@/lib/takeoff/3d/camera';
import { sheetPlaneFrame } from '@/lib/takeoff/3d/coordinates';
import { Takeoff3DPlan } from './Takeoff3DPlan';
import { Takeoff3DControls, type Takeoff3DCameraActions } from './Takeoff3DControls';
import { Takeoff3DUnavailable } from './Takeoff3DErrorBoundary';
import { Takeoff3DSolid } from './Takeoff3DSolid';

function ContextLossGuard() {
  const gl = useThree(state => state.gl);
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const onLost = (event: Event) => { event.preventDefault(); setLost(true); };
    gl.domElement.addEventListener('webglcontextlost', onLost);
    return () => gl.domElement.removeEventListener('webglcontextlost', onLost);
  }, [gl]);
  if (lost) throw new Error('The 3D graphics context was lost.');
  return null;
}

function ActivePlan({ plane, pdfUrl, pageNumber }: { plane: Derived3DSheetPlane; pdfUrl: string; pageNumber: number }) {
  const size = useThree(state => state.size);
  return <Takeoff3DPlan plane={plane} pdfUrl={pdfUrl} pageNumber={pageNumber} viewportSize={size} />;
}

export function Takeoff3DScene({ plane, pdfUrl, pageNumber, memory, actions, onRetry, solids, selectedMeasurementId, selectedConditionVersionId, issues, onJumpToIssue, onSelectSolid, onMeshIssue }: {
  plane: Derived3DSheetPlane; pdfUrl: string; pageNumber: number;
  memory: Map<string, Takeoff3DCameraMemory>; actions: RefObject<Takeoff3DCameraActions | null>; onRetry: () => void;
  solids: Derived3DSolid[]; selectedMeasurementId: string | null; onSelectSolid: (solid: Derived3DSolid) => void;
  selectedConditionVersionId: string | null; issues: Derived3DIssue[]; onJumpToIssue: (issue: Derived3DIssue) => void;
  onMeshIssue: (solidId: string, issue: Derived3DIssue | null) => void;
}) {
  const [graphicsAvailable, setGraphicsAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    // Renderer startup can reject asynchronously, outside React's error boundary.
    // Keep the verification pane useful when the browser has disabled WebGL.
    const probe = document.createElement('canvas');
    let context: WebGL2RenderingContext | null = null;
    try { context = probe.getContext('webgl2'); } catch { /* Unsupported graphics context. */ }
    setGraphicsAvailable(Boolean(context));
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  }, []);
  const frame = sheetPlaneFrame(plane);
  const far = Math.max(10000, Math.hypot(frame.width, frame.height) * 6);
  if (graphicsAvailable === null) return null;
  if (!graphicsAvailable) return <Takeoff3DUnavailable onRetry={onRetry} />;
  return <Canvas orthographic dpr={[1, 2]} gl={{ antialias: true, alpha: true }}
    camera={{ near: 0.1, far }} fallback={<Takeoff3DUnavailable onRetry={onRetry} />}>
    <hemisphereLight intensity={0.9}  />
    <directionalLight position={[40, 80, -30]} intensity={1.15} />
    <ContextLossGuard />
    <ActivePlan key={`${plane.sheetId}:${pdfUrl}:${pageNumber}`} plane={plane} pdfUrl={pdfUrl} pageNumber={pageNumber} />
    {solids.map(solid => <Takeoff3DSolid key={solid.id} solid={solid} selected={selectedMeasurementId ? solid.measurementId === selectedMeasurementId : solid.conditionVersionId === selectedConditionVersionId}
      issue={issues.find(issue => issue.relatedSolidIds?.includes(solid.id) || (issue.measurementId === solid.measurementId && issue.conditionVersionId === solid.conditionVersionId))} onJumpToIssue={onJumpToIssue}
      onSelect={onSelectSolid} onIssue={onMeshIssue} />)}
    <ContactShadows key={solids.map(solid => solid.geometryKey).join('|')} position={[frame.center[0], 0, frame.center[2]]}
      scale={[frame.width, frame.height]} opacity={0.12} blur={0.6} near={0.01} far={10} frames={1} resolution={512} depthWrite={false} />
    <Takeoff3DControls sheetId={plane.sheetId} width={frame.width} height={frame.height} memory={memory} actions={actions} />
  </Canvas>;
}
