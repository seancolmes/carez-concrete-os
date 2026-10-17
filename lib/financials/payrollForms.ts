export type PayrollPreview={timecard_ids:string[];fingerprint:string;timecard_count:number;worker_count:number;gross_wages:number;funding_requirement:number;sick_reserve:number;pay_date:string;other_pay_dates:{pay_date:string;timecard_count:number}[]};
export type PayrollFormState={status:'idle'|'preview'|'saved'|'error';message:string;preview?:PayrollPreview};
export function payrollRunId(form:FormData){const id=form.get('payroll_run_id');if(typeof id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))throw new Error('Reload the recorded pay period before taking action.');return id;}
export function payrollPeriod(form:FormData){
 const date=(key:string)=>{const value=form.get(key);if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(`${value}T00:00:00Z`))||new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value)throw new Error('Enter valid period dates and a reviewed pay date.');return value;};
 const start=date('period_start'),end=date('period_end'),payDate=date('pay_date');if(end<start)throw new Error('Period end must follow its start.');return{start,end,payDate};
}
export function payrollCohort(form:FormData){
 let ids:unknown;try{ids=JSON.parse(String(form.get('timecard_ids')||''));}catch{throw new Error('Review the complete payroll period before creating it.');}
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))||new Set(ids).size!==ids.length)throw new Error('Payroll timecard selection is missing or invalid.');
 const fingerprint=form.get('fingerprint');if(typeof fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(fingerprint))throw new Error('The reviewed payroll snapshot is missing.');return{ids:ids as string[],fingerprint};
}
