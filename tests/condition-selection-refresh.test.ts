import test from 'node:test';import assert from 'node:assert/strict';
import {conditionSelectionAfterRefresh} from '../lib/takeoff/conditions/selection.ts';
test('confirmed creation survives stale roster and settles only after its server row arrives',()=>{
  assert.deepEqual(conditionSelectionAfterRefresh('new','new',['old']),{selected:'new',pendingCreated:'new'});
  assert.deepEqual(conditionSelectionAfterRefresh('new','new',[]),{selected:'new',pendingCreated:'new'});
  assert.deepEqual(conditionSelectionAfterRefresh('new','new',['old','new']),{selected:'new',pendingCreated:null});
});
test('ordinary selection and deletion preserve the existing roster fallback',()=>{
  assert.equal(conditionSelectionAfterRefresh('selected',null,['first','selected']).selected,'selected');
  assert.equal(conditionSelectionAfterRefresh('removed',null,['first']).selected,'first');
  assert.equal(conditionSelectionAfterRefresh(null,null,['first']).selected,'first');
});
