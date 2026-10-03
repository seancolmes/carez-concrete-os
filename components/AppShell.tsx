'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {Button,Dialog,DialogSurface,DialogTitle,DrawerBody,DrawerHeader,Input,OverlayDrawer} from '@fluentui/react-components';
import type {FluentIcon} from '@fluentui/react-icons';
import {usePathname,useRouter} from 'next/navigation';
import {motion} from 'framer-motion';
import { BriefcaseRegular as BriefcaseBusiness, BuildingRegular as Building2, ChevronRightRegular as ChevronRight, PersonWrenchRegular as HardHat, HomeRegular as Home, BuildingBankRegular as Landmark, NavigationRegular as Menu, SearchRegular as Search, SettingsRegular as Settings, PeopleRegular as Users, WalletRegular as Wallet } from '@fluentui/react-icons';
import {BrandLogo} from '@/components/brand/BrandLogo';
import {ThemeSwitch} from '@/components/ThemeSwitch';
import {CarezProjectContextBar} from '@/components/carez/project-context';
export {CarezProjectSwitcher} from '@/components/carez/project-context';
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
  {label:'Billing and invoices',hint:'Customer receivables',href:'/financials?tab=billing&view=invoices'},
  {label:'Job costs',hint:'Recorded project costs',href:'/financials?tab=costs&view=costs'},
] as const;
const isWorkstation=(pathname:string)=>{const segment=pathname.match(/^\/takeoff\/([^/]+)/)?.[1];return Boolean(segment&&segment!=='plans');};

function CarezCommandRail({pathname,userName,onOpenCommand,onOpenMobile}:{pathname:string;userName:string;onOpenCommand:()=>void;onOpenMobile:()=>void}){
  const active=resolveActiveWorkspacePresentationSurface(pathname)?.id;
  return <header aria-label="Pourtrace global navigation" className="carez-command-bar carez-top-nav sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 text-[var(--shell-foreground)] lg:grid lg:h-12 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-4">
    <div className="flex min-w-0 items-center gap-1">
      <Button type="button" appearance="subtle" icon={<Menu className="size-4"/>} className="carez-mobile-nav-trigger shrink-0 lg:hidden" aria-label="Open navigation" onClick={onOpenMobile}/>
      <Link href="/dashboard" prefetch={false} aria-label="Pourtrace home" className="pt-brand-logo-link relative inline-flex shrink-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-ring"><motion.span layoutId="brand-logo" transition={{layout:{duration:0.7,ease:[0.22,1,0.36,1]}}}><BrandLogo size="sm" idPrefix="app-navigation"/></motion.span></Link>
    </div>
    <nav aria-label="Primary domains" className="hidden min-w-0 items-center justify-center gap-1 lg:flex">
      {WORKSPACE_PRESENTATION_SURFACES.map(item=>{const Icon=DOMAIN_ICONS[item.id];const selected=active===item.id;return <Link key={item.id} href={item.href} prefetch={false} aria-current={selected?'page':undefined} className={cn('carez-nav-button relative inline-flex h-8 shrink-0 items-center gap-2 rounded-sm border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 text-xs font-semibold text-[var(--shell-muted)] outline-none transition-colors hover:bg-[var(--shell-accent)] hover:text-[var(--shell-foreground)] focus-visible:ring-2 focus-visible:ring-ring',selected&&'carez-nav-button-active text-[var(--shell-foreground)]')}><Icon className="size-3.5"/><span>{item.label}</span></Link>;})}
    </nav>
    <div className="flex shrink-0 items-center justify-end gap-1">
      <Button type="button" appearance="subtle" size="small" icon={<Search className="size-4"/>} onClick={onOpenCommand} aria-label="Search Pourtrace" aria-keyshortcuts="Meta+K Control+K" className="gap-2 text-muted-foreground"><span className="hidden xl:inline">Search</span><kbd className="hidden text-[10px] text-muted-foreground 2xl:inline">⌘K</kbd></Button>
      <ThemeSwitch/>
      <Link href="/settings" prefetch={false} aria-label={'Settings for '+userName} className="flex size-8 items-center justify-center border-l border-border text-xs font-medium text-muted-foreground outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50">{userName.trim().charAt(0).toUpperCase()||'C'}</Link>
    </div>
  </header>;
}

function MobileNavigation({open,onOpenChange,pathname,onNavigate}:{open:boolean;onOpenChange:(open:boolean)=>void;pathname:string;onNavigate:(href:string)=>void}){
  const activeSurface=resolveActiveWorkspacePresentationSurface(pathname)?.id;
  return <OverlayDrawer open={open} onOpenChange={(_,data)=>onOpenChange(data.open)} position="start" size="small" className="gap-0 p-0 lg:hidden">
    <DrawerHeader className="border-b border-border"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">Navigation</h2><Button appearance="subtle" aria-label="Close navigation" onClick={()=>onOpenChange(false)}>Close</Button></div></DrawerHeader>
    <DrawerBody className="p-0"><nav aria-label="Mobile primary navigation" className="min-h-0 overflow-y-auto py-2">{WORKSPACE_PRESENTATION_SURFACES.map(destination=>{const selected=activeSurface===destination.id;return <Link key={destination.id} href={destination.href} prefetch={false} aria-current={selected?'page':undefined} onClick={event=>{event.preventDefault();onOpenChange(false);onNavigate(destination.href);}} className={cn('flex min-h-14 items-center justify-between border-b border-border px-4 text-sm font-semibold outline-none hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',selected&&'border-l-2 border-l-primary bg-primary/5 text-primary')}>{destination.label}<ChevronRight className="size-4" aria-hidden="true"/></Link>;})}</nav><p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Use Search for a specific tool or record.</p></DrawerBody>
  </OverlayDrawer>;
}

