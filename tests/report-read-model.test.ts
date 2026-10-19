import test from 'node:test';import assert from 'node:assert/strict';
import {reportReferenceTotal,productionReportGroups} from '../lib/projects/reportReadModel.ts';
test('report references preserve zero, require every project and retain independent failures',()=>{
 const p={data:[{id:'a'},{id:'b'}],error:null},s={data:[{project_id:'a',amount:0},{project_id:'b',amount:10}],error:null};
 assert.equal(reportReferenceTotal(p,s,'amount'),10);assert.equal(reportReferenceTotal(p,{...s,data:s.data.slice(0,1)},'amount'),null);
 assert.equal(reportReferenceTotal(p,{...s,error:'failed'},'amount'),null);assert.equal(reportReferenceTotal({...p,error:'failed'},s,'amount'),null);
 assert.equal(reportReferenceTotal(p,{...s,count:3},'amount'),null);assert.equal(reportReferenceTotal({data:[],error:null},s,'amount'),0);
});
test('production rate requires full labor coverage, keeps zero and separates tasks sharing a name',()=>{
 const row={production_task_id:'a',task_name:'Same name',unit:'SF',quantity_completed:20,man_hours:2};
 const result=productionReportGroups([row,{...row,quantity_completed:0,man_hours:null},{...row,production_task_id:'b',quantity_completed:0,man_hours:1}]);
 assert.equal(result.length,2);assert.equal(result[0].quantity,20);assert.equal(result[0].hours,2);assert.equal(result[0].missingLabor,1);assert.equal(result[0].rate,null);assert.equal(result[1].rate,0);assert.equal(result[1].inverse,null);
 assert.equal(productionReportGroups([row])[0].rate,10);
});
