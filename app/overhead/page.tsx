import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {Button,Checkbox,Dialog,DialogBody,DialogSurface,DialogTitle,DialogTrigger,Field,Input} from '@fluentui/react-components';
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

 return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
   <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border border-border bg-card px-4 py-3 shadow-sm"><h1 className="text-lg font-semibold tracking-tight">Overhead plan</h1><div className="flex flex-wrap gap-2"><Button as="a" appearance="secondary" size="small" href="/cashflow/expenses">Actual spending</Button><Dialog><DialogTrigger disableButtonEnhancement><Button appearance="secondary" size="small">Edit business plan</Button></DialogTrigger><DialogSurface className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogBody><DialogTitle>Business and owner plan</DialogTitle><p>These assumptions determine the overhead amount each productive hour must carry.</p></DialogBody><form action={updateOverheadPlan} className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Target Profit Margin %"><Input appearance="underline" name="target_margin_percent" type="number" min="0" max="80" step="0.1" defaultValue={String(num(company?.target_margin_percent))}/></Field><Field label="Productive Field Hours We Expect to Sell / Year"><Input appearance="underline" name="planned_productive_hours_annual" type="number" min="1" step="1" defaultValue={String(hours)}/></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="What Owner Needs to Earn / Year"><Input appearance="underline" name="owner_compensation_target_annual" type="number" min="0" step="100" defaultValue={String(num(company?.owner_compensation_target_annual))}/></Field><Field label="Owner Field Labor Value / Hr"><Input appearance="underline" name="owner_field_rate" type="number" min="0" step="0.01" defaultValue={String(num(company?.owner_field_rate))}/></Field></div><Field label="Owner Field Hours Expected / Year"><Input appearance="underline" name="owner_planned_field_hours_annual" type="number" min="0" step="1" defaultValue={String(num(company?.owner_planned_field_hours_annual))}/></Field><div><Button appearance="primary" type="submit">Save Business Plan</Button></div></form></DialogSurface></Dialog></div></header>

   <section className="grid shrink-0 grid-cols-2 gap-px border border-border bg-border [&>*:first-child]:col-span-2 sm:grid-cols-3 sm:[&>*:first-child]:col-span-1 xl:grid-cols-5" aria-label="Overhead summary"><Metric label="Annual overhead" value={money(annual)}/><Metric label="Monthly overhead" value={money(monthly)}/><Metric label="Per productive hour" value={hours>0?`${money(perHour)}/hr`:'Set hours'}/><Metric label="Actual this month" value={money(actual?.current_month_business_expense)}/><Metric label="Target margin" value={`${num(company?.target_margin_percent).toFixed(1)}%`}/></section>

   <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
   <section className="space-y-2" aria-labelledby="owner-split"><div className="carez-page-heading"><h2 id="owner-split">Owner time and overhead</h2></div><dl className="divide-y border border-border">{[['Business and fleet overhead',`${money(businessAnnual)}/yr`],['Owner field labor value',`${money(ownerFieldValue)}/yr`],['Owner office and management',`${money(ownerOffice)}/yr`],['Total to recover',`${money(annual)}/yr`]].map(([label,value],index)=><div className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${index===3?'bg-muted/30':''}`} key={label}><dt className={index===3?'font-semibold':'text-muted-foreground'}>{label}</dt><dd className="font-mono font-semibold tabular-nums">{value}</dd></div>)}</dl></section>

   <section className="space-y-2" aria-labelledby="hours-scenarios"><div className="carez-page-heading"><h2 id="hours-scenarios">Productive hours scenarios</h2></div><div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-5">{[1600,2160,3000,4000,5000].map(h=><div className="flex items-center justify-between gap-3 bg-card px-3 py-2 sm:block" key={h}><span className="text-xs text-muted-foreground">{h.toLocaleString()} hr / yr</span><strong className="font-mono text-base tabular-nums sm:block">{money(annual/h)}/hr</strong></div>)}</div></section>

   <section className="space-y-2" aria-labelledby="overhead-items"><div className="carez-page-heading"><h2 id="overhead-items">Overhead plan items</h2></div>{groups.size===0?<p className="border border-border px-3 py-4 text-sm text-muted-foreground">No recurring overhead items are configured.</p>:<div className="space-y-3">{[...groups.entries()].map(([category,rows])=><div key={category}><h3 className="border border-border bg-muted/30 px-3 py-2 text-sm font-semibold">{category}</h3><div className="divide-y border-x border-b border-border">{rows.map((i:any)=><Dialog key={i.id}><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><strong className="block truncate text-sm">{i.name}</strong><span className="block truncate text-xs text-muted-foreground">{i.frequency} · {num(i.business_use_percent)}% business use · {i.active?'Active':'Inactive'}</span></div><div className="flex items-center gap-2"><strong className="font-mono text-xs tabular-nums">{money(annualize(i))}/yr</strong><DialogTrigger disableButtonEnhancement><Button appearance="secondary" size="small">View / Edit</Button></DialogTrigger></div></div><DialogSurface className="w-full overflow-hidden sm:max-w-xl"><DialogBody><DialogTitle>{i.name}</DialogTitle><p>{category} · {i.frequency}</p></DialogBody><div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-6"><div className="border border-border bg-muted/20 px-3 py-2 text-sm">Annual business portion <strong className="font-mono">{money(annualize(i))}</strong></div><form action={updateOverheadItem} className="grid gap-3" key={i.id}><input type="hidden" name="id" value={i.id}/><div><div className="text-sm font-medium">{i.name}</div><div className="mt-1 text-xs text-muted-foreground">{i.frequency} · annual business portion {money(annualize(i))}</div></div><Field label="Amount"><Input appearance="underline" name="amount" type="number" step="0.01" min="0" defaultValue={String(num(i.amount))}/></Field><Field label="Business Use %"><Input appearance="underline" name="business_use_percent" type="number" step="1" min="0" max="100" defaultValue={String(num(i.business_use_percent))}/></Field><div className="flex items-center gap-3 md:justify-end"><Checkbox name="active" defaultChecked={i.active} label="Active"/><Button appearance="primary" type="submit" size="small">Save</Button></div></form></div></DialogSurface></Dialog>)}</div></div>)}</div>}</section>
   </div>
  </div></AppShell>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="min-w-0 bg-card px-3 py-2"><span className="text-xs text-muted-foreground">{label}</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{value}</strong></div>;}
