import test from 'node:test';
import assert from 'node:assert/strict';
import { formatArchitecturalLength } from '../lib/takeoff/lengthFormat.ts';
import {
  boundsFromPoints,
  detectScaleCandidates,
  findScaleRegionForPoint,
  geometryFitsScaleBounds,
  parseScaleNotation,
  type TakeoffScaleRegion,
} from '../lib/takeoff/scaleRegions.ts';

test('architectural LF display rounds to the nearest eighth inch', () => {
  assert.equal(formatArchitecturalLength(5.6874), `5'-8 1/4\"`);
  assert.equal(formatArchitecturalLength(7.599), `7'-7 1/4\"`);
  assert.equal(formatArchitecturalLength(10), `10'-0\"`);
});

test('architectural and engineering scale labels become PDF point factors', () => {
  const quarter = parseScaleNotation(`SCALE: 1/4\" = 1'-0\"`);
  assert.ok(quarter?.usable);
  assert.equal(quarter?.label, `1/4\" = 1'-0\"`);
  assert.ok(Math.abs(Number(quarter?.feetPerPdfUnit) - 1 / 18) < 1e-10);

  const engineering = parseScaleNotation(`1\" = 20'`);
  assert.ok(engineering?.usable);
  assert.ok(Math.abs(Number(engineering?.feetPerPdfUnit) - 20 / 72) < 1e-10);

  const metric = parseScaleNotation('SCALE 1:100');
  assert.ok(metric?.usable);
  assert.ok(Math.abs(Number(metric?.feetPerPdfUnit) - 100 / 864) < 1e-10);
});

test('split PDF text items are clustered into one scale candidate', () => {
  const items = [
    { str: 'SCALE:', transform: [1, 0, 0, 10, 100, 100], width: 42, height: 10 },
    { str: '1/4\"', transform: [1, 0, 0, 10, 146, 100], width: 28, height: 10 },
    { str: '=', transform: [1, 0, 0, 10, 178, 100], width: 8, height: 10 },
    { str: `1'-0\"`, transform: [1, 0, 0, 10, 190, 100], width: 34, height: 10 },
  ];
  const candidates = detectScaleCandidates(items, 2592, 1728, 4);
  assert.equal(candidates[0]?.label, `1/4\" = 1'-0\"`);
  assert.ok(Math.abs(Number(candidates[0]?.feetPerPdfUnit) - 1 / 18) < 1e-10);
});

test('smallest accepted scale region wins over the default sheet scale', () => {
  const regions: TakeoffScaleRegion[] = [
    {
      id: 'default', sheet_id: 'sheet', name: 'Sheet', region_bounds: null, scale_label: `1/8\" = 1'-0\"`, scale_kind: 'architectural', source_type: 'pdf_text', confidence: 0.99, calibration: { ft_per_pdf_unit: 1 / 9, method: 'pdf_text', scale_label: `1/8\" = 1'-0\"` }, is_default: true,
    },
    {
      id: 'detail', sheet_id: 'sheet', name: 'Detail', region_bounds: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, scale_label: `1/2\" = 1'-0\"`, scale_kind: 'architectural', source_type: 'pdf_text', confidence: 0.99, calibration: { ft_per_pdf_unit: 1 / 36, method: 'pdf_text', scale_label: `1/2\" = 1'-0\"` }, is_default: false,
    },
  ];
  assert.equal(findScaleRegionForPoint(regions, { x: 0.2, y: 0.2 })?.id, 'detail');
  assert.equal(findScaleRegionForPoint(regions, { x: 0.8, y: 0.8 })?.id, 'default');
});

test('scale-region bounds validate geometry and normalize two corners', () => {
  const bounds = boundsFromPoints([{ x: 0.4, y: 0.5 }, { x: 0.1, y: 0.2 }]);
  assert.deepEqual(bounds, { x: 0.1, y: 0.2, width: 0.30000000000000004, height: 0.3 });
  assert.equal(geometryFitsScaleBounds({ type: 'polyline', points: [{ x: 0.2, y: 0.3 }, { x: 0.3, y: 0.4 }] }, bounds), true);
  assert.equal(geometryFitsScaleBounds({ type: 'polyline', points: [{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.8 }] }, bounds), false);
});
