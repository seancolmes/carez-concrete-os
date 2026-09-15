import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';
import type { Derived3DPlanPoint, Derived3DShape } from '../conditions/derived3d/contracts.ts';

// Presentation only: these are already calibrated X/Z feet and governed Y elevations.
export function buildTakeoffMeshGeometry(shape: Derived3DShape): BufferGeometry {
  if (![shape.bottom, shape.top].every(Number.isFinite)) throw new Error('Solid elevations must be finite.');
  if (shape.top <= shape.bottom) throw new Error('Solid top must be above its bottom.');
  let outer: Derived3DPlanPoint[];
  let upper: Derived3DPlanPoint[];
  let holes: Derived3DPlanPoint[][];
  if (shape.kind === 'box') {
    if (![shape.centerX, shape.centerZ, shape.width, shape.length, shape.yawRad].every(Number.isFinite) || shape.width <= 0 || shape.length <= 0) throw new Error('Box dimensions and position must be finite and dimensions positive.');
    const cos = Math.cos(shape.yawRad), sin = Math.sin(shape.yawRad);
    outer = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => {
      const x = sx * shape.width / 2, z = sz * shape.length / 2;
      return { x: shape.centerX + x * cos - z * sin, z: shape.centerZ + x * sin + z * cos };
    });
    upper = outer;
    holes = [];
  } else {
    if (shape.topOuter && shape.holes.length) throw new Error('Unsupported tapered prism with holes.');
    if (shape.topOuter && shape.topOuter.length !== shape.outer.length) throw new Error('Prism bottom/top vertex counts must match.');
    outer = [...shape.outer];
    upper = [...(shape.topOuter ?? shape.outer)];
    holes = shape.holes.map(ring => [...ring]);
  }
  const vectors = (ring: Derived3DPlanPoint[]) => ring.map(p => new Vector2(p.x, p.z));
  for (const ring of [outer, upper, ...holes]) {
    if (ring.length < 3 || ring.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z)) || Math.abs(ShapeUtils.area(vectors(ring))) < 1e-10) throw new Error('Solid ring must contain finite, non-degenerate geometry.');
  }
  // Reverse corresponding taper rings together; never reorder one independently.
  if (ShapeUtils.isClockWise(vectors(outer))) { outer.reverse(); upper = [...upper].reverse(); }
  holes = holes.map(ring => ShapeUtils.isClockWise(vectors(ring)) ? ring : ring.reverse());
  const positions: number[] = [];
  const geometry = new BufferGeometry();
  const vertex = (p: Derived3DPlanPoint, y: number) => positions.push(p.x, y, p.z);
  const group = (materialIndex: number, emit: () => void) => {
    const start = positions.length / 3;
    emit();
    geometry.addGroup(start, positions.length / 3 - start, materialIndex);
  };
  const cap = (ring: Derived3DPlanPoint[], y: number, up: boolean) => {
    const points = [ring, ...holes].flat();
    const faces = ShapeUtils.triangulateShape(vectors(ring), holes.map(vectors));
    if (!faces.length) throw new Error('Solid ring could not be triangulated.');
    for (const [a, b, c] of faces) {
      // CCW in X/Z points down in Three's X/Y/Z system.
      vertex(points[a], y); vertex(points[up ? c : b], y); vertex(points[up ? b : c], y);
    }
  };
  group(0, () => cap(upper, shape.top, true));
  group(1, () => {
    for (const [lower, higher] of [[outer, upper], ...holes.map(ring => [ring, ring])]) {
      for (let i = 0; i < lower.length; i++) {
        const j = (i + 1) % lower.length;
        vertex(lower[i], shape.bottom); vertex(higher[j], shape.top); vertex(lower[j], shape.bottom);
        vertex(lower[i], shape.bottom); vertex(higher[i], shape.top); vertex(higher[j], shape.top);
      }
    }
  });
  group(2, () => cap(outer, shape.bottom, false));
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
