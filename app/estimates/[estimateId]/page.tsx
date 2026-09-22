import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CheckCircle2,FileText,Ruler,ShieldCheck} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {EstimateWorksheet} from '@/components/estimates/EstimateWorksheet';
import {PricingCoverage} from '@/components/estimates/PricingCoverage';
import {Button,buttonVariants} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {addEstimateSection,addEstimateItem,updateEstimatePricing} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const units=['CY','LF','SF','LB','EA','HR','DAY','TON','GAL','LS'];
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50';

export default async function EstimateDetail({params}:{params:Promise<{estimateId:string}>}){
  const {estimateId}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!p?.company_id)redirect('/login');if(p.role==='employee')redirect('/employee');
  const [{data:e},{data:s},{data:sections},{data:items},{data:codes},{data:catalog},{data:crew},{data:risk},{data:budget},{data:proposal},{data:takeoff},{data:measurements},{data:outputs},{data:quoteSets},{data:audit},{data:auditFindings}]=await Promise.all([
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
    supabase.from('takeoff_measurements').select('id,name,location,drawing_reference,raw_quantity,raw_unit,estimate_section_id,created_at').eq('estimate_id',estimateId).eq('company_id',p.company_id).eq('status','active').order('created_at'),
    supabase.from('takeoff_measurement_outputs').select('id,measurement_id,generated_estimate_item_id,label,estimate_item_type,production_quantity,production_unit,unit_cost,catalog_item_id,pricing_status,cost_source,price_source_kind,price_source_id,price_source_label,price_source_reference,price_effective_date,is_active,estimate_visible').eq('company_id',p.company_id).eq('is_active',true).eq('estimate_visible',true),
    supabase.from('estimate_supplier_quote_sets').select('id,estimate_id,name,bid_zone,scope_note,status,created_at').eq('estimate_id',estimateId).eq('company_id',p.company_id).order('created_at'),
    supabase.from('estimate_audit_summary').select('audit_status,blocker_count,warning_count,next_action').eq('estimate_id',estimateId).eq('company_id',p.company_id).maybeSingle(),
    supabase.from('estimate_audit_findings').select('finding_key,severity,title,detail,next_action').eq('estimate_id',estimateId).eq('company_id',p.company_id).order('sort_order'),
  ]);
  if(!e)notFound();

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
  const stage=e.status==='accepted'||e.status==='approved'?'Awarded':proposal?'Proposal Issued':e.status==='ready'?'Ready for Audit':e.status==='superseded'?'Superseded':'Pricing';
  const blockers=(auditFindings||[]).filter((finding:any)=>finding.severity==='blocker');
  const warnings=(auditFindings||[]).filter((finding:any)=>finding.severity==='warning');
  const readinessLabel=audit?.audit_status==='blocked'?'BLOCKED':audit?.audit_status==='review'?'REVIEW':audit?.audit_status==='clear'?'CLEAR':'PENDING';

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{display} · {stage}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{e.name}</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Takeoff quantities feed this estimate automatically. Review exceptions, margin and the customer price here; use manual costs only when the scope is genuinely outside an assembly.</p></div>
      <div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/estimates"><ArrowLeft/>Estimates</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/takeoff"><Ruler/>Takeoff</Link></div>
    </header>

    <nav className="flex w-fit max-w-full items-stretch overflow-x-auto rounded-lg border bg-card text-xs" aria-label="Estimate workflow">
      {['Takeoff','Estimate','Audit','Proposal'].map((label,index)=><div key={label} className={index===1?'flex min-h-9 items-center gap-2 border-r bg-accent px-3 font-medium text-primary shadow-[inset_0_-2px_var(--primary)] last:border-r-0':'flex min-h-9 items-center gap-2 border-r px-3 text-muted-foreground last:border-r-0'}><span className="font-mono text-[10px]">{index+1}</span><span>{label}</span>{index<3?<ArrowRight className="size-3 opacity-50"/>:null}</div>)}
    </nav>

    {proposal&&!['accepted','approved','superseded'].includes(e.status)&&<div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><strong>{proposal.proposal_number} is issued.</strong> <span className="text-muted-foreground">This exact estimate revision is read-only. Customer follow-up and the next revision are handled from Proposal.</span></div>}
    {['accepted','approved'].includes(e.status)&&<div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"><strong>Awarded baseline locked.</strong> Carez preserves this accepted price and scope while the project budget and Work Packages run from the snapshot.</div>}
    {e.status==='superseded'&&<div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><strong>Historical revision.</strong> <span className="text-muted-foreground">A newer revision replaced this one; it remains available for audit.</span></div>}

    <section className="grid grid-cols-1 divide-y divide-border border-y border-border md:grid-cols-4 md:divide-x md:divide-y-0" aria-label="Commercial estimator ledger">
      <LedgerMetric label="Active Commercial Bid Volume" value={money(selectedPrice)} help="Customer price selected for this revision."/>
      <LedgerMetric label="Gross Margin Baseline" value={`${margin.toFixed(1)}%`} help={`Target ${target.toFixed(1)}%.`} tone={margin<target?'warning':'success'}/>
      <LedgerMetric label="Active Pricing Holds" value={String(holds)} help={holds?'Takeoff outputs require pricing.':'No current takeoff pricing holds.'} tone={holds?'warning':'success'}/>
      <LedgerMetric label="P1.4 Readiness Verification Status" value={readinessLabel} help={audit?.next_action||'Release state is evaluated by the estimate audit.'} tone={audit?.audit_status==='blocked'?'error':audit?.audit_status==='review'?'warning':audit?.audit_status==='clear'?'success':'default'}/>
    </section>

    {blockers.length>0&&<section className="border-y border-destructive/40 px-4 py-3 text-sm text-destructive" aria-label="P1.4 release blockers"><strong>P1.4 proposal issuance is server-gated.</strong> {blockers.length} blocker{blockers.length===1?'':'s'} must be resolved before this revision can be issued.<div className="mt-2 space-y-1 text-xs">{blockers.map((finding:any)=><div key={finding.finding_key}>{finding.title}: {finding.next_action||finding.detail}</div>)}</div></section>}
    {blockers.length===0&&warnings.length>0&&<section className="border-y border-warning/40 px-4 py-3 text-sm text-warning" aria-label="P1.4 review warnings"><strong>P1.4 review required.</strong> No server-gated blockers remain; review {warnings.length} non-blocking warning{warnings.length===1?'':'s'} before proposal issuance.<div className="mt-2 space-y-1 text-xs">{warnings.map((finding:any)=><div key={finding.finding_key}>{finding.title}: {finding.next_action||finding.detail}</div>)}</div></section>}

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
      <section className="border-y border-border py-4"><div className="px-1"><h2 className="text-sm font-semibold">Scope &amp; Cost</h2><p className="mt-1 text-sm text-muted-foreground">Concrete areas with cost generated from takeoff plus any controlled manual additions.</p></div><div className="mt-4 divide-y border-y border-border">{(sections||[]).map((section:any)=>{const rows=itemsBySection.get(section.id)||[];const cost=rows.reduce((sum:number,item:any)=>sum+num(item.direct_cost),0);const takeoffCount=rows.filter((item:any)=>item.source_takeoff_measurement_id).length;return <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={section.id}><div><div className="font-medium">{section.name}</div><div className="mt-1 text-xs text-muted-foreground">{String(section.scope_type).replaceAll('_',' ')} · {rows.length} cost line{rows.length===1?'':'s'}{takeoffCount?` · ${takeoffCount} from takeoff`:''}</div></div><strong className="font-mono tabular-nums">{money(cost)}</strong></div>;})}{(itemsBySection.get('unassigned')||[]).length>0&&<div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium">Unassigned / General</div><div className="mt-1 text-xs text-muted-foreground">{itemsBySection.get('unassigned')!.length} cost lines</div></div><strong className="font-mono tabular-nums">{money(itemsBySection.get('unassigned')!.reduce((sum:number,item:any)=>sum+num(item.direct_cost),0))}</strong></div>}</div>

        {!locked&&<details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Add Scope Area</summary><div className="border-t border-border p-3"><form action={addEstimateSection} className="grid gap-4"><input type="hidden" name="estimate_id" value={e.id}/><div className="grid gap-2"><Label htmlFor="scope-name">Physical area / assembly</Label><Input id="scope-name" name="name" required placeholder="Basement Walls · Garage Slab · Driveway"/></div><div className="grid gap-2"><Label htmlFor="scope-type">Concrete work type</Label><select id="scope-type" className={selectClass} name="scope_type"><option value="footing">Footing</option><option value="wall">Wall</option><option value="flatwork">Flatwork</option><option value="curb">Curb / Sidewalk</option><option value="repair">Repair</option><option value="other">Other</option></select></div><Button type="submit" variant="outline" className="w-fit">Add Scope Area</Button></form></div></details>}
      </section>

      <section className="border-y border-border py-4"><div className="px-1"><h2 className="text-sm font-semibold">Price &amp; Margin</h2><p className="mt-1 text-sm text-muted-foreground">The few commercial decisions that should normally need owner review.</p></div><form action={updateEstimatePricing} className="mt-4 grid gap-4"><input type="hidden" name="estimate_id" value={e.id}/>
        <div className="grid gap-2"><Label htmlFor="customer-price">Customer price</Label><Input id="customer-price" key={`customer-price-${selectedPrice.toFixed(2)}`} name="proposed_sell_price" type="number" min="0" step="0.01" defaultValue={selectedPrice} disabled={locked}/><p className="text-xs text-muted-foreground">Recommended: {money(recommended)}</p></div>
        <div className="grid gap-2"><Label htmlFor="target-margin">Target profit margin %</Label><Input id="target-margin" name="target_margin_percent" type="number" min="0" max="100" step="0.1" defaultValue={target} disabled={locked}/></div>
        <div className="grid gap-2"><Label htmlFor="estimate-stage">Estimate stage</Label><select id="estimate-stage" className={selectClass} name="status" defaultValue={e.status} disabled={locked}><option value="draft">Still Pricing</option><option value="ready">Ready for Audit / Proposal</option><option value="declined">Lost / Declined</option>{e.status==='accepted'&&<option value="accepted">Customer Accepted</option>}{e.status==='approved'&&<option value="approved">Approved</option>}{e.status==='superseded'&&<option value="superseded">Superseded</option>}</select></div>
        <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Tax / transaction assumptions</summary><div className="grid gap-4 border-t border-border p-3"><div className="grid gap-2"><Label htmlFor="bo-classification">WA B&amp;O type</Label><select id="bo-classification" className={selectClass} name="bo_classification" defaultValue={e.bo_classification} disabled={locked}><option value="retailing">Retailing</option><option value="wholesaling">Wholesaling</option></select></div><div className="grid gap-2"><Label htmlFor="processing-rate">Card / processing reserve %</Label><Input id="processing-rate" name="payment_processing_rate_percent" type="number" step="0.01" min="0" defaultValue={num(e.payment_processing_rate_percent)} disabled={locked}/></div></div></details>
        {!locked&&<Button type="submit" className="w-fit">Save Estimate</Button>}
      </form>

      <div className="divide-y rounded-lg border border-border bg-muted/10">{[['Price',money(selectedPrice)],['Company cost',money(s?.base_company_cost)],['Revenue reserve',money(s?.revenue_cost_reserve)],['Projected profit',money(s?.projected_profit)]].map(([label,value])=><div className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm" key={label}><span className="text-muted-foreground">{label}</span><strong className="font-mono tabular-nums">{value}</strong></div>)}</div>
      </section>
    </section>

    <PricingCoverage estimateId={e.id} measurements={measurements||[]} outputs={outputs||[]} quoteSets={quoteSets||[]} quotes={quotes} quoteLines={quoteLines} locked={locked} today={today}/>

    <section className="space-y-4" aria-labelledby="estimate-lines"><div><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Commercial workbook</p><h2 id="estimate-lines" className="mt-1 text-lg font-semibold">Margin Optimization &amp; Fee Structure</h2><p className="mt-1 text-sm text-muted-foreground">Price concrete scope from takeoff, resolve structural exception holds, protect labor gross margins, and issue the exact bid revision the customer will accept.</p></div>
      <EstimateWorksheet estimateId={e.id} sections={sections||[]} measurements={measurements||[]} items={items||[]} outputs={outputs||[]} locked={locked}/>

      <Button type="button" variant="ghost" size="sm" disabled title="Append pour phases is not available for this estimator revision.">Append Structural Pour Phase</Button>

      {!locked&&<details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Add Cost Outside the Assembly System</summary><div className="space-y-4 border-t border-border p-3"><div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"><strong>Exception tool:</strong> <span className="text-muted-foreground">use this for a real cost not represented by the concrete takeoff assembly—special rental, one-off subcontractor, unusual material, etc.</span></div><form action={addEstimateItem} className="grid gap-4"><input type="hidden" name="estimate_id" value={e.id}/>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="exception-section">Scope area</Label><select id="exception-section" className={selectClass} name="section_id" defaultValue=""><option value="">Unassigned / general</option>{(sections||[]).map((section:any)=><option key={section.id} value={section.id}>{section.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="exception-type">Cost type</Label><select id="exception-type" className={selectClass} name="item_type" defaultValue="material"><option value="labor">Labor</option><option value="material">Material</option><option value="equipment">Equipment</option><option value="subcontractor">Subcontractor</option><option value="other">Other</option></select></div></div>
        <div className="grid gap-2"><Label htmlFor="exception-description">Description</Label><Input id="exception-description" name="description" required placeholder="Concrete pump · specialty finish · unusual rental…"/></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="exception-catalog">Saved cost item</Label><select id="exception-catalog" className={selectClass} name="catalog_item_id" defaultValue=""><option value="">Custom</option>{(catalog||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="exception-code">Cost code</Label><select id="exception-code" className={selectClass} name="cost_code_id" defaultValue=""><option value="">Automatic / none</option>{(codes||[]).map((c:any)=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="exception-quantity">Quantity</Label><Input id="exception-quantity" name="quantity" type="number" step="0.01" min="0" defaultValue="1"/></div><div className="grid gap-2"><Label htmlFor="exception-unit">Unit</Label><select id="exception-unit" className={selectClass} name="unit" defaultValue="LS">{units.map(unit=><option key={unit}>{unit}</option>)}</select></div></div>
        <div className="grid gap-2"><Label htmlFor="exception-unit-cost">Unit cost</Label><Input id="exception-unit-cost" name="unit_cost" type="number" step="0.01" min="0" defaultValue="0"/></div>
        <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Labor-only fields</summary><div className="grid gap-4 border-t border-border p-3"><div className="grid gap-2"><Label htmlFor="exception-worker">Worker</Label><select id="exception-worker" className={selectClass} name="crew_member_id" defaultValue=""><option value="">Not labor</option>{(crew||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="exception-risk">L&amp;I work class</Label><select id="exception-risk" className={selectClass} name="risk_class_code" defaultValue="0217-01"><option value="">Owner / not applicable</option>{(risk||[]).map((r:any)=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="exception-task">Labor operation</Label><select id="exception-task" className={selectClass} name="labor_task" defaultValue="General"><option>Formwork</option><option>Rebar</option><option>Placement</option><option>Finishing</option><option>Strip</option><option>Cleanup</option><option>Layout</option><option>General</option></select></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="exception-regular-hours">Regular hours</Label><Input id="exception-regular-hours" name="regular_hours" type="number" step="0.25" min="0"/></div><div className="grid gap-2"><Label htmlFor="exception-ot-hours">OT hours</Label><Input id="exception-ot-hours" name="overtime_hours" type="number" step="0.25" min="0"/></div></div></div></details>
        <Button type="submit" className="w-fit">Add Exception Cost</Button>
      </form></div></details>}
    </section>

    <section className="flex flex-col gap-4 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Next action</p><h2 className="mt-1 text-lg font-semibold">{locked?(proposal?'Customer / revision workflow':'Awarded estimate'):holds?'Resolve takeoff pricing holds':e.status==='ready'?'Run the pre-send estimate audit':'Finish pricing and mark Ready'}</h2><p className="mt-1 max-w-4xl text-sm text-muted-foreground">{locked?'This revision is preserved exactly as issued/accepted.':holds?'Return to Takeoff and clear current material or labor pricing before this bid can advance.':e.status==='ready'?'Audit checks takeoff completeness, price integrity and commercial risk before Proposal.':'Once scope, price and margin are right, change Estimate Stage to Ready for Audit / Proposal.'}</p>{budget&&<p className="mt-2 text-xs text-muted-foreground">Frozen project budget: {budget.label}</p>}</div><div className="flex flex-wrap gap-2">{!locked&&holds>0&&<Link className={buttonVariants({size:'sm'})} href="/takeoff"><Ruler/>Resolve in Takeoff</Link>}{!locked&&e.status==='ready'&&<Link className={buttonVariants({size:'sm'})} href="/estimates/audit"><ShieldCheck/>Run Estimate Audit</Link>}{!locked&&e.status==='ready'&&<Link className={buttonVariants({variant:'outline',size:'sm'})} href="/proposals"><FileText/>Proposal</Link>}{proposal&&<Link className={buttonVariants({size:'sm'})} href="/proposals"><FileText/>Open Proposal</Link>}{['accepted','approved'].includes(e.status)&&e.project_id&&<Link className={buttonVariants({size:'sm'})} href={`/projects/${e.project_id}`}><CheckCircle2/>Open Job</Link>}</div></section>
  </div></AppShell>;
}

function LedgerMetric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'|'error'}){
  const toneClass=tone==='success'?'text-success':tone==='warning'?'text-warning':tone==='error'?'text-destructive':'';
  return <div className="min-w-0 px-4 py-4"><div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className={`mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</div><div className="mt-1 text-xs leading-4 text-muted-foreground">{help}</div></div>;
}
