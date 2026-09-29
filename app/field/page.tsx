import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {FieldWorkspace} from '@/components/field/FieldWorkspace';
import {NewPourPlanDialog} from '@/components/field/NewPourPlanDialog';
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
  const [{data:pours,error:poursError},{data:logs,error:logsError},{data:crew,error:crewError},{data:shifts,error:shiftsError},{data:scheduled,error:scheduleError},{data:projects},{data:sections},{data:budgets},{data:changeOrders}]=await Promise.all([
    supabase.from('pour_plans').select('id,name,status,scheduled_date,expected_concrete_yards,projects(job_number,name)').eq('company_id',profile.company_id).gte('scheduled_date',today).order('scheduled_date',{ascending:true}).limit(100),
    supabase.from('daily_logs').select('concrete_yards').eq('company_id',profile.company_id).eq('log_date',today),
    supabase.from('crew_members').select('id').eq('company_id',profile.company_id).eq('active',true).eq('is_owner',false),
    supabase.from('employee_shift_sessions').select('crew_member_id,status').eq('company_id',profile.company_id).eq('work_date',today),
    supabase.from('work_schedule_items').select('id,title,schedule_date,status,item_type,crew_needed,projects(job_number,name),pour_plans(id,name,expected_concrete_yards)').eq('company_id',profile.company_id).gte('schedule_date',today).neq('status','cancelled').order('schedule_date',{ascending:true}).limit(100),
    supabase.from('projects').select('id,job_number,name').eq('company_id',profile.company_id).in('status',['active','on_hold']).order('job_number'),
    supabase.from('project_budget_sections').select('id,budget_id,name').eq('company_id',profile.company_id).order('sort_order'),
    supabase.from('project_budgets').select('id,project_id').eq('company_id',profile.company_id).eq('status','active'),
    supabase.rpc('carez_list_approved_change_order_references',{p_project_id:null}),
  ]);
  const activePours=poursError?null:(pours||[]).filter(p=>p.scheduled_date===today&&['authorized','in_progress','active'].includes(p.status)).length;
  const present=shiftsError?null:new Set((shifts||[]).filter(shift=>shift.status!=='rejected').map(shift=>shift.crew_member_id)).size;
  const placed=logsError?null:(logs||[]).reduce((sum,log)=>sum+Number(log.concrete_yards||0),0);
  const projectMap=new Map((projects||[]).map(project=>[project.id,project]));
  const budgetProject=new Map((budgets||[]).map(budget=>[budget.id,budget.project_id]));
  const sectionOptions=(sections||[]).filter(section=>budgetProject.has(section.budget_id));
  const projectOptions=(projects||[]).map(project=>({id:project.id,label:`${project.job_number} — ${project.name}`}));
  const scopeLinks=sectionOptions.map(section=>({id:section.id,label:`${projectMap.get(budgetProject.get(section.budget_id)||'')?.job_number||'Job'} — ${section.name}`}));
  const orderOptions=((changeOrders||[]) as {id:string;project_id:string;co_number:string;title:string}[]).map(order=>({id:order.id,label:`${projectMap.get(order.project_id)?.job_number||'Job'} — ${order.co_number} · ${order.title}`}));
  const scheduledPourIds=new Set((scheduled||[]).flatMap(item=>{const pour=Array.isArray(item.pour_plans)?item.pour_plans[0]:item.pour_plans;return pour?.id?[pour.id]:[];}));
  const records:WorkspaceRecordRow[]=[...(scheduled||[]).map(item=>{
    const project=Array.isArray(item.projects)?item.projects[0]:item.projects;
    const pour=Array.isArray(item.pour_plans)?item.pour_plans[0]:item.pour_plans;
    const hasPour=Boolean(pour);
    const plannedConcrete=pour?.expected_concrete_yards==null?'Not set':`${Number(pour.expected_concrete_yards).toLocaleString()} CY`;
    const crewNeeded=item.crew_needed==null?'Not set':`${Number(item.crew_needed)} people`;
    const status=String(item.status||'planned').replaceAll('_',' ');
    return {id:item.id,code:project?.job_number||`S-${item.id.slice(0,8)}`,title:item.title||pour?.name||'Scheduled operation',context:`${project?.name||'Project'} · ${String(item.item_type||'work').replaceAll('_',' ')}`,status,tone:/hold|blocked/i.test(status)?'error' as const:/ready|complete/i.test(status)?'success' as const:'info' as const,date:item.schedule_date,figureLabel:hasPour?'Planned concrete':'Crew required',figure:hasPour?plannedConcrete:crewNeeded,details:[{label:'Scheduled',value:item.schedule_date||'Not set'},{label:'Crew required',value:crewNeeded},...(hasPour?[{label:'Planned concrete',value:plannedConcrete}]:[])],href:hasPour?'/field?view=deliveries':'/field?view=schedule',actionLabel:hasPour?'Open pour activity':'Open schedule'};
  }),...(pours||[]).filter(pour=>!scheduledPourIds.has(pour.id)).map(pour=>{const project=Array.isArray(pour.projects)?pour.projects[0]:pour.projects;const status=String(pour.status||'planning').replaceAll('_',' ');const concrete=pour.expected_concrete_yards==null?'Not set':`${Number(pour.expected_concrete_yards).toLocaleString()} CY`;return{id:`pour:${pour.id}`,code:project?.job_number||'Pour',title:pour.name||'Planned pour',context:`${project?.name||'Project'} · pour plan`,status,tone:/hold|blocked/i.test(status)?'error' as const:/authorized|active|complete/i.test(status)?'success' as const:'info' as const,date:pour.scheduled_date,figureLabel:'Planned concrete',figure:concrete,details:[{label:'Scheduled',value:pour.scheduled_date||'Not set'},{label:'Planned concrete',value:concrete}],href:'/field?view=deliveries',actionLabel:'Open pour activity'};})].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  const {tab,view}=await searchParams;

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col">
      <header className="industrial-header relative mb-3 px-4 py-3 pr-40"><nav aria-label="Breadcrumb" className="pb-1 text-xs font-medium text-[#7B8580] dark:text-[#7C8580]"><Link href="/overview">Dashboard</Link><span className="mx-1 opacity-50">/</span>Field</nav><h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171B19] dark:text-[#F4F6F5]">Field</h1>
        <NewPourPlanDialog today={today} projects={projectOptions} scopeLinks={scopeLinks} changeOrders={orderOptions}/>
      </header>
      <FieldWorkspace tab={tab} view={view} dispatch={<><section aria-label="Dispatch summary" className="ambient-glow mb-4 grid grid-cols-2 border-y border-border text-xs sm:grid-cols-4">
        <div className="flex h-14 min-w-0 flex-col justify-center border-r border-b border-border px-3 sm:border-b-0" title="Authorized pours scheduled today"><span className="truncate text-muted-foreground">Active pours today</span><strong className="font-mono text-base tabular-nums">{activePours??'—'}</strong></div>
        <div className="flex h-14 min-w-0 flex-col justify-center border-b border-border px-3 sm:border-r sm:border-b-0" title="Upcoming work on the dispatch board"><span className="truncate text-muted-foreground">Scheduled operations</span><strong className="font-mono text-base tabular-nums">{scheduleError?'—':(scheduled||[]).length}</strong></div>
        <div className="flex h-14 min-w-0 flex-col justify-center border-r border-border px-3" title={crewError?'Crew roster unavailable':`${present??'—'} of ${(crew||[]).length} active crew recorded today`}><span className="truncate text-muted-foreground">Crew attendance</span><strong className="font-mono text-base tabular-nums">{present??'—'}<span className="ml-1 text-xs font-normal text-muted-foreground">/ {(crew||[]).length}</span></strong></div>
        <div className="flex h-14 min-w-0 flex-col justify-center px-3" title="Concrete entered in today's daily logs"><span className="truncate text-muted-foreground">Cubic yards placed</span><strong className="font-mono text-base tabular-nums">{placed==null?'—':placed.toFixed(2)}<span className="ml-1 text-xs font-normal text-muted-foreground">CY</span></strong></div>
      </section>
      <WorkspaceRecordBoard title="Dispatch Board" description="Scheduled work and pour plans, ordered by field date." rows={records} empty={scheduleError||poursError?'The dispatch board is temporarily unavailable.':'No upcoming field operations are scheduled.'}/></>}/>
    </main>
  </AppShell>;
}
