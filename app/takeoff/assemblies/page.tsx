import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Boxes,Gauge,Hammer,Layers3,Package,Ruler,Settings2,Shapes} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Empty,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {updateEstimatingLaborProfile} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const fieldSelect='h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

function Metric({label,value,Icon}:{label:string;value:string|number;Icon:any}){
  return <Card className="gap-2 py-4 shadow-none"><CardHeader className="grid grid-cols-[1fr_auto] items-start gap-3 px-4"><div><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</CardTitle></div><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Icon className="size-4"/></span></CardHeader></Card>;
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
  for(const variable of variables||[]){const rows=varsByVersion.get(variable.assembly_version_id)||[];rows.push(variable);varsByVersion.set(variable.assembly_version_id,rows);}
  const compsByVersion=new Map<string,any[]>();
  for(const component of components||[]){const rows=compsByVersion.get(component.assembly_version_id)||[];rows.push(component);compsByVersion.set(component.assembly_version_id,rows);}
  const categories=[...new Set(publishedAssemblies.map((assembly:any)=>assembly.category||'Concrete'))];
  const laborOperations=publishedComponents.filter((component:any)=>component.estimate_item_type==='labor').length;

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="carez-page">
      <header className="carez-page-header">
        <div><p className="carez-kicker">Assembly & resource engine</p><h1 className="carez-page-title">Assemblies</h1><p className="carez-page-description">Company-owned concrete recipes that convert measured scope into labor, material, equipment, and production quantities.</p></div>
        <div className="flex flex-wrap items-center gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/takeoff"><ArrowLeft/>Takeoff</Link><Link className={buttonVariants({size:'sm'})} href="/takeoff/intelligence"><Gauge/>Production intelligence</Link></div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Assembly library summary">
        <Metric label="Published assemblies" value={publishedAssemblies.length} Icon={Layers3}/>
        <Metric label="Categories" value={categories.length} Icon={Shapes}/>
        <Metric label="Resource outputs" value={publishedComponents.length} Icon={Package}/>
        <Metric label="Labor operations" value={laborOperations} Icon={Hammer}/>
      </section>

      <Card className="shadow-none">
        <CardHeader className="grid gap-4 md:grid-cols-[44px_minmax(0,1fr)_auto] md:items-center"><span className="flex size-11 items-center justify-center rounded-lg bg-accent text-primary"><Hammer className="size-5"/></span><div><CardDescription className="text-xs font-medium">Estimating labor cost</CardDescription><CardTitle className="mt-1 flex items-baseline gap-1 font-mono text-2xl font-semibold tabular-nums">{laborProfile?money(laborProfile.burdened_hourly_rate):'Not configured'}{laborProfile?<span className="font-sans text-xs font-normal text-muted-foreground">/ MH</span>:null}</CardTitle><CardDescription className="mt-1">{laborProfile?.source_label||'Set the current fully burdened labor cost.'}</CardDescription></div><Dialog><DialogTrigger render={<Button variant="outline" size="sm"/>}><Settings2/>Edit labor cost</DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Estimating labor cost</DialogTitle><DialogDescription>Set the owner-reviewed fully burdened labor rate and optional base L&I class used by estimating.</DialogDescription></DialogHeader><form action={updateEstimatingLaborProfile} className="grid gap-4"><div className="grid gap-2"><Label htmlFor="labor-rate">Burdened cost / MH</Label><Input id="labor-rate" name="burdened_hourly_rate" type="number" min="0" step="0.01" required defaultValue={laborProfile?Number(laborProfile.burdened_hourly_rate):undefined}/></div><div className="grid gap-2"><Label htmlFor="labor-risk">Base L&I class</Label><select id="labor-risk" className={fieldSelect} name="base_risk_class_code" defaultValue={laborProfile?.base_risk_class_code||''}><option value="">None / blended</option>{(riskClasses||[]).map((risk:any)=><option key={`${risk.code}-${risk.tax_year}`} value={risk.code}>{risk.code} — {risk.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="labor-note">Note</Label><Input id="labor-note" name="notes" placeholder="Owner-reviewed labor cost"/></div><div className="flex justify-end"><Button type="submit">Save labor cost</Button></div></form></DialogContent></Dialog></CardHeader>
      </Card>

      <section className="carez-section">
        <div className="carez-section-header"><div><p className="carez-kicker">Published library</p><h2 className="carez-section-title">Concrete assemblies</h2><p className="carez-section-description">{publishedAssemblies.length} published assembly{publishedAssemblies.length===1?' is':' assemblies are'} available in Takeoff.</p></div></div>
        {publishedAssemblies.length===0?<Empty className="min-h-56 border bg-muted/20"><EmptyHeader><EmptyMedia variant="icon"><Boxes/></EmptyMedia><EmptyTitle>No published company assemblies yet</EmptyTitle><EmptyDescription>Build the first concrete recipe from the accepted assembly workflow, then publish it for Takeoff use.</EmptyDescription></EmptyHeader></Empty>:
          <div className="grid gap-3 lg:grid-cols-2">{publishedAssemblies.map((assembly:any)=>{
            const version:any=latestByAssembly.get(assembly.id);
            const assemblyVariables=varsByVersion.get(version.id)||[];
            const assemblyComponents=compsByVersion.get(version.id)||[];
            const labor=assemblyComponents.filter((component:any)=>component.estimate_item_type==='labor');
            const material=assemblyComponents.filter((component:any)=>component.estimate_item_type==='material');
            const other=assemblyComponents.length-labor.length-material.length;
            return <Card className="gap-0 py-0 shadow-none" key={assembly.id}>
              <CardHeader className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-3 border-b py-3"><span className="flex size-10 flex-col items-center justify-center rounded-lg bg-accent text-primary"><Ruler className="size-3.5"/><span className="mt-0.5 font-mono text-[9px] font-semibold">{assembly.primary_measurement}</span></span><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-1.5"><Badge variant="outline" className="font-mono text-[10px]">{assembly.code}</Badge><Badge variant="secondary">{assembly.category||'Concrete'}</Badge></div><CardTitle className="truncate">{assembly.name}</CardTitle>{assembly.description?<CardDescription className="mt-1 line-clamp-2">{assembly.description}</CardDescription>:null}</div><Badge variant="secondary" className="bg-success/10 text-success">V{version.version_no} · Published</Badge></CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-4 divide-x border-b bg-muted/20">{[['Material',material.length],['Labor',labor.length],['Other',other],['Inputs',assemblyVariables.length]].map(([label,value])=><div key={String(label)} className="px-3 py-2.5"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</div></div>)}</div>
                <details><summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-xs font-medium hover:bg-muted/40"><Layers3 className="size-3.5 text-primary"/>Recipe <span className="ml-auto text-[11px] font-normal text-muted-foreground">{assemblyComponents.length} outputs</span></summary><div className="space-y-4 border-t p-3"><div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs font-medium">{version.source_label||'Carez assembly'}</div>{version.source_reference?<div className="mt-1 truncate text-xs text-muted-foreground" title={version.source_reference}>{version.source_reference}</div>:null}</div><div className="grid gap-4 sm:grid-cols-2"><div><div className="mb-2 text-xs font-semibold text-muted-foreground">Inputs</div><div className="divide-y rounded-lg border">{assemblyVariables.length?assemblyVariables.map((variable:any)=><div className="flex items-center justify-between gap-3 px-3 py-2 text-xs" key={variable.id}><span className="font-medium">{variable.label}</span><span className="text-muted-foreground">{variable.unit||variable.value_type}</span></div>):<div className="px-3 py-2 text-xs text-muted-foreground">No estimator inputs</div>}</div></div><div><div className="mb-2 text-xs font-semibold text-muted-foreground">Outputs</div><div className="divide-y rounded-lg border">{assemblyComponents.map((component:any)=><div className="px-3 py-2 text-xs" key={component.id}><div className="flex items-center justify-between gap-3"><span className="font-medium">{component.label}</span><span className="text-muted-foreground">{component.output_unit}</span></div>{component.labor_task?<div className="mt-1 text-[11px] text-muted-foreground">{component.labor_task}</div>:null}</div>)}</div></div></div></div></details>
              </CardContent>
            </Card>;
          })}</div>}
      </section>
    </div>
  </AppShell>;
}
