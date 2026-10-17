import assert from 'node:assert/strict';
import test from 'node:test';
import {customerContactTermsPayload} from '../app/billing/customer-contact-terms.ts';

test('customer contact save excludes address keys even when submitted',()=>{
  const fd=new FormData();
  fd.set('contact_name','  Morgan  ');
  fd.set('email',' morgan@example.com ');
  fd.set('phone',' 555-0101 ');
  fd.set('billing_terms',' Net 30 ');
  for(const key of ['billing_address_line1','billing_address_line2','billing_city','billing_state','billing_postal_code']){
    fd.set(key,'value that must not be saved');
  }
  assert.deepEqual(customerContactTermsPayload(fd),{
    contact_name:'Morgan',email:'morgan@example.com',phone:'555-0101',billing_terms:'Net 30',
  });
});

test('empty contact values remain nullable without adding address fields',()=>{
  assert.deepEqual(customerContactTermsPayload(new FormData()),{
    contact_name:null,email:null,phone:null,billing_terms:null,
  });
});
