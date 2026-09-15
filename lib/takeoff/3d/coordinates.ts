import type { Derived3DPlanPoint, Derived3DSheetPlane } from '../conditions/derived3d/contracts.ts';

export const PLAN_DATUM_Y = 0;
export type WorldPoint3 = { x: number; y: number; z: number };
export type SheetPlaneFrame = {
  width: number; height: number;
  center: [number, number, number]; rotation: [number, number, number];
};

function requirePlaneSize(plane: Derived3DSheetPlane) {
  const { worldWidth: width, worldHeight: height } = plane;
  if (width === null || height === null || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('The active sheet needs calibrated 3D dimensions.');
  }
  return { width, height };
}

export function planPointToWorld(point: Derived3DPlanPoint, elevation = PLAN_DATUM_Y): WorldPoint3 {
  return { x: point.x, y: elevation, z: point.z };
}

export function normalizedPagePointToWorld(u: number, v: number, plane: Derived3DSheetPlane): WorldPoint3 {
  const { width, height } = requirePlaneSize(plane);
  return { x: u * width, y: PLAN_DATUM_Y, z: v * height };
}

export function sheetPlaneFrame(plane: Derived3DSheetPlane): SheetPlaneFrame {
  const { width, height } = requirePlaneSize(plane);
  return { width, height, center: [width / 2, PLAN_DATUM_Y, height / 2], rotation: [-Math.PI / 2, 0, 0] };
}
