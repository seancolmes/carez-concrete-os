import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { buildTakeoffMeshGeometry } from '../lib/takeoff/3d/meshGeometry.ts';
import type { Derived3DPrismShape } from '../lib/takeoff/conditions/derived3d/contracts.ts';

const outer = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }];
const slab: Derived3DPrismShape = { kind: 'prism', outer, holes: [], bottom: -1, top: 0 };

test('derived feet, negative elevation, material groups and flat outward normals are preserved', () => {
  const geometry = buildTakeoffMeshGeometry(slab);
  assert.deepEqual(geometry.boundingBox?.min.toArray(), [0, -1, 0]);
  assert.deepEqual(geometry.boundingBox?.max.toArray(), [10, 0, 8]);
  assert.deepEqual(geometry.groups.map(group => group.materialIndex), [0, 1, 2]);
  const normals = geometry.getAttribute('normal');
  const positions = geometry.getAttribute('position');
  for (const group of geometry.groups) for (let i = group.start; i < group.start + group.count; i++) {
    if (group.materialIndex === 0) assert.equal(normals.getY(i), 1);
    else if (group.materialIndex === 2) assert.equal(normals.getY(i), -1);
    else assert.ok(new Vector3(normals.getX(i), normals.getY(i), normals.getZ(i)).dot(new Vector3(positions.getX(i) - 5, 0, positions.getZ(i) - 4)) > 0);
  }
  geometry.dispose();
});

test('holes remain open with inward-facing hole walls regardless of input winding', () => {
  const hole = [{ x: 2, z: 2 }, { x: 4, z: 2 }, { x: 4, z: 4 }, { x: 2, z: 4 }];
  const geometry = buildTakeoffMeshGeometry({ ...slab, outer: [...outer].reverse(), holes: [hole] });
  const p = geometry.getAttribute('position');
  const n = geometry.getAttribute('normal');
  const top = geometry.groups[0];
  let area = 0;
  for (let i = top.start; i < top.start + top.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(p, i);
    const b = new Vector3().fromBufferAttribute(p, i + 1);
    const c = new Vector3().fromBufferAttribute(p, i + 2);
    area += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    const center = a.add(b).add(c).divideScalar(3);
    assert.ok(!(center.x > 2 && center.x < 4 && center.z > 2 && center.z < 4));
  }
  assert.equal(area, 76);
  const sides = geometry.groups[1];
  for (let i = sides.start + 24; i < sides.start + sides.count; i++) {
    assert.ok(new Vector3().fromBufferAttribute(n, i).dot(new Vector3(3 - p.getX(i), 0, 3 - p.getZ(i))) > 0);
  }
  geometry.dispose();
});

test('taper preserves corresponding rings and exact elevations without mutating inputs', () => {
  const shape = { ...slab, outer: [...outer].reverse(), topOuter: [{ x: 1, z: 1 }, { x: 9, z: 1 }, { x: 9, z: 7 }, { x: 1, z: 7 }].reverse(), bottom: 12, top: 13 };
  const before = JSON.stringify(shape);
  const geometry = buildTakeoffMeshGeometry(shape);
  assert.equal(geometry.boundingBox?.min.y, 12);
  assert.equal(geometry.boundingBox?.max.y, 13);
  const p = geometry.getAttribute('position');
  const top = geometry.groups[0];
  for (let i = top.start; i < top.count; i++) assert.ok(p.getX(i) >= 1 && p.getX(i) <= 9 && p.getZ(i) >= 1 && p.getZ(i) <= 7);
  assert.equal(JSON.stringify(shape), before);
  assert.throws(() => buildTakeoffMeshGeometry({ ...shape, holes: [outer] }), /^Error: Unsupported tapered prism with holes\.$/);
  assert.throws(() => buildTakeoffMeshGeometry({ ...shape, topOuter: shape.topOuter.slice(1) }), /vertex counts/);
  geometry.dispose();
});

test('pad dimensions, center and positive domain yaw are exact', () => {
  const shape = { kind: 'box' as const, centerX: 20, centerZ: 30, width: 8, length: 2, yawRad: 0, bottom: -3, top: -2 };
  const box = buildTakeoffMeshGeometry(shape);
  assert.deepEqual(box.boundingBox?.min.toArray(), [16, -3, 29]);
  assert.deepEqual(box.boundingBox?.max.toArray(), [24, -2, 31]);
  const rotated = buildTakeoffMeshGeometry({ ...shape, yawRad: Math.PI / 2 });
  assert.deepEqual(rotated.boundingBox?.min.toArray(), [19, -3, 26]);
  assert.deepEqual(rotated.boundingBox?.max.toArray(), [21, -2, 34]);
  // An asymmetric 45-degree corner distinguishes +yaw from -yaw.
  const angled = buildTakeoffMeshGeometry({ ...shape, yawRad: Math.PI / 4 });
  const p = angled.getAttribute('position');
  assert.ok(Array.from({ length: p.count }, (_, i) => i).some(i => Math.abs(p.getX(i) - (20 + 3 / Math.sqrt(2))) < 1e-5 && Math.abs(p.getZ(i) - (30 + 5 / Math.sqrt(2))) < 1e-5));
  for (const geometry of [box, rotated, angled]) geometry.dispose();
});

test('invalid physical geometry is rejected explicitly', () => {
  assert.throws(() => buildTakeoffMeshGeometry({ ...slab, top: NaN }), /finite/);
  assert.throws(() => buildTakeoffMeshGeometry({ ...slab, top: -2 }), /above/);
  assert.throws(() => buildTakeoffMeshGeometry({ ...slab, outer: [] }), /ring/);
});
