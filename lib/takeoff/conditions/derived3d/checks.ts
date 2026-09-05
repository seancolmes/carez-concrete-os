import { validateDrawingGeometry } from '../../geometry.ts';
import type { Derived3DPlanPoint as Point, Derived3DShape, Derived3DSolid, Derived3DIssue } from './contracts.ts';
import { stableDerived3DHash } from './coordinates.ts';

// Numerical robustness only, in feet. This is not a job gap/review tolerance.
export const GEOMETRY_EPS_FT = 1e-7;
const MAX_NARROW_PHASE_EDGE_PAIRS = 40000;
const MAX_CANDIDATE_CHECKS = 2000;
export function footprint(shape: Derived3DShape): { outer: Point[]; holes: Point[][] } {
  if (shape.kind === 'prism') return { outer: shape.outer, holes: shape.holes };
  const cos = Math.cos(shape.yawRad), sin = Math.sin(shape.yawRad);
  return { outer: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({
    x: shape.centerX + x * shape.length / 2 * cos - z * shape.width / 2 * sin,
    z: shape.centerZ + x * shape.length / 2 * sin + z * shape.width / 2 * cos,
  })), holes: [] };
}
export function validateFootprint(outer: Point[], holes: Point[][] = []) {
  const points = [outer, ...holes].flat();
  if (!points.length || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z))) throw new Error('Physical footprint contains invalid points.');
  const minX = Math.min(...points.map(p => p.x)), minZ = Math.min(...points.map(p => p.z));
  const spanX = Math.max(...points.map(p => p.x)) - minX, spanZ = Math.max(...points.map(p => p.z)) - minZ;
  if (spanX <= GEOMETRY_EPS_FT || spanZ <= GEOMETRY_EPS_FT) throw new Error('Physical footprint has no area.');
  // Reuse authoritative topology validation without applying the PDF page boundary to a physical offset.
  const normalized = (ring: Point[]) => ring.map(p => ({ x: (p.x - minX) / spanX, y: (p.z - minZ) / spanZ }));
  validateDrawingGeometry({ type: 'polygon', points: normalized(outer), holes: holes.map(normalized) });
}
type Edge = [Point, Point];
function edges(rings: Point[][]): Edge[] { return rings.flatMap(ring => ring.map((p, i) => [p, ring[(i + 1) % ring.length]] as Edge)); }
function crossingX([a, b]: Edge, [c, d]: Edge): number | null {
  const rx = b.x - a.x, rz = b.z - a.z, sx = d.x - c.x, sz = d.z - c.z;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) <= Number.EPSILON) return null;
  const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den;
  const u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? a.x + t * rx : null;
}
function intervalsAt(x: number, source: Edge[]): Array<[number, number]> {
  const z = source.flatMap(([a, b]) => (a.x > x) !== (b.x > x) ? [a.z + (x - a.x) * (b.z - a.z) / (b.x - a.x)] : []).sort((a, b) => a - b);
  const result: Array<[number, number]> = [];
  for (let i = 0; i + 1 < z.length; i += 2) result.push([z[i], z[i + 1]]);
  return result;
}
/** Positive material intersection, including concave outlines and holes; touching is not overlap. */
export function footprintsOverlap(a: ReturnType<typeof footprint>, b: ReturnType<typeof footprint>): boolean | null {
  const ae = edges([a.outer, ...a.holes]), be = edges([b.outer, ...b.holes]);
  if (ae.length * be.length > MAX_NARROW_PHASE_EDGE_PAIRS) return null;
  const events = [...ae, ...be].flatMap(([p]) => [p.x]);
  for (const x of ae) for (const y of be) { const hit = crossingX(x, y); if (hit !== null) events.push(hit); }
  const xs = [...new Set(events)].sort((x, y) => x - y);
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - xs[i - 1] <= GEOMETRY_EPS_FT) continue;
    const x = (xs[i] + xs[i - 1]) / 2;
    const ai = intervalsAt(x, ae), bi = intervalsAt(x, be);
    if (ai.some(([low, high]) => bi.some(([otherLow, otherHigh]) => Math.min(high, otherHigh) - Math.max(low, otherLow) > GEOMETRY_EPS_FT))) return true;
  }
  return false;
}
function canonicalRing(ring: Point[]): string {
  const p = ring.map(point => `${point.x.toFixed(7)},${point.z.toFixed(7)}`);
  const variants = [p, [...p].reverse()].map(r => { let smallest = 0; for (let i = 1; i < r.length; i++) if (r[i] < r[smallest]) smallest = i; return [...r.slice(smallest), ...r.slice(0, smallest)].join(';'); });
  return variants.sort()[0];
}
function samePlacement(a: Derived3DShape, b: Derived3DShape): boolean {
  if (Math.abs(a.bottom - b.bottom) > GEOMETRY_EPS_FT || Math.abs(a.top - b.top) > GEOMETRY_EPS_FT) return false;
  const x = footprint(a), y = footprint(b);
  return canonicalRing(x.outer) === canonicalRing(y.outer) && x.holes.map(canonicalRing).sort().join('|') === y.holes.map(canonicalRing).sort().join('|');
}
export function spatialChecks(solids: Derived3DSolid[]): { issues: Derived3DIssue[]; complete: boolean } {
  const issues: Derived3DIssue[] = []; let complete = true, candidates = 0;
  const bounded = solids.map(solid => {
    const f = footprint(solid.shape), points = [...f.outer, ...(solid.shape.kind === 'prism' ? solid.shape.topOuter || [] : [])];
    return { solid, f, minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) };
  }).sort((a, b) => a.solid.sheetId.localeCompare(b.solid.sheetId) || a.minX - b.minX || a.solid.id.localeCompare(b.solid.id));
  const push = (code: Derived3DIssue['code'], a: Derived3DSolid, b: Derived3DSolid | null, message: string) => {
    const sourceKey = stableDerived3DHash([a.geometryKey, b?.geometryKey, 'spatial-v2']);
    const ids = [a.id, ...(b ? [b.id] : [])].sort();
    issues.push({ id: `3d:${code}:${stableDerived3DHash([ids, sourceKey])}`, code, severity: 'warning', conditionVersionId: a.conditionVersionId, measurementId: a.measurementId, sheetId: a.sheetId, relatedSolidIds: ids, sourceKey, target: 'drawing', message });
  };
  outer: for (let i = 0; i < bounded.length; i++) for (let j = i + 1; j < bounded.length; j++) {
    const a = bounded[i], b = bounded[j];
    if (a.solid.sheetId !== b.solid.sheetId || b.minX >= a.maxX - GEOMETRY_EPS_FT) break;
    if (Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) <= GEOMETRY_EPS_FT || Math.min(a.solid.shape.top, b.solid.shape.top) - Math.max(a.solid.shape.bottom, b.solid.shape.bottom) <= GEOMETRY_EPS_FT) continue;
    if (++candidates > MAX_CANDIDATE_CHECKS) { complete = false; push('check_limit', a.solid, null, 'Additional intersection checks were not run. Review a smaller sheet or zone scope.'); break outer; }
    const tapered = [a.solid, b.solid].some(s => s.shape.kind === 'prism' && s.shape.topOuter);
    const overlap = tapered ? null : footprintsOverlap(a.f, b.f);
    if (overlap === false) continue;
    if (overlap === null) { complete = false; push('potential_overlap', a.solid, b.solid, `Possible overlap: ${a.solid.conditionCode} / ${b.solid.conditionCode}. Exact intersection is not checked for this profile or complexity.`); continue; }
    const duplicate = samePlacement(a.solid.shape, b.solid.shape);
    push(duplicate ? 'duplicate_placement' : 'geometric_overlap', a.solid, b.solid, `${duplicate ? 'Coincident placements' : 'Intersecting concrete'}: ${a.solid.conditionCode} / ${b.solid.conditionCode}. Review scope; quantities have not been adjusted.`);
  }
  return { issues, complete };
}
