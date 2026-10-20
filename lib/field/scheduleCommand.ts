const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const value=(form:FormData,key:string)=>String(form.get(key)||'').trim();
function id(form:FormData,key:string,required=true){const text=value(form,key);if(!text&&!required)return null;if(!uuid.test(text))throw new Error(`Reload the schedule: ${key} is unavailable.`);return text;}
function date(form:FormData){const text=value(form,'schedule_date');const parsed=new Date(`${text}T12:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==text)throw new Error('Choose a valid schedule date.');return text;}
export type ScheduleFormState={status:'idle'|'saved'|'error';message:string};
export type ScheduleCommand='create'|'status'|'reschedule'|'delete';
export function scheduleCrewCommand(form:FormData){
 const requestId=id(form,'request_id')!,item=id(form,'id')!,revision=value(form,'expected_revision'),needed=value(form,'crew_needed');
 if(!/^\d+$/.test(revision)||!Number.isSafeInteger(Number(revision)))throw new Error('Reload the schedule before changing crew.');
 if(!/^\d{1,6}$/.test(needed))throw new Error('Workers needed must be a nonnegative whole number.');
 const crew=[...new Set(form.getAll('crew_member_ids').map(String))].sort();
 if(crew.some(member=>!uuid.test(member)))throw new Error('Reload the available workers.');
 return {requestId,payload:{id:item,expected_revision:Number(revision),crew_needed:Number(needed),crew_member_ids:crew}};
}
export function scheduleCommand(form:FormData,command:ScheduleCommand){
 const requestId=id(form,'request_id')!;
 if(command!=='create'){
  const item=id(form,'id')!,revision=value(form,'expected_revision');
  if(!/^\d+$/.test(revision)||!Number.isSafeInteger(Number(revision)))throw new Error('Reload the schedule before taking action.');
  const payload:Record<string,unknown>={id:item,expected_revision:Number(revision)};
  if(command==='reschedule')payload.schedule_date=date(form);
  if(command==='status'){const status=value(form,'status');if(!['planned','confirmed','in_progress','completed','cancelled'].includes(status))throw new Error('Choose a valid schedule status.');payload.status=status;}
  return{requestId,payload};
 }
 if(value(form,'status')&&value(form,'status')!=='planned')throw new Error('Create planned work before confirming readiness.');
 const type=value(form,'item_type')||'work';if(!['work','pour','inspection','delivery','equipment','meeting','other'].includes(type))throw new Error('Choose a valid work type.');
 const needed=value(form,'crew_needed');if(!/^\d{1,6}$/.test(needed))throw new Error('Workers needed must be a nonnegative whole number.');
 const time=(key:string)=>{const text=value(form,key);if(text&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(text))throw new Error('Choose a valid start and finish time.');return text||null;};
 const crew=[...new Set(form.getAll('crew_member_ids').map(String))];if(crew.some(member=>!uuid.test(member)))throw new Error('Reload the available crew.');
 const notes=[value(form,'mix_design')?`Mix design: ${value(form,'mix_design')}`:'',value(form,'notes')].filter(Boolean).join('\n')||null;
 return{requestId,payload:{project_id:id(form,'project_id'),schedule_date:date(form),item_type:type,title:value(form,'title'),production_task_id:id(form,'production_task_id',false),work_package_operation_id:id(form,'work_package_operation_id',false),pour_plan_id:id(form,'pour_plan_id',false),start_time:time('start_time'),end_time:time('end_time'),crew_needed:Number(needed),crew_member_ids:crew,notes}};
}

/** Presentation only: unknown reads never imply an authoritative clearance. */
export function scheduleReadiness({physical,linkedOperation,job,operation,jobReadFailed,operationReadFailed}:{physical:boolean;linkedOperation:boolean;job:{job_ready?:boolean;readiness_reason?:string}|null;operation:{ready_to_start_all?:boolean;start_next_action?:string}|null;jobReadFailed:boolean;operationReadFailed:boolean}){
 if(!physical)return{blocked:false,ready:null,reason:null,unavailable:false};
 const jobHold=job?.job_ready===false,operationHold=linkedOperation&&operation?.ready_to_start_all===false;
 if(jobHold||operationHold)return{blocked:true,ready:false,reason:jobHold?job?.readiness_reason||'Review Job Setup.':operation?.start_next_action||'Review Work Readiness.',unavailable:jobReadFailed||!job||linkedOperation&&(operationReadFailed||!operation)};
 if(!linkedOperation&&!jobReadFailed&&job?.job_ready===true)return{blocked:false,ready:null,reason:'No work package linked.',unavailable:false};
 const unavailable=jobReadFailed||job?.job_ready!==true||linkedOperation&&(operationReadFailed||operation?.ready_to_start_all!==true);
 return{blocked:false,ready:unavailable?null:true,reason:unavailable?'Readiness unavailable; planning remains available.':null,unavailable};
}
