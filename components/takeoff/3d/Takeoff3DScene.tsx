'use client';

import { useEffect, useState, type RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { Derived3DSheetPlane } from '@/lib/takeoff/conditions/derived3d/contracts';
import type { Takeoff3DCameraMemory } from '@/lib/takeoff/3d/camera';
import { sheetPlaneFrame } from '@/lib/takeoff/3d/coordinates';
import { Takeoff3DPlan } from './Takeoff3DPlan';
import { Takeoff3DControls, type Takeoff3DCameraActions } from './Takeoff3DControls';
import { Takeoff3DUnavailable } from './Takeoff3DErrorBoundary';

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

export function Takeoff3DScene({ plane, pdfUrl, pageNumber, memory, actions, onRetry }: {
  plane: Derived3DSheetPlane; pdfUrl: string; pageNumber: number;
  memory: Map<string, Takeoff3DCameraMemory>; actions: RefObject<Takeoff3DCameraActions | null>; onRetry: () => void;
}) {
  const frame = sheetPlaneFrame(plane);
  const far = Math.max(10000, Math.hypot(frame.width, frame.height) * 6);
  return <Canvas orthographic dpr={[1, 2]} gl={{ antialias: true, alpha: false }}
    camera={{ near: 0.1, far }} fallback={<Takeoff3DUnavailable onRetry={onRetry} />}>
    <color attach="background" args={['#090d12']} />
    <hemisphereLight intensity={0.9} groundColor="#111827" />
    <directionalLight position={[40, 80, -30]} intensity={1.15} />
    <ContextLossGuard />
    <ActivePlan key={`${plane.sheetId}:${pdfUrl}:${pageNumber}`} plane={plane} pdfUrl={pdfUrl} pageNumber={pageNumber} />
    <Takeoff3DControls sheetId={plane.sheetId} width={frame.width} height={frame.height} memory={memory} actions={actions} />
  </Canvas>;
}
