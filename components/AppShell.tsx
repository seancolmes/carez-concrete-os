'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {
  Banknote,BarChart3,Bell,BriefcaseBusiness,Calculator,CalendarDays,ChevronDown,ClipboardCheck,
  ClipboardList,CreditCard,FileText,Gauge,Hammer,HardHat,Home,Inbox,KeyRound,Landmark,
  LibraryBig,ListChecks,Menu,PackageCheck,Receipt,ReceiptText,Ruler,Search,Settings,
  ShieldCheck,ShoppingCart,SlidersHorizontal,TrendingUp,Users,Wallet,Wrench,
} from 'lucide-react';
import {BankSyncPulse} from '@/components/PlaidBankControls';
import {OutlookSyncPulse} from '@/components/OutlookSyncPulse';
import {Button,buttonVariants} from '@/components/ui/button';
import {Command,CommandDialog,CommandEmpty,CommandGroup,CommandInput,CommandItem,CommandList} from '@/components/ui/command';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Tooltip,TooltipContent,TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {carezMotion} from '@/components/carez/motion';

type NavItem={href:string;label:string;Icon:any;hint?:string};
type NavGroup={label:string;items:NavItem[]};

const navGroups:NavGroup[]=[
  {label:'Today',items:[
    {href:'/',label:'Today',Icon:Home,hint:'Daily operating command center'},
    {href:'/reports',label:'Owner reports',Icon:BarChart3,hint:'Company and job reporting'},
  ]},
  {label:'Preconstruction',items:[
    {href:'/leads',label:'Leads',Icon:Users,hint:'Opportunities and customer follow-up'},
    {href:'/leads/inbox',label:'Lead inbox',Icon:Inbox,hint:'Incoming bid opportunities'},
    {href:'/bid-intelligence',label:'Bid intelligence',Icon:TrendingUp,hint:'Pursuit and pricing intelligence'},
  ]},
  {label:'Estimating',items:[
    {href:'/takeoff',label:'Takeoff',Icon:Ruler,hint:'Plans, conditions and quantities'},
    {href:'/estimates',label:'Estimates',Icon:Calculator,hint:'Scope, pricing and review'},
    {href:'/estimates/audit',label:'Estimate audit',Icon:ShieldCheck,hint:'Scope, pricing and risk review'},
    {href:'/proposals',label:'Proposals',Icon:FileText,hint:'Customer proposal workflow'},
    {href:'/takeoff/assemblies',label:'Assemblies',Icon:LibraryBig,hint:'Concrete scope recipes and resources'},
    {href:'/takeoff/intelligence',label:'Production intelligence',Icon:Gauge,hint:'Actual production evidence'},
  ]},
  {label:'Projects',items:[
    {href:'/projects',label:'Projects',Icon:BriefcaseBusiness,hint:'Active jobs and project control'},
    {href:'/job-setup',label:'Job setup',Icon:ClipboardCheck,hint:'Turn accepted work into an executable job'},
    {href:'/schedule',label:'Schedule',Icon:CalendarDays,hint:'Who is working where and what happens next'},
    {href:'/look-ahead',label:'21-day look-ahead',Icon:CalendarDays,hint:'Upcoming operations and blockers'},
    {href:'/readiness',label:'Work readiness',Icon:ListChecks,hint:'Prerequisites before labor starts'},
    {href:'/readiness/resources',label:'Materials & resources',Icon:ShieldCheck,hint:'Materials, equipment and vendors needed before start'},
    {href:'/production/work-packages',label:'Work packages',Icon:PackageCheck,hint:'Physical scopes connected to quantities'},
    {href:'/scope-drift',label:'Scope drift',Icon:ClipboardList,hint:'Changed or unplanned work'},
    {href:'/change-orders',label:'Change orders',Icon:ClipboardList,hint:'Price and control extra work'},
    {href:'/forecast',label:'Forecast',Icon:TrendingUp,hint:'Where each job is headed'},
  ]},
  {label:'Field',items:[
    {href:'/field',label:'Field control',Icon:Hammer,hint:'Time review and field control'},
    {href:'/production',label:'Production',Icon:Gauge,hint:'Earned quantities and actual production rates'},
    {href:'/pour-control',label:'Pour control',Icon:ShieldCheck,hint:'Concrete placement readiness'},
    {href:'/crew',label:'Crew',Icon:HardHat,hint:'Workers, rates and labor setup'},
    {href:'/crew/access',label:'Employee access',Icon:KeyRound,hint:'Employee clock logins and access'},
    {href:'/equipment',label:'Equipment & inventory',Icon:Wrench,hint:'Tools, forms and equipment'},
  ]},
  {label:'Finance',items:[
    {href:'/billing',label:'Billing',Icon:ReceiptText,hint:'Invoices and customer balances'},
    {href:'/cashflow',label:'Cashflow',Icon:Wallet,hint:'Cash position and upcoming obligations'},
    {href:'/payables',label:'Accounts payable',Icon:CreditCard,hint:'Bills owed to vendors'},
    {href:'/banking',label:'Banking',Icon:Landmark,hint:'Connected accounts and activity'},
    {href:'/banking/reconcile',label:'Reconcile',Icon:ListChecks,hint:'Match charges, deposits and documents'},
    {href:'/banking/rules',label:'Bank rules',Icon:SlidersHorizontal,hint:'Banking automation rules'},
    {href:'/payroll',label:'Payroll',Icon:Banknote,hint:'Crew payroll and labor cash needs'},
    {href:'/costs',label:'Job costs',Icon:Receipt,hint:'Actual cost by job'},
    {href:'/overhead',label:'Overhead',Icon:Gauge,hint:'Cost to keep Carez running'},
    {href:'/procurement',label:'Procurement',Icon:ShoppingCart,hint:'Quotes, purchase orders and vendor control'},
  ]},
  {label:'Documents',items:[
    {href:'/documents',label:'Documents',Icon:FileText,hint:'Tickets, receipts, plans and job photos'},
  ]},
];

