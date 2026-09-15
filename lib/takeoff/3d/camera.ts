export type Takeoff3DCameraMemory = {
  azimuth: number; polar: number; zoom: number; target: [number, number, number];
};

export const MIN_POLAR = 0.001;
export const MAX_POLAR = 5 * Math.PI / 12;
export const HOME_AZIMUTH = -Math.PI / 4;
export const HOME_POLAR = 53 * Math.PI / 180;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function sanitizeCameraMemory(value: Takeoff3DCameraMemory, fallbackTarget: [number, number, number]): Takeoff3DCameraMemory {
  return {
    azimuth: Number.isFinite(value.azimuth) ? value.azimuth : HOME_AZIMUTH,
    polar: clamp(Number.isFinite(value.polar) ? value.polar : HOME_POLAR, MIN_POLAR, MAX_POLAR),
    zoom: clamp(Number.isFinite(value.zoom) ? value.zoom : 1, 0.05, 40),
    target: value.target.every(Number.isFinite) ? [...value.target] : [...fallbackTarget],
  };
}

export function homeCameraMemory(width: number, height: number, viewportWidth: number, viewportHeight: number): Takeoff3DCameraMemory {
  const diagonal = Math.hypot(width, height) * 1.22;
  return {
    azimuth: HOME_AZIMUTH, polar: HOME_POLAR,
    zoom: clamp(Math.min(viewportWidth, viewportHeight) / diagonal, 0.05, 40),
    target: [width / 2, 0, height / 2],
  };
}

export function topCameraMemory(width: number, height: number, viewportWidth: number, viewportHeight: number): Takeoff3DCameraMemory {
  const frameMargin = 1.12;
  const zoom = clamp(Math.min(
    viewportWidth / (width * frameMargin),
    viewportHeight / (height * frameMargin),
  ), 0.05, 40);
  return {
    azimuth: 0,
    polar: MIN_POLAR,
    zoom,
    target: [width / 2, 0, height / 2],
  };
}

export function cameraPositionForMemory(memory: Takeoff3DCameraMemory, width: number, height: number): [number, number, number] {
  const radius = Math.max(100, Math.hypot(width, height) * 2);
  const sinPolar = Math.sin(memory.polar);
  return [
    memory.target[0] + radius * sinPolar * Math.sin(memory.azimuth),
    memory.target[1] + radius * Math.cos(memory.polar),
    memory.target[2] + radius * sinPolar * Math.cos(memory.azimuth),
  ];
}

export function shouldInitializeCamera(previousSheetId: string | null, nextSheetId: string | null, hasMemory: boolean): boolean {
  return nextSheetId !== null && previousSheetId !== nextSheetId && !hasMemory;
}
