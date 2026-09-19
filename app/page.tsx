import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,BriefcaseBusiness,CalendarDays,FileText,Ruler,Wallet} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {
  CarezDataGrid,CarezDataGridBody,CarezDataGridCell,CarezDataGridHead,
  CarezDataGridHeaderCell,CarezDataGridRow,CarezDataGridTable,
  CarezEmptyState,CarezOperatingMetric,CarezOperatingMetricStrip,CarezStatus,
} from '@/components/carez';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Progress} from '@/components/ui/progress';
import {createClient} from '@/lib/supabase/server';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(date:string,n:number)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const fmtDate=(v:string)=>new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(new Date(`${v}T12:00:00`));
const fmtShortDate=(v?:string|null)=>v?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`)):'—';
const fmtTime=(v?:string|null)=>{if(!v)return '';const [h,m]=String(v).split(':').map(Number);const d=new Date();d.setHours(h,m||0,0,0);return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(d);};
const joinedProject=(item:any)=>Array.isArray(item?.projects)?item.projects[0]:item?.projects;
const joinedCustomer=(project:any)=>Array.isArray(project?.customers)?project.customers[0]:project?.customers;
const titleCase=(v?:string|null)=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());

type AttentionTone='danger'|'warning'|'info';
type Attention={priority:number;tone:AttentionTone;subject:string;issue:string;when:string;href:string;action:string;};
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
    return {project,r,budget,bill,field,state,next,customer,budgetUsed:num(budget.budget_cost_used_percent),laborRemaining:num(budget.labor_hours_remaining)};
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
      attention.push({priority:1,tone:'danger',subject:`${job?.job_number||'Job'} · ${job?.name||item.title}`,issue:r.start_next_action||`${item.title} is not ready to start`,when:item.start_time?`Today · ${fmtTime(item.start_time)}`:'Today',href:'/readiness',action:'Clear hold'});
    }
  }

  for(const row of activeProjects){
    if(row.state!=='hold'||todayFieldWork.some((item:any)=>item.project_id===row.project.id))continue;
    const failed=num(row.r.failed_inspection_operations),blocked=num(row.r.blocked_operations);
    attention.push({priority:2,tone:'danger',subject:`${row.project.job_number} · ${row.project.name}`,issue:failed>0?'Failed inspection is blocking the next operation':blocked>0?'Open physical work is blocked':row.project.next_action||'Project is on hold',when:row.next?.schedule_date?`Next field date · ${fmtShortDate(row.next.schedule_date)}`:'Before next operation',href:'/readiness',action:'Readiness'});
  }

  if(timeReview)attention.push({priority:3,tone:'warning',subject:'Field time review',issue:`${timeReview} submitted timecard${timeReview===1?' needs':'s need'} approval or correction.`,when:'Before payroll / job cost',href:'/field/review',action:'Review time'});
  if(overdue>0)attention.push({priority:4,tone:'warning',subject:'Accounts receivable',issue:`${money(overdue)} customer balance is past due.`,when:`${money(ar)} total outstanding`,href:'/billing',action:'Billing'});

  for(const proposal of proposals||[]){
    if(proposal.conversion_stage==='needs_reply')attention.push({priority:5,tone:'warning',subject:`${proposal.proposal_number} · ${proposal.customer_name||'Customer'}`,issue:proposal.next_action||`${proposal.project_name||'Proposal'} needs a response.`,when:proposal.follow_up_due?`Follow-up · ${fmtShortDate(proposal.follow_up_due)}`:'Customer response waiting',href:`/proposals/${proposal.estimate_id}`,action:'Proposal'});
    else if(proposal.follow_up_due_now)attention.push({priority:6,tone:'info',subject:`Follow up · ${proposal.proposal_number}`,issue:`${proposal.customer_name||'Customer'} · ${proposal.project_name||'Proposal'}`,when:proposal.follow_up_due?fmtShortDate(proposal.follow_up_due):'Due now',href:`/proposals/${proposal.estimate_id}`,action:'Follow up'});
  }

  for(const lead of leads||[]){
    if(lead.follow_up&&lead.follow_up<=start)attention.push({priority:7,tone:'info',subject:`Lead · ${lead.customer_name||lead.opportunity_number}`,issue:lead.project_name||'Open opportunity needs follow-up.',when:`Due · ${fmtShortDate(lead.follow_up)}`,href:`/leads/${lead.id}`,action:'Lead'});
  }

  for(const event of cash||[]){
    if(event.urgency==='overdue'||event.urgency==='critical')attention.push({priority:8,tone:'warning',subject:'Cashflow',issue:event.description||'Cash obligation needs attention.',when:`${fmtShortDate(event.event_date)} · ${num(event.cash_out)>0?`${money(event.cash_out)} out`:`${money(event.cash_in)} in`}`,href:'/cashflow',action:'Cashflow'});
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
    ?`${attention.length} item${attention.length===1?'':'s'} need attention · ${jobsReady} ready · ${jobsHeld} on hold · ${crewWorking} active field shift${crewWorking===1?'':'s'}`
    :`${jobsReady} ready · ${jobsHeld} on hold · ${crewWorking} active field shift${crewWorking===1?'':'s'} · no urgent exceptions`;

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Today</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{fmtDate(start)}</h1>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{headerStatus}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/projects" className={buttonVariants({size:'sm'})}><BriefcaseBusiness/>Projects</Link>
          <Link href="/schedule" className={buttonVariants({variant:'outline',size:'sm'})}><CalendarDays/>Schedule</Link>
        </div>
      </header>

      <section aria-labelledby="today-attention-heading" className="rounded-md border border-border bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-border px-3 py-2.5">
          <div>
            <h2 id="today-attention-heading" className="text-sm font-semibold">Management attention</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Field blockers, cash exceptions, and follow-ups in consequence order.</p>
          </div>
          <CarezStatus tone={attention.length?'error':'neutral'} label={String(attention.length)}/>
        </div>
        {attention.length===0
          ?<div className="p-3"><CarezEmptyState title="No urgent exceptions" description="Today's work can run from the current plan."/></div>
          :<div className="divide-y divide-border">
            {attention.slice(0,8).map((item,index)=><Link
              href={item.href}
              key={item.subject+'-'+index}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none"
            >
              <CarezStatus tone={item.tone==='danger'?'error':item.tone} label={item.tone==='danger'?'Critical':item.tone==='warning'?'Attention':'Follow up'}/>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.subject}</span>
                <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{item.issue}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{item.when}</span>
              </span>
              <span className="hidden items-center gap-1 text-xs font-medium text-primary sm:flex">{item.action}<ArrowRight className="size-3"/></span>
            </Link>)}
          </div>}
      </section>

      <CarezOperatingMetricStrip columns={5} aria-label="Today's operating position">
        <CarezOperatingMetric label="Ready to move" value={String(jobsReady)} help="Jobs with a physical operation ready."/>
        <CarezOperatingMetric label="Hard holds" value={String(jobsHeld)} help="Inspection, setup, or prerequisite blocks work." tone={jobsHeld?'error':'neutral'}/>
        <CarezOperatingMetric label="Field active" value={String(activeFieldJobs)} help={crewWorking+' active field shift'+(crewWorking===1?'':'s')+' right now.'} tone={activeFieldJobs?'info':'neutral'}/>
        <CarezOperatingMetric label="Customers owe" value={money(ar)} help={overdue?money(overdue)+' past due.':'No past-due customer balance.'} tone={overdue?'error':ar?'warning':'neutral'}/>
        <CarezOperatingMetric label="7-day cash" value={money(cashNet)} help={money(cashIn)+' expected in · '+money(cashOut)+' expected out.'} tone={cashNet<0?'warning':'neutral'}/>
      </CarezOperatingMetricStrip>

      <section className="space-y-3" aria-labelledby="today-production-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="today-production-heading" className="text-sm font-semibold">Scheduled production</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Today's field work and whether each operation is physically clear.</p>
          </div>
          <Link href="/schedule" className={buttonVariants({variant:'ghost',size:'sm'})}>Full schedule</Link>
        </div>
        <CarezDataGrid
          isEmpty={todayFieldWork.length===0}
          empty={<CarezEmptyState title="Nothing scheduled today" description="Open Schedule to plan the next ready operation." actions={<Link href="/schedule" className={buttonVariants({variant:'outline',size:'sm'})}>Open schedule</Link>}/>}
        >
          <CarezDataGridTable>
            <CarezDataGridHead>
              <CarezDataGridRow>
                <CarezDataGridHeaderCell>Time</CarezDataGridHeaderCell>
                <CarezDataGridHeaderCell>Job</CarezDataGridHeaderCell>
                <CarezDataGridHeaderCell>Operation</CarezDataGridHeaderCell>
                <CarezDataGridHeaderCell>Field</CarezDataGridHeaderCell>
                <CarezDataGridHeaderCell>Readiness</CarezDataGridHeaderCell>
              </CarezDataGridRow>
            </CarezDataGridHead>
            <CarezDataGridBody>{todayFieldWork.map((itemRaw:any)=>{
              const item:any=itemRaw,job:any=joinedProject(item),rr:any=item.work_package_operation_id?opReady.get(item.work_package_operation_id):null;
              const readiness=rr?.ready_to_start_all===false?'blocked':rr?.ready_to_start_all===true?'ready':'scheduled';
              const field=fieldMap.get(item.project_id)||{working:0,review:0};
              return <CarezDataGridRow key={item.id}>
                <CarezDataGridCell numeric>{fmtTime(item.start_time)||'—'}</CarezDataGridCell>
                <CarezDataGridCell>{item.project_id?<Link href={'/projects/'+item.project_id} className="font-medium hover:text-primary">{job?.job_number||'Job'}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{job?.name||'Project'}</span></Link>:<span className="font-medium">{job?.job_number||'Job'}</span>}</CarezDataGridCell>
                <CarezDataGridCell><span className="font-medium">{item.title}</span>{readiness==='blocked'&&rr?.start_next_action?<span className="mt-0.5 block max-w-56 whitespace-normal text-xs text-muted-foreground">{rr.start_next_action}</span>:null}</CarezDataGridCell>
                <CarezDataGridCell><span className="font-medium">{field.working?field.working+' working':'—'}</span>{field.review?<span className="mt-0.5 block text-xs text-muted-foreground">{field.review} timecard review</span>:null}</CarezDataGridCell>
                <CarezDataGridCell><CarezStatus tone={readiness==='blocked'?'blocked':readiness==='ready'?'success':'neutral'} label={readiness==='blocked'?'Blocked':readiness==='ready'?'Ready':'Scheduled'}/></CarezDataGridCell>
              </CarezDataGridRow>;
            })}</CarezDataGridBody>
          </CarezDataGridTable>
        </CarezDataGrid>
      </section>

      <section className="space-y-3" aria-labelledby="today-next-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active jobs</p>
            <h2 id="today-next-heading" className="mt-1 text-lg font-semibold">What moves next</h2>
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Next physical operation, readiness, live field activity, and budget position.</p>
          </div>
          <Link href="/projects" className={buttonVariants({variant:'outline',size:'sm'})}>All projects</Link>
        </div>
        <CarezDataGrid
          isEmpty={dashboardJobs.length===0}
          empty={<CarezEmptyState title="No active jobs" description="Accepted proposals and direct jobs will appear here." actions={<Link href="/projects" className={buttonVariants({variant:'outline',size:'sm'})}>Open projects</Link>}/>}
        >
          <CarezDataGridTable>
            <CarezDataGridHead><CarezDataGridRow>
              <CarezDataGridHeaderCell>Job / client</CarezDataGridHeaderCell>
              <CarezDataGridHeaderCell>Status</CarezDataGridHeaderCell>
              <CarezDataGridHeaderCell>Next operation</CarezDataGridHeaderCell>
              <CarezDataGridHeaderCell>Next date</CarezDataGridHeaderCell>
              <CarezDataGridHeaderCell>Field</CarezDataGridHeaderCell>
              <CarezDataGridHeaderCell>Readiness</CarezDataGridHeaderCell>
              <CarezDataGridHeaderCell className="min-w-40">Budget position</CarezDataGridHeaderCell>
            </CarezDataGridRow></CarezDataGridHead>
            <CarezDataGridBody>{dashboardJobs.slice(0,8).map((row:any)=>{
              const p=row.project;
              const location=[p.city,p.state].filter(Boolean).join(', ');
              const nextOperation=row.next?.title||(row.state==='hold'?'Clear current hold':num(row.r.ready_operations)>0?'Choose next ready operation':p.next_action||'Plan next work');
              const readiness=row.state==='hold'?{tone:'blocked' as const,label:'Blocked'}:row.state==='ready'?{tone:'success' as const,label:'Ready'}:{tone:'neutral' as const,label:'Plan'};
              const hasBudget=Boolean(row.budget?.project_id);
              return <CarezDataGridRow key={p.id}>
                <CarezDataGridCell><Link href={'/projects/'+p.id} className="font-medium hover:text-primary">{p.job_number} · {p.name}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.customer?.name||location||'Customer not linked'}</span>{row.customer?.name&&location?<span className="block text-[11px] font-normal text-muted-foreground">{location}</span>:null}</Link></CarezDataGridCell>
                <CarezDataGridCell><CarezStatus tone={p.status==='on_hold'?'blocked':'info'} label={titleCase(p.status)}/></CarezDataGridCell>
                <CarezDataGridCell><span className="font-medium">{nextOperation}</span>{row.state==='hold'?<span className="mt-0.5 block max-w-64 whitespace-normal text-xs text-muted-foreground">{num(row.r.failed_inspection_operations)>0?'Inspection must clear before work starts':num(row.r.blocked_operations)+' operation'+(num(row.r.blocked_operations)===1?'':'s')+' blocked'}</span>:null}</CarezDataGridCell>
                <CarezDataGridCell numeric>{fmtShortDate(row.next?.schedule_date)}<span className="mt-0.5 block font-sans text-xs text-muted-foreground">{row.next?.schedule_date?'Next field date':'Not scheduled'}</span></CarezDataGridCell>
                <CarezDataGridCell><span className="font-medium">{row.field.working?row.field.working+' working':'—'}</span><span className="mt-0.5 block text-xs text-muted-foreground">{row.field.review?row.field.review+' timecard review':row.field.working?'Active field shift':'No active shift'}</span></CarezDataGridCell>
                <CarezDataGridCell><CarezStatus tone={readiness.tone} label={readiness.label}/></CarezDataGridCell>
                <CarezDataGridCell>{hasBudget?<div className="min-w-36"><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className={cn('font-medium',row.budgetUsed>=100&&'text-destructive')}>{row.budgetUsed.toFixed(0)}% used</span><span className="text-muted-foreground">{row.laborRemaining.toFixed(1)} MH left</span></div><Progress value={Math.max(0,Math.min(100,row.budgetUsed))}/></div>:<span className="text-xs text-muted-foreground">No authoritative budget snapshot</span>}</CarezDataGridCell>
              </CarezDataGridRow>;
            })}</CarezDataGridBody>
          </CarezDataGridTable>
        </CarezDataGrid>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader><CardTitle>Bid pipeline</CardTitle><CardDescription>Current preconstruction workload from existing lead and proposal state.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
              {[['Open leads',String(openLeads)],['Proposals out',String(openProposals.length)],['Needs reply',String(needsReply)],['Proposal value',money(openProposalValue)]].map(([label,value])=><div key={label} className="bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1.5 font-mono text-lg font-semibold tabular-nums">{value}</div></div>)}
            </div>
            <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/15 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><div className="text-xs font-medium text-muted-foreground">Next follow-up</div>{nextFollowUp?<><div className="mt-1 truncate text-sm font-medium">{nextFollowUp.label}</div><div className="mt-0.5 text-xs text-muted-foreground">{fmtShortDate(nextFollowUp.date)}</div></>:<div className="mt-1 text-sm text-muted-foreground">No dated follow-up in the current pipeline</div>}</div>
              {nextFollowUp?<Link href={nextFollowUp.href} className={buttonVariants({variant:'outline',size:'sm'})}>Open<ArrowRight/></Link>:null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/leads" className={buttonVariants({variant:'outline',size:'sm'})}>Leads</Link>
              <Link href="/takeoff" className={buttonVariants({variant:'outline',size:'sm'})}><Ruler/>Takeoff</Link>
              <Link href="/estimates" className={buttonVariants({variant:'outline',size:'sm'})}>Estimates</Link>
              <Link href="/proposals" className={buttonVariants({variant:'outline',size:'sm'})}><FileText/>Proposals</Link>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="grid grid-cols-[1fr_auto] gap-4"><div><CardTitle>Operational cash attention</CardTitle><CardDescription>Current A/R and seven-day cashflow values already modeled in Carez.</CardDescription></div><Link href="/cashflow" className={buttonVariants({variant:'ghost',size:'sm'})}>Cashflow</Link></CardHeader>
          <CardContent>
            <dl className="divide-y rounded-md border border-border">
              {[
                ['Customers owe',money(ar),'normal'],
                ['Past due',money(overdue),overdue?'danger':'normal'],
                ['7-day expected in',money(cashIn),'normal'],
                ['7-day expected out',money(cashOut),'normal'],
                ['7-day net',money(cashNet),cashNet<0?'warning':'normal'],
              ].map(([label,value,tone])=><div key={label} className="flex items-center justify-between gap-6 px-3 py-2.5"><dt className="text-sm text-muted-foreground">{label}</dt><dd className={cn('font-mono text-sm font-semibold tabular-nums',tone==='danger'&&'text-destructive',tone==='warning'&&'text-warning')}>{value}</dd></div>)}
            </dl>
            <div className="mt-4 flex gap-2"><Link href="/billing" className={buttonVariants({variant:'outline',size:'sm'})}><Wallet/>Billing</Link><Link href="/cashflow" className={buttonVariants({variant:'outline',size:'sm'})}>Cashflow</Link></div>
          </CardContent>
        </Card>
      </div>
    </div>
  </AppShell>;
}
