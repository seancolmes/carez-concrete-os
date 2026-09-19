'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {
  ArrowDown,ArrowUp,Banknote,BarChart3,Bell,BriefcaseBusiness,Calculator,CalendarDays,ChevronDown,
  ClipboardCheck,ClipboardList,CreditCard,Ellipsis,FileText,Gauge,Hammer,HardHat,Home,Inbox,KeyRound,
  Landmark,LibraryBig,ListChecks,Minus,PackageCheck,Plus,Receipt,ReceiptText,RotateCcw,Ruler,Search,
  Settings,ShieldCheck,ShoppingCart,SlidersHorizontal,TrendingUp,Users,Wallet,Wrench,type LucideIcon,
} from 'lucide-react';
import {BankSyncPulse} from '@/components/PlaidBankControls';
import {OutlookSyncPulse} from '@/components/OutlookSyncPulse';
import {Button,buttonVariants} from '@/components/ui/button';
import {Command,CommandDialog,CommandEmpty,CommandGroup,CommandInput,CommandItem,CommandList} from '@/components/ui/command';
import {
  DropdownMenu,DropdownMenuContent,DropdownMenuGroup,DropdownMenuItem,DropdownMenuLabel,
  DropdownMenuSeparator,DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Sheet,SheetContent,SheetDescription,SheetFooter,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Tooltip,TooltipContent,TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {createClient} from '@/lib/supabase/client';
import {COMPANY_BRANDING_CHANGED_EVENT,FALLBACK_COMPANY_LOGO,companyLogoPublicUrl} from '@/lib/companyBranding';
import {
  MAX_DESKTOP_PINNED_DESTINATIONS,MAX_RECENT_DESTINATIONS,MAX_RECENT_PROJECTS,
  NAVIGATION_GROUPS,NAVIGATION_PREFERENCE_VERSION,buildProjectSwitchHref,getDestinationById,
  getRoleDefaultDestinationIds,matchesDestinationPath,movePinnedDestination,navigationPreferenceStorageKey,
  normalizeNavigationPreference,normalizeRecentDestinationIds,normalizeRecentProjectIds,prependRecentId,
  recentDestinationsStorageKey,recentProjectsStorageKey,resetNavigationPreference,resolveActiveDestination,
  resolveProjectRoute,togglePinnedDestination,type NavigationDestination,type NavigationIconKey,
  type ProjectRouteContext,
} from '@/lib/ui/navigation';

type ShellIdentity={userId:string;companyId:string;role:string|null};
type ProjectOption={id:string;jobNumber:string;name:string;status:string|null;location:string};
type ProjectRow={id:string;job_number:string|null;name:string|null;status:string|null;address:string|null;city:string|null;state:string|null};

const NAVIGATION_ICONS:Record<NavigationIconKey,LucideIcon>={
  home:Home,reports:BarChart3,users:Users,inbox:Inbox,trending:TrendingUp,ruler:Ruler,
  calculator:Calculator,file:FileText,shield:ShieldCheck,library:LibraryBig,gauge:Gauge,
  briefcase:BriefcaseBusiness,'clipboard-check':ClipboardCheck,calendar:CalendarDays,
  'list-checks':ListChecks,package:PackageCheck,'clipboard-list':ClipboardList,hammer:Hammer,
  'hard-hat':HardHat,key:KeyRound,wrench:Wrench,'receipt-text':ReceiptText,wallet:Wallet,
  'credit-card':CreditCard,landmark:Landmark,banknote:Banknote,receipt:Receipt,
  sliders:SlidersHorizontal,'shopping-cart':ShoppingCart,settings:Settings,
};

function isDestination(value:NavigationDestination|null):value is NavigationDestination{return Boolean(value)}
function destinationsFor(ids:readonly string[]){return ids.map(getDestinationById).filter(isDestination)}
function readDeviceJson(key:string):unknown{try{const raw=window.localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}}
function writeDeviceJson(key:string,value:unknown){try{window.localStorage.setItem(key,JSON.stringify(value))}catch{}}
function isWorkstation(pathname:string){
  const segment=pathname.match(/^\/takeoff\/([^/]+)/)?.[1];
  return Boolean(segment&&!['assemblies','intelligence','plans'].includes(segment))||/^\/estimates\/[^/]+/.test(pathname);
}

export function CarezProjectSwitcher({label='Carez workspace',detail='Company',onClick}:{label?:string;detail?:string;onClick?:()=>void}){
  return <Button type="button" variant="ghost" size="sm" className="h-7 min-w-0 max-w-[min(72vw,30rem)] justify-start gap-2 px-2 text-left" onClick={onClick}>
    <BriefcaseBusiness className="size-3.5 shrink-0 text-muted-foreground"/>
    <span className="min-w-0"><span className="block truncate text-xs font-medium">{label}</span><span className="hidden truncate text-[10px] leading-3 text-muted-foreground sm:block">{detail}</span></span>
    <ChevronDown className="ml-1 size-3 shrink-0 text-muted-foreground"/>
  </Button>;
}

function CarezPinnedNav({destinations,pathname}:{destinations:NavigationDestination[];pathname:string}){
  return <nav aria-label="Pinned Carez navigation" className="flex min-w-0 items-center gap-0.5">
    {destinations.map(destination=>{
      const Icon=NAVIGATION_ICONS[destination.icon];
      const active=matchesDestinationPath(pathname,destination.href);
      return <Link key={destination.id} href={destination.href} prefetch={false} aria-current={active?'page':undefined}
        className={cn(buttonVariants({variant:'ghost',size:'sm'}),'h-7 gap-1.5 px-2 text-xs',active&&'bg-muted text-foreground')}>
        <Icon className="size-3.5 text-muted-foreground"/><span className="truncate">{destination.label}</span>
      </Link>;
    })}
  </nav>;
}

function CarezMoreMenu({pinnedIds,pathname,onNavigate,onManage,className}:{pinnedIds:string[];pathname:string;onNavigate:(href:string)=>void;onManage:()=>void;className?:string}){
  const active=resolveActiveDestination(pathname);
  return <div className={className}><DropdownMenu>
    <DropdownMenuTrigger className={cn(buttonVariants({variant:'ghost',size:'sm'}),'h-7 gap-1 px-2 text-xs',active&&!pinnedIds.includes(active.id)&&'bg-muted text-foreground')}>More <ChevronDown className="size-3"/></DropdownMenuTrigger>
    <DropdownMenuContent align="start" sideOffset={4} className="w-80">
      {NAVIGATION_GROUPS.map(group=>{
        const items=destinationsFor(group.destinationIds).filter(destination=>!pinnedIds.includes(destination.id));
        if(!items.length)return null;
        return <DropdownMenuGroup key={group.id}>
          <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
          {items.map(destination=>{const Icon=NAVIGATION_ICONS[destination.icon];return <DropdownMenuItem key={destination.id} onClick={()=>onNavigate(destination.href)} className={cn('min-h-8 gap-2',matchesDestinationPath(pathname,destination.href)&&'bg-accent text-accent-foreground')}>
            <Icon className="size-3.5 text-muted-foreground"/><span className="min-w-0 flex-1 truncate">{destination.label}</span>
          </DropdownMenuItem>})}
        </DropdownMenuGroup>;
      })}
      <DropdownMenuSeparator/>
      <DropdownMenuItem onClick={onManage} className="min-h-8 gap-2"><SlidersHorizontal className="size-3.5"/>Manage navigation</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu></div>;
}

export function CarezTopShell({userName,logoUrl,pathname,pinnedIds,pinnedDestinations,onNavigate,onOpenCommand,onOpenManager}:{userName:string;logoUrl:string;pathname:string;pinnedIds:string[];pinnedDestinations:NavigationDestination[];onNavigate:(href:string)=>void;onOpenCommand:()=>void;onOpenManager:()=>void}){
  const initial=userName.trim().charAt(0).toUpperCase()||'C';
  return <header className="flex h-11 items-center border-b border-border bg-background/96 px-2.5 backdrop-blur-xl md:px-3">
    <Link href="/" prefetch={false} className="flex h-11 shrink-0 items-center rounded-sm pr-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
      <img src={logoUrl} alt="Company logo" className="h-5 max-w-32 object-contain object-left"/>
    </Link>
    <span className="hidden h-5 w-px shrink-0 bg-border lg:block"/>
    <div className="hidden min-w-0 flex-1 items-center gap-1 pl-1 lg:flex">
      <CarezPinnedNav destinations={pinnedDestinations} pathname={pathname}/>
      <CarezMoreMenu pinnedIds={pinnedIds} pathname={pathname} onNavigate={onNavigate} onManage={onOpenManager}/>
    </div>
    <CarezMoreMenu className="hidden md:block lg:hidden" pinnedIds={pinnedIds} pathname={pathname} onNavigate={onNavigate} onManage={onOpenManager}/>
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <Button type="button" variant="outline" size="sm" onClick={onOpenCommand} className="hidden h-8 min-w-44 justify-start gap-2 border-border/80 bg-muted/15 px-2.5 text-muted-foreground xl:inline-flex"><Search className="size-3.5"/><span>Search Carez</span><kbd className="ml-auto rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd></Button>
      <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" onClick={onOpenCommand}/>} className="xl:hidden"><Search/></TooltipTrigger><TooltipContent>Search Carez</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm"/>}><Bell/></TooltipTrigger><TooltipContent>Notifications</TooltipContent></Tooltip>
      <Link href="/settings" prefetch={false} className={cn(buttonVariants({variant:'ghost',size:'sm'}),'h-8 gap-2 px-1.5')}>
        <span className="flex size-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold">{initial}</span>
        <span className="hidden max-w-28 truncate text-xs 2xl:inline">{userName}</span>
      </Link>
    </div>
  </header>;
}

