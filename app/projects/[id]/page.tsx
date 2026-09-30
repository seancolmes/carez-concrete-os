import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {CarezOperatingMetric,CarezOperatingMetricStrip} from '@/components/carez/operating-metric';
import {CarezRecordHeader} from '@/components/carez/record-header';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Badge,Button,MessageBar,MessageBarBody,MessageBarTitle,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/server';
import {resolveProjectRecordStatus} from '@/lib/ui/operations';
import type {CarezStatusTone} from '@/lib/ui/state';
import {cn} from '@/lib/utils';
import {DeleteProjectButton} from '@/components/projects/DeleteProjectButton';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const pct=(n:any)=>`${num(n).toFixed(1)}%`;
const hrs=(n:any)=>`${num(n).toFixed(1)} hr`;
const statusColor=(tone:CarezStatusTone):'danger'|'warning'|'success'|'informative'=>tone==='error'||tone==='blocked'?'danger':tone==='warning'?'warning':tone==='success'?'success':'informative';

type ProjectWarning={tone:'watch'|'bad';title:string;copy:string;href:string;action:string};
const projectTabs=['overview','commercial-baseline','scope-specs','activity'] as const;
type ProjectTab=(typeof projectTabs)[number];

function KeyValueRows({rows}:{rows:Array<[string,string]>}){
 return <dl className="divide-y divide-border">{rows.map(([label,value])=><div className="flex items-center justify-between gap-4 py-2.5 text-sm" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-mono font-medium tabular-nums">{value}</dd></div>)}</dl>;
}

export default async function ProjectCommandPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string}>}){
 const {id}=await params;
 const requested=(await searchParams).tab;
 const tab:ProjectTab=projectTabs.find(value=>value===requested)||'overview';
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).maybeSingle();
 if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
 const projectR=await supabase.from('projects').select('*,customers(name,contact_name,phone,email)').eq('id',id).eq('company_id',profile.company_id).maybeSingle();
 const p:any=projectR.data;if(!p)notFound();
 // Summary data serves the always-visible command center; detail queries run for the selected tab only.
 const [financialR,budgetR,billingR,commitR,forecastR,prodR,shiftR,coR,pourR,authorizedContractR]=await Promise.all([
  tab==='commercial-baseline'?supabase.from('project_financial_summary').select('*').eq('project_id',id).maybeSingle():Promise.resolve({data:null,error:null}),
  supabase.from('project_budget_actual_summary').select('*').eq('project_id',id).maybeSingle(),
  supabase.from('project_billing_summary').select('*').eq('project_id',id).maybeSingle(),
  tab==='commercial-baseline'?supabase.from('project_commitment_summary').select('*').eq('project_id',id).maybeSingle():Promise.resolve({data:null,error:null}),
  supabase.from('project_cost_to_complete_summary').select('*').eq('project_id',id).maybeSingle(),
  tab==='activity'?supabase.from('production_rate_history').select('*').eq('project_id',id).order('work_date',{ascending:false}).limit(12):Promise.resolve({data:[],error:null}),
  tab==='overview'||tab==='activity'?supabase.from('employee_shift_sessions').select('id,status,work_date,clock_in_inside_geofence,clock_out_inside_geofence,crew_members(name)').eq('project_id',id).in('status',['open','submitted']).order('work_date',{ascending:false}):Promise.resolve({data:[],error:null}),
  tab==='overview'||tab==='commercial-baseline'?supabase.from('change_orders').select('id,co_number,title,status,field_work_status,proposed_sell_price,requested_date').eq('project_id',id).in('status',['draft','submitted','approved']).order('requested_date',{ascending:false}):Promise.resolve({data:[],error:null}),
  tab==='overview'||tab==='activity'?supabase.from('pour_plans').select('id,name,scheduled_date,expected_concrete_yards,status').eq('project_id',id).not('status','eq','cancelled').order('scheduled_date',{ascending:true}):Promise.resolve({data:[],error:null}),
  supabase.from('project_authorized_contract_summary').select('original_contract_value,authorized_contract_value').eq('project_id',id).maybeSingle()
 ]);
 const [awardR,baselineR]=(tab==='commercial-baseline'||tab==='scope-specs')&&p.award_decision_id?await Promise.all([
  supabase.from('award_decisions').select('id,proposal_revision_id,estimate_id,decided_at').eq('id',p.award_decision_id).eq('company_id',profile.company_id).maybeSingle(),
  supabase.from('commercial_baselines').select('id,total_direct_cost,total_sell,accepted_scope_snapshot_id,proposal_revision_id').eq('project_id',id).eq('company_id',profile.company_id).maybeSingle(),
 ]):[{data:null},{data:null}];
 const sourceProposal=awardR.data?.proposal_revision_id?await supabase.from('proposal_presentations').select('proposal_number').eq('id',awardR.data.proposal_revision_id).eq('company_id',profile.company_id).maybeSingle():{data:null};
 const financialAvailable=Boolean(financialR.data);
 const budgetAvailable=Boolean(budgetR.data);
 const billingAvailable=Boolean(billingR.data);
 const commitmentAvailable=Boolean(commitR.data);
 const forecastAvailable=Boolean(forecastR.data);
 const f:any=financialR.data||{},b:any=budgetR.data||{},bill:any=billingR.data||{},commit:any=commitR.data||{},fc:any=forecastR.data||{};
 const prod:any[]=prodR.data||[],shifts:any[]=shiftR.data||[],cos:any[]=coR.data||[],pours:any[]=pourR.data||[];
 const waiting=shifts.filter(s=>s.status==='submitted');const clocked=shifts.filter(s=>s.status==='open');const gpsFlags=shifts.filter(s=>s.clock_in_inside_geofence===false||s.clock_out_inside_geofence===false).length;
 const budgetUsed=num(b.budget_cost_used_percent);const laborUsed=num(b.budget_labor_hours)>0?num(b.actual_labor_hours)/num(b.budget_labor_hours)*100:0;
 const forecastVariance=num(fc.forecast_variance_to_budget);const forecastMargin=num(fc.forecast_margin_at_completion);const targetMargin=num(f.target_margin_percent||p.target_margin_percent);
 const activeCO=cos.filter(c=>c.status!=='approved').length;const approvedCO=cos.filter(c=>c.status==='approved').length;
 const nextPour=pours.find(x=>x.scheduled_date&&new Date(`${x.scheduled_date}T23:59:59`).getTime()>=Date.now())||pours[0];
 const warnings:ProjectWarning[]=[];
 if(waiting.length)warnings.push({tone:'watch',title:`${waiting.length} timecard${waiting.length===1?'':'s'} waiting for approval`,copy:'Review employee GPS, hours and tasks before payroll/job cost.',href:'/field?view=time-review',action:'Review Time'});
 if(gpsFlags)warnings.push({tone:'bad',title:`${gpsFlags} open/submitted shift${gpsFlags===1?'':'s'} need GPS review`,copy:'At least one clock-in or clock-out is outside the jobsite radius.',href:'/field?view=time-review',action:'Check GPS'});
 if(num(b.labor_hours_remaining)<0)warnings.push({tone:'bad',title:`Labor is ${Math.abs(num(b.labor_hours_remaining)).toFixed(1)} hours over budget`,copy:'Remaining work needs a production plan before more labor is burned.',href:'/forecast',action:'Review Forecast'});
 if(budgetUsed>=85&&budgetUsed<100)warnings.push({tone:'watch',title:`Job has used ${budgetUsed.toFixed(1)}% of its cost budget`,copy:'Check remaining scope, material commitments and labor before proceeding.',href:'/forecast',action:'Review Job'});
 if(budgetUsed>=100)warnings.push({tone:'bad',title:'Job cost is over the frozen budget',copy:`Current true company cost exceeds the approved baseline by ${money(Math.abs(num(b.total_cost_remaining)))}.`,href:'/forecast',action:'Review Overrun'});
 if(num(bill.overdue_ar)>0)warnings.push({tone:'bad',title:`Customer has ${money(bill.overdue_ar)} past due`,copy:'Collections need attention before more cash is committed.',href:'/financials?tab=billing&view=billing',action:'Review Billing'});
 if(activeCO)warnings.push({tone:'watch',title:`${activeCO} change order${activeCO===1?' is':'s are'} not approved`,copy:'Track extra work carefully so unapproved scope does not become free work.',href:'/change-orders',action:'Review COs'});

 const projectStatus=resolveProjectRecordStatus(p.status);
 const costRows=[
  ['Labor',num(b.actual_direct_labor_cost),num(b.budget_direct_labor_cost)],
  ['Materials',num(b.actual_material_cost),num(b.budget_material_cost)],
  ['Equipment',num(b.actual_equipment_cost),num(b.budget_equipment_cost)],
  ['Subs / Other',num(b.actual_subcontractor_cost)+num(b.actual_other_direct_cost),num(b.budget_subcontractor_cost)+num(b.budget_other_direct_cost)],
  ['Total Company Cost',num(b.actual_total_company_cost),num(b.budget_total_company_cost)],
 ] as const;

 return <AppShell userName={profile.full_name||user.email||'Owner'}>
  <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-3 text-foreground lg:h-full lg:min-h-0 lg:overflow-hidden">
   <div className="shrink-0"><CarezRecordHeader
    eyebrow={<span className="font-mono text-xs font-semibold text-muted-foreground">{p.job_number}</span>}
    title={p.name}
    description={<>{[p.address,p.city,p.state].filter(Boolean).join(', ')||'Job address not entered'}{p.customers?.name?' · '+p.customers.name:''}</>}
    status={<Badge appearance="outline" color={projectStatus?statusColor(projectStatus.tone):'informative'}>{projectStatus?.label||String(p.status||'Unknown')}</Badge>}
    actions={<>
     <Button as="a" appearance="primary" size="small" href="/field?view=time-review">Review Crew Time</Button>
     <Button as="a" appearance="outline" size="small" href="/field?view=production">Production</Button>
    </>}
   /></div>

   <section aria-label="Project command center" className="shrink-0">
    <CarezOperatingMetricStrip columns={5}>
     <CarezOperatingMetric label="Authorized Contract" value={money(authorizedContractR.data?.authorized_contract_value??p.contract_value)} help="Original contract plus approved changes."/>
     <CarezOperatingMetric label="Forecast Margin" value={forecastAvailable&&fc.project_id?pct(forecastMargin):'Need Progress'} help={forecastAvailable&&fc.project_id?'At completion.':'Update scope progress to build a forecast.'}/>
     <CarezOperatingMetric label="Forecast Variance" value={forecastAvailable&&fc.project_id?money(forecastVariance):'Unavailable'} help="Against the approved budget." tone={!forecastAvailable||!fc.project_id?'neutral':forecastVariance<0?'error':'neutral'}/>
     <CarezOperatingMetric label="Budget Used" value={budgetAvailable?pct(budgetUsed):'No Budget'} help={budgetAvailable?`${money(b.actual_total_company_cost)} actual company cost.`:'Approve an estimate to establish the baseline.'} tone={!budgetAvailable?'neutral':budgetUsed>=100?'error':budgetUsed>=85?'warning':'neutral'}/>
     <CarezOperatingMetric label="Customer Owes Us" value={billingAvailable?money(bill.outstanding_ar):'Unavailable'} help={billingAvailable?`${money(bill.overdue_ar)} past due.`:'Billing summary unavailable.'} tone={!billingAvailable?'neutral':num(bill.overdue_ar)>0?'error':'neutral'}/>
    </CarezOperatingMetricStrip>
   </section>

   <nav aria-label="Project sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-card px-2 py-1">
    {projectTabs.map(value=><Button key={value} as="a" href={`/projects/${id}?tab=${value}`} appearance={tab===value?'primary':'subtle'} size="small" aria-current={tab===value?'page':undefined}>
     {{overview:'Overview','commercial-baseline':'Commercial Baseline','scope-specs':'Scope & Specs',activity:'Activity'}[value]}
    </Button>)}
   </nav>

   <div className="min-h-0 flex-1 overflow-auto pr-1">
   {(tab==='commercial-baseline'||tab==='scope-specs')&&p.job_spine_id&&<Accordion collapsible className="rounded-lg border border-border bg-card" aria-label="Commercial handoff lineage"><AccordionItem value="lineage"><AccordionHeader size="small">Awarded scope and baseline</AccordionHeader><AccordionPanel><div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 xl:grid-cols-4">
    <div><p className="text-xs text-muted-foreground">Job Spine</p><p className="mt-1 break-all font-mono text-xs">{p.job_spine_id}</p></div>
    <div><p className="text-xs text-muted-foreground">Awarded Proposal</p><p className="mt-1 text-sm font-medium">{sourceProposal.data?.proposal_number||'No Award Decision'}</p>{awardR.data?.proposal_revision_id&&<Link className="text-xs text-primary underline" href={`/opportunities?estimate=${awardR.data.estimate_id}&tab=proposal`}>Open exact revision</Link>}</div>
    <div><p className="text-xs text-muted-foreground">Accepted Scope Snapshot</p><p className="mt-1 break-all font-mono text-xs">{baselineR.data?.accepted_scope_snapshot_id||'Not recorded'}</p></div>
    <div><p className="text-xs text-muted-foreground">Frozen Commercial Baseline</p><p className="mt-1 text-sm font-medium">{baselineR.data?`Direct Cost ${money(baselineR.data.total_direct_cost)} · Sell ${money(baselineR.data.total_sell)}`:'Not recorded'}</p></div>
   </div></AccordionPanel></AccordionItem></Accordion>}

   <div className="flex flex-col gap-6">
    {tab==='overview'&&<section className="space-y-3" aria-labelledby="project-next-action-heading">
      <div className="border-l-2 border-border bg-card px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Next project action</div>
      <h2 id="project-next-action-heading" className="mt-2 text-lg font-semibold tracking-tight">{p.next_action||'No next action entered yet.'}</h2>
      <p className="mt-1 text-sm text-muted-foreground">The next physical or management action recorded for this project.</p>
     </div>
     <div className="flex flex-wrap gap-2" aria-label="Related project work">
      <Button as="a" appearance="outline" size="small" href="/field?view=schedule">Schedule</Button>
      <Button as="a" appearance="outline" size="small" href="/field?view=work-packages">Work plan</Button>
      <Button as="a" appearance="outline" size="small" href="/documents">Documents</Button>
     </div>
    </section>}
    {tab==='overview'&&<section className="space-y-3" aria-labelledby="project-attention-heading">
      <div className="flex items-end justify-between gap-4">
       <div><h2 id="project-attention-heading" className="text-lg font-semibold tracking-tight">What Needs Your Attention</h2><p className="mt-1 text-sm text-muted-foreground">Payroll, GPS, budget, collections and change-order exceptions for this job.</p></div>
       <Badge appearance="outline" color={warnings.some(w=>w.tone==='bad')?'danger':warnings.length?'warning':'informative'}>{warnings.length+' item'+(warnings.length===1?'':'s')}</Badge>
      </div>
      {(shiftR.error||coR.error)&&<MessageBar intent="error"><MessageBarBody><MessageBarTitle>Some alerts are unavailable</MessageBarTitle>Current field activity or change orders could not be loaded for this project.</MessageBarBody></MessageBar>}
      {warnings.length===0&&!shiftR.error&&!coR.error
       ?<MessageBar intent="info"><MessageBarBody><MessageBarTitle>Nothing urgent on this job</MessageBarTitle>No payroll, GPS, budget, collections or change-order warnings are showing.</MessageBarBody></MessageBar>
      :<div className="space-y-2">{warnings.map((warning,index)=><MessageBar key={index} intent={warning.tone==='bad'?'error':'warning'}><MessageBarBody><MessageBarTitle>{warning.title}</MessageBarTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span>{warning.copy}</span><Button as="a" appearance="outline" size="small" href={warning.href}>{warning.action}</Button></div>
       </MessageBarBody></MessageBar>)}</div>}
    </section>}

    {tab==='activity'&&<section className="space-y-4" aria-labelledby="project-field-production-heading">
     <div><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Operations</p><h2 id="project-field-production-heading" className="mt-1 text-lg font-semibold tracking-tight">Field & Production</h2><p className="mt-1 text-sm text-muted-foreground">What is happening on site and what the crew is actually producing.</p></div>

     {shiftR.error?<MessageBar intent="error"><MessageBarBody><MessageBarTitle>Field activity unavailable</MessageBarTitle>Current employee shift activity could not be loaded for this project.</MessageBarBody></MessageBar>:<>
      <CarezOperatingMetricStrip columns={4} aria-label="Crew today">
       <CarezOperatingMetric label="Clocked In Now" value={String(clocked.length)}/>
       <CarezOperatingMetric label="Waiting Approval" value={String(waiting.length)} tone={waiting.length?'warning':'neutral'}/>
       <CarezOperatingMetric label="GPS Flags" value={String(gpsFlags)} tone={gpsFlags?'warning':'neutral'}/>
       <CarezOperatingMetric label="Actual Labor Hours" value={budgetAvailable?hrs(b.actual_labor_hours):'Unavailable'} help={budgetAvailable?undefined:'No authoritative budget snapshot.'}/>
      </CarezOperatingMetricStrip>
       <div className="flex flex-wrap gap-2"><Button as="a" appearance="primary" size="small" href="/field?view=time-review">Review Employee Time</Button><Button as="a" appearance="outline" size="small" href="/field">Field Logs</Button></div>
     </>}

     <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-2">
       <div><h3 className="text-sm font-semibold">Actual Production</h3><p className="mt-0.5 text-xs text-muted-foreground">Verified quantities divided by approved crew man-hours.</p></div>
       {prodR.error?<MessageBar intent="error"><MessageBarBody><MessageBarTitle>Production history unavailable</MessageBarTitle>Measured production history could not be loaded for this project.</MessageBarBody></MessageBar>:prod.length===0?<MessageBar intent="info"><MessageBarBody><MessageBarTitle>No measured production yet</MessageBarTitle>When employees clock tasks and you verify quantities, the actual rates appear here.</MessageBarBody></MessageBar>:<div className="min-w-0 overflow-x-auto border-y border-border bg-card">
        <Table size="small">
         <TableHeader><TableRow>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Task</TableHeaderCell>
          <TableHeaderCell className="text-right">Built</TableHeaderCell>
          <TableHeaderCell className="text-right">Crew MH</TableHeaderCell>
          <TableHeaderCell className="text-right">Rate</TableHeaderCell>
          <TableHeaderCell className="text-right">Estimating Factor</TableHeaderCell>
         </TableRow></TableHeader>
         <TableBody>{prod.map(row=><TableRow key={row.work_date+'-'+row.production_task_id}>
          <TableCell>{row.work_date}</TableCell>
          <TableCell className="font-medium">{row.task_name}</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{num(row.quantity_completed).toFixed(1)} {row.unit}</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{num(row.man_hours).toFixed(1)} MH</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{num(row.units_per_man_hour).toFixed(2)} {row.unit}/MH</TableCell>
          <TableCell className="text-right font-mono tabular-nums">{num(row.man_hours_per_unit).toFixed(3)} MH/{row.unit}</TableCell>
         </TableRow>)}</TableBody>
        </Table>
       </div>}
      </div>

       <div className="rounded-md border border-border bg-card p-3">
       <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Upcoming placement</h3><p className="mt-0.5 text-xs text-muted-foreground">Existing placement plan and production evidence.</p></div><Button as="a" appearance="outline" size="small" href="/documents">Documents</Button></div>
       <div className="mt-4">
        {pourR.error?<MessageBar intent="error"><MessageBarBody><MessageBarTitle>Placement plan unavailable</MessageBarTitle>Current placement-plan data could not be loaded.</MessageBarBody></MessageBar>:!nextPour?<MessageBar intent="info"><MessageBarBody><MessageBarTitle>No placement plan recorded</MessageBarTitle>Review the project schedule and production work for the next operation.</MessageBarBody></MessageBar>:<div className="space-y-2">
         <div className="text-sm font-medium">{nextPour.name}</div>
         <div className="font-mono text-xl font-semibold tracking-tight tabular-nums">{nextPour.scheduled_date||'Date not set'}</div>
         <div className="text-sm text-muted-foreground">{num(nextPour.expected_concrete_yards).toFixed(1)} CY</div>
         <Badge appearance="outline" color={nextPour.status==='completed'?'success':nextPour.status==='cancelled'?'danger':'informative'}>{String(nextPour.status||'Unknown').replace(/_/g,' ')}</Badge>
        </div>}
       </div>
      </div>
     </div>
    </section>}

    {tab==='commercial-baseline'&&<section className="space-y-4" aria-labelledby="project-cost-forecast-heading">
     <div><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Cost</p><h2 id="project-cost-forecast-heading" className="mt-1 text-lg font-semibold tracking-tight">Cost & Forecast</h2><p className="mt-1 text-sm text-muted-foreground">Actual cost against the frozen budget and where the job is headed.</p></div>
     <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
       <div className="rounded-md border border-border bg-card p-3">
       <h3 className="text-sm font-semibold">Budget vs Actual</h3>
       <p className="mt-0.5 text-xs text-muted-foreground">What the job has used compared with the authoritative budget.</p>
       <div className="mt-3">
        {!budgetAvailable?<MessageBar intent="info"><MessageBarBody><MessageBarTitle>No authoritative budget snapshot</MessageBarTitle>Approve an estimate to establish the job-cost baseline.</MessageBarBody></MessageBar>:<div className="overflow-x-auto">
         <div className="min-w-[34rem]">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem] border-b border-border px-2 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"><span>Cost</span><span className="text-right">Actual</span><span className="text-right">Budget</span></div>
           {costRows.map(([label,actual,budget],index)=><div key={label} className={cn('grid grid-cols-[minmax(0,1fr)_8rem_8rem] items-center px-2 py-2.5 text-sm',index%2===1&&'bg-muted/40',label==='Total Company Cost'&&'font-semibold')}>
           <span>{label}</span><span className="text-right font-mono tabular-nums">{money(actual)}</span><span className="text-right font-mono tabular-nums">{money(budget)}</span>
          </div>)}
         </div>
        </div>}
       </div>
      </div>

       <div className="rounded-md border border-border bg-card p-3">
       <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Forecast</h3><p className="mt-0.5 text-xs text-muted-foreground">Expected completion position.</p></div><Button as="a" appearance="outline" size="small" href="/forecast">Open Forecast</Button></div>
       <div className="mt-3">
        {!forecastAvailable||!fc.project_id?<MessageBar intent="info"><MessageBarBody><MessageBarTitle>Need Progress</MessageBarTitle>Update scope progress to build a forecast.</MessageBarBody></MessageBar>:<KeyValueRows rows={[
         ['Forecast margin',forecastMargin.toFixed(1)+'%'],
         ['Target margin',targetMargin.toFixed(1)+'%'],
         ['Variance to budget',money(forecastVariance)],
        ]}/>}
       </div>
      </div>
     </div>
    </section>}

    {tab==='commercial-baseline'&&<section className="space-y-4" aria-labelledby="project-commercial-heading">
     <div><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Commercial</p><h2 id="project-commercial-heading" className="mt-1 text-lg font-semibold tracking-tight">Commercial & Billing</h2><p className="mt-1 text-sm text-muted-foreground">What is authorized, billed, collected, owed, and still commercially exposed.</p></div>
     <div className="grid gap-4 xl:grid-cols-2">
       <div className="rounded-md border border-border bg-card p-3">
       <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Billing / Collections</h3><p className="mt-0.5 text-xs text-muted-foreground">Customer billing and collection position.</p></div><Button as="a" appearance="outline" size="small" href="/financials?tab=billing&view=billing">Billing</Button></div>
       <div className="mt-3">{!billingAvailable?<MessageBar intent="info"><MessageBarBody><MessageBarTitle>Billing summary unavailable</MessageBarTitle>No authoritative billing summary is available for this project.</MessageBarBody></MessageBar>:<KeyValueRows rows={[
        ['Authorized Work',money(bill.authorized_contract)],
        ['Billed',money(bill.billed_contract)],
        ['Not Yet Billed',money(bill.unbilled_contract)],
        ['Cash Collected',money(bill.cash_collected)],
        ['Still Owed',money(bill.outstanding_ar)],
       ]}/>}</div>
      </div>

       <div className="rounded-md border border-border bg-card p-3">
       <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Change Orders</h3><p className="mt-0.5 text-xs text-muted-foreground">Extra work and approval status.</p></div><Button as="a" appearance="outline" size="small" href="/change-orders">Open COs</Button></div>
       <div className="mt-3">
        {coR.error?<MessageBar intent="error"><MessageBarBody><MessageBarTitle>Change orders unavailable</MessageBarTitle>Current change-order data could not be loaded.</MessageBarBody></MessageBar>:cos.length===0?<MessageBar intent="info"><MessageBarBody><MessageBarTitle>No active change orders</MessageBarTitle>No draft, submitted, or approved change orders are currently returned for this project.</MessageBarBody></MessageBar>:<div className="divide-y divide-border">{cos.slice(0,5).map(co=><div className="flex items-center justify-between gap-4 py-3" key={co.id}>
         <div className="min-w-0"><div className="text-sm font-medium">{co.co_number} — {co.title}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge appearance="outline" color={co.status==='approved'?'success':'informative'}>{String(co.status||'Unknown').replace(/_/g,' ')}</Badge><span>field: {co.field_work_status||'not started'}</span></div></div>
         <strong className="font-mono text-sm font-medium tabular-nums">{money(co.proposed_sell_price)}</strong>
        </div>)}</div>}
        {!coR.error?<div className="mt-3 text-xs text-muted-foreground">{approvedCO} approved · {activeCO} still awaiting approval</div>:null}
       </div>
      </div>
     </div>
     <div className="rounded-md border border-border bg-card p-3">
      <h3 className="text-sm font-semibold">Commitments</h3>
      {commitmentAvailable?<KeyValueRows rows={[["Money already ordered",money(commit.open_po_commitments)],["Open purchase orders",String(num(commit.open_po_count))]]}/>:<MessageBar intent="info"><MessageBarBody><MessageBarTitle>Commitment summary unavailable</MessageBarTitle>No current purchase-order summary is available for this project.</MessageBarBody></MessageBar>}
     </div>
    </section>}

    {tab==='scope-specs'&&<section className="grid gap-4 lg:grid-cols-2" aria-label="Project scope and specifications">
     <div className="rounded-md border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Project and customer</h2>
      <KeyValueRows rows={[["Job number",p.job_number||'Not recorded'],["Project",p.name||'Not recorded'],["Customer",p.customers?.name||'Not recorded'],["Address",[p.address,p.city,p.state].filter(Boolean).join(', ')||'Not entered'],["Status",String(p.status||'Unknown').replace(/_/g,' ')]]}/>
      <div className="mt-3 flex flex-wrap gap-2"><Button as="a" appearance="outline" size="small" href="/documents">Documents</Button><Button as="a" appearance="outline" size="small" href="/field?view=work-packages">Work plan</Button></div>
     </div>
     <div className="rounded-md border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Accepted scope source</h2>
      <KeyValueRows rows={[["Proposal",sourceProposal.data?.proposal_number||'Not recorded'],["Scope snapshot",baselineR.data?.accepted_scope_snapshot_id||'Not recorded'],["Frozen direct cost",baselineR.data?money(baselineR.data.total_direct_cost):'Not recorded'],["Frozen sell",baselineR.data?money(baselineR.data.total_sell):'Not recorded']]}/>
      {awardR.data?.proposal_revision_id&&<Button as="a" appearance="outline" size="small" href={`/opportunities?estimate=${awardR.data.estimate_id}&tab=proposal`}>Open exact revision</Button>}
     </div>
     {['owner','office'].includes(profile.role)&&<Accordion collapsible className="rounded-md border border-border bg-card p-4"><AccordionItem value="settings"><AccordionHeader size="small">Project settings</AccordionHeader><AccordionPanel><div className="pt-3"><DeleteProjectButton projectId={id} projectName={p.name}/></div></AccordionPanel></AccordionItem></Accordion>}
    </section>}

   </div>
   </div>

   {tab==='commercial-baseline'&&!financialAvailable?<p className="sr-only">Project financial summary unavailable; project contract data remains the fallback for the record header.</p>:null}
  </div>
 </AppShell>;
}
