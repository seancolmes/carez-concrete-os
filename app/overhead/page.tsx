import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Button,buttonVariants} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle,SheetTrigger} from '@/components/ui/sheet';
import {Input} from '@/components/ui/input';
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

 return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
   <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Overhead plan</h1><div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/cashflow/expenses">Actual spending</Link><Dialog><DialogTrigger render={<Button size="sm"/>}>Edit business plan</DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Business and owner plan</DialogTitle><DialogDescription>These assumptions determine the overhead amount each productive hour must carry.</DialogDescription></DialogHeader><form action={updateOverheadPlan} className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Target Profit Margin %"><Input name="target_margin_percent" type="number" min="0" max="80" step="0.1" defaultValue={num(company?.target_margin_percent)}/></Field><Field label="Productive Field Hours We Expect to Sell / Year"><Input name="planned_productive_hours_annual" type="number" min="1" step="1" defaultValue={hours}/></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="What Owner Needs to Earn / Year"><Input name="owner_compensation_target_annual" type="number" min="0" step="100" defaultValue={num(company?.owner_compensation_target_annual)}/></Field><Field label="Owner Field Labor Value / Hr"><Input name="owner_field_rate" type="number" min="0" step="0.01" defaultValue={num(company?.owner_field_rate)}/></Field></div><Field label="Owner Field Hours Expected / Year"><Input name="owner_planned_field_hours_annual" type="number" min="0" step="1" defaultValue={num(company?.owner_planned_field_hours_annual)}/></Field><div><Button type="submit">Save Business Plan</Button></div></form></DialogContent></Dialog></div></header>

   <section className="grid grid-cols-2 gap-px border border-border bg-border [&>*:first-child]:col-span-2 sm:grid-cols-3 sm:[&>*:first-child]:col-span-1 xl:grid-cols-5" aria-label="Overhead summary"><Metric label="Annual overhead" value={money(annual)}/><Metric label="Monthly overhead" value={money(monthly)}/><Metric label="Per productive hour" value={hours>0?`${money(perHour)}/hr`:'Set hours'}/><Metric label="Actual this month" value={money(actual?.current_month_business_expense)}/><Metric label="Target margin" value={`${num(company?.target_margin_percent).toFixed(1)}%`}/></section>

   <section className="space-y-2" aria-labelledby="owner-split"><div className="carez-page-heading"><h2 id="owner-split">Owner time and overhead</h2></div><dl className="divide-y border border-border">{[['Business and fleet overhead',`${money(businessAnnual)}/yr`],['Owner field labor value',`${money(ownerFieldValue)}/yr`],['Owner office and management',`${money(ownerOffice)}/yr`],['Total to recover',`${money(annual)}/yr`]].map(([label,value],index)=><div className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${index===3?'bg-muted/30':''}`} key={label}><dt className={index===3?'font-semibold':'text-muted-foreground'}>{label}</dt><dd className="font-mono font-semibold tabular-nums">{value}</dd></div>)}</dl></section>

   <section className="space-y-2" aria-labelledby="hours-scenarios"><div className="carez-page-heading"><h2 id="hours-scenarios">Productive hours scenarios</h2></div><div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-5">{[1600,2160,3000,4000,5000].map(h=><div className="flex items-center justify-between gap-3 bg-card px-3 py-2 sm:block" key={h}><span className="text-xs text-muted-foreground">{h.toLocaleString()} hr / yr</span><strong className="font-mono text-base tabular-nums sm:block">{money(annual/h)}/hr</strong></div>)}</div></section>

   <section className="space-y-2" aria-labelledby="overhead-items"><div className="carez-page-heading"><h2 id="overhead-items">Overhead plan items</h2></div>{groups.size===0?<p className="border border-border px-3 py-4 text-sm text-muted-foreground">No recurring overhead items are configured.</p>:<div className="space-y-3">{[...groups.entries()].map(([category,rows])=><div key={category}><h3 className="border border-border bg-muted/30 px-3 py-2 text-sm font-semibold">{category}</h3><div className="divide-y border-x border-b border-border">{rows.map((i:any)=><Sheet key={i.id}><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><strong className="block truncate text-sm">{i.name}</strong><span className="block truncate text-xs text-muted-foreground">{i.frequency} · {num(i.business_use_percent)}% business use · {i.active?'Active':'Inactive'}</span></div><div className="flex items-center gap-2"><strong className="font-mono text-xs tabular-nums">{money(annualize(i))}/yr</strong><SheetTrigger render={<Button variant="outline" size="sm"/>}>View / Edit</SheetTrigger></div></div><SheetContent className="w-full overflow-hidden sm:max-w-xl"><SheetHeader><SheetTitle>{i.name}</SheetTitle><SheetDescription>{category} · {i.frequency}</SheetDescription></SheetHeader><div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-6"><div className="border border-border bg-muted/20 px-3 py-2 text-sm">Annual business portion <strong className="font-mono">{money(annualize(i))}</strong></div><form action={updateOverheadItem} className="grid gap-3" key={i.id}><input type="hidden" name="id" value={i.id}/><div><div className="text-sm font-medium">{i.name}</div><div className="mt-1 text-xs text-muted-foreground">{i.frequency} · annual business portion {money(annualize(i))}</div></div><Field label="Amount"><Input name="amount" type="number" step="0.01" min="0" defaultValue={num(i.amount)}/></Field><Field label="Business Use %"><Input name="business_use_percent" type="number" step="1" min="0" max="100" defaultValue={num(i.business_use_percent)}/></Field><div className="flex items-center gap-3 md:justify-end"><label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={i.active} className="size-4 rounded border-input accent-primary"/><span>Active</span></label><Button type="submit" variant="outline" size="sm">Save</Button></div></form></div></SheetContent></Sheet>)}</div></div>)}</div>}</section>
  </div></AppShell>;
}

function Field({label,children}:{label:string;children:any}){return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>;}
function Metric({label,value}:{label:string;value:string}){return <div className="min-w-0 bg-card px-3 py-2"><span className="text-xs text-muted-foreground">{label}</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{value}</strong></div>;}