function CarezNavigationManager({open,onOpenChange,pinnedIds,role,onChange,onReset}:{open:boolean;onOpenChange:(open:boolean)=>void;pinnedIds:string[];role:string|null;onChange:(ids:string[])=>void;onReset:()=>void}){
  const pinned=destinationsFor(pinnedIds);
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" className="w-[92vw] gap-0 p-0 sm:max-w-md">
    <SheetHeader className="border-b border-border"><SheetTitle>Manage navigation</SheetTitle><SheetDescription>Pin up to five destinations and order them for this device. Role defaults remain the reset point.</SheetDescription></SheetHeader>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-2 flex items-center justify-between gap-3"><div className="text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground">Pinned</div><div className="font-mono text-xs tabular-nums text-muted-foreground">{pinnedIds.length}/{MAX_DESKTOP_PINNED_DESTINATIONS}</div></div>
      <div className="space-y-1">{pinned.map((destination,index)=>{const Icon=NAVIGATION_ICONS[destination.icon];return <div key={destination.id} className="flex min-h-11 items-center gap-2 rounded-md border border-border/70 px-2">
        <Icon className="size-4 shrink-0 text-muted-foreground"/><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{destination.label}</div><div className="truncate text-xs text-muted-foreground">{destination.hint}</div></div>
        <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-9" aria-label={`Move ${destination.label} up`} disabled={index===0} onClick={()=>onChange(movePinnedDestination(pinnedIds,destination.id,-1))}><ArrowUp/></Button>
        <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-9" aria-label={`Move ${destination.label} down`} disabled={index===pinned.length-1} onClick={()=>onChange(movePinnedDestination(pinnedIds,destination.id,1))}><ArrowDown/></Button>
        <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-9" aria-label={`Unpin ${destination.label}`} disabled={pinnedIds.length===1} onClick={()=>onChange(togglePinnedDestination(pinnedIds,destination.id))}><Minus/></Button>
      </div>})}</div>
      <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground">Available destinations</div>
      <div className="space-y-4">{NAVIGATION_GROUPS.map(group=>{
        const items=destinationsFor(group.destinationIds).filter(destination=>!pinnedIds.includes(destination.id));
        if(!items.length)return null;
        return <section key={group.id}><div className="mb-1 text-xs font-medium text-muted-foreground">{group.label}</div><div className="space-y-1">{items.map(destination=>{const Icon=NAVIGATION_ICONS[destination.icon];return <div key={destination.id} className="flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-muted/45">
          <Icon className="size-4 shrink-0 text-muted-foreground"/><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{destination.label}</div><div className="truncate text-xs text-muted-foreground">{destination.hint}</div></div>
          <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-9" aria-label={`Pin ${destination.label}`} disabled={pinnedIds.length>=MAX_DESKTOP_PINNED_DESTINATIONS} onClick={()=>onChange(togglePinnedDestination(pinnedIds,destination.id))}><Plus/></Button>
        </div>})}</div></section>;
      })}</div>
    </div>
    <SheetFooter className="border-t border-border"><div className="flex items-center justify-between gap-3"><div className="min-w-0 text-xs text-muted-foreground">{role?`Defaults for ${role}`:'Safe default navigation'} · stored on this device</div><Button type="button" variant="outline" size="sm" onClick={onReset}><RotateCcw/>Reset</Button></div></SheetFooter>
  </SheetContent></Sheet>;
}

