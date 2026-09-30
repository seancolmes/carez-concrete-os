import test from 'node:test';
import assert from 'node:assert/strict';
import {manualEstimateCellPatch} from '../lib/estimating/manualEstimateCell.ts';

test('manual estimate quantity and cost edits recalculate the direct extension',()=>{
  const line={item_type:'material',quantity:3,unit_cost:12.345};
  assert.deepEqual(manualEstimateCellPatch(line,'quantity','4'),{quantity:4,direct_cost:49.38});
  assert.deepEqual(manualEstimateCellPatch(line,'unit_cost','10.25'),{unit_cost:10.25,direct_cost:30.75});
});

test('takeoff and labor lines cannot bypass their authoritative editors',()=>{
  assert.throws(()=>manualEstimateCellPatch({source_takeoff_output_id:'output-1'},'quantity','99'),/Takeoff/);
  assert.throws(()=>manualEstimateCellPatch({item_type:'labor',quantity:8,unit_cost:25},'unit_cost','1'),/labor review/);
});

test('manual cells reject invalid quantities, units, and descriptions',()=>{
  const line={item_type:'material',quantity:1,unit_cost:10};
  assert.throws(()=>manualEstimateCellPatch(line,'quantity','-2'),/nonnegative/);
  assert.throws(()=>manualEstimateCellPatch(line,'unit_cost',''),/valid unit cost/);
  assert.throws(()=>manualEstimateCellPatch(line,'unit','bogus'),/valid estimate unit/);
  assert.throws(()=>manualEstimateCellPatch(line,'description',' '),/description/);
});
