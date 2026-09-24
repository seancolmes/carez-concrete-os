import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {buttonVariants} from '@/components/ui/button';
import {createClient} from '@/lib/supabase/server';
import {parseEstimateReleaseReadiness,releaseStateLabel,type ReleaseFinding,type ReleaseFindingAction} from '@/lib/estimating/releaseReadiness';
import {getPricingCoverageSummary} from '@/lib/estimating/pricingCoverage';
import {getLaborReviewSummary} from '@/lib/estimating/laborReview';
import {acknowledgeEstimateReview} from '../actions';

const money=(value:unknown)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0));
const label=(value:unknown)=>String(value||'—').replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
const releaseStateClass=(state:string)=>state==='blocked'?'border-destructive/30 bg-destructive/10 text-destructive':state==='review'?'border-warning/30 bg-warning/10 text-warning':state==='release_ready'?'border-success/30 bg-success/10 text-success':'border-border bg-muted/30 text-muted-foreground';
const findingHref=(estimateId:string,action:ReleaseFindingAction)=>{
  if(action==='pricing')return `/estimates/${estimateId}#pricing-coverage`;
  if(action==='labor')return `/estimates/${estimateId}#labor-review`;
  if(action==='scope')return `/estimates/${estimateId}#scope-cost`;
  if(action==='margin')return `/estimates/${estimateId}#price-margin`;
  if(action==='proposal_setup')return `/proposals/${estimateId}`;
  return '/takeoff';
};

