import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {updateOverheadItem,updateOverheadPlan} from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const annualize=(i:any)=>i.active===false?0:num(i.amount)*(i.frequency==='weekly'?52:i.frequency==='quarterly'?4:i.frequency==='annual'?1:12)*(num(i.business_use_percent)/100);

export default async function OverheadPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!p?.company_id)redirect('/login');
 if(p.role==='employee')redirect('/employee');
 const [{data:company},{data:items},{data:actual}]=await Promise.all([
  supabase.from('companies').select('target_margin_percent,planned_productive_hours_annual,owner_compensation_target_annual,owner_planned_field_hours_annual,owner_field_rate').eq('id',p.company_id).single(),
  supabase.from('overhead_items').select('*').eq('company_id',p.company_id).order('sort_order'),
  supabase.from('company_expense_summary').select('*').eq('company_id',p.company_id).maybeSingle()
 ]);
 const businessAnnual=(items||[]).reduce((s:number,i:any)=>s+annualize(i),0);
 const ownerFieldValue=num(company?.owner_planned_field_hours_annual)*num(company?.owner_field_rate);
 const ownerOffice=Math.max(0,num(company?.owner_compensation_target_annual)-ownerFieldValue);
 const annual=businessAnnual+ownerOffice;
 const monthly=annual/12;
 const hours=num(company?.planned_productive_hours_annual);
 const perHour=hours>0?annual/hours:0;
 const groups=new Map<string,any[]>();
 for(const i of items||[]){const a=groups.get(i.category)||[];a.push(i);groups.set(i.category,a);}

 return <AppShell userName={p.full_name||user.email||'Owner'}>
  <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
   <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overhead</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Cost to Keep Carez Running</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Rent, trucks, insurance, software, accounting and owner office/management time must be recovered by the work before there is real profit.</p></div>
    <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/cashflow/expenses">Actual Company Spending</Link>
   </header>

   <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="Overhead summary">
    <Metric label="Cost to Run Carez / Year" value={money(annual)}/>
    <Metric label="Cost to Run Carez / Month" value={money(monthly)}/>
    <Metric label="Overhead Needed per Productive Hour" value={`${money(perHour)}/hr`} help="Spread across the productive hours you expect to sell."/>
    <Metric label="Actual Company Spending This Month" value={money(actual?.current_month_business_expense)}/>
    <Metric label="Target Profit Margin" value={`${num(company?.target_margin_percent).toFixed(1)}%`}/>
   </section>

   <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"><strong>Simple version:</strong> <span className="text-muted-foreground">direct job labor/material/equipment belong to the job. These overhead costs exist whether one specific job is running or not. Carez spreads them across productive field hours so estimates recover them instead of silently losing money.</span></div>

   <section className="grid gap-4 xl:grid-cols-2">
    <Card className="shadow-none"><CardHeader><CardTitle>Business & Owner Plan</CardTitle><CardDescription>The assumptions that determine how much overhead each productive hour must carry.</CardDescription></CardHeader><CardContent><form action={updateOverheadPlan} className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Target Profit Margin %"><Input name="target_margin_percent" type="number" min="0" max="80" step="0.1" defaultValue={num(company?.target_margin_percent)}/></Field><Field label="Productive Field Hours We Expect to Sell / Year"><Input name="planned_productive_hours_annual" type="number" min="1" step="1" defaultValue={hours}/></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="What Owner Needs to Earn / Year"><Input name="owner_compensation_target_annual" type="number" min="0" step="100" defaultValue={num(company?.owner_compensation_target_annual)}/></Field><Field label="Owner Field Labor Value / Hr"><Input name="owner_field_rate" type="number" min="0" step="0.01" defaultValue={num(company?.owner_field_rate)}/></Field></div><Field label="Owner Field Hours Expected / Year"><Input name="owner_planned_field_hours_annual" type="number" min="0" step="1" defaultValue={num(company?.owner_planned_field_hours_annual)}/></Field><div><Button type="submit">Save Business Plan</Button></div></form></CardContent></Card>

    <Card className="shadow-none"><CardHeader><CardTitle>How Carez Splits Owner Time</CardTitle><CardDescription>Owner field work is job labor. Owner office/management time is overhead.</CardDescription></CardHeader><CardContent><div className="divide-y rounded-lg border border-border">{[['Business/fleet overhead',`${money(businessAnnual)}/yr`],['Owner field labor value',`${money(ownerFieldValue)}/yr`],['Owner office/management allowance',`${money(ownerOffice)}/yr`],['Total overhead to recover',`${money(annual)}/yr`]].map(([label,value],index)=><div className="flex items-center justify-between gap-4 px-3 py-3 text-sm" key={label}><span className={index===3?'font-semibold':'text-muted-foreground'}>{label}</span><strong className="font-mono tabular-nums">{value}</strong></div>)}</div></CardContent></Card>
   </section>

   <section className="space-y-4">
    <SectionHeading kicker="What-if" title="If We Sell More or Fewer Productive Hours" description="The same fixed overhead gets more expensive per field hour when work slows down."/>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[1600,2160,3000,4000,5000].map(h=><Card key={h} className={h===2160?'gap-2 border-primary/30 py-4 shadow-none':'gap-2 py-4 shadow-none'}><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{h.toLocaleString()} Productive Hr / Yr</CardDescription><CardTitle className={h===2160?'font-mono text-xl font-semibold tabular-nums text-primary':'font-mono text-xl font-semibold tabular-nums'}>{money(annual/h)}/hr</CardTitle></CardHeader></Card>)}</div>
   </section>

   <section className="space-y-4">
    <SectionHeading kicker="Expenses" title="Overhead Plan Items" description="Change the amount when a real recurring cost changes. Business-use percentage lets mixed personal/business costs be handled correctly."/>
    <div className="grid gap-4">{[...groups.entries()].map(([category,rows])=><Card className="shadow-none" key={category}><CardHeader><CardTitle>{category}</CardTitle></CardHeader><CardContent><div className="divide-y rounded-lg border border-border">{rows.map((i:any)=><form action={updateOverheadItem} className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_140px_140px_auto] md:items-end" key={i.id}><input type="hidden" name="id" value={i.id}/><div><div className="text-sm font-medium">{i.name}</div><div className="mt-1 text-xs text-muted-foreground">{i.frequency} · annual Carez portion {money(annualize(i))}</div></div><Field label="Amount"><Input name="amount" type="number" step="0.01" min="0" defaultValue={num(i.amount)}/></Field><Field label="Business Use %"><Input name="business_use_percent" type="number" step="1" min="0" max="100" defaultValue={num(i.business_use_percent)}/></Field><div className="flex items-center gap-3 md:justify-end"><label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={i.active} className="size-4 rounded border-input accent-primary"/><span>Active</span></label><Button type="submit" variant="outline" size="sm">Save</Button></div></form>)}</div></CardContent></Card>)}</div>
   </section>
  </div>
 </AppShell>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description:string}){
 return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p></div>;
}

function Field({label,children}:{label:string;children:any}){
 return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}

function Metric({label,value,help}:{label:string;value:string;help?:string}){
 return <Card className="gap-2 py-4 shadow-none"><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</CardTitle></CardHeader>{help&&<CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent>}</Card>;
}
