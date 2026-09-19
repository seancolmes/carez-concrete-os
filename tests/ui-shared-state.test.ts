import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import test from 'node:test';

const root=new URL('../',import.meta.url);
const stateUrl=new URL('lib/ui/state.ts',root);

test('shared Carez UI state module exists before behavior is exercised',()=>{
  assert.equal(existsSync(stateUrl),true,'lib/ui/state.ts must define the shared presentation-state contract');
});

test('status, save, authority, feedback, and numeric kinds resolve deterministically',async()=>{
  assert.equal(existsSync(stateUrl),true,'shared state module is required');
  const stateModulePath=stateUrl.href;
  const state=await import(stateModulePath);

  const statusCases=[
    ['neutral','Neutral','neutral'],
    ['info','Information','info'],
    ['success','Success','success'],
    ['warning','Warning','warning'],
    ['error','Error','error'],
    ['blocked','Blocked','error'],
  ] as const;
  for(const [kind,label,tone] of statusCases){
    assert.deepEqual(state.resolveStatusTone(kind),{kind,label,tone});
  }
  assert.equal(state.resolveStatusTone('mystery'),null);

  const saveCases=[
    ['saved','Saved','success',true],
    ['saving','Saving…','info',false],
    ['unsaved','Unsaved changes','warning',false],
    ['validation-required','Validation required','warning',false],
    ['save-failed','Save failed','error',false],
    ['device-only','Saved on device','info',false],
    ['queued','Waiting to sync','info',false],
  ] as const;
  for(const [kind,label,tone,serverPersisted] of saveCases){
    const resolved=state.resolveSaveState(kind);
    assert.equal(resolved?.label,label);
    assert.equal(resolved?.tone,tone);
    assert.equal(resolved?.serverPersisted,serverPersisted);
  }
  assert.equal(state.resolveSaveState('mystery'),null);

  const authorityCases=[
    ['user-confirmed','User confirmed'],
    ['system-calculated','System calculated'],
    ['imported','Imported'],
    ['ai-suggested','AI suggested'],
    ['versioned','Versioned'],
    ['issued','Issued'],
    ['frozen','Frozen'],
  ] as const;
  for(const [kind,label] of authorityCases){
    const resolved=state.resolveAuthorityState(kind);
    assert.equal(resolved?.label,label);
    assert.equal(resolved?.kind,kind);
  }
  assert.equal(state.resolveAuthorityState('mystery'),null);

  assert.deepEqual(state.resolveFeedbackScope('inline'),{kind:'inline',role:'status'});
  assert.deepEqual(state.resolveFeedbackScope('workspace'),{kind:'workspace',role:'status'});
  assert.equal(state.resolveFeedbackScope('mystery'),null);

  const numericKinds=['quantity','count','length','area','volume','currency','unit-cost','production-rate','percentage','duration'] as const;
  for(const kind of numericKinds){
    const resolved=state.resolveNumericKind(kind);
    assert.equal(resolved?.kind,kind);
    assert.equal(typeof resolved?.inputMode,'string');
    assert.equal('convert' in (resolved||{}),false,'numeric metadata must not perform conversion');
    assert.equal('round' in (resolved||{}),false,'numeric metadata must not own stored-value rounding');
  }
  assert.equal(state.resolveNumericKind('mystery'),null);
});

test('error semantics never resolve as successful persistence or authority',async()=>{
  assert.equal(existsSync(stateUrl),true,'shared state module is required');
  const stateModulePath=stateUrl.href;
  const state=await import(stateModulePath);

  assert.equal(state.resolveStatusTone('error')?.tone,'error');
  assert.equal(state.resolveStatusTone('blocked')?.tone,'error');
  assert.equal(state.resolveSaveState('save-failed')?.tone,'error');
  assert.equal(state.resolveSaveState('save-failed')?.serverPersisted,false);
  assert.equal(state.resolveSaveState('saving')?.serverPersisted,false);
  assert.equal(state.resolveSaveState('queued')?.serverPersisted,false);
  assert.equal(state.resolveSaveState('device-only')?.serverPersisted,false);
});
