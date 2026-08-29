import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AlertTriangle,ArrowRight,BriefcaseBusiness,CalendarDays,CheckCircle2,ClipboardCheck,HardHat,ListChecks,Plus,Wallet} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {createProject} from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const pct=(n:any)=>`${num(n).toFixed(0)}%`;
const date=(v:any)=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';

export default async function ProjectsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).maybeSingle();if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id,today=new Date().toISOString().slice(0,10);
  const [{data:projects},{data:budgets},{data:billing},{data:forecast},{data:shifts},{data:workReady},{data:jobSetup},{data:schedule}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status,address,city,state,next_action,contract_value,created_at,customers(name)').eq('company_id',companyId).order('created_at',{ascending:false}),
    supabase.from('project_budget_actual_summary').select('*').eq('company_id',companyId),
    supabase.from('project_billing_summary').select('*'),
    supabase.from('project_cost_to_complete_summary').select('*'),
    supabase.from('employee_shift_sessions').select('project_id,status,clock_in_inside_geofence,clock_out_inside_geofence').eq('company_id',companyId).in('status',['active','open','submitted']),
    supabase.from('project_work_readiness_summary').select('*').eq('company_id',companyId),
    supabase.from('project_job_readiness_summary').select('*').eq('company_id',companyId),
    supabase.from('work_schedule_items').select('id,project_id,title,schedule_date,status,item_type,work_package_operation_id').eq('company_id',companyId).gte('schedule_date',today).neq('status','cancelled').order('schedule_date',{ascending:true}).limit(250),
  ]);
  const bMap=new Map((budgets||[]).map((x:any)=>[x.project_id,x])),billMap=new Map((billing||[]).map((x:any)=>[x.project_id,x])),fMap=new Map((forecast||[]).map((x:any)=>[x.project_id,x]));
  const readyMap=new Map((workReady||[]).map((x:any)=>[x.project_id,x])),setupMap=new Map((jobSetup||[]).map((x:any)=>[x.project_id,x]));
  const fieldMap=new Map<string,{clocked:number;waiting:number;gps:number}>();
  for(const s of shifts||[]){const x=fieldMap.get(s.project_id)||{clocked:0,waiting:0,gps:0};if(['active','open'].includes(s.status))x.clocked++;if(s.status==='submitted')x.waiting++;if(s.clock_in_inside_geofence===false||s.clock_out_inside_geofence===false)x.gps++;fieldMap.set(s.project_id,x);}
  const scheduleMap=new Map<string,any>();for(const item of schedule||[])if(item.project_id&&!scheduleMap.has(item.project_id)&&item.item_type==='work')scheduleMap.set(item.project_id,item);

  const rows=(projects||[]).map((j:any)=>{
    const b:any=bMap.get(j.id)||{},bill:any=billMap.get(j.id)||{},fc:any=fMap.get(j.id)||{},field=fieldMap.get(j.id)||{clocked:0,waiting:0,gps:0},wr:any=readyMap.get(j.id)||{},setup:any=setupMap.get(j.id),next=scheduleMap.get(j.id);
    const budgetUsed=num(b.budget_cost_used_percent),laborRemaining=num(b.labor_hours_remaining),overdue=num(bill.overdue_ar),blocked=num(wr.blocked_operations),ready=num(wr.ready_operations),failed=num(wr.failed_inspection_operations),openOps=num(wr.open_operations);
    const setupHold=setup&&setup.award_setup_applies&&!setup.job_ready;
    const reasons:string[]=[];
    if(setupHold)reasons.push(setup.readiness_reason||'Job setup is not cleared');
    if(failed)reasons.push(`${failed} operation${failed===1?' has':'s have'} a failed inspection`);
    if(blocked&&ready===0)reasons.push(`${blocked} open operation${blocked===1?' is':'s are'} on hold`);
    if(overdue>0)reasons.push(`${money(overdue)} customer balance is past due`);
    if(laborRemaining<0)reasons.push(`Labor is ${Math.abs(laborRemaining).toFixed(1)} MH over budget`);
    if(budgetUsed>=100)reasons.push('Job cost has reached or exceeded budget');
    if(field.gps)reasons.push(`${field.gps} GPS exception${field.gps===1?'':'s'} need review`);
    if(field.waiting)reasons.push(`${field.waiting} timecard${field.waiting===1?'':'s'} waiting approval`);
    const hardHold=Boolean(setupHold||failed||(blocked&&ready===0));
    const attention=hardHold||overdue>0||laborRemaining<0||budgetUsed>=100||field.gps>0||field.waiting>0;
    const state=j.status==='completed'?'completed':hardHold?'hold':ready>0?'ready':openOps>0?'planning':j.status==='on_hold'?'hold':'setup';
    const nextText=hardHold?(reasons[0]||'Clear hold before work starts'):next?.title||j.next_action||(ready>0?'Choose and schedule the next ready work package':'Build the next Work Package / schedule');
    return{j,b,bill,fc,field,wr,setup,next,budgetUsed,laborRemaining,reasons,attention,state,nextText};
  });
  const urgent=rows.filter((r:any)=>r.j.status!=='completed'&&r.attention),moving=rows.filter((r:any)=>r.j.status!=='completed'&&!r.attention),completed=rows.filter((r:any)=>r.j.status==='completed');
  const readyJobs=rows.filter((r:any)=>r.state==='ready').length,blockedJobs=rows.filter((r:any)=>r.state==='hold'&&r.j.status!=='completed').length,totalOwed=(billing||[]).reduce((s:number,x:any)=>s+Math.max(0,num(x.outstanding_ar)),0),overdue=(billing||[]).reduce((s:number,x:any)=>s+Math.max(0,num(x.overdue_ar)),0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page jobs-board-v3">
    <div className="command-hero"><div><div className="section-kicker">JOBS · OPERATIONS</div><h1>Jobs</h1><p>See which jobs can move, what starts next, and what is holding the field before labor or cash gets burned.</p></div><div className="command-actions"><Link className="button" href="/schedule"><CalendarDays size={15}/> Schedule</Link><details className="controls-disclosure create-disclosure"><summary><Plus size={14}/> Direct Job</summary><div className="controls-body"><form action={createProject} className="form"><div className="alert info"><strong>Exception workflow.</strong> Normal jobs are created automatically from accepted proposals. Use this for emergency/direct work.</div><label className="field"><span>Customer / job</span><input name="name" required placeholder="Smith Residence · emergency slab repair"/></label><label className="field"><span>Address</span><input name="address"/></label><div className="grid grid3"><label className="field"><span>City</span><input name="city"/></label><label className="field"><span>State</span><input name="state" defaultValue="WA"/></label><label className="field"><span>Contract amount</span><input name="contract_value" inputMode="decimal"/></label></div><label className="field"><span>Next physical action</span><input name="next_action" placeholder="Layout and form driveway"/></label><button className="button">Create Direct Job</button></form></div></details></div></div>

    <div className="command-grid"><div className={`command-card ${readyJobs?'good':''}`}><div className="command-label">Ready to Move</div><div className="command-value">{readyJobs}</div><div className="command-help">At least one physical operation is startable.</div></div><div className={`command-card ${blockedJobs?'bad':''}`}><div className="command-label">Hard Holds</div><div className="command-value">{blockedJobs}</div><div className="command-help">Setup, inspection or physical prerequisites block the next work.</div></div><div className={`command-card ${urgent.length?'watch':''}`}><div className="command-label">Needs Attention</div><div className="command-value">{urgent.length}</div><div className="command-help">Field, labor, billing or budget exceptions.</div></div><div className={`command-card ${overdue?'bad':totalOwed?'watch':''}`}><div className="command-label">Customers Owe</div><div className="command-value">{money(totalOwed)}</div><div className="command-help">{overdue?`${money(overdue)} past due.`:'No overdue customer balance.'}</div></div></div>

    {urgent.length>0&&<section className="section"><div className="section-heading"><div><div className="section-kicker">HANDLE FIRST</div><div className="section-title">Jobs that need a decision</div><div className="section-heading-meta">Hard readiness holds appear before financial and field exceptions.</div></div></div><div className="jobs-v3-list">{urgent.map((row:any)=><JobCard key={row.j.id} row={row}/>)}</div></section>}

    <section className="section"><div className="section-heading"><div><div className="section-kicker">RUNNING WORK</div><div className="section-title">Jobs moving normally</div><div className="section-heading-meta">The primary question is what can happen next—not which internal Carez module owns the data.</div></div></div>{moving.length===0?<div className="empty-state"><div><div className="title">No other active jobs</div><div className="meta">New accepted proposals will appear here automatically.</div></div></div>:<div className="jobs-v3-list">{moving.map((row:any)=><JobCard key={row.j.id} row={row}/>)}</div>}</section>

    {completed.length>0&&<section className="section"><details className="history-disclosure"><summary>Completed Jobs <span>{completed.length}</span></summary><div className="jobs-v3-list section">{completed.map((row:any)=><JobCard key={row.j.id} row={row}/>)}</div></details></section>}
  </div></AppShell>;
}

