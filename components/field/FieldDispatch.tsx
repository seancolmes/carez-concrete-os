import Link from 'next/link';
import {WorkspaceRecordBoard,type WorkspaceRecordRow} from '@/components/workspace/WorkspaceRecordBoard';
import {getFieldContext} from '@/lib/field/workspaceContext.server';
import {timedFieldRead} from '@/lib/field/readTiming';

export async function FieldDispatch({today}:{today:string}){
 const {supabase,profile}=await getFieldContext();
  const [{data:pours,error:poursError},{data:logs,error:logsError},{data:crew,error:crewError},{data:shifts,error:shiftsError},{data:scheduled,error:scheduleError}]=await Promise.all([
    timedFieldRead('dispatch.pours',()=>supabase.from('pour_plans').select('id,name,status,scheduled_date,expected_concrete_yards,projects(job_number,name)').eq('company_id',profile.company_id).gte('scheduled_date',today).order('scheduled_date',{ascending:true}).limit(100)),
    timedFieldRead('dispatch.logs',()=>supabase.from('daily_logs').select('concrete_yards').eq('company_id',profile.company_id).eq('log_date',today)),
    timedFieldRead('dispatch.crew',()=>supabase.from('crew_members').select('id').eq('company_id',profile.company_id).eq('active',true).eq('is_owner',false)),
    timedFieldRead('dispatch.shifts',()=>supabase.from('employee_shift_sessions').select('crew_member_id,status').eq('company_id',profile.company_id).eq('work_date',today)),
    timedFieldRead('dispatch.schedule',()=>supabase.from('work_schedule_items').select('id,title,schedule_date,status,item_type,crew_needed,pour_plan_id,projects(job_number,name)').eq('company_id',profile.company_id).gte('schedule_date',today).neq('status','cancelled').order('schedule_date',{ascending:true}).limit(100)),
  ]);
  const activePours=poursError?null:(pours||[]).filter(p=>p.scheduled_date===today&&['authorized','in_progress','active'].includes(p.status)).length;
  const present=shiftsError?null:new Set((shifts||[]).filter(shift=>shift.status!=='rejected').map(shift=>shift.crew_member_id)).size;
  const placed=logsError?null:(logs||[]).reduce((sum,log)=>sum+Number(log.concrete_yards||0),0);
  const scheduledPourIds=new Set((scheduled||[]).flatMap(item=>item.pour_plan_id?[item.pour_plan_id]:[]));
  const {data:linkedPours,error:linkedPourError}=scheduledPourIds.size
    ? await timedFieldRead('dispatch.linked-pours',()=>supabase.from('pour_plans').select('id,name,expected_concrete_yards').eq('company_id',profile.company_id).in('id',[...scheduledPourIds]))
    : {data:[],error:null};
  const linkedPourMap=new Map((linkedPours||[]).map(pour=>[pour.id,pour]));
  const records:WorkspaceRecordRow[]=[...(scheduled||[]).map(item=>{
    const project=Array.isArray(item.projects)?item.projects[0]:item.projects;
    const pour=item.pour_plan_id?linkedPourMap.get(item.pour_plan_id):null;
    const hasPour=Boolean(pour);
    const plannedConcrete=pour?.expected_concrete_yards==null?'Not set':`${Number(pour.expected_concrete_yards).toLocaleString()} CY`;
    const crewNeeded=item.crew_needed==null?'Not set':`${Number(item.crew_needed)} people`;
    const status=String(item.status||'planned').replaceAll('_',' ');
    return {id:item.id,code:project?.job_number||`S-${item.id.slice(0,8)}`,title:item.title||pour?.name||'Scheduled operation',context:`${project?.name||'Project'} · ${String(item.item_type||'work').replaceAll('_',' ')}`,status,tone:/hold|blocked/i.test(status)?'error' as const:/ready|complete/i.test(status)?'success' as const:'info' as const,date:item.schedule_date,figureLabel:hasPour?'Planned concrete':'Crew required',figure:hasPour?plannedConcrete:crewNeeded,details:[{label:'Scheduled',value:item.schedule_date||'Not set'},{label:'Crew required',value:crewNeeded},...(hasPour?[{label:'Planned concrete',value:plannedConcrete}]:[])],href:hasPour?'/field?view=deliveries':'/field?view=schedule',actionLabel:hasPour?'Open pour activity':'Open schedule'};
  }),...(pours||[]).filter(pour=>!scheduledPourIds.has(pour.id)).map(pour=>{const project=Array.isArray(pour.projects)?pour.projects[0]:pour.projects;const status=String(pour.status||'planning').replaceAll('_',' ');const concrete=pour.expected_concrete_yards==null?'Not set':`${Number(pour.expected_concrete_yards).toLocaleString()} CY`;return{id:`pour:${pour.id}`,code:project?.job_number||'Pour',title:pour.name||'Planned pour',context:`${project?.name||'Project'} · pour plan`,status,tone:/hold|blocked/i.test(status)?'error' as const:/authorized|active|complete/i.test(status)?'success' as const:'info' as const,date:pour.scheduled_date,figureLabel:'Planned concrete',figure:concrete,details:[{label:'Scheduled',value:pour.scheduled_date||'Not set'},{label:'Planned concrete',value:concrete}],href:'/field?view=deliveries',actionLabel:'Open pour activity'};})].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));

 return <><section aria-label="Dispatch summary" className="ambient-glow mb-4 grid grid-cols-2 border-y border-border text-xs sm:grid-cols-4">
        <div className="flex h-14 min-w-0 flex-col justify-center border-r border-b border-border px-3 sm:border-b-0" title="Authorized pours scheduled today"><span className="truncate text-muted-foreground">Active pours today</span><strong className="font-mono text-base tabular-nums">{activePours??'—'}</strong></div>
        <div className="flex h-14 min-w-0 flex-col justify-center border-b border-border px-3 sm:border-r sm:border-b-0" title="Upcoming work on the dispatch board"><span className="truncate text-muted-foreground">Scheduled operations</span><strong className="font-mono text-base tabular-nums">{scheduleError?'—':(scheduled||[]).length}</strong></div>
        <div className="flex h-14 min-w-0 flex-col justify-center border-r border-border px-3" title={crewError?'Crew roster unavailable':`${present??'—'} of ${(crew||[]).length} active crew recorded today`}><span className="truncate text-muted-foreground">Crew attendance</span><strong className="font-mono text-base tabular-nums">{present??'—'}<span className="ml-1 text-xs font-normal text-muted-foreground">/ {(crew||[]).length}</span></strong></div>
        <div className="flex h-14 min-w-0 flex-col justify-center px-3" title="Concrete entered in today's daily logs"><span className="truncate text-muted-foreground">Cubic yards placed</span><strong className="font-mono text-base tabular-nums">{placed==null?'—':placed.toFixed(2)}<span className="ml-1 text-xs font-normal text-muted-foreground">CY</span></strong></div>
      </section>
      <WorkspaceRecordBoard phoneStackedRows title="Dispatch Board" description="Scheduled work and pour plans, ordered by field date." rows={records} empty={scheduleError||poursError||linkedPourError?'The dispatch board is temporarily unavailable.':'No upcoming field operations are scheduled.'}/></>;
}