const allItems=[...navGroups.flatMap(group=>group.items.map(item=>({...item,group:group.label}))),{href:'/settings',label:'Settings',Icon:Settings,hint:'Company setup and system controls',group:'System'}];

function matchesPath(pathname:string,href:string){
  if(href==='/')return pathname==='/';
  return pathname===href||pathname.startsWith(`${href}/`);
}

function isWorkstation(pathname:string){
  const segment=pathname.match(/^\/takeoff\/([^/]+)/)?.[1];
  const takeoffWorkspace=Boolean(segment&&!['assemblies','intelligence','plans'].includes(segment));
  return takeoffWorkspace||/^\/estimates\/[^/]+/.test(pathname);
}

export function CarezProjectSwitcher({label='Carez workspace',detail='Company'}:{label?:string;detail?:string}){
  return <Button type="button" variant="ghost" size="sm" className="hidden h-8 max-w-64 justify-start gap-2 px-2 text-left md:inline-flex">
    <BriefcaseBusiness className="size-3.5 text-muted-foreground"/>
    <span className="min-w-0"><span className="block truncate text-xs font-medium">{label}</span><span className="block truncate text-[10px] leading-3 text-muted-foreground">{detail}</span></span>
    <ChevronDown className="ml-1 size-3 text-muted-foreground"/>
  </Button>;
}

export function CarezTopShell({userName,onOpenCommand,onOpenMobile}:{userName:string;onOpenCommand:()=>void;onOpenMobile:()=>void}){
  const initial=userName.trim().charAt(0).toUpperCase()||'C';
  return <div className="flex h-12 items-center gap-2 border-b border-border bg-background px-3">
    <Button type="button" variant="ghost" size="icon-sm" className="md:hidden" onClick={onOpenMobile} aria-label="Open navigation"><Menu/></Button>
    <Link href="/" prefetch={false} className="flex shrink-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
      <Image src="/brand/carez-wordmark.png" alt="Carez Concrete" width={128} height={48} priority className="h-5 w-auto object-contain object-left"/>
      <span className="hidden text-[10px] font-medium tracking-wide text-muted-foreground xl:inline">Concrete OS</span>
    </Link>
    <span className="mx-1 hidden h-5 w-px bg-border md:block"/>
    <CarezProjectSwitcher/>
    <div className="ml-auto flex items-center gap-1.5">
      <Button type="button" variant="outline" size="sm" onClick={onOpenCommand} className="hidden min-w-48 justify-start gap-2 border-border/80 bg-muted/20 text-muted-foreground lg:inline-flex"><Search className="size-3.5"/><span>Search Carez</span><kbd className="ml-auto rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd></Button>
      <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" onClick={onOpenCommand}/> } className="lg:hidden"><Search/></TooltipTrigger><TooltipContent>Search Carez</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm"/>}><Bell/></TooltipTrigger><TooltipContent>Notifications</TooltipContent></Tooltip>
      <Link href="/settings" prefetch={false} className={cn(buttonVariants({variant:'ghost',size:'sm'}),'h-8 gap-2 px-1.5')}>
        <span className="flex size-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold">{initial}</span>
        <span className="hidden max-w-32 truncate text-xs xl:inline">{userName}</span>
      </Link>
    </div>
  </div>;
}

