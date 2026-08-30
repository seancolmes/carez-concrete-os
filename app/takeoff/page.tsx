import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AlertTriangle,ArrowRight,Calculator,LibraryBig,Plus,Ruler,Upload} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {ManualTakeoffEntry} from '@/components/takeoff/ManualTakeoffEntry';
import {createTakeoffSet,updateTakeoffOutputPrice} from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const qty=(n:any,d=1)=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:d});

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

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page takeoff-home-v3">
    <div className="command-hero">
      <div><div className="section-kicker">ESTIMATE · TAKEOFF</div><h1>Concrete Takeoff</h1><p>Open the plans, measure the physical work, and let Carez assemblies build labor, material, equipment and field quantities behind the scenes.</p></div>
      <div className="command-actions"><Link className="button secondary" href="/takeoff/assemblies"><LibraryBig size={15}/> Assembly Library</Link><Link className="button secondary" href="/estimates"><Calculator size={15}/> Estimate</Link></div>
    </div>

    <div className="takeoff-flow-strip" aria-label="Carez estimating workflow"><span className="active">1 <b>Takeoff</b></span><ArrowRight/><span>2 <b>Estimate</b></span><ArrowRight/><span>3 <b>Audit</b></span><ArrowRight/><span>4 <b>Proposal</b></span></div>

    <div className="command-grid section">
      <div className="command-card"><div className="command-label">Working Bids</div><div className="command-value">{activeSets.filter((set:any)=>!issued.has(set.estimate_id)).length}</div><div className="command-help">Active takeoff revisions.</div></div>
      <div className="command-card"><div className="command-label">Measured Scope</div><div className="command-value">{activeMeasurements.length}</div><div className="command-help">Concrete objects measured or entered.</div></div>
      <div className={`command-card ${missingOutputs.length?'watch':'good'}`}><div className="command-label">Needs Pricing</div><div className="command-value">{missingOutputs.length}</div><div className="command-help">Assembly outputs blocking a clean estimate.</div></div>
      <div className="command-card"><div className="command-label">Takeoff Direct Cost</div><div className="command-value">{money(totalDirect)}</div><div className="command-help">Current generated direct cost across takeoffs.</div></div>
    </div>

    {startableEstimates.length>0&&<section className="section"><div className="start-takeoff-card"><div className="start-takeoff-copy"><div className="section-kicker">START A BID</div><div className="section-title">Open a new plan takeoff</div><div className="section-heading-meta">Choose the estimate. Carez creates the takeoff record and opens the drawing workspace immediately—no setup form first.</div></div><form action={createTakeoffSet} className="start-takeoff-form"><input type="hidden" name="name" value="Concrete Takeoff"/><select name="estimate_id" required defaultValue=""><option value="" disabled>Choose estimate…</option>{startableEstimates.map((e:any)=><option key={e.id} value={e.id}>{e.estimate_number}-R{e.version} — {e.name}</option>)}</select><button className="button"><Plus size={15}/> Start Takeoff</button></form></div></section>}

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">YOUR BIDS</div><div className="section-title">Takeoff Workbench</div><div className="section-heading-meta">Primary action is always the plans. Pricing holds and manual quantities stay attached to the bid but out of the way until needed.</div></div></div>
      {activeSets.length===0?<div className="empty-state"><div><div className="title">No takeoff started yet</div><div className="meta">Create an estimate first, then start the takeoff here.</div><div className="section"><Link className="button" href="/estimates">Open Estimates</Link></div></div></div>:
      <div className="takeoff-workbench">{activeSets.map((set:any)=>{
        const estimate:any=estimateMap.get(set.estimate_id);
        const locked=!estimate||issued.has(set.estimate_id)||['accepted','approved','superseded'].includes(estimate.status);
        const ms=measurementsBySet.get(set.id)||[];
        const setSheets=sheetsBySet.get(set.id)||[];
        const unscaled=setSheets.filter((sheet:any)=>sheet.scale_status!=='calibrated').length;
        const summary:any=summaryMap.get(set.estimate_id)||{};
        const setOutputs=ms.flatMap((m:any)=>outputByMeasurement.get(m.id)||[]);
        const holds=setOutputs.filter((o:any)=>['missing_price','missing_labor_rate'].includes(o.pricing_status)&&Number(o.production_quantity||o.estimated_man_hours||0)>0);
        const materialHolds=holds.filter((o:any)=>o.estimate_item_type!=='labor');
        const status=locked?'Issued / Read Only':!set.source_document_id?'Attach Plans':unscaled>0?'Set Sheet Scale':holds.length?'Resolve Pricing':'Takeoff Ready';
        const statusClass=locked?'':!set.source_document_id||unscaled>0||holds.length?'watch':'good';
        return <article className="takeoff-bid-card" key={set.id}>
          <div className="takeoff-bid-head"><div className="takeoff-bid-icon"><Ruler/></div><div className="takeoff-bid-title"><strong>{estimate?.name||set.name}</strong><span>{estimate?`${estimate.estimate_number}-R${estimate.version}`:'Estimate'} · {set.revision_label}{set.source_filename?` · ${set.source_filename}`:''}</span></div><span className={`takeoff-bid-status ${statusClass}`}>{status}</span></div>

          <div className="takeoff-bid-stats"><div><span>Sheets</span><strong>{set.page_count||setSheets.length||'—'}</strong></div><div><span>Objects</span><strong>{ms.length}</strong></div><div><span>Labor</span><strong>{qty(summary.takeoff_man_hours)} MH</strong></div><div className={holds.length?'hold':''}><span>Price Holds</span><strong>{holds.length}</strong></div><div><span>Direct Cost</span><strong>{money(summary.takeoff_direct_cost)}</strong></div></div>

          <div className="takeoff-bid-actions"><Link className="button" href={`/takeoff/${set.id}`}>{set.source_document_id?<><Ruler size={15}/> Open Takeoff</>:<><Upload size={15}/> Attach Plans</>}</Link><Link className="button secondary" href="/estimates"><Calculator size={15}/> Estimate</Link>{locked&&<span className="takeoff-bid-note">Accepted/issued geometry stays preserved with this revision.</span>}</div>

          {!locked&&holds.length>0&&<details className="takeoff-bid-drawer"><summary><span><AlertTriangle size={14}/> Resolve {holds.length} pricing hold{holds.length===1?'':'s'}</span><small>Open</small></summary><div className="takeoff-bid-drawer-body">{materialHolds.length===0?<div className="meta">The remaining hold is labor configuration. Review the Estimating System in the Assembly Library.</div>:<div className="price-hold-list">{materialHolds.map((o:any)=><div className="price-hold-row" key={o.id}><div><strong>{o.label}</strong><span>{qty(o.production_quantity,2)} {o.production_unit} · current price missing</span></div><form action={updateTakeoffOutputPrice}><div className="price-entry"><span>$</span><input name="unit_cost" type="number" min="0" step="0.01" inputMode="decimal" required placeholder="0.00"/><b>/{o.production_unit}</b></div><input type="hidden" name="output_id" value={o.id}/><button className="button secondary">Save</button></form></div>)}</div>}</div></details>}

          {!locked&&<details className="takeoff-bid-drawer"><summary><span>Manual quantity / field measurement</span><small>Fallback</small></summary><div className="takeoff-bid-drawer-body"><div className="manual-fallback-note">Use this only when the quantity comes from a field dimension, sketch, owner quantity or other verified source instead of the PDF.</div><ManualTakeoffEntry takeoffSetId={set.id} assemblies={assemblies||[]} versions={versions||[]} variables={variables||[]} sections={sectionsByEstimate.get(set.estimate_id)||[]} riskClasses={riskClasses||[]}/></div></details>}
        </article>;
      })}</div>}
    </section>

    <section className="section"><div className="takeoff-system-strip"><div><div className="section-kicker">ESTIMATING SYSTEM</div><div className="section-title">Concrete assemblies do the heavy lifting</div><div className="section-heading-meta">{(assemblies||[]).length} published assemblies convert plan geometry into concrete, reinforcement, forms, finish labor and production quantities. Keep those recipes maintained separately from daily takeoff work.</div></div><Link className="button secondary" href="/takeoff/assemblies">Open Assembly Library</Link></div></section>
  </div></AppShell>;
}
