export function parseManualLabor(form:FormData){
 const text=(key:string,max=1000)=>{const value=form.get(key);if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new Error(`Enter ${key.replaceAll('_',' ')}.`);return value.trim();};
 const uuid=(key:string)=>{const value=text(key,36);if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value))throw new Error('Reload this manual-time form and select recorded job and worker.');return value;};
 const date=(key:string,optional=false)=>{const raw=form.get(key);if(optional&&(raw===null||raw===''))return null;const value=text(key,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(`${value}T00:00:00Z`))||new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value)throw new Error(`Enter a valid ${key.replaceAll('_',' ')}.`);return value;};
 const amount=(key:string,max:number)=>{const raw=text(key,40);const value=Number(raw);if(!/^\d+(?:\.\d{1,2})?$/.test(raw)||!Number.isFinite(value)||value>max)throw new Error(`Enter a finite nonnegative ${key.replaceAll('_',' ')} to two decimals.`);return value;};
 const requestId=uuid('request_id'),projectId=uuid('project_id'),crewId=uuid('crew_member_id'),worker=text('worker_type',20);
 if(!['owner','employee','subcontractor'].includes(worker)||form.get('confirmed')!=='on')throw new Error('Confirm the verified financial classification and missing-time source.');
 const regular=amount('regular_hours',999999.99),overtime=amount('overtime_hours',999999.99);if(regular+overtime<=0)throw new Error('Reviewed hours must have a positive total.');
 const values={worker_type:worker,base_hourly_rate:amount('base_hourly_rate',99999999.99),work_date:date('work_date'),work_timezone:text('work_timezone',100),regular_hours:regular,overtime_hours:overtime,
 source_reference:text('source_reference',200),reason:text('reason'),task:text('task',200),confirmed:true,payroll_tax_date:date('payroll_tax_date',worker!=='employee'),risk_class_code:worker==='employee'?text('risk_class_code',30):null};
 return{requestId,projectId,crewId,values};
}