export function CarezNavPanel({group,open,panelRef}:{group:NavGroup;open:boolean;panelRef:React.RefObject<HTMLDivElement|null>}){
  const columns=group.items.length>7?'grid-cols-3':group.items.length>3?'grid-cols-2':'grid-cols-1';
  return <div ref={panelRef} id="carez-global-nav-panel" aria-hidden={!open} className={cn('absolute inset-x-0 top-full z-50 origin-top border-b border-border bg-popover shadow-2xl shadow-black/35',carezMotion.overlay,open?'pointer-events-auto translate-y-0 scale-100 opacity-100':'pointer-events-none -translate-y-1 scale-[.995] opacity-0')}>
    <div className="mx-auto max-w-[1480px] px-4 py-4">
      <div className="mb-2 text-[11px] font-semibold text-muted-foreground">{group.label}</div>
      <div className={cn('grid gap-1',columns)}>{group.items.map(({href,label,Icon,hint})=><Link key={href} href={href} prefetch={false} className="group flex min-h-12 items-start gap-3 rounded-md px-3 py-2.5 outline-none transition-colors duration-150 hover:bg-muted/55 focus-visible:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring/30 motion-reduce:transition-none">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground"/>
        <span className="min-w-0"><span className="block text-sm font-medium text-foreground">{label}</span>{hint?<span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{hint}</span>:null}</span>
      </Link>)}</div>
    </div>
  </div>;
}

export function CarezCategoryNav({pathname}:{pathname:string}){
  const activeGroup=navGroups.find(group=>group.items.some(item=>matchesPath(pathname,item.href)))?.label||null;
  const [openLabel,setOpenLabel]=useState<string|null>(null);
  const [lastLabel,setLastLabel]=useState<string>(activeGroup||navGroups[0].label);
  const rootRef=useRef<HTMLDivElement|null>(null);
  const panelRef=useRef<HTMLDivElement|null>(null);
  const buttonRefs=useRef<Array<HTMLButtonElement|null>>([]);
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const openGroup=(label:string,focusPanel=false)=>{
    if(closeTimer.current)clearTimeout(closeTimer.current);
    setLastLabel(label);setOpenLabel(label);
    if(focusPanel)setTimeout(()=>panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus(),0);
  };
  const scheduleClose=()=>{if(closeTimer.current)clearTimeout(closeTimer.current);closeTimer.current=setTimeout(()=>setOpenLabel(null),170)};
  const close=()=>{if(closeTimer.current)clearTimeout(closeTimer.current);setOpenLabel(null)};

  useEffect(()=>close(),[pathname]);
  useEffect(()=>{
    if(!openLabel)return;
    const outside=(event:PointerEvent)=>{if(rootRef.current&&!rootRef.current.contains(event.target as Node))close()};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){close();const index=navGroups.findIndex(group=>group.label===openLabel);buttonRefs.current[index]?.focus()}};
    document.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape)};
  },[openLabel]);
  useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current)},[]);

  const panelGroup=navGroups.find(group=>group.label===(openLabel||lastLabel))||navGroups[0];

  return <div ref={rootRef} className="relative hidden md:block" onPointerEnter={()=>{if(closeTimer.current)clearTimeout(closeTimer.current)}} onPointerLeave={scheduleClose}>
    <nav aria-label="Global Carez navigation" className="flex h-9 items-stretch gap-0.5 bg-background px-3">
      {navGroups.map((group,index)=>{const open=openLabel===group.label,active=activeGroup===group.label;return <button key={group.label} ref={node=>{buttonRefs.current[index]=node}} type="button" aria-expanded={open} aria-controls="carez-global-nav-panel" onClick={()=>open?close():openGroup(group.label)} onKeyDown={event=>{
        if(event.key==='ArrowDown'){event.preventDefault();openGroup(group.label,true)}
        if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const delta=event.key==='ArrowRight'?1:-1;const next=(index+delta+navGroups.length)%navGroups.length;buttonRefs.current[next]?.focus();if(openLabel)openGroup(navGroups[next].label)}
      }} className={cn('relative flex h-full items-center gap-1 rounded-none px-3 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:bg-muted/50 focus-visible:text-foreground',carezMotion.micro,(active||open)&&'text-foreground')}>
        {group.label}<ChevronDown className={cn('size-3 transition-transform duration-[180ms] motion-reduce:transition-none',open&&'rotate-180')}/>
        <span aria-hidden="true" className={cn('absolute inset-x-2 bottom-0 h-0.5 origin-center bg-foreground transition-transform duration-[180ms] motion-reduce:transition-none',(active||open)?'scale-x-100':'scale-x-0')}/>
      </button>})}
    </nav>
    <CarezNavPanel group={panelGroup} open={Boolean(openLabel)} panelRef={panelRef}/>
  </div>;
}