function JobCard({row:r}:{row:any}){
  const {j,b,bill,field,wr,next,budgetUsed,laborRemaining,reasons,state,nextText}=r;
  const stateMeta:any={ready:{label:'READY',tone:'ready'},hold:{label:'HOLD',tone:'hold'},planning:{label:'PLAN NEXT',tone:'planning'},setup:{label:'SETUP',tone:'planning'},completed:{label:'COMPLETE',tone:'complete'}};
  const sm=stateMeta[state]||stateMeta.planning,blocked=num(wr.blocked_operations),ready=num(wr.ready_operations),open=num(wr.open_operations),pastDue=num(bill.overdue_ar),owed=num(bill.outstanding_ar);
  return <article className={`job-v3-card ${sm.tone}`}><header><div className="job-v3-number">{j.job_number}</div><div className="job-v3-title"><strong>{j.name}</strong><span>{j.customers?.name||'Customer not linked'} · {[j.address,j.city,j.state].filter(Boolean).join(', ')||'Address not entered'}</span></div><b>{sm.label}</b></header>
    <div className="job-v3-next"><div className="job-v3-next-icon">{state==='hold'?<AlertTriangle/>:state==='ready'?<CheckCircle2/>:<ArrowRight/>}</div><div><span>{state==='hold'?'WHY IT CANNOT START':'NEXT PHYSICAL ACTION'}</span><strong>{nextText}</strong>{next?.schedule_date&&<small>Planned {date(next.schedule_date)}</small>}</div></div>
    <div className="job-v3-metrics"><div className={blocked?'hold':ready?'good':''}><span>Work Readiness</span><strong>{open?`${ready} ready · ${blocked} hold`:'No open packages'}</strong></div><div className={field.waiting||field.gps?'hold':''}><span>Crew</span><strong>{field.clocked} working · {field.waiting} review</strong></div><div className={laborRemaining<0?'hold':budgetUsed>=85?'watch':''}><span>Labor / Budget</span><strong>{b.project_id?`${pct(budgetUsed)} cost · ${laborRemaining.toFixed(1)} MH left`:'No frozen budget'}</strong></div><div className={pastDue?'hold':owed?'watch':''}><span>Customer Balance</span><strong>{money(owed)}{pastDue?` · ${money(pastDue)} late`:''}</strong></div></div>
    {reasons.length>0&&<details className="job-v3-exceptions"><summary>{reasons.length} exception{reasons.length===1?'':'s'} behind this status</summary><div>{reasons.map((reason:string,index:number)=><p key={index}>{reason}</p>)}</div></details>}
    <footer><Link className="button" href={`/projects/${j.id}`}><BriefcaseBusiness size={14}/> Open Job</Link>{state==='hold'&&<Link className="button secondary" href="/readiness"><ListChecks size={14}/> Clear Hold</Link>}{state==='ready'&&!next&&<Link className="button secondary" href="/schedule"><CalendarDays size={14}/> Schedule Ready Work</Link>}{r.setup&&r.setup.award_setup_applies&&!r.setup.job_ready&&<Link className="button secondary" href={`/job-setup/${j.id}`}><ClipboardCheck size={14}/> Job Setup</Link>}{field.waiting>0&&<Link className="button secondary" href="/field/review"><HardHat size={14}/> Review Time</Link>}{pastDue>0&&<Link className="button secondary" href="/billing"><Wallet size={14}/> Billing</Link>}</footer>
  </article>;
}
