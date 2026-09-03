import {redirect} from 'next/navigation';
import Link from 'next/link';
import type {CSSProperties} from 'react';
import {ArrowLeft,Boxes,Gauge,Hammer,Layers3,Package,Ruler,Settings2,Shapes} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {updateEstimatingLaborProfile} from '../actions';
import styles from './AssemblyPage.module.css';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));

function assemblyTone(category:string){
  const value=String(category||'').toLowerCase();
  if(/reinforc|rebar|mesh/.test(value))return '#a78bfa';
  if(/form|shor|brace/.test(value))return '#22d3ee';
  if(/place|pour|pump/.test(value))return '#f59e0b';
  if(/slab|flat|sidewalk|curb/.test(value))return '#22c55e';
  if(/wall/.test(value))return '#ec4899';
  return '#4f8cff';
}

export default async function AssemblyLibraryPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;

  const [{data:assemblies},{data:versions},{data:variables},{data:components},{data:laborProfile},{data:riskClasses}]=await Promise.all([
    supabase.from('concrete_assemblies').select('*').eq('company_id',companyId).eq('active',true).order('category').order('name'),
    supabase.from('concrete_assembly_versions').select('*').eq('company_id',companyId).eq('status','published').order('version_no',{ascending:false}),
    supabase.from('concrete_assembly_variables').select('*').eq('company_id',companyId).order('sort_order'),
    supabase.from('concrete_assembly_components').select('*').eq('company_id',companyId).order('sort_order'),
    supabase.from('estimating_labor_profiles').select('*').eq('company_id',companyId).eq('active',true).eq('is_default',true).maybeSingle(),
    supabase.from('li_risk_classes').select('code,name,tax_year').eq('company_id',companyId).eq('active',true).order('code'),
  ]);

  const latestByAssembly=new Map<string,any>();
  for(const version of versions||[])if(!latestByAssembly.has(version.assembly_id))latestByAssembly.set(version.assembly_id,version);
  const publishedAssemblies=(assemblies||[]).filter((assembly:any)=>latestByAssembly.has(assembly.id));
  const publishedVersionIds=new Set([...latestByAssembly.values()].map((version:any)=>version.id));
  const publishedComponents=(components||[]).filter((component:any)=>publishedVersionIds.has(component.assembly_version_id));
  const varsByVersion=new Map<string,any[]>();
  for(const variable of variables||[]){
    const rows=varsByVersion.get(variable.assembly_version_id)||[];
    rows.push(variable);
    varsByVersion.set(variable.assembly_version_id,rows);
  }
  const compsByVersion=new Map<string,any[]>();
  for(const component of components||[]){
    const rows=compsByVersion.get(component.assembly_version_id)||[];
    rows.push(component);
    compsByVersion.set(component.assembly_version_id,rows);
  }
  const categories=[...new Set(publishedAssemblies.map((assembly:any)=>assembly.category||'Concrete'))];
  const laborOperations=publishedComponents.filter((component:any)=>component.estimate_item_type==='labor').length;

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>Assembly &amp; Resource Engine</div>
          <h1>Assemblies</h1>
          <p>Company-owned concrete recipes, resource outputs, and labor production.</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.action} href="/takeoff"><ArrowLeft size={15}/>Open Takeoff</Link>
          <Link className={`${styles.action} ${styles.actionPrimary}`} href="/takeoff/intelligence"><Gauge size={15}/>Production intelligence</Link>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Assembly library summary">
        <div className={`${styles.metric} ${styles.metricBlue}`}><div className={styles.metricIcon}><Layers3/></div><div><span>Published assemblies</span><strong>{publishedAssemblies.length}</strong></div></div>
        <div className={`${styles.metric} ${styles.metricCyan}`}><div className={styles.metricIcon}><Shapes/></div><div><span>Categories</span><strong>{categories.length}</strong></div></div>
        <div className={`${styles.metric} ${styles.metricViolet}`}><div className={styles.metricIcon}><Package/></div><div><span>Resource outputs</span><strong>{publishedComponents.length}</strong></div></div>
        <div className={`${styles.metric} ${styles.metricOrange}`}><div className={styles.metricIcon}><Hammer/></div><div><span>Labor operations</span><strong>{laborOperations}</strong></div></div>
      </section>

      <section className={styles.laborBand} aria-label="Estimating labor cost">
        <div className={styles.laborIcon}><Hammer size={18}/></div>
        <div className={styles.laborMain}>
          <span>Estimating labor cost</span>
          <div className={styles.laborValue}><strong>{laborProfile?money(laborProfile.burdened_hourly_rate):'Not configured'}</strong>{laborProfile&&<small>/ MH</small>}</div>
          <div className={styles.laborSource}>{laborProfile?.source_label||'Set the current fully burdened labor cost.'}</div>
        </div>
        <details className={styles.laborControls}>
          <summary><Settings2 size={14}/>Edit labor cost</summary>
          <form action={updateEstimatingLaborProfile} className={styles.laborForm}>
            <label className={styles.field}><span>Burdened cost / MH</span><input name="burdened_hourly_rate" type="number" min="0" step="0.01" required defaultValue={laborProfile?Number(laborProfile.burdened_hourly_rate):undefined}/></label>
            <label className={styles.field}><span>Base L&amp;I class</span><select name="base_risk_class_code" defaultValue={laborProfile?.base_risk_class_code||''}><option value="">None / blended</option>{(riskClasses||[]).map((risk:any)=><option key={`${risk.code}-${risk.tax_year}`} value={risk.code}>{risk.code} — {risk.name}</option>)}</select></label>
            <label className={styles.field}><span>Note</span><input name="notes" placeholder="Owner-reviewed labor cost"/></label>
            <button className={styles.saveButton}>Save labor cost</button>
          </form>
        </details>
      </section>

      <section className={styles.library}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}><Boxes size={16}/>Published assemblies</div>
          <div className={styles.sectionMeta}>{publishedAssemblies.length} available in Takeoff</div>
        </div>

        {publishedAssemblies.length===0?<div className={styles.empty}>No published company assemblies yet. Build the first one from Takeoff.</div>:<div className={styles.grid}>
          {publishedAssemblies.map((assembly:any)=>{
            const version:any=latestByAssembly.get(assembly.id);
            const assemblyVariables=varsByVersion.get(version.id)||[];
            const assemblyComponents=compsByVersion.get(version.id)||[];
            const labor=assemblyComponents.filter((component:any)=>component.estimate_item_type==='labor');
            const material=assemblyComponents.filter((component:any)=>component.estimate_item_type==='material');
            const other=assemblyComponents.length-labor.length-material.length;
            const accent=assemblyTone(assembly.category);
            return <article className={styles.card} key={assembly.id} style={{'--assembly-accent':accent} as CSSProperties}>
              <header className={styles.cardHeader}>
                <div className={styles.unit}><Ruler/><b>{assembly.primary_measurement}</b></div>
                <div className={styles.identity}><span>{assembly.code} · {assembly.category||'Concrete'}</span><strong>{assembly.name}</strong></div>
                <div className={styles.version}><i className={styles.versionDot}/>V{version.version_no} · Published</div>
              </header>
              <div className={styles.cardMetrics}>
                <span><b>{material.length}</b> material</span>
                <span><b>{labor.length}</b> labor</span>
                <span><b>{other}</b> other</span>
                <span><b>{assemblyVariables.length}</b> inputs</span>
              </div>
              <details className={styles.recipe}>
                <summary><Layers3 size={13}/>Recipe</summary>
                <div className={styles.recipeBody}>
                  <div className={styles.source}><strong>{version.source_label||'Carez assembly'}</strong>{version.source_reference&&<span title={version.source_reference}>{version.source_reference}</span>}</div>
                  <div className={styles.recipeColumns}>
                    <div className={styles.recipeGroup}>
                      <h3>Inputs</h3>
                      <div className={styles.recipeList}>{assemblyVariables.length?assemblyVariables.map((variable:any)=><div className={styles.recipeRow} key={variable.id}><strong>{variable.label}</strong><span>{variable.unit||variable.value_type}</span></div>):<div className={styles.recipeRow}><strong>No estimator inputs</strong></div>}</div>
                    </div>
                    <div className={styles.recipeGroup}>
                      <h3>Outputs</h3>
                      <div className={styles.recipeList}>{assemblyComponents.map((component:any)=><div className={styles.recipeRow} key={component.id}><strong>{component.label}</strong><span>{component.output_unit}</span>{component.labor_task&&<small>{component.labor_task}</small>}</div>)}</div>
                    </div>
                  </div>
                </div>
              </details>
            </article>;
          })}
        </div>}
      </section>
    </main>
  </AppShell>;
}
