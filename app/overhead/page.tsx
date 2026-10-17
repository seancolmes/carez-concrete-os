import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Button,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/server';
import {ItemForm,PlanForm} from './forms';
import {annualize,finiteNumber,measureText,overheadReadModel,type Measure,type OverheadItem} from './read-model';

const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
const dollars=(measure:Measure,suffix='')=>measureText(measure,value=>`${money(value)}${suffix}`,'Missing inputs');

export default async function OverheadPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const [companyRead,itemsRead,actualRead]=await Promise.all([
    supabase.from('companies').select('plan_revision,target_margin_percent,planned_productive_hours_annual,owner_compensation_target_annual,owner_planned_field_hours_annual,owner_field_rate').eq('id',profile.company_id).maybeSingle(),
    supabase.from('overhead_items').select('*').eq('company_id',profile.company_id).order('sort_order'),
    supabase.from('company_expense_summary').select('*').eq('company_id',profile.company_id).maybeSingle(),
  ]);
  const model=overheadReadModel({company:companyRead,items:itemsRead,actual:actualRead});
  const canEditPlan=!companyRead.error&&!!companyRead.data;
  const groups=new Map<string,OverheadItem[]>();
  for(const item of itemsRead.data||[]){
    const rows=groups.get(item.category)||[];
    rows.push(item);
    groups.set(item.category,rows);
  }

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border border-border bg-card px-4 py-3 shadow-sm">
      <div className="min-w-0"><nav aria-label="Breadcrumb"><Link href="/settings?tab=system" className="text-xs text-muted-foreground hover:text-foreground hover:underline">Settings · System &amp; labor</Link></nav><h1 className="mt-1 text-lg font-semibold tracking-tight">Overhead plan</h1></div>
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className="inline-flex min-h-8 items-center border border-border px-2 text-xs text-muted-foreground">Actual spending view unavailable</span>
        {canEditPlan?<Dialog><DialogTrigger disableButtonEnhancement><Button appearance="secondary" size="small">Edit business plan</Button></DialogTrigger><DialogSurface className="pt-dialog max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle>Business and owner plan</DialogTitle><p>These assumptions determine the overhead amount each productive hour must carry.</p><DialogContent><PlanForm requestId={randomUUID()} company={companyRead.data!}/></DialogContent></DialogBody></DialogSurface></Dialog>:<span role="status" className="text-xs text-muted-foreground">{companyRead.error?'Business plan unavailable':'Business plan not configured'}</span>}
      </div>
    </header>

    <section className="grid shrink-0 grid-cols-2 gap-px border border-border bg-border [&>*:first-child]:col-span-2 sm:grid-cols-3 sm:[&>*:first-child]:col-span-1 xl:grid-cols-5" aria-label="Overhead summary">
      <Metric label="Annual overhead" value={dollars(model.annual)}/>
      <Metric label="Monthly overhead" value={dollars(model.monthly)}/>
      <Metric label="Per productive hour" value={model.perHour.state==='missing'&&model.annual.state==='recorded'&&model.hours.state==='recorded'&&model.hours.value!==null&&model.hours.value<=0?'Set hours':dollars(model.perHour,'/hr')}/>
      <Metric label="Actual this month" value={measureText(model.actualThisMonth,money,actualRead.data?'Amount missing':'No summary record')}/>
      <Metric label="Target margin" value={measureText(model.targetMargin,value=>`${value.toFixed(1)}%`,'Not set')}/>
    </section>

    <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
      <section className="space-y-2" aria-labelledby="owner-split"><div className="carez-page-heading"><h2 id="owner-split">Owner time and overhead</h2></div><dl className="divide-y border border-border">
        {[
          ['Business and fleet overhead',dollars(model.businessAnnual,'/yr')],
          ['Owner field labor value',dollars(model.ownerFieldValue,'/yr')],
          ['Owner office and management',dollars(model.ownerOffice,'/yr')],
          ['Total to recover',dollars(model.annual,'/yr')],
        ].map(([label,value],index)=><div className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${index===3?'bg-muted/30':''}`} key={label}><dt className={index===3?'font-semibold':'text-muted-foreground'}>{label}</dt><dd className="font-mono font-semibold tabular-nums">{value}</dd></div>)}
      </dl></section>

      <section className="space-y-2" aria-labelledby="hours-scenarios"><div className="carez-page-heading"><h2 id="hours-scenarios">Productive hours scenarios</h2></div><div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-5">
        {[1600,2160,3000,4000,5000].map(hours=><div className="flex items-center justify-between gap-3 bg-card px-3 py-2 sm:block" key={hours}><span className="text-xs text-muted-foreground">{hours.toLocaleString()} hr / yr</span><strong className="font-mono text-base tabular-nums sm:block">{dollars(model.annual.state==='recorded'?{value:(model.annual.value as number)/hours,state:'recorded'}:model.annual,'/hr')}</strong></div>)}
      </div></section>

      <section className="space-y-2" aria-labelledby="overhead-items"><div className="carez-page-heading"><h2 id="overhead-items">Overhead plan items</h2></div>
        {itemsRead.error?<p className="border border-border px-3 py-4 text-sm text-muted-foreground">Overhead items unavailable.</p>:itemsRead.data===null?<p className="border border-border px-3 py-4 text-sm text-muted-foreground">Overhead item data is missing.</p>:groups.size===0?<p className="border border-border px-3 py-4 text-sm text-muted-foreground">No recurring overhead items are configured.</p>:<div className="space-y-3">{[...groups.entries()].map(([category,rows])=><div key={category}><h3 className="border border-border bg-muted/30 px-3 py-2 text-sm font-semibold">{category}</h3><div className="divide-y border-x border-b border-border">{rows.map(item=>{
          const annualized=annualize(item);
          const annualText=dollars(annualized);
          const businessUse=finiteNumber(item.business_use_percent);
          return <Dialog key={item.id}><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong><span className="block truncate text-xs text-muted-foreground">{item.frequency||'Frequency missing'} · {businessUse===null?'Business use missing':`${businessUse}% business use`} · {item.active===true?'Active':item.active===false?'Inactive':'Status missing'}</span></div><div className="flex items-center gap-2"><strong className="font-mono text-xs tabular-nums">{annualText}{annualized.state==='recorded'?'/yr':''}</strong><DialogTrigger disableButtonEnhancement><Button appearance="secondary" size="small">View / Edit</Button></DialogTrigger></div></div><DialogSurface className="pt-dialog "><DialogBody><DialogTitle>{item.name}</DialogTitle><p>{category} · {item.frequency}</p><DialogContent><div className="grid min-h-0 gap-4 pb-2"><div className="border border-border bg-muted/20 px-3 py-2 text-sm">Annual business portion <strong className="font-mono">{annualText}</strong></div><ItemForm item={{id:item.id,name:item.name,frequency:item.frequency,amount:item.amount,business_use_percent:item.business_use_percent,active:item.active,annualText}}/></div></DialogContent></DialogBody></DialogSurface></Dialog>;
        })}</div></div>)}</div>}
      </section>
    </div>
  </div></AppShell>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="min-w-0 bg-card px-3 py-2"><span className="text-xs text-muted-foreground">{label}</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{value}</strong></div>;}
