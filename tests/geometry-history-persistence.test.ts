import test from 'node:test';
import assert from 'node:assert/strict';
import { GeometryCommandHistory, canonicalGeometry, geometryHistoryKey } from '../lib/takeoff/commandHistory.ts';
const scope = { companyId: 'tenant', userId: 'operator', takeoffSetId: 'plans' };
const a = { type: 'polyline' as const, points: [{x:.1,y:.1},{x:.8,y:.1}] };
const b = { ...a, points: [{x:.1,y:.1},{x:.8,y:.2}] };
const command = { id:'one',kind:'MoveVertexCommand' as const,measurementId:'m',before:a,after:b,committedAt:'2026-10-15T12:00:00Z' };
test('confirmed history survives reload, undo and redo without advancing before commit', () => {
 const first=new GeometryCommandHistory();first.record(command,'r1');
 const next=new GeometryCommandHistory();next.restore(first.serialize(scope),scope,[{id:'m',geometry:b,updated_at:'r1'}]);
 assert.equal(next.undoCandidate()?.id,'one');assert.equal(next.snapshot().canUndo,true);
 // Failed server request does not call confirmation.
 assert.equal(next.undoCandidate()?.id,'one');
 next.confirmUndo('one');next.setRevision('m','r2');
 const reopened=new GeometryCommandHistory();reopened.restore(next.serialize(scope),scope,[{id:'m',geometry:a,updated_at:'r2'}]);
 assert.equal(reopened.snapshot().canRedo,true);reopened.confirmRedo('one');
});
test('history rejects another user/set, concurrent edits, deleted measurements and corrupt data', () => {
 const h=new GeometryCommandHistory();h.record(command,'r1');const saved=h.serialize(scope);
 for(const rows of [[],[{id:'m',geometry:a,updated_at:'r1'}],[{id:'m',geometry:b,updated_at:'other'}]]) assert.throws(()=>new GeometryCommandHistory().restore(saved,scope,rows));
 assert.throws(()=>new GeometryCommandHistory().restore(saved,{...scope,userId:'other'},[]));
 assert.throws(()=>new GeometryCommandHistory().restore('{}',scope,[]));
 assert.notEqual(geometryHistoryKey(scope),geometryHistoryKey({...scope,companyId:'other'}));
});
test('canonical precision ignores derived metadata and new edits remove redo branch',()=>{
 assert.equal(canonicalGeometry({...a,points:[{x:.123456789,y:.1}]}).points[0].x,.1234568);
 const h=new GeometryCommandHistory();h.record(command,'r1');h.confirmUndo('one');h.record({...command,id:'two'},'r3');assert.equal(h.snapshot().canRedo,false);assert.equal(h.snapshot().size,1);
});
