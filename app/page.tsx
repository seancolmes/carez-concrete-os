import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {TodaySurface} from '@/components/today/TodaySurface';
import type {OverviewScheduleItem} from '@/components/today/TodaySurface';
import {createClient} from '@/lib/supabase/server';
import {getPourForecasts,pourForecastKey} from '@/lib/weather/pourForecast';

const money=(n:unknown)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:unknown)=>Number(n||0);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(date:string,n:number)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const fmtDate=(v:string)=>new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(`${v}T12:00:00`));
const fmtShortDate=(v?:string|null)=>v?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`)):'—';
const fmtTime=(v?:string|null)=>{if(!v)return '';const [h,m]=String(v).split(':').map(Number);const d=new Date();d.setHours(h,m||0,0,0);return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(d);};
const joinedProject=(item:any)=>Array.isArray(item?.projects)?item.projects[0]:item?.projects;
type AttentionTone='danger'|'warning'|'info';
type Attention={priority:number;tone:AttentionTone;subject:string;issue:string;when:string;href:string;action:string;urgent?:boolean;timestamp?:string;category?:string;facts?:{label:string;value:string}[]};
export default async function HomePage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');

  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const companyId=profile.company_id,start=today(),weekEnd=addDays(start,6),outlookEnd=addDays(start,13);
  const [
    {data:projects,error:projectsError},{data:workReady,error:workReadyError},{data:billing,error:billingError},{data:shifts},
    {data:schedule,error:scheduleError},{data:pours,error:poursError},{data:operationReady},{data:proposals,error:proposalsError},{data:leads,error:leadsError},
    {data:changeOrders,error:changeOrdersError},{data:dailyLogs,error:dailyLogsError},{data:timecards,error:timecardsError},{data:retainage,error:retainageError},{data:recentPours,error:recentPoursError}
  ]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status,next_action,city,state,contract_value,customers(name)').eq('company_id',companyId).in('status',['active','on_hold','planning']).order('created_at',{ascending:false}),
    supabase.from('project_work_readiness_summary').select('*').eq('company_id',companyId),
    supabase.from('project_billing_summary').select('*').eq('company_id',companyId),
    supabase.from('employee_shift_sessions').select('status').eq('company_id',companyId).in('status',['active','open','submitted']),
    supabase.from('work_schedule_items').select('id,project_id,title,schedule_date,start_time,status,item_type,crew_needed,pour_plan_id,work_package_operation_id,projects(id,job_number,name,city,state)').eq('company_id',companyId).gte('schedule_date',start).lte('schedule_date',outlookEnd).neq('status','cancelled').order('schedule_date').order('start_time'),
    supabase.from('pour_plans').select('id,project_id,name,scheduled_date,status,expected_concrete_yards,projects(id,job_number,name,city,state)').eq('company_id',companyId).gte('scheduled_date',start).lte('scheduled_date',outlookEnd).neq('status','cancelled').order('scheduled_date'),
    supabase.from('work_package_start_readiness').select('operation_id,ready_to_start_all,start_next_action,inspection_clear_count,inspection_count').eq('company_id',companyId),
    supabase.from('proposal_conversion_queue').select('estimate_id,presentation_id,proposal_number,customer_name,project_name,conversion_stage,next_action,follow_up_due,follow_up_due_now,base_sell_price').eq('company_id',companyId),
    supabase.from('leads').select('id,opportunity_number,customer_name,project_name,status,follow_up,bid_due').eq('company_id',companyId).not('status','in','("won","lost","closed")'),
    supabase.from('change_order_financial_summary').select('change_order_id,project_id,co_number,title,status,selected_sell_price,requested_date').eq('company_id',companyId),
    supabase.from('daily_logs').select('log_date,concrete_yards,delays_issues').eq('company_id',companyId).gte('log_date',addDays(start,-6)).lte('log_date',start),
    supabase.from('timecards').select('hours').eq('company_id',companyId).gte('work_date',addDays(start,-6)).lte('work_date',start),
    supabase.from('retainage_available_summary').select('project_id,available_to_release').eq('company_id',companyId),
    supabase.from('pour_plans').select('id,scheduled_date,expected_concrete_yards').eq('company_id',companyId).gte('scheduled_date',addDays(start,-6)).lte('scheduled_date',start).neq('status','cancelled'),
  ]);

  const readyMap=new Map((workReady||[]).map((row:any)=>[row.project_id,row]));
  const opReady=new Map((operationReady||[]).map((row:any)=>[row.operation_id,row]));

  const activeProjects=(projects||[]).map((project:any)=>{
    const r:any=readyMap.get(project.id)||{};
    const ready=num(r.ready_operations),blocked=num(r.blocked_operations),failed=num(r.failed_inspection_operations);
    const hardHold=failed>0||(blocked>0&&ready===0)||project.status==='on_hold';
    const state=hardHold?'hold':ready>0?'ready':'planning';
    const next=(schedule||[]).find((item:any)=>item.project_id===project.id&&item.item_type==='work');
    return {project,r,state,next};
  });

  const stateRank=(state:string)=>state==='hold'?0:state==='ready'?1:2;
  const dashboardJobs=[...activeProjects].sort((a:any,b:any)=>stateRank(a.state)-stateRank(b.state)||(a.next?.schedule_date||'9999').localeCompare(b.next?.schedule_date||'9999'));
  const timeReview=(shifts||[]).filter((row:any)=>row.status==='submitted').length;
  const ar=(billing||[]).reduce((sum:number,row:any)=>sum+Math.max(0,num(row.outstanding_ar)),0);
  const overdue=(billing||[]).reduce((sum:number,row:any)=>sum+Math.max(0,num(row.overdue_ar)),0);
  const todaySchedule=(schedule||[]).filter((item:any)=>item.schedule_date===start);
  const todayFieldWork=todaySchedule.filter((item:any)=>item.item_type==='work');

  const attention:Attention[]=[];
  for(const itemRaw of todayFieldWork){
    const item:any=itemRaw;
    if(!item.work_package_operation_id)continue;
    const r:any=opReady.get(item.work_package_operation_id);
    const job:any=joinedProject(item);
    if(r?.ready_to_start_all===false){
      attention.push({priority:1,tone:'danger',category:'Work hold',urgent:true,subject:`${job?.job_number||'Job'} · ${job?.name||item.title}`,issue:r.start_next_action||`${item.title} is not ready to start`,when:item.start_time?`Today · ${fmtTime(item.start_time)}`:'Today',href:'/field?view=readiness',action:'Clear hold'});
    }
  }

  for(const row of activeProjects){
    if(row.state!=='hold'||todayFieldWork.some((item:any)=>item.project_id===row.project.id))continue;
    const failed=num(row.r.failed_inspection_operations),blocked=num(row.r.blocked_operations);
    attention.push({priority:2,tone:'danger',category:failed>0?'Inspection hold':blocked>0?'Work hold':'Project hold',urgent:true,subject:`${row.project.job_number} · ${row.project.name}`,issue:failed>0?'Failed inspection is blocking the next operation':blocked>0?'Open physical work is blocked':row.project.next_action||'Project is on hold',when:row.next?.schedule_date?`Next field date · ${fmtShortDate(row.next.schedule_date)}`:'Before next operation',href:'/field?view=readiness',action:'Open readiness'});
  }

  if(timeReview)attention.push({priority:3,tone:'warning',category:'Time review',subject:'Field time review',issue:`${timeReview} submitted timecard${timeReview===1?' needs':'s need'} approval or correction.`,when:'Before payroll / job cost',href:'/field?view=time-review',action:'Review time'});
  if(overdue>0)attention.push({priority:4,tone:'warning',category:'A/R overdue',subject:'Accounts receivable',issue:`${money(overdue)} customer balance is past due.`,when:`${money(ar)} total outstanding`,href:'/financials?tab=billing&view=billing',action:'Open billing'});

  for(const proposal of proposals||[]){
    if(proposal.conversion_stage==='needs_reply')attention.push({priority:5,tone:'warning',category:'Proposal reply',urgent:Boolean(proposal.follow_up_due&&proposal.follow_up_due<start),subject:`${proposal.proposal_number} · ${proposal.customer_name||'Customer'}`,issue:proposal.next_action||`${proposal.project_name||'Proposal'} needs a response.`,when:proposal.follow_up_due?`Reply due · ${fmtShortDate(proposal.follow_up_due)}`:'Customer response waiting',href:`/opportunities?estimate=${proposal.estimate_id}&tab=proposal`,action:'Reply to customer'});
    else if(proposal.follow_up_due_now)attention.push({priority:6,tone:'info',category:'Proposal follow-up',subject:`Follow up · ${proposal.proposal_number}`,issue:`${proposal.customer_name||'Customer'} · ${proposal.project_name||'Proposal'}`,when:proposal.follow_up_due?`Due · ${fmtShortDate(proposal.follow_up_due)}`:'Due now',href:`/opportunities?estimate=${proposal.estimate_id}&tab=proposal`,action:'Follow up'});
  }

  for(const lead of leads||[]){
    if(lead.follow_up&&lead.follow_up<=start)attention.push({priority:7,tone:'info',category:'Lead follow-up',urgent:lead.follow_up<start,subject:`Lead · ${lead.customer_name||lead.opportunity_number}`,issue:lead.project_name||'Open opportunity needs follow-up.',when:`Due · ${fmtShortDate(lead.follow_up)}`,href:`/opportunities?lead=${lead.id}&tab=scope`,action:'Follow up lead'});
  }

  for(const order of changeOrders||[]){
    if(order.status!=='submitted')continue;
    const project=(projects||[]).find(row=>row.id===order.project_id);
    attention.push({priority:4.5,tone:'warning',category:'Change order',subject:[order.co_number,project?.name].filter(Boolean).join(' · ')||'Change order',issue:`${order.title||'Submitted scope change'} awaits a decision.`,when:order.requested_date?`Requested ${fmtShortDate(order.requested_date)}`:'Decision pending',href:'/change-orders',action:'Open change orders',facts:[{label:'Amount',value:money(order.selected_sell_price)},{label:'Status',value:'Submitted'},{label:'Scope',value:order.title||'Not recorded'},{label:'Project',value:project?.name||'Open change orders'}]});
  }

  attention.sort((a,b)=>a.priority-b.priority);
  const openProposals=(proposals||[]).filter((row:any)=>['sent','viewed','needs_reply'].includes(row.conversion_stage));
  const openProposalValue=openProposals.reduce((sum:number,row:any)=>sum+num(row.base_sell_price),0);
  const planningJobs=scheduleError?[]:dashboardJobs.filter((row:any)=>!row.next).slice(0,5);
  const linkedPourIds=new Set((schedule||[]).flatMap((item:any)=>item.pour_plan_id?[item.pour_plan_id]:[]));
  const unlinkedPours=poursError?[]:(pours||[]).filter((pour:any)=>!linkedPourIds.has(pour.id));
  const pourById=new Map((pours||[]).map((pour:any)=>[pour.id,pour]));
  const pourLocations=[
    ...(schedule||[]).filter((item:any)=>item.item_type==='pour'||item.pour_plan_id).map((item:any)=>{const project:any=joinedProject(item);return {city:project?.city||null,state:project?.state||null,date:item.schedule_date};}),
    ...unlinkedPours.map((pour:any)=>{const project:any=joinedProject(pour);return {city:project?.city||null,state:project?.state||null,date:pour.scheduled_date};}),
  ];
  const forecasts=await getPourForecasts(pourLocations);
  const scheduleItems:OverviewScheduleItem[]=(schedule||[]).map((item:any)=>{
    const project:any=joinedProject(item);
    const isPour=item.item_type==='pour'||Boolean(item.pour_plan_id);
    const linkedPour:any=item.pour_plan_id?pourById.get(item.pour_plan_id):null;
    const readiness:any=item.work_package_operation_id?opReady.get(item.work_package_operation_id):null;
    return {id:String(item.id),projectId:item.project_id,date:item.schedule_date,day:fmtShortDate(item.schedule_date),time:fmtTime(item.start_time)||'Time pending',sortTime:item.start_time||'99:99',project:`${project?.job_number||'Job'} · ${project?.name||'Project'}`,title:item.title||'Scheduled work',type:isPour?'pour':item.item_type||'work',status:String(item.status||'planned').replaceAll('_',' '),yards:linkedPour?.expected_concrete_yards==null?null:num(linkedPour.expected_concrete_yards),crewNeeded:item.crew_needed==null?null:num(item.crew_needed),href:'/field?view=schedule',location:[project?.city,project?.state].filter(Boolean).join(', ')||null,forecast:isPour?forecasts.get(pourForecastKey({city:project?.city||null,state:project?.state||null,date:item.schedule_date}))||null:null,readiness:readiness?{status:readiness.ready_to_start_all?'ready':'hold',inspectionClear:num(readiness.inspection_clear_count),inspectionCount:num(readiness.inspection_count),nextAction:readiness.start_next_action||null}:null};
  });
  for (const pour of unlinkedPours) {
    const project:any=joinedProject(pour);
    scheduleItems.push({id:`pour-${pour.id}`,projectId:pour.project_id,date:pour.scheduled_date,day:fmtShortDate(pour.scheduled_date),time:'Time pending',sortTime:'99:99',project:`${project?.job_number||'Job'} · ${project?.name||'Project'}`,title:pour.name||'Planned concrete pour',type:'pour',status:'Pour plan',yards:pour.expected_concrete_yards==null?null:num(pour.expected_concrete_yards),crewNeeded:null,href:'/field?view=schedule',location:[project?.city,project?.state].filter(Boolean).join(', ')||null,forecast:forecasts.get(pourForecastKey({city:project?.city||null,state:project?.state||null,date:pour.scheduled_date}))||null});
  }
  scheduleItems.sort((a,b)=>a.date.localeCompare(b.date)||a.sortTime.localeCompare(b.sortTime));

  const openOrders=(changeOrders||[]).filter(order=>order.status==='draft'||order.status==='submitted');
  const submittedOrders=openOrders.filter(order=>order.status==='submitted');
  const openOrderValue=openOrders.reduce((sum,order)=>sum+num(order.selected_sell_price),0);
  const billingByProject=new Map((billing||[]).map(row=>[row.project_id,row]));
  const projectJobs=dashboardJobs.filter(row=>row.project.status==='active'||row.project.status==='on_hold');
  const activeJobRows=projectJobs.map(row=>{
    const project=row.project;
    const customer=Array.isArray(project.customers)?project.customers[0]:project.customers;
    const nextPour=scheduleItems.find(item=>item.type==='pour'&&item.projectId===project.id);
    const bill=billingByProject.get(project.id);
    const exposure=openOrders.filter(order=>order.project_id===project.id).reduce((sum,order)=>sum+num(order.selected_sell_price),0);
    const billedPercent=!billingError&&bill&&num(project.contract_value)>0?num(bill.billed_amount)/num(project.contract_value)*100:null;
    return {id:project.id,number:project.job_number||'Job',name:project.name||'Unnamed job',customer:customer?.name||'Customer not linked',location:[project.city,project.state].filter(Boolean).join(', ')||'Location not entered',nextPour:nextPour?`${nextPour.day} · ${nextPour.title}`:'—',contract:project.contract_value==null?'—':money(project.contract_value),contractValue:project.contract_value==null?null:num(project.contract_value),billing:billingError?'Unavailable':bill?money(bill.billed_amount):'—',billedPercent,coExposure:changeOrdersError?'—':exposure?money(exposure):'—',coExposureValue:changeOrdersError?null:exposure,status:row.state};
  });
  const placedYards=dailyLogsError?null:(dailyLogs||[]).reduce((sum,log)=>sum+num(log.concrete_yards),0);
  const crewHours=timecardsError?null:(timecards||[]).reduce((sum,card)=>sum+num(card.hours),0);
  const fieldExceptions=dailyLogsError?null:(dailyLogs||[]).filter(log=>Boolean(log.delays_issues?.trim())).length;
  const retained=retainageError?null:(retainage||[]).reduce((sum,row)=>sum+num(row.available_to_release),0);
  const retainedProjects=new Set((retainage||[]).filter(row=>num(row.available_to_release)>0).map(row=>row.project_id)).size;
  const contractBacklog=billingError?null:projectJobs.reduce((sum,row)=>sum+num(billingByProject.get(row.project.id)?.unbilled_contract),0);
  const commercialAction=attention.find(item=>item.subject==='Accounts receivable'||item.category==='Change order')||null;
  const weekPours=scheduleItems.filter(item=>item.type==='pour'&&item.date<=weekEnd);
  const knownWeekPours=weekPours.filter(item=>item.yards!==null);
  const fieldSeries=Array.from({length:7},(_,index)=>{const date=addDays(start,index-6),dayPours=(recentPours||[]).filter(pour=>pour.scheduled_date===date);return {date,label:fmtShortDate(date),yards:(dailyLogs||[]).filter(log=>log.log_date===date).reduce((sum,log)=>sum+num(log.concrete_yards),0),plannedYards:recentPoursError||dayPours.some(pour=>pour.expected_concrete_yards==null)?null:dayPours.reduce((sum,pour)=>sum+num(pour.expected_concrete_yards),0)};});
  const dueLeads=(leads||[]).filter(lead=>lead.bid_due&&lead.bid_due>=start&&lead.bid_due<=weekEnd).sort((a,b)=>String(a.bid_due).localeCompare(String(b.bid_due)));
  const bidDueQueue=dueLeads.slice(0,3).map(lead=>({title:[lead.opportunity_number,lead.project_name||lead.customer_name||'Bid'].filter(Boolean).join(' · '),due:fmtShortDate(lead.bid_due),href:`/opportunities?lead=${lead.id}&tab=scope`}));
  const followUpProposals=(proposals||[]).filter(row=>row.follow_up_due&&row.follow_up_due>=start&&row.follow_up_due<=weekEnd).sort((a,b)=>String(a.follow_up_due).localeCompare(String(b.follow_up_due)));
  const bidQueue=followUpProposals.slice(0,3).map(row=>({title:`${row.proposal_number} · ${row.project_name||row.customer_name||'Proposal'}`,due:fmtShortDate(row.follow_up_due),href:`/opportunities?estimate=${row.estimate_id}&tab=proposal`}));
  const refreshedAt=new Date();

  return <AppShell userName={profile!.full_name||user!.email||'Owner'}>
    <TodaySurface
      date={fmtDate(start)}
      dateISO={start}
      refreshedAt={refreshedAt.toISOString()}
      refreshedLabel={new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(refreshedAt)}
      weekEnd={fmtShortDate(weekEnd)}
      outlookEnd={fmtShortDate(outlookEnd)}
      attention={attention}
      attentionUnavailable={Boolean(workReadyError||billingError||proposalsError||leadsError||changeOrdersError)}
      scheduleItems={scheduleItems}
      scheduleUnavailable={Boolean(scheduleError)}
      pourDataUnavailable={Boolean(poursError)}
      planningJobs={planningJobs.map((row:any)=>({id:String(row.project.id),project:`${row.project.job_number} · ${row.project.name}`,nextAction:row.project.next_action||'Plan next work',held:row.state==='hold',href:row.state==='hold'?'/field?view=readiness':'/projects/'+row.project.id}))}
      operationalMetrics={[
        {label:'Bids due / 7D',value:leadsError?'—':String(dueLeads.length),detail:leadsError?'Unavailable':'Open opportunities',href:'/opportunities'},
        {label:'Active jobs',value:projectsError?'—':String(projectJobs.length),detail:projectsError?'Unavailable':`${money(projectJobs.reduce((sum,row)=>sum+num(row.project.contract_value),0))} contract`,href:'/projects'},
        {label:'Concrete / 7D',value:poursError||scheduleError||(!knownWeekPours.length&&weekPours.length)?'—':`${knownWeekPours.reduce((sum,pour)=>sum+num(pour.yards),0).toLocaleString()} CY`,detail:poursError||scheduleError?'Unavailable':`${weekPours.length} pour windows${knownWeekPours.length<weekPours.length?' · some CY missing':''}`,href:'/field?view=schedule'},
        {label:'Open CO exposure',value:changeOrdersError?'—':money(openOrderValue),detail:changeOrdersError?'Unavailable':`${openOrders.length} open · ${submittedOrders.length} submitted`,href:'/change-orders'},
        {label:'Earned / unbilled',value:'—',detail:'Billing progress unavailable',href:'/financials?tab=billing&view=billing'},
        {label:'A/R overdue',value:billingError?'—':money(overdue),detail:billingError?'Unavailable':'Past due customer balance',tooltip:billingError?undefined:`${money(ar)} total A/R`,href:'/financials?tab=billing&view=billing'},
      ]}
      activeJobs={projectsError?null:activeJobRows}
      fieldMetrics={[
        {label:'Concrete placed',value:placedYards==null?'—':`${placedYards.toLocaleString(undefined,{maximumFractionDigits:2})} CY`,detail:placedYards==null?'Unavailable':'Recorded in daily logs',href:'/field?view=production'},
        {label:'Crew hours',value:crewHours==null?'—':`${crewHours.toLocaleString(undefined,{maximumFractionDigits:1})} hrs`,detail:crewHours==null?'Unavailable':'Recorded timecards',href:'/field?view=time-review'},
        {label:'Pour windows',value:recentPoursError?'—':String((recentPours||[]).length),detail:recentPoursError?'Unavailable':'Scheduled in last 7 days',href:'/field?view=deliveries'},
        {label:'Exceptions',value:fieldExceptions==null?'—':String(fieldExceptions),detail:fieldExceptions==null?'Unavailable':'Daily logs needing review',href:'/field?view=production'},
      ]}
      fieldSeries={dailyLogsError?null:fieldSeries}
      bidQueue={proposalsError?null:bidQueue}
      bidDueQueue={leadsError?null:bidDueQueue}
      pipelineSummary={{count:openProposals.length,value:money(openProposalValue),bidsDue:dueLeads.length,dueThisWeek:followUpProposals.length,unavailable:Boolean(proposalsError||leadsError)}}
      commercialMetrics={[
        {label:'Earned / unbilled',value:'—',detail:'Billing progress unavailable',href:'/financials?tab=billing&view=billing'},
        {label:'A/R outstanding',value:billingError?'—':money(ar),detail:billingError?'Unavailable':`${money(overdue)} overdue`,href:'/financials?tab=billing&view=billing'},
        {label:'Open CO exposure',value:changeOrdersError?'—':money(openOrderValue),detail:changeOrdersError?'Unavailable':`${submittedOrders.length} submitted`,href:'/change-orders'},
        {label:'Retainage held',value:retained==null?'—':money(retained),detail:retained==null?'Unavailable':`${retainedProjects} projects · unreleased`,href:'/financials?tab=billing&view=billing'},
        {label:'Contract backlog',value:contractBacklog==null?'—':money(contractBacklog),detail:contractBacklog==null?'Unavailable':'Active unbilled contract',href:'/financials?tab=billing&view=billing'},
        {label:'A/R overdue',value:billingError?'—':money(overdue),detail:billingError?'Unavailable':'Past due customer balance',href:'/financials?tab=billing&view=billing'},
      ]}
      commercialAction={commercialAction?{title:commercialAction.subject,detail:commercialAction.issue,href:commercialAction.href,label:commercialAction.action}:null}
    />
  </AppShell>;

}

