import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Boxes,Gauge,Hammer,Layers3,Package,Ruler,Shapes} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {createClient} from '@/lib/supabase/server';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));

function Metric({label,value,Icon}:{label:string;value:string|number;Icon:any}){
  return <Card className="gap-2 py-4 shadow-none"><CardHeader className="grid grid-cols-[1fr_auto] items-start gap-3 px-4"><div><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</CardTitle></div><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Icon className="size-4"/></span></CardHeader></Card>;
}

function Identity({label,value}:{label:string;value:string}){
  return <div className="min-w-0"><div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-[11px] text-foreground" title={value}>{value}</div></div>;
}

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

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Compatibility history</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Legacy assembly audit</h1>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Read-only published recipe and assembly records retained for historical Takeoff, estimate, proposal, and Concrete Condition compatibility. New scope is authored through Concrete Conditions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/takeoff"><ArrowLeft/>Takeoff</Link>
          <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/takeoff/intelligence"><Gauge/>Production intelligence</Link>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Compatibility history summary">
        <Metric label="Published assemblies" value={publishedAssemblies.length} Icon={Layers3}/>
        <Metric label="Published versions" value={(versions||[]).length} Icon={Shapes}/>
        <Metric label="Resource outputs" value={publishedComponents.length} Icon={Package}/>
        <Metric label="Labor operations" value={laborOperations} Icon={Hammer}/>
      </section>

      <Card className="shadow-none">
        <CardHeader className="grid gap-4 md:grid-cols-[44px_minmax(0,1fr)] md:items-center">
          <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-primary"><Hammer className="size-5"/></span>
          <div>
            <CardDescription className="text-xs font-medium">Historical estimating labor reference</CardDescription>
            <CardTitle className="mt-1 flex items-baseline gap-1 font-mono text-2xl font-semibold tabular-nums">{laborProfile?money(laborProfile.burdened_hourly_rate):'Not configured'}{laborProfile?<span className="font-sans text-xs font-normal text-muted-foreground">/ MH</span>:null}</CardTitle>
            <CardDescription className="mt-1">{laborProfile?.source_label||'No current default labor reference is configured.'} This surface is audit-only.</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Published compatibility records</p>
          <h2 className="mt-1 text-lg font-semibold">Assembly and recipe history</h2>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Published versions remain inspectable because historical measurements, estimates, accepted commercial records, and Condition compatibility mappings can still reference them. These records are not editable from this route.</p>
        </div>

        {publishedAssemblies.length===0?
          <Empty className="min-h-56 border bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Boxes/></EmptyMedia>
              <EmptyTitle>No published compatibility history</EmptyTitle>
              <EmptyDescription>No published legacy assembly records are available for audit.</EmptyDescription>
            </EmptyHeader>
          </Empty>
          :
          <div className="grid gap-3 lg:grid-cols-2">{publishedAssemblies.map((assembly:any)=>{
            const assemblyVersions=versionsByAssembly.get(assembly.id)||[];
            const latest=assemblyVersions[0];
            return <Card className="gap-0 py-0 shadow-none" key={assembly.id}>
              <CardHeader className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-3 border-b py-3">
                <span className="flex size-10 flex-col items-center justify-center rounded-lg bg-accent text-primary"><Ruler className="size-3.5"/><span className="mt-0.5 font-mono text-[9px] font-semibold">{assembly.primary_measurement}</span></span>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5"><Badge variant="outline" className="font-mono text-[10px]">{assembly.code}</Badge><Badge variant="secondary">{assembly.category||'Concrete'}</Badge></div>
                  <CardTitle className="truncate">{assembly.name}</CardTitle>
                  {assembly.description?<CardDescription className="mt-1 line-clamp-2">{assembly.description}</CardDescription>:null}
                </div>
                <Badge variant="secondary" className="bg-success/10 text-success">{assemblyVersions.length} published version{assemblyVersions.length===1?'':'s'}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid gap-3 border-b bg-muted/20 p-3 sm:grid-cols-2">
                  <Identity label="Assembly ID" value={String(assembly.id)}/>
                  <Identity label="Latest published version" value={latest?['V',latest.version_no,' · ',latest.id].join(''):'None'}/>
                </div>
                <div className="divide-y">
                  {assemblyVersions.map((version:any)=>{
                    const versionVariables=varsByVersion.get(version.id)||[];
                    const versionComponents=compsByVersion.get(version.id)||[];
                    return <details key={version.id}>
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-xs font-medium hover:bg-muted/40">
                        <Layers3 className="size-3.5 text-primary"/>
                        <span>Version {version.version_no} · Published</span>
                        <span className="ml-auto text-[11px] font-normal text-muted-foreground">{versionComponents.length} outputs · {versionVariables.length} inputs</span>
                      </summary>
                      <div className="space-y-4 border-t p-3">
                        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
                          <Identity label="Version ID" value={String(version.id)}/>
                          <Identity label="Assembly ID" value={String(assembly.id)}/>
                          <div className="sm:col-span-2">
                            <div className="text-xs font-medium">{version.source_label||'Carez published assembly'}</div>
                            {version.source_reference?<div className="mt-1 break-all text-xs text-muted-foreground">{version.source_reference}</div>:null}
                          </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <div className="mb-2 text-xs font-semibold text-muted-foreground">Inputs</div>
                            <div className="divide-y rounded-lg border">
                              {versionVariables.length?versionVariables.map((variable:any)=><div className="grid gap-1 px-3 py-2 text-xs" key={variable.id}><div className="flex items-center justify-between gap-3"><span className="font-medium">{variable.label}</span><span className="text-muted-foreground">{variable.unit||variable.value_type}</span></div><span className="font-mono text-[10px] text-muted-foreground">{variable.variable_key}</span></div>):<div className="px-3 py-2 text-xs text-muted-foreground">No published inputs</div>}
                            </div>
                          </div>
                          <div>
                            <div className="mb-2 text-xs font-semibold text-muted-foreground">Outputs</div>
                            <div className="divide-y rounded-lg border">
                              {versionComponents.length?versionComponents.map((component:any)=><div className="grid gap-1 px-3 py-2 text-xs" key={component.id}><div className="flex items-center justify-between gap-3"><span className="font-medium">{component.label}</span><span className="text-muted-foreground">{component.output_unit}</span></div><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground"><span className="font-mono">{component.component_key}</span><span>{component.estimate_item_type}</span><span>{component.resource_behavior||'legacy resource'}</span></div></div>):<div className="px-3 py-2 text-xs text-muted-foreground">No published outputs</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>;
                  })}
                </div>
              </CardContent>
            </Card>;
          })}</div>}
      </section>
    </div>
  </AppShell>;
}
