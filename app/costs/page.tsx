import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {createProjectCost,deleteProjectCost} from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const units=['CY','LF','SF','LB','EA','HR','DAY','TON','GAL','LS'];
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

function Metric({label,value,help}:{label:string;value:string;help?:string}){
 return <Card className="shadow-none"><CardHeader className="gap-1 pb-2"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className="text-xl font-semibold tabular-nums">{value}</CardTitle></CardHeader>{help?<CardContent className="pt-0 text-xs text-muted-foreground">{help}</CardContent>:null}</Card>;
}

export default async function CostsPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!p?.company_id)redirect('/login');if(p.role==='employee')redirect('/employee');
 const [{data:projects},{data:sections},{data:cos},{data:codes},{data:catalog},{data:costs},{data:timecards},{data:budget}]=await Promise.all([
  supabase.from('projects').select('id,job_number,name').in('status',['active','on_hold']).order('job_number'),
  supabase.from('project_budget_sections').select('id,name,project_budgets!inner(project_id,status,label,budget_type,projects(job_number,name))').eq('project_budgets.status','active').order('sort_order'),
  supabase.from('change_orders').select('id,project_id,co_number,title,status,projects(job_number,name)').in('status',['draft','submitted','approved']).order('requested_date',{ascending:false}),
  supabase.from('cost_codes').select('*').eq('company_id',p.company_id).eq('active',true).order('sort_order'),
  supabase.from('cost_catalog_items').select('id,name,default_unit,default_unit_cost,cost_code_id').eq('company_id',p.company_id).eq('active',true).order('name'),
  supabase.from('project_costs').select('*,projects(job_number,name),cost_codes(code,name,cost_type),project_budget_sections(name),change_orders(co_number)').eq('company_id',p.company_id).order('cost_date',{ascending:false}).limit(200),
  supabase.from('timecards').select('project_id,direct_labor_cost').eq('company_id',p.company_id),
  supabase.from('project_budget_actual_summary').select('*')
 ]);
 const labor=(timecards||[]).reduce((s:number,t:any)=>s+num(t.direct_labor_cost),0);
 const manual=(costs||[]).reduce((s:number,c:any)=>s+num(c.total_cost),0);
 const byType=new Map<string,number>();
 for(const c of costs||[])byType.set(c.cost_codes?.cost_type||'other',(byType.get(c.cost_codes?.cost_type||'other')||0)+num(c.total_cost));
 const jobMap=new Map((budget||[]).map((x:any)=>[x.project_id,x]));

 return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
  <header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Job costs</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">What Each Job Actually Cost</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Employee labor comes from approved time. Vendor bills come from Purchasing. Use this screen for direct job costs that do not already enter Carez somewhere else.</p></header>

  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
   <Metric label="Direct Labor" value={money(labor)} help="From approved employee/owner field time."/>
   <Metric label="Materials Entered Here" value={money(byType.get('material')||0)}/>
   <Metric label="Equipment Entered Here" value={money(byType.get('equipment')||0)}/>
   <Metric label="Subs + Other Entered Here" value={money((byType.get('subcontractor')||0)+(byType.get('other')||0))}/>
   <Metric label="Manual Direct Costs" value={money(manual)}/>
  </div>

  <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"><strong>Avoid double entry:</strong> if a supplier invoice is already posted through Purchasing → Vendor Bills, do not enter it again here. This screen is for direct costs that have no other Carez workflow.</div>

  <div className="grid gap-4 xl:grid-cols-2">
   <Card className="shadow-none"><CardHeader><CardTitle>Add Direct Job Cost</CardTitle><CardDescription>Examples: cash purchase, one-off rental, permit/job-specific fee, direct subcontract cost.</CardDescription></CardHeader><CardContent><form action={createProjectCost} className="grid gap-4">
    <div className="grid gap-2"><Label htmlFor="cost-project">Job</Label><select id="cost-project" className={selectClass} name="project_id" required defaultValue=""><option value="" disabled>Choose job</option>{(projects||[]).map((x:any)=><option key={x.id} value={x.id}>{x.job_number} — {x.name}</option>)}</select></div>
    <div className="grid gap-2"><Label htmlFor="cost-change-order">Change Order if Applicable</Label><select id="cost-change-order" className={selectClass} name="change_order_id" defaultValue=""><option value="">Original contract work</option>{(cos||[]).map((c:any)=><option key={c.id} value={c.id}>{c.projects?.job_number} — {c.co_number} — {c.title}</option>)}</select></div>
    <div className="grid gap-2"><Label htmlFor="cost-budget-area">Budget Area</Label><select id="cost-budget-area" className={selectClass} name="budget_section_id" defaultValue=""><option value="">Unassigned</option>{(sections||[]).map((s:any)=><option key={s.id} value={s.id}>{s.project_budgets?.projects?.job_number} — {s.name}</option>)}</select></div>
    <div className="grid gap-2"><Label htmlFor="cost-type">Cost Type</Label><select id="cost-type" className={selectClass} name="cost_code_id" required defaultValue=""><option value="" disabled>Choose cost type</option>{(codes||[]).map((c:any)=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></div>
    <div className="grid gap-2"><Label htmlFor="cost-catalog">Catalog Item (optional)</Label><select id="cost-catalog" className={selectClass} name="catalog_item_id" defaultValue=""><option value="">Custom</option>{(catalog||[]).map((i:any)=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
    <div className="grid gap-2"><Label htmlFor="cost-description">What Did We Buy / Spend?</Label><Input id="cost-description" name="description" required/></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="cost-date">Date</Label><Input id="cost-date" type="date" name="cost_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor="cost-vendor">Vendor</Label><Input id="cost-vendor" name="vendor_name"/></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="cost-quantity">Quantity</Label><Input id="cost-quantity" type="number" step="0.01" min="0" name="quantity" defaultValue="1"/></div><div className="grid gap-2"><Label htmlFor="cost-unit">Unit</Label><select id="cost-unit" className={selectClass} name="unit" defaultValue="LS">{units.map(u=><option key={u}>{u}</option>)}</select></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="cost-unit-cost">Unit Cost</Label><Input id="cost-unit-cost" type="number" step="0.01" min="0" name="unit_cost" required/></div><div className="grid gap-2"><Label htmlFor="cost-tax">Sales Tax / Fee</Label><Input id="cost-tax" type="number" step="0.01" min="0" name="sales_tax" defaultValue="0"/></div></div>
    <div className="grid gap-2"><Label htmlFor="cost-reference">Receipt / Invoice #</Label><Input id="cost-reference" name="reference_number"/></div>
    <input type="hidden" name="source_type" value="manual"/>
    <Button type="submit" className="w-fit">Save Job Cost</Button>
   </form></CardContent></Card>

   <Card className="shadow-none"><CardHeader><CardTitle>Job Budget Check</CardTitle><CardDescription>Actual company cost against the frozen estimate/budget.</CardDescription></CardHeader><CardContent>{(projects||[]).length===0?<Empty><EmptyHeader><EmptyTitle>No active jobs</EmptyTitle><EmptyDescription>Active and on-hold projects will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="divide-y rounded-lg border border-border">{(projects||[]).map((x:any)=>{const b:any=jobMap.get(x.id)||{};return <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={x.id}><div><div className="font-medium">{x.job_number} — {x.name}</div><div className="mt-1 text-xs text-muted-foreground">{b.project_id?`${num(b.budget_cost_used_percent).toFixed(1)}% of budget used · ${num(b.actual_labor_hours).toFixed(1)} labor hr`:'No frozen budget yet'}</div></div><strong className="tabular-nums">{b.project_id?money(b.actual_total_company_cost):'—'}</strong></div>})}</div>}</CardContent></Card>
  </div>

  <section className="space-y-4" aria-labelledby="recent-costs"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manual direct costs</div><h2 id="recent-costs" className="mt-1 text-lg font-semibold">Recent Direct Costs Entered Here</h2><p className="mt-1 text-sm text-muted-foreground">Labor and posted vendor bills are intentionally not repeated in this list.</p></div>
   {(costs||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No manual direct job costs entered</EmptyTitle><EmptyDescription>Direct costs entered through this workflow will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="divide-y rounded-lg border border-border">{(costs||[]).map((c:any)=><div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={c.id}><div><div className="font-medium">{c.description}</div><div className="mt-1 text-xs text-muted-foreground">{c.cost_date} · {c.projects?.job_number} · {c.cost_codes?.name}{c.vendor_name?` · ${c.vendor_name}`:''}</div></div><div className="flex items-center gap-3"><strong className="tabular-nums">{money(c.total_cost)}</strong><form action={deleteProjectCost}><input type="hidden" name="id" value={c.id}/><Button type="submit" variant="outline" size="sm">Delete</Button></form></div></div>)}</div>}
  </section>
 </div></AppShell>;
}
