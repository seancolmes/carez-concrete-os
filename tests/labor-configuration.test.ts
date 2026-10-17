import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLaborConfiguration,TAX_BASE_FIELDS,TAX_RATE_FIELDS} from '../lib/field/laborConfiguration.ts';

function form(kind='tax'){
 const value=new FormData();
 for(const [key,input] of Object.entries({request_id:'f1000000-0000-4000-8000-000000000001',kind,tax_year:'2027',reason:'Reviewed synthetic payroll record'}))value.set(key,input);
 return value;
}
test('explicit recorded zero tax values survive and percentages use decimal storage',()=>{
 const value=form();for(const [key] of TAX_RATE_FIELDS)value.set(key,'0');for(const [key] of TAX_BASE_FIELDS)value.set(key,'0');value.set('sick_leave_accrual_rate','0');value.set('social_security_rate','6.2');
 const parsed=parseLaborConfiguration(value);
 assert.equal(parsed.year,2027);assert.equal(parsed.values.social_security_rate,.062);assert.equal(parsed.values.futa_rate,0);assert.equal(parsed.values.futa_wage_base,0);assert.equal(parsed.values.sick_leave_accrual_rate,0);
});
test('missing, malformed, nonfinite, negative and overprecision configuration is rejected',()=>{
 for(const input of ['', 'NaN','Infinity','-1','1e2','6.12345','101']){
  const value=form();for(const [key] of TAX_RATE_FIELDS)value.set(key,'0');for(const [key] of TAX_BASE_FIELDS)value.set(key,'0');value.set('sick_leave_accrual_rate','0');value.set('social_security_rate',input);
  assert.throws(()=>parseLaborConfiguration(value),input);
 }
 assert.throws(()=>parseLaborConfiguration(form()));
});
test('opening wages require an explicit date, wages and verification reference',()=>{
 const value=form('opening');for(const [key,input] of Object.entries({crew_member_id:'f1000000-0000-4000-8000-000000000002',opening_as_of:'2026-12-31',verification_reference:'Verified empty payroll start',social_security_wages:'0',futa_wages:'0',wa_sui_wages:'0'}))value.set(key,input);
 assert.equal(parseLaborConfiguration(value).values.social_security_wages,0);
 value.set('opening_as_of','2027-02-30');assert.throws(()=>parseLaborConfiguration(value));value.set('opening_as_of','2027-01-01');value.delete('futa_wages');assert.throws(()=>parseLaborConfiguration(value));
});
test('risk class fields are whitelisted and explicit zero is not a missing rate',()=>{
 const value=form('risk');for(const [key,input] of Object.entries({code:'SYN',name:'Synthetic test class',composite_rate_per_hour:'0',employee_deduction_per_hour:'0',employer_rate_per_hour:'0',active:'on',company_id:'foreign',id:'do not trust'}))value.set(key,input);
 const parsed=parseLaborConfiguration(value);assert.equal(parsed.values.employer_rate_per_hour,0);assert.equal(parsed.values.active,true);assert.equal('company_id' in parsed.values,false);assert.equal('id' in parsed.values,false);
});
