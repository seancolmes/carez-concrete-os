import test from 'node:test';
import assert from 'node:assert/strict';
import {isStandaloneProjectPlan} from '../lib/projects/planningEstimate.ts';
test('project planning is excluded from new-bid identity without hiding genuine linked opportunities',()=>{
 assert.equal(isStandaloneProjectPlan({project_id:'existing-job',lead_id:null}),true);
 assert.equal(isStandaloneProjectPlan({project_id:null,lead_id:null}),false);
 assert.equal(isStandaloneProjectPlan({project_id:'awarded-job',lead_id:'genuine-opportunity'}),false);
 assert.equal(isStandaloneProjectPlan(null),false);
});

import {readFileSync} from 'node:fs';
test('explicit job planning retains pricing and project return without entering bid totals or proposal navigation',()=>{
 const page=readFileSync(new URL('../app/opportunities/page.tsx',import.meta.url),'utf8');
 const worksheet=readFileSync(new URL('../components/opportunities/views/WorksheetView.tsx',import.meta.url),'utf8');
 assert.match(page,/planningContext&&!planningWorksheet/);
 assert.match(page,/selectedRow&&!planningWorksheet/);
 assert.match(page,/openRows=rows.filter\(row=>!isStandaloneProjectPlan/);
 assert.match(page,/planning=\{planningWorksheet/);
 assert.match(worksheet,/Post-award quantity and cost planning/);
 assert.match(worksheet,/!planning&&\(proposal/);
 assert.match(worksheet,/Back to project/);
});
