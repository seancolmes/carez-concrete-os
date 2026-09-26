import assert from 'node:assert/strict';
import test from 'node:test';
import {assertTapPassed, assertLintPassed, databaseReferences, assertLocalUrl, classifyMissingDatabaseReferences, migrationObjectOwners, releaseBlockingDatabaseReferences} from '../scripts/release-gate-support.ts';

test('release gate rejects pgTAP failures even when psql exits successfully',()=>{
  assert.throws(()=>assertTapPassed('1..2\nok 1 - works\nnot ok 2 - tenant escape\n'),/pgTAP/);
  assert.throws(()=>assertTapPassed('1..2\nok 1 - works\n'),/incomplete/);
  assert.throws(()=>assertTapPassed(''),/plan/);
  assert.doesNotThrow(()=>assertTapPassed('BEGIN\n1..2\nok 1 - works\nok 2 - isolated\nROLLBACK'));
});

test('release gate treats SQL lint errors as failures independent of CLI exit code',()=>{
  assert.throws(()=>assertLintPassed('{"results":[{"function":"public.bad","issues":[{"level":"error","message":"missing table"}]}]}'),/public.bad/);
  assert.throws(()=>assertLintPassed('unrecognized output'),/unrecognized/);
  assert.doesNotThrow(()=>assertLintPassed('No schema errors found'));
  assert.doesNotThrow(()=>assertLintPassed('{"results":[]}'));
});

test('source dependency extraction includes table and RPC calls but excludes storage buckets',()=>{
  const refs=databaseReferences(`const a=client.from('projects'); client.rpc('award'); client.storage.from('plans'); Array.from('abc'); // client.from('fake')\n`,'example.ts');
  assert.deepEqual(refs.map(({kind,name})=>({kind,name})),[{kind:'relation',name:'projects'},{kind:'function',name:'award'}]);
});

test('release browser target must stay on loopback',()=>{
  assert.doesNotThrow(()=>assertLocalUrl('http://127.0.0.1:3000'));
  for(const url of ['https://carez.app','http://127.0.0.1.evil.test','file:///tmp/app']) assert.throws(()=>assertLocalUrl(url),/loopback/);
});

test('source dependency audit classifies deferred references without weakening active V1 failures',()=>{
  const owners=migrationObjectOwners('supabase/migrations');
  const missing=classifyMissingDatabaseReferences([
    {kind:'relation',name:'plaid_accounts',file:'example.ts',line:1},
    {kind:'relation',name:'work_packages',file:'example.ts',line:2},
  ],new Set<string>(),owners);
  assert.deepEqual(missing.map(entry=>entry.classification),['H','A']);
  assert.equal(releaseBlockingDatabaseReferences(missing).length,1);
  assert.throws(()=>classifyMissingDatabaseReferences([{kind:'relation',name:'unknown_contract',file:'example.ts',line:1}],new Set<string>(),owners),/Unclassified/);
});
