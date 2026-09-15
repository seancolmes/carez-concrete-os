import type { Derived3DScene, Derived3DSolid } from '../conditions/derived3d/contracts.ts';

export function solidSelectionIdentity(solid: Derived3DSolid) {
  return { solidId: solid.id, measurementId: solid.measurementId, conditionVersionId: solid.conditionVersionId, sheetId: solid.sheetId };
}

export function sheetSolidsForSelection(scene: Derived3DScene, activeSheetId: string | null): Derived3DSolid[] {
  return activeSheetId ? scene.solids.filter(solid => solid.sheetId === activeSheetId) : [];
}

export function selectedSolidForMeasurement(solids: Derived3DSolid[], measurementId: string | null): Derived3DSolid | null {
  return measurementId ? solids.find(solid => solid.measurementId === measurementId) ?? null : null;
}