function projectSearchValue(project:ProjectOption){return `${project.jobNumber} ${project.name} ${project.status||''} ${project.location}`.trim()}
function recentProjects(projects:ProjectOption[],ids:string[]){return ids.map(id=>projects.find(project=>project.id===id)||null).filter((project):project is ProjectOption=>Boolean(project))}

function CarezProjectPicker({open,onOpenChange,projects,recentProjectIds,activeProjectId,onSelect}:{open:boolean;onOpenChange:(open:boolean)=>void;projects:ProjectOption[];recentProjectIds:string[];activeProjectId:string;onSelect:(projectId:string)=>void}){
  const recent=recentProjects(projects,recentProjectIds);
  const recentSet=new Set(recent.map(project=>project.id));
  const remaining=projects.filter(project=>!recentSet.has(project.id));
  const renderProject=(project:ProjectOption)=><CommandItem key={project.id} value={projectSearchValue(project)} data-checked={project.id===activeProjectId} onSelect={()=>onSelect(project.id)}>
    <BriefcaseBusiness/><div className="min-w-0"><div className="truncate text-sm font-medium">{project.jobNumber?`${project.jobNumber} · `:''}{project.name}</div><div className="truncate text-xs text-muted-foreground">{[project.status,project.location].filter(Boolean).join(' · ')||'Project overview'}</div></div>
  </CommandItem>;
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" className="w-[92vw] gap-0 p-0 sm:max-w-md">
    <SheetHeader className="border-b border-border"><SheetTitle>Switch project</SheetTitle><SheetDescription>Search projects available under the current company and RLS policy.</SheetDescription></SheetHeader>
    <Command className="min-h-0 flex-1 rounded-none"><CommandInput placeholder="Search project name or job number..." autoFocus/><CommandList className="max-h-none flex-1"><CommandEmpty>No accessible project found.</CommandEmpty>
      {recent.length?<CommandGroup heading="Recent">{recent.map(renderProject)}</CommandGroup>:null}
      <CommandGroup heading="All projects">{remaining.map(renderProject)}</CommandGroup>
    </CommandList></Command>
  </SheetContent></Sheet>;
}

