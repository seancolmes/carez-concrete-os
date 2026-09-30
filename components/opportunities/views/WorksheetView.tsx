import {estimateHref,opportunityHref,auditHref} from '../opportunityHref';
import {DeleteEstimateButton} from '@/components/estimates/DeleteEstimateButton';
import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeftRegular as ArrowLeft,CheckmarkCircleRegular as CheckCircle2,DocumentRegular as FileText,RulerRegular as Ruler,ShieldCheckmarkRegular as ShieldCheck} from '@fluentui/react-icons';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Button,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger,Input,Label,Select} from '@fluentui/react-components';
import {EstimateWorksheet} from '@/components/estimates/EstimateWorksheet';
import {EstimateWorkspaceTabs} from '@/components/estimates/EstimateWorkspaceTabs';
import {PricingCoverage} from '@/components/estimates/PricingCoverage';
import {LaborReview} from '@/components/estimates/LaborReview';
import viewStyles from './opportunity-view.module.css';
import {createClient} from '@/lib/supabase/server';
import {addEstimateSection,addEstimateItem,updateEstimatePricing} from '@/app/estimates/actions';
import {parseEstimateReleaseReadiness,releaseStateLabel} from '@/lib/estimating/releaseReadiness';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const units=['CY','LF','SF','LB','EA','HR','DAY','TON','GAL','LS'];
const secondaryAction='inline-flex items-center justify-center bg-secondary border border-input text-secondary-foreground text-xs font-medium px-4 py-2 rounded-lg hover:border-[var(--border-strong)] hover:bg-accent shadow-sm transition-all whitespace-nowrap';
const primaryAction='carez-button-primary text-sm font-medium px-5 py-2.5 rounded-lg border transition-all';
const masterSection='mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm';

