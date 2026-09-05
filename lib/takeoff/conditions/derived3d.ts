import { validateDrawingGeometry, type DrawingGeometry } from '../geometry.ts';
import { linearFootprint } from '../physicalGeometry.ts';
import { conditionArchetype } from './catalog.ts';
import { calibrationScale, elevationRange, finiteNumber, positiveNumber, record, stableDerived3DHash, toPlanPoint } from './derived3d/coordinates.ts';
import { GEOMETRY_EPS_FT, spatialChecks, validateFootprint } from './derived3d/checks.ts';
import type { BuildDerived3DSceneInput, Derived3DConditionSource, Derived3DGeometryCache, Derived3DIssue, Derived3DScene, Derived3DShape, Derived3DSolid } from './derived3d/contracts.ts';
export type * from './derived3d/contracts.ts';
export { stableDerived3DHash } from './derived3d/coordinates.ts';
export const PROJECTION_VERSION = 'concrete-projection-v2';

function geometryFromSource(value: unknown): DrawingGeometry {
  const raw = record(value);
  const point = (value: unknown) => {
    const p = record(value), x = finiteNumber(p.x), y = finiteNumber(p.y);
    if (x === null || y === null) throw new Error('Drawing contains an invalid point.');
    return { x, y };
  };
  if (!Array.isArray(raw.points)) throw new Error('Drawing points are missing.');
  if (raw.holes !== undefined && !Array.isArray(raw.holes)) throw new Error('Area cutouts are invalid.');
  const geometry = { type: raw.type, points: raw.points.map(point), ...(raw.holes !== undefined ? { holes: raw.holes.map((ring: unknown) => { if (!Array.isArray(ring)) throw new Error('Area cutout is invalid.'); return ring.map(point); }) } : {}) } as DrawingGeometry;
  validateDrawingGeometry(geometry);
  return geometry;
}

export function projectionCapability(condition: Derived3DConditionSource): { supported: boolean; reason?: string } {
  if (!['strip_wall_footing', 'slab_on_grade', 'pad_column_footing'].includes(condition.archetypeKey)) return { supported: false, reason: 'This Condition family has no supported projection adapter.' };
  const version = condition.contractVersion ?? 1;
  const known = condition.archetypeKey === 'strip_wall_footing' ? [1, 2, 3] : [1];
  if (!known.includes(version) || (condition.engineKey !== undefined && condition.engineKey !== 'concrete_condition_v1')) return { supported: false, reason: 'This Condition version has no supported physical projection adapter.' };
  return { supported: true };
}

