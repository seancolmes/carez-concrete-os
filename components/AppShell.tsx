'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {BriefcaseBusiness,Building2,ChevronRight,HardHat,Home,Landmark,Menu,Moon,Search,Settings,Sun,Users,Wallet} from 'lucide-react';
import {BrandLogo} from '@/components/brand/BrandLogo';
import {useCarezAppearance} from '@/components/carez/appearance-provider';
import {CarezProjectContextBar} from '@/components/carez/project-context';
export {CarezProjectSwitcher} from '@/components/carez/project-context';
import {Button} from '@/components/ui/button';
import {Command,CommandDialog,CommandEmpty,CommandGroup,CommandInput,CommandItem,CommandList} from '@/components/ui/command';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {cn} from '@/lib/utils';
import {createClient} from '@/lib/supabase/client';
import {WORKSPACE_PRESENTATION_SURFACES,resolveActiveDestination,resolveActiveWorkspacePresentationSurface,resolveProjectRoute,buildProjectSwitchHref,type WorkspaceSurfaceId} from '@/lib/ui/navigation';

type ProjectOption={id:string;jobNumber:string;name:string;status:string|null;location:string};
type ProjectRow={id:string;job_number:string|null;name:string|null;status:string|null;address:string|null;city:string|null;state:string|null};
type OpportunityOption={id:string;number:string;name:string;customer:string};
type OpportunityRow={id:string;opportunity_number:string|null;project_name:string|null;customer_name:string|null};
type CrewOption={id:string;name:string;role:string};
type CrewRow={id:string;name:string|null;role:string|null};
const DOMAIN_ICONS:Record<WorkspaceSurfaceId,typeof Home>={today:Home,preconstruction:Building2,projects:BriefcaseBusiness,field:HardHat,finance:Landmark,system:Settings};
const FINANCIAL_COMMANDS=[
  {label:'Cash position',hint:'Ledger and cash flow',href:'/financials?tab=ledger&view=ledger'},
  {label:'Banking',hint:'Accounts and transactions',href:'/financials?tab=ledger&view=banking'},
  {label:'Reconcile',hint:'Match bank activity',href:'/financials?tab=ledger&view=reconcile'},
  {label:'Bank rules',hint:'Transaction rules',href:'/financials?tab=ledger&view=bank-rules'},
  {label:'Billing and invoices',hint:'Customer receivables',href:'/financials?tab=billing&view=invoices'},
  {label:'Procurement and payables',hint:'Purchases and vendor bills',href:'/financials?tab=procurement&view=payables'},
  {label:'Labor and payroll',hint:'Crew payroll and job costs',href:'/financials?tab=labor&view=payroll'},
] as const;
const isWorkstation=(pathname:string)=>{const segment=pathname.match(/^\/takeoff\/([^/]+)/)?.[1];return Boolean(segment&&!['assemblies','intelligence','plans'].includes(segment));};

function CarezCommandRail({pathname,userName,onOpenCommand,onOpenMobile}:{pathname:string;userName:string;onOpenCommand:()=>void;onOpenMobile:()=>void}){
  const {resolvedTheme,setThemePreference}=useCarezAppearance();
  const active=resolveActiveWorkspacePresentationSurface(pathname)?.id;
  return <header aria-label="Pourtrace global navigation" className="carez-command-bar carez-top-nav sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 text-[var(--shell-foreground)] lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-4">
    <div className="flex min-w-0 items-center gap-1">
      <Button type="button" variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Open navigation" onClick={onOpenMobile}><Menu className="size-4"/></Button>
      <Link href="/overview" prefetch={false} aria-label="Pourtrace home" className="pt-brand-logo-link relative inline-flex shrink-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--pt-logo)]"><BrandLogo size="md" className="max-sm:h-[31px] max-sm:w-[128px]"/></Link>
    </div>
    <nav aria-label="Primary domains" className="hidden min-w-0 items-center justify-center gap-1 lg:flex">
      {WORKSPACE_PRESENTATION_SURFACES.map(item=>{const Icon=DOMAIN_ICONS[item.id];const selected=active===item.id;return <Link key={item.id} href={item.href} prefetch={false} aria-current={selected?'page':undefined} className={cn('carez-nav-button relative inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 text-xs font-semibold text-[var(--shell-muted)] outline-none transition-colors hover:bg-[var(--shell-accent)] hover:text-[var(--shell-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--pt-logo)]',selected&&'carez-nav-button-active text-[var(--shell-foreground)]')}><Icon className="size-3.5"/><span>{item.label}</span></Link>;})}
    </nav>
    <div className="flex shrink-0 items-center justify-end gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={onOpenCommand} aria-label="Search Pourtrace" aria-keyshortcuts="Meta+K Control+K" className="gap-2 text-muted-foreground"><Search className="size-4"/><span className="hidden xl:inline">Search</span><kbd className="hidden text-[10px] text-muted-foreground 2xl:inline">⌘K</kbd></Button>
      <Button type="button" variant="ghost" size="icon" onClick={()=>setThemePreference(resolvedTheme==='dark'?'light':'dark')} aria-label={resolvedTheme==='dark'?'Switch to light mode':'Switch to dark mode'} title={resolvedTheme==='dark'?'Switch to light mode':'Switch to dark mode'}>{resolvedTheme==='dark'?<Sun className="size-4"/>:<Moon className="size-4"/>}</Button>
      <Link href="/settings" prefetch={false} aria-label={'Settings for '+userName} className="flex size-8 items-center justify-center border-l border-border text-xs font-medium text-muted-foreground outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50">{userName.trim().charAt(0).toUpperCase()||'C'}</Link>
    </div>
  </header>;
}

