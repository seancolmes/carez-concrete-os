import assert from 'node:assert/strict';
import test from 'node:test';
import {overheadReadModel,measureText,type OverheadItem} from '../app/overhead/read-model.ts';

const company={target_margin_percent:0,planned_productive_hours_annual:2160,owner_compensation_target_annual:0,owner_planned_field_hours_annual:0,owner_field_rate:0};
const item:OverheadItem={id:'item-1',category:'Business',name:'Insurance',active:true,amount:100,frequency:'monthly',business_use_percent:50};
const ready=()=>({company:{data:company,error:null},items:{data:[item],error:null},actual:{data:{current_month_business_expense:0},error:null}});

test('recorded zeros remain zeros and the existing annualization is retained',()=>{
  const model=overheadReadModel(ready());
  assert.deepEqual(model.businessAnnual,{value:600,state:'recorded'});
  assert.deepEqual(model.ownerFieldValue,{value:0,state:'recorded'});
  assert.deepEqual(model.annual,{value:600,state:'recorded'});
  assert.deepEqual(model.perHour,{value:600/2160,state:'recorded'});
  assert.deepEqual(model.targetMargin,{value:0,state:'recorded'});
  assert.deepEqual(model.actualThisMonth,{value:0,state:'recorded'});
});

test('each failed read affects only dependent figures',()=>{
  const companyFailed=overheadReadModel({...ready(),company:{data:null,error:new Error('failed')}});
  assert.equal(companyFailed.businessAnnual.value,600);
  assert.equal(companyFailed.annual.state,'unavailable');
  assert.equal(companyFailed.actualThisMonth.value,0);
  const itemsFailed=overheadReadModel({...ready(),items:{data:null,error:new Error('failed')}});
  assert.equal(itemsFailed.ownerFieldValue.value,0);
  assert.equal(itemsFailed.annual.state,'unavailable');
  const actualFailed=overheadReadModel({...ready(),actual:{data:null,error:new Error('failed')}});
  assert.equal(actualFailed.annual.value,600);
  assert.equal(actualFailed.actualThisMonth.state,'unavailable');
});

test('missing records and missing fields never masquerade as zero',()=>{
  const missingCompany=overheadReadModel({...ready(),company:{data:null,error:null}});
  assert.equal(missingCompany.ownerOffice.state,'missing');
  const missingActual=overheadReadModel({...ready(),actual:{data:null,error:null}});
  assert.equal(measureText(missingActual.actualThisMonth,String,'No summary record'),'No summary record');
  const missingAmount=overheadReadModel({...ready(),actual:{data:{current_month_business_expense:null},error:null}});
  assert.equal(missingAmount.actualThisMonth.state,'missing');
  const missingItem=overheadReadModel({...ready(),items:{data:[{...item,amount:null}],error:null}});
  assert.equal(missingItem.businessAnnual.state,'missing');
  assert.equal(missingItem.annual.state,'missing');
  const emptyItems=overheadReadModel({...ready(),items:{data:[],error:null}});
  assert.deepEqual(emptyItems.businessAnnual,{value:0,state:'recorded'});
});