function CarezCommandMenu({open,onOpenChange,onNavigate,projects,opportunities,crew}:{open:boolean;onOpenChange:(open:boolean)=>void;onNavigate:(href:string)=>void;projects:ProjectOption[];opportunities:OpportunityOption[];crew:CrewOption[]}){
  const [query,setQuery]=useState('');
  const [activeIndex,setActiveIndex]=useState(0);
  const entries=useMemo(()=>[
    ...WORKSPACE_PRESENTATION_SURFACES.map(surface=>({group:'Workspaces',label:surface.label,detail:'Workspace',href:surface.href,Icon:DOMAIN_ICONS[surface.id] as FluentIcon})),
    ...FINANCIAL_COMMANDS.map(item=>({group:'Financials',label:item.label,detail:item.hint,href:item.href,Icon:Wallet as FluentIcon})),
    ...projects.map(project=>({group:'Projects',label:(project.jobNumber?project.jobNumber+' · ':'')+project.name,detail:project.location,href:'/projects/'+encodeURIComponent(project.id),Icon:BriefcaseBusiness as FluentIcon})),
    ...opportunities.map(item=>({group:'Opportunities',label:(item.number?item.number+' · ':'')+item.name,detail:item.customer,href:'/opportunities?lead='+encodeURIComponent(item.id),Icon:Users as FluentIcon})),
    ...crew.map(member=>({group:'Crew members',label:member.name,detail:member.role,href:'/field?tab=crew&view=crew#crew-'+encodeURIComponent(member.id),Icon:HardHat as FluentIcon})),
  ],[projects,opportunities,crew]);
  const filtered=useMemo(()=>entries.filter(entry=>(entry.label+' '+entry.detail+' '+entry.group).toLowerCase().includes(query.trim().toLowerCase())).slice(0,100),[entries,query]);
  useEffect(()=>{if(open){setQuery('');setActiveIndex(0)}},[open]);
  const groups=['Workspaces','Financials','Projects','Opportunities','Crew members'];
  return <Dialog open={open} onOpenChange={(_,data)=>onOpenChange(data.open)}>
    <DialogSurface className="w-[min(640px,calc(100vw-2rem))] max-w-none border border-win-stroke bg-win-bg2 p-0 shadow-2xl">
      <DialogTitle className="border-b border-win-stroke px-4 py-3 text-base">Search Pourtrace</DialogTitle>
      <Input appearance="underline" autoFocus aria-label="Search workspaces and company records" placeholder="Search projects, opportunities, financials, or crew…" contentBefore={<Search/>} value={query} onChange={(_,data)=>{setQuery(data.value);setActiveIndex(0)}} onKeyDown={event=>{
        if(event.key==='ArrowDown'){event.preventDefault();setActiveIndex(index=>Math.min(index+1,filtered.length-1))}
        if(event.key==='ArrowUp'){event.preventDefault();setActiveIndex(index=>Math.max(index-1,0))}
        if(event.key==='Enter'&&filtered[activeIndex]){event.preventDefault();onNavigate(filtered[activeIndex].href)}
      }} className="mx-4 my-3 w-[calc(100%-2rem)]"/>
      <div role="listbox" aria-label="Search results" className="max-h-[min(65vh,32rem)] overflow-y-auto px-2 pb-2">
        {filtered.length===0?<p className="px-3 py-5 text-sm text-muted-foreground">No matching result.</p>:groups.map(group=>{
          const rows=filtered.filter(entry=>entry.group===group);
          return rows.length?<div key={group}><div className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>{rows.map(entry=>{
            const index=filtered.indexOf(entry);const Icon=entry.Icon;
            return <Button key={entry.href} role="option" aria-selected={index===activeIndex} appearance={index===activeIndex?'secondary':'subtle'} icon={<Icon/>} onMouseEnter={()=>setActiveIndex(index)} onClick={()=>onNavigate(entry.href)} className="mb-0.5 flex w-full justify-start text-left"><span className="min-w-0 truncate">{entry.label}{entry.detail?<small className="ml-2 font-normal text-muted-foreground">{entry.detail}</small>:null}</span></Button>;
          })}</div>:null;
        })}
      </div>
    </DialogSurface>
  </Dialog>;
}

