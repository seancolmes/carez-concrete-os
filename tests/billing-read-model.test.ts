import assert from 'node:assert/strict';
import test from 'node:test';
import {billingRowState,buildBillingReadModel} from '../components/financials/views/billing-read-model.ts';

const project={
  project_id:'job-1',job_number:'QA-JOB-001',name:'Example active job',
  original_contract_value:'450000',unbilled_contract:'375000',
  billed_amount:'75000',outstanding_ar:'75000',collected_amount:'0',
};
const empty={data:[],error:null};
test('posted-cash unknown state is unavailable; deployed partially overdue balances remain overdue',()=>{
 const model=buildBillingReadModel({billing:{data:[project],error:null},invoices:{data:[{project_id:'job-1',status:'sent',collection_status:'overdue_partial',balance_due:40}],error:null},retainage:empty});
 assert.equal(model.summary.late,40);assert.equal(model.rows[0].overdue_ar,40);
 const unknown=buildBillingReadModel({billing:{data:[project],error:null},invoices:{data:[{project_id:'job-1',status:'sent',collection_status:'unavailable',balance_due:null}],error:null},retainage:empty});
 assert.equal(unknown.summary.late,null);assert.equal(unknown.rows[0].overdue_ar,null);
});

test('billing uses the recorded contract, billed, and collected fields from the billing view',()=>{
  const model=buildBillingReadModel({billing:{data:[project],error:null},invoices:{data:[{
    project_id:'job-1',status:'sent',collection_status:'open',balance_due:'75000',
  }],error:null},retainage:empty});
  assert.deepEqual(model.rows[0],{
    project_id:'job-1',job_number:'QA-JOB-001',name:'Example active job',
    recorded_contract:450000,unbilled_contract:375000,billed_amount:75000,
    outstanding_ar:75000,overdue_ar:0,collected_amount:0,
  });
  assert.equal(model.summary.collected,0);
  assert.equal(model.summary.unbilled,375000);
  assert.equal(billingRowState(model.rows[0]),'owed');
});

test('genuine zero records stay zero and can be current',()=>{
  const model=buildBillingReadModel({billing:{data:[{...project,original_contract_value:0,unbilled_contract:0,billed_amount:0,outstanding_ar:0,collected_amount:0}],error:null},invoices:empty,retainage:empty});
  assert.equal(model.rows[0].recorded_contract,0);
  assert.equal(model.rows[0].billed_amount,0);
  assert.equal(model.summary.unbilled,0);
  assert.equal(model.summary.owed,0);
  assert.equal(model.summary.late,0);
  assert.equal(model.summary.retainage,0);
  assert.equal(model.summary.drafts,0);
  assert.equal(billingRowState(model.rows[0]),'current');
});

test('missing contract is distinct from zero and makes the unbilled total incomplete',()=>{
  const model=buildBillingReadModel({billing:{data:[{...project,original_contract_value:null,unbilled_contract:0,outstanding_ar:0}],error:null},invoices:empty,retainage:empty});
  assert.equal(model.rows[0].recorded_contract,null);
  assert.equal(model.rows[0].unbilled_contract,null);
  assert.equal(model.summary.unbilled,null);
  assert.equal(model.summary.unbilledMissingContract,true);
  assert.equal(billingRowState(model.rows[0]),'missing-contract');
});

test('past due sums authoritative overdue invoice balances by project',()=>{
  const invoices={data:[
    {project_id:'job-1',status:'sent',collection_status:'overdue',balance_due:'12000'},
    {project_id:'job-1',status:'sent',collection_status:'overdue',balance_due:'3000'},
    {project_id:'job-1',status:'sent',collection_status:'open',balance_due:'75000'},
    {project_id:'job-1',status:'draft',collection_status:'draft',balance_due:'9000'},
  ],error:null};
  const model=buildBillingReadModel({billing:{data:[project],error:null},invoices,retainage:empty});
  assert.equal(model.rows[0].overdue_ar,15000);
  assert.equal(model.summary.late,15000);
  assert.equal(model.summary.drafts,1);
  assert.equal(billingRowState(model.rows[0]),'late');
});

test('billing, invoice, and retainage read failures stay independent',()=>{
  const failed={data:null,error:new Error('read failed')};
  const billingFailed=buildBillingReadModel({billing:failed,invoices:empty,retainage:empty});
  assert.equal(billingFailed.billingUnavailable,true);
  assert.deepEqual(billingFailed.rows,[]);
  assert.equal(billingFailed.summary.owed,null);
  assert.equal(billingFailed.summary.late,0);
  assert.equal(billingFailed.summary.retainage,0);

  const invoicesFailed=buildBillingReadModel({billing:{data:[{...project,outstanding_ar:0}],error:null},invoices:failed,retainage:empty});
  assert.equal(invoicesFailed.invoicesUnavailable,true);
  assert.equal(invoicesFailed.summary.late,null);
  assert.equal(invoicesFailed.summary.drafts,null);
  assert.equal(invoicesFailed.rows[0].overdue_ar,null);
  assert.equal(billingRowState(invoicesFailed.rows[0]),'unavailable');
  assert.equal(invoicesFailed.summary.owed,0);

  const retainageFailed=buildBillingReadModel({billing:{data:[project],error:null},invoices:empty,retainage:failed});
  assert.equal(retainageFailed.retainageUnavailable,true);
  assert.equal(retainageFailed.summary.retainage,null);
  assert.equal(retainageFailed.summary.unbilled,375000);
});
