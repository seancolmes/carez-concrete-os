import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const projectId='12345678-1234-1234-1234-123456789abc';
const source=ts.transpileModule(readFileSync('app/projects/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function action({sourceCode=source,actionName='deleteProject',role='owner',signedIn=true,company='tenant-a',result={data:{id:projectId},error:null}}:{sourceCode?:string;actionName?:string;role?:string;signedIn?:boolean;company?:string|null;result?:{data:unknown;error:unknown}}={}){
  const filters:unknown[]=[];const paths:string[]=[];let deleted=false;
  const projectQuery={delete(){deleted=true;return this;},eq(key:string,value:string){filters.push([key,value]);return this;},select(){return this;},async maybeSingle(){return result;}};
  const profileQuery={select(){return this;},eq(){return this;},async single(){return {data:{company_id:company,role},error:null};}};
  const client={auth:{async getUser(){return {data:{user:signedIn?{id:'user-a'}:null}};}},from(table:string){return table==='profiles'?profileQuery:projectQuery;}};
  const exports:Record<string,any>={};
  vm.runInNewContext(sourceCode,{exports,require(name:string){if(name==='next/cache')return {revalidatePath:(path:string)=>paths.push(path)};if(name==='@/lib/supabase/server')return {createClient:async()=>client};if(name==='@/lib/estimating/manualEstimateCell')return {manualEstimateCellPatch:()=>{throw new Error('Cell editing is outside deletion tests.');}};if(name==='next/navigation'||name==='@/lib/takeoff/assemblyEngine.server')return {};throw new Error(name);}});
  return {run:exports[actionName] as (id:string)=>Promise<void>,filters,paths,deleted:()=>deleted};
}

test('project deletion permits owner and office and constrains the company',async()=>{
  for(const role of ['owner','office']){
    const subject=action({role});await subject.run(projectId);
    assert.deepEqual(subject.filters,[['id',projectId],['company_id','tenant-a']]);
    assert.deepEqual(subject.paths,['/projects',`/projects/${projectId}`]);
  }
});
test('project deletion rejects every other role and unauthenticated or tenantless requests',async()=>{
  for(const options of [{role:'employee'},{role:'admin'},{role:'estimator'},{role:'unknown'},{signedIn:false},{company:null}]){
    const subject=action(options);await assert.rejects(subject.run(projectId));assert.equal(subject.deleted(),false);assert.equal(subject.paths.length,0);
  }
});
test('invalid IDs, foreign projects and protected linked records fail without revalidation',async()=>{
  const invalid=action();await assert.rejects(invalid.run('not-a-uuid'));assert.equal(invalid.deleted(),false);
  for(const result of [{data:null,error:null},{data:null,error:{code:'23503'}}]){
    const subject=action({result});await assert.rejects(subject.run(projectId));assert.equal(subject.paths.length,0);
  }
});
test('wipe installation grants no application role execution and never invokes the reset',()=>{
  const sql=readFileSync('supabase/migrations/20260929030301_project_deletion_controls.sql','utf8');
  assert.match(sql,/security invoker/i);
  assert.match(sql,/revoke all .* from public, anon, authenticated, service_role/i);
  assert.match(sql,/current_user not in \('postgres', 'supabase_admin'\)/);
  assert.match(sql,/confirmation is distinct from 'WIPE ALL PROJECT DATA'/);
  assert.doesNotMatch(sql,/select\s+public\.admin_wipe_all_project_data/i);
  assert.match(sql,/as restrictive for delete to authenticated/);
});

for(const [file,actionName] of [['app/estimates/actions.ts','deleteEstimate'],['app/takeoff/actions.ts','deleteTakeoffSet']]){
  const sourceCode=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  test(`${actionName} authorizes owner, office and estimator with tenant-scoped deletion`,async()=>{
    for(const role of ['owner','office','estimator']){
      const subject=action({sourceCode,actionName,role});await subject.run(projectId);
      assert.deepEqual(subject.filters,[['id',projectId],['company_id','tenant-a']]);
      assert.ok(subject.paths.includes('/opportunities'));
      assert.ok(subject.paths.includes(actionName==='deleteEstimate'?'/estimates':'/takeoff'));
    }
  });
  test(`${actionName} denies unauthorized callers and fails closed on absent or protected records`,async()=>{
    for(const options of [{role:'employee'},{role:'admin'},{role:'unknown'},{signedIn:false},{company:null}]){
      const subject=action({...options,sourceCode,actionName});await assert.rejects(subject.run(projectId));assert.equal(subject.deleted(),false);
    }
    for(const result of [{data:null,error:null},{data:null,error:{code:'23503'}},{data:null,error:{code:'42501'}}]){
      const subject=action({sourceCode,actionName,result});await assert.rejects(subject.run(projectId));assert.equal(subject.paths.length,0);
    }
    const subject=action({sourceCode,actionName});await assert.rejects(subject.run('invalid'));assert.equal(subject.deleted(),false);
  });
}
