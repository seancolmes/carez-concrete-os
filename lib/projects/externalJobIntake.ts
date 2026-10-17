const fields=['job_number','name','customer_id','customer_name','contact_name','email','phone','address','city','state','agreement_reference','agreement_evidence','external_proposal_reference','provisional_change_reference','external_notes','planned_start','billing_submission_channel'] as const;
export function externalJobPayload(fd:FormData){
 const payload:Record<string,string|number|null>={};for(const key of fields)payload[key]=String(fd.get(key)||'').trim()||null;
 for(const key of ['agreement_amount','external_proposal_amount','provisional_change_amount']){
  const raw=String(fd.get(key)||'').trim();if(!raw){if(key==='agreement_amount')throw new Error('Recorded agreement amount is required.');payload[key]=null;continue;}
  const value=Number(raw);if(!/^\d+(?:\.\d{1,2})?$/.test(raw)||!Number.isFinite(value)||value<0)throw new Error('Use finite nonnegative amounts with at most two decimal places.');payload[key]=value;
 }
 if(!payload.job_number||!payload.name||!payload.agreement_reference)throw new Error('Original job number, job name and agreement reference are required.');
 for(const [key,max,integer] of [['retainage_percent',100,false],['billing_submission_day',31,true]] as const){
  const raw=String(fd.get(key)||'').trim();if(!raw){payload[key]=null;continue;}
  const amount=Number(raw);if(!/^\d+(?:\.\d{1,3})?$/.test(raw)||!Number.isFinite(amount)||amount<0||amount>max||(integer&&(!Number.isInteger(amount)||amount<1)))throw new Error(`Enter a valid ${key.replaceAll('_',' ')}.`);payload[key]=amount;
 }
 if(!['reported_signed_no_executed_copy','executed_copy_unverified'].includes(String(payload.agreement_evidence)))throw new Error('Choose the agreement evidence status.');
 if(payload.customer_id){for(const key of ['customer_name','contact_name','email','phone'])payload[key]=null;}
 else if(!payload.customer_name)throw new Error('Choose an existing customer or enter a new one.');
 return payload;
}
