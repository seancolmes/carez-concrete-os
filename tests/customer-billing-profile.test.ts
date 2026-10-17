import assert from 'node:assert/strict';
import test from 'node:test';
import {customerAddressKeys,customerBillingPayload} from '../app/billing/customer-contact-terms.ts';
import {customerBillToSnapshot,readInvoiceCustomer} from '../lib/billing/customerBillTo.ts';

test('legacy contact-only saves omit addresses and loaded revisions',()=>{
  const fd=new FormData();fd.set('contact_name',' Morgan ');
  const result=customerBillingPayload(fd);
  assert.equal(result.revision,null);
  assert.deepEqual(Object.keys(result.payload).sort(),['billing_terms','contact_name','email','phone']);
});
test('complete loaded address includes line 2 and keeps leading postal zero',()=>{
  const fd=new FormData();for(const key of customerAddressKeys)fd.set(key,'');
  fd.set('billing_profile_revision','4');fd.set('billing_address_line1',' 1 Fixture Way ');fd.set('billing_address_line2',' Suite 12 ');fd.set('billing_postal_code',' 01234 ');
  const result=customerBillingPayload(fd);
  assert.equal(result.revision,4);
  assert.deepEqual(result.payload,{contact_name:null,email:null,phone:null,billing_terms:null,billing_address_line1:'1 Fixture Way',billing_address_line2:'Suite 12',billing_city:null,billing_state:null,billing_postal_code:'01234'});
});
test('partial or unversioned address submissions cannot clear stored fields',()=>{
  const fd=new FormData();fd.set('billing_address_line1','');
  assert.throws(()=>customerBillingPayload(fd),/complete billing address/);
  for(const key of customerAddressKeys)fd.set(key,'');
  assert.throws(()=>customerBillingPayload(fd),/revision is missing/);
});
test('customer lookup uses company scope and fails before a snapshot on failed or missing reads',async()=>{
  for(const result of [{data:null,error:{message:'read failed'}},{data:null,error:null}]){
    const filters:any[]=[];const query:any={select(){return query;},eq(k:string,v:string){filters.push([k,v]);return query;},maybeSingle:async()=>result};
    await assert.rejects(readInvoiceCustomer({from:()=>query},'tenant','customer'),/unavailable/);
    assert.deepEqual(filters,[['id','customer'],['company_id','tenant']]);
  }
});
test('bill-to snapshots have their own values and do not track later customer edits',()=>{
  const customer={name:'Fixture customer',billing_address_line1:'1 Customer Street',billing_address_line2:'Unit 2',billing_postal_code:'01234'};
  const snapshot=customerBillToSnapshot(customer);customer.billing_address_line2='Unit 3';
  assert.equal(snapshot.bill_to_address_line2,'Unit 2');
  assert.equal(snapshot.bill_to_postal_code,'01234');assert.equal(snapshot.bill_to_state,null);
  assert.ok(Object.keys(snapshot).every(key=>key.startsWith('bill_to_')));
});
