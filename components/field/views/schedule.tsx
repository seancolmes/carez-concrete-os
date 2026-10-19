import {Button,Input,Select,Textarea,Checkbox} from '@fluentui/react-components';
import Link from 'next/link';
import { WarningRegular as AlertTriangle } from '@fluentui/react-icons';
import {ScheduleGrid,type AssignedCrew,type ScheduleCrewMember,type ScheduleGridDay,type ScheduleGridItem} from '@/components/schedule/ScheduleGrid';
import {ScheduleHeaderActions} from '@/components/schedule/ScheduleHeaderActions';
import {randomUUID} from 'node:crypto';
import {scheduleReadiness} from '@/lib/field/scheduleCommand';
import {getFieldContext} from '@/lib/field/workspaceContext.server';
import {timedFieldRead} from '@/lib/field/readTiming';
import {loadScheduleReadSets} from '@/lib/field/scheduleReads';
import {projectGoverningHold} from '@/lib/projects/projectReadiness';

const addDays=(date:string,days:number)=>{const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);};
const formatDay=(value:string)=>new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const joined=<T,>(value:T|T[]|null|undefined):T|null=>Array.isArray(value)?value[0]||null:value||null;

function FormField({label,help,children}:{label:string;help?:string;children:React.ReactNode}){
  return <label className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-foreground">{label}</span>{children}{help?<span className="text-[11px] leading-4 text-muted-foreground">{help}</span>:null}</label>;
}

