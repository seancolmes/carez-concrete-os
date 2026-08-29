import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {ScheduleGrid,type AssignedCrew,type ScheduleCrewMember,type ScheduleGridDay,type ScheduleGridItem} from '@/components/schedule/ScheduleGrid';
import {createClient} from '@/lib/supabase/server';
import {createScheduleItem} from './actions';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(date:string,days:number)=>{const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+days);return value.toISOString().slice(0,10);};
const formatDay=(value:string)=>new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00`));
const joined=<T,>(value:T|T[]|null|undefined):T|null=>Array.isArray(value)?value[0]||null:value||null;

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
  const todayItems=scheduleItems.filter(item=>item.scheduleDate===start);
  const weekItems=scheduleItems.filter(item=>item.scheduleDate<=weekEnd);
  const crewNeeded=weekItems.reduce((sum,item)=>sum+item.crewNeeded,0);
  const unassigned=weekItems.filter(item=>item.crewShort>0).length;
  const blockedWeek=weekItems.filter(item=>item.blocked);
  const crewMembers:ScheduleCrewMember[]=(crew||[]).map((member:any)=>({id:member.id,name:member.name,role:member.role||'Crew'}));

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page schedule-page-v4">
    <div className="command-hero"><div><div className="section-kicker">JOBS & FIELD</div><h1>Schedule</h1><p>Plan the work, see crew loading, and separate a calendar commitment from actual permission to start.</p></div><div className="command-actions"><Link className="button secondary" href="/look-ahead">21-Day Look-Ahead</Link><Link className="button secondary" href="/readiness">Work Readiness</Link><Link className="button secondary" href="/readiness/resources">Resources</Link><Link className="button secondary" href="/production/work-packages">Work Packages</Link><details className="controls-disclosure create-disclosure"><summary>Add Work</summary><div className="controls-body"><form action={createScheduleItem} className="form"><div className="grid grid2"><label className="field"><span>Job</span><select name="project_id" required defaultValue=""><option value="" disabled>Choose job</option>{(projects||[]).map((project:any)=>{const readiness:any=projectReadinessMap.get(project.id),held=Boolean(readiness?.award_setup_applies&&!readiness?.job_ready);return <option key={project.id} value={project.id} disabled={held}>{project.job_number} — {project.name}{held?` — HOLD: ${readiness.readiness_reason}`:''}</option>;})}</select></label><label className="field"><span>Date</span><input type="date" name="schedule_date" defaultValue={start} required/></label></div><div className="grid grid2"><label className="field"><span>Type of Work</span><select name="item_type" defaultValue="work"><option value="work">Crew Work</option><option value="pour">Concrete Pour</option><option value="inspection">Inspection</option><option value="delivery">Material Delivery</option><option value="equipment">Equipment</option><option value="meeting">Meeting</option><option value="other">Other</option></select></label><label className="field"><span>What Are We Doing?</span><input name="title" placeholder="Optional when a work package is selected"/></label></div><label className="field"><span>Work Package / Readiness Gate</span><select name="work_package_operation_id" defaultValue=""><option value="">No package — use unplanned work below</option>{(operations||[]).map((operation:any)=>{const readiness:any=operationReadinessMap.get(operation.operation_id);return <option key={operation.operation_id} value={operation.operation_id}>{operation.job_number} — {operation.package_name} — {operation.field_label||operation.task_name} — {Number(operation.planned_quantity).toLocaleString(undefined,{maximumFractionDigits:2})} {operation.unit}{readiness?` — ${readiness.ready_to_start_all?'READY':`HOLD: ${readiness.start_next_action}`}`:''}</option>;})}</select><small>Carez checks predecessors, inspections, materials, equipment, outside vendors, and pour controls.</small></label><div className="grid grid2"><label className="field"><span>Start</span><input type="time" name="start_time"/></label><label className="field"><span>Finish / Expected End</span><input type="time" name="end_time"/></label></div><div className="grid grid2"><label className="field"><span>Unplanned Work (fallback)</span><select name="production_task_id" defaultValue=""><option value="">None</option>{(tasks||[]).map((task:any)=><option key={task.id} value={task.id}>{task.name} ({task.production_unit})</option>)}</select></label><label className="field"><span>Pour Plan</span><select name="pour_plan_id" defaultValue=""><option value="">None</option>{(pours||[]).map((pour:any)=><option key={pour.id} value={pour.id}>{pour.name} · {pour.scheduled_date||'date not set'} · {Number(pour.expected_concrete_yards||0).toFixed(1)} CY</option>)}</select></label></div><label className="field"><span>Workers Needed</span><input type="number" name="crew_needed" min="0" step="1" defaultValue="0"/></label><div className="field"><span>Assign Crew</span><div className="schedule-crew-checks">{crewMembers.map(member=><label key={member.id}><input type="checkbox" name="crew_member_ids" value={member.id}/><span>{member.name}</span><small>{member.role}</small></label>)}</div></div><label className="field"><span>Notes</span><textarea name="notes" rows={3} placeholder="Field notes, inspector details, delivery instructions..."/></label><button className="button safety-orange">Add to Schedule</button></form></div></details></div></div>

    {setupHolds>0&&<div className="alert warning"><strong>{setupHolds} awarded job{setupHolds===1?' is':'s are'} on setup hold.</strong> Held jobs remain disabled until agreement, billing setup, and required pre-start payment are clear. <Link className="industrial-grid-link" href="/job-setup">Open Job Setup</Link></div>}
    {blockedWeek.length>0&&<div className="alert danger"><strong>{blockedWeek.length} crew-work item{blockedWeek.length===1?' is':'s are'} scheduled this week but not ready to start.</strong> Planning stays visible, but Carez blocks confirmation and employee start until the constraint clears. <Link className="industrial-grid-link" href="/readiness">Clear Work Holds</Link></div>}

    <div className="command-grid"><div className="command-card"><div className="command-label">Today</div><div className="command-value">{todayItems.length}</div><div className="command-help">Scheduled items today.</div></div><div className="command-card"><div className="command-label">This Week</div><div className="command-value">{weekItems.length}</div><div className="command-help">Work, deliveries, inspections, and pours.</div></div><div className={`command-card ${blockedWeek.length?'bad':'good'}`}><div className="command-label">Blocked</div><div className="command-value">{blockedWeek.length}</div><div className="command-help">Crew work failing an automatic gate.</div></div><div className={`command-card ${unassigned?'watch':'good'}`}><div className="command-label">Crew Demand / Short</div><div className="command-value">{crewNeeded} / {unassigned}</div><div className="command-help">Worker-days and items still short.</div></div></div>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">NEXT 14 DAYS</div><div className="section-title">Crew & Readiness Workstation</div><div className="section-heading-meta">Use Work Grid for operational detail and Crew Matrix for resource loading. Date, job, work, crew identity, and matrix names stay frozen during horizontal scroll.</div></div></div><ScheduleGrid days={dayRows} items={scheduleItems} crewMembers={crewMembers}/></section>
  </div></AppShell>;
}
