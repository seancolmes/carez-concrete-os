export type ShiftReviewState={status:'idle'|'saved'|'error';message:string};
export function parseHistoricalShiftBasis(form:FormData){
 const raw=(key:string)=>{const value=form.get(key);return typeof value==='string'?value.trim():'';};
 const requestId=raw('request_id'),shiftId=raw('shift_id');for(const id of [requestId,shiftId])if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))throw new Error('Reload this historical review before saving.');
 const worker=raw('worker_type'),rate=raw('base_hourly_rate'),date=raw('work_date'),zone=raw('work_timezone'),reason=raw('reason');
 if(!['owner','employee','subcontractor'].includes(worker)||!/^\d+(?:\.\d{1,2})?$/.test(rate)||!Number.isFinite(Number(rate))||Number(rate)>99999999.99)throw new Error('Record the verified classification and finite nonnegative historical rate.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date||!zone||!reason||reason.length>1000||form.get('confirmed')!=='on')throw new Error('Confirm the historical work date, IANA time zone and evidence reference.');
 return{requestId,shiftId,values:{worker_type:worker,base_hourly_rate:Number(rate),work_date:date,work_timezone:zone,risk_class_code:raw('risk_class_code')||null,reason,confirmed:true}};
}
export function parseShiftReview(form:FormData){
 const raw=(key:string)=>{const value=form.get(key);return typeof value==='string'?value.trim():'';};
 const shiftId=raw('shift_id');if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(shiftId))throw new Error('Reload the recorded shift before reviewing.');
 const hours=(key:string)=>{const input=raw(key);if(!/^\d+(?:\.\d{1,2})?$/.test(input)||!Number.isFinite(Number(input)))throw new Error('Enter finite, nonnegative reviewed hours to two decimals.');return Number(input);};
 const regularHours=hours('regular_hours'),overtimeHours=hours('overtime_hours');if(regularHours+overtimeHours<=0)throw new Error('Reviewed hours must have a positive total.');
 const date=raw('payroll_tax_date');if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date))throw new Error('Enter a valid reviewed payroll date.');
 const note=raw('owner_note');if(note.length>1000)throw new Error('Keep the review note within 1000 characters.');
 const riskCode=raw('risk_class_code');if(riskCode.length>30)throw new Error('Select a recorded work class.');
 return{shiftId,regularHours,overtimeHours,payrollTaxDate:date||null,riskCode:riskCode||null,note:note||null};
}
