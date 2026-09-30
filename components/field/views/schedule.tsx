import {Button,Input,Select,Textarea,Checkbox} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import { WarningRegular as AlertTriangle } from '@fluentui/react-icons';
import {ScheduleGrid,type AssignedCrew,type ScheduleCrewMember,type ScheduleGridDay,type ScheduleGridItem} from '@/components/schedule/ScheduleGrid';
import {ScheduleHeaderActions} from '@/components/schedule/ScheduleHeaderActions';
import {createClient} from '@/lib/supabase/server';
import {createScheduleItem} from '@/app/schedule/actions';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(date:string,days:number)=>{const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+days);return value.toISOString().slice(0,10);};
const formatDay=(value:string)=>new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00`));
const joined=<T,>(value:T|T[]|null|undefined):T|null=>Array.isArray(value)?value[0]||null:value||null;

function FormField({label,help,children}:{label:string;help?:string;children:React.ReactNode}){
  return <label className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-foreground">{label}</span>{children}{help?<span className="text-[11px] leading-4 text-muted-foreground">{help}</span>:null}</label>;
}

export default async function SchedulePage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');

  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const start=today();
  const end=addDays(start,89);
  const [{data:items,error:itemsError},{data:assignments},{data:projects},{data:crew},{data:tasks},{data:pours,error:poursError},{data:jobReadiness},{data:operations},{data:operationReadiness},{data:equipmentRequirements,error:equipmentRequirementsError}]=await Promise.all([
    supabase.from('work_schedule_items').select('*,projects(job_number,name,address,city),production_tasks(name,production_unit),work_package_operations(planned_quantity,unit,status,field_label,work_packages(name,location))').eq('company_id',profile.company_id).gte('schedule_date',start).lte('schedule_date',end).neq('status','cancelled').order('schedule_date').order('start_time'),
    supabase.from('work_schedule_assignments').select('schedule_item_id,crew_member_id,crew_members(name)').eq('company_id',profile.company_id),
    supabase.from('projects').select('id,job_number,name').eq('company_id',profile.company_id).in('status',['active','on_hold']).order('job_number'),
    supabase.from('crew_members').select('id,name,role').eq('company_id',profile.company_id).eq('active',true).order('name'),
    supabase.from('production_tasks').select('id,name,category,production_unit').eq('company_id',profile.company_id).eq('active',true).order('sort_order'),
    supabase.from('pour_plans').select('id,project_id,name,scheduled_date,expected_concrete_yards,status').eq('company_id',profile.company_id).order('scheduled_date'),
    supabase.from('project_job_readiness_summary').select('project_id,award_setup_applies,job_ready,readiness_reason').eq('company_id',profile.company_id),
    supabase.from('work_package_operation_progress').select('*').eq('company_id',profile.company_id).in('operation_status',['planned','in_progress','on_hold']).order('job_number').order('package_name').order('sequence'),
    supabase.from('work_package_start_readiness').select('operation_id,ready_to_start_all,start_readiness_status,start_next_action,all_blocking_reasons,all_warning_reasons,blocking_resource_count,resource_warning_count').eq('company_id',profile.company_id),
    supabase.from('work_package_resource_requirements').select('work_package_operation_id,label,equipment_asset_id').eq('company_id',profile.company_id).eq('resource_type','equipment').is('waived_at',null),
  ]);

  const projectReadinessMap=new Map((jobReadiness||[]).map((row:any)=>[row.project_id,row]));
  const operationReadinessMap=new Map((operationReadiness||[]).map((row:any)=>[row.operation_id,row]));
  const pourMap=new Map((pours||[]).map((row:any)=>[row.id,row]));
  const selectablePours=(pours||[]).filter((row:any)=>row.status!=='cancelled');
  const setupHolds=(projects||[]).filter((project:any)=>{const readiness:any=projectReadinessMap.get(project.id);return readiness?.award_setup_applies&&!readiness?.job_ready;}).length;

  const assignmentMap=new Map<string,AssignedCrew[]>();
  for(const assignment of assignments||[]){
    const member:any=joined(assignment.crew_members);
    if(!member?.name)continue;
    const current=assignmentMap.get(assignment.schedule_item_id)||[];
    current.push({id:assignment.crew_member_id,name:member.name});
    assignmentMap.set(assignment.schedule_item_id,current);
  }

  const pumpMap=new Map<string,{ids:string[];unidentified:number}>();
  for(const requirement of equipmentRequirements||[]){
    if(!/pump/i.test(requirement.label))continue;
    const current=pumpMap.get(requirement.work_package_operation_id)||{ids:[],unidentified:0};
    if(requirement.equipment_asset_id)current.ids.push(requirement.equipment_asset_id);
    else current.unidentified+=1;
    pumpMap.set(requirement.work_package_operation_id,current);
  }

  const dayRows:ScheduleGridDay[]=Array.from({length:90},(_,index)=>{
    const date=addDays(start,index);
    return {date,label:formatDay(date),shortLabel:formatDay(date).split(',')[0],isToday:date===start};
  });

  const scheduleItems:ScheduleGridItem[]=(items||[]).map((item:any)=>{
    const project:any=joined(item.projects)||{};
    const task:any=joined(item.production_tasks)||null;
    const pour:any=item.pour_plan_id?pourMap.get(item.pour_plan_id)||null:null;
    const operation:any=joined(item.work_package_operations)||null;
    const workPackage:any=joined(operation?.work_packages)||null;
    const readiness:any=item.work_package_operation_id?operationReadinessMap.get(item.work_package_operation_id):null;
    const assignedCrew=assignmentMap.get(item.id)||[];
    const crewNeeded=Number(item.crew_needed||0);
    const crewShort=Math.max(0,crewNeeded-assignedCrew.length);
    const blocked=item.item_type==='work'&&readiness?.ready_to_start_all===false;
    const warningReasons=Array.isArray(readiness?.all_warning_reasons)?readiness.all_warning_reasons:[];
    const openHref=item.inspection_id||blocked
      ?'/readiness'
      :item.item_type==='pour'
        ?'/pour-control'
        :['delivery','equipment'].includes(item.item_type)
          ?'/readiness/resources'
          :item.work_package_operation_id
            ?'/production/work-packages'
            :'/schedule';

    return {
      id:item.id,
      projectId:item.project_id,
      scheduleDate:item.schedule_date,
      startTime:item.start_time||null,
      endTime:item.end_time||null,
      itemType:item.item_type,
      title:item.title,
      jobNumber:project.job_number||'JOB',
      projectName:project.name||'Project',
      packageName:workPackage?.name||null,
      packageLocation:workPackage?.location||null,
      plannedQuantity:operation?Number(operation.planned_quantity||0):null,
      unit:operation?.unit||null,
      employeeTask:operation?.field_label||task?.name||null,
      pourName:pour?.name||null,
      pourPlanId:item.pour_plan_id||null,
      pourYards:pour?Number(pour.expected_concrete_yards||0):null,
      pumpAssetIds:pumpMap.get(item.work_package_operation_id||'')?.ids||[],
      unidentifiedPumps:pumpMap.get(item.work_package_operation_id||'')?.unidentified||0,
      status:item.status,
      operationStatus:operation?.status||null,
      inspectionId:item.inspection_id||null,
      blocked,
      readyToStart:readiness?Boolean(readiness.ready_to_start_all):null,
      readinessAction:readiness?.start_next_action||null,
      warningReasons,
      blockingResourceCount:Number(readiness?.blocking_resource_count||0),
      crewNeeded,
      assignedCrew,
      crewShort,
      notes:item.notes||null,
      openHref,
    };
  });

  const weekEnd=addDays(start,6);
  const weekItems=scheduleItems.filter(item=>item.scheduleDate<=weekEnd);
  const blockedWeek=weekItems.filter(item=>item.blocked);
  const crewMembers:ScheduleCrewMember[]=(crew||[]).map((member:any)=>({id:member.id,name:member.name,role:member.role||'Crew'}));

  const addWorkForm=<form action={createScheduleItem} className="grid gap-3 text-[12px]">
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Job"><Select appearance="outline" name="project_id" required defaultValue=""><option value="" disabled>Choose job</option>{(projects||[]).map((project:any)=>{const readiness:any=projectReadinessMap.get(project.id),held=Boolean(readiness?.award_setup_applies&&!readiness?.job_ready);return <option key={project.id} value={project.id} disabled={held}>{project.job_number} — {project.name}{held?` — HOLD: ${readiness.readiness_reason}`:''}</option>;})}</Select></FormField>
      <FormField label="Date"><Input appearance="underline" type="date" name="schedule_date" defaultValue={start} required className="h-8"/></FormField>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Type of work"><Select appearance="outline" name="item_type" defaultValue="work"><option value="work">Crew work</option><option value="pour">Concrete pour</option><option value="inspection">Inspection</option><option value="delivery">Material delivery</option><option value="equipment">Equipment</option><option value="meeting">Meeting</option><option value="other">Other</option></Select></FormField>
      <FormField label="Work description"><Input appearance="underline" name="title" placeholder="Optional when a work package is selected" className="h-8"/></FormField>
    </div>
    <FormField label="Work package / readiness gate" help="Carez checks predecessors, inspections, materials, equipment, outside vendors, and pour controls."><Select appearance="outline" name="work_package_operation_id" defaultValue=""><option value="">No package — use unplanned work below</option>{(operations||[]).map((operation:any)=>{const readiness:any=operationReadinessMap.get(operation.operation_id);return <option key={operation.operation_id} value={operation.operation_id}>{operation.job_number} — {operation.package_name} — {operation.field_label||operation.task_name} — {Number(operation.planned_quantity).toLocaleString(undefined,{maximumFractionDigits:2})} {operation.unit}{readiness?` — ${readiness.ready_to_start_all?'READY':`HOLD: ${readiness.start_next_action}`}`:''}</option>;})}</Select></FormField>
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Start"><Input appearance="underline" type="time" name="start_time" className="h-8"/></FormField>
      <FormField label="Expected finish"><Input appearance="underline" type="time" name="end_time" className="h-8"/></FormField>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Unplanned work"><Select appearance="outline" name="production_task_id" defaultValue=""><option value="">None</option>{(tasks||[]).map((task:any)=><option key={task.id} value={task.id}>{task.name} ({task.production_unit})</option>)}</Select></FormField>
      <FormField label="Pour plan"><Select appearance="outline" name="pour_plan_id" defaultValue=""><option value="">None</option>{selectablePours.map((pour:any)=><option key={pour.id} value={pour.id}>{pour.name} · {pour.scheduled_date||'date not set'} · {Number(pour.expected_concrete_yards||0).toFixed(1)} CY</option>)}</Select></FormField>
    </div>
    <FormField label="Mix design / specification" help="Optional reference kept with the schedule notes."><Input appearance="underline" name="mix_design" placeholder="e.g. 4000 PSI · 3/4 in aggregate" className="h-8"/></FormField>
    <FormField label="Workers needed"><Input appearance="underline" type="number" name="crew_needed" min="0" step="1" defaultValue="0" className="h-8"/></FormField>
    <fieldset className="grid gap-2"><legend className="text-xs font-medium text-foreground">Assign crew</legend><div className="grid max-h-32 gap-1 overflow-y-auto sm:grid-cols-2">{crewMembers.map(member=><label key={member.id} className="flex items-center gap-2 border border-border px-2 py-1 text-xs"><Checkbox  name="crew_member_ids" value={member.id} className="size-4 accent-primary"/><span className="min-w-0"><span className="block truncate font-medium">{member.name}</span><span className="block truncate text-[11px] text-muted-foreground">{member.role}</span></span></label>)}</div></fieldset>
    <FormField label="Notes"><Textarea appearance="outline" name="notes" rows={3} placeholder="Inspector details, delivery instructions, or field coordination notes"/></FormField>
    <div className="flex justify-end border-t border-border pt-3"><Button type="submit" appearance="primary" size="small">Add to schedule</Button></div>
  </form>;

  return <div className="flex min-w-0 flex-col gap-3">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#343A3F] pb-3">
      <div><div className="font-mono text-[10px] uppercase tracking-wide text-[#8B949E]">FIELD / SCHEDULE</div><h2 className="text-base font-semibold tracking-tight text-[#E1E7E3]">Chrono-Matrix</h2></div>
      <ScheduleHeaderActions>{addWorkForm}</ScheduleHeaderActions>
    </header>

    {setupHolds>0?<div className="flex flex-wrap items-center justify-between gap-3 border-y border-warning/35 px-3 py-2.5 text-sm"><div className="flex min-w-0 items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning"/><div><strong>{setupHolds} awarded job{setupHolds===1?' is':'s are'} on setup hold.</strong><div className="text-xs text-muted-foreground">Agreement, billing setup, and required pre-start payment must clear before scheduling.</div></div></div><Link className={secondaryLinkClass} href="/job-setup">Open job setup</Link></div>:null}
    {blockedWeek.length>0?<div className="flex flex-wrap items-center justify-between gap-3 border-y border-destructive/40 px-3 py-2.5 text-sm"><div className="flex min-w-0 items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive"/><div><strong className="font-mono text-destructive">{blockedWeek.length} scheduled work item{blockedWeek.length===1?' is':'s are'} not ready to start.</strong><div className="text-xs text-muted-foreground">The schedule stays visible, but confirmation and employee start remain blocked until the constraint clears.</div></div></div><Link className={secondaryLinkClass} href="/readiness">Clear work holds</Link></div>:null}

    {poursError?<div role="alert" className="border border-warning/50 bg-warning/10 px-3 py-2 text-[12px] text-warning">Pour plan details are unavailable. Scheduled work remains visible.</div>:null}
    {itemsError?<div role="alert" className="border border-warning/50 bg-warning/10 px-3 py-2 text-[12px] text-warning">Schedule records could not be loaded. Try again shortly.</div>:<ScheduleGrid days={dayRows} items={scheduleItems} crewMembers={crewMembers} pumpDataAvailable={!equipmentRequirementsError}/>}
  </div>;
}

const secondaryLinkClass='inline-flex min-h-7 items-center justify-center rounded-sm border border-border bg-background px-2 text-xs font-semibold hover:bg-accent';
