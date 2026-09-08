import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {createClient} from '@/lib/supabase/server';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const pct=(n:any)=>`${num(n).toFixed(1)}%`;
const hrs=(n:any)=>`${num(n).toFixed(1)} hr`;

type MetricTone='neutral'|'success'|'warning'|'danger';

function Metric({label,value,help,tone='neutral'}:{label:string;value:string;help?:string;tone?:MetricTone}){
 return <Card className={cn('gap-2 py-4 shadow-none',tone==='danger'&&'border-destructive/30',tone==='warning'&&'border-warning/30',tone==='success'&&'border-success/25')}>
  <CardHeader className="gap-1 px-4">
   <CardDescription className="text-xs font-medium">{label}</CardDescription>
   <CardTitle className={cn('font-mono text-2xl font-semibold tracking-tight tabular-nums',tone==='danger'&&'text-destructive',tone==='warning'&&'text-warning',tone==='success'&&'text-success')}>{value}</CardTitle>
  </CardHeader>
  {help&&<CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent>}
 </Card>;
}

function KeyValueRows({rows}:{rows:Array<[string,string]>}){
 return <div className="divide-y divide-border">{rows.map(([label,value])=><div className="flex items-center justify-between gap-4 py-3 text-sm" key={label}><span className="text-muted-foreground">{label}</span><strong className="text-right font-mono font-medium tabular-nums">{value}</strong></div>)}</div>;
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
 const f:any=financialR.data||{},b:any=budgetR.data||{},bill:any=billingR.data||{},commit:any=commitR.data||{},fc:any=forecastR.data||{};
 const prod:any[]=prodR.data||[],shifts:any[]=shiftR.data||[],cos:any[]=coR.data||[],pours:any[]=pourR.data||[];
 const waiting=shifts.filter(s=>s.status==='submitted');const clocked=shifts.filter(s=>s.status==='open');const gpsFlags=shifts.filter(s=>s.clock_in_inside_geofence===false||s.clock_out_inside_geofence===false).length;
 const budgetUsed=num(b.budget_cost_used_percent);const laborUsed=num(b.budget_labor_hours)>0?num(b.actual_labor_hours)/num(b.budget_labor_hours)*100:0;
 const forecastVariance=num(fc.forecast_variance_to_budget);const forecastMargin=num(fc.forecast_margin_at_completion);const targetMargin=num(f.target_margin_percent||p.target_margin_percent);
 const activeCO=cos.filter(c=>c.status!=='approved').length;const approvedCO=cos.filter(c=>c.status==='approved').length;
 const nextPour=pours.find(x=>x.scheduled_date&&new Date(`${x.scheduled_date}T23:59:59`).getTime()>=Date.now())||pours[0];
 const warnings:any[]=[];
 if(waiting.length)warnings.push({tone:'watch',title:`${waiting.length} timecard${waiting.length===1?'':'s'} waiting for approval`,copy:'Review employee GPS, hours and tasks before payroll/job cost.',href:'/field/review',action:'Review Time'});
 if(gpsFlags)warnings.push({tone:'bad',title:`${gpsFlags} open/submitted shift${gpsFlags===1?'':'s'} need GPS review`,copy:'At least one clock-in or clock-out is outside the jobsite radius.',href:'/field/review',action:'Check GPS'});
 if(num(b.labor_hours_remaining)<0)warnings.push({tone:'bad',title:`Labor is ${Math.abs(num(b.labor_hours_remaining)).toFixed(1)} hours over budget`,copy:'Remaining work needs a production plan before more labor is burned.',href:'/forecast',action:'Review Forecast'});
 if(budgetUsed>=85&&budgetUsed<100)warnings.push({tone:'watch',title:`Job has used ${budgetUsed.toFixed(1)}% of its cost budget`,copy:'Check remaining scope, material commitments and labor before proceeding.',href:'/forecast',action:'Review Job'});
 if(budgetUsed>=100)warnings.push({tone:'bad',title:'Job cost is over the frozen budget',copy:`Current true company cost exceeds the approved baseline by ${money(Math.abs(num(b.total_cost_remaining)))}.`,href:'/forecast',action:'Review Overrun'});
 if(num(bill.overdue_ar)>0)warnings.push({tone:'bad',title:`Customer has ${money(bill.overdue_ar)} past due`,copy:'Collections need attention before more cash is committed.',href:'/billing',action:'Review Billing'});
 if(activeCO)warnings.push({tone:'watch',title:`${activeCO} change order${activeCO===1?' is':'s are'} not approved`,copy:'Track extra work carefully so unapproved scope does not become free work.',href:'/change-orders',action:'Review COs'});

 return <AppShell userName={profile.full_name||user.email||'Owner'}>
  <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
   <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-start xl:justify-between">
    <div className="min-w-0">
     <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="secondary">{p.job_number}</Badge></div>
     <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
     <p className="mt-1 text-sm text-muted-foreground">{[p.address,p.city,p.state].filter(Boolean).join(', ')||'Job address not entered'}{p.customers?.name?` · ${p.customers.name}`:''}</p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
     <Link className={buttonVariants({size:'sm'})} href="/field/review">Review Crew Time</Link>
     <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/pour-control">Plan Pour</Link>
     <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/procurement">Order Materials</Link>
    </div>
   </header>

   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
    <Metric label="Contract" value={money(f.adjusted_contract||p.contract_value)} help="Original contract plus approved changes."/>
    <Metric label="Budget Used" value={pct(budgetUsed)} help={b.label?`Against ${b.label}.`:'Approve an estimate to establish the baseline.'} tone={budgetUsed>=100?'danger':budgetUsed>=85?'warning':'success'}/>
    <Metric label="Labor Hours Used" value={num(b.budget_labor_hours)>0?pct(laborUsed):'No Budget'} help={`${hrs(b.actual_labor_hours)} used · ${hrs(b.labor_hours_remaining)} remaining.`} tone={laborUsed>=100?'danger':laborUsed>=85?'warning':'neutral'}/>
    <Metric label="Customer Owes Us" value={money(bill.outstanding_ar)} help={num(bill.overdue_ar)>0?`${money(bill.overdue_ar)} is past due.`:'No overdue customer balance.'} tone={num(bill.overdue_ar)>0?'danger':num(bill.outstanding_ar)>0?'warning':'neutral'}/>
    <Metric label="Money Already Ordered" value={money(commit.open_po_commitments)} help={`${num(commit.open_po_count)} open purchase order${num(commit.open_po_count)===1?'':'s'}.`}/>
    <Metric label="Where Job Is Headed" value={fc.project_id?`${forecastMargin.toFixed(1)}% margin`:'Need Progress'} help={fc.project_id?`${money(forecastVariance)} vs budget at completion.`:'Update scope progress to build a forecast.'} tone={forecastVariance<0?'danger':forecastMargin<targetMargin?'warning':'success'}/>
   </div>

   <Card className="shadow-none">
    <CardHeader className="flex-row items-center justify-between gap-4">
     <div><CardTitle>What Needs Your Attention</CardTitle><CardDescription>Payroll, GPS, budget, collections and change-order exceptions for this job.</CardDescription></div>
     <Badge variant={warnings.some((w:any)=>w.tone==='bad')?'destructive':'secondary'}>{warnings.length} item{warnings.length===1?'':'s'}</Badge>
    </CardHeader>
    <CardContent>
     {warnings.length===0?<div className="rounded-lg border border-success/25 bg-success/5 px-4 py-3"><div className="text-sm font-medium text-success">Nothing urgent on this job</div><div className="mt-1 text-sm text-muted-foreground">No payroll, GPS, budget, collections or change-order warnings are showing.</div></div>:<div className="divide-y divide-border rounded-lg border">{warnings.map((w:any,i)=><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" key={i}><div className="min-w-0"><div className={cn('text-sm font-medium',w.tone==='bad'?'text-destructive':'text-warning')}>{w.title}</div><div className="mt-1 text-sm text-muted-foreground">{w.copy}</div></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href={w.href}>{w.action}</Link></div>)}</div>}
    </CardContent>
   </Card>

   <section className="space-y-3">
    <div><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Field</p><h2 className="mt-1 text-lg font-semibold tracking-tight">Crew Today</h2><p className="text-sm text-muted-foreground">Employee clock status and approvals for this job.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
     <Metric label="Clocked In Now" value={String(clocked.length)}/>
     <Metric label="Waiting Approval" value={String(waiting.length)} tone={waiting.length?'warning':'neutral'}/>
     <Metric label="GPS Flags" value={String(gpsFlags)} tone={gpsFlags?'warning':'neutral'}/>
     <Metric label="Actual Labor Hours" value={hrs(b.actual_labor_hours)}/>
    </div>
    <div className="flex flex-wrap gap-2"><Link className={buttonVariants({size:'sm'})} href="/field/review">Review Employee Time</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/field">Field Logs</Link></div>
   </section>

   <Card className="shadow-none">
    <CardHeader><CardTitle>What the Crew Is Actually Producing</CardTitle><CardDescription>Verified quantities divided by approved crew man-hours.</CardDescription></CardHeader>
    <CardContent>{prod.length===0?<Empty className="min-h-40 border bg-muted/20"><EmptyHeader><EmptyTitle>No measured production yet</EmptyTitle><EmptyDescription>When employees clock tasks and you verify quantities, the actual rates appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Task</TableHead><TableHead>Built</TableHead><TableHead>Crew MH</TableHead><TableHead>Rate</TableHead><TableHead>Estimating Factor</TableHead></TableRow></TableHeader><TableBody>{prod.map(r=><TableRow key={`${r.work_date}-${r.production_task_id}`}><TableCell>{r.work_date}</TableCell><TableCell className="font-medium">{r.task_name}</TableCell><TableCell className="font-mono tabular-nums">{num(r.quantity_completed).toFixed(1)} {r.unit}</TableCell><TableCell className="font-mono tabular-nums">{num(r.man_hours).toFixed(1)} MH</TableCell><TableCell className="font-mono tabular-nums">{num(r.units_per_man_hour).toFixed(2)} {r.unit}/MH</TableCell><TableCell className="font-mono tabular-nums">{num(r.man_hours_per_unit).toFixed(3)} MH/{r.unit}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent>
   </Card>

   <div className="grid gap-4 xl:grid-cols-2">
    <Card className="shadow-none"><CardHeader><CardTitle>Budget vs Actual</CardTitle><CardDescription>What we estimated compared with what the job has used.</CardDescription></CardHeader><CardContent><KeyValueRows rows={[
     ['Labor',`${money(b.actual_direct_labor_cost)} / ${money(b.budget_direct_labor_cost)}`],
     ['Materials',`${money(b.actual_material_cost)} / ${money(b.budget_material_cost)}`],
     ['Equipment',`${money(b.actual_equipment_cost)} / ${money(b.budget_equipment_cost)}`],
     ['Subs / Other',`${money(num(b.actual_subcontractor_cost)+num(b.actual_other_direct_cost))} / ${money(num(b.budget_subcontractor_cost)+num(b.budget_other_direct_cost))}`],
     ['Total Company Cost',`${money(b.actual_total_company_cost)} / ${money(b.budget_total_company_cost)}`],
    ]}/></CardContent></Card>
    <Card className="shadow-none"><CardHeader><CardTitle>Get Paid</CardTitle><CardDescription>Customer billing and collections for this job.</CardDescription></CardHeader><CardContent><KeyValueRows rows={[
     ['Authorized Work',money(bill.authorized_contract)],['Billed',money(bill.billed_contract)],['Not Yet Billed',money(bill.unbilled_contract)],['Cash Collected',money(bill.cash_collected)],['Still Owed',money(bill.outstanding_ar)],
    ]}/><div className="mt-4"><Link className={buttonVariants({size:'sm'})} href="/billing">Billing</Link></div></CardContent></Card>
   </div>

   <div className="grid gap-4 xl:grid-cols-2">
    <Card className="shadow-none"><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Change Orders</CardTitle><CardDescription>Extra work and approval status.</CardDescription></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/change-orders">Open COs</Link></CardHeader><CardContent><div className="divide-y divide-border">{cos.length===0?<div className="py-3 text-sm text-muted-foreground">No active change orders.</div>:cos.slice(0,5).map(c=><div className="flex items-center justify-between gap-4 py-3" key={c.id}><div className="min-w-0"><div className="text-sm font-medium">{c.co_number} — {c.title}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant={c.status==='approved'?'secondary':c.status==='submitted'?'default':'outline'}>{c.status}</Badge><span>field: {c.field_work_status||'not started'}</span></div></div><strong className="font-mono text-sm font-medium tabular-nums">{money(c.proposed_sell_price)}</strong></div>)}</div><div className="mt-3 text-xs text-muted-foreground">{approvedCO} approved · {activeCO} still awaiting approval</div></CardContent></Card>
    <Card className="shadow-none"><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Next Pour</CardTitle><CardDescription>Upcoming concrete placement for this project.</CardDescription></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/pour-control">Pour Control</Link></CardHeader><CardContent>{!nextPour?<div className="text-sm text-muted-foreground">No pour is currently planned.</div>:<div className="space-y-2"><div className="text-sm font-medium">{nextPour.name}</div><div className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{nextPour.scheduled_date||'Date not set'}</div><div className="text-sm text-muted-foreground">{num(nextPour.expected_concrete_yards).toFixed(1)} CY · {nextPour.status}</div></div>}</CardContent></Card>
   </div>

   <section className="space-y-3">
    <Card className="border-primary/20 bg-primary/5 shadow-none"><CardContent className="py-5"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Next Job Action</p><p className="mt-2 text-lg font-semibold tracking-tight">{p.next_action||'No next action entered yet.'}</p></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
     {[['Approve Crew Time','GPS, hours and tasks','/field/review'],['Buy Materials','Quotes, POs and bills','/procurement'],['Extra Work','Protect change-order work','/change-orders'],['Job Forecast','See where cost and margin are headed','/forecast'],['Get Paid','Invoice and collect customer money','/billing'],['Plan a Pour','Cash and cost check before placement','/pour-control']].map(([title,copy,href])=><Link className="group rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href} key={href}><div className="text-sm font-medium group-hover:text-accent-foreground">{title}</div><div className="mt-1 text-sm text-muted-foreground">{copy}</div></Link>)}
    </div>
   </section>
  </div>
 </AppShell>;
}