function CarezProjectContextBar({project,context,onOpenProjectSwitcher}:{project:ProjectOption;context:ProjectRouteContext;onOpenProjectSwitcher:()=>void}){
  return <div className="flex h-9 items-center gap-2 border-b border-border bg-muted/20 px-2.5 md:px-3">
    <span className="hidden text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground sm:inline">Project</span>
    <CarezProjectSwitcher label={project.name} detail={project.jobNumber||project.location||'Project'} onClick={onOpenProjectSwitcher}/>
    <span className="ml-auto shrink-0 rounded-md border border-border/70 bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">{context.workspaceLabel}</span>
  </div>;
}

function CarezCommandMenu({open,onOpenChange,onNavigate,recentDestinationIds,projects,recentProjectIds}:{open:boolean;onOpenChange:(open:boolean)=>void;onNavigate:(href:string)=>void;recentDestinationIds:string[];projects:ProjectOption[];recentProjectIds:string[]}){
  const recentDestinations=destinationsFor(recentDestinationIds);
  const recentProjectList=recentProjects(projects,recentProjectIds);
  const recentProjectSet=new Set(recentProjectList.map(project=>project.id));
  const otherProjects=projects.filter(project=>!recentProjectSet.has(project.id));
  const renderDestination=(destination:NavigationDestination)=>{const Icon=NAVIGATION_ICONS[destination.icon];return <CommandItem key={destination.id} value={`${destination.label} ${destination.hint}`} onSelect={()=>onNavigate(destination.href)}><Icon/><div className="min-w-0"><div className="text-sm font-medium">{destination.label}</div><div className="truncate text-xs text-muted-foreground">{destination.hint}</div></div></CommandItem>};
  const renderProject=(project:ProjectOption)=><CommandItem key={project.id} value={`project ${projectSearchValue(project)}`} onSelect={()=>onNavigate(`/projects/${encodeURIComponent(project.id)}`)}><BriefcaseBusiness/><div className="min-w-0"><div className="truncate text-sm font-medium">{project.jobNumber?`${project.jobNumber} · `:''}{project.name}</div><div className="truncate text-xs text-muted-foreground">{project.location||project.status||'Project overview'}</div></div></CommandItem>;
  return <CommandDialog open={open} onOpenChange={onOpenChange} title="Search Carez" description="Open a Carez workspace or project">
    <Command><CommandInput placeholder="Search pages, workspaces, and projects..." autoFocus/><CommandList className="max-h-[min(65vh,32rem)]"><CommandEmpty>No matching Carez destination.</CommandEmpty>
      {recentDestinations.length?<CommandGroup heading="Recent workspaces">{recentDestinations.map(renderDestination)}</CommandGroup>:null}
      {recentProjectList.length?<CommandGroup heading="Recent projects">{recentProjectList.map(renderProject)}</CommandGroup>:null}
      {NAVIGATION_GROUPS.map(group=><CommandGroup heading={group.label} key={group.id}>{destinationsFor(group.destinationIds).map(renderDestination)}</CommandGroup>)}
      {otherProjects.length?<CommandGroup heading="Projects">{otherProjects.map(renderProject)}</CommandGroup>:null}
    </CommandList></Command>
  </CommandDialog>;
}

