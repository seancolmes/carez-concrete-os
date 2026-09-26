import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AlertTriangle,ArrowRight,Calculator,LibraryBig,Plus,Ruler,Upload} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardFooter,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {createClient} from '@/lib/supabase/server';
import {ManualTakeoffEntry} from '@/components/takeoff/ManualTakeoffEntry';
import {createTakeoffSet,updateTakeoffOutputPrice} from './actions';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const qty=(n:any,d=1)=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:d});

function Metric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'}){
  return <div className={cn('min-w-0 border-x border-border px-4 py-3 first:border-l-0 last:border-r-0',tone==='warning'&&'border-warning/30')}>
    <CardHeader className="gap-1 px-0"><CardDescription className="text-xs font-medium uppercase tracking-wide">{label}</CardDescription><CardTitle className={cn('font-mono text-2xl font-semibold tracking-tight tabular-nums',tone==='success'&&'text-success',tone==='warning'&&'text-warning')}>{value}</CardTitle></CardHeader>
    <CardContent className="px-0 text-xs leading-5 text-muted-foreground">{help}</CardContent>
  </div>;
}

export default async function TakeoffPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;

  const [
    {data:estimates},{data:sections},{data:presentations},{data:sets},{data:measurements},{data:outputs},
    {data:assemblies},{data:versions},{data:variables},{data:summaries},{data:riskClasses},{data:sheets},
  ]=await Promise.all([
    supabase.from('estimates').select('id,estimate_number,name,version,status,created_at').eq('company_id',companyId).order('created_at',{ascending:false}),
    supabase.from('estimate_sections').select('id,estimate_id,name,scope_type,sort_order').eq('company_id',companyId).order('sort_order'),
    supabase.from('proposal_presentations').select('estimate_id,proposal_number,status').eq('company_id',companyId),
    supabase.from('takeoff_sets').select('id,estimate_id,name,revision_label,status,source_document_id,source_filename,page_count,created_at').eq('company_id',companyId).eq('status','active').order('created_at',{ascending:false}),
    supabase.from('takeoff_measurements').select('id,takeoff_set_id,assembly_version_id,name,raw_quantity,raw_unit,location,status,created_at').eq('company_id',companyId).eq('status','active').order('created_at',{ascending:false}),
    supabase.from('takeoff_measurement_outputs').select('id,measurement_id,label,estimate_item_type,production_quantity,production_unit,estimated_man_hours,direct_cost,pricing_status,cost_source').eq('company_id',companyId),
    supabase.from('concrete_assemblies').select('id,code,name,category,primary_measurement,description').eq('company_id',companyId).eq('active',true).eq('direct_takeoff_enabled',true).order('category').order('name'),
    supabase.from('concrete_assembly_versions').select('id,assembly_id,version_no,status,default_risk_class_code,source_label,source_reference').eq('company_id',companyId).eq('status','published').order('version_no',{ascending:false}),
    supabase.from('concrete_assembly_variables').select('id,assembly_version_id,variable_key,label,value_type,unit,default_value,options,min_value,max_value,required,help_text,sort_order,activation_rule').eq('company_id',companyId).order('sort_order'),
    supabase.from('estimate_takeoff_summary').select('*').eq('company_id',companyId),
    supabase.from('li_risk_classes').select('code,name,tax_year').eq('company_id',companyId).eq('active',true).order('code'),
    supabase.from('takeoff_sheets').select('id,takeoff_set_id,scale_status').eq('company_id',companyId),
  ]);

  const issued=new Set((presentations||[]).map((p:any)=>p.estimate_id));
  const estimateMap=new Map((estimates||[]).map((e:any)=>[e.id,e]));
  const summaryMap=new Map((summaries||[]).map((s:any)=>[s.estimate_id,s]));
  const measurementsBySet=new Map<string,any[]>();
  for(const m of measurements||[]){const rows=measurementsBySet.get(m.takeoff_set_id)||[];rows.push(m);measurementsBySet.set(m.takeoff_set_id,rows);}
  const outputByMeasurement=new Map<string,any[]>();
  for(const o of outputs||[]){const rows=outputByMeasurement.get(o.measurement_id)||[];rows.push(o);outputByMeasurement.set(o.measurement_id,rows);}
  const sheetsBySet=new Map<string,any[]>();
  for(const sheet of sheets||[]){const rows=sheetsBySet.get(sheet.takeoff_set_id)||[];rows.push(sheet);sheetsBySet.set(sheet.takeoff_set_id,rows);}
  const sectionsByEstimate=new Map<string,any[]>();
  for(const section of sections||[]){const rows=sectionsByEstimate.get(section.estimate_id)||[];rows.push(section);sectionsByEstimate.set(section.estimate_id,rows);}

  const activeSets=sets||[];
  const setEstimateIds=new Set(activeSets.map((set:any)=>set.estimate_id));
  const editableEstimates=(estimates||[]).filter((e:any)=>!issued.has(e.id)&&!['accepted','approved','superseded'].includes(e.status));
  const startableEstimates=editableEstimates.filter((e:any)=>!setEstimateIds.has(e.id));
  const activeMeasurements=measurements||[];
  const missingOutputs=(outputs||[]).filter((o:any)=>['missing_price','missing_labor_rate'].includes(o.pricing_status)&&Number(o.production_quantity||o.estimated_man_hours||0)>0);
  const totalDirect=(summaries||[]).reduce((sum:number,row:any)=>sum+Number(row.takeoff_direct_cost||0),0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preconstruction</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Concrete takeoff</h1></div>
        <div className="flex flex-wrap items-center gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/takeoff/assemblies"><LibraryBig/>Assembly history</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/estimates"><Calculator/>Estimates</Link></div>
      </header>

      <nav className="flex w-fit max-w-full items-stretch overflow-x-auto rounded-lg border bg-card text-xs" aria-label="Carez estimating workflow">
        {['Takeoff','Estimate','Review','Proposal'].map((label,index)=><div key={label} className={index===0?'flex min-h-9 items-center gap-2 border-r bg-accent px-3 font-medium text-primary shadow-[inset_0_-2px_var(--primary)] last:border-r-0':'flex min-h-9 items-center gap-2 border-r px-3 text-muted-foreground last:border-r-0'}><span className="font-mono text-[10px]">{index+1}</span><span>{label}</span>{index<3?<ArrowRight className="size-3 opacity-50"/>:null}</div>)}
      </nav>

      <section className="carez-summary-ledger grid grid-cols-2 gap-px lg:grid-cols-4">
        <Metric label="Working bids" value={String(activeSets.filter((set:any)=>!issued.has(set.estimate_id)).length)} help="Active takeoff revisions."/>
        <Metric label="Measured scope" value={String(activeMeasurements.length)} help="Concrete objects measured or entered."/>
        <Metric label="Needs pricing" value={String(missingOutputs.length)} help="Assembly outputs blocking a clean estimate." tone={missingOutputs.length?'warning':'success'}/>
        <Metric label="Takeoff direct cost" value={money(totalDirect)} help="Current generated direct cost across takeoffs."/>
      </section>

      {startableEstimates.length>0?<section className="border-y border-border py-4">
        <CardHeader className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Start a bid</p><CardTitle className="mt-1">Open a new plan takeoff</CardTitle><CardDescription className="mt-1 max-w-2xl">Choose an estimate. Carez creates the takeoff set and opens the drawing workspace without inserting an unnecessary setup screen.</CardDescription></div>
          <form action={createTakeoffSet} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="name" value="Concrete Takeoff"/><select name="estimate_id" required defaultValue="" className="h-8 min-w-72 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20"><option value="" disabled>Choose estimate…</option>{startableEstimates.map((e:any)=><option key={e.id} value={e.id}>{e.estimate_number}-R{e.version} — {e.name}</option>)}</select><Button type="submit" size="sm"><Plus/>Start takeoff</Button></form>
        </CardHeader>
      </section>:null}

      <section className="space-y-4">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your bids</p><h2 className="mt-1 text-lg font-semibold">Takeoff workbench</h2><p className="mt-1 max-w-4xl text-sm text-muted-foreground">The plans stay primary. Pricing holds and manual field quantities stay attached to the bid without competing with measurement work.</p></div>
        {activeSets.length===0?<Empty className="min-h-64 border bg-muted/20"><EmptyHeader><EmptyMedia variant="icon"><Ruler/></EmptyMedia><EmptyTitle>No takeoff started yet</EmptyTitle><EmptyDescription>Create an estimate first, then start its plan takeoff here.</EmptyDescription></EmptyHeader><EmptyContent><Link className={buttonVariants()} href="/estimates">Open estimates</Link></EmptyContent></Empty>:
          <div className="grid gap-4">{activeSets.map((set:any)=>{
            const estimate:any=estimateMap.get(set.estimate_id);
            const locked=!estimate||issued.has(set.estimate_id)||['accepted','approved','superseded'].includes(estimate.status);
            const ms=measurementsBySet.get(set.id)||[];
            const setSheets=sheetsBySet.get(set.id)||[];
            const unscaled=setSheets.filter((sheet:any)=>sheet.scale_status!=='calibrated').length;
            const summary:any=summaryMap.get(set.estimate_id)||{};
            const setOutputs=ms.flatMap((m:any)=>outputByMeasurement.get(m.id)||[]);
            const holds=setOutputs.filter((o:any)=>['missing_price','missing_labor_rate'].includes(o.pricing_status)&&Number(o.production_quantity||o.estimated_man_hours||0)>0);
            const materialHolds=holds.filter((o:any)=>o.estimate_item_type!=='labor');
            const status=locked?'Issued / read only':!set.source_document_id?'Attach plans':unscaled>0?'Set sheet scale':holds.length?'Resolve pricing':'Takeoff ready';
            const tone=locked?'muted':!set.source_document_id||unscaled>0||holds.length?'warning':'success';
            return <article key={set.id} className="border-y border-border bg-transparent">
              <CardHeader className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-3 border-b py-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary"><Ruler className="size-4"/></span>
                <div className="min-w-0"><CardTitle className="truncate">{estimate?.name||set.name}</CardTitle><CardDescription className="mt-1 truncate">{estimate?`${estimate.estimate_number}-R${estimate.version}`:'Estimate'} · {set.revision_label}{set.source_filename?` · ${set.source_filename}`:''}</CardDescription></div>
                <Badge variant={tone==='warning'?'secondary':tone==='success'?'secondary':'outline'} className={cn(tone==='warning'&&'bg-warning/10 text-warning',tone==='success'&&'bg-success/10 text-success',tone==='muted'&&'text-muted-foreground')}>{status}</Badge>
              </CardHeader>

              <CardContent className="p-0">
                <div className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-5 sm:divide-y-0">
                  {[['Sheets',set.page_count||setSheets.length||'—'],['Objects',ms.length],['Labor',`${qty(summary.takeoff_man_hours)} MH`],['Price holds',holds.length],['Direct cost',money(summary.takeoff_direct_cost)]].map(([label,value])=><div key={String(label)} className="px-4 py-3"><div className="text-[11px] font-medium text-muted-foreground">{label}</div><div className={cn('mt-1 font-mono text-sm font-semibold tabular-nums',label==='Price holds'&&holds.length&&'text-warning')}>{value}</div></div>)}
                </div>

                {!locked&&holds.length>0?<details className="border-b">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-warning/5 px-4 py-2.5 text-xs font-medium text-warning"><span className="flex items-center gap-2"><AlertTriangle className="size-3.5"/>Resolve {holds.length} pricing hold{holds.length===1?'':'s'}</span><span className="text-[11px] font-normal text-muted-foreground">Open</span></summary>
                  <div className="space-y-3 p-4">{materialHolds.length===0?<div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">The remaining hold is labor configuration. Review the estimating system in the Assembly Library.</div>:<div className="divide-y rounded-lg border">{materialHolds.map((o:any)=><div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={o.id}><div><div className="text-sm font-medium">{o.label}</div><div className="mt-0.5 text-xs text-muted-foreground">{qty(o.production_quantity,2)} {o.production_unit} · current price missing</div></div><form action={updateTakeoffOutputPrice} className="flex items-center gap-2"><div className="relative"><span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span><Input name="unit_cost" type="number" min="0" step="0.01" inputMode="decimal" required placeholder="0.00" className="h-8 w-28 pl-6 pr-7 text-right text-xs"/><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">/{o.production_unit}</span></div><input type="hidden" name="output_id" value={o.id}/><Button type="submit" variant="outline" size="sm">Save</Button></form></div>)}</div>}</div>
                </details>:null}

                {!locked?<details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-xs font-medium hover:bg-muted/40"><span>Manual quantity / field measurement</span><span className="text-[11px] font-normal text-muted-foreground">Fallback</span></summary>
                  <div className="border-t p-4"><div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">Use this only when the quantity comes from a field dimension, sketch, owner quantity, or another verified source instead of the PDF.</div><ManualTakeoffEntry takeoffSetId={set.id} assemblies={assemblies||[]} versions={versions||[]} variables={variables||[]} sections={sectionsByEstimate.get(set.estimate_id)||[]} riskClasses={riskClasses||[]}/></div>
                </details>:null}
              </CardContent>

              <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/20 p-3">
                <Link className={buttonVariants({size:'sm'})} href={`/takeoff/${set.id}`}>{set.source_document_id?<><Ruler/>Open takeoff</>:<><Upload/>Attach plans</>}</Link>
                <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/estimates"><Calculator/>Estimate</Link>
                {locked?<span className="ml-auto self-center text-xs text-muted-foreground">Accepted/issued geometry stays preserved with this revision.</span>:null}
              </CardFooter>
            </article>;
          })}</div>}
      </section>

      <section className="grid gap-4 border-y border-border py-4 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimating system</p><CardTitle className="mt-1">Legacy assembly compatibility history</CardTitle><CardDescription className="mt-1 max-w-3xl">{(assemblies||[]).length} published compatibility assemblies remain available for historical Takeoff and estimate lineage. This is read-only compatibility history; new scope is authored through Concrete Conditions.</CardDescription></div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/takeoff/assemblies">Assembly history</Link></section>
    </div>
  </AppShell>;
}
