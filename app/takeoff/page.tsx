import {redirect} from 'next/navigation';
import {WarningRegular as AlertTriangle,CalculatorRegular as Calculator,AddRegular as Plus,RulerRegular as Ruler,ArrowUploadRegular as Upload} from '@fluentui/react-icons';
import {AppShell} from '@/components/AppShell';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Badge,Button,Input,Select} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/server';
import {ManualTakeoffEntry} from '@/components/takeoff/ManualTakeoffEntry';
import {createTakeoffSet,updateTakeoffOutputPrice} from './actions';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const qty=(n:any,d=1)=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:d});

function Metric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'}){
  return <div className={cn('min-w-0 border-x border-border px-4 py-3 first:border-l-0 last:border-r-0',tone==='warning'&&'border-warning/30')}>
    <div className="gap-1 px-0"><p className="text-xs font-medium uppercase tracking-wide">{label}</p><h3 className={cn('font-mono text-2xl font-semibold tracking-tight tabular-nums',tone==='success'&&'text-success',tone==='warning'&&'text-warning')}>{value}</h3></div>
    <div className="px-0 text-xs leading-5 text-muted-foreground">{help}</div>
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
    <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-col gap-3 lg:h-full">
      <header className="carez-page-heading flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1>Concrete takeoff</h1></div>
        <div className="flex flex-wrap items-center gap-2"><Button as="a" href="/opportunities" appearance="secondary" size="small" icon={<Calculator/>}>Opportunities</Button></div>
      </header>

      <section className="carez-summary-ledger grid shrink-0 grid-cols-2 gap-px lg:grid-cols-4">
        <Metric label="Working bids" value={String(activeSets.filter((set:any)=>!issued.has(set.estimate_id)).length)} help="Active takeoff revisions."/>
        <Metric label="Measured scope" value={String(activeMeasurements.length)} help="Concrete objects measured or entered."/>
        <Metric label="Needs pricing" value={String(missingOutputs.length)} help="Assembly outputs blocking a clean estimate." tone={missingOutputs.length?'warning':'success'}/>
        <Metric label="Takeoff direct cost" value={money(totalDirect)} help="Current generated direct cost across takeoffs."/>
      </section>

      {startableEstimates.length>0?<section className="shrink-0 border border-border bg-card py-2">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end"><div><h3>Open a new plan takeoff</h3><p className="mt-1 max-w-2xl">Choose an estimate to open its drawing workspace.</p></div>
          <form action={createTakeoffSet} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="name" value="Concrete Takeoff"/><Select name="estimate_id" required defaultValue="" className="h-8 min-w-72"><option value="" disabled>Choose estimate…</option>{startableEstimates.map((e:any)=><option key={e.id} value={e.id}>{e.estimate_number}-R{e.version} — {e.name}</option>)}</Select><Button type="submit" size="small"><Plus/>Start takeoff</Button></form>
        </div>
      </section>:null}

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="carez-section-heading"><Ruler className="size-4 text-muted-foreground"/><h2>Plan sets</h2></div>
        {activeSets.length===0?<div className="min-h-64 border bg-muted/20"><div><div><Ruler/></div><h3>No takeoff started yet</h3><p>Create an estimate first, then start its plan takeoff here.</p></div><div><Button as="a" href="/estimates" size="small">Open estimates</Button></div></div>:
          <div className="min-h-0 flex-1 overflow-auto border border-border bg-card">{activeSets.map((set:any)=>{
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
            return <article key={set.id} className="border-b border-border bg-transparent last:border-b-0">
              <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-3 border-b py-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Ruler className="size-4"/></span>
                <div className="min-w-0"><h3 className="truncate">{estimate?.name||set.name}</h3><p className="mt-1 truncate">{estimate?`${estimate.estimate_number}-R${estimate.version}`:'Estimate'} · {set.revision_label}{set.source_filename?` · ${set.source_filename}`:''}</p></div>
                <Badge appearance="outline" className={cn(tone==='warning'&&'bg-warning/10 text-warning',tone==='success'&&'bg-success/10 text-success',tone==='muted'&&'text-muted-foreground')}>{status}</Badge>
              </div>

              <div className="p-0">
                <div className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-5 sm:divide-y-0">
                  {[['Sheets',set.page_count||setSheets.length||'—'],['Objects',ms.length],['Labor',`${qty(summary.takeoff_man_hours)} MH`],['Price holds',holds.length],['Direct cost',money(summary.takeoff_direct_cost)]].map(([label,value])=><div key={String(label)} className="px-4 py-3"><div className="text-[11px] font-medium text-muted-foreground">{label}</div><div className={cn('mt-1 font-mono text-sm font-semibold tabular-nums',label==='Price holds'&&holds.length&&'text-warning')}>{value}</div></div>)}
                </div>

                {!locked&&holds.length>0?<Accordion collapsible className="border-b"><AccordionItem value="pricing-holds">
                  <AccordionHeader><span className="flex items-center gap-2 text-warning"><AlertTriangle className="size-3.5"/>Resolve {holds.length} pricing hold{holds.length===1?'':'s'}</span></AccordionHeader><AccordionPanel>
                  <div className="space-y-3 p-4">{materialHolds.length===0?<div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">The remaining hold is labor configuration. Review the estimating system in the Assembly Library.</div>:<div className="divide-y rounded-lg border">{materialHolds.map((o:any)=><div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={o.id}><div><div className="text-sm font-medium">{o.label}</div><div className="mt-0.5 text-xs text-muted-foreground">{qty(o.production_quantity,2)} {o.production_unit} · current price missing</div></div><form action={updateTakeoffOutputPrice} className="flex items-center gap-2"><div className="relative"><span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span><Input appearance="underline" name="unit_cost" type="number" min="0" step="0.01" inputMode="decimal" required placeholder="0.00" className="h-8 w-28 pl-6 pr-7 text-right text-xs"/><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">/{o.production_unit}</span></div><input type="hidden" name="output_id" value={o.id}/><Button type="submit" appearance="outline" size="small">Save</Button></form></div>)}</div>}</div>
                </AccordionPanel></AccordionItem></Accordion>:null}

                {!locked?<Accordion collapsible><AccordionItem value="manual-measurement">
                  <AccordionHeader>Manual quantity / field measurement</AccordionHeader><AccordionPanel>
                  <div className="border-t p-4"><div className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">Use this only when the quantity comes from a field dimension, sketch, owner quantity, or another verified source instead of the PDF.</div><ManualTakeoffEntry takeoffSetId={set.id} assemblies={assemblies||[]} versions={versions||[]} variables={variables||[]} sections={sectionsByEstimate.get(set.estimate_id)||[]} riskClasses={riskClasses||[]}/></div>
                </AccordionPanel></AccordionItem></Accordion>:null}
              </div>

              <div className="flex flex-wrap gap-2 border-t bg-muted/20 p-3">
                <Button as="a" href={`/takeoff/${set.id}`} size="small" icon={set.source_document_id?<Ruler/>:<Upload/>}>{set.source_document_id?'Open takeoff':'Attach plans'}</Button>
                <Button as="a" href="/estimates" appearance="secondary" size="small" icon={<Calculator/>}>Estimate</Button>
                {locked?<span className="ml-auto self-center text-xs text-muted-foreground">Accepted/issued geometry stays preserved with this revision.</span>:null}
              </div>
            </article>;
          })}</div>}
      </section>

    </div>
  </AppShell>;
}