export async function WorksheetView({estimateId}:{estimateId:string}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!p?.company_id)redirect('/login');if(p.role==='employee')redirect('/employee');
  const [{data:e},{data:s},{data:sections},{data:items},{data:codes},{data:catalog},{data:crew},{data:risk},{data:budget},{data:proposal},{data:takeoff},{data:measurements},{data:outputs},{data:quoteSets},{data:laborProfiles},{data:readinessData}]=await Promise.all([
    supabase.from('estimates').select('*').eq('id',estimateId).eq('company_id',p.company_id).maybeSingle(),
    supabase.from('estimate_financial_summary').select('*').eq('estimate_id',estimateId).eq('company_id',p.company_id).maybeSingle(),
    supabase.from('estimate_sections').select('*').eq('estimate_id',estimateId).eq('company_id',p.company_id).order('sort_order'),
    supabase.from('estimate_items').select('*').eq('estimate_id',estimateId).eq('company_id',p.company_id).order('sort_order'),
    supabase.from('cost_codes').select('*').eq('company_id',p.company_id).eq('active',true).order('sort_order'),
    supabase.from('cost_catalog_items').select('id,name,cost_code_id,default_unit').eq('company_id',p.company_id).eq('active',true).order('name'),
    supabase.from('crew_members').select('id,name,hourly_rate,internal_field_rate,is_owner').eq('company_id',p.company_id).eq('active',true).order('name'),
    supabase.from('li_risk_classes').select('code,name').eq('company_id',p.company_id).eq('tax_year',2026).eq('active',true).order('code'),
    supabase.from('project_budgets').select('id,label,status').eq('company_id',p.company_id).eq('estimate_id',estimateId).eq('status','active').maybeSingle(),
    supabase.from('proposal_presentations').select('id,proposal_number,status,sent_at').eq('company_id',p.company_id).eq('estimate_id',estimateId).order('sent_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('estimate_takeoff_summary').select('*').eq('estimate_id',estimateId).eq('company_id',p.company_id).maybeSingle(),
    supabase.from('takeoff_measurements').select('id,takeoff_set_id,name,location,drawing_reference,raw_quantity,raw_unit,estimate_section_id,created_at').eq('estimate_id',estimateId).eq('company_id',p.company_id).eq('status','active').order('created_at'),
    supabase.from('takeoff_measurement_outputs').select('id,measurement_id,generated_estimate_item_id,label,estimate_item_type,production_quantity,production_unit,estimated_man_hours,baseline_man_hours_per_unit,baseline_source,job_man_hours_per_unit,labor_assumption_override_by,labor_assumption_override_at,labor_rate_override_by,labor_rate_override_at,unit_cost,direct_cost,catalog_item_id,pricing_status,cost_source,price_source_kind,price_source_id,price_source_label,price_source_reference,price_effective_date,is_active,estimate_visible').eq('company_id',p.company_id).eq('is_active',true).eq('estimate_visible',true),
    supabase.from('estimate_supplier_quote_sets').select('id,estimate_id,name,bid_zone,scope_note,status,created_at').eq('estimate_id',estimateId).eq('company_id',p.company_id).order('created_at'),
    supabase.from('estimating_labor_profiles').select('id,name,burdened_hourly_rate,source_type,source_label,effective_date,is_default').eq('company_id',p.company_id).eq('active',true).order('is_default',{ascending:false}).order('name'),
    supabase.rpc('carez_get_estimate_release_readiness',{p_estimate_id:estimateId}),
  ]);
  if(!e)notFound();
  const {data:opportunity}=e.lead_id?await supabase.from('leads').select('id,opportunity_number').eq('id',e.lead_id).eq('company_id',p.company_id).maybeSingle():{data:null};
  const readiness=parseEstimateReleaseReadiness(readinessData);

  const estimateMeasurementIds=new Set((measurements||[]).map((row:any)=>row.id));
  const estimateOutputs=(outputs||[]).filter((row:any)=>estimateMeasurementIds.has(row.measurement_id));

  const quoteSetIds=(quoteSets||[]).map((row:any)=>row.id);
  let quotes:any[]=[];
  if(quoteSetIds.length){
    const {data,error}=await supabase.from('estimate_supplier_quotes')
      .select('id,quote_set_id,supplier_name,supplier_quote_number,quote_date,expires_at,status,notes')
      .eq('company_id',p.company_id)
      .in('quote_set_id',quoteSetIds)
      .order('quote_date',{ascending:false});
    if(error)throw new Error(error.message);
    quotes=data||[];
  }
  const quoteIds=quotes.map((row:any)=>row.id);
  let quoteLines:any[]=[];
  if(quoteIds.length){
    const {data,error}=await supabase.from('estimate_supplier_quote_lines')
      .select('id,quote_id,source_takeoff_output_id,generated_estimate_item_id,description,quoted_unit,quoted_unit_cost,freight_tax_fee_notes,source_reference')
      .eq('company_id',p.company_id)
      .in('quote_id',quoteIds)
      .order('created_at');
    if(error)throw new Error(error.message);
    quoteLines=data||[];
  }
  const today=new Date().toISOString().slice(0,10);

  const locked=['accepted','approved','superseded'].includes(e.status)||Boolean(proposal);
  const display=`${e.estimate_number}-R${Number(e.version||0)}`;
  const itemsBySection=new Map<string,any[]>();
  for(const item of items||[]){const key=item.section_id||'unassigned';const rows=itemsBySection.get(key)||[];rows.push(item);itemsBySection.set(key,rows);}
  const selectedPrice=num(s?.selected_sell_price||s?.recommended_sell_price||e.proposed_sell_price);
  const recommended=num(s?.recommended_sell_price);
  const margin=num(s?.projected_margin_percent);
  const target=num(e.target_margin_percent);
  const takeoffObjects=num(takeoff?.active_measurements);
  const holds=num(takeoff?.missing_price_outputs);
  const stage=e.status==='accepted'||e.status==='approved'?'Awarded':proposal?'Proposal Issued':e.status==='ready'?'Ready for Review':e.status==='superseded'?'Superseded':'Pricing';
  const blockers=readiness.blockers;
  const warnings=readiness.warnings;
  const readinessStatus=releaseStateLabel(readiness.release_state);
  const outputIds=new Set(estimateOutputs.map((row:any)=>String(row.id)));
  const measurementById=new Map((measurements||[]).map((row:any)=>[String(row.id),row]));
  const outputById=new Map(estimateOutputs.map((row:any)=>[String(row.id),row]));
  const takeoffHref=(recordId:string|null|undefined)=>{
    const output=recordId?outputById.get(recordId):null;
    const measurementId=output?.measurement_id||recordId;
    const measurement=measurementId?measurementById.get(measurementId):null;
    return measurement?.takeoff_set_id?`/takeoff/${encodeURIComponent(measurement.takeoff_set_id)}?measurement=${encodeURIComponent(measurementId)}`:'/takeoff';
  };
  const blockerHref=(finding:(typeof blockers)[number])=>{
    if(finding.next_action==='pricing')return finding.record_id&&outputIds.has(finding.record_id)?estimateHref(e.id,'worksheet','#pricing-coverage',`pricingOutput=${encodeURIComponent(finding.record_id)}`):estimateHref(e.id,'worksheet','#pricing-coverage');
    if(finding.next_action==='labor')return estimateHref(e.id,'worksheet','#labor-review');
    if(finding.next_action==='scope'||finding.next_action==='margin')return estimateHref(e.id,'worksheet','#scope-cost');
    if(finding.next_action==='takeoff')return takeoffHref(finding.record_id);
    return auditHref(e.id);
  };

  return <div className={`${viewStyles.workspace} carez-estimate-workspace flex w-full min-w-0 flex-col gap-4`}>
    <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{opportunity&&<><Link className={secondaryAction} href={opportunityHref(opportunity.id)}>Opportunity {opportunity.opportunity_number}</Link><span aria-hidden="true"> · </span></>}{display} · {stage}</p><h1 className="mt-1 truncate text-base font-semibold tracking-tight text-foreground">{e.name}</h1></div>
      <div className="flex flex-wrap gap-2"><Link className={secondaryAction} href="/opportunities"><ArrowLeft/>Estimates</Link><Link data-role="takeoff-action" className={secondaryAction} href="/takeoff"><Ruler/>Takeoff</Link></div>
    </header>

    {proposal&&!['accepted','approved','superseded'].includes(e.status)&&<div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><strong>{proposal.proposal_number} is issued.</strong> <span className="text-muted-foreground">This exact estimate revision is read-only. Customer follow-up and the next revision are handled from Proposal.</span></div>}
    {['accepted','approved'].includes(e.status)&&<div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"><strong>Awarded baseline locked.</strong> Carez preserves this accepted price and scope while the project budget and Work Packages run from the snapshot.</div>}
    {e.status==='superseded'&&<div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><strong>Historical revision.</strong> <span className="text-muted-foreground">A newer revision replaced this one; it remains available for audit.</span></div>}

    {blockers.length>0&&<section className="carez-release-panel px-3 py-2 text-sm" aria-label="Release blockers"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-destructive">{blockers.length} release blocker{blockers.length===1?'':'s'}</strong><Link className={secondaryAction} href={auditHref(e.id)}>Full release review</Link></div><Accordion collapsible defaultOpenItems={['release-blockers']} className="mt-1"><AccordionItem value="release-blockers"><AccordionHeader>Release blockers</AccordionHeader><AccordionPanel><ul className="mt-1 divide-y text-xs">{blockers.map(finding=><li key={finding.finding_key} className="flex flex-wrap items-center justify-between gap-2 py-1.5"><span>{finding.title}</span><Link className={secondaryAction} href={blockerHref(finding)}>{finding.next_action==='pricing'&&finding.record_id&&outputIds.has(finding.record_id)?'Open output':finding.next_action==='labor'?'Labor review':finding.next_action==='takeoff'&&takeoffHref(finding.record_id)!=='/takeoff'?'Open Condition':finding.next_action==='takeoff'?'Takeoff':'Review'}</Link></li>)}</ul></AccordionPanel></AccordionItem></Accordion></section>}
    {blockers.length===0&&warnings.length>0&&<section className="border border-warning/30 bg-warning/5 px-3 py-2 text-sm" aria-label="Review warnings"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-warning">{warnings.length} review warning{warnings.length===1?'':'s'}</strong><Link className={secondaryAction} href={auditHref(e.id)}>Review warnings</Link></div><Accordion collapsible className="mt-1"><AccordionItem value="review-warnings"><AccordionHeader>Show warning details</AccordionHeader><AccordionPanel><ul className="mt-2 space-y-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">{warnings.map((finding:any)=><li key={finding.finding_key}>{finding.title}</li>)}</ul></AccordionPanel></AccordionItem></Accordion></section>}

    <EstimateWorkspaceTabs
      scope={<>
    <section className="carez-scope-ledger grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4" aria-label="Commercial estimator ledger">
      <LedgerMetric label="Customer price" value={money(selectedPrice)} help="Selected for this revision."/>
      <LedgerMetric label="Projected margin" value={`${margin.toFixed(1)}%`} help={`Target ${target.toFixed(1)}%.`} tone={margin<target?'warning':undefined}/>
      <LedgerMetric label="Pricing holds" value={String(holds)} help={holds?'Takeoff outputs require pricing.':'No holds.'} tone={holds?'warning':'success'}/>
      <LedgerMetric label="Release state" value={readinessStatus} help={`${readiness.blocker_count} blocker(s) · ${readiness.warning_count} warning(s).`} tone={readiness.release_state==='blocked'?'error':readiness.release_state==='review'?'warning':readiness.release_state==='release_ready'?'success':'default'}/>
    </section>
    <section className="carez-scope-workspace grid gap-4 xl:grid-cols-[minmax(290px,.72fr)_minmax(0,1.28fr)]">
      <section id="scope-cost" className={`${masterSection} carez-scope-module scroll-mt-6`}><div className="carez-scope-module-header border-b border-border bg-muted px-4 py-3"><div><h2>Scope &amp; cost</h2><p>{(sections||[]).length} scope area{(sections||[]).length===1?'':'s'} · {(items||[]).length} cost lines</p></div></div><div className="carez-scope-rows">{(sections||[]).map((section:any)=>{const rows=itemsBySection.get(section.id)||[];const cost=rows.reduce((sum:number,item:any)=>sum+num(item.direct_cost),0);const takeoffCount=rows.filter((item:any)=>item.source_takeoff_measurement_id).length;return <div className="carez-scope-row" key={section.id}><div><div className="font-medium">{section.name}</div><div className="mt-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">{String(section.scope_type).replaceAll('_',' ')} · {rows.length} cost line{rows.length===1?'':'s'}{takeoffCount?` · ${takeoffCount} from takeoff`:''}</div></div><strong className="font-mono tabular-nums">{money(cost)}</strong></div>;})}{(itemsBySection.get('unassigned')||[]).length>0&&<div className="carez-scope-row"><div><div className="font-medium">Unassigned / General</div><div className="mt-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">{itemsBySection.get('unassigned')!.length} cost lines</div></div><strong className="font-mono tabular-nums">{money(itemsBySection.get('unassigned')!.reduce((sum:number,item:any)=>sum+num(item.direct_cost),0))}</strong></div>}{(sections||[]).length===0&&(itemsBySection.get('unassigned')||[]).length===0&&<p className="px-4 py-5 text-sm leading-relaxed text-muted-foreground">No scope areas yet. Add the first area to organize this estimate.</p>}</div>

        {!locked&&<div className="carez-scope-module-footer"><AddScopeAreaDialog estimateId={e.id}/></div>}
      </section>

      <section id="price-margin" className={`${masterSection} carez-scope-module scroll-mt-6`}><div className="carez-scope-module-header border-b border-border bg-muted px-4 py-3"><div><h2>Price &amp; margin</h2><p>Commercial terms for this revision</p></div>{!locked&&<Button type="submit" form="estimate-price-form" className={primaryAction}>Save Estimate</Button>}</div><form id="estimate-price-form" action={updateEstimatePricing} className="carez-price-form grid gap-3 sm:grid-cols-3"><input type="hidden" name="estimate_id" value={e.id}/>
        <div className="grid gap-2"><Label htmlFor="customer-price">Customer price</Label><Input appearance="underline" id="customer-price" key={`customer-price-${selectedPrice.toFixed(2)}`} name="proposed_sell_price" type="number" min="0" step="0.01" defaultValue={String(selectedPrice)} disabled={locked}/><p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Recommended: {money(recommended)}</p></div>
        <div className="grid gap-2"><Label htmlFor="target-margin">Target profit margin %</Label><Input appearance="underline" id="target-margin" name="target_margin_percent" type="number" min="0" max="100" step="0.1" defaultValue={String(target)} disabled={locked}/></div>
        <div className="grid gap-2"><Label htmlFor="estimate-stage">Estimate stage</Label><Select id="estimate-stage" name="status" defaultValue={e.status} disabled={locked}><option value="draft">Still Pricing</option><option value="ready">Ready for Review</option><option value="declined">Lost / Declined</option>{e.status==='accepted'&&<option value="accepted">Customer Accepted</option>}{e.status==='approved'&&<option value="approved">Approved</option>}{e.status==='superseded'&&<option value="superseded">Superseded</option>}</Select></div>
        <Accordion collapsible className="sm:col-span-2"><AccordionItem value="tax"><AccordionHeader>Tax / transaction assumptions</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="grid gap-4 border-t border-border p-3"><div className="grid gap-2"><Label htmlFor="bo-classification">WA B&amp;O type</Label><Select id="bo-classification" name="bo_classification" defaultValue={e.bo_classification} disabled={locked}><option value="retailing">Retailing</option><option value="wholesaling">Wholesaling</option></Select></div><div className="grid gap-2"><Label htmlFor="processing-rate">Card / processing reserve %</Label><Input appearance="underline" id="processing-rate" name="payment_processing_rate_percent" type="number" step="0.01" min="0" defaultValue={String(num(e.payment_processing_rate_percent))} disabled={locked}/></div></div></AccordionPanel></AccordionItem></Accordion>
      </form>

      <div className="carez-price-breakdown" aria-label="Price calculation"><div className="carez-price-breakdown-heading">Price calculation</div>{[['Price',money(selectedPrice)],['Company cost',money(s?.base_company_cost)],['Revenue reserve',money(s?.revenue_cost_reserve)],['Projected profit',money(s?.projected_profit)]].map(([label,value])=><div className="carez-price-breakdown-row" key={label}><span>{label}</span><strong className="font-mono tabular-nums">{value}</strong></div>)}</div>
      </section>
    </section></>}
      pricing={<>    <div id="pricing-coverage" className="scroll-mt-48"><PricingCoverage estimateId={e.id} measurements={measurements||[]} outputs={estimateOutputs} quoteSets={quoteSets||[]} quotes={quotes} quoteLines={quoteLines} locked={locked} today={today}/></div></>}
      labor={<>    <div id="labor-review" className="scroll-mt-48"><LaborReview estimateId={e.id} measurements={measurements||[]} outputs={estimateOutputs} laborProfiles={laborProfiles||[]} locked={locked}/></div></>}
      lines={<>    <section className="space-y-4" aria-labelledby="estimate-lines"><div><div className="carez-page-heading"><h2 id="estimate-lines" className="scroll-mt-48">Estimate lines</h2></div></div>
      <EstimateWorksheet estimateId={e.id} sections={sections||[]} measurements={measurements||[]} items={items||[]} outputs={estimateOutputs} locked={locked}/>

      {!locked&&<AddExceptionCostDialog estimateId={e.id} sections={sections||[]} catalog={catalog||[]} codes={codes||[]} crew={crew||[]} risk={risk||[]}/>}
    </section></>}
    />

    {(proposal||e.status==='ready'||['accepted','approved'].includes(e.status))&&<section className="flex flex-col gap-4 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold">{locked?(proposal?'Customer / revision workflow':'Awarded estimate'):holds?'Resolve takeoff pricing holds':e.status==='ready'?'Review release readiness':'Finish pricing and mark Ready'}</h2><p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted-foreground">{locked?'This revision is preserved exactly as issued/accepted.':holds?'Return to Takeoff and clear current material or labor pricing before this bid can advance.':e.status==='ready'?'Review the current release state, blockers and commercial warnings before Proposal.':'Once scope, price and margin are right, change Estimate Stage to Ready for Review.'}</p>{budget&&<p className="mt-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">Frozen project budget: {budget.label}</p>}</div><div className="flex flex-wrap gap-2">{!locked&&holds>0&&<Link className={secondaryAction} href="/takeoff"><Ruler/>Resolve in Takeoff</Link>}{!locked&&e.status==='ready'&&<Link className={secondaryAction} href={auditHref(e.id)}><ShieldCheck/>Review Estimate</Link>}{!locked&&e.status==='ready'&&<Link className={secondaryAction} href={estimateHref(e.id,'proposal')}><FileText/>Proposal</Link>}{proposal&&<Link className={secondaryAction} href={estimateHref(e.id,'proposal')}><FileText/>Open Proposal</Link>}{['accepted','approved'].includes(e.status)&&e.project_id&&<Link className={secondaryAction} href={`/projects/${e.project_id}`}><CheckCircle2/>Open Job</Link>}</div></section>}
    {['owner','office','estimator'].includes(p.role)&&<Accordion collapsible className="rounded-md border border-border p-3"><AccordionItem value="estimate-settings"><AccordionHeader>Estimate Settings</AccordionHeader><AccordionPanel><div className="pt-3"><DeleteEstimateButton estimateId={e.id}/></div></AccordionPanel></AccordionItem></Accordion>}
  </div>;
}

function LedgerMetric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'|'error'}){
  const toneClass=tone==='success'?'text-success':tone==='warning'?'text-warning':tone==='error'?'text-destructive':'';
  return <div className="min-w-0 bg-card px-3 py-2"><div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</div><div className={`mt-1 break-words font-mono text-base font-semibold tabular-nums sm:text-lg ${toneClass}`}>{value}</div><div className="mt-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">{help}</div></div>;
}

function AddScopeAreaDialog({estimateId}:{estimateId:string}){
  return <Dialog>
    <DialogTrigger disableButtonEnhancement><Button type="button" appearance="outline" size="small">Add scope area</Button></DialogTrigger>
    <DialogSurface><DialogBody>
      <DialogTitle>Add scope area</DialogTitle>
      <DialogContent>
        <p className="mb-4 text-sm text-muted-foreground">Add a physical area or assembly to this revision.</p>
        <form action={addEstimateSection} className="grid gap-4">
          <input type="hidden" name="estimate_id" value={estimateId}/>
          <div className="grid gap-2"><Label htmlFor="scope-name">Physical area / assembly</Label><Input appearance="underline" id="scope-name" name="name" required placeholder="Basement Walls · Garage Slab · Driveway"/></div>
          <div className="grid gap-2"><Label htmlFor="scope-type">Concrete work type</Label><Select id="scope-type" name="scope_type" defaultValue="footing"><option value="footing">Footing</option><option value="wall">Wall</option><option value="flatwork">Flatwork</option><option value="curb">Curb / Sidewalk</option><option value="repair">Repair</option><option value="other">Other</option></Select></div>
          <Button type="submit" appearance="primary">Add scope area</Button>
        </form>
      </DialogContent>
    </DialogBody></DialogSurface>
  </Dialog>;
}

function AddExceptionCostDialog({estimateId,sections,catalog,codes,crew,risk}:{estimateId:string;sections:any[];catalog:any[];codes:any[];crew:any[];risk:any[]}){
  return <Dialog>
    <DialogTrigger disableButtonEnhancement><Button type="button" appearance="outline" size="small">Add exception cost</Button></DialogTrigger>
    <DialogSurface className="max-h-[85dvh] overflow-y-auto"><DialogBody>
      <DialogTitle>Add cost outside the assembly</DialogTitle>
      <DialogContent>
        <p className="mb-4 text-sm text-muted-foreground">Use this for a real cost that the concrete takeoff assembly does not represent.</p>
        <form action={addEstimateItem} className="grid gap-4">
          <input type="hidden" name="estimate_id" value={estimateId}/>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="exception-section">Scope area</Label><Select id="exception-section" name="section_id" defaultValue=""><option value="">Unassigned / general</option>{sections.map(section=><option key={section.id} value={section.id}>{section.name}</option>)}</Select></div>
            <div className="grid gap-2"><Label htmlFor="exception-type">Cost type</Label><Select id="exception-type" name="item_type" defaultValue="material"><option value="labor">Labor</option><option value="material">Material</option><option value="equipment">Equipment</option><option value="subcontractor">Subcontractor</option><option value="other">Other</option></Select></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="exception-description">Description</Label><Input appearance="underline" id="exception-description" name="description" required placeholder="Concrete pump · specialty finish · unusual rental…"/></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="exception-catalog">Saved cost item</Label><Select id="exception-catalog" name="catalog_item_id" defaultValue=""><option value="">Custom</option>{catalog.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
            <div className="grid gap-2"><Label htmlFor="exception-code">Cost code</Label><Select id="exception-code" name="cost_code_id" defaultValue=""><option value="">Automatic / none</option>{codes.map(code=><option key={code.id} value={code.id}>{code.code} — {code.name}</option>)}</Select></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="exception-quantity">Quantity</Label><Input appearance="underline" id="exception-quantity" name="quantity" type="number" step="0.01" min="0" defaultValue="1"/></div>
            <div className="grid gap-2"><Label htmlFor="exception-unit">Unit</Label><Select id="exception-unit" name="unit" defaultValue="LS">{units.map(unit=><option key={unit} value={unit}>{unit}</option>)}</Select></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="exception-unit-cost">Unit cost</Label><Input appearance="underline" id="exception-unit-cost" name="unit_cost" type="number" step="0.01" min="0" defaultValue="0"/></div>
          <Accordion collapsible><AccordionItem value="labor"><AccordionHeader>Labor-only fields</AccordionHeader><AccordionPanel>
            <div className="grid gap-3">
              <div className="grid gap-2"><Label htmlFor="exception-worker">Worker</Label><Select id="exception-worker" name="crew_member_id" defaultValue=""><option value="">Not labor</option>{crew.map(worker=><option key={worker.id} value={worker.id}>{worker.name}</option>)}</Select></div>
              <div className="grid gap-2"><Label htmlFor="exception-risk">L&amp;I work class</Label><Select id="exception-risk" name="risk_class_code" defaultValue="0217-01"><option value="">Owner / not applicable</option>{risk.map(row=><option key={row.code} value={row.code}>{row.code} — {row.name}</option>)}</Select></div>
              <div className="grid gap-2"><Label htmlFor="exception-task">Labor operation</Label><Select id="exception-task" name="labor_task" defaultValue="General">{['Formwork','Rebar','Placement','Finishing','Strip','Cleanup','Layout','General'].map(task=><option key={task} value={task}>{task}</option>)}</Select></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="exception-regular-hours">Regular hours</Label><Input appearance="underline" id="exception-regular-hours" name="regular_hours" type="number" step="0.25" min="0"/></div><div className="grid gap-2"><Label htmlFor="exception-ot-hours">OT hours</Label><Input appearance="underline" id="exception-ot-hours" name="overtime_hours" type="number" step="0.25" min="0"/></div></div>
            </div>
          </AccordionPanel></AccordionItem></Accordion>
          <Button type="submit" appearance="primary">Add exception cost</Button>
        </form>
      </DialogContent>
    </DialogBody></DialogSurface>
  </Dialog>;
}