export function CarezCommandMenu({open,onOpenChange,onNavigate}:{open:boolean;onOpenChange:(open:boolean)=>void;onNavigate:(href:string)=>void}){
  return <CommandDialog open={open} onOpenChange={onOpenChange} title="Search Carez" description="Open a Carez workspace">
    <Command><CommandInput placeholder="Search pages and workspaces..." autoFocus/><CommandList><CommandEmpty>No matching Carez page.</CommandEmpty>
      {navGroups.map(group=><CommandGroup heading={group.label} key={group.label}>{group.items.map(({href,label,Icon,hint})=><CommandItem key={href} value={`${label} ${hint||''}`} onSelect={()=>onNavigate(href)}><Icon/><div className="min-w-0"><div className="text-sm font-medium">{label}</div>{hint?<div className="truncate text-xs text-muted-foreground">{hint}</div>:null}</div></CommandItem>)}</CommandGroup>)}
      <CommandGroup heading="System"><CommandItem value="Settings company system controls" onSelect={()=>onNavigate('/settings')}><Settings/><div><div className="text-sm font-medium">Settings</div><div className="text-xs text-muted-foreground">Company setup and system controls</div></div></CommandItem></CommandGroup>
    </CommandList></Command>
  </CommandDialog>;
}

function CarezMobileNavigation({open,onOpenChange,pathname}:{open:boolean;onOpenChange:(open:boolean)=>void;pathname:string}){
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="left" className="w-[88vw] max-w-sm gap-0 p-0">
    <SheetHeader className="border-b border-border"><SheetTitle>Carez Concrete OS</SheetTitle><SheetDescription>Open a workspace</SheetDescription></SheetHeader>
    <div className="min-h-0 flex-1 overflow-y-auto p-2">{navGroups.map(group=><section key={group.label} className="mb-3"><div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{group.label}</div><div className="space-y-0.5">{group.items.map(({href,label,Icon})=><Link key={href} href={href} prefetch={false} className={cn('flex h-9 items-center gap-2 rounded-md px-2.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30',matchesPath(pathname,href)&&'bg-muted text-foreground')}><Icon className="size-4 text-muted-foreground"/><span>{label}</span></Link>)}</div></section>)}</div>
    <div className="border-t border-border p-2"><Link href="/settings" prefetch={false} className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm hover:bg-muted"><Settings className="size-4 text-muted-foreground"/>Settings</Link></div>
  </SheetContent></Sheet>;
}

export function AppShell({children,userName,immersive=false}:{children:React.ReactNode;userName:string;immersive?:boolean}){
  const pathname=usePathname();
  const router=useRouter();
  const [commandOpen,setCommandOpen]=useState(false);
  const [mobileOpen,setMobileOpen]=useState(false);
  const workstation=isWorkstation(pathname);
  const current=useMemo(()=>[...allItems].sort((a,b)=>b.href.length-a.href.length).find(item=>matchesPath(pathname,item.href))||allItems[0],[pathname]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setCommandOpen(open=>!open)}};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);
  useEffect(()=>setMobileOpen(false),[pathname]);

  const navigate=(href:string)=>{setCommandOpen(false);setMobileOpen(false);router.push(href)};

  if(immersive)return <div className="min-h-svh bg-background text-foreground">{children}</div>;

  return <div className="flex min-h-svh flex-col bg-background text-foreground">
    <BankSyncPulse/><OutlookSyncPulse/>
    <div className="relative z-40 shrink-0 bg-background">
      <CarezTopShell userName={userName} onOpenCommand={()=>setCommandOpen(true)} onOpenMobile={()=>setMobileOpen(true)}/>
      <CarezCategoryNav pathname={pathname}/>
    </div>
    <main aria-label={current.label} className={workstation?'min-h-0 min-w-0 flex-1 overflow-hidden':'min-h-0 min-w-0 flex-1 overflow-auto bg-background p-4 md:p-5'}>{children}</main>
    <CarezCommandMenu open={commandOpen} onOpenChange={setCommandOpen} onNavigate={navigate}/>
    <CarezMobileNavigation open={mobileOpen} onOpenChange={setMobileOpen} pathname={pathname}/>
  </div>;
}
