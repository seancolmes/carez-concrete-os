import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {
 CarezDataGrid,CarezDataGridBody,CarezDataGridCell,CarezDataGridHead,
 CarezDataGridHeaderCell,CarezDataGridRow,CarezDataGridTable,
 CarezEmptyState,CarezFeedback,CarezOperatingMetric,CarezOperatingMetricStrip,
 CarezRecordHeader,CarezStatus,
} from '@/components/carez';
import {buttonVariants} from '@/components/ui/button';
import {createClient} from '@/lib/supabase/server';
import {resolveProjectRecordStatus} from '@/lib/ui/operations';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const pct=(n:any)=>`${num(n).toFixed(1)}%`;
const hrs=(n:any)=>`${num(n).toFixed(1)} hr`;

type ProjectWarning={tone:'watch'|'bad';title:string;copy:string;href:string;action:string};

function KeyValueRows({rows}:{rows:Array<[string,string]>}){
 return <dl className="divide-y divide-border">{rows.map(([label,value])=><div className="flex items-center justify-between gap-4 py-2.5 text-sm" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-mono font-medium tabular-nums">{value}</dd></div>)}</dl>;
}

export default async function ProjectCommandPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).maybeSingle();
 if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
 const [projectR,financialR,budgetR,billingR,commitR,forecastR,prodR,shiftR,coR,pourR]=await Promise.all([
  supabase.from('projects').select('*,customers(name,contact_name,phone,email)').eq('id',id).eq('company_id',profile.company_id).maybeSingle(),
  supabase.from('project_financial_summary').select('*').eq('project_id',id).maybeSingle(),
  supabase.from('project_budget_actual_summary').select('*').eq('project_id',id).maybeSingle(),
  supabase.from('project_billing_summary').select('*').eq('project_id',id).maybeSingle(),
  supabase.from('project_commitment_summary').select('*').eq('project_id',id).maybeSingle(),
  supabase.from('project_cost_to_complete_summary').select('*').eq('project_id',id).maybeSingle(),
  supabase.from('production_rate_history').select('*').eq('project_id',id).order('work_date',{ascending:false}).limit(12),
  supabase.from('employee_shift_sessions').select('id,status,work_date,clock_in_inside_geofence,clock_out_inside_geofence,crew_members(name)').eq('project_id',id).in('status',['open','submitted']).order('work_date',{ascending:false}),
  supabase.from('change_orders').select('id,co_number,title,status,field_work_status,proposed_sell_price,requested_date').eq('project_id',id).in('status',['draft','submitted','approved']).order('requested_date',{ascending:false}),
  supabase.from('pour_plans').select('id,name,scheduled_date,expected_concrete_yards,status').eq('project_id',id).not('status','eq','cancelled').order('scheduled_date',{ascending:true})
 ]);
 const p:any=projectR.data;if(!p)notFound();
 const sourceEstimateId=String(p.source_estimate_id||'');
 const sourceTakeoffs=sourceEstimateId
  ?(await supabase.from('takeoff_sets').select('id,name,status').eq('company_id',profile.company_id).eq('estimate_id',sourceEstimateId).eq('status','active')).data||[]
  :[];
 const originalTakeoff=sourceTakeoffs.length===1?sourceTakeoffs[0]:null;
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
 if(waiting.length)warnings.push({tone:'watch',title:`${waiting.length} timecard${waiting.length===1?'':'s'} waiting for approval`,copy:'Review employee GPS, hours and tasks before payroll/job cost.',href:'/field/review',action:'Review Time'});
 if(gpsFlags)warnings.push({tone:'bad',title:`${gpsFlags} open/submitted shift${gpsFlags===1?'':'s'} need GPS review`,copy:'At least one clock-in or clock-out is outside the jobsite radius.',href:'/field/review',action:'Check GPS'});
 if(num(b.labor_hours_remaining)<0)warnings.push({tone:'bad',title:`Labor is ${Math.abs(num(b.labor_hours_remaining)).toFixed(1)} hours over budget`,copy:'Remaining work needs a production plan before more labor is burned.',href:'/forecast',action:'Review Forecast'});
 if(budgetUsed>=85&&budgetUsed<100)warnings.push({tone:'watch',title:`Job has used ${budgetUsed.toFixed(1)}% of its cost budget`,copy:'Check remaining scope, material commitments and labor before proceeding.',href:'/forecast',action:'Review Job'});
 if(budgetUsed>=100)warnings.push({tone:'bad',title:'Job cost is over the frozen budget',copy:`Current true company cost exceeds the approved baseline by ${money(Math.abs(num(b.total_cost_remaining)))}.`,href:'/forecast',action:'Review Overrun'});
 if(num(bill.overdue_ar)>0)warnings.push({tone:'bad',title:`Customer has ${money(bill.overdue_ar)} past due`,copy:'Collections need attention before more cash is committed.',href:'/billing',action:'Review Billing'});
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
  <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
   <CarezRecordHeader
    eyebrow={<span className="font-mono text-xs font-semibold text-muted-foreground">{p.job_number}</span>}
    title={p.name}
    description={<>{[p.address,p.city,p.state].filter(Boolean).join(', ')||'Job address not entered'}{p.customers?.name?' · '+p.customers.name:''}</>}
    status={projectStatus?<CarezStatus tone={projectStatus.tone} label={projectStatus.label}/>:<CarezStatus tone="neutral" label={String(p.status||'Unknown')}/>}
    actions={<>
     {originalTakeoff?<Link className={buttonVariants({variant:'outline',size:'sm'})} href={`/takeoff/${originalTakeoff.id}`}>Original Takeoff</Link>:null}
     <Link className={buttonVariants({size:'sm'})} href="/field/review">Review Crew Time</Link>
     <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/pour-control">Plan Pour</Link>
     <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/procurement">Order Materials</Link>
    </>}
   />

   <div className="flex flex-col gap-6">
    <section className="order-1 space-y-3" aria-labelledby="project-attention-heading">
     <div className="flex items-end justify-between gap-4">
      <div><h2 id="project-attention-heading" className="text-lg font-semibold tracking-tight">What Needs Your Attention</h2><p className="mt-1 text-sm text-muted-foreground">Payroll, GPS, budget, collections and change-order exceptions for this job.</p></div>
      <CarezStatus tone={warnings.some(w=>w.tone==='bad')?'error':warnings.length?'warning':'neutral'} label={warnings.length+' item'+(warnings.length===1?'':'s')}/>
     </div>
     {warnings.length===0
      ?<CarezFeedback tone="success" title="Nothing urgent on this job">No payroll, GPS, budget, collections or change-order warnings are showing.</CarezFeedback>
      :<div className="space-y-2">{warnings.map((warning,index)=><CarezFeedback key={index} tone={warning.tone==='bad'?'error':'warning'} title={warning.title}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span>{warning.copy}</span><Link className={buttonVariants({variant:'outline',size:'sm'})} href={warning.href}>{warning.action}</Link></div>
       </CarezFeedback>)}</div>}
    </section>

    <section className="order-2 space-y-3" aria-labelledby="project-operating-heading">
     <div><h2 id="project-operating-heading" className="text-lg font-semibold tracking-tight">Operating Position</h2><p className="mt-1 text-sm text-muted-foreground">Contract, budget, labor, receivables, commitments and forecast position.</p></div>
     <CarezOperatingMetricStrip columns={6}>
      <CarezOperatingMetric label="Contract" value={money(f.adjusted_contract||p.contract_value)} help="Original contract plus approved changes."/>
      <CarezOperatingMetric label="Budget Used" value={budgetAvailable?pct(budgetUsed):'No Budget'} help={budgetAvailable?(b.label?`Against ${b.label}.`:'Current approved budget position.'):'Approve an estimate to establish the baseline.'} tone={!budgetAvailable?'neutral':budgetUsed>=100?'error':budgetUsed>=85?'warning':'neutral'}/>
      <CarezOperatingMetric label="Labor Hours Used" value={budgetAvailable&&num(b.budget_labor_hours)>0?pct(laborUsed):budgetAvailable?'No Labor Budget':'No Budget'} help={budgetAvailable?`${hrs(b.actual_labor_hours)} used · ${hrs(b.labor_hours_remaining)} remaining.`:'No authoritative budget snapshot.'} tone={!budgetAvailable?'neutral':laborUsed>=100?'error':laborUsed>=85?'warning':'neutral'}/>
      <CarezOperatingMetric label="Customer Owes Us" value={billingAvailable?money(bill.outstanding_ar):'Unavailable'} help={billingAvailable?(num(bill.overdue_ar)>0?`${money(bill.overdue_ar)} is past due.`:'No overdue customer balance.'):'Billing summary unavailable.'} tone={!billingAvailable?'neutral':num(bill.overdue_ar)>0?'error':num(bill.outstanding_ar)>0?'warning':'neutral'}/>
      <CarezOperatingMetric label="Money Already Ordered" value={commitmentAvailable?money(commit.open_po_commitments):'Unavailable'} help={commitmentAvailable?`${num(commit.open_po_count)} open purchase order${num(commit.open_po_count)===1?'':'s'}.`:'Commitment summary unavailable.'}/>
      <CarezOperatingMetric label="Where Job Is Headed" value={forecastAvailable&&fc.project_id?`${forecastMargin.toFixed(1)}% margin`:'Need Progress'} help={forecastAvailable&&fc.project_id?`${money(forecastVariance)} vs budget at completion.`:'Update scope progress to build a forecast.'} tone={!forecastAvailable||!fc.project_id?'neutral':forecastVariance<0?'error':forecastMargin<targetMargin?'warning':'neutral'}/>
     </CarezOperatingMetricStrip>
    </section>

    <section className="order-4 space-y-4 lg:order-3" aria-labelledby="project-field-production-heading">
     <div><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Operations</p><h2 id="project-field-production-heading" className="mt-1 text-lg font-semibold tracking-tight">Field & Production</h2><p className="mt-1 text-sm text-muted-foreground">What is happening on site and what the crew is actually producing.</p></div>

     {shiftR.error?<CarezFeedback tone="error" title="Field activity unavailable">Current employee shift activity could not be loaded for this project.</CarezFeedback>:<>
      <CarezOperatingMetricStrip columns={4} aria-label="Crew today">
       <CarezOperatingMetric label="Clocked In Now" value={String(clocked.length)}/>
       <CarezOperatingMetric label="Waiting Approval" value={String(waiting.length)} tone={waiting.length?'warning':'neutral'}/>
       <CarezOperatingMetric label="GPS Flags" value={String(gpsFlags)} tone={gpsFlags?'warning':'neutral'}/>
       <CarezOperatingMetric label="Actual Labor Hours" value={budgetAvailable?hrs(b.actual_labor_hours):'Unavailable'} help={budgetAvailable?undefined:'No authoritative budget snapshot.'}/>
      </CarezOperatingMetricStrip>
      <div className="flex flex-wrap gap-2"><Link className={buttonVariants({size:'sm'})} href="/field/review">Review Employee Time</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/field">Field Logs</Link></div>
     </>}

     <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-2">
       <div><h3 className="text-sm font-semibold">Actual Production</h3><p className="mt-0.5 text-xs text-muted-foreground">Verified quantities divided by approved crew man-hours.</p></div>
       {prodR.error?<CarezFeedback tone="error" title="Production history unavailable">Measured production history could not be loaded for this project.</CarezFeedback>:<CarezDataGrid
        isEmpty={prod.length===0}
        empty={<CarezEmptyState title="No measured production yet" description="When employees clock tasks and you verify quantities, the actual rates appear here."/>}
       >
        <CarezDataGridTable>
         <CarezDataGridHead><CarezDataGridRow>
          <CarezDataGridHeaderCell>Date</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell>Task</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell numeric>Built</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell numeric>Crew MH</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell numeric>Rate</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell numeric>Estimating Factor</CarezDataGridHeaderCell>
         </CarezDataGridRow></CarezDataGridHead>
         <CarezDataGridBody>{prod.map(row=><CarezDataGridRow key={row.work_date+'-'+row.production_task_id}>
          <CarezDataGridCell>{row.work_date}</CarezDataGridCell>
          <CarezDataGridCell className="font-medium">{row.task_name}</CarezDataGridCell>
          <CarezDataGridCell numeric>{num(row.quantity_completed).toFixed(1)} {row.unit}</CarezDataGridCell>
          <CarezDataGridCell numeric>{num(row.man_hours).toFixed(1)} MH</CarezDataGridCell>
          <CarezDataGridCell numeric>{num(row.units_per_man_hour).toFixed(2)} {row.unit}/MH</CarezDataGridCell>
          <CarezDataGridCell numeric>{num(row.man_hours_per_unit).toFixed(3)} MH/{row.unit}</CarezDataGridCell>
         </CarezDataGridRow>)}</CarezDataGridBody>
        </CarezDataGridTable>
       </CarezDataGrid>}
      </div>

      <div className="rounded-md border border-border bg-background p-3">
       <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Next Pour</h3><p className="mt-0.5 text-xs text-muted-foreground">Upcoming concrete placement.</p></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/pour-control">Pour Control</Link></div>
       <div className="mt-4">
        {pourR.error?<CarezFeedback tone="error" title="Pour plan unavailable">Current pour-plan data could not be loaded.</CarezFeedback>:!nextPour?<CarezEmptyState title="No pour is currently planned" description="Open Pour Control when the next concrete placement is ready to schedule."/>:<div className="space-y-2">
         <div className="text-sm font-medium">{nextPour.name}</div>
         <div className="font-mono text-xl font-semibold tracking-tight tabular-nums">{nextPour.scheduled_date||'Date not set'}</div>
         <div className="text-sm text-muted-foreground">{num(nextPour.expected_concrete_yards).toFixed(1)} CY</div>
         <CarezStatus tone={nextPour.status==='completed'?'success':nextPour.status==='cancelled'?'error':'info'} label={String(nextPour.status||'Unknown').replace(/_/g,' ')}/>
        </div>}
       </div>
      </div>
     </div>
    </section>

    <section className="order-5 space-y-4 lg:order-4" aria-labelledby="project-cost-forecast-heading">
     <div><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Cost</p><h2 id="project-cost-forecast-heading" className="mt-1 text-lg font-semibold tracking-tight">Cost & Forecast</h2><p className="mt-1 text-sm text-muted-foreground">Actual cost against the frozen budget and where the job is headed.</p></div>
     <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-md border border-border bg-background p-3">
       <h3 className="text-sm font-semibold">Budget vs Actual</h3>
       <p className="mt-0.5 text-xs text-muted-foreground">What the job has used compared with the authoritative budget.</p>
       <div className="mt-3">
        {!budgetAvailable?<CarezEmptyState title="No authoritative budget snapshot" description="Approve an estimate to establish the job-cost baseline."/>:<div className="overflow-x-auto">
         <div className="min-w-[34rem]">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem] border-b border-border px-2 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"><span>Cost</span><span className="text-right">Actual</span><span className="text-right">Budget</span></div>
          {costRows.map(([label,actual,budget],index)=><div key={label} className={cn('grid grid-cols-[minmax(0,1fr)_8rem_8rem] items-center px-2 py-2.5 text-sm',index<costRows.length-1&&'border-b border-border/70',label==='Total Company Cost'&&'font-semibold')}>
           <span>{label}</span><span className="text-right font-mono tabular-nums">{money(actual)}</span><span className="text-right font-mono tabular-nums">{money(budget)}</span>
          </div>)}
         </div>
        </div>}
       </div>
      </div>

      <div className="rounded-md border border-border bg-background p-3">
       <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Forecast</h3><p className="mt-0.5 text-xs text-muted-foreground">Expected completion position.</p></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/forecast">Open Forecast</Link></div>
       <div className="mt-3">
        {!forecastAvailable||!fc.project_id?<CarezEmptyState title="Need Progress" description="Update scope progress to build a forecast."/>:<KeyValueRows rows={[
         ['Forecast margin',forecastMargin.toFixed(1)+'%'],
         ['Target margin',targetMargin.toFixed(1)+'%'],
         ['Variance to budget',money(forecastVariance)],
        ]}/>}
       </div>
      </div>
     </div>
    </section>

    <section className="order-6 space-y-4 lg:order-5" aria-labelledby="project-commercial-heading">
     <div><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Commercial</p><h2 id="project-commercial-heading" className="mt-1 text-lg font-semibold tracking-tight">Commercial & Billing</h2><p className="mt-1 text-sm text-muted-foreground">What is authorized, billed, collected, owed, and still commercially exposed.</p></div>
     <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-md border border-border bg-background p-3">
       <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Billing / Collections</h3><p className="mt-0.5 text-xs text-muted-foreground">Customer billing and collection position.</p></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/billing">Billing</Link></div>
       <div className="mt-3">{!billingAvailable?<CarezEmptyState title="Billing summary unavailable" description="No authoritative billing summary is available for this project."/>:<KeyValueRows rows={[
        ['Authorized Work',money(bill.authorized_contract)],
        ['Billed',money(bill.billed_contract)],
        ['Not Yet Billed',money(bill.unbilled_contract)],
        ['Cash Collected',money(bill.cash_collected)],
        ['Still Owed',money(bill.outstanding_ar)],
       ]}/>}</div>
      </div>

      <div className="rounded-md border border-border bg-background p-3">
       <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Change Orders</h3><p className="mt-0.5 text-xs text-muted-foreground">Extra work and approval status.</p></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/change-orders">Open COs</Link></div>
       <div className="mt-3">
        {coR.error?<CarezFeedback tone="error" title="Change orders unavailable">Current change-order data could not be loaded.</CarezFeedback>:cos.length===0?<CarezEmptyState title="No active change orders" description="No draft, submitted, or approved change orders are currently returned for this project."/>:<div className="divide-y divide-border">{cos.slice(0,5).map(co=><div className="flex items-center justify-between gap-4 py-3" key={co.id}>
         <div className="min-w-0"><div className="text-sm font-medium">{co.co_number} — {co.title}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><CarezStatus tone={co.status==='approved'?'success':co.status==='submitted'?'info':'neutral'} label={String(co.status||'Unknown').replace(/_/g,' ')}/><span>field: {co.field_work_status||'not started'}</span></div></div>
         <strong className="font-mono text-sm font-medium tabular-nums">{money(co.proposed_sell_price)}</strong>
        </div>)}</div>}
        {!coR.error?<div className="mt-3 text-xs text-muted-foreground">{approvedCO} approved · {activeCO} still awaiting approval</div>:null}
       </div>
      </div>
     </div>
    </section>

    <section className="order-3 space-y-3 lg:order-6" aria-labelledby="project-next-action-heading">
     <div className="rounded-md border border-border bg-muted/15 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Next Job Action</div>
      <h2 id="project-next-action-heading" className="mt-2 text-lg font-semibold tracking-tight">{p.next_action||'No next action entered yet.'}</h2>
      <p className="mt-1 text-sm text-muted-foreground">The next physical or management action currently recorded for this project.</p>
     </div>
     <div className="flex flex-wrap gap-2" aria-label="Related workflows">
      <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/field/review">Review Crew Time</Link>
      <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/procurement">Procurement</Link>
      <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/change-orders">Change Orders</Link>
      <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/forecast">Forecast</Link>
      <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/billing">Billing</Link>
      <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/pour-control">Pour Control</Link>
     </div>
    </section>
   </div>

   {!financialAvailable?<p className="sr-only">Project financial summary unavailable; project contract data remains the fallback for the record header.</p>:null}
  </div>
 </AppShell>;
}
