export const TAX_RATE_FIELDS=[['social_security_rate','Employer Social Security'],['medicare_rate','Employer Medicare'],['futa_rate','Employer FUTA'],['wa_sui_rate','Employer WA SUI / EAF']] as const;
export const TAX_BASE_FIELDS=[['social_security_wage_base','Social Security wage base'],['futa_wage_base','FUTA wage base'],['wa_sui_wage_base','WA SUI wage base']] as const;
function text(form:FormData,key:string,max=1000){const value=form.get(key);if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new Error(`Enter ${key.replaceAll('_',' ')}.`);return value.trim();}
function amount(form:FormData,key:string,max:number,scale:number){const value=text(form,key,40);if(!(scale===0?/^\d+$/:new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`)).test(value))throw new Error(`Enter a finite nonnegative ${key.replaceAll('_',' ')}.`);const number=Number(value);if(!Number.isFinite(number)||number>max)throw new Error(`${key.replaceAll('_',' ')} is outside the allowed range.`);return number;}
export function parseLaborConfiguration(form:FormData):{requestId:string;year:number;kind:'tax'|'risk'|'opening';memberId:string|null;values:Record<string,unknown>}{
 const requestId=text(form,'request_id',36);if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId))throw new Error('Reload this setup form before saving.');
 const year=amount(form,'tax_year',2100,0);if(year<2000)throw new Error('Select a supported tax year.');
 const kind=text(form,'kind',10);
 if(kind==='tax'){
  const values:Record<string,unknown>={reason:text(form,'reason')};
  for(const [key] of TAX_RATE_FIELDS)values[key]=Number((amount(form,key,100,4)/100).toFixed(6));
  for(const [key] of TAX_BASE_FIELDS)values[key]=amount(form,key,9999999999.99,2);
  values.sick_leave_accrual_rate=amount(form,'sick_leave_accrual_rate',1,6);
  return{requestId,year,kind,values,memberId:null};
 }
 if(kind==='risk')return{requestId,year,kind,memberId:null,values:{code:text(form,'code',30),name:text(form,'name',200),reason:text(form,'reason'),active:form.get('active')==='on',composite_rate_per_hour:amount(form,'composite_rate_per_hour',99999.99999,5),employee_deduction_per_hour:amount(form,'employee_deduction_per_hour',99999.99999,5),employer_rate_per_hour:amount(form,'employer_rate_per_hour',99999.99999,5)}};
 if(kind==='opening'){
  const memberId=text(form,'crew_member_id',36);if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(memberId))throw new Error('Select a worker.');
  const date=text(form,'opening_as_of',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw new Error('Enter the last payroll date included in this opening.');
  return{requestId,year,kind,memberId,values:{opening_as_of:date,verification_reference:text(form,'verification_reference'),social_security_wages:amount(form,'social_security_wages',999999999999.99,2),futa_wages:amount(form,'futa_wages',999999999999.99,2),wa_sui_wages:amount(form,'wa_sui_wages',999999999999.99,2)}};
 }
 throw new Error('Unsupported labor setup form.');
}
