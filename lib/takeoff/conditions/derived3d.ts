import { conditionArchetype } from './catalog.ts';
import type { ConditionArchetypeKey } from './types.ts';

export type Derived3DPlanPoint = { x: number; z: number };

export type Derived3DBoxShape = {
  kind: 'box';
  centerX: number;
  centerZ: number;
  width: number;
  length: number;
  yawRad: number;
  bottom: number;
  top: number;
};

export type Derived3DPrismShape = {
  kind: 'prism';
  outer: Derived3DPlanPoint[];
  holes: Derived3DPlanPoint[][];
  bottom: number;
  top: number;
};

export type Derived3DSolid = {
  id: string;
  conditionId: string;
  conditionVersionId: string;
  conditionCode: string;
  conditionName: string;
  archetypeKey: ConditionArchetypeKey;
  measurementId: string;
  measurementName: string;
  sheetId: string;
  zone: string | null;
  color: string;
  sourceQuantity: { value: number; unit: string };
  shape: Derived3DBoxShape | Derived3DPrismShape;
};

export type Derived3DIssueCode =
  | '3d_input_required'
  | 'invalid_geometry'
  | 'cutout_inconsistency'
  | 'potential_overlap';

export type Derived3DIssue = {
  id: string;
  code: Derived3DIssueCode;
  severity: 'hold' | 'warning';
  conditionVersionId: string;
  measurementId: string | null;
  sheetId: string | null;
  message: string;
  relatedSolidIds?: string[];
};

export type Derived3DScene = {
  hash: string;
  solids: Derived3DSolid[];
  issues: Derived3DIssue[];
};

export type Derived3DConditionSource = {
  conditionId: string;
  conditionVersionId: string;
  code: string;
  name: string;
  archetypeKey: ConditionArchetypeKey;
  color: string;
  planFacts: Record<string, unknown>;
  drawingInputs: Record<string, unknown>;
  roles: Array<{ roleKey: string; measurementId: string }>;
};

export type Derived3DMeasurementSource = {
  id: string;
  sheet_id: string | null;
  name: string;
  location?: string | null;
  raw_quantity: number | string;
  raw_unit: string;
  geometry: unknown;
};

export type Derived3DSheetSource = {
  id: string;
  page_width: number | string | null;
  page_height: number | string | null;
  calibration: unknown;
};

export type BuildDerived3DSceneInput = {
  conditions: Derived3DConditionSource[];
  measurements: Derived3DMeasurementSource[];
  sheets: Derived3DSheetSource[];
};

type NormalizedPoint = { x: number; y: number };
type NormalizedGeometry = {
  type: 'polyline' | 'polygon' | 'count';
  points: NormalizedPoint[];
  holes: NormalizedPoint[][];
};
type Bounds = { minX: number; minZ: number; maxX: number; maxZ: number; bottom: number; top: number };

const EPS = 1e-6;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function positiveNumber(value: unknown): number | null {
  const result = finiteNumber(value);
  return result !== null && result > 0 ? result : null;
}

