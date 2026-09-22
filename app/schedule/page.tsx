import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AlertTriangle,CalendarDays,Users} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {ScheduleGrid,type AssignedCrew,type ScheduleCrewMember,type ScheduleGridDay,type ScheduleGridItem} from '@/components/schedule/ScheduleGrid';
import {ScheduleHeaderActions} from '@/components/schedule/ScheduleHeaderActions';
import {buttonVariants} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {Textarea} from '@/components/ui/textarea';
import {createClient} from '@/lib/supabase/server';
import {cn} from '@/lib/utils';
import {createScheduleItem} from './actions';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(date:string,days:number)=>{const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+days);return value.toISOString().slice(0,10);};
const formatDay=(value:string)=>new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00`));
const joined=<T,>(value:T|T[]|null|undefined):T|null=>Array.isArray(value)?value[0]||null:value||null;

function ScheduleMetric({label,value,help,tone='neutral',Icon}:{label:string;value:string;help:string;tone?:'neutral'|'danger';Icon:any}){
  return <div className="grid min-w-0 grid-cols-[1fr_auto] gap-x-3 gap-y-2 px-4 py-3 first:pl-0 last:pr-0">
    <div className="min-w-0"><div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className={cn('mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums text-foreground',tone==='danger'&&'animate-pulse text-destructive motion-reduce:animate-none')}>{value}</div></div>
    <Icon className={cn('mt-0.5 size-3.5 text-muted-foreground',tone==='danger'&&'text-destructive')}/>
    <p className="col-span-2 text-[11px] leading-4 text-muted-foreground">{help}</p>
  </div>;
}

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
  const end=addDays(start,13);
  const [{data:items},{data:assignments},{data:projects},{data:crew},{data:tasks},{data:pours},{data:jobReadiness},{data:operations},{data:operationReadiness}]=await Promise.all([
    supabase.from('work_schedule_items').select('*,projects(job_number,name,address,city),production_tasks(name,production_unit),pour_plans(name,expected_concrete_yards),work_package_operations(planned_quantity,unit,status,field_label,work_packages(name,location))').eq('company_id',profile.company_id).gte('schedule_date',start).lte('schedule_date',end).neq('status','cancelled').order('schedule_date').order('start_time'),
    supabase.from('work_schedule_assignments').select('schedule_item_id,crew_member_id,crew_members(name)').eq('company_id',profile.company_id),
    supabase.from('projects').select('id,job_number,name').eq('company_id',profile.company_id).in('status',['active','on_hold']).order('job_number'),
    supabase.from('crew_members').select('id,name,role').eq('company_id',profile.company_id).eq('active',true).order('name'),
    supabase.from('production_tasks').select('id,name,category,production_unit').eq('company_id',profile.company_id).eq('active',true).order('sort_order'),
    supabase.from('pour_plans').select('id,project_id,name,scheduled_date,expected_concrete_yards,status').eq('company_id',profile.company_id).not('status','eq','cancelled').order('scheduled_date'),
    supabase.from('project_job_readiness_summary').select('project_id,award_setup_applies,job_ready,readiness_reason').eq('company_id',profile.company_id),
    supabase.from('work_package_operation_progress').select('*').eq('company_id',profile.company_id).in('operation_status',['planned','in_progress','on_hold']).order('job_number').order('package_name').order('sequence'),
    supabase.from('work_package_start_readiness').select('operation_id,ready_to_start_all,start_readiness_status,start_next_action,all_blocking_reasons,all_warning_reasons,blocking_resource_count,resource_warning_count').eq('company_id',profile.company_id),
  ]);

  const projectReadinessMap=new Map((jobReadiness||[]).map((row:any)=>[row.project_id,row]));
  const operationReadinessMap=new Map((operationReadiness||[]).map((row:any)=>[row.operation_id,row]));
  const setupHolds=(projects||[]).filter((project:any)=>{const readiness:any=projectReadinessMap.get(project.id);return readiness?.award_setup_applies&&!readiness?.job_ready;}).length;

  const assignmentMap=new Map<string,AssignedCrew[]>();
  for(const assignment of assignments||[]){
    const member:any=joined(assignment.crew_members);
    if(!member?.name)continue;
    const current=assignmentMap.get(assignment.schedule_item_id)||[];
    current.push({id:assignment.crew_member_id,name:member.name});
    assignmentMap.set(assignment.schedule_item_id,current);
  }

  const dayRows:ScheduleGridDay[]=Array.from({length:14},(_,index)=>{
    const date=addDays(start,index);
    return {date,label:formatDay(date),shortLabel:formatDay(date).split(',')[0],isToday:date===start};
  });

  const scheduleItems:ScheduleGridItem[]=(items||[]).map((item:any)=>{
    const project:any=joined(item.projects)||{};
    const task:any=joined(item.production_tasks)||null;
    const pour:any=joined(item.pour_plans)||null;
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
      pourYards:pour?Number(pour.expected_concrete_yards||0):null,
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
  const unassigned=weekItems.filter(item=>item.crewShort>0).length;
  const blockedWeek=weekItems.filter(item=>item.blocked);
  const crewMembers:ScheduleCrewMember[]=(crew||[]).map((member:any)=>({id:member.id,name:member.name,role:member.role||'Crew'}));

  const addWorkForm=<form action={createScheduleItem} className="grid gap-4">
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Job"><NativeSelect name="project_id" required defaultValue=""><NativeSelectOption value="" disabled>Choose job</NativeSelectOption>{(projects||[]).map((project:any)=>{const readiness:any=projectReadinessMap.get(project.id),held=Boolean(readiness?.award_setup_applies&&!readiness?.job_ready);return <NativeSelectOption key={project.id} value={project.id} disabled={held}>{project.job_number} — {project.name}{held?` — HOLD: ${readiness.readiness_reason}`:''}</NativeSelectOption>;})}</NativeSelect></FormField>
      <FormField label="Date"><Input type="date" name="schedule_date" defaultValue={start} required className="h-8"/></FormField>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Type of work"><NativeSelect name="item_type" defaultValue="work"><NativeSelectOption value="work">Crew work</NativeSelectOption><NativeSelectOption value="pour">Concrete pour</NativeSelectOption><NativeSelectOption value="inspection">Inspection</NativeSelectOption><NativeSelectOption value="delivery">Material delivery</NativeSelectOption><NativeSelectOption value="equipment">Equipment</NativeSelectOption><NativeSelectOption value="meeting">Meeting</NativeSelectOption><NativeSelectOption value="other">Other</NativeSelectOption></NativeSelect></FormField>
      <FormField label="Work description"><Input name="title" placeholder="Optional when a work package is selected" className="h-8"/></FormField>
    </div>
    <FormField label="Work package / readiness gate" help="Carez checks predecessors, inspections, materials, equipment, outside vendors, and pour controls."><NativeSelect name="work_package_operation_id" defaultValue=""><NativeSelectOption value="">No package — use unplanned work below</NativeSelectOption>{(operations||[]).map((operation:any)=>{const readiness:any=operationReadinessMap.get(operation.operation_id);return <NativeSelectOption key={operation.operation_id} value={operation.operation_id}>{operation.job_number} — {operation.package_name} — {operation.field_label||operation.task_name} — {Number(operation.planned_quantity).toLocaleString(undefined,{maximumFractionDigits:2})} {operation.unit}{readiness?` — ${readiness.ready_to_start_all?'READY':`HOLD: ${readiness.start_next_action}`}`:''}</NativeSelectOption>;})}</NativeSelect></FormField>
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Start"><Input type="time" name="start_time" className="h-8"/></FormField>
      <FormField label="Expected finish"><Input type="time" name="end_time" className="h-8"/></FormField>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Unplanned work"><NativeSelect name="production_task_id" defaultValue=""><NativeSelectOption value="">None</NativeSelectOption>{(tasks||[]).map((task:any)=><NativeSelectOption key={task.id} value={task.id}>{task.name} ({task.production_unit})</NativeSelectOption>)}</NativeSelect></FormField>
      <FormField label="Pour plan"><NativeSelect name="pour_plan_id" defaultValue=""><NativeSelectOption value="">None</NativeSelectOption>{(pours||[]).map((pour:any)=><NativeSelectOption key={pour.id} value={pour.id}>{pour.name} · {pour.scheduled_date||'date not set'} · {Number(pour.expected_concrete_yards||0).toFixed(1)} CY</NativeSelectOption>)}</NativeSelect></FormField>
    </div>
    <FormField label="Workers needed"><Input type="number" name="crew_needed" min="0" step="1" defaultValue="0" className="h-8"/></FormField>
    <fieldset className="grid gap-2"><legend className="text-xs font-medium text-foreground">Assign crew</legend><div className="grid gap-2 sm:grid-cols-2">{crewMembers.map(member=><label key={member.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/15 px-3 py-2 text-sm"><input type="checkbox" name="crew_member_ids" value={member.id} className="size-4 rounded border border-input accent-current"/><span className="min-w-0"><span className="block truncate text-xs font-medium">{member.name}</span><span className="block truncate text-[11px] text-muted-foreground">{member.role}</span></span></label>)}</div></fieldset>
    <FormField label="Notes"><Textarea name="notes" rows={3} placeholder="Inspector details, delivery instructions, or field coordination notes"/></FormField>
    <div className="flex justify-end border-t border-border pt-3"><button type="submit" className={buttonVariants({size:'sm'})}>Add to schedule</button></div>
  </form>;

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5">
    <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Jobs & field</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Logistics, Dispatch & Pour Control</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Sequence logistical field placement windows. Track live crew utilization metrics, schedule concrete pumping lines, and evaluate prerequisite constraint gates across all active jobsites.</p></div>
      <ScheduleHeaderActions>{addWorkForm}</ScheduleHeaderActions>
    </header>

    <div className="grid divide-y divide-border border-y border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
      <ScheduleMetric label="Scheduled Pours" value={String(scheduleItems.filter(item=>item.itemType==='pour').length)} help="Pour windows in the current schedule authority." Icon={CalendarDays}/>
      <ScheduleMetric label="Total Field Man-Hours" value="—" help="No authoritative field-time contract is available." Icon={Users}/>
      <ScheduleMetric label="Labor Deficit / Shortage" value={String(unassigned)} help="Scheduled work lines with an existing crew shortfall." tone={unassigned?'danger':'neutral'} Icon={Users}/>
      <ScheduleMetric label="Unbacked Mud & Pump Financial Holds" value="—" help="No authoritative mud or pump financial-hold contract is available." Icon={AlertTriangle}/>
    </div>
    <p className="border-b border-border pb-3 font-mono text-[11px] text-muted-foreground">Monitored pour windows, bulk mud deliveries, and engineering inspections.</p>

    {setupHolds>0?<div className="flex flex-wrap items-center justify-between gap-3 border-y border-warning/35 px-3 py-2.5 text-sm"><div className="flex min-w-0 items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning"/><div><strong>{setupHolds} awarded job{setupHolds===1?' is':'s are'} on setup hold.</strong><div className="text-xs text-muted-foreground">Agreement, billing setup, and required pre-start payment must clear before scheduling.</div></div></div><Link className={buttonVariants({variant:'outline',size:'xs'})} href="/job-setup">Open job setup</Link></div>:null}
    {blockedWeek.length>0?<div className="flex flex-wrap items-center justify-between gap-3 border-y border-destructive/40 px-3 py-2.5 text-sm"><div className="flex min-w-0 items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive"/><div><strong className="font-mono text-destructive">{blockedWeek.length} scheduled work item{blockedWeek.length===1?' is':'s are'} not ready to start.</strong><div className="text-xs text-muted-foreground">The schedule stays visible, but confirmation and employee start remain blocked until the constraint clears.</div></div></div><Link className={buttonVariants({variant:'outline',size:'xs'})} href="/readiness">Clear work holds</Link></div>:null}

    <ScheduleGrid days={dayRows} items={scheduleItems} crewMembers={crewMembers}/>
  </div></AppShell>;
}