function MobileNavigation({open,onOpenChange,pathname,onNavigate}:{open:boolean;onOpenChange:(open:boolean)=>void;pathname:string;onNavigate:(href:string)=>void}){
  const activeSurface=resolveActiveWorkspacePresentationSurface(pathname)?.id;
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="left" className="w-[90vw] max-w-sm gap-0 rounded-none p-0 lg:hidden"><SheetHeader className="border-b border-border"><SheetTitle>Navigation</SheetTitle></SheetHeader><nav aria-label="Mobile primary navigation" className="min-h-0 overflow-y-auto py-2">{WORKSPACE_PRESENTATION_SURFACES.map(destination=>{const selected=activeSurface===destination.id;return <Link key={destination.id} href={destination.href} prefetch={false} aria-current={selected?'page':undefined} onClick={event=>{event.preventDefault();onOpenChange(false);onNavigate(destination.href);}} className={cn('flex min-h-14 items-center justify-between border-b border-border px-4 text-sm font-semibold outline-none hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',selected&&'border-l-2 border-l-primary bg-primary/5 text-primary')}>{destination.label}<ChevronRight className="size-4" aria-hidden="true"/></Link>;})}</nav><p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Use Search for a specific tool or record.</p></SheetContent></Sheet>;
}

function CarezCommandMenu({open,onOpenChange,onNavigate,projects,opportunities,crew}:{open:boolean;onOpenChange:(open:boolean)=>void;onNavigate:(href:string)=>void;projects:ProjectOption[];opportunities:OpportunityOption[];crew:CrewOption[]}){
  return <CommandDialog open={open} onOpenChange={onOpenChange} title="Search Pourtrace" description="Search workspaces and company records"><Command><CommandInput placeholder="Search projects, opportunities, financials, or crew…" autoFocus/><CommandList className="max-h-[min(65vh,32rem)]"><CommandEmpty>No matching result.</CommandEmpty>
    <CommandGroup heading="Workspaces">{WORKSPACE_PRESENTATION_SURFACES.map(surface=><CommandItem key={surface.id} value={surface.label+' workspace '+surface.href} onSelect={()=>onNavigate(surface.href)}><span className="font-medium">{surface.label}</span></CommandItem>)}</CommandGroup>
    <CommandGroup heading="Financials">{FINANCIAL_COMMANDS.map(item=><CommandItem key={item.href} value={item.label+' '+item.hint+' financials'} onSelect={()=>onNavigate(item.href)}><Wallet/><span><strong className="block font-medium">{item.label}</strong><span className="text-xs text-muted-foreground">{item.hint}</span></span></CommandItem>)}</CommandGroup>
    {projects.length?<CommandGroup heading="Projects">{projects.map(project=><CommandItem key={project.id} value={project.jobNumber+' '+project.name+' '+project.location} onSelect={()=>onNavigate('/projects/'+encodeURIComponent(project.id))}><BriefcaseBusiness/><span className="truncate font-medium">{project.jobNumber?project.jobNumber+' · ':''}{project.name}</span></CommandItem>)}</CommandGroup>:null}
    {opportunities.length?<CommandGroup heading="Opportunities">{opportunities.map(item=><CommandItem key={item.id} value={item.number+' '+item.name+' '+item.customer} onSelect={()=>onNavigate('/opportunities?lead='+encodeURIComponent(item.id))}><Users/><span className="truncate font-medium">{item.number?item.number+' · ':''}{item.name}</span></CommandItem>)}</CommandGroup>:null}
    {crew.length?<CommandGroup heading="Crew members">{crew.map(member=><CommandItem key={member.id} value={member.name+' '+member.role+' crew employee'} onSelect={()=>onNavigate('/field?tab=crew&view=crew#crew-'+encodeURIComponent(member.id))}><HardHat/><span className="truncate font-medium">{member.name}<span className="ml-2 text-xs font-normal text-muted-foreground">{member.role}</span></span></CommandItem>)}</CommandGroup>:null}
  </CommandList></Command></CommandDialog>;
}

