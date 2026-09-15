'use client';

import { useEffect, useState } from 'react';
import { Edges, Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Derived3DSheetPlane } from '@/lib/takeoff/conditions/derived3d/contracts';
import { sheetPlaneFrame } from '@/lib/takeoff/3d/coordinates';
import { computePlanTextureSize, renderPdfPageCanvas } from '@/lib/takeoff/3d/planTexture';

export function Takeoff3DPlan({ pdfUrl, pageNumber, plane, viewportSize }: {
  pdfUrl: string; pageNumber: number; plane: Derived3DSheetPlane;
  viewportSize: { width: number; height: number };
}) {
  const gl = useThree(state => state.gl);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const frame = sheetPlaneFrame(plane);
  const target = computePlanTextureSize(plane.pageWidth, plane.pageHeight, Math.max(1, viewportSize.width), Math.max(1, viewportSize.height));

  useEffect(() => {
    const controller = new AbortController();
    let ownedTexture: THREE.CanvasTexture | null = null;
    setTexture(null);
    setError(null);
    renderPdfPageCanvas(pdfUrl, pageNumber, target, controller.signal).then(canvas => {
      if (controller.signal.aborted) return;
      ownedTexture = new THREE.CanvasTexture(canvas);
      ownedTexture.colorSpace = THREE.SRGBColorSpace;
      // Plane local +Y is page top; CanvasTexture's upload flips image rows to UVs.
      ownedTexture.flipY = true;
      ownedTexture.minFilter = THREE.LinearMipmapLinearFilter;
      ownedTexture.magFilter = THREE.LinearFilter;
      ownedTexture.generateMipmaps = true;
      ownedTexture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      setTexture(ownedTexture);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => { controller.abort(); ownedTexture?.dispose(); };
  // Texture pixels depend on PDF/page and raster dimensions, never scene/selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl, pageNumber, target.width, target.height, gl]);

  if (error) throw error;
  return <>
    <mesh position={[frame.center[0], -0.03, frame.center[2]]} rotation={frame.rotation} scale={1.01} renderOrder={-21}>
      <planeGeometry args={[frame.width, frame.height]} />
      {/* Custom blending keeps the shadow in the opaque queue, before the PDF. */}
      <meshBasicMaterial color="#000000" opacity={0.16} transparent={false} blending={THREE.CustomBlending} blendSrc={THREE.SrcAlphaFactor} blendDst={THREE.OneMinusSrcAlphaFactor} depthWrite={false} depthTest={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
    <mesh position={frame.center} rotation={frame.rotation} renderOrder={-20}>
      <planeGeometry args={[frame.width, frame.height]} />
      {texture ? (
        <meshBasicMaterial key={texture.uuid} map={texture} color="#ffffff" side={THREE.DoubleSide} depthWrite={false} depthTest={false} transparent={false} toneMapped={false} />
      ) : (
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} depthWrite={false} depthTest={false} transparent={false} toneMapped={false} />
      )}
      <Edges color="#b5bac2" renderOrder={-19} depthWrite={false} depthTest={false} />
    </mesh>
    {!texture && <Html center position={frame.center}><span role="status" style={{ color: '#111827', whiteSpace: 'nowrap' }}>Loading plan…</span></Html>}
  </>;
}
