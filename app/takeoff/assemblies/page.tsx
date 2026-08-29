import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Calculator,Gauge,Layers3,Ruler} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {updateEstimatingLaborProfile} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const qty=(n:any,d=4)=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:d});

export default async function AssemblyLibraryPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;
  const [{data:assemblies},{data:versions},{data:variables},{data:components},{data:laborProfile},{data:riskClasses}]=await Promise.all([
    supabase.from('concrete_assemblies').select('*').eq('company_id',companyId).eq('active',true).order('category').order('name'),
    supabase.from('concrete_assembly_versions').select('*').eq('company_id',companyId).eq('status','published').order('version_no',{ascending:false}),
    supabase.from('concrete_assembly_variables').select('*').eq('company_id',companyId).order('sort_order'),
    supabase.from('concrete_assembly_components').select('*').eq('company_id',companyId).order('sort_order'),
    supabase.from('estimating_labor_profiles').select('*').eq('company_id',companyId).eq('active',true).eq('is_default',true).maybeSingle(),
    supabase.from('li_risk_classes').select('code,name,tax_year').eq('company_id',companyId).eq('active',true).order('code'),
  ]);
  const latestByAssembly=new Map<string,any>();for(const v of versions||[])if(!latestByAssembly.has(v.assembly_id))latestByAssembly.set(v.assembly_id,v);
  const varsByVersion=new Map<string,any[]>();for(const v of variables||[]){const rows=varsByVersion.get(v.assembly_version_id)||[];rows.push(v);varsByVersion.set(v.assembly_version_id,rows);}
  const compsByVersion=new Map<string,any[]>();for(const c of components||[]){const rows=compsByVersion.get(c.assembly_version_id)||[];rows.push(c);compsByVersion.set(c.assembly_version_id,rows);}
  const categories=[...new Set((assemblies||[]).map((a:any)=>a.category||'Concrete'))];

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page assembly-library-v3">
    <div className="command-hero"><div><div className="section-kicker">ESTIMATE · SYSTEM</div><h1>Concrete Assembly Library</h1><p>The recipes behind Carez takeoff. Geometry stays simple for the estimator while each assembly generates the actual material, labor and production quantities needed to price and execute the work.</p></div><div className="command-actions"><Link className="button secondary" href="/takeoff"><ArrowLeft size={15}/> Takeoff</Link><Link className="button secondary" href="/takeoff/intelligence"><Gauge size={15}/> Production Intelligence</Link></div></div>

    <div className="command-grid">
      <div className="command-card"><div className="command-label">Published Assemblies</div><div className="command-value">{(assemblies||[]).length}</div><div className="command-help">Concrete-specific estimating recipes.</div></div>
      <div className="command-card"><div className="command-label">Categories</div><div className="command-value">{categories.length}</div><div className="command-help">Foundation, wall, slab, ROW and specialty work.</div></div>
      <div className={`command-card ${laborProfile?'good':'watch'}`}><div className="command-label">Labor Cost / MH</div><div className="command-value">{laborProfile?money(laborProfile.burdened_hourly_rate):'SET'}</div><div className="command-help">Cost of one estimated man-hour.</div></div>
      <div className="command-card"><div className="command-label">Productivity Source</div><div className="command-value">BLEND</div><div className="command-help">National baseline now; Carez actuals replace it as confidence grows.</div></div>
    </div>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">LABOR COST</div><div className="section-title">Estimating Labor Profile</div><div className="section-heading-meta">Labor cost and field productivity remain separate. A better production rate changes MH/unit; it does not rewrite payroll burden history.</div></div></div><div className="surface"><div className="surface-body"><div className="estimating-profile-row"><div><span>Current fully burdened cost</span><strong>{laborProfile?money(laborProfile.burdened_hourly_rate):'Not configured'} <small>/ MH</small></strong><p>{laborProfile?.source_label||'Set the current labor cost used when pricing assembly labor.'}</p></div><details className="controls-disclosure"><summary>Review Labor Cost</summary><div className="controls-body"><form action={updateEstimatingLaborProfile} className="form"><label className="field"><span>Fully burdened labor cost / MH</span><input name="burdened_hourly_rate" type="number" min="0" step="0.01" required defaultValue={laborProfile?Number(laborProfile.burdened_hourly_rate):undefined}/></label><label className="field"><span>Base L&I class included</span><select name="base_risk_class_code" defaultValue={laborProfile?.base_risk_class_code||''}><option value="">None / blended</option>{(riskClasses||[]).map((r:any)=><option key={`${r.code}-${r.tax_year}`} value={r.code}>{r.code} — {r.name}</option>)}</select></label><label className="field"><span>Reason / note</span><input name="notes" placeholder="Current payroll burden / owner-reviewed rate"/></label><button className="button">Save Labor Profile</button></form></div></details></div></div></div></section>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">CONCRETE RECIPES</div><div className="section-title">What one measurement creates</div><div className="section-heading-meta">Open an assembly only when you need to inspect its logic. Daily takeoff users see the assembly name and required dimensions—not this configuration detail.</div></div></div>
      <div className="assembly-library-grid">{(assemblies||[]).map((assembly:any)=>{const version:any=latestByAssembly.get(assembly.id);if(!version)return null;const av=varsByVersion.get(version.id)||[];const ac=compsByVersion.get(version.id)||[];const labor=ac.filter((c:any)=>c.estimate_item_type==='labor');const material=ac.filter((c:any)=>c.estimate_item_type==='material');return <article className="assembly-library-card" key={assembly.id}><header><div className="assembly-library-unit"><Ruler size={16}/><b>{assembly.primary_measurement}</b></div><div><span>{assembly.code} · {assembly.category||'Concrete'}</span><strong>{assembly.name}</strong><p>{assembly.description||'Carez concrete estimating assembly.'}</p></div></header><div className="assembly-library-summary"><span><b>{material.length}</b> material outputs</span><span><b>{labor.length}</b> labor operations</span><span><b>{av.length}</b> job inputs</span><span><b>V{version.version_no}</b> published</span></div><details><summary><Layers3 size={14}/> View assembly recipe</summary><div className="assembly-recipe"><div className="assembly-recipe-source"><strong>{version.source_label||'Carez assembly'}</strong>{version.source_reference&&<span>{version.source_reference}</span>}</div>{av.length>0&&<div><h4>Inputs estimator may need</h4><div className="assembly-recipe-list">{av.map((v:any)=><div key={v.id}><strong>{v.label}</strong><span>{v.variable_key}{v.unit?` · ${v.unit}`:''}{v.default_value!==null?` · default ${String(v.default_value)}`:''}</span></div>)}</div></div>}<div><h4>Generated estimate outputs</h4><div className="assembly-recipe-list">{ac.map((c:any)=><div key={c.id}><strong>{c.label}</strong><span>{c.estimate_item_type} · {c.output_unit}{c.labor_task?` · ${c.labor_task}`:''}</span>{c.baseline_source&&<small>{c.baseline_source}</small>}</div>)}</div></div></div></details></article>;})}</div>
    </section>

    <section className="section"><div className="takeoff-system-strip"><div><div className="section-kicker">DESIGN PRINCIPLE</div><div className="section-title">The estimator measures concrete—not formulas</div><div className="section-heading-meta">Assembly complexity belongs here. The plan workspace should ask only for dimensions that materially change the concrete scope.</div></div><Link className="button" href="/takeoff"><Calculator size={15}/> Return to Takeoff</Link></div></section>
  </div></AppShell>;
}