export default async function EstimateAuditPage({searchParams}:{searchParams:Promise<{estimate?:string}>}){
  const {estimate:estimateId}=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;

  if(!estimateId){
    const {data:estimates,error}=await supabase.from('estimates').select('id,estimate_number,version,name,status').eq('company_id',companyId).order('updated_at',{ascending:false}).limit(50);
    if(error)throw new Error(error.message);
    const rows=await Promise.all((estimates||[]).map(async estimate=>{
      const {data,error:readinessError}=await supabase.rpc('carez_get_estimate_release_readiness',{p_estimate_id:estimate.id});
      if(readinessError)throw new Error(readinessError.message);
      return {estimate,readiness:parseEstimateReleaseReadiness(data)};
    }));
    return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="carez-page-heading"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimating · Release control</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Estimate Review / Recap</h1><p className="mt-1 text-sm text-muted-foreground">Current release state for recent Estimates, evaluated by the database.</p></header>
      {rows.length===0?<p className="border-y border-border py-8 text-sm text-muted-foreground">No Estimates are available for review.</p>:<div className="divide-y border-y border-border">{rows.map(({estimate,readiness})=><Link key={estimate.id} href={`/estimates/audit?estimate=${estimate.id}`} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><span><strong>{estimate.estimate_number}-R{estimate.version} · {estimate.name}</strong><span className="mt-1 block text-sm text-muted-foreground">Estimate status: {label(estimate.status)} · {readiness.blocker_count} blocker(s) · {readiness.warning_count} warning(s)</span></span><Badge variant="outline" className={releaseStateClass(readiness.release_state)}>{releaseStateLabel(readiness.release_state)}</Badge></Link>)}</div>}
    </div></AppShell>;
  }

  const {data:estimate,error:estimateError}=await supabase.from('estimates').select('id,estimate_number,version,name,status,target_margin_percent,bo_classification,bo_rate_percent,payment_processing_rate_percent').eq('id',estimateId).eq('company_id',companyId).maybeSingle();
  if(estimateError)throw new Error(estimateError.message);
  if(!estimate)notFound();
  const [readinessResult,summaryResult,sectionsResult,itemsResult,measurementsResult,proposalSettingsResult,billingResult,latestAckResult,quoteSetsResult]=await Promise.all([
    supabase.rpc('carez_get_estimate_release_readiness',{p_estimate_id:estimateId}),
    supabase.from('estimate_financial_summary').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('estimate_sections').select('id,name,scope_type,sort_order').eq('estimate_id',estimateId).eq('company_id',companyId).order('sort_order'),
    supabase.from('estimate_items').select('id,section_id,description,item_type,direct_cost,quantity,unit,source_takeoff_output_id,source_takeoff_measurement_id,production_quantity,production_unit,unit_cost,price_source_kind,price_source_id,price_source_label,price_source_reference,baseline_man_hours_per_unit,baseline_source,job_man_hours_per_unit').eq('estimate_id',estimateId).eq('company_id',companyId).order('sort_order'),
    supabase.from('takeoff_measurements').select('id,name,location,drawing_reference,estimate_section_id,status').eq('estimate_id',estimateId).eq('company_id',companyId).eq('status','active').order('created_at'),
    supabase.from('proposal_settings').select('schedule_summary,payment_summary,terms_text').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('company_billing_profiles').select('default_terms_text').eq('company_id',companyId).maybeSingle(),
    supabase.from('estimate_review_acknowledgements').select('acknowledged_by,acknowledged_at').eq('estimate_id',estimateId).eq('company_id',companyId).order('acknowledged_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('estimate_supplier_quote_sets').select('id,name,status').eq('estimate_id',estimateId).eq('company_id',companyId).order('created_at'),
  ]);
  if(readinessResult.error)throw new Error(readinessResult.error.message);
  const readiness=parseEstimateReleaseReadiness(readinessResult.data);
  const summary=summaryResult.data||{};
  const sections=sectionsResult.data||[];
  const items=itemsResult.data||[];
  const measurements=measurementsResult.data||[];
  const proposalSettings=(proposalSettingsResult.data||{}) as {schedule_summary?:string|null;payment_summary?:string|null;terms_text?:string|null};
  const latestAck=latestAckResult.data;
  const quoteSets=quoteSetsResult.data||[];
  const measurementIds=measurements.map(measurement=>measurement.id);
  const [{data:outputs},{data:quotes}]=await Promise.all([
    measurementIds.length?supabase.from('takeoff_measurement_outputs').select('id,measurement_id,generated_estimate_item_id,label,estimate_item_type,production_quantity,production_unit,estimated_man_hours,baseline_man_hours_per_unit,baseline_source,job_man_hours_per_unit,labor_assumption_override_by,labor_assumption_override_at,labor_rate_override_by,labor_rate_override_at,direct_cost,pricing_status,cost_source,price_source_kind,price_source_id,price_source_label,price_source_reference,price_effective_date').eq('company_id',companyId).in('measurement_id',measurementIds).eq('is_active',true).eq('estimate_visible',true):Promise.resolve({data:[]}),
    quoteSets.length?supabase.from('estimate_supplier_quotes').select('id,quote_set_id,supplier_name,quote_date,expires_at,status').eq('company_id',companyId).in('quote_set_id',quoteSets.map(set=>set.id)).order('quote_date',{ascending:false}):Promise.resolve({data:[]}),
  ]);
  const quoteIds=(quotes||[]).map(quote=>quote.id);
  const {data:quoteLines}=quoteIds.length?await supabase.from('estimate_supplier_quote_lines').select('id,quote_id,source_takeoff_output_id,description,quoted_unit,quoted_unit_cost,source_reference').eq('company_id',companyId).in('quote_id',quoteIds).order('created_at'):({data:[]});
  const quoteById=new Map((quotes||[]).map(quote=>[quote.id,quote]));
  const pricingQuoteLines=(quoteLines||[]).map(line=>({id:line.id,source_takeoff_output_id:line.source_takeoff_output_id,expires_at:quoteById.get(line.quote_id)?.expires_at,quote_status:quoteById.get(line.quote_id)?.status}));
  const activeOutputs=outputs||[];
  const pricing=getPricingCoverageSummary({outputs:activeOutputs,quoteLines:pricingQuoteLines,today:new Date().toISOString().slice(0,10)});
  const labor=getLaborReviewSummary(activeOutputs);
  const baselineAssumptions=activeOutputs.filter(output=>output.estimate_item_type==='labor'&&output.baseline_man_hours_per_unit!==null&&output.baseline_man_hours_per_unit!==undefined).length;
  const explicitLaborRates=activeOutputs.filter(output=>output.estimate_item_type==='labor'&&output.labor_rate_override_at!==null&&output.labor_rate_override_at!==undefined).length;
  const catalogSources=activeOutputs.filter(output=>output.price_source_kind==='company_catalog').length;
  const templateSources=activeOutputs.filter(output=>output.price_source_kind==='template_default').length;
  const activeOutputIds=activeOutputs.map(output=>output.id);
  const outputByItemId=new Map(activeOutputs.filter(output=>output.generated_estimate_item_id).map(output=>[output.generated_estimate_item_id,output]));
  const generatedItems=items.filter(item=>(item.source_takeoff_output_id&&activeOutputIds.includes(item.source_takeoff_output_id))||outputByItemId.has(item.id));
  const conditionOutputResult=activeOutputIds.length?await supabase.from('project_condition_outputs').select('id,legacy_takeoff_output_id,generated_estimate_item_id,condition_version_id,module_instance_id,output_key,label,resource_class').eq('company_id',companyId).in('legacy_takeoff_output_id',activeOutputIds):{data:[]};
  const conditionOutputs=conditionOutputResult.data||[];
  const roleResult=measurementIds.length?await supabase.from('project_condition_measurement_roles').select('measurement_id,condition_version_id,role_key,role_instance_key').eq('company_id',companyId).in('measurement_id',measurementIds):{data:[]};
  const roles=roleResult.data||[];
  const conditionVersionIds=[...new Set([...conditionOutputs.map(row=>row.condition_version_id),...roles.map(row=>row.condition_version_id)].filter(Boolean))];
  const versionResult=conditionVersionIds.length?await supabase.from('project_concrete_condition_versions').select('id,condition_id,revision_no,template_version_id,archetype_version_id,condition_code_snapshot,condition_name_snapshot').eq('company_id',companyId).in('id',conditionVersionIds):{data:[]};
  const versions=versionResult.data||[];
  const templateVersionIds=[...new Set(versions.map(row=>row.template_version_id).filter(Boolean))];
  const archetypeVersionIds=[...new Set(versions.map(row=>row.archetype_version_id).filter(Boolean))];
  const [templateVersionResult,archetypeVersionResult,moduleResult]=await Promise.all([
    templateVersionIds.length?supabase.from('company_condition_template_versions').select('id,version_no,template_code_snapshot,template_name_snapshot').eq('company_id',companyId).in('id',templateVersionIds):Promise.resolve({data:[]}),
    archetypeVersionIds.length?supabase.from('platform_condition_archetype_versions').select('id,version_no,archetype_code_snapshot,archetype_name_snapshot').in('id',archetypeVersionIds):Promise.resolve({data:[]}),
    conditionOutputs.some(row=>row.module_instance_id)?supabase.from('project_condition_module_instances').select('id,module_key,instance_key,label').eq('company_id',companyId).in('id',conditionOutputs.map(row=>row.module_instance_id).filter(Boolean)):Promise.resolve({data:[]}),
  ]);
  const templateVersionById=new Map((templateVersionResult.data||[]).map(row=>[row.id,row]));
  const archetypeVersionById=new Map((archetypeVersionResult.data||[]).map(row=>[row.id,row]));
  const moduleById=new Map((moduleResult.data||[]).map(row=>[row.id,row]));
  const conditionIds=[...new Set(versions.map(row=>row.condition_id).filter(Boolean))];
  const conditionResult=conditionIds.length?await supabase.from('project_concrete_conditions').select('id,code,name').eq('company_id',companyId).in('id',conditionIds):{data:[]};
  const conditions=new Map((conditionResult.data||[]).map(row=>[row.id,row]));
  const versionById=new Map(versions.map(row=>[row.id,row]));
  const scopeRecaps=sections.map(section=>{
    const sectionMeasurements=measurements.filter(measurement=>measurement.estimate_section_id===section.id);
    const sectionMeasurementIds=new Set(sectionMeasurements.map(measurement=>measurement.id));
    const sectionOutputs=activeOutputs.filter(output=>sectionMeasurementIds.has(output.measurement_id));
    const sectionOutputIds=new Set(sectionOutputs.map(output=>output.id));
    const sectionItems=items.filter(item=>item.section_id===section.id&&(!item.source_takeoff_output_id||activeOutputIds.includes(item.source_takeoff_output_id))&&(!item.source_takeoff_measurement_id||measurementIds.includes(item.source_takeoff_measurement_id)));
    const sectionConditionIds=new Set<string>();
    for(const row of conditionOutputs)if(sectionOutputIds.has(row.legacy_takeoff_output_id||'')){const version=versions.find(value=>value.id===row.condition_version_id);if(version)sectionConditionIds.add(version.condition_id);}
    for(const role of roles)if(sectionMeasurementIds.has(role.measurement_id)){const version=versions.find(value=>value.id===role.condition_version_id);if(version)sectionConditionIds.add(version.condition_id);}
    return {section,measurementCount:sectionMeasurements.length,outputCount:sectionOutputs.length,conditionCount:sectionConditionIds.size,items:sectionItems,directCost:sectionItems.reduce((total,item)=>total+Number(item.direct_cost||0),0)};
  });
  const rolesByMeasurement=new Map<string,typeof roles>();
  for(const role of roles)rolesByMeasurement.set(role.measurement_id,[...(rolesByMeasurement.get(role.measurement_id)||[]),role]);
  const outputById=new Map(activeOutputs.map(output=>[output.id,output]));
  const measurementById=new Map(measurements.map(measurement=>[measurement.id,measurement]));
  const latestReviewerId=latestAck?.acknowledged_by;
  const {data:latestReviewer}=latestReviewerId?await supabase.from('profiles').select('full_name,email').eq('id',latestReviewerId).eq('company_id',companyId).maybeSingle():{data:null};
  const blockers=readiness.blockers;
  const warnings=readiness.warnings;
  const canAcknowledge=readiness.release_state==='review'&&readiness.blocker_count===0&&readiness.warning_count>0;
  const staleAcknowledgement=Boolean(readiness.latest_acknowledgement_id)&&!readiness.acknowledgement_valid;
  const warningKeys=new Set(warnings.map(finding=>finding.finding_key));
  const commercialDecisions=[
    ...activeOutputs.filter(output=>warningKeys.has(`manual_price_override:${output.id}`)).map(output=>({id:`manual-${output.id}`,label:'Manual price override',detail:`${output.label} · ${output.price_source_label||output.price_source_reference||'Manual price'}: ${output.price_source_reference||'explicit override'}`})),
    ...activeOutputs.filter(output=>output.price_source_kind==='supplier_quote'&&output.price_source_id).map(output=>{const quoteLine=(quoteLines||[]).find(line=>line.id===output.price_source_id);const quote=quoteLine?quoteById.get(quoteLine.quote_id):null;const expired=Boolean(quote?.expires_at&&quote.expires_at.slice(0,10)<new Date().toISOString().slice(0,10));return {id:`quote-${output.id}`,label:expired?'Expired selected supplier quote':'Selected supplier quote',detail:`${output.label} · ${quote?.supplier_name||output.price_source_label||'Supplier quote'}${quote?.quote_date?` · ${quote.quote_date}`:''}`};}),
    ...activeOutputs.filter(output=>warningKeys.has(`labor_job_override:${output.id}`)).map(output=>({id:`job-mh-${output.id}`,label:'Job MH/unit override',detail:`${output.label} · ${output.baseline_man_hours_per_unit??'No baseline'} baseline → ${output.job_man_hours_per_unit} Job MH/unit`})),
    ...activeOutputs.filter(output=>output.estimate_item_type==='labor'&&output.labor_rate_override_at&&warningKeys.has(`labor_rate_selection:${output.id}`)).map(output=>({id:`labor-rate-${output.id}`,label:'Explicit labor-rate selection',detail:`${output.label} · ${output.price_source_label||output.cost_source||'Selected labor rate'}`})),
    ...warnings.filter(finding=>finding.finding_key==='margin_below_target').map(finding=>({id:'margin-below-target',label:'Customer Sell below target',detail:finding.detail})),
  ];
  const costRows=[
    ['Direct labor',summary.direct_labor_cost],['Material',summary.material_cost],['Equipment',summary.equipment_cost],
    ['Subcontractor',summary.subcontractor_cost],['Other direct cost',summary.other_direct_cost],['Total direct cost',summary.total_direct_cost],
    ['Company overhead',summary.overhead_cost],['Revenue / transaction reserves',summary.revenue_cost_reserve],['Base company cost',summary.base_company_cost],
    ['Recommended sell',summary.recommended_sell_price],['Customer sell',summary.selected_sell_price],['Projected profit',summary.projected_profit],
  ] as const;

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{estimate.estimate_number}-R{estimate.version} · Release control</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Estimate Review / Recap</h1><p className="mt-1 text-sm text-muted-foreground">{estimate.name} · Current commercial state, exceptions and traceability.</p></div><div className="flex gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/estimates">Estimates</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href={`/estimates/${estimateId}`}>Open Estimate</Link></div></header>

    <section className="flex flex-col gap-3 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Release state"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Release state</p><div className="mt-1 flex items-center gap-3"><Badge variant="outline" className={releaseStateClass(readiness.release_state)}>{releaseStateLabel(readiness.release_state)}</Badge><span className="text-sm text-muted-foreground">{readiness.blocker_count} blocker(s) · {readiness.warning_count} warning(s)</span></div></div></section>

    <section className="border-y border-border py-4" aria-labelledby="commercial-recap"><h2 id="commercial-recap" className="text-lg font-semibold">Commercial Recap</h2><p className="mt-1 text-sm text-muted-foreground">Server-authoritative cost composition, reserves and selling result.</p><div className="mt-3 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">{costRows.map(([name,value])=><div key={name} className="flex justify-between gap-3 border-b border-border/70 py-2 text-sm"><span className="text-muted-foreground">{name}</span><strong className="font-mono tabular-nums">{money(value)}</strong></div>)}<Fact label="B&O classification / rate" value={`${label(estimate.bo_classification)} · ${Number(estimate.bo_rate_percent||0).toFixed(3)}%`}/><Fact label="Payment / transaction reserve assumption" value={`${Number(estimate.payment_processing_rate_percent||0).toFixed(3)}%`}/><div className="flex justify-between gap-3 border-b border-border/70 py-2 text-sm"><span className="text-muted-foreground">Projected / target margin</span><strong className="font-mono tabular-nums">{Number(summary.projected_margin_percent||0).toFixed(1)}% / {Number(estimate.target_margin_percent||0).toFixed(1)}%</strong></div></div></section>

    <FindingSection title="Blockers" findings={blockers} estimateId={estimateId} severity="blocker"/>
    <FindingSection title="Warnings" findings={warnings} estimateId={estimateId} severity="warning"/>

    {canAcknowledge&&<form action={acknowledgeEstimateReview} className="flex flex-wrap items-center gap-3 border-b border-border pb-4"><input type="hidden" name="estimate_id" value={estimateId}/><span className="text-xs text-muted-foreground">This acknowledgement applies to the complete warning set for the current commercial state.</span><button className={buttonVariants({size:'sm'})} type="submit">Reviewed / proceed</button></form>}

    <section className="border-y border-border py-4"><h2 className="text-lg font-semibold">Commercial Decisions</h2><p className="mt-1 text-sm text-muted-foreground">Current pricing, production and selling decisions from the active Estimate lineage.</p>{commercialDecisions.length>0?<ul className="mt-3 divide-y border-y border-border">{commercialDecisions.map(decision=><li key={decision.id} className="py-3"><strong>{decision.label}</strong><span className="block text-sm text-muted-foreground">{decision.detail}</span></li>)}</ul>:<p className="mt-3 text-sm text-muted-foreground">No current commercial decisions require review.</p>}{staleAcknowledgement&&<p className="mt-3 border-y border-warning/40 py-3 text-sm text-warning">A previous review by {latestReviewer?.full_name||latestReviewer?.email||'a team member'}{latestReviewer?.email&&latestReviewer.full_name?` (${latestReviewer.email})`:''} at {latestAck?.acknowledged_at||readiness.latest_acknowledged_at||'an earlier time'} is stale. Current Estimate review warnings require acknowledgement again.</p>}</section>

    <section className="border-y border-border py-4"><h2 className="text-lg font-semibold">Scope Recap</h2><div className="mt-3 divide-y border-y border-border">{scopeRecaps.map(({section,conditionCount,measurementCount,outputCount,items:sectionItems,directCost})=><div key={section.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><span><strong>{section.name}</strong><span className="block text-sm text-muted-foreground">{label(section.scope_type)} · {conditionCount} Condition(s) · {measurementCount} active Takeoff measurement(s) · {outputCount} active generated output(s) · {sectionItems.length} Estimate item(s)</span></span><strong className="font-mono tabular-nums">{money(directCost)}</strong></div>)}{sections.length===0&&<p className="py-3 text-sm text-muted-foreground">No Estimate scope areas are recorded.</p>}</div></section>

    <section id="pricing-coverage" className="scroll-mt-6 border-y border-border py-4"><h2 className="text-lg font-semibold">Pricing Recap</h2><p className="mt-1 text-sm text-muted-foreground">Counts are summarized from active Estimate measurement outputs and selected supplier evidence.</p><div className="mt-3 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3"><Fact label="Generated resources" value={String(pricing.total)}/><Fact label="Priced" value={String(pricing.priced)}/><Fact label="Missing price" value={String(pricing.missingPrice)}/><Fact label="Supplier quote selected" value={String(pricing.supplierQuote)}/><Fact label="Catalog source" value={String(catalogSources)}/><Fact label="Template / default source" value={String(templateSources)}/><Fact label="Manual override" value={String(pricing.manualOverride)}/><Fact label="Expired selected quote" value={String(pricing.expiredSupplierQuote)}/><Fact label="Unused supplier evidence" value={String(pricing.availableUnselectedQuoteLines)}/></div><div className="mt-3 divide-y border-y border-border">{activeOutputs.filter(output=>output.estimate_item_type!=='labor').map(output=><div key={output.id} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:justify-between"><span>{output.label} · {label(output.pricing_status)}{output.price_source_label?` · ${output.price_source_label}`:''}</span><span className="text-muted-foreground">{output.production_quantity} {output.production_unit}</span></div>)}</div><Link className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline" href={`/estimates/${estimateId}#pricing-coverage`}>Open Pricing Coverage</Link></section>

    <section id="labor-review" className="scroll-mt-6 border-y border-border py-4"><h2 className="text-lg font-semibold">Labor Recap</h2><div className="mt-2 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3"><Fact label="Labor operations" value={String(labor.operations)}/><Fact label="Estimated MH" value={labor.totalManHours.toLocaleString()}/><Fact label="Direct Labor Cost" value={money(labor.totalDirectCost)}/><Fact label="Baseline assumptions" value={String(baselineAssumptions)}/><Fact label="Job MH/unit overrides" value={String(labor.jobOverrides)}/><Fact label="Explicit labor-rate selections" value={String(explicitLaborRates)}/><Fact label="Missing assumptions" value={String(labor.missingAssumption)}/><Fact label="Missing rates" value={String(labor.missingLaborRate)}/></div><div className="mt-3 divide-y border-y border-border">{activeOutputs.filter(output=>output.estimate_item_type==='labor').map(output=><div key={output.id} className="py-2 text-sm"><strong>{output.label}</strong><span className="ml-2 text-muted-foreground">{Number(output.estimated_man_hours||0).toLocaleString()} MH · {output.baseline_man_hours_per_unit??'No baseline MH/unit'} baseline · {output.job_man_hours_per_unit??'No Job MH/unit override'} · {output.price_source_label||label(output.price_source_kind)}</span></div>)}</div><Link className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline" href={`/estimates/${estimateId}#labor-review`}>Open Labor Review</Link></section>

    <section className="border-y border-border py-4"><h2 className="text-lg font-semibold">Proposal preparation</h2><div className="mt-2 grid gap-2 text-sm sm:grid-cols-3"><Fact label="Schedule" value={proposalSettings.schedule_summary?'Prepared':'Not entered'}/><Fact label="Payment" value={proposalSettings.payment_summary?'Prepared':'Not entered'}/><Fact label="Terms" value={proposalSettings.terms_text||billingResult.data?.default_terms_text?'Available':'Not entered'}/></div><Link className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline" href={`/proposals/${estimateId}`}>Open Proposal preparation</Link></section>

    <details className="border-y border-border py-4"><summary className="cursor-pointer text-lg font-semibold">Estimate Trace</summary><div className="mt-3 divide-y border-y border-border">{generatedItems.map(item=>{const output=outputById.get(item.source_takeoff_output_id||'')||outputByItemId.get(item.id);const measurement=measurementById.get(output?.measurement_id||item.source_takeoff_measurement_id||'');const assignedRoles=measurement?rolesByMeasurement.get(measurement.id)||[]:[];const linkedConditions=assignedRoles.map(role=>{const version=versionById.get(role.condition_version_id);return version?conditions.get(version.condition_id):null;}).filter(Boolean);const directCondition=conditionOutputs.find(row=>row.legacy_takeoff_output_id===output?.id||row.generated_estimate_item_id===item.id);const directVersion=directCondition?versionById.get(directCondition.condition_version_id):null;const condition=directVersion?conditions.get(directVersion.condition_id):linkedConditions[0];const conditionVersion=directVersion||versions.find(version=>version.condition_id===condition?.id);const templateVersion=conditionVersion?templateVersionById.get(conditionVersion.template_version_id):null;const archetypeVersion=conditionVersion?archetypeVersionById.get(conditionVersion.archetype_version_id):null;const module=directCondition?.module_instance_id?moduleById.get(directCondition.module_instance_id):null;const quoteLine=output?.price_source_id?(quoteLines||[]).find(line=>line.id===output.price_source_id):null;const quote=quoteLine?quoteById.get(quoteLine.quote_id):null;return <div key={item.id} className="py-3 text-sm"><strong>{item.description}</strong><div className="mt-1 grid gap-1 text-muted-foreground"><span>Condition: {conditionVersion?.condition_code_snapshot||condition?.code||'No linked Condition'} · {conditionVersion?.condition_name_snapshot||condition?.name||'—'}{conditionVersion?` · revision ${conditionVersion.revision_no}`:''}{assignedRoles[0]?` · role ${label(assignedRoles[0].role_key)}`:''}</span><span>Template: {templateVersion?`${templateVersion.template_code_snapshot} · ${templateVersion.template_name_snapshot} · version ${templateVersion.version_no}`:'No template lineage'}</span><span>Archetype: {archetypeVersion?`${archetypeVersion.archetype_code_snapshot} · ${archetypeVersion.archetype_name_snapshot} · version ${archetypeVersion.version_no}`:'No archetype lineage'}</span><span>Condition module + Output: {module?`${module.module_key} · ${module.label} · ${module.instance_key}`:'No linked module'} · {directCondition?`${directCondition.output_key} · ${directCondition.label}`:output?.label||'Generated output'}</span><span>Measurement / drawing: {measurement?`${measurement.name} · ${measurement.location||'Location not set'} · ${measurement.drawing_reference||'No drawing reference'}`:'No active linked measurement'}</span><span>Production Quantity: {output?.production_quantity??item.production_quantity??item.quantity} {output?.production_unit||item.production_unit||item.unit||''}</span><span>Generated Estimate item: {item.description} · {item.id}</span><span>Price source: {output?.price_source_label||item.price_source_label||label(output?.price_source_kind||item.price_source_kind)}{quote?` · ${quote.supplier_name} quote ${quote.quote_date}`:''}{output?.price_source_reference?` · ${output.price_source_reference}`:''}</span><span>Labor assumption / rate: source {output?.baseline_source||item.baseline_source||'No baseline source'} · {output?.price_source_kind==='labor_profile'?output.price_source_label:'No explicit labor profile rate'}{output?.job_man_hours_per_unit!=null?` · Job MH/unit ${output.job_man_hours_per_unit}`:''}</span></div><strong className="mt-2 block font-mono tabular-nums">Direct Cost {money(output?.direct_cost??item.direct_cost)}</strong></div>;})}{generatedItems.length===0&&<p className="py-3 text-sm text-muted-foreground">No generated Estimate lines are connected to active measurements.</p>}</div></details>
  </div></AppShell>;
}

function FindingSection({title,findings,estimateId,severity}:{title:string;findings:ReleaseFinding[];estimateId:string;severity:'blocker'|'warning'}){
  const badgeClass=severity==='blocker'?'border-destructive/30 bg-destructive/10 text-destructive':'border-warning/30 bg-warning/10 text-warning';
  return <section className="border-y border-border py-4"><h2 className="text-lg font-semibold">{title}</h2>{findings.length===0?<p className="mt-2 text-sm text-muted-foreground">No current {severity === 'blocker'?'blockers':'warnings'}.</p>:<ul className="mt-3 divide-y border-y border-border">{findings.map(finding=><li key={finding.finding_key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"><div><Badge variant="outline" className={badgeClass}>{severity==='blocker'?'BLOCKER':'WARNING'} · {label(finding.category)}</Badge><h3 className="mt-2 font-medium">{finding.title}</h3><p className="mt-1 text-sm text-muted-foreground">{finding.detail}</p></div><Link className="text-sm text-primary underline-offset-4 hover:underline" href={findingHref(estimateId,finding.next_action)}>Resolve in {label(finding.next_action)}</Link></li>)}</ul>}</section>;
}

function Fact({label,value}:{label:string;value:string}){return <div className="border-l border-border pl-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value}</div></div>}
