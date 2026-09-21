import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveConditionPresentationState,
  resolveTakeoffViewMode,
  resolveTakeoffWorksheetView,
} from '../lib/takeoff/specialistWorkstation.ts';

test('specialist views expose only the approved modes',()=>{
  assert.equal(resolveTakeoffViewMode('2d'),'2d');
  assert.equal(resolveTakeoffViewMode('3d'),'3d');
  assert.equal(resolveTakeoffViewMode('split'),'split');
  assert.equal(resolveTakeoffViewMode(null),null);

  assert.equal(resolveTakeoffWorksheetView('quantities'),'quantities');
  assert.equal(resolveTakeoffWorksheetView('resources'),'resources');
  assert.equal(resolveTakeoffWorksheetView('labor'),'labor');
  assert.equal(resolveTakeoffWorksheetView('pricing'),'pricing');
  assert.equal(resolveTakeoffWorksheetView('holds'),'holds');
  assert.equal(resolveTakeoffWorksheetView('recap'),'recap');
  assert.equal(resolveTakeoffWorksheetView('unknown'),null);
});

test('Condition presentation state follows the approved priority',()=>{
  const ready={
    locked:false,
    dirty:false,
    pending:false,
    calculated:true,
    openHolds:0,
    pricingMissing:0,
  };

  assert.equal(
    resolveConditionPresentationState({
      ...ready,
      locked:true,
      dirty:true,
      pending:true,
      calculated:false,
    }).label,
    'Locked',
  );

  assert.equal(
    resolveConditionPresentationState({
      ...ready,
      dirty:true,
      pending:true,
      calculated:false,
    }).label,
    'Unsaved changes',
  );

  assert.equal(
    resolveConditionPresentationState({
      ...ready,
      pending:true,
      calculated:false,
    }).label,
    'Pending recalculation',
  );

  assert.equal(
    resolveConditionPresentationState({
      ...ready,
      calculated:false,
    }).label,
    'Not calculated',
  );

  assert.equal(
    resolveConditionPresentationState({
      ...ready,
      openHolds:2,
      pricingMissing:2,
    }).label,
    'Calculation hold',
  );

  assert.equal(
    resolveConditionPresentationState({
      ...ready,
      pricingMissing:2,
    }).label,
    'Qty ready · Price missing',
  );

  assert.equal(
    resolveConditionPresentationState(ready).label,
    'Ready',
  );
});