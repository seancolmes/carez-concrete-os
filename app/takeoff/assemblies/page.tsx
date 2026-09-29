import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Gauge} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {LegacyAssemblyAuditTable,type LegacyAssemblyAuditRow} from '@/components/takeoff/LegacyAssemblyAuditTable';
import {buttonVariants} from '@/components/ui/button';
import {createClient} from '@/lib/supabase/server';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));

export default async function AssemblyLibraryPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;

  const [{data:assemblies},{data:versions},{data:variables},{data:components},{data:laborProfile}]=await Promise.all([
    supabase.from('concrete_assemblies').select('*').eq('company_id',companyId).order('category').order('name'),
    supabase.from('concrete_assembly_versions').select('*').eq('company_id',companyId).eq('status','published').order('version_no',{ascending:false}),
    supabase.from('concrete_assembly_variables').select('*').eq('company_id',companyId).order('sort_order'),
    supabase.from('concrete_assembly_components').select('*').eq('company_id',companyId).order('sort_order'),
    supabase.from('estimating_labor_profiles').select('*').eq('company_id',companyId).eq('active',true).eq('is_default',true).maybeSingle(),
  ]);

  const versionsByAssembly=new Map<string,any[]>();
  for(const version of versions||[]){
    const rows=versionsByAssembly.get(version.assembly_id)||[];
    rows.push(version);
    versionsByAssembly.set(version.assembly_id,rows);
  }
  const publishedAssemblies=(assemblies||[]).filter((assembly:any)=>versionsByAssembly.has(assembly.id));
  const publishedVersionIds=new Set((versions||[]).map((version:any)=>version.id));
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
  const laborOperations=publishedComponents.filter((component:any)=>component.estimate_item_type==='labor').length;
  const auditRows:LegacyAssemblyAuditRow[]=publishedAssemblies.map((assembly:any)=>({
    id:String(assembly.id),code:String(assembly.code||'—'),name:String(assembly.name||'Untitled assembly'),
    description:assembly.description||null,category:String(assembly.category||'Concrete'),measurement:String(assembly.primary_measurement||'—'),
    versions:(versionsByAssembly.get(assembly.id)||[]).map((version:any)=>({
      id:String(version.id),number:Number(version.version_no||0),source:String(version.source_label||'Carez published assembly'),reference:version.source_reference||null,
      inputs:(varsByVersion.get(version.id)||[]).map((variable:any)=>({label:String(variable.label||variable.variable_key),key:String(variable.variable_key),unit:String(variable.unit||variable.value_type||'—')})),
      outputs:(compsByVersion.get(version.id)||[]).map((component:any)=>({label:String(component.label||component.component_key),key:String(component.component_key),unit:String(component.output_unit||'—'),type:String(component.estimate_item_type||'—'),behavior:String(component.resource_behavior||'legacy resource')})),
    })),
  }));

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
      <header className="carez-page-heading flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Compatibility history</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Legacy assembly audit</h1>
          <p className="mt-1 max-w-4xl text-xs text-muted-foreground">Read-only published records retained for Takeoff, estimate, proposal and Concrete Condition compatibility.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/takeoff"><ArrowLeft/>Takeoff</Link>
          <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/takeoff/intelligence"><Gauge/>Production intelligence</Link>
        </div>
      </header>

      <section aria-label="Compatibility history summary" className="grid grid-cols-2 border-y border-[#25292C] bg-[#181A1B] text-[11px] sm:grid-cols-4">
        <div className="flex h-8 items-center justify-between gap-2 border-r border-[#25292C] px-2 text-[#8B949E]"><span>Assemblies</span><strong className="font-mono text-[#E1E7E3]">{publishedAssemblies.length}</strong></div>
        <div className="flex h-8 items-center justify-between gap-2 border-r border-[#25292C] px-2 text-[#8B949E]"><span>Versions</span><strong className="font-mono text-[#E1E7E3]">{(versions||[]).length}</strong></div>
        <div className="flex h-8 items-center justify-between gap-2 border-r border-[#25292C] px-2 text-[#8B949E]"><span>Outputs</span><strong className="font-mono text-[#E1E7E3]">{publishedComponents.length}</strong></div>
        <div className="flex h-8 items-center justify-between gap-2 px-2 text-[#8B949E]"><span>Labor operations</span><strong className="font-mono text-[#E1E7E3]">{laborOperations}</strong></div>
      </section>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#25292C] pb-2 text-[11px] text-[#8B949E]">
        <span>Historical labor reference</span>
        <strong className="font-mono text-[#525B62]">{laborProfile?money(laborProfile.burdened_hourly_rate):'Not configured'}{laborProfile?'/ MH':''}</strong>
        <span className="truncate">{laborProfile?.source_label||'No current default labor reference is configured.'}</span>
      </div>

      <section aria-labelledby="published-records-title">
        <div className="mb-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Published compatibility records</p>
          <h2 id="published-records-title" className="text-sm font-semibold">Assembly and recipe history</h2>
        </div>
        <LegacyAssemblyAuditTable rows={auditRows}/>
      </section>
    </div>
  </AppShell>;
}
