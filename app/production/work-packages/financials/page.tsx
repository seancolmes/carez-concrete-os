import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {createClient} from '@/lib/supabase/server';

const money=(v:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v||0));
const n=(v:any)=>Number(v||0);
const q=(v:any,u?:string)=>`${n(v).toLocaleString(undefined,{maximumFractionDigits:2})}${u?` ${u}`:''}`;

export default async function WorkPackageFinancials(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!p?.company_id)redirect('/login');
 if(p.role==='employee')redirect('/employee');
 const {data:rows}=await supabase.from('work_package_financial_summary').select('*').eq('company_id',p.company_id).order('job_number').order('package_name');
 const list=rows||[];
 const linked=list.filter((x:any)=>x.source_estimate_item_id);
 const unlinked=list.filter((x:any)=>!x.source_estimate_item_id);
 const completed=list.filter((x:any)=>x.operation_status==='completed');
 const over=completed.filter((x:any)=>x.financial_status==='over_source_cost');
 const actual=list.reduce((s:number,x:any)=>s+n(x.actual_company_cost_to_date),0);
 const exposure=list.reduce((s:number,x:any)=>s+n(x.current_cost_exposure),0);
 void linked;

 return <AppShell userName={p.full_name||user.email||'Owner'}>
  <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
   <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Physical scope → dollars</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Work Package Financials</h1><p className="mt-1 max-w-5xl text-sm text-muted-foreground">Employee labor, payroll burden, overhead allocation, purchase orders and posted field costs stay attached to the same physical scope that carries production quantity.</p></div>
    <div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/production/work-packages">Work Packages</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/production">Production Control</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/costs">Job Costs</Link></div>
   </header>

   <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Work package financial summary">
    <Metric label="Actual Company Cost" value={money(actual)} help="Labor + allocated overhead + procurement + operation-linked costs."/>
    <Metric label="Current Cost Exposure" value={money(exposure)} help="Actual cost plus open Work Package commitments."/>
    <Metric label="Completed Over Source Cost" value={String(over.length)} help="Completed operations exceeding their linked estimate item's direct cost." tone={over.length?'destructive':'success'}/>
    <Metric label="Need Estimate Link" value={String(unlinked.length)} help="Operations without source estimate-item cost for direct comparison." tone={unlinked.length?'warning':'success'}/>
   </section>

   {unlinked.length>0&&<div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm"><strong className="text-warning">{unlinked.length} Work Package operation{unlinked.length===1?' is':'s are'} not linked to a source estimate item.</strong><p className="mt-1 text-muted-foreground">Actual costs still accumulate correctly, but direct estimate-to-actual variance needs a source estimate item before the comparison is reliable.</p></div>}

   <section className="space-y-4">
    <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cost + production</p><h2 className="mt-1 text-lg font-semibold">Operation-Level Financial Reality</h2><p className="mt-1 max-w-5xl text-sm text-muted-foreground">Direct estimate cost is compared against direct actual cost. Payroll overhead is shown separately so the comparison does not mix unlike cost bases.</p></div>
    {list.length===0?<Empty className="min-h-44 border border-border bg-muted/10"><EmptyHeader><EmptyTitle>No Work Package financial data yet</EmptyTitle><EmptyDescription>Costs appear here as crew time is approved and PO lines or project costs are tied to Work Package operations.</EmptyDescription></EmptyHeader></Empty>:<div className="grid gap-4">{list.map((x:any)=>{
      const overSource=x.financial_status==='over_source_cost';
      const completedOperation=x.operation_status==='completed';
      return <Card className="gap-0 py-0 shadow-none" key={x.operation_id}>
       <CardHeader className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div className="min-w-0"><CardTitle>{x.job_number} — {x.package_name}</CardTitle><CardDescription className="mt-1">{x.field_label||x.task_name}{x.location?` · ${x.location}`:''}</CardDescription></div><Badge variant="outline" className={overSource?'border-destructive/30 bg-destructive/10 text-destructive':completedOperation?'border-success/30 bg-success/10 text-success':'border-primary/30 bg-primary/10 text-primary'}>{String(x.financial_status).replaceAll('_',' ')}</Badge></CardHeader>
       <CardContent className="space-y-4 py-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><MiniMetric label="Production" value={q(x.actual_quantity??x.planned_quantity,x.unit)} detail={`${x.operation_status} · ${q(x.approved_operation_hours,'approved MH')}`} tone="primary"/><MiniMetric label="Source Estimate Direct Cost" value={x.source_estimate_direct_cost==null?'—':money(x.source_estimate_direct_cost)} detail={x.source_estimate_description||'No source estimate item linked'}/><MiniMetric label="Actual Direct Cost" value={money(x.actual_direct_cost_to_date)} detail="Labor + procurement + linked field costs" tone={overSource?'destructive':'default'}/><MiniMetric label="Actual Company Cost" value={money(x.actual_company_cost_to_date)} detail="Includes allocated field overhead"/></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ValueCell label="Direct Labor" value={money(x.actual_direct_labor_cost)}/><ValueCell label="Allocated Overhead" value={money(x.actual_overhead_cost)}/><ValueCell label="Procurement Actual" value={money(x.procurement_actual_cost)}/><ValueCell label="Open Commitment" value={money(x.open_commitment)}/></div>
        <div className="grid gap-3 sm:grid-cols-3"><ValueCell label="Current Exposure" value={money(x.current_cost_exposure)}/><ValueCell label={`Actual Company Cost / ${x.unit}`} value={x.actual_company_cost_per_unit==null?'—':money(x.actual_company_cost_per_unit)}/><ValueCell label="Completed Direct Variance" value={x.completed_direct_cost_variance_to_source==null?'—':money(x.completed_direct_cost_variance_to_source)} tone={overSource?'destructive':'default'}/></div>
       </CardContent>
      </Card>;
    })}</div>}
   </section>
  </div>
 </AppShell>;
}

function Metric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'|'destructive'}){
 const toneClass=tone==='success'?'text-success':tone==='warning'?'text-warning':tone==='destructive'?'text-destructive':'text-foreground';
 const borderClass=tone==='warning'?'border-warning/30':tone==='destructive'?'border-destructive/30':'';
 return <Card className={`gap-2 py-4 shadow-none ${borderClass}`}><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</CardTitle></CardHeader><CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent></Card>;
}

function MiniMetric({label,value,detail,tone='default'}:{label:string;value:string;detail?:string;tone?:'default'|'primary'|'destructive'}){
 const toneClass=tone==='primary'?'text-primary':tone==='destructive'?'text-destructive':'text-foreground';
 return <div className={`rounded-lg border p-3 ${tone==='destructive'?'border-destructive/30':''}`}><div className="text-xs font-medium text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div>{detail&&<div className="mt-1 text-xs text-muted-foreground">{detail}</div>}</div>;
}

function ValueCell({label,value,tone='default'}:{label:string;value:string;tone?:'default'|'destructive'}){
 return <div className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">{label}</div><strong className={`mt-1 block font-mono text-sm tabular-nums ${tone==='destructive'?'text-destructive':''}`}>{value}</strong></div>;
}