function CarezProjectPicker({open,onOpenChange,projects,activeProjectId,onSelect}:{open:boolean;onOpenChange:(open:boolean)=>void;projects:ProjectOption[];activeProjectId:string;onSelect:(projectId:string)=>void}){
  const [query,setQuery]=useState('');
  useEffect(()=>{if(open)setQuery('')},[open]);
  const visible=projects.filter(project=>(project.jobNumber+' '+project.name+' '+project.location).toLowerCase().includes(query.trim().toLowerCase()));
  return <OverlayDrawer open={open} onOpenChange={(_,data)=>onOpenChange(data.open)} position="end" size="small" className="gap-0 p-0">
    <DrawerHeader className="border-b border-border"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">Switch project</h2><Button appearance="subtle" aria-label="Close project picker" onClick={()=>onOpenChange(false)}>Close</Button></div></DrawerHeader>
    <DrawerBody className="min-h-0 p-3"><Input appearance="underline" autoFocus placeholder="Search project name or job number..." aria-label="Search projects" value={query} onChange={(_,data)=>setQuery(data.value)} className="w-full"/><div className="mt-3 max-h-[calc(100dvh-10rem)] overflow-y-auto">{visible.length?visible.map(project=><Button key={project.id} appearance={project.id===activeProjectId?'secondary':'subtle'} icon={<BriefcaseBusiness/>} onClick={()=>onSelect(project.id)} className="mb-1 w-full justify-start text-left">{project.jobNumber?project.jobNumber+' · ':''}{project.name}</Button>):<p className="px-2 py-4 text-sm text-muted-foreground">No accessible project found.</p>}</div></DrawerBody>
  </OverlayDrawer>;
}

export function AppShell({children,userName,immersive=false}:{children:React.ReactNode;userName:string;immersive?:boolean}){
  const pathname=usePathname(),router=useRouter(),supabase=useMemo(()=>createClient(),[]);
  const [commandOpen,setCommandOpen]=useState(false),[mobileOpen,setMobileOpen]=useState(false),[projectSwitcherOpen,setProjectSwitcherOpen]=useState(false),[projects,setProjects]=useState<ProjectOption[]>([]),[opportunities,setOpportunities]=useState<OpportunityOption[]>([]),[crew,setCrew]=useState<CrewOption[]>([]);
  const workstation=isWorkstation(pathname),estimatingWorkspace=pathname==='/opportunities',activeDestination=useMemo(()=>resolveActiveDestination(pathname),[pathname]),workspaceLabel=activeDestination?.label||resolveActiveWorkspacePresentationSurface(pathname)?.label||'Workspace',projectContext=useMemo(()=>resolveProjectRoute(pathname),[pathname]),activeProject=useMemo(()=>projectContext?projects.find(project=>project.id===projectContext.projectId)||null:null,[projectContext,projects]);
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
  useEffect(()=>{const media=window.matchMedia('(min-width: 1024px)');const closeOnDesktop=()=>{if(media.matches)setMobileOpen(false)};media.addEventListener('change',closeOnDesktop);return()=>media.removeEventListener('change',closeOnDesktop);},[]);
  if(immersive)return <div className="min-h-svh bg-background text-foreground">{children}</div>;
  const navigate=(href:string)=>{setCommandOpen(false);setMobileOpen(false);router.push(href)};
  return <div className={cn('carez-app flex min-h-svh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden',workstation&&'h-svh overflow-hidden')}><a href="#carez-workspace" className="carez-skip-link">Skip to workspace</a><CarezCommandRail pathname={pathname} userName={userName} onOpenCommand={()=>setCommandOpen(true)} onOpenMobile={()=>setMobileOpen(true)}/><div className="flex min-h-0 min-w-0 flex-1 flex-col">{projectContext&&activeProject?<CarezProjectContextBar projectName={activeProject.name} projectDetail={activeProject.jobNumber||activeProject.location||'Project'} workspaceLabel={projectContext.workspaceLabel} onOpenProjectSwitcher={()=>setProjectSwitcherOpen(true)}/>:null}<main id="carez-workspace" tabIndex={-1} aria-label={workspaceLabel} className={cn('relative isolate min-h-0 min-w-0 flex-1',workstation?'carez-workstation overflow-hidden':estimatingWorkspace?'carez-workstation overflow-auto lg:overflow-hidden':'carez-workspace carez-desktop-main overflow-auto')}>{children}</main></div>{workstation||estimatingWorkspace?null:<div role="status" className="carez-desktop-status hidden shrink-0 items-center justify-between gap-3 px-3 text-[11px] lg:flex"><span className="min-w-0 truncate">{workspaceLabel}</span><Button type="button" appearance="subtle" size="small" onClick={()=>setCommandOpen(true)} aria-label="Open workspace search">Ctrl+K · Search</Button></div>}<MobileNavigation open={mobileOpen} onOpenChange={setMobileOpen} pathname={pathname} onNavigate={navigate} /><CarezCommandMenu open={commandOpen} onOpenChange={setCommandOpen} onNavigate={navigate} projects={projects} opportunities={opportunities} crew={crew}/>{projectContext&&activeProject?<CarezProjectPicker open={projectSwitcherOpen} onOpenChange={setProjectSwitcherOpen} projects={projects} activeProjectId={activeProject.id} onSelect={projectId=>{setProjectSwitcherOpen(false);router.push(buildProjectSwitchHref(pathname,projectId))}}/>:null}</div>;
}
