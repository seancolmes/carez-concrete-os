'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {Button,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,Input,useRestoreFocusTarget} from '@fluentui/react-components';
import type {FluentIcon} from '@fluentui/react-icons';
import {usePathname,useRouter} from 'next/navigation';
import {motion} from 'framer-motion';
import { BriefcaseRegular as BriefcaseBusiness, BuildingRegular as Building2, ChevronRightRegular as ChevronRight, PersonWrenchRegular as HardHat, HomeRegular as Home, BuildingBankRegular as Landmark, NavigationRegular as Menu, SearchRegular as Search, SettingsRegular as Settings, PeopleRegular as Users, WalletRegular as Wallet } from '@fluentui/react-icons';
import styles from './AppShell.module.css';
import {BrandLogo} from '@/components/brand/BrandLogo';
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
  const restoreFocusTarget=useRestoreFocusTarget();
  return <header aria-label="PourTrace global navigation" className={styles.header}>
    <div className={styles.brand}>
      <Button {...restoreFocusTarget} type="button" appearance="subtle" icon={<Menu/>} className={styles.mobileTrigger} aria-label="Open navigation" onClick={onOpenMobile}/>
      <Link href="/dashboard" prefetch={false} aria-label="PourTrace home" className="pt-brand-logo-link inline-flex shrink-0"><motion.span layoutId="brand-logo"><BrandLogo size="sm" idPrefix="app-navigation"/></motion.span></Link>
    </div>
    <nav aria-label="Primary domains" className={styles.navigation}>
      {WORKSPACE_PRESENTATION_SURFACES.map(item=>{const Icon=DOMAIN_ICONS[item.id];const selected=active===item.id;return <Link key={item.id} href={item.href} prefetch={false} aria-current={selected?'page':undefined} className={cn(styles.navItem,selected&&styles.navItemActive)}><Icon/><span>{item.label}</span></Link>;})}
    </nav>
    <div className={styles.actions}>
      <Button {...restoreFocusTarget} type="button" appearance="subtle" icon={<Search/>} onClick={onOpenCommand} aria-label="Search PourTrace" aria-keyshortcuts="Meta+K Control+K"><span className="hidden xl:inline">Search</span></Button>
      <Link href="/settings" prefetch={false} aria-label={'Settings for '+userName} className={styles.account}>{userName.trim().charAt(0).toUpperCase()||'P'}</Link>
    </div>
  </header>;
}

function MobileNavigation({open,onOpenChange,pathname,onNavigate}:{open:boolean;onOpenChange:(open:boolean)=>void;pathname:string;onNavigate:(href:string)=>void}){
  const activeSurface=resolveActiveWorkspacePresentationSurface(pathname)?.id;
  return <Dialog open={open} onOpenChange={(_,data)=>onOpenChange(data.open)}>
    <DialogSurface className="pt-dialog pt-dialog-compact"><DialogBody>
      <div className={styles.dialogHeader}><DialogTitle>Navigation</DialogTitle><Button type="button" appearance="subtle" onClick={()=>onOpenChange(false)}>Close</Button></div>
      <DialogContent><nav aria-label="Mobile primary navigation" className={styles.dialogList}>{WORKSPACE_PRESENTATION_SURFACES.map(item=><Link key={item.id} href={item.href} prefetch={false} aria-current={activeSurface===item.id?'page':undefined} className={styles.dialogLink} onClick={event=>{event.preventDefault();onOpenChange(false);onNavigate(item.href);}}>{item.label}<ChevronRight className="size-4"/></Link>)}</nav></DialogContent>
    </DialogBody></DialogSurface>
  </Dialog>;
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
    <DialogSurface className="pt-dialog pt-dialog-compact"><DialogBody>
      <div className="pt-dialog-heading"><DialogTitle>Search PourTrace</DialogTitle><Button type="button" appearance="subtle" onClick={()=>onOpenChange(false)}>Close</Button></div>
      <DialogContent className="pt-dialog-content">
      <Input appearance="outline" autoFocus aria-label="Search workspaces and company records" placeholder="Search projects, opportunities, financials, or crew…" contentBefore={<Search/>} value={query} onChange={(_,data)=>{setQuery(data.value);setActiveIndex(0)}} onKeyDown={event=>{
        if(event.key==='ArrowDown'){event.preventDefault();setActiveIndex(index=>Math.min(index+1,filtered.length-1))}
        if(event.key==='ArrowUp'){event.preventDefault();setActiveIndex(index=>Math.max(index-1,0))}
        if(event.key==='Enter'&&filtered[activeIndex]){event.preventDefault();onNavigate(filtered[activeIndex].href)}
      }} className="mb-3 w-full"/>
      <div role="listbox" aria-label="Search results" className="max-h-[min(65vh,32rem)] overflow-y-auto px-2 pb-2">
        {filtered.length===0?<p className="px-3 py-5 text-sm text-muted-foreground">No matching result.</p>:groups.map(group=>{
          const rows=filtered.filter(entry=>entry.group===group);
          return rows.length?<div key={group}><div className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>{rows.map(entry=>{
            const index=filtered.indexOf(entry);const Icon=entry.Icon;
            return <Button key={entry.href} role="option" aria-selected={index===activeIndex} appearance={index===activeIndex?'secondary':'subtle'} icon={<Icon/>} onMouseEnter={()=>setActiveIndex(index)} onClick={()=>onNavigate(entry.href)} className="mb-0.5 flex w-full justify-start text-left"><span className="min-w-0 truncate">{entry.label}{entry.detail?<small className="ml-2 font-normal text-muted-foreground">{entry.detail}</small>:null}</span></Button>;
          })}</div>:null;
        })}
      </div>
      </DialogContent>
    </DialogBody></DialogSurface>
  </Dialog>;
}