function CarezMobileMoreSheet({open,onOpenChange,pathname,onNavigate,onManage}:{open:boolean;onOpenChange:(open:boolean)=>void;pathname:string;onNavigate:(href:string)=>void;onManage:()=>void}){
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="left" className="w-[88vw] max-w-sm gap-0 p-0">
    <SheetHeader className="border-b border-border"><SheetTitle>More</SheetTitle><SheetDescription>All Carez destinations by business domain.</SheetDescription></SheetHeader>
    <div className="min-h-0 flex-1 overflow-y-auto p-2">{NAVIGATION_GROUPS.map(group=><section key={group.id} className="mb-3"><div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{group.label}</div><div className="space-y-0.5">{destinationsFor(group.destinationIds).map(destination=>{const Icon=NAVIGATION_ICONS[destination.icon];const active=matchesDestinationPath(pathname,destination.href);return <Link key={destination.id} href={destination.href} prefetch={false} aria-current={active?'page':undefined} onClick={event=>{event.preventDefault();onNavigate(destination.href)}} className={cn('flex min-h-11 items-center gap-2 rounded-md px-2.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30',active&&'bg-muted text-foreground')}><Icon className="size-4 text-muted-foreground"/><span>{destination.label}</span></Link>})}</div></section>)}</div>
    <SheetFooter className="border-t border-border"><Button type="button" variant="outline" className="h-11 justify-start" onClick={()=>{onOpenChange(false);onManage()}}><SlidersHorizontal/>Manage navigation</Button></SheetFooter>
  </SheetContent></Sheet>;
}