function CarezProjectPicker({open,onOpenChange,projects,activeProjectId,onSelect}:{open:boolean;onOpenChange:(open:boolean)=>void;projects:ProjectOption[];activeProjectId:string;onSelect:(projectId:string)=>void}){
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" className="w-[92vw] gap-0 p-0 sm:max-w-md"><SheetHeader className="border-b border-border"><SheetTitle>Switch project</SheetTitle></SheetHeader><Command className="min-h-0 flex-1 rounded-none"><CommandInput placeholder="Search project name or job number..." autoFocus/><CommandList className="max-h-none flex-1"><CommandEmpty>No accessible project found.</CommandEmpty><CommandGroup heading="Projects">{projects.map(project=><CommandItem key={project.id} value={project.jobNumber+' '+project.name+' '+project.location} data-checked={project.id===activeProjectId} onSelect={()=>onSelect(project.id)}><BriefcaseBusiness/><span className="truncate font-medium">{project.jobNumber?project.jobNumber+' · ':''}{project.name}</span></CommandItem>)}</CommandGroup></CommandList></Command></SheetContent></Sheet>;
}

export function AppShell({children,userName,immersive=false}:{children:React.ReactNode;userName:string;immersive?:boolean}){
  const pathname=usePathname(),router=useRouter(),supabase=useMemo(()=>createClient(),[]);
  const [commandOpen,setCommandOpen]=useState(false),[mobileOpen,setMobileOpen]=useState(false),[projectSwitcherOpen,setProjectSwitcherOpen]=useState(false),[projects,setProjects]=useState<ProjectOption[]>([]),[opportunities,setOpportunities]=useState<OpportunityOption[]>([]),[crew,setCrew]=useState<CrewOption[]>([]);
  const workstation=isWorkstation(pathname),activeDestination=useMemo(()=>resolveActiveDestination(pathname),[pathname]),projectContext=useMemo(()=>resolveProjectRoute(pathname),[pathname]),activeProject=useMemo(()=>projectContext?projects.find(project=>project.id===projectContext.projectId)||null:null,[projectContext,projects]);
  useEffect(()=>{let cancelled=false;async function load(){
    const {data:{user}}=await supabase.auth.getUser();if(!user||cancelled)return;
    const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).maybeSingle();if(!profile?.company_id||cancelled)return;
    const companyId=String(profile.company_id);
    const [projectRows,leadRows,crewRows]=await Promise.all([
      supabase.from('projects').select('id,job_number,name,status,address,city,state,created_at').eq('company_id',companyId).order('created_at',{ascending:false}),
      supabase.from('leads').select('id,opportunity_number,project_name,customer_name').eq('company_id',companyId).order('created_at',{ascending:false}),
      supabase.from('crew_members').select('id,name,role').eq('company_id',companyId).order('name'),
    ]);
    if(cancelled)return;
    setProjects(((projectRows.data||[]) as ProjectRow[]).map(row=>({id:String(row.id),jobNumber:row.job_number||'',name:row.name||'Untitled project',status:row.status||null,location:[row.address,row.city,row.state].filter(Boolean).join(', ')})));
    setOpportunities(((leadRows.data||[]) as OpportunityRow[]).map(row=>({id:String(row.id),number:row.opportunity_number?'L-'+row.opportunity_number:'',name:row.project_name||row.customer_name||'Untitled opportunity',customer:row.customer_name||''})));
    setCrew(((crewRows.data||[]) as CrewRow[]).map(row=>({id:String(row.id),name:row.name||'Unnamed crew member',role:row.role||''})));
  }void load();return()=>{cancelled=true};},[supabase]);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setCommandOpen(value=>!value)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[]);
  useEffect(()=>{setMobileOpen(false);setProjectSwitcherOpen(false);},[pathname]);
  if(immersive)return <div className="min-h-svh bg-background text-foreground">{children}</div>;
  const navigate=(href:string)=>{setCommandOpen(false);setMobileOpen(false);router.push(href)};
  return <div className="carez-app flex min-h-svh flex-col bg-background text-foreground"><a href="#carez-workspace" className="carez-skip-link">Skip to workspace</a><CarezCommandRail pathname={pathname} userName={userName} onOpenCommand={()=>setCommandOpen(true)} onOpenMobile={()=>setMobileOpen(true)}/><div className="flex min-w-0 flex-1 flex-col">{projectContext&&activeProject?<CarezProjectContextBar projectName={activeProject.name} projectDetail={activeProject.jobNumber||activeProject.location||'Project'} workspaceLabel={projectContext.workspaceLabel} onOpenProjectSwitcher={()=>setProjectSwitcherOpen(true)}/>:null}<main id="carez-workspace" tabIndex={-1} aria-label={activeDestination?.label||'Pourtrace workspace'} className={workstation?'carez-workstation min-h-0 min-w-0 flex-1 overflow-hidden':'carez-workspace bg-vignette-light dark:bg-vignette-dark min-h-0 min-w-0 flex-1 overflow-auto'}>{children}</main></div><MobileNavigation open={mobileOpen} onOpenChange={setMobileOpen} pathname={pathname} onNavigate={navigate}/><CarezCommandMenu open={commandOpen} onOpenChange={setCommandOpen} onNavigate={navigate} projects={projects} opportunities={opportunities} crew={crew}/>{projectContext&&activeProject?<CarezProjectPicker open={projectSwitcherOpen} onOpenChange={setProjectSwitcherOpen} projects={projects} activeProjectId={activeProject.id} onSelect={projectId=>{setProjectSwitcherOpen(false);router.push(buildProjectSwitchHref(pathname,projectId))}}/>:null}</div>;
}
