import {redirect} from 'next/navigation';
import Link from 'next/link';
import {BriefcaseBusiness,Clock3,HardHat,Truck} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {FieldWorkspace} from '@/components/field/FieldWorkspace';
import {MetricBentoTile} from '@/components/projects/MetricBentoTile';
import {WorkspaceRecordBoard,type WorkspaceRecordRow} from '@/components/ui/WorkspaceRecordBoard';
import {createClient} from '@/lib/supabase/server';

type SearchParams={tab?:string;view?:string};
const workDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export default async function FieldPage({searchParams}:{searchParams:Promise<SearchParams>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const today=workDate();
  const [{data:pours,error:poursError},{data:logs,error:logsError},{data:crew,error:crewError},{data:shifts,error:shiftsError},{data:scheduled,error:scheduleError}]=await Promise.all([
    supabase.from('pour_plans').select('id,status').eq('company_id',profile.company_id).eq('scheduled_date',today),
    supabase.from('daily_logs').select('concrete_yards').eq('company_id',profile.company_id).eq('log_date',today),
    supabase.from('crew_members').select('id').eq('company_id',profile.company_id).eq('active',true).eq('is_owner',false),
    supabase.from('employee_shift_sessions').select('crew_member_id,status').eq('company_id',profile.company_id).eq('work_date',today),
    supabase.from('work_schedule_items').select('id,title,schedule_date,status,item_type,crew_needed,projects(job_number,name),pour_plans(name,expected_concrete_yards)').eq('company_id',profile.company_id).gte('schedule_date',today).neq('status','cancelled').order('schedule_date',{ascending:true}).limit(100),
  ]);
  const activePours=poursError?null:(pours||[]).filter(p=>['authorized','in_progress','active'].includes(p.status)).length;
  const present=shiftsError?null:new Set((shifts||[]).filter(shift=>shift.status!=='rejected').map(shift=>shift.crew_member_id)).size;
  const placed=logsError?null:(logs||[]).reduce((sum,log)=>sum+Number(log.concrete_yards||0),0);
  const records:WorkspaceRecordRow[]=(scheduled||[]).map(item=>{
    const project=Array.isArray(item.projects)?item.projects[0]:item.projects;
    const pour=Array.isArray(item.pour_plans)?item.pour_plans[0]:item.pour_plans;
    const hasPour=Boolean(pour);
    const plannedConcrete=pour?.expected_concrete_yards==null?'Not set':`${Number(pour.expected_concrete_yards).toLocaleString()} CY`;
    const crewNeeded=item.crew_needed==null?'Not set':`${Number(item.crew_needed)} people`;
    const status=String(item.status||'planned').replaceAll('_',' ');
    return {id:item.id,code:project?.job_number||`S-${item.id.slice(0,8)}`,title:item.title||pour?.name||'Scheduled operation',context:`${project?.name||'Project'} · ${String(item.item_type||'work').replaceAll('_',' ')}`,status,tone:/hold|blocked/i.test(status)?'error':/ready|complete/i.test(status)?'success':'info',date:item.schedule_date,figureLabel:hasPour?'Planned concrete':'Crew required',figure:hasPour?plannedConcrete:crewNeeded,details:[{label:'Scheduled',value:item.schedule_date||'Not set'},{label:'Crew required',value:crewNeeded},...(hasPour?[{label:'Planned concrete',value:plannedConcrete}]:[])],href:hasPour?'/field?tab=dispatch&view=dispatch':'/field?tab=schedule&view=schedule',actionLabel:hasPour?'Open dispatch':'Open schedule'};
  });
  const {tab,view}=await searchParams;

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col">
      <header className="mb-6 border-b border-[#D4DBD7] pb-4 dark:border-[#343A3F]"><nav aria-label="Breadcrumb" className="pb-1 text-xs font-medium text-[#7B8580] dark:text-[#7C8580]"><Link href="/overview">Dashboard</Link><span className="mx-1 opacity-50">/</span>Field Operations</nav><h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B19] dark:text-[#F4F6F5]">Field Operations</h1><p className="mt-1 text-sm text-[#525C57] dark:text-[#B6BEBA]">Dispatch, schedule, production, crew and equipment in one workspace.</p></header>
      <section aria-label="Field operations summary" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricBentoTile title="Active pours today" icon={<BriefcaseBusiness/>} value={activePours} description="Authorized pours scheduled today"/>
        <MetricBentoTile title="Average truck cycle time" icon={<Truck/>} value={null} suffix=" min" description="Arrival and departure times are not recorded yet"/>
        <MetricBentoTile title="Crew attendance" icon={<HardHat/>} value={present} description={crewError?'Crew roster unavailable':`${present??'—'} of ${(crew||[]).length} active crew recorded today`}/>
        <MetricBentoTile title="Cubic yards placed" icon={<Clock3/>} value={placed} suffix=" CY" precision={2} description="Concrete entered in today's daily logs"/>
      </section>
      <WorkspaceRecordBoard title="Upcoming field operations" description="Scheduled work and pours, ordered by field date." rows={records} empty={scheduleError?'The field schedule is temporarily unavailable.':'No upcoming field operations are scheduled.'}/>
      <FieldWorkspace tab={tab} view={view}/>
    </main>
  </AppShell>;
}
