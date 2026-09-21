import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {createClient} from '@/lib/supabase/server';

const n=(v:any)=>Number(v||0);
const qty=(v:any,d=2)=>n(v).toLocaleString('en-US',{maximumFractionDigits:d});
const pct=(v:any)=>`${Math.round(n(v)*100)}%`;
const rate=(v:any,unit:string)=>v==null?'—':`${n(v).toFixed(4)} MH/${unit}`;
const mh=(v:any)=>`${n(v).toFixed(2)} MH`;

export default async function EstimatorIntelligencePage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;

  const [
    {data:outputGuidance},{data:rateGuidance},{data:outliers},
    {data:measurements},{data:sets},{data:estimates},{count:assemblyCount},
  ]=await Promise.all([
    supabase.from('takeoff_output_rate_guidance').select('*').eq('company_id',companyId).limit(750),
    supabase.from('carez_production_rate_guidance').select('*').eq('company_id',companyId).order('evidence_weight',{ascending:false}),
    supabase.from('carez_production_guidance_samples').select('*').eq('company_id',companyId).eq('included_for_guidance',false).order('completed_at',{ascending:false}).limit(50),
    supabase.from('takeoff_measurements').select('id,takeoff_set_id,name,location,drawing_reference,status').eq('company_id',companyId),
    supabase.from('takeoff_sets').select('id,estimate_id,name,revision_label,status').eq('company_id',companyId),
    supabase.from('estimates').select('id,estimate_number,name,version,status').eq('company_id',companyId),
    supabase.from('concrete_assemblies').select('id',{count:'exact',head:true}).eq('company_id',companyId).eq('active',true),
  ]);

  const measurementMap=new Map((measurements||[]).map((x:any)=>[x.id,x]));
  const setMap=new Map((sets||[]).map((x:any)=>[x.id,x]));
  const estimateMap=new Map((estimates||[]).map((x:any)=>[x.id,x]));
  const rows=outputGuidance||[];
  const productionRows=rateGuidance||[];
  const baselineMH=rows.reduce((sum:number,x:any)=>sum+n(x.published_estimated_man_hours),0);
  const guidedMH=rows.reduce((sum:number,x:any)=>sum+n(x.guided_estimated_man_hours),0);
  const comparable=rows.filter((x:any)=>x.carez_man_hours_per_unit!=null);
  const increase=comparable.filter((x:any)=>x.guidance_direction==='increase');
  const decrease=comparable.filter((x:any)=>x.guidance_direction==='decrease');
  const cleanPackages=productionRows.reduce((sum:number,x:any)=>sum+n(x.sample_packages),0);
  const excludedPackages=productionRows.reduce((sum:number,x:any)=>sum+n(x.excluded_outliers),0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Carez estimating intelligence</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Reference Baseline → Carez Standard</h1><p className="mt-1 max-w-5xl text-sm text-muted-foreground">National reference rates start the estimate. Clean completed Work Packages teach Carez how this company actually performs. Faster history lowers labor cautiously; slower history raises the warning before margin disappears.</p></div>
      <div className="flex flex-wrap gap-2"><Link className={buttonVariants({size:'sm'})} href="/takeoff">Takeoff + Assemblies</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/production">Production Control</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/production/work-packages">Work Packages</Link></div>
    </header>

    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><strong>Guidance does not silently rewrite an estimate.</strong> <span className="text-muted-foreground">Published assembly versions remain the contractual/audit baseline. This page previews what current Carez evidence supports; a future promoted assembly version will make an adopted rate explicit and traceable.</span></div>

    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="Estimating intelligence summary">
      <Metric label="Published Assemblies" value={assemblyCount||0} help="Versioned concrete methods available to takeoff."/>
      <Metric label="Learned Work Types" value={productionRows.length} help="Tasks with clean completed-package evidence." tone={productionRows.length?'success':'warning'}/>
      <Metric label="Clean Package Samples" value={cleanPackages} help="Completed quantities with approved employee time."/>
      <Metric label="Held-Out Outliers" value={excludedPackages} help="Kept in the audit trail but blocked from steering bids." tone={excludedPackages?'warning':'success'}/>
      <Metric label="Takeoff Lines With Signal" value={comparable.length} help="Current labor outputs with comparable Carez history." tone={comparable.length?'success':'default'}/>
    </section>

    <section className="space-y-4">
      <SectionHeading kicker="Estimate preview" title="What Carez Evidence Would Change" description="This is a preview only. It compares the exact published baseline used by each takeoff output against clean company production for the same task and unit."/>
      {rows.length===0?<Empty className="min-h-56 border border-border bg-muted/10"><EmptyHeader><EmptyTitle>No assembly labor outputs yet</EmptyTitle><EmptyDescription>Once a takeoff generates labor, Carez will compare its published baseline against company production here.</EmptyDescription></EmptyHeader><EmptyContent><Link className={buttonVariants()} href="/takeoff">Create Takeoff</Link></EmptyContent></Empty>:<>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Published Labor" value={mh(baselineMH)} help="Current immutable assembly output."/>
          <Metric label="Carez-Guided Preview" value={mh(guidedMH)} help="Evidence-weighted preview, not an estimate mutation." tone="primary"/>
          <Metric label="Carry More Labor" value={increase.length} help="Carez history is slower than baseline." tone={increase.length?'warning':'success'}/>
          <Metric label="Possible Reduction" value={decrease.length} help="Only after enough evidence exists." tone={decrease.length?'success':'default'}/>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr>{['Estimate / Object','Work','Published','Carez Actual','Evidence','Guided','MH Delta','Direction'].map((head)=><th key={head} className="border-b border-border px-3 py-2.5 font-medium">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{rows.map((x:any)=>{
              const m:any=measurementMap.get(x.measurement_id);
              const s:any=m?setMap.get(m.takeoff_set_id):null;
              const e:any=s?estimateMap.get(s.estimate_id):null;
              return <tr key={x.takeoff_output_id} className="align-top hover:bg-muted/20">
                <td className="px-3 py-3"><strong>{e?`${e.estimate_number}-R${e.version}`:'Takeoff'}</strong><div className="mt-1 text-xs text-muted-foreground">{m?.name||s?.name||'Measured object'}</div></td>
                <td className="px-3 py-3"><strong>{x.label}</strong><div className="mt-1 text-xs text-muted-foreground">{qty(x.production_quantity)} {x.production_unit}</div></td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums">{rate(x.published_baseline_man_hours_per_unit,x.production_unit)}</td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums">{rate(x.carez_man_hours_per_unit,x.production_unit)}{x.sample_packages!=null&&<div className="mt-1 font-sans text-xs text-muted-foreground">{x.sample_packages} pkg · {x.sample_projects} jobs</div>}</td>
                <td className="px-3 py-3">{x.carez_man_hours_per_unit==null?'—':pct(x.evidence_weight)}<div className="mt-1 text-xs text-muted-foreground">{x.confidence}</div></td>
                <td className="px-3 py-3"><strong className="font-mono text-xs tabular-nums">{rate(x.recommended_man_hours_per_unit,x.production_unit)}</strong><div className="mt-1 max-w-xs text-xs text-muted-foreground">{x.guidance_reason}</div></td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums">{x.carez_man_hours_per_unit==null?'—':`${n(x.guidance_delta_man_hours)>=0?'+':''}${n(x.guidance_delta_man_hours).toFixed(2)} MH`}</td>
                <td className="px-3 py-3"><DirectionBadge direction={x.guidance_direction}/></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </>}
    </section>

    <section className="space-y-4">
      <SectionHeading kicker="Clean company production" title="Evidence by Physical Work Type" description="Only completed Work Packages with approved employee time and trusted quantities enter this model. Evidence strengthens continuously across packages and distinct jobs rather than flipping after an arbitrary job count."/>
      {productionRows.length===0?<Empty className="min-h-56 border border-border bg-muted/10"><EmptyHeader><EmptyTitle>No clean Carez production samples yet</EmptyTitle><EmptyDescription>That is expected until the first physical Work Package is completed and its employee time is approved. Carez will not fabricate a company production rate from an estimate.</EmptyDescription></EmptyHeader><EmptyContent><Link className={buttonVariants()} href="/production/work-packages">Open Work Packages</Link></EmptyContent></Empty>:<div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[980px] border-collapse text-sm"><thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr>{['Work','Unit','Clean Packages','Jobs','Held Out','Carez Actual','Median','Evidence','Stage'].map((head)=><th key={head} className="border-b border-border px-3 py-2.5 font-medium">{head}</th>)}</tr></thead><tbody className="divide-y divide-border">{productionRows.map((x:any)=><tr key={`${x.production_task_id}-${x.unit}`} className="hover:bg-muted/20"><td className="px-3 py-3 font-medium">{x.task_name}</td><td className="px-3 py-3">{x.unit}</td><td className="px-3 py-3 font-mono tabular-nums">{x.sample_packages}</td><td className="px-3 py-3 font-mono tabular-nums">{x.sample_projects}</td><td className="px-3 py-3 font-mono tabular-nums">{x.excluded_outliers}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-xs font-semibold tabular-nums">{rate(x.carez_man_hours_per_unit,x.unit)}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums">{rate(x.median_man_hours_per_unit,x.unit)}</td><td className="px-3 py-3">{pct(x.evidence_weight)}<div className="mt-1 text-xs text-muted-foreground">{x.confidence}</div></td><td className="px-3 py-3">{x.recommendation_stage}</td></tr>)}</tbody></table></div>}
    </section>

    {(outliers||[]).length>0&&<section className="space-y-4">
      <SectionHeading kicker="Quality control" title="Packages Held Out of Future-Bid Guidance" description="These records are never deleted. They remain traceable to the job, quantity and approved MH, but unusual performance does not automatically teach future estimates."/>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[860px] border-collapse text-sm"><thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr>{['Completed','Job / Package','Work','Actual','Group Median','Reason'].map((head)=><th key={head} className="border-b border-border px-3 py-2.5 font-medium">{head}</th>)}</tr></thead><tbody className="divide-y divide-border">{(outliers||[]).map((x:any)=><tr key={x.operation_id} className="hover:bg-muted/20"><td className="whitespace-nowrap px-3 py-3">{x.completed_date}</td><td className="px-3 py-3">{x.job_number} — {x.package_name}</td><td className="px-3 py-3">{x.task_name}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums">{rate(x.man_hours_per_unit,x.unit)}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums">{rate(x.median_man_hours_per_unit,x.unit)}</td><td className="px-3 py-3 text-muted-foreground">{String(x.guidance_review_reason).replaceAll('_',' ')}</td></tr>)}</tbody></table></div>
    </section>}

    <Card className="shadow-none"><CardHeader><CardTitle>How Carez Protects the Estimate</CardTitle><CardDescription>Company history can improve the estimator without teaching it bad habits.</CardDescription></CardHeader><CardContent><div className="divide-y rounded-lg border border-border">{[
      ['1. Reference baseline stays visible.','The published National/Carez assembly rate is never erased from historical estimates.'],
      ['2. Clean field evidence earns weight gradually.','Package count and distinct-job diversity both matter. Maximum automatic evidence weight is intentionally below 100%.'],
      ['3. Slower actual production raises the preview immediately.','Carez should not protect a generic baseline when its own field history says the work is taking more labor.'],
      ['4. Faster production must prove itself before bids get cheaper.','Evidence below 25% cannot lower the baseline, and later reductions remain capped by evidence strength.'],
      ['5. Outliers remain auditable.','Unusually fast or slow packages can be reviewed without allowing one abnormal job to rewrite future estimates.'],
    ].map(([title,detail])=><div key={title} className="px-3 py-3"><div className="font-medium">{title}</div><div className="mt-1 text-sm text-muted-foreground">{detail}</div></div>)}</div></CardContent></Card>
  </div></AppShell>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description:string}){
  return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 max-w-5xl text-sm text-muted-foreground">{description}</p></div>;
}

function Metric({label,value,help,tone='default'}:{label:string;value:string|number;help:string;tone?:'default'|'primary'|'success'|'warning'}){
  const toneClass=tone==='success'?'text-success':tone==='warning'?'text-warning':tone==='primary'?'text-primary':'';
  return <Card className="gap-2 py-4 shadow-none"><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</CardTitle></CardHeader><CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent></Card>;
}

function DirectionBadge({direction}:{direction:string}){
  const classes=direction==='increase'?'border-warning/30 bg-warning/10 text-warning':direction==='decrease'?'border-success/30 bg-success/10 text-success':direction==='hold'?'border-border bg-muted text-foreground':'text-muted-foreground';
  return <Badge variant="outline" className={classes}>{String(direction).replaceAll('_',' ')}</Badge>;
}
