import test from 'node:test';
import assert from 'node:assert/strict';
import {geometryMutationConflict} from '../lib/takeoff/geometryMutation.ts';
import {GeometryCommandHistory} from '../lib/takeoff/commandHistory.ts';

test('expected SQL concurrency rejection is serializable without exposing database details',()=>{
 const result=geometryMutationConflict({code:'40001',message:'private database diagnostic'});
 assert.equal(result?.ok,false);assert.equal(result?.conflict,true);
 assert.match(result!.message,/saved work is unchanged/);
 assert.equal(JSON.stringify(result).includes('private'),false);
 for(const other of [null,new Error('network'),{code:'42501'}])assert.equal(geometryMutationConflict(other),null);
});
test('retiring conflicted history disables both directions without a confirmed replay',()=>{
 const history=new GeometryCommandHistory();
 const before={type:'polyline' as const,points:[{x:.1,y:.2},{x:.2,y:.2}]};
 const after={...before,points:[{x:.1,y:.2},{x:.3,y:.2}]};
 history.record({id:'edit',kind:'MoveVertexCommand',measurementId:'m',before,after,committedAt:'2026-10-15T12:00:00Z'},'r1');
 history.confirmUndo('edit');
 if(geometryMutationConflict({code:'40001'}))history.clear();
 assert.equal(history.snapshot().canUndo,false);assert.equal(history.snapshot().canRedo,false);
});
