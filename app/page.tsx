import {redirect} from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,ArrowRight,BriefcaseBusiness,CalendarDays,CheckCircle2,Clock3,
  FileText,PhoneCall,Ruler,Wallet
} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(date:string,n:number)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const fmtDate=(v:string)=>new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(`${v}T12:00:00`));
const fmtShortDate=(v?:string|null)=>v?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`)):'—';
const fmtTime=(v?:string|null)=>{if(!v)return '';const [h,m]=String(v).split(':').map(Number);const d=new Date();d.setHours(h,m||0,0,0);return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(d);};
const joinedProject=(item:any)=>Array.isArray(item?.projects)?item.projects[0]:item?.projects;
const joinedCustomer=(project:any)=>Array.isArray(project?.customers)?project.customers[0]:project?.customers;
const titleCase=(v?:string|null)=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());

type AttentionTone='danger'|'warning'|'info';
type Attention={
  priority:number;
  tone:AttentionTone;
  subject:string;
  issue:string;
  when:string;
  href:string;
  action:string;
};

export default async function HomePage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');

  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const companyId=profile.company_id,start=today(),weekEnd=addDays(start,6);
  const [
    {data:projects},{data:workReady},{data:budgets},{data:billing},{data:shifts},
    {data:schedule},{data:operationReady},{data:proposals},{data:leads},{data:cash}
  ]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status,next_action,address,city,state,customers(name)').eq('company_id',companyId).in('status',['active','on_hold','planning']).order('created_at',{ascending:false}),
    supabase.from('project_work_readiness_summary').select('*').eq('company_id',companyId),
    supabase.from('project_budget_actual_summary').select('*').eq('company_id',companyId),
    supabase.from('project_billing_summary').select('*'),
    supabase.from('employee_shift_sessions').select('id,project_id,status').eq('company_id',companyId).in('status',['active','open','submitted']),
    supabase.from('work_schedule_items').select('id,project_id,title,schedule_date,start_time,status,item_type,work_package_operation_id,projects(id,job_number,name)').eq('company_id',companyId).gte('schedule_date',start).lte('schedule_date',weekEnd).neq('status','cancelled').order('schedule_date').order('start_time'),
    supabase.from('work_package_start_readiness').select('operation_id,ready_to_start_all,start_next_action').eq('company_id',companyId),
    supabase.from('proposal_conversion_queue').select('estimate_id,presentation_id,proposal_number,customer_name,project_name,conversion_stage,next_action,follow_up_due,follow_up_due_now,base_sell_price').eq('company_id',companyId),
    supabase.from('leads').select('id,opportunity_number,customer_name,project_name,status,follow_up').eq('company_id',companyId).not('status','in','("won","lost","closed")'),
    supabase.from('cashflow_calendar').select('id,event_date,event_type,description,cash_in,cash_out,status,urgency').eq('company_id',companyId).gte('event_date',start).lte('event_date',weekEnd).order('event_date'),
  ]);

  const readyMap=new Map((workReady||[]).map((row:any)=>[row.project_id,row]));
  const budgetMap=new Map((budgets||[]).map((row:any)=>[row.project_id,row]));
  const billMap=new Map((billing||[]).map((row:any)=>[row.project_id,row]));
  const opReady=new Map((operationReady||[]).map((row:any)=>[row.operation_id,row]));
  const fieldMap=new Map<string,{working:number;review:number}>();
  for(const shift of shifts||[]){
    if(!shift.project_id)continue;
    const x=fieldMap.get(shift.project_id)||{working:0,review:0};
    if(['active','open'].includes(shift.status))x.working++;
    if(shift.status==='submitted')x.review++;
    fieldMap.set(shift.project_id,x);
  }

  const activeProjects=(projects||[]).map((project:any)=>{
    const r:any=readyMap.get(project.id)||{};
    const budget:any=budgetMap.get(project.id)||{};
    const bill:any=billMap.get(project.id)||{};
    const field=fieldMap.get(project.id)||{working:0,review:0};
    const ready=num(r.ready_operations),blocked=num(r.blocked_operations),failed=num(r.failed_inspection_operations);
    const hardHold=failed>0||(blocked>0&&ready===0)||project.status==='on_hold';
    const state=hardHold?'hold':ready>0?'ready':'planning';
    const next=(schedule||[]).find((item:any)=>item.project_id===project.id&&item.item_type==='work');
    const customer=joinedCustomer(project);
    return {
      project,r,budget,bill,field,state,next,customer,
      budgetUsed:num(budget.budget_cost_used_percent),
      laborRemaining:num(budget.labor_hours_remaining),
    };
  });

  const stateRank=(state:string)=>state==='hold'?0:state==='ready'?1:2;
  const dashboardJobs=[...activeProjects].sort((a:any,b:any)=>stateRank(a.state)-stateRank(b.state)||(a.next?.schedule_date||'9999').localeCompare(b.next?.schedule_date||'9999'));
  const jobsHeld=activeProjects.filter((row:any)=>row.state==='hold').length;
  const jobsReady=activeProjects.filter((row:any)=>row.state==='ready').length;
  const crewWorking=(shifts||[]).filter((row:any)=>['active','open'].includes(row.status)).length;
  const activeFieldJobs=new Set((shifts||[]).filter((row:any)=>['active','open'].includes(row.status)&&row.project_id).map((row:any)=>row.project_id)).size;
  const timeReview=(shifts||[]).filter((row:any)=>row.status==='submitted').length;
  const ar=(billing||[]).reduce((sum:number,row:any)=>sum+Math.max(0,num(row.outstanding_ar)),0);
  const overdue=(billing||[]).reduce((sum:number,row:any)=>sum+Math.max(0,num(row.overdue_ar)),0);
  const openCash=(cash||[]).filter((row:any)=>row.status!=='paid'&&row.status!=='cleared');
  const cashOut=openCash.reduce((sum:number,row:any)=>sum+num(row.cash_out),0);
  const cashIn=openCash.reduce((sum:number,row:any)=>sum+num(row.cash_in),0);
  const cashNet=cashIn-cashOut;
  const todaySchedule=(schedule||[]).filter((item:any)=>item.schedule_date===start);
  const todayFieldWork=todaySchedule.filter((item:any)=>item.item_type==='work');

  const attention:Attention[]=[];
  for(const itemRaw of todayFieldWork){
    const item:any=itemRaw;
    if(!item.work_package_operation_id)continue;
    const r:any=opReady.get(item.work_package_operation_id);
    const job:any=joinedProject(item);
    if(r?.ready_to_start_all===false){
      attention.push({
        priority:1,
        tone:'danger',
        subject:`${job?.job_number||'Job'} · ${job?.name||item.title}`,
        issue:r.start_next_action||`${item.title} is not ready to start`,
        when:item.start_time?`Today · ${fmtTime(item.start_time)}`:'Today',
        href:'/readiness',
        action:'Clear Hold',
      });
    }
  }

  for(const row of activeProjects){
    if(row.state!=='hold'||todayFieldWork.some((item:any)=>item.project_id===row.project.id))continue;
    const failed=num(row.r.failed_inspection_operations),blocked=num(row.r.blocked_operations);
    attention.push({
      priority:2,
      tone:'danger',
      subject:`${row.project.job_number} · ${row.project.name}`,
      issue:failed>0?'Failed inspection is blocking the next operation':blocked>0?'Open physical work is blocked':row.project.next_action||'Project is on hold',
      when:row.next?.schedule_date?`Next field date · ${fmtShortDate(row.next.schedule_date)}`:'Before next operation',
      href:'/readiness',
      action:'Readiness',
    });
  }

  if(timeReview)attention.push({
    priority:3,tone:'warning',subject:'Field time review',
    issue:`${timeReview} submitted timecard${timeReview===1?' needs':'s need'} approval or correction.`,
    when:'Before payroll / job cost',href:'/field/review',action:'Review Time',
  });

  if(overdue>0)attention.push({
    priority:4,tone:'warning',subject:'Accounts receivable',
    issue:`${money(overdue)} customer balance is past due.`,
    when:`${money(ar)} total outstanding`,href:'/billing',action:'Billing',
  });

  for(const proposal of proposals||[]){
    if(proposal.conversion_stage==='needs_reply')attention.push({
      priority:5,tone:'warning',subject:`${proposal.proposal_number} · ${proposal.customer_name||'Customer'}`,
      issue:proposal.next_action||`${proposal.project_name||'Proposal'} needs a response.`,
      when:proposal.follow_up_due?`Follow-up · ${fmtShortDate(proposal.follow_up_due)}`:'Customer response waiting',
      href:`/proposals/${proposal.estimate_id}`,action:'Proposal',
    });
    else if(proposal.follow_up_due_now)attention.push({
      priority:6,tone:'info',subject:`Follow up · ${proposal.proposal_number}`,
      issue:`${proposal.customer_name||'Customer'} · ${proposal.project_name||'Proposal'}`,
      when:proposal.follow_up_due?fmtShortDate(proposal.follow_up_due):'Due now',
      href:`/proposals/${proposal.estimate_id}`,action:'Follow Up',
    });
  }

  for(const lead of leads||[]){
    if(lead.follow_up&&lead.follow_up<=start)attention.push({
      priority:7,tone:'info',subject:`Lead · ${lead.customer_name||lead.opportunity_number}`,
      issue:lead.project_name||'Open opportunity needs follow-up.',
      when:`Due · ${fmtShortDate(lead.follow_up)}`,href:`/leads/${lead.id}`,action:'Lead',
    });
  }

  for(const event of cash||[]){
    if(event.urgency==='overdue'||event.urgency==='critical')attention.push({
      priority:8,tone:'warning',subject:'Cashflow',issue:event.description||'Cash obligation needs attention.',
      when:`${fmtShortDate(event.event_date)} · ${num(event.cash_out)>0?`${money(event.cash_out)} out`:`${money(event.cash_in)} in`}`,
      href:'/cashflow',action:'Cashflow',
    });
  }
  attention.sort((a,b)=>a.priority-b.priority);

  const openProposals=(proposals||[]).filter((row:any)=>['sent','viewed','needs_reply'].includes(row.conversion_stage));
  const needsReply=openProposals.filter((row:any)=>row.conversion_stage==='needs_reply').length;
  const openProposalValue=openProposals.reduce((sum:number,row:any)=>sum+num(row.base_sell_price),0);
  const openLeads=(leads||[]).length;
  const followUps=[
    ...(proposals||[]).filter((row:any)=>row.follow_up_due).map((row:any)=>({date:row.follow_up_due,label:`${row.proposal_number} · ${row.customer_name||row.project_name||'Proposal'}`,href:`/proposals/${row.estimate_id}`})),
    ...(leads||[]).filter((row:any)=>row.follow_up).map((row:any)=>({date:row.follow_up,label:`${row.opportunity_number} · ${row.customer_name||row.project_name||'Lead'}`,href:`/leads/${row.id}`})),
  ].sort((a:any,b:any)=>String(a.date).localeCompare(String(b.date)));
  const nextFollowUp=followUps[0]||null;

  const headerStatus=attention.length
    ?`${attention.length} attention · ${jobsReady} ready · ${jobsHeld} hold · ${crewWorking} active field shift${crewWorking===1?'':'s'}`
    :`${jobsReady} ready · ${jobsHeld} hold · ${crewWorking} active field shift${crewWorking===1?'':'s'} · no urgent exceptions`;

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page owner-home-v3 dashboard-b2">
    <header className="dashboard-head">
      <div>
        <div className="dashboard-eyebrow">CAREZ CONCRETE · TODAY</div>
        <h1>{fmtDate(start)}</h1>
        <p>{headerStatus}</p>
      </div>
      <div className="dashboard-head-actions">
        <Link className="button" href="/projects"><BriefcaseBusiness size={15}/> Jobs</Link>
        <Link className="button secondary" href="/schedule"><CalendarDays size={15}/> Schedule</Link>
      </div>
    </header>

    <section className="dashboard-ops-strip" aria-label="Today's operating position">
      <DashboardMetric label="Ready to Move" value={String(jobsReady)} help="Jobs with a physical operation ready." tone={jobsReady?'success':'neutral'}/>
      <DashboardMetric label="Hard Holds" value={String(jobsHeld)} help="Inspection, setup, or prerequisite blocks work." tone={jobsHeld?'danger':'neutral'}/>
      <DashboardMetric label="Field Active" value={String(activeFieldJobs)} help={`${crewWorking} active field shift${crewWorking===1?'':'s'}; named crew grouping is not modeled.`} tone={activeFieldJobs?'active':'neutral'}/>
      <DashboardMetric label="Customers Owe" value={money(ar)} help={overdue?`${money(overdue)} past due.`:'No past-due customer balance.'} tone={overdue?'danger':ar?'warning':'neutral'}/>
      <DashboardMetric label="7-Day Cash" value={money(cashNet)} help={`${money(cashIn)} expected in · ${money(cashOut)} expected out.`} tone={cashNet<0?'warning':'neutral'}/>
    </section>

    <div className="dashboard-primary-grid">
      <section className="dashboard-panel dashboard-attention-panel">
        <div className="dashboard-panel-head"><div><span>HANDLE FIRST</span><strong>Management attention</strong><small>Field blockers, cash exceptions, and follow-ups in consequence order.</small></div><b>{attention.length}</b></div>
        {attention.length===0?<div className="dashboard-clear-row"><CheckCircle2/><div><strong>No urgent exceptions</strong><span>Today's work can run from the current plan.</span></div></div>:<div className="dashboard-attention-list">
          <div className="dashboard-attention-columns"><span>Issue</span><span>Timing</span><span>Action</span></div>
          {attention.slice(0,8).map((item,index)=><Link href={item.href} key={`${item.subject}-${index}`} className={`dashboard-attention-row ${item.tone}`}>
            <span className="dashboard-attention-mark">{item.tone==='danger'?<AlertTriangle/>:item.tone==='warning'?<Clock3/>:<PhoneCall/>}</span>
            <span className="dashboard-attention-copy"><strong>{item.subject}</strong><small>{item.issue}</small></span>
            <span className="dashboard-attention-when">{item.when}</span>
            <b>{item.action}<ArrowRight/></b>
          </Link>)}
        </div>}
      </section>

      <section className="dashboard-panel dashboard-field-panel">
        <div className="dashboard-panel-head"><div><span>TODAY'S FIELD PLAN</span><strong>Scheduled production</strong><small>What is planned today and whether the physical work is clear.</small></div><Link href="/schedule">Full Schedule</Link></div>
        <div className="dashboard-table-scroll">
          <table className="dashboard-table dashboard-field-table">
            <thead><tr><th>Time</th><th>Job</th><th>Operation</th><th>Field</th><th>Readiness</th><th/></tr></thead>
            <tbody>{todayFieldWork.map((itemRaw:any)=>{
              const item:any=itemRaw,job:any=joinedProject(item),rr:any=item.work_package_operation_id?opReady.get(item.work_package_operation_id):null;
              const readiness=rr?.ready_to_start_all===false?'blocked':rr?.ready_to_start_all===true?'ready':'scheduled';
              const field=fieldMap.get(item.project_id)||{working:0,review:0};
              return <tr key={item.id}>
                <td className="numeric">{fmtTime(item.start_time)||'—'}</td>
                <td>{item.project_id?<Link href={`/projects/${item.project_id}`}><strong>{job?.job_number||'Job'}</strong><span>{job?.name||'Project'}</span></Link>:<><strong>{job?.job_number||'Job'}</strong><span>{job?.name||'Project'}</span></>}</td>
                <td><strong>{item.title}</strong>{readiness==='blocked'&&rr?.start_next_action?<span>{rr.start_next_action}</span>:null}</td>
                <td><strong>{field.working?`${field.working} working`:'—'}</strong><span>{field.review?`${field.review} timecard review`:field.working?'Active field shift':'No active shift'}</span></td>
                <td><StatusDot tone={readiness==='blocked'?'danger':readiness==='ready'?'success':'muted'} label={readiness==='blocked'?'Blocked':readiness==='ready'?'Ready':'Scheduled'}/></td>
                <td className="dashboard-row-action"><Link href={readiness==='blocked'?'/readiness':'/schedule'}>Open<ArrowRight/></Link></td>
              </tr>;
            })}</tbody>
          </table>
          {todayFieldWork.length===0&&<div className="dashboard-compact-empty"><CalendarDays/><div><strong>Nothing scheduled today</strong><span>Open Schedule to plan the next ready operation.</span></div><Link href="/schedule">Schedule<ArrowRight/></Link></div>}
        </div>
      </section>
    </div>

    <section className="dashboard-panel dashboard-jobs-panel">
      <div className="dashboard-panel-head"><div><span>ACTIVE JOBS</span><strong>What moves next</strong><small>The next physical operation for each active job, with live readiness and budget position.</small></div><Link className="button secondary" href="/projects">All Jobs</Link></div>
      <div className="dashboard-table-scroll">
        <table className="dashboard-table dashboard-jobs-table">
          <thead><tr><th>Job / Client</th><th>Status</th><th>Next Operation</th><th>Next Date</th><th>Field</th><th>Readiness</th><th>Budget Position</th><th/></tr></thead>
          <tbody>{dashboardJobs.slice(0,8).map((row:any)=>{
            const p=row.project;
            const location=[p.city,p.state].filter(Boolean).join(', ');
            const nextOperation=row.next?.title||(row.state==='hold'?'Clear current hold':num(row.r.ready_operations)>0?'Choose next ready operation':p.next_action||'Plan next work');
            const readiness=row.state==='hold'?{tone:'danger',label:'Blocked'}:row.state==='ready'?{tone:'success',label:'Ready'}:{tone:'muted',label:'Plan'};
            const hasBudget=Boolean(row.budget?.project_id);
            return <tr key={p.id}>
              <td className="dashboard-job-cell"><Link href={`/projects/${p.id}`}><strong>{p.job_number} · {p.name}</strong><span>{row.customer?.name||location||'Customer not linked'}</span>{row.customer?.name&&location?<small>{location}</small>:null}</Link></td>
              <td><StatusDot tone={p.status==='on_hold'?'danger':'active'} label={titleCase(p.status)}/></td>
              <td><strong>{nextOperation}</strong>{row.state==='hold'?<span>{num(row.r.failed_inspection_operations)>0?'Inspection must clear before work starts':`${num(row.r.blocked_operations)} operation${num(row.r.blocked_operations)===1?'':'s'} blocked`}</span>:null}</td>
              <td className="numeric"><strong>{fmtShortDate(row.next?.schedule_date)}</strong><span>{row.next?.schedule_date?'Next field date':'Not scheduled'}</span></td>
              <td><strong>{row.field.working?`${row.field.working} working`:'—'}</strong><span>{row.field.review?`${row.field.review} timecard review`:row.field.working?'Active field shift':'No active shift'}</span></td>
              <td><StatusDot tone={readiness.tone as any} label={readiness.label}/></td>
              <td className="dashboard-budget-cell"><strong>{hasBudget?`${row.budgetUsed.toFixed(0)}% used`:'Not frozen'}</strong>{hasBudget?<div><i style={{width:`${Math.max(0,Math.min(100,row.budgetUsed))}%`}}/></div>:null}<span>{hasBudget?`${row.laborRemaining.toFixed(1)} MH remaining`:'No authoritative budget snapshot'}</span></td>
              <td className="dashboard-row-action"><Link href={`/projects/${p.id}`}>Open<ArrowRight/></Link></td>
            </tr>;
          })}</tbody>
        </table>
        {dashboardJobs.length===0&&<div className="dashboard-compact-empty"><BriefcaseBusiness/><div><strong>No active jobs</strong><span>Accepted proposals and direct jobs will appear here.</span></div><Link href="/projects">Jobs<ArrowRight/></Link></div>}
      </div>
    </section>

    <div className="dashboard-lower-grid">
      <section className="dashboard-panel dashboard-estimating-panel">
        <div className="dashboard-panel-head"><div><span>ESTIMATING</span><strong>Bid Pipeline</strong><small>Current preconstruction workload from existing lead and proposal state.</small></div></div>
        <div className="dashboard-mini-metrics">
          <div><span>Open Leads</span><strong>{openLeads}</strong></div>
          <div><span>Proposals Out</span><strong>{openProposals.length}</strong></div>
          <div><span>Needs Reply</span><strong>{needsReply}</strong></div>
          <div><span>Proposal Value</span><strong>{money(openProposalValue)}</strong></div>
        </div>
        <div className="dashboard-next-followup">{nextFollowUp?<><div><span>NEXT FOLLOW-UP</span><strong>{nextFollowUp.label}</strong><small>{fmtShortDate(nextFollowUp.date)}</small></div><Link href={nextFollowUp.href}>Open<ArrowRight/></Link></>:<div><span>NEXT FOLLOW-UP</span><strong>No dated follow-up in the current pipeline</strong></div>}</div>
        <div className="dashboard-inline-actions"><Link href="/leads">Leads</Link><Link href="/takeoff"><Ruler/>Takeoff</Link><Link href="/estimates">Estimates</Link><Link href="/proposals"><FileText/>Proposals</Link></div>
      </section>

      <section className="dashboard-panel dashboard-finance-panel">
        <div className="dashboard-panel-head"><div><span>FINANCIAL SNAPSHOT</span><strong>Operational cash attention</strong><small>Only existing A/R and seven-day cashflow values are shown.</small></div><Link href="/cashflow">Cashflow</Link></div>
        <dl className="dashboard-finance-list">
          <div><dt>Customers owe</dt><dd>{money(ar)}</dd></div>
          <div className={overdue?'danger':''}><dt>Past due</dt><dd>{money(overdue)}</dd></div>
          <div><dt>7-day expected in</dt><dd>{money(cashIn)}</dd></div>
          <div><dt>7-day expected out</dt><dd>{money(cashOut)}</dd></div>
          <div className={cashNet<0?'warning':''}><dt>7-day net</dt><dd>{money(cashNet)}</dd></div>
        </dl>
        <div className="dashboard-inline-actions"><Link href="/billing"><Wallet/>Billing</Link><Link href="/cashflow">Cashflow</Link></div>
      </section>
    </div>
  </div></AppShell>;
}

function DashboardMetric({label,value,help,tone}:{label:string;value:string;help:string;tone:'neutral'|'active'|'success'|'warning'|'danger'}){
  return <div className={`dashboard-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{help}</small></div>;
}

function StatusDot({tone,label}:{tone:'muted'|'active'|'success'|'warning'|'danger';label:string}){
  return <span className={`dashboard-status ${tone}`}><i/>{label}</span>;
}