export function buildDerived3DScene(input: BuildDerived3DSceneInput, cache?: Derived3DGeometryCache): Derived3DScene {
  try { return projectScene(input, cache); }
  catch {
    // Projection failure must never take down the authoritative drawing or worksheet.
    cache?.clear();
    return { scopeKey: input.scopeKey || 'sheet-local', hash: 'unavailable', state: input.state || 'saved', unavailable: true, solids: [], issues: [], sourceQuantities: {}, coverage: { requested: input.conditions.length, projected: 0, held: input.conditions.length, checksComplete: false } };
  }
}
function projectScene(input: BuildDerived3DSceneInput, cache?: Derived3DGeometryCache): Derived3DScene {
  const measurements = new Map(input.measurements.map(m => [m.id, m]));
  const sheets = new Map(input.sheets.map(s => [s.id, s]));
  const solids: Derived3DSolid[] = [], issues: Derived3DIssue[] = [];
  const sourceQuantities: Derived3DScene['sourceQuantities'] = {};
  const scopeKey = input.scopeKey || 'sheet-local';
  let requested = 0, projected = 0;
  const usedKeys = new Set<string>();
  const conditions = [...input.conditions].sort((a, b) => a.conditionId.localeCompare(b.conditionId) || a.conditionVersionId.localeCompare(b.conditionVersionId));
  for (const condition of conditions) {
    const capable = projectionCapability(condition);
    const primaryRole = capable.supported ? conditionArchetype(condition.archetypeKey).roles.find(r => r.primary) : undefined;
    const assignments = condition.roles.filter(r => r.roleKey === primaryRole?.key).sort((a, b) => (a.roleInstanceKey || a.measurementId).localeCompare(b.roleInstanceKey || b.measurementId));
    for (const assignment of assignments.length ? assignments : [null]) {
      requested++;
      const measurement = assignment ? measurements.get(assignment.measurementId) : undefined;
      const sheetId = measurement?.sheet_id || null;
      const sourceKey = stableDerived3DHash([PROJECTION_VERSION, condition.conditionVersionId, condition.updatedAt, measurement?.updated_at, measurement?.geometry, measurement?.calibrationKey]);
      const report = (code: Derived3DIssue['code'], message: string, target: Derived3DIssue['target'] = 'drawing', severity: Derived3DIssue['severity'] = 'hold') => {
        const value = { code, message, target, severity, conditionVersionId: condition.conditionVersionId, measurementId: assignment?.measurementId || null, sheetId, sourceKey };
        issues.push({ ...value, id: `3d-issue:${stableDerived3DHash(value)}` });
      };
      if (!capable.supported) { report('unsupported_projection', capable.reason!, 'general'); continue; }
      if (!assignment || !primaryRole) { report('3d_input_required', `Assign ${primaryRole?.label || 'the primary takeoff'} before 3D verification.`, 'general'); continue; }
      if (!measurement) { report('3d_input_required', 'The linked takeoff measurement is unavailable.', 'general'); continue; }
      const sheet = sheetId ? sheets.get(sheetId) : undefined;
      const scale = calibrationScale(measurement.calibration === undefined ? sheet?.calibration : measurement.calibration);
      if (!sheet || !positiveNumber(sheet.page_width) || !positiveNumber(sheet.page_height) || !scale) { report('3d_input_required', 'Set a valid scale for this measurement on its drawing sheet.'); continue; }
      const raw = record(measurement.geometry);
      if (['segments', 'steps', 'segment_overrides', 'instance_overrides'].some(key => raw[key] !== undefined && (!Array.isArray(raw[key]) || raw[key].length))) {
        report('unsupported_projection', 'This measurement includes segment or instance overrides that require a supported Condition contract.'); continue;
      }
      let geometry: DrawingGeometry;
      try { geometry = geometryFromSource(raw); }
      catch (error) { const message = error instanceof Error ? error.message : 'Invalid drawing geometry.'; report(/cutout/i.test(message) ? 'cutout_inconsistency' : 'invalid_geometry', message); continue; }
      if (geometry.type !== primaryRole.geometryType) { report('invalid_geometry', `The ${primaryRole.label} geometry does not match its measurement role.`); continue; }
      if (measurement.sourceIssue) { report('quantity_mismatch', measurement.sourceIssue, 'general'); continue; }
      const rawQuantity = finiteNumber(measurement.raw_quantity);
      if (rawQuantity === null || rawQuantity < 0 || measurement.raw_unit !== primaryRole.unit) { report('quantity_mismatch', 'The saved measurement quantity or unit is invalid.', 'general'); continue; }
      const elevation = finiteNumber(condition.drawingInputs.elevation_ft);
      if (elevation === null) { report('3d_input_required', 'Enter an elevation for 3D verification.'); continue; }
      const depth = condition.archetypeKey === 'slab_on_grade' ? positiveNumber(condition.planFacts.thickness_in) : positiveNumber(condition.planFacts.depth_ft);
      if (!depth) { report('3d_input_required', condition.archetypeKey === 'slab_on_grade' ? 'Enter slab thickness for 3D verification.' : 'Enter footing depth for 3D verification.', 'general'); continue; }
      const range = elevationRange(elevation, condition.archetypeKey === 'slab_on_grade' ? depth / 12 : depth, condition.drawingInputs.elevation_reference);
      if (!range) { report('3d_input_required', 'Choose Top, Bottom, or Centerline as the elevation reference.'); continue; }
      const shapes: Array<{ part: string; shape: Derived3DShape }> = [];
      try {
        if (condition.archetypeKey === 'slab_on_grade') {
          const outer = geometry.points.map(p => toPlanPoint(p, sheet, scale)), holes = (geometry.holes || []).map(r => r.map(p => toPlanPoint(p, sheet, scale)));
          validateFootprint(outer, holes);
          shapes.push({ part: 'body', shape: { kind: 'prism', outer, holes, ...range } });
        } else if (condition.archetypeKey === 'strip_wall_footing') {
          const width = positiveNumber(condition.planFacts.width_ft);
          if (!width) { report('3d_input_required', 'Enter footing width for 3D verification.', 'general'); continue; }
          const version = condition.contractVersion ?? 1;
          const profile = version >= 2 ? condition.concreteProfile?.profile : 'rectangular';
          if (profile !== 'rectangular' && profile !== 'trapezoid') { report('3d_input_required', 'Choose the concrete section profile.', 'concrete'); continue; }
          const topWidth = profile === 'trapezoid' ? positiveNumber(condition.concreteProfile?.topWidthFt) : width;
          if (!topWidth) { report('3d_input_required', 'Enter the trapezoid top width.', 'concrete'); continue; }
          const anchor = measurement.geometry_anchor || 'center';
          if (!['center', 'left', 'right', 'custom'].includes(anchor)) { report('unsupported_projection', 'The footing anchor is not supported.'); continue; }
          const custom = anchor === 'custom' ? finiteNumber(measurement.geometry_offset_in) : 0;
          if (custom === null) { report('3d_input_required', 'Enter the custom footing offset.'); continue; }
          const centerOffsetIn = anchor === 'left' ? width * 6 : anchor === 'right' ? -width * 6 : anchor === 'custom' ? custom : 0;
          if (geometry.points.some((p, i) => i > 0 && Math.hypot((p.x - geometry.points[i - 1].x) * Number(sheet.page_width) * scale, (p.y - geometry.points[i - 1].y) * Number(sheet.page_height) * scale) <= GEOMETRY_EPS_FT)) throw new Error('The footing run contains a zero-length segment.');
          const ring = (widthFt: number) => linearFootprint(geometry.points, Number(sheet.page_width), Number(sheet.page_height), scale, widthFt * 12, 'custom', centerOffsetIn).map(p => toPlanPoint(p, sheet, scale));
          const outer = ring(width), topOuter = profile === 'trapezoid' && topWidth !== width ? ring(topWidth) : undefined;
          validateFootprint(outer);
          if (topOuter) validateFootprint(topOuter);
          shapes.push({ part: 'run', shape: { kind: 'prism', outer, holes: [], ...(topOuter ? { topOuter } : {}), ...range } });
        } else {
          const width = positiveNumber(condition.planFacts.width_ft), length = positiveNumber(condition.planFacts.length_ft);
          if (!width || !length) { report('3d_input_required', 'Enter footing width and length.', 'general'); continue; }
          const yawValue = condition.drawingInputs.rotation_deg;
          const yaw = yawValue === undefined ? 0 : finiteNumber(yawValue);
          if (yaw === null) { report('3d_input_required', 'Enter a valid footing orientation.'); continue; }
          const repeated = new Map<string, number>();
          geometry.points.forEach(p => {
            const point = toPlanPoint(p, sheet, scale), pointKey = stableDerived3DHash(p);
            const ordinal = (repeated.get(pointKey) || 0) + 1; repeated.set(pointKey, ordinal);
            shapes.push({ part: `location:${pointKey}:${ordinal}`, shape: { kind: 'box', centerX: point.x, centerZ: point.z, width, length, yawRad: yaw * Math.PI / 180, ...range } });
          });
        }
      } catch (error) { report('invalid_geometry', error instanceof Error ? error.message : 'The physical footprint is invalid.'); continue; }
      const quantityKey = `${scopeKey}:${measurement.id}`;
      sourceQuantities[quantityKey] = { measurementId: measurement.id, value: rawQuantity, unit: measurement.raw_unit, revision: measurement.updated_at || null };
      const reference = {
        conditionId: condition.conditionId, conditionVersionId: condition.conditionVersionId, measurementId: measurement.id,
        roleKey: assignment.roleKey, roleInstanceKey: assignment.roleInstanceKey || assignment.roleKey,
        templateVersionId: condition.templateVersionId || null, archetypeVersionId: condition.archetypeVersionId || null,
        conditionRevision: condition.updatedAt || null, measurementRevision: measurement.updated_at || null,
        sheetId: sheet.id, sheetRevision: sheet.revision || null, calibrationKey: measurement.calibrationKey || stableDerived3DHash(measurement.calibration === undefined ? sheet.calibration : measurement.calibration),
      };
      for (const { part, shape } of shapes) {
        const id = `3d:${scopeKey}:${condition.conditionId}:${measurement.id}:${reference.roleInstanceKey}:${part}`;
        const geometryKey = stableDerived3DHash([PROJECTION_VERSION, reference.conditionVersionId, reference.templateVersionId, reference.archetypeVersionId, reference.measurementRevision, reference.sheetRevision, reference.calibrationKey, shape]);
        const previous = cache?.get(id), resolvedShape = previous?.key === geometryKey ? previous.shape : shape;
        cache?.set(id, { key: geometryKey, shape: resolvedShape }); usedKeys.add(id);
        solids.push({ ...reference, id, geometryKey, conditionCode: condition.code, conditionName: condition.name, archetypeKey: condition.archetypeKey, measurementName: measurement.name, zone: String(measurement.location || '').trim() || null, color: condition.color, sourceQuantityKey: quantityKey, shape: resolvedShape });
      }
      projected++;
    }
  }
  if (cache) for (const key of cache.keys()) if (!usedKeys.has(key)) cache.delete(key);
  const checked = spatialChecks(solids);
  issues.push(...checked.issues);
  return { scopeKey, state: input.state || 'saved', sourceQuantities, solids, issues,
    hash: stableDerived3DHash([scopeKey, solids.map(s => [s.id, s.geometryKey]), issues.map(i => i.id)]),
    coverage: { requested, projected, held: requested - projected, checksComplete: checked.complete } };
}