function CarezProjectPicker({open,onOpenChange,projects,activeProjectId,onSelect}:{open:boolean;onOpenChange:(open:boolean)=>void;projects:ProjectOption[];activeProjectId:string;onSelect:(projectId:string)=>void}){
  const [query,setQuery]=useState('');
  useEffect(()=>{if(open)setQuery('')},[open]);
  const visible=projects.filter(project=>(project.jobNumber+' '+project.name+' '+project.location).toLowerCase().includes(query.trim().toLowerCase()));
  return <Dialog open={open} onOpenChange={(_,data)=>onOpenChange(data.open)}><DialogSurface className="pt-dialog pt-dialog-compact"><DialogBody>
    <div className={styles.dialogHeader}><DialogTitle>Switch project</DialogTitle><Button type="button" appearance="subtle" onClick={()=>onOpenChange(false)}>Cancel</Button></div>
    <DialogContent><Input appearance="outline" aria-label="Search projects" placeholder="Project name or job number" value={query} onChange={(_,data)=>setQuery(data.value)} className="w-full"/><div className={styles.dialogList}>{visible.length?visible.map(project=><Button key={project.id} appearance={project.id===activeProjectId?'primary':'subtle'} icon={<BriefcaseBusiness/>} onClick={()=>onSelect(project.id)} style={{height:'auto',minHeight:44,justifyContent:'flex-start',textAlign:'left',whiteSpace:'normal'}}>{project.jobNumber?project.jobNumber+' · ':''}{project.name}</Button>):<p className="p-3 text-sm text-muted-foreground">No accessible project found.</p>}</div></DialogContent>
  </DialogBody></DialogSurface></Dialog>;
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
  return <div className={cn('carez-app flex min-h-svh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden',workstation&&'h-svh overflow-hidden')}><a href="#carez-workspace" className="carez-skip-link">Skip to workspace</a><CarezCommandRail pathname={pathname} userName={userName} onOpenCommand={()=>setCommandOpen(true)} onOpenMobile={()=>setMobileOpen(true)}/><div className="flex min-h-0 min-w-0 flex-1 flex-col">{projectContext&&activeProject?<CarezProjectContextBar projectName={activeProject.name} projectDetail={activeProject.jobNumber||activeProject.location||'Project'} workspaceLabel={projectContext.workspaceLabel} onOpenProjectSwitcher={()=>setProjectSwitcherOpen(true)}/>:null}<main id="carez-workspace" tabIndex={-1} aria-label={workspaceLabel} className={cn('relative isolate min-h-0 min-w-0 flex-1',styles.content,workstation?'carez-workstation overflow-hidden':estimatingWorkspace?'carez-workstation overflow-auto lg:overflow-hidden':'carez-workspace carez-desktop-main overflow-auto')}>{children}</main></div>{workstation||estimatingWorkspace?null:<div role="status" className="carez-desktop-status hidden shrink-0 items-center justify-between gap-3 px-3 text-[11px] lg:flex"><span className="min-w-0 truncate">{workspaceLabel}</span><Button type="button" appearance="subtle" size="small" onClick={()=>setCommandOpen(true)} aria-label="Open workspace search">Ctrl+K · Search</Button></div>}<MobileNavigation open={mobileOpen} onOpenChange={setMobileOpen} pathname={pathname} onNavigate={navigate} /><CarezCommandMenu open={commandOpen} onOpenChange={setCommandOpen} onNavigate={navigate} projects={projects} opportunities={opportunities} crew={crew}/>{projectContext&&activeProject?<CarezProjectPicker open={projectSwitcherOpen} onOpenChange={setProjectSwitcherOpen} projects={projects} activeProjectId={activeProject.id} onSelect={projectId=>{setProjectSwitcherOpen(false);router.push(buildProjectSwitchHref(pathname,projectId))}}/>:null}</div>;
}
