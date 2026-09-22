import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight,BriefcaseBusiness,CalendarDays,FileText,Ruler,Wallet,CheckCheck,HardHat,ShieldAlert,Activity,Target,ArrowDownUp} from 'lucide-react';
import {CarezSectionHeading,CarezOperationalPulse,CarezExperienceEmpty} from '@/components/carez/experience';
import {AppShell} from '@/components/AppShell';
import {CarezDataGrid,CarezDataGridBody,CarezDataGridCell,CarezDataGridHead,CarezDataGridHeaderCell,CarezDataGridRow,CarezDataGridTable,CarezEmptyState,CarezStatus} from '@/components/carez';
import {buttonVariants} from '@/components/ui/button';
import {Item,ItemActions,ItemContent,ItemDescription,ItemMedia,ItemTitle} from '@/components/ui/item';
import {Stat,StatIndicator,StatLabel,StatValue} from '@/components/ui/stat';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {TodayOperationsGrid} from '@/components/reui/today-operations-grid';
import {Card,CardContent,CardHeader} from '@/components/ui/card';
import {Progress} from '@/components/ui/progress';
import {createClient} from '@/lib/supabase/server';
import {resolveOperationalState} from '@/lib/ui/operations';
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
  const attentionStatusTone=attention.some(item=>item.tone==='danger')?'error':attention.some(item=>item.tone==='warning')?'warning':attention.length?'info':'neutral';

  const openProposals=(proposals||[]).filter((row:any)=>['sent','viewed','needs_reply'].includes(row.conversion_stage));
  const needsReply=openProposals.filter((row:any)=>row.conversion_stage==='needs_reply').length;
  const openProposalValue=openProposals.reduce((sum:number,row:any)=>sum+num(row.base_sell_price),0);
  const openLeads=(leads||[]).length;
  const followUps=[
    ...(proposals||[]).filter((row:any)=>row.follow_up_due).map((row:any)=>({date:row.follow_up_due,label:`${row.proposal_number} · ${row.customer_name||row.project_name||'Proposal'}`,href:`/proposals/${row.estimate_id}`})),
    ...(leads||[]).filter((row:any)=>row.follow_up).map((row:any)=>({date:row.follow_up,label:`${row.opportunity_number} · ${row.customer_name||row.project_name||'Lead'}`,href:`/leads/${row.id}`})),
  ].sort((a:any,b:any)=>String(a.date).localeCompare(String(b.date)));
  const nextFollowUp=followUps[0]||null;

  const operations=dashboardJobs.slice(0,8).map((row:any)=>{
    const p=row.project;
    const status=row.state==='hold'?'HOLD':row.state==='ready'?'READY':'PLANNED';
    return {id:p.id,time:fmtTime(row.next?.start_time)||fmtShortDate(row.next?.schedule_date),project:`${p.job_number} · ${p.name}`,operation:row.next?.title||p.next_action||'Plan next work',quantity:'—',status,tone:row.state==='hold'?'blocked' as const:row.state==='ready'?'success' as const:'neutral' as const,href:row.state==='hold'?'/readiness':'/projects/'+p.id};
  });

  return <AppShell userName={profile!.full_name||user!.email||'Owner'}>
    <div className="mx-auto grid w-full max-w-[1560px] gap-7 px-1 sm:gap-8">
      <header className="relative isolate flex min-h-20 items-center overflow-hidden border-b border-border/80 py-4">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[.045] [mask-image:linear-gradient(to_bottom,black,transparent)]" style={{backgroundImage:'radial-gradient(ellipse at top, var(--primary), transparent 64%), linear-gradient(90deg, var(--primary) 1px, transparent 1px), linear-gradient(0deg, var(--primary) 1px, transparent 1px), linear-gradient(135deg, transparent 48%, var(--primary) 49%, var(--primary) 50%, transparent 51%)',backgroundPosition:'center, right top, right top, right top',backgroundSize:'auto, 44px 44px, 44px 44px, 176px 176px',maskImage:'linear-gradient(to left, black, transparent 72%)'}} />
        <div className="relative z-10"><p className="font-mono text-[10px] font-semibold tracking-[.14em] text-muted-foreground">OPERATIONS</p><h1 className="mt-1.5 text-3xl font-semibold tracking-tight">Today</h1><p className="mt-1 text-sm text-muted-foreground">{fmtDate(start)}</p></div>
      </header>

      <div className="grid gap-7 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="today-work-heading" className="border-t-2 border-primary pt-3"><h2 id="today-work-heading" className="text-sm font-semibold">Today&apos;s Work</h2>
          <div className="mt-3">{todayFieldWork.length?todayFieldWork.map((itemRaw:any)=>{const item:any=itemRaw,job:any=joinedProject(item);return <Item key={item.id} variant="outline" size="xs"><ItemMedia variant="icon"><CalendarDays className="size-4"/></ItemMedia><ItemContent><ItemTitle>{job?.job_number||'Job'} · {job?.name||'Project'}</ItemTitle><ItemDescription>{item.title} · {fmtTime(item.start_time)||'Time pending'}</ItemDescription></ItemContent><ItemActions><Link href={item.project_id?'/projects/'+item.project_id:'/schedule'} className="text-sm font-medium text-primary hover:underline">View →</Link></ItemActions></Item>; }):<Item variant="outline" size="xs"><ItemMedia variant="icon"><CalendarDays className="size-4"/></ItemMedia><ItemContent><ItemTitle>No scheduled production</ItemTitle><ItemDescription>Today&apos;s schedule is clear.</ItemDescription></ItemContent><ItemActions><Link href="/schedule" className="text-sm font-medium text-primary hover:underline">Open Schedule →</Link></ItemActions></Item>}</div>
        </section>
        <section aria-labelledby="today-attention-heading" className={cn('border-t-2 pt-3',attention.some(item=>item.tone==='danger')?'border-destructive':attention.some(item=>item.tone==='warning')?'border-warning':'border-emerald-500/70')}><h2 id="today-attention-heading" className="text-sm font-semibold">Attention</h2>
          <div className="mt-3">{attention.length?attention.slice(0,8).map((item,index)=><Item key={item.subject+'-'+index} variant="outline" size="xs"><ItemMedia variant="icon"><ShieldAlert className="size-4"/></ItemMedia><ItemContent><ItemTitle>{item.subject}</ItemTitle><ItemDescription>{item.issue} · {item.when}</ItemDescription></ItemContent><ItemActions><Link href={item.href} className="text-sm font-medium text-primary hover:underline">Review →</Link></ItemActions></Item>):<Item variant="outline" size="xs"><ItemMedia variant="icon" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCheck className="size-4"/></ItemMedia><ItemContent><ItemTitle>All clear</ItemTitle><ItemDescription>No management exceptions</ItemDescription></ItemContent></Item>}</div>
        </section>
      </div>

      <section aria-labelledby="today-telemetry-heading" className="border-t-2 border-primary/70 pt-3"><h2 id="today-telemetry-heading" className="text-sm font-semibold">Operating Status</h2><div className="mt-3 grid overflow-hidden rounded-md border border-border bg-muted/25 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-5">{[
        ['Ready to move',String(jobsReady)],['Field active',String(activeFieldJobs)],['Hard holds',String(jobsHeld)],['Customers owe',money(ar)],['7-day cash',money(cashNet)],
      ].map(([label,value])=><Stat key={label} className="bg-transparent"><StatLabel className="inline-flex min-h-7 items-center rounded-sm border border-border/80 bg-background/55 px-2.5">{label}</StatLabel><StatValue>{value}</StatValue>{label==='Hard holds'&&jobsHeld?<StatIndicator className="mt-2 block text-warning">Requires attention</StatIndicator>:null}</Stat>)}</div></section>

      <section aria-labelledby="today-next-heading" className="border-t-2 border-primary pt-5"><div className="flex items-center justify-between gap-4"><h2 id="today-next-heading" className="text-[15px] font-semibold">Next Operations</h2></div><div className="mt-4 rounded-md bg-card/40 p-1"><TodayOperationsGrid operations={operations}/></div></section>

      <section aria-labelledby="business-pulse-heading" className="border-t-2 border-primary/50 pt-3"><Tabs defaultValue="pipeline" className="gap-0"><div className="flex items-center justify-between gap-4"><h2 id="business-pulse-heading" className="text-sm font-semibold">Business Pulse</h2><TabsList variant="experience"><TabsTrigger value="pipeline">Pipeline</TabsTrigger><TabsTrigger value="cash">Cash</TabsTrigger></TabsList></div><TabsContent value="pipeline" className="mt-3 overflow-hidden rounded-md border border-border bg-muted/20"><dl className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">{[['Open leads',String(openLeads)],['Proposals out',String(openProposals.length)],['Proposal value',money(openProposalValue)],['Next follow-up',nextFollowUp?`${nextFollowUp.label} · ${fmtShortDate(nextFollowUp.date)}`:'—']].map(([label,value])=><div key={label} className="flex items-center justify-between gap-4 px-4 py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-mono text-sm font-semibold tabular-nums">{value}</dd></div>)}</dl></TabsContent><TabsContent value="cash" className="mt-3 overflow-hidden rounded-md border border-border bg-muted/20"><dl className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">{[['Customers owe',money(ar)],['Expected in · 7d',money(cashIn)],['Expected out · 7d',money(cashOut)],['7-day net',money(cashNet)]].map(([label,value])=><div key={label} className="flex items-center justify-between gap-4 px-4 py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-mono text-sm font-semibold tabular-nums">{value}</dd></div>)}</dl></TabsContent></Tabs></section>
    </div>
  </AppShell>;

  return <AppShell userName={profile!.full_name||user!.email||'Owner'}>
    <div className="carez-today-board mx-auto grid w-full max-w-screen-2xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="carez-dayline"><CalendarDays aria-hidden="true"/>{fmtDate(start)}<span>Today</span></p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Today</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/projects" className={buttonVariants({size:'sm'})}><BriefcaseBusiness/>Projects<ArrowUpRight/></Link>
          <Link href="/schedule" className={buttonVariants({variant:'outline',size:'sm'})}><CalendarDays/>Schedule</Link>
        </div>
      </header>

      <section aria-labelledby="today-attention-heading" className="carez-priority-stream">
        <CarezSectionHeading id="today-attention-heading" icon={<ShieldAlert/>} title="Management attention" description="Clear the constraint. Keep the work moving." action={<CarezStatus tone={attentionStatusTone} label={String(attention.length)}/>}/>
        {attention.length===0
          ?<CarezExperienceEmpty icon={<CheckCheck/>} tone="success" title="Nothing needs your attention right now." description="No urgent exceptions in the current field, cash, and follow-up queues."/>
          :<ol className="carez-priority-list">
            {attention.slice(0,8).map((item,index)=><li key={item.subject+'-'+index} data-tone={item.tone}>
              <Link href={item.href} className="carez-priority-link">
                <span className="carez-priority-marker" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
                <span className="min-w-0"><span className="carez-priority-subject">{item.subject}</span><span className="carez-priority-reason">{item.issue}</span><span className="carez-priority-time">{item.when}</span></span>
                <span className="carez-priority-action"><CarezStatus tone={item.tone==='danger'?'error':item.tone} label={item.tone==='danger'?'Critical':item.tone==='warning'?'Attention':'Follow up'}/><span>{item.action}<ArrowRight aria-hidden="true"/></span></span>
              </Link>
            </li>)}
          </ol>}
        {attention.length>8?<p className="pt-3 text-xs text-muted-foreground">Showing the 8 highest-priority items of {attention.length}. Open the relevant workspace to review the rest.</p>:null}
      </section>

      <section className="space-y-3" aria-labelledby="today-production-heading">
        <CarezSectionHeading id="today-production-heading" icon={<CalendarDays/>} title="Scheduled production" description="Today's field work and whether each operation is physically clear." action={<Link href="/schedule" className={buttonVariants({variant:'ghost',size:'sm'})}>Full schedule<ArrowUpRight/></Link>}/>
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

      <CarezOperationalPulse label="Today's operating position" items={[
        {label:'Ready to move',value:jobsReady,detail:'Jobs with a physical operation ready.',icon:<CheckCheck/>,tone:'success',href:'/readiness'},
        {label:'Field active',value:activeFieldJobs,detail:crewWorking+' active field shifts right now.',icon:<HardHat/>,tone:'primary',href:'/field'},
        {label:'Hard holds',value:jobsHeld,detail:'Inspection, setup, or prerequisite blocks.',icon:<ShieldAlert/>,tone:jobsHeld?'danger':'neutral',href:'/readiness'},
        {label:'Customers owe',value:money(ar),detail:overdue?money(overdue)+' past due.':'No past-due customer balance.',icon:<Wallet/>,tone:overdue?'warning':'neutral',href:'/billing'},
        {label:'7-day cash',value:money(cashNet),detail:money(cashIn)+' in · '+money(cashOut)+' out.',icon:<ArrowDownUp/>,tone:cashNet<0?'warning':'primary',href:'/cashflow'},
      ]}/>

      <section className="space-y-3" aria-labelledby="today-next-heading">
        <CarezSectionHeading id="today-next-heading" icon={<Activity/>} title="What moves next" description="Current work, next field dates, and the action that moves each job forward." action={<Link href="/projects" className={buttonVariants({variant:'ghost',size:'sm'})}>All projects<ArrowUpRight/></Link>}/>
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
              const operational=resolveOperationalState(row.state);
              const readiness=row.state==='hold'?{tone:'blocked' as const,label:'Blocked'}:row.state==='ready'?{tone:'success' as const,label:'Ready'}:{tone:'neutral' as const,label:'Plan'};
              const hasBudget=Boolean(row.budget?.project_id);
              return <CarezDataGridRow key={p.id} className="carez-job-row" data-state={row.state}>
                <CarezDataGridCell><Link href={'/projects/'+p.id} className="font-medium hover:text-primary">{p.job_number} · {p.name}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.customer?.name||location||'Customer not linked'}</span>{row.customer?.name&&location?<span className="block text-[11px] font-normal text-muted-foreground">{location}</span>:null}</Link></CarezDataGridCell>
                <CarezDataGridCell>{operational?<CarezStatus tone={operational.tone} label={operational.label}/>:<CarezStatus tone="neutral" label="Unknown"/>}</CarezDataGridCell>
                <CarezDataGridCell><Link href={row.state==='hold'?'/readiness':'/projects/'+p.id} className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">{nextOperation}<ArrowUpRight className="size-3.5"/></Link>{row.state==='hold'?<span className="mt-0.5 block max-w-64 whitespace-normal text-xs text-muted-foreground">{num(row.r.failed_inspection_operations)>0?'Inspection must clear before work starts':num(row.r.blocked_operations)+' operation'+(num(row.r.blocked_operations)===1?'':'s')+' blocked'}</span>:null}</CarezDataGridCell>
                <CarezDataGridCell numeric>{fmtShortDate(row.next?.schedule_date)}<span className="mt-0.5 block font-sans text-xs text-muted-foreground">{row.next?.schedule_date?'Next field date':'Not scheduled'}</span></CarezDataGridCell>
                <CarezDataGridCell><span className="font-medium">{row.field.working?row.field.working+' working':'—'}</span><span className="mt-0.5 block text-xs text-muted-foreground">{row.field.review?row.field.review+' timecard review':row.field.working?'Active field shift':'No active shift'}</span></CarezDataGridCell>
                <CarezDataGridCell><CarezStatus tone={readiness.tone} label={readiness.label}/></CarezDataGridCell>
                <CarezDataGridCell>{hasBudget?<div className="min-w-36"><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className={cn('font-medium',row.budgetUsed>=100&&'text-destructive')}>{row.budgetUsed.toFixed(0)}% used</span><span className="text-muted-foreground">{row.laborRemaining.toFixed(1)} MH left</span></div><Progress value={Math.max(0,Math.min(100,row.budgetUsed))}/></div>:<span className="text-xs text-muted-foreground">No authoritative budget snapshot</span>}</CarezDataGridCell>
              </CarezDataGridRow>;
            })}</CarezDataGridBody>
          </CarezDataGridTable>
        </CarezDataGrid>
      </section>

      <div className="carez-command-domains">
        <Card className="carez-command-domain" data-domain="bids">
          <CardHeader><CarezSectionHeading icon={<Target/>} title="Bid pipeline" description="The next work to win."/></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="carez-bid-numbers">
              {[['Open leads',String(openLeads)],['Proposals out',String(openProposals.length)],['Needs reply',String(needsReply)],['Proposal value',money(openProposalValue)]].map(([label,value])=><div key={label} className="py-2"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1.5 font-mono text-lg font-semibold tabular-nums">{value}</div></div>)}
            </div>
            <div className="carez-follow-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

        <Card className="carez-command-domain" data-domain="cash">
          <CardHeader><CarezSectionHeading icon={<Wallet/>} title="Operational cash attention" description="Customer balances and the next seven days."/></CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <dl className="carez-cash-ledger divide-y divide-border">
              {[
                ['Customers owe',money(ar),'normal'],
                ['Past due',money(overdue),overdue?'danger':'normal'],
                ['7-day expected in',money(cashIn),'normal'],
                ['7-day expected out',money(cashOut),'normal'],
                ['7-day net',money(cashNet),cashNet<0?'warning':'normal'],
              ].map(([label,value,tone])=><div key={label} className="flex items-center justify-between gap-6 px-3 py-2.5"><dt className="text-sm text-muted-foreground">{label}</dt><dd className={cn('font-mono text-sm font-semibold tabular-nums',tone==='danger'&&'text-destructive',tone==='warning'&&'text-warning')}>{value}</dd></div>)}
            </dl>
            <div className="mt-auto flex gap-2 pt-4"><Link href="/billing" className={buttonVariants({variant:'outline',size:'sm'})}><Wallet/>Billing</Link><Link href="/cashflow" className={buttonVariants({variant:'outline',size:'sm'})}>Cashflow</Link></div>
          </CardContent>
        </Card>
      </div>
    </div>
  </AppShell>;
}