function normalizedGeometry(value: unknown): NormalizedGeometry | null {
  const source = asRecord(value);
  if (!['polyline', 'polygon', 'count'].includes(String(source.type || ''))) return null;
  const points = Array.isArray(source.points)
    ? source.points.map(point => asRecord(point)).map(point => ({ x: Number(point.x), y: Number(point.y) }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  const holes = source.type === 'polygon' && Array.isArray(source.holes)
    ? source.holes.map(ring => Array.isArray(ring)
      ? ring.map(point => asRecord(point)).map(point => ({ x: Number(point.x), y: Number(point.y) }))
        .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
      : []).filter(ring => ring.length >= 3)
    : [];
  if (!points.length) return null;
  return { type: source.type as NormalizedGeometry['type'], points, holes };
}

function sheetScale(sheet: Derived3DSheetSource): number | null {
  const calibration = asRecord(sheet.calibration);
  const direct = positiveNumber(calibration.ft_per_pdf_unit);
  if (direct) return direct;
  const known = positiveNumber(calibration.known_distance_ft);
  const pdf = positiveNumber(calibration.pdf_distance);
  return known && pdf ? known / pdf : null;
}

function toPlanPoint(point: NormalizedPoint, sheet: Derived3DSheetSource, scale: number): Derived3DPlanPoint {
  return {
    x: point.x * Number(sheet.page_width) * scale,
    z: point.y * Number(sheet.page_height) * scale,
  };
}

function elevationRange(elevation: number, depth: number, reference: string): { bottom: number; top: number } | null {
  if (reference === 'top') return { bottom: elevation - depth, top: elevation };
  if (reference === 'bottom') return { bottom: elevation, top: elevation + depth };
  if (reference === 'centerline') return { bottom: elevation - depth / 2, top: elevation + depth / 2 };
  return null;
}

function pointInPolygon(point: Derived3DPlanPoint, polygon: Derived3DPlanPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = ((a.z > point.z) !== (b.z > point.z))
      && point.x < ((b.x - a.x) * (point.z - a.z)) / ((b.z - a.z) || EPS) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function boxCorners(shape: Derived3DBoxShape): Derived3DPlanPoint[] {
  const halfLength = shape.length / 2;
  const halfWidth = shape.width / 2;
  const cos = Math.cos(shape.yawRad);
  const sin = Math.sin(shape.yawRad);
  return [
    { x: -halfLength, z: -halfWidth },
    { x: halfLength, z: -halfWidth },
    { x: halfLength, z: halfWidth },
    { x: -halfLength, z: halfWidth },
  ].map(point => ({
    x: shape.centerX + point.x * cos - point.z * sin,
    z: shape.centerZ + point.x * sin + point.z * cos,
  }));
}

function boundsForSolid(solid: Derived3DSolid): Bounds {
  const points = solid.shape.kind === 'box' ? boxCorners(solid.shape) : solid.shape.outer;
  return {
    minX: Math.min(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)),
    maxX: Math.max(...points.map(point => point.x)),
    maxZ: Math.max(...points.map(point => point.z)),
    bottom: solid.shape.bottom,
    top: solid.shape.top,
  };
}

function overlapAmount(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

export function stableDerived3DHash(value: unknown): string {
  const text = JSON.stringify(stableValue(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function issue(input: Omit<Derived3DIssue, 'id'>): Derived3DIssue {
  return { ...input, id: `3d-issue-${stableDerived3DHash(input)}` };
}

function solidId(conditionVersionId: string, measurementId: string, part: number): string {
  return `3d:${conditionVersionId}:${measurementId}:${String(part).padStart(3, '0')}`;
}

function sourceQuantity(measurement: Derived3DMeasurementSource) {
  return { value: Number(measurement.raw_quantity || 0), unit: String(measurement.raw_unit || '').toUpperCase() };
}

function addInputIssue(
  issues: Derived3DIssue[],
  condition: Derived3DConditionSource,
  measurementId: string | null,
  sheetId: string | null,
  message: string,
) {
  issues.push(issue({
    code: '3d_input_required',
    severity: 'hold',
    conditionVersionId: condition.conditionVersionId,
    measurementId,
    sheetId,
    message,
  }));
}

export function buildDerived3DScene(input: BuildDerived3DSceneInput): Derived3DScene {
  const measurements = new Map(input.measurements.map(measurement => [measurement.id, measurement]));
  const sheets = new Map(input.sheets.map(sheet => [sheet.id, sheet]));
  const solids: Derived3DSolid[] = [];
  const issues: Derived3DIssue[] = [];

  const conditions = [...input.conditions].sort((a, b) => a.conditionVersionId.localeCompare(b.conditionVersionId));
  for (const condition of conditions) {
    const definition = conditionArchetype(condition.archetypeKey);
    const primaryRole = definition.roles.find(role => role.primary);
    const assignment = primaryRole ? condition.roles.find(role => role.roleKey === primaryRole.key) : null;
    if (!primaryRole || !assignment?.measurementId) {
      addInputIssue(issues, condition, null, null, `Assign ${primaryRole?.label || 'the primary takeoff'} before 3D verification.`);
      continue;
    }

    const measurement = measurements.get(assignment.measurementId);
    if (!measurement) {
      addInputIssue(issues, condition, assignment.measurementId, null, 'The primary takeoff measurement is unavailable for 3D verification.');
      continue;
    }
    if (!measurement.sheet_id) {
      addInputIssue(issues, condition, measurement.id, null, 'The primary takeoff must be attached to a drawing sheet for 3D verification.');
      continue;
    }
    const sheet = sheets.get(measurement.sheet_id);
    const scale = sheet ? sheetScale(sheet) : null;
    if (!sheet || !positiveNumber(sheet.page_width) || !positiveNumber(sheet.page_height) || !scale) {
      addInputIssue(issues, condition, measurement.id, measurement.sheet_id, 'Set a valid sheet scale before 3D verification.');
      continue;
    }

    const geometry = normalizedGeometry(measurement.geometry);
    if (!geometry || geometry.type !== primaryRole.geometryType) {
      issues.push(issue({
        code: 'invalid_geometry',
        severity: 'hold',
        conditionVersionId: condition.conditionVersionId,
        measurementId: measurement.id,
        sheetId: measurement.sheet_id,
        message: `The ${primaryRole.label} geometry is missing or does not match ${primaryRole.geometryType}.`,
      }));
      continue;
    }

    const elevation = finiteNumber(condition.drawingInputs.elevation_ft);
    const reference = String(condition.drawingInputs.elevation_reference || '');
    if (elevation === null) {
      addInputIssue(issues, condition, measurement.id, measurement.sheet_id, 'Enter an elevation for 3D verification.');
      continue;
    }
    if (!['top', 'bottom', 'centerline'].includes(reference)) {
      addInputIssue(issues, condition, measurement.id, measurement.sheet_id, 'Choose Top, Bottom, or Centerline as the 3D elevation reference.');
      continue;
    }

    const common = {
      conditionId: condition.conditionId,
      conditionVersionId: condition.conditionVersionId,
      conditionCode: condition.code,
      conditionName: condition.name,
      archetypeKey: condition.archetypeKey,
      measurementId: measurement.id,
      measurementName: measurement.name,
      sheetId: measurement.sheet_id,
      zone: String(measurement.location || '').trim() || null,
      color: condition.color,
      sourceQuantity: sourceQuantity(measurement),
    };

    if (condition.archetypeKey === 'slab_on_grade') {
      const thickness = positiveNumber(condition.planFacts.thickness_in);
      if (!thickness) {
        addInputIssue(issues, condition, measurement.id, measurement.sheet_id, 'Enter slab thickness before 3D verification.');
        continue;
      }
      if (geometry.points.length < 3) {
        issues.push(issue({ code: 'invalid_geometry', severity: 'hold', conditionVersionId: condition.conditionVersionId, measurementId: measurement.id, sheetId: measurement.sheet_id, message: 'Slab 3D verification requires a closed area with at least three vertices.' }));
        continue;
      }
      const range = elevationRange(elevation, thickness / 12, reference)!;
      const outer = geometry.points.map(point => toPlanPoint(point, sheet, scale));
      const holes = geometry.holes.map(ring => ring.map(point => toPlanPoint(point, sheet, scale)));
      for (const hole of holes) {
        if (hole.some(point => !pointInPolygon(point, outer))) {
          issues.push(issue({
            code: 'cutout_inconsistency',
            severity: 'warning',
            conditionVersionId: condition.conditionVersionId,
            measurementId: measurement.id,
            sheetId: measurement.sheet_id,
            message: 'A slab cutout extends outside the authoritative slab boundary.',
          }));
        }
      }
      solids.push({ ...common, id: solidId(condition.conditionVersionId, measurement.id, 0), shape: { kind: 'prism', outer, holes, ...range } });
      continue;
    }

    if (condition.archetypeKey === 'strip_wall_footing') {
      const width = positiveNumber(condition.planFacts.width_ft);
      const depth = positiveNumber(condition.planFacts.depth_ft);
      if (!width || !depth) {
        addInputIssue(issues, condition, measurement.id, measurement.sheet_id, 'Enter footing width and depth before 3D verification.');
        continue;
      }
      if (geometry.points.length < 2) {
        issues.push(issue({ code: 'invalid_geometry', severity: 'hold', conditionVersionId: condition.conditionVersionId, measurementId: measurement.id, sheetId: measurement.sheet_id, message: 'Strip footing 3D verification requires at least two run points.' }));
        continue;
      }
      const range = elevationRange(elevation, depth, reference)!;
      const points = geometry.points.map(point => toPlanPoint(point, sheet, scale));
      for (let index = 1; index < points.length; index += 1) {
        const a = points[index - 1];
        const b = points[index];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = Math.hypot(dx, dz);
        if (length <= EPS) {
          issues.push(issue({ code: 'invalid_geometry', severity: 'warning', conditionVersionId: condition.conditionVersionId, measurementId: measurement.id, sheetId: measurement.sheet_id, message: `Strip footing segment ${index} has zero length.` }));
          continue;
        }
        solids.push({
          ...common,
          id: solidId(condition.conditionVersionId, measurement.id, index - 1),
          shape: {
            kind: 'box',
            centerX: (a.x + b.x) / 2,
            centerZ: (a.z + b.z) / 2,
            width,
            length,
            yawRad: Math.atan2(dz, dx),
            ...range,
          },
        });
      }
      continue;
    }

    if (condition.archetypeKey === 'pad_column_footing') {
      const width = positiveNumber(condition.planFacts.width_ft);
      const length = positiveNumber(condition.planFacts.length_ft);
      const depth = positiveNumber(condition.planFacts.depth_ft);
      if (!width || !length || !depth) {
        addInputIssue(issues, condition, measurement.id, measurement.sheet_id, 'Enter footing width, length, and depth before 3D verification.');
        continue;
      }
      const range = elevationRange(elevation, depth, reference)!;
      const points = geometry.points.map(point => toPlanPoint(point, sheet, scale));
      points.forEach((point, index) => solids.push({
        ...common,
        id: solidId(condition.conditionVersionId, measurement.id, index),
        shape: {
          kind: 'box',
          centerX: point.x,
          centerZ: point.z,
          width,
          length,
          yawRad: 0,
          ...range,
        },
      }));
    }
  }

  const bounded = solids.map(solid => ({ solid, bounds: boundsForSolid(solid) }));
  for (let left = 0; left < bounded.length; left += 1) {
    for (let right = left + 1; right < bounded.length; right += 1) {
      const a = bounded[left];
      const b = bounded[right];
      if (a.solid.sheetId !== b.solid.sheetId) continue;
      if (a.solid.measurementId === b.solid.measurementId && a.solid.archetypeKey !== 'pad_column_footing') continue;
      if (overlapAmount(a.bounds.minX, a.bounds.maxX, b.bounds.minX, b.bounds.maxX) <= EPS
        || overlapAmount(a.bounds.minZ, a.bounds.maxZ, b.bounds.minZ, b.bounds.maxZ) <= EPS
        || overlapAmount(a.bounds.bottom, a.bounds.top, b.bounds.bottom, b.bounds.top) <= EPS) continue;
      issues.push(issue({
        code: 'potential_overlap',
        severity: 'warning',
        conditionVersionId: a.solid.conditionVersionId,
        measurementId: a.solid.measurementId,
        sheetId: a.solid.sheetId,
        message: `Potential 3D overlap: ${a.solid.conditionCode} and ${b.solid.conditionCode}. Verify the plan geometry and elevations.`,
        relatedSolidIds: [a.solid.id, b.solid.id],
      }));
    }
  }

  const hash = stableDerived3DHash({
    conditions: conditions.map(condition => ({
      ...condition,
      roles: [...condition.roles].sort((a, b) => `${a.roleKey}:${a.measurementId}`.localeCompare(`${b.roleKey}:${b.measurementId}`)),
    })),
    measurements: [...input.measurements].sort((a, b) => a.id.localeCompare(b.id)),
    sheets: [...input.sheets].sort((a, b) => a.id.localeCompare(b.id)),
  });

  return { hash, solids, issues };
}