function CarezMobileBottomNav({destinations,pathname,onOpenMore}:{destinations:NavigationDestination[];pathname:string;onOpenMore:()=>void}){
  return <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-border bg-background/98 px-1 backdrop-blur-xl md:hidden">
    {destinations.slice(0,3).map(destination=>{const Icon=NAVIGATION_ICONS[destination.icon];const active=matchesDestinationPath(pathname,destination.href);return <Link key={destination.id} href={destination.href} prefetch={false} aria-current={active?'page':undefined} className={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40',active&&'text-foreground')}><Icon className="size-4"/><span className="max-w-full truncate">{destination.label}</span></Link>})}
    <Button type="button" variant="ghost" className="h-auto min-w-0 flex-1 flex-col gap-0.5 rounded-md px-1 text-[10px] font-normal text-muted-foreground" onClick={onOpenMore}><Ellipsis className="size-4"/><span>More</span></Button>
  </nav>;
}

export function AppShell({children,userName,immersive=false}:{children:React.ReactNode;userName:string;immersive?:boolean}){
  const pathname=usePathname();
  const router=useRouter();
  const supabase=useMemo(()=>createClient(),[]);
  const [commandOpen,setCommandOpen]=useState(false);
  const [mobileOpen,setMobileOpen]=useState(false);
  const [managerOpen,setManagerOpen]=useState(false);
  const [projectSwitcherOpen,setProjectSwitcherOpen]=useState(false);
  const [logoUrl,setLogoUrl]=useState(FALLBACK_COMPANY_LOGO);
  const [shellIdentity,setShellIdentity]=useState<ShellIdentity|null>(null);
  const [projects,setProjects]=useState<ProjectOption[]>([]);
  const [pinnedIds,setPinnedIds]=useState<string[]>(()=>getRoleDefaultDestinationIds(null));
  const [recentDestinationIds,setRecentDestinationIds]=useState<string[]>([]);
  const [recentProjectIds,setRecentProjectIds]=useState<string[]>([]);

  const workstation=isWorkstation(pathname);
  const activeDestination=useMemo(()=>resolveActiveDestination(pathname),[pathname]);
  const pinnedDestinations=useMemo(()=>destinationsFor(pinnedIds),[pinnedIds]);
  const projectContext=useMemo(()=>resolveProjectRoute(pathname),[pathname]);
  const activeProject=useMemo(()=>projectContext?projects.find(project=>project.id===projectContext.projectId)||null:null,[projectContext,projects]);

  useEffect(()=>{
    let cancelled=false;
    async function loadShellContext(){
      const {data:{user}}=await supabase.auth.getUser();
      if(!user||cancelled)return;
      const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();
      if(!profile?.company_id||cancelled)return;
      const companyId=String(profile.company_id);
      const role=typeof profile.role==='string'?profile.role:null;
      setShellIdentity({userId:user.id,companyId,role});
      const [brandingResponse,projectsResponse]=await Promise.all([
        supabase.from('company_branding').select('logo_path').eq('company_id',companyId).maybeSingle(),
        supabase.from('projects').select('id,job_number,name,status,address,city,state,created_at').eq('company_id',companyId).order('created_at',{ascending:false}),
      ]);
      if(cancelled)return;
      setLogoUrl(companyLogoPublicUrl(supabase,brandingResponse.data?.logo_path||null));
      const rows=(projectsResponse.data||[]) as ProjectRow[];
      setProjects(rows.map(row=>({
        id:String(row.id),jobNumber:row.job_number||'',name:row.name||'Untitled project',status:row.status||null,
        location:[row.address,row.city,row.state].filter(Boolean).join(', '),
      })));
    }
    void loadShellContext();
    const onBranding=(event:Event)=>{
      const logoPath=(event as CustomEvent<{logoPath?:string|null}>).detail?.logoPath||null;
      setLogoUrl(companyLogoPublicUrl(supabase,logoPath));
    };
    window.addEventListener(COMPANY_BRANDING_CHANGED_EVENT,onBranding);
    return()=>{cancelled=true;window.removeEventListener(COMPANY_BRANDING_CHANGED_EVENT,onBranding)};
  },[supabase]);

  useEffect(()=>{
    if(!shellIdentity)return;
    const preference=normalizeNavigationPreference(readDeviceJson(navigationPreferenceStorageKey(shellIdentity.userId,shellIdentity.companyId)),shellIdentity.role);
    setPinnedIds(preference.pinnedIds);
    setRecentDestinationIds(normalizeRecentDestinationIds(readDeviceJson(recentDestinationsStorageKey(shellIdentity.userId,shellIdentity.companyId))));
    setRecentProjectIds(normalizeRecentProjectIds(readDeviceJson(recentProjectsStorageKey(shellIdentity.userId,shellIdentity.companyId))));
  },[shellIdentity]);

  useEffect(()=>{
    if(!shellIdentity)return;
    const active=resolveActiveDestination(pathname);
    if(active){
      const key=recentDestinationsStorageKey(shellIdentity.userId,shellIdentity.companyId);
      const next=prependRecentId(normalizeRecentDestinationIds(readDeviceJson(key)),active.id,MAX_RECENT_DESTINATIONS);
      setRecentDestinationIds(next);writeDeviceJson(key,next);
    }
    const context=resolveProjectRoute(pathname);
    if(context){
      const key=recentProjectsStorageKey(shellIdentity.userId,shellIdentity.companyId);
      const next=prependRecentId(normalizeRecentProjectIds(readDeviceJson(key)),context.projectId,MAX_RECENT_PROJECTS);
      setRecentProjectIds(next);writeDeviceJson(key,next);
    }
  },[pathname,shellIdentity]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setCommandOpen(open=>!open)}};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);
  useEffect(()=>{setMobileOpen(false);setProjectSwitcherOpen(false)},[pathname]);

  const navigate=(href:string)=>{setCommandOpen(false);setMobileOpen(false);setProjectSwitcherOpen(false);router.push(href)};
  const updatePinnedIds=(nextIds:string[])=>{
    const preference=normalizeNavigationPreference({version:NAVIGATION_PREFERENCE_VERSION,pinnedIds:nextIds},shellIdentity?.role||null);
    setPinnedIds(preference.pinnedIds);
    if(shellIdentity)writeDeviceJson(navigationPreferenceStorageKey(shellIdentity.userId,shellIdentity.companyId),preference);
  };
  const resetPinnedIds=()=>{
    const preference=resetNavigationPreference(shellIdentity?.role||null);
    setPinnedIds(preference.pinnedIds);
    if(shellIdentity)writeDeviceJson(navigationPreferenceStorageKey(shellIdentity.userId,shellIdentity.companyId),preference);
  };
  const switchProject=(projectId:string)=>{setProjectSwitcherOpen(false);router.push(buildProjectSwitchHref(pathname,projectId))};

  if(immersive)return <div className="min-h-svh bg-background text-foreground">{children}</div>;

  return <div className="flex min-h-svh flex-col bg-background text-foreground">
    <BankSyncPulse/><OutlookSyncPulse/>
    <div className="relative z-40 shrink-0 bg-background">
      <CarezTopShell userName={userName} logoUrl={logoUrl} pathname={pathname} pinnedIds={pinnedIds} pinnedDestinations={pinnedDestinations} onNavigate={navigate} onOpenCommand={()=>setCommandOpen(true)} onOpenManager={()=>setManagerOpen(true)}/>
      {projectContext&&activeProject?<CarezProjectContextBar project={activeProject} context={projectContext} onOpenProjectSwitcher={()=>setProjectSwitcherOpen(true)}/>:null}
    </div>
    <main aria-label={activeDestination?.label||'Carez workspace'} className={workstation?'min-h-0 min-w-0 flex-1 overflow-hidden pb-14 md:pb-0':'min-h-0 min-w-0 flex-1 overflow-auto bg-background p-4 pb-20 md:p-5'}>{children}</main>
    <CarezCommandMenu open={commandOpen} onOpenChange={setCommandOpen} onNavigate={navigate} recentDestinationIds={recentDestinationIds} projects={projects} recentProjectIds={recentProjectIds}/>
    <CarezMobileMoreSheet open={mobileOpen} onOpenChange={setMobileOpen} pathname={pathname} onNavigate={navigate} onManage={()=>setManagerOpen(true)}/>
    <CarezNavigationManager open={managerOpen} onOpenChange={setManagerOpen} pinnedIds={pinnedIds} role={shellIdentity?.role||null} onChange={updatePinnedIds} onReset={resetPinnedIds}/>
    {projectContext&&activeProject?<CarezProjectPicker open={projectSwitcherOpen} onOpenChange={setProjectSwitcherOpen} projects={projects} recentProjectIds={recentProjectIds} activeProjectId={activeProject.id} onSelect={switchProject}/>:null}
    <CarezMobileBottomNav destinations={pinnedDestinations} pathname={pathname} onOpenMore={()=>setMobileOpen(true)}/>
  </div>;
}