export default async function SchedulePage(){
  const {supabase,profile}=await getFieldContext();
  const [calendarRead,{data:items,error:itemsError},relatedReads]=await loadScheduleReadSets(
    ()=>timedFieldRead('schedule.calendar',()=>supabase.rpc('carez_company_calendar_date',{p_company:profile.company_id,p_at:new Date().toISOString()})),
    calendar=>{
      const from=!calendar.error&&typeof calendar.data==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(calendar.data)?calendar.data:null;
      let query=supabase.from('work_schedule_items').select('*,projects(job_number,name,address,city),production_tasks(name,production_unit),work_package_operations(planned_quantity,unit,status,field_label,work_packages(name,location))').eq('company_id',profile.company_id).neq('status','cancelled').order('schedule_date').order('start_time');
      if(from)query=query.gte('schedule_date',from).lte('schedule_date',addDays(from,89));
      return timedFieldRead('schedule.items',()=>query);
    },
    ()=>Promise.all([
    timedFieldRead('schedule.assignments',()=>supabase.from('work_schedule_assignments').select('schedule_item_id,crew_member_id,crew_members(name)').eq('company_id',profile.company_id)),
    timedFieldRead('schedule.projects',()=>supabase.from('projects').select('id,job_number,name').eq('company_id',profile.company_id).in('status',['active','on_hold']).order('job_number')),
    timedFieldRead('schedule.crew',()=>supabase.from('crew_members').select('id,name,role').eq('company_id',profile.company_id).eq('active',true).order('name')),
    timedFieldRead('schedule.tasks',()=>supabase.from('production_tasks').select('id,name,category,production_unit').eq('company_id',profile.company_id).eq('active',true).order('sort_order')),
    timedFieldRead('schedule.pours',()=>supabase.from('pour_plans').select('id,project_id,name,scheduled_date,expected_concrete_yards,status').eq('company_id',profile.company_id).order('scheduled_date')),
    timedFieldRead('schedule.job-readiness',()=>supabase.from('project_job_readiness_summary').select('project_id,award_setup_applies,job_ready,readiness_reason').eq('company_id',profile.company_id)),
    timedFieldRead('schedule.operations',()=>supabase.from('work_package_operation_progress').select('*').eq('company_id',profile.company_id).in('operation_status',['planned','in_progress','on_hold']).order('job_number').order('package_name').order('sequence')),
    timedFieldRead('schedule.operation-readiness',()=>supabase.from('work_package_start_readiness').select('operation_id,ready_to_start_all,start_readiness_status,start_next_action,all_blocking_reasons,all_warning_reasons,blocking_resource_count,resource_warning_count').eq('company_id',profile.company_id)),
    timedFieldRead('schedule.equipment',()=>supabase.from('work_package_resource_requirements').select('work_package_operation_id,label,equipment_asset_id').eq('company_id',profile.company_id).eq('resource_type','equipment').is('waived_at',null)),
    ]),
  );
  const {data:calendarDate,error:calendarError}=calendarRead;
  const start=!calendarError&&typeof calendarDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)?calendarDate:null;
  const [{data:assignments,error:assignmentsError},{data:projects,error:projectsError},{data:crew,error:crewError},{data:tasks,error:tasksError},{data:pours,error:poursError},{data:jobReadiness,error:jobReadinessError},{data:operations,error:operationsError},{data:operationReadiness,error:operationReadinessError},{data:equipmentRequirements,error:equipmentRequirementsError}]=relatedReads;

  const projectReadinessMap=new Map((jobReadiness||[]).map((row:any)=>[row.project_id,row]));
  const operationReadinessMap=new Map((operationReadiness||[]).map((row:any)=>[row.operation_id,row]));
  const pourMap=new Map((pours||[]).map((row:any)=>[row.id,row]));
  const selectablePours=(pours||[]).filter((row:any)=>row.status!=='cancelled');
  const heldProjects=(projects||[]).filter((project:any)=>projectGoverningHold(project.id,projectReadinessMap.get(project.id),null).setupHold);

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

  const windowStart=start||(items||[]).map((item:any)=>item.schedule_date).filter((date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)).sort()[0]||null;
  const dayRows:ScheduleGridDay[]=Array.from({length:windowStart?90:0},(_,index)=>{
    const date=addDays(windowStart!,index);
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
    const crewShort=assignmentsError?0:Math.max(0,crewNeeded-assignedCrew.length);
    const job:any=projectReadinessMap.get(item.project_id);
    const state=scheduleReadiness({physical:['work','pour'].includes(item.item_type),linkedOperation:Boolean(item.work_package_operation_id),job:job||null,operation:readiness||null,jobReadFailed:Boolean(jobReadinessError),operationReadFailed:Boolean(operationReadinessError)});
    const blocked=state.blocked;
    const warningReasons=Array.isArray(readiness?.all_warning_reasons)?readiness.all_warning_reasons:[];
    const openHref=job?.job_ready===false?`/job-setup/${item.project_id}`:item.inspection_id||blocked
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
      revision:Number.isSafeInteger(Number(item.command_revision))?Number(item.command_revision):null,
      readinessUnavailable:state.unavailable,
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
      readyToStart:state.ready,
      readinessAction:state.reason||readiness?.start_next_action||null,
      warningReasons,
      blockingResourceCount:Number(readiness?.blocking_resource_count||0),
      crewNeeded,
      assignedCrew,
      crewAssignmentsAvailable:!assignmentsError,
      crewShort,
      notes:item.notes||null,
      openHref,
    };
  });

  const weekEnd=windowStart?addDays(windowStart,6):null;
  const weekItems=weekEnd?scheduleItems.filter(item=>item.scheduleDate<=weekEnd):[];
  const blockedWeek=weekItems.filter(item=>item.blocked);
  const crewMembers:ScheduleCrewMember[]=(crew||[]).map((member:any)=>({id:member.id,name:member.name,role:member.role||'Crew'}));

  const addWorkForm=<>
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Job"><Select appearance="outline" name="project_id" required defaultValue=""><option value="" disabled>Choose job</option>{(projects||[]).map((project:any)=>{const readiness:any=projectReadinessMap.get(project.id),held=Boolean(readiness?.award_setup_applies&&!readiness?.job_ready);return <option key={project.id} value={project.id}>{project.job_number} — {project.name}{held?` — HOLD: ${readiness.readiness_reason}`:''}</option>;})}</Select></FormField>
      <FormField label="Date"><Input appearance="outline" type="date" name="schedule_date" defaultValue={start||undefined} required className="h-8"/></FormField>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Type of work"><Select appearance="outline" name="item_type" defaultValue="work"><option value="work">Crew work</option><option value="pour">Concrete pour</option><option value="inspection">Inspection</option><option value="delivery">Material delivery</option><option value="equipment">Equipment</option><option value="meeting">Meeting</option><option value="other">Other</option></Select></FormField>
      <FormField label="Work description"><Input appearance="outline" name="title" placeholder="Optional when a work package is selected" className="h-8"/></FormField>
    </div>
    <FormField label="Work package / readiness gate" help="PourTrace checks predecessors, inspections, materials, equipment, outside vendors, and pour controls."><Select appearance="outline" name="work_package_operation_id" defaultValue=""><option value="">No package — use unplanned work below</option>{(operations||[]).map((operation:any)=>{const readiness:any=operationReadinessMap.get(operation.operation_id);return <option key={operation.operation_id} value={operation.operation_id}>{operation.job_number} — {operation.package_name} — {operation.field_label||operation.task_name} — {Number(operation.planned_quantity).toLocaleString(undefined,{maximumFractionDigits:2})} {operation.unit}{readiness?.ready_to_start_all===true?' — READY':readiness?.ready_to_start_all===false?` — HOLD: ${readiness.start_next_action}`:' — Readiness unavailable'}</option>;})}</Select></FormField>
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Start"><Input appearance="outline" type="time" name="start_time" className="h-8"/></FormField>
      <FormField label="Expected finish"><Input appearance="outline" type="time" name="end_time" className="h-8"/></FormField>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="Unplanned work"><Select appearance="outline" name="production_task_id" defaultValue=""><option value="">None</option>{(tasks||[]).map((task:any)=><option key={task.id} value={task.id}>{task.name} ({task.production_unit})</option>)}</Select></FormField>
      <FormField label="Pour plan"><Select appearance="outline" name="pour_plan_id" defaultValue=""><option value="">None</option>{selectablePours.map((pour:any)=><option key={pour.id} value={pour.id}>{pour.name} · {pour.scheduled_date||'date not set'} · {Number(pour.expected_concrete_yards||0).toFixed(1)} CY</option>)}</Select></FormField>
    </div>
    <FormField label="Mix design / specification" help="Optional reference kept with the schedule notes."><Input appearance="outline" name="mix_design" placeholder="e.g. 4000 PSI · 3/4 in aggregate" className="h-8"/></FormField>
    <FormField label="Workers needed"><Input appearance="outline" type="number" name="crew_needed" min="0" step="1" defaultValue="0" className="h-8"/></FormField>
    <fieldset className="grid gap-2"><legend className="text-xs font-medium text-foreground">Assign crew</legend><div className="grid max-h-32 gap-1 overflow-y-auto sm:grid-cols-2">{crewMembers.map(member=><Checkbox key={member.id} input={{id:`schedule-crew-${member.id}`}} name="crew_member_ids" value={member.id} label={<span className="min-w-0"><span className="block break-words font-medium">{member.name}</span><span className="block text-[11px] text-muted-foreground">{member.role}</span></span>}/>)}</div></fieldset>
    <FormField label="Notes"><Textarea appearance="outline" name="notes" rows={3} placeholder="Inspector details, delivery instructions, or field coordination notes"/></FormField>
  </>;

  const requestId=randomUUID();
  const actions=<ScheduleHeaderActions key={requestId} requestId={requestId} disabled={Boolean(projectsError||crewError||tasksError||operationsError||poursError)}>{addWorkForm}</ScheduleHeaderActions>;
  const incomplete=[assignmentsError?'crew assignments':null,projectsError?'job choices':null,crewError?'crew choices':null,tasksError?'task choices':null,operationsError?'operation choices':null,jobReadinessError?'job readiness':null,operationReadinessError?'operation readiness':null].filter(Boolean);
  const notices=<div className="pt-schedule-notices">
    {!start?<div role="alert" className="pt-schedule-hold">Company calendar unavailable. Saved dates remain visible; this is not a current 90-day forecast. Choose an explicit date when planning. <Link href="/settings?tab=system">Operating calendar</Link></div>:null}
    {incomplete.length?<div role="alert" className="pt-schedule-hold">Unavailable: {incomplete.join(', ')}. Known records and holds remain visible. Crew and readiness coverage may be incomplete.</div>:null}
    {heldProjects.length>0?<section aria-label="Jobs on setup hold" className="pt-schedule-hold"><AlertTriangle aria-hidden="true"/><ul>{heldProjects.map((project:any)=>{const readiness:any=projectReadinessMap.get(project.id);return <li key={project.id}><strong>Setup hold · {project.job_number} — {project.name}</strong><span>{readiness?.readiness_reason||'Job setup is incomplete.'} <Link aria-label={`Open job setup for ${project.job_number}`} href={`/job-setup/${project.id}`}>Job setup</Link></span></li>;})}</ul></section>:null}
    {blockedWeek.length>0?<section className="pt-schedule-work-hold"><strong>{blockedWeek.length} scheduled work item{blockedWeek.length===1?' is':'s are'} not ready to start.</strong> <span>The schedule stays visible, but confirmation and employee start remain blocked until the constraint clears.</span> <Link href="/readiness">Clear work holds</Link></section>:null}
    {poursError?<div role="alert" className="pt-schedule-hold">Pour plan details are unavailable. Scheduled work remains visible.</div>:null}
  </div>;
  return itemsError?<div className="flex min-w-0 flex-col gap-3"><header className="pt-page-band"><h2>Schedule</h2>{actions}</header>{notices}<div role="alert" className="border border-warning/50 bg-warning/10 px-3 py-2 text-[12px] text-warning">Schedule records could not be loaded. Try again shortly.</div></div>:<ScheduleGrid days={dayRows} items={scheduleItems} crewMembers={crewMembers} pumpDataAvailable={!equipmentRequirementsError} headerActions={actions} notices={notices}/>;
}
