import type { Derived3DScene, Derived3DSolid } from '../conditions/derived3d/contracts.ts';
import { Box3, Vector3 } from 'three';
import { buildTakeoffMeshGeometry } from './meshGeometry.ts';

export function solidSelectionIdentity(solid: Derived3DSolid) {
  return { solidId: solid.id, measurementId: solid.measurementId, conditionVersionId: solid.conditionVersionId, sheetId: solid.sheetId };
}

export function sheetSolidsForSelection(scene: Derived3DScene, activeSheetId: string | null): Derived3DSolid[] {
  return activeSheetId ? scene.solids.filter(solid => solid.sheetId === activeSheetId) : [];
}

export function selectedSolidForMeasurement(solids: Derived3DSolid[], measurementId: string | null): Derived3DSolid | null {
  return measurementId ? solids.find(solid => solid.measurementId === measurementId) ?? null : null;
}

// Camera framing only. No source geometry, quantities or persisted values change.
export function focusFrameForSolids(solids: Derived3DSolid[]): { target: [number, number, number]; width: number; height: number } | null {
  const bounds = new Box3();
  for (const solid of solids) {
    try {
      const geometry = buildTakeoffMeshGeometry(solid.shape);
      if (geometry.boundingBox) bounds.union(geometry.boundingBox);
      geometry.dispose();
    } catch { /* Unsupported solids are disclosed by the existing mesh issue path. */ }
  }
  if (bounds.isEmpty()) return null;
  const center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3());
  return { target: [center.x, center.y, center.z], width: Math.max(1, Math.hypot(size.x, size.z)), height: Math.max(1, size.y) };
}
