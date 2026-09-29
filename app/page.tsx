import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {TodaySurface} from '@/components/today/TodaySurface';
import {createClient} from '@/lib/supabase/server';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(date:string,n:number)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const fmtDate=(v:string)=>new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(`${v}T12:00:00`));
const fmtShortDate=(v?:string|null)=>v?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`)):'—';
const fmtTime=(v?:string|null)=>{if(!v)return '';const [h,m]=String(v).split(':').map(Number);const d=new Date();d.setHours(h,m||0,0,0);return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(d);};
const joinedProject=(item:any)=>Array.isArray(item?.projects)?item.projects[0]:item?.projects;
const joinedCustomer=(project:any)=>Array.isArray(project?.customers)?project.customers[0]:project?.customers;
type AttentionTone='danger'|'warning'|'info';
type Attention={priority:number;tone:AttentionTone;subject:string;issue:string;when:string;href:string;action:string;urgent?:boolean;timestamp?:string;};
export default async function HomePage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');

  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const companyId=profile.company_id,start=today(),weekEnd=addDays(start,6);
  const [
    {data:projects,error:projectsError},{data:workReady,error:workReadyError},{data:budgets},{data:billing,error:billingError},{data:shifts,error:shiftsError},
    {data:schedule,error:scheduleError},{data:operationReady},{data:proposals},{data:leads},{data:cash,error:cashError}
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
      attention.push({priority:1,tone:'danger',urgent:true,subject:`${job?.job_number||'Job'} · ${job?.name||item.title}`,issue:r.start_next_action||`${item.title} is not ready to start`,when:item.start_time?`Today · ${fmtTime(item.start_time)}`:'Today',href:'/field?view=readiness',action:'Clear hold'});
    }
  }

  for(const row of activeProjects){
    if(row.state!=='hold'||todayFieldWork.some((item:any)=>item.project_id===row.project.id))continue;
    const failed=num(row.r.failed_inspection_operations),blocked=num(row.r.blocked_operations);
    attention.push({priority:2,tone:'danger',urgent:true,subject:`${row.project.job_number} · ${row.project.name}`,issue:failed>0?'Failed inspection is blocking the next operation':blocked>0?'Open physical work is blocked':row.project.next_action||'Project is on hold',when:row.next?.schedule_date?`Next field date · ${fmtShortDate(row.next.schedule_date)}`:'Before next operation',href:'/field?view=readiness',action:'Open readiness'});
  }

  if(timeReview)attention.push({priority:3,tone:'warning',subject:'Field time review',issue:`${timeReview} submitted timecard${timeReview===1?' needs':'s need'} approval or correction.`,when:'Before payroll / job cost',href:'/field?view=time-review',action:'Review time'});
  if(overdue>0)attention.push({priority:4,tone:'warning',subject:'Accounts receivable',issue:`${money(overdue)} customer balance is past due.`,when:`${money(ar)} total outstanding`,href:'/financials?tab=billing&view=billing',action:'Open billing'});

  for(const proposal of proposals||[]){
    if(proposal.conversion_stage==='needs_reply')attention.push({priority:5,tone:'warning',urgent:Boolean(proposal.follow_up_due&&proposal.follow_up_due<start),subject:`${proposal.proposal_number} · ${proposal.customer_name||'Customer'}`,issue:proposal.next_action||`${proposal.project_name||'Proposal'} needs a response.`,when:proposal.follow_up_due?`Reply due · ${fmtShortDate(proposal.follow_up_due)}`:'Customer response waiting',href:`/opportunities?estimate=${proposal.estimate_id}&tab=proposal`,action:'Reply to customer'});
    else if(proposal.follow_up_due_now)attention.push({priority:6,tone:'info',subject:`Follow up · ${proposal.proposal_number}`,issue:`${proposal.customer_name||'Customer'} · ${proposal.project_name||'Proposal'}`,when:proposal.follow_up_due?`Due · ${fmtShortDate(proposal.follow_up_due)}`:'Due now',href:`/opportunities?estimate=${proposal.estimate_id}&tab=proposal`,action:'Follow up'});
  }

  for(const lead of leads||[]){
    if(lead.follow_up&&lead.follow_up<=start)attention.push({priority:7,tone:'info',urgent:lead.follow_up<start,subject:`Lead · ${lead.customer_name||lead.opportunity_number}`,issue:lead.project_name||'Open opportunity needs follow-up.',when:`Due · ${fmtShortDate(lead.follow_up)}`,href:`/opportunities?lead=${lead.id}&tab=scope`,action:'Follow up lead'});
  }

  for(const event of cash||[]){
    if(event.urgency==='overdue'||event.urgency==='critical')attention.push({priority:8,tone:'warning',urgent:true,subject:'Cashflow',issue:event.description||'Cash obligation needs attention.',when:`${fmtShortDate(event.event_date)} · ${num(event.cash_out)>0?`${money(event.cash_out)} out`:`${money(event.cash_in)} in`}`,href:'/financials?tab=ledger&view=ledger',action:'Review cashflow'});
  }
  attention.sort((a,b)=>a.priority-b.priority);
  const openProposals=(proposals||[]).filter((row:any)=>['sent','viewed','needs_reply'].includes(row.conversion_stage));
  const openProposalValue=openProposals.reduce((sum:number,row:any)=>sum+num(row.base_sell_price),0);
  const openLeads=(leads||[]).length;
  const followUps=[
    ...(proposals||[]).filter((row:any)=>row.follow_up_due).map((row:any)=>({date:row.follow_up_due,label:`${row.proposal_number} · ${row.customer_name||row.project_name||'Proposal'}`,href:`/opportunities?estimate=${row.estimate_id}&tab=proposal`})),
    ...(leads||[]).filter((row:any)=>row.follow_up).map((row:any)=>({date:row.follow_up,label:[row.opportunity_number,row.customer_name||row.project_name||'Lead'].filter(Boolean).join(' · '),href:`/opportunities?lead=${row.id}&tab=scope`})),
  ].sort((a:any,b:any)=>String(a.date).localeCompare(String(b.date)));
  const nextFollowUp=followUps[0]||null;

  const operations=dashboardJobs.filter((row:any)=>row.next).slice(0,8).map((row:any)=>{
    const p=row.project;
    const status=row.state==='hold'?'HOLD':row.state==='ready'?'READY':'PLANNED';
    return {id:p.id,time:fmtTime(row.next?.start_time)||fmtShortDate(row.next?.schedule_date),project:`${p.job_number} · ${p.name}`,operation:row.next?.title||p.next_action||'Plan next work',quantity:'—',status,tone:row.state==='hold'?'blocked' as const:row.state==='ready'?'success' as const:'neutral' as const,href:row.state==='hold'?'/field?view=readiness':'/projects/'+p.id};
  });
  const planningJobs=dashboardJobs.filter((row:any)=>!row.next).slice(0,5);
  const cashStatus=cashError?'Unavailable':openCash.length?money(cashNet):'No events';
  const statusMetrics=[
    {label:'Ready to move',value:projectsError||workReadyError?null:jobsReady,detail:'Projects with an operation ready to start',tone:jobsReady>0?'success':'neutral'},
    {label:'Field active',value:shiftsError?null:activeFieldJobs,detail:'Projects with an open field shift',tone:'neutral'},
    {label:'Hard holds',value:projectsError||workReadyError?null:jobsHeld,detail:'Projects blocked from starting work',tone:jobsHeld>0?'danger':'neutral'},
    {label:'Customers owe',value:billingError?null:ar,prefix:'$',detail:'Outstanding customer balance',tone:'neutral'},
    {label:'7-day cash',value:cashError?null:Math.abs(cashNet),prefix:cashNet<0?'−$':'$',detail:openCash.length?`Open cash in less cash out · ${fmtShortDate(start)}–${fmtShortDate(weekEnd)}`:'No scheduled cash events',tone:cashNet<0?'warning':'neutral'},
  ] as const;

  return <AppShell userName={profile!.full_name||user!.email||'Owner'}>
    <TodaySurface
      date={fmtDate(start)}
      dateISO={start}
      weekEnd={fmtShortDate(weekEnd)}
      attention={attention}
      fieldWork={todayFieldWork.map((item:any)=>{const project:any=joinedProject(item);return {id:String(item.id),project:`${project?.job_number||'Job'} · ${project?.name||'Project'}`,title:item.title,time:fmtTime(item.start_time)||'Time pending',href:item.project_id?'/projects/'+item.project_id:'/field?view=schedule'};})}
      scheduleUnavailable={Boolean(scheduleError)}
      operations={operations}
      planningJobs={planningJobs.map((row:any)=>({id:String(row.project.id),project:`${row.project.job_number} · ${row.project.name}`,nextAction:row.project.next_action||'Plan next work',held:row.state==='hold',href:row.state==='hold'?'/field?view=readiness':'/projects/'+row.project.id}))}
      metrics={statusMetrics}
      openLeads={String(openLeads)}
      openProposals={String(openProposals.length)}
      proposalValue={money(openProposalValue)}
      nextFollowUp={nextFollowUp?`${nextFollowUp.label} · ${fmtShortDate(nextFollowUp.date)}`:'None scheduled'}
      customersOwe={billingError?'Unavailable':money(ar)}
      expectedIn={cashError?'Unavailable':openCash.length?money(cashIn):'No events'}
      expectedOut={cashError?'Unavailable':openCash.length?money(cashOut):'No events'}
      cashNet={cashStatus}
    />
  </AppShell>;

}

