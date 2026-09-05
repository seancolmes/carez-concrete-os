'use client';

import Link from 'next/link';
import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
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
import {
  DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Tooltip,TooltipContent,TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {createClient} from '@/lib/supabase/client';
import {COMPANY_BRANDING_CHANGED_EVENT,FALLBACK_COMPANY_LOGO,companyLogoPublicUrl} from '@/lib/companyBranding';

type NavItem={href:string;label:string;Icon:any;hint?:string;separatorBefore?:boolean};
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
    {href:'/proposals',label:'Proposals',Icon:FileText,hint:'Customer proposal workflow'},
    {href:'/estimates/audit',label:'Estimate audit',Icon:ShieldCheck,hint:'Scope, pricing and risk review',separatorBefore:true},
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

export function CarezCategoryNav({pathname,onNavigate}:{pathname:string;onNavigate:(href:string)=>void}){
  const activeGroup=navGroups.find(group=>group.items.some(item=>matchesPath(pathname,item.href)))?.label||null;
  const [openLabel,setOpenLabel]=useState<string|null>(null);
  const buttonRefs=useRef<Array<HTMLButtonElement|null>>([]);

  useEffect(()=>setOpenLabel(null),[pathname]);

  const focusAdjacent=(index:number,delta:number)=>{
    const next=(index+delta+navGroups.length)%navGroups.length;
    buttonRefs.current[next]?.focus();
    if(openLabel)setOpenLabel(navGroups[next].label);
  };

  return <nav aria-label="Global Carez navigation" className="hidden min-w-0 flex-1 items-stretch lg:flex">
    {navGroups.map((group,index)=>{
      const open=openLabel===group.label;
      const active=activeGroup===group.label;
      const twoColumns=group.items.length>7;
      return <DropdownMenu key={group.label} open={open} onOpenChange={next=>setOpenLabel(next?group.label:null)}>
        <DropdownMenuTrigger
          ref={node=>{buttonRefs.current[index]=node}}
          onPointerEnter={()=>{if(openLabel&&openLabel!==group.label)setOpenLabel(group.label)}}
          onKeyDown={event=>{
            if(event.key==='ArrowRight'){event.preventDefault();focusAdjacent(index,1)}
            if(event.key==='ArrowLeft'){event.preventDefault();focusAdjacent(index,-1)}
          }}
          className={cn(
            'relative flex h-11 shrink-0 items-center gap-1 px-2.5 text-xs font-medium text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:bg-muted/45 focus-visible:text-foreground motion-reduce:transition-none xl:px-3',
            (active||open)&&'text-foreground',
          )}
        >
          {group.label}
          {group.items.length>1?<ChevronDown className={cn('size-3 opacity-60 transition-transform duration-150 motion-reduce:transition-none',open&&'rotate-180')}/>:null}
          <span aria-hidden="true" className={cn('absolute inset-x-2 bottom-0 h-px origin-center bg-foreground transition-transform duration-150 motion-reduce:transition-none',(active||open)?'scale-x-100':'scale-x-0')}/>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={1}
          className={cn(
            'w-auto min-w-56 rounded-md border border-border/80 bg-popover/95 p-1.5 shadow-xl shadow-black/35 backdrop-blur-xl duration-150 data-[side=bottom]:slide-in-from-top-1',
            twoColumns&&'grid min-w-[420px] grid-cols-2 gap-0.5',
          )}
        >
          {group.items.map(({href,label,Icon,separatorBefore})=><Fragment key={href}>
            {separatorBefore&&!twoColumns?<DropdownMenuSeparator/>:null}
            <DropdownMenuItem
              onClick={()=>{setOpenLabel(null);onNavigate(href)}}
              className={cn(
                'h-8 cursor-pointer gap-2 px-2.5 text-[13px]',
                matchesPath(pathname,href)&&'bg-accent/55 text-accent-foreground',
              )}
            >
              <Icon className="size-3.5 text-muted-foreground"/>
              <span className="truncate">{label}</span>
            </DropdownMenuItem>
          </Fragment>)}
        </DropdownMenuContent>
      </DropdownMenu>;
    })}
  </nav>;
}

export function CarezTopShell({userName,logoUrl,pathname,onNavigate,onOpenCommand,onOpenMobile}:{userName:string;logoUrl:string;pathname:string;onNavigate:(href:string)=>void;onOpenCommand:()=>void;onOpenMobile:()=>void}){
  const initial=userName.trim().charAt(0).toUpperCase()||'C';
  return <header className="flex h-11 items-center border-b border-border bg-background/96 px-2.5 backdrop-blur-xl md:px-3">
    <Button type="button" variant="ghost" size="icon-sm" className="mr-1 lg:hidden" onClick={onOpenMobile} aria-label="Open navigation"><Menu/></Button>
    <Link href="/" prefetch={false} className="flex h-11 shrink-0 items-center rounded-sm pr-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
      <img src={logoUrl} alt="Company logo" className="h-5 max-w-32 object-contain object-left"/>
    </Link>
    <span className="hidden h-5 w-px shrink-0 bg-border lg:block"/>
    <CarezCategoryNav pathname={pathname} onNavigate={onNavigate}/>
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <Button type="button" variant="outline" size="sm" onClick={onOpenCommand} className="hidden h-8 min-w-44 justify-start gap-2 border-border/80 bg-muted/15 px-2.5 text-muted-foreground xl:inline-flex"><Search className="size-3.5"/><span>Search Carez</span><kbd className="ml-auto rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd></Button>
      <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" onClick={onOpenCommand}/> } className="xl:hidden"><Search/></TooltipTrigger><TooltipContent>Search Carez</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm"/>}><Bell/></TooltipTrigger><TooltipContent>Notifications</TooltipContent></Tooltip>
      <Link href="/settings" prefetch={false} className={cn(buttonVariants({variant:'ghost',size:'sm'}),'h-8 gap-2 px-1.5')}>
        <span className="flex size-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold">{initial}</span>
        <span className="hidden max-w-28 truncate text-xs 2xl:inline">{userName}</span>
      </Link>
    </div>
  </header>;
}

export function CarezCommandMenu({open,onOpenChange,onNavigate}:{open:boolean;onOpenChange:(open:boolean)=>void;onNavigate:(href:string)=>void}){
  return <CommandDialog open={open} onOpenChange={onOpenChange} title="Search Carez" description="Open a Carez workspace">
    <Command><CommandInput placeholder="Search pages and workspaces..." autoFocus/><CommandList><CommandEmpty>No matching Carez page.</CommandEmpty>
      {navGroups.map(group=><CommandGroup heading={group.label} key={group.label}>{group.items.map(({href,label,Icon,hint})=><CommandItem key={href} value={`${label} ${hint||''}`} onSelect={()=>onNavigate(href)}><Icon/><div className="min-w-0"><div className="text-sm font-medium">{label}</div>{hint?<div className="truncate text-xs text-muted-foreground">{hint}</div>:null}</div></CommandItem>)}</CommandGroup>)}
      <CommandGroup heading="System"><CommandItem value="Settings company system controls" onSelect={()=>onNavigate('/settings')}><Settings/><div><div className="text-sm font-medium">Settings</div><div className="text-xs text-muted-foreground">Company setup and system controls</div></div></CommandItem></CommandGroup>
    </CommandList></Command>
  </CommandDialog>;
}

function CarezMobileNavigation({open,onOpenChange,pathname,logoUrl}:{open:boolean;onOpenChange:(open:boolean)=>void;pathname:string;logoUrl:string}){
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="left" className="w-[88vw] max-w-sm gap-0 p-0">
    <SheetHeader className="border-b border-border"><SheetTitle><img src={logoUrl} alt="Company logo" className="h-6 max-w-48 object-contain object-left"/></SheetTitle><SheetDescription>Open a workspace</SheetDescription></SheetHeader>
    <div className="min-h-0 flex-1 overflow-y-auto p-2">{navGroups.map(group=><section key={group.label} className="mb-3"><div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{group.label}</div><div className="space-y-0.5">{group.items.map(({href,label,Icon})=><Link key={href} href={href} prefetch={false} className={cn('flex h-9 items-center gap-2 rounded-md px-2.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30',matchesPath(pathname,href)&&'bg-muted text-foreground')}><Icon className="size-4 text-muted-foreground"/><span>{label}</span></Link>)}</div></section>)}</div>
    <div className="border-t border-border p-2"><Link href="/settings" prefetch={false} className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm hover:bg-muted"><Settings className="size-4 text-muted-foreground"/>Settings</Link></div>
  </SheetContent></Sheet>;
}

export function AppShell({children,userName,immersive=false}:{children:React.ReactNode;userName:string;immersive?:boolean}){
  const pathname=usePathname();
  const router=useRouter();
  const supabase=useMemo(()=>createClient(),[]);
  const [commandOpen,setCommandOpen]=useState(false);
  const [mobileOpen,setMobileOpen]=useState(false);
  const [logoUrl,setLogoUrl]=useState(FALLBACK_COMPANY_LOGO);
  const workstation=isWorkstation(pathname);
  const current=useMemo(()=>[...allItems].sort((a,b)=>b.href.length-a.href.length).find(item=>matchesPath(pathname,item.href))||allItems[0],[pathname]);

  useEffect(()=>{
    let cancelled=false;
    async function loadBranding(){
      const {data:{user}}=await supabase.auth.getUser();
      if(!user||cancelled)return;
      const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).maybeSingle();
      if(!profile?.company_id||cancelled)return;
      const {data:branding}=await supabase.from('company_branding').select('logo_path').eq('company_id',profile.company_id).maybeSingle();
      if(!cancelled)setLogoUrl(companyLogoPublicUrl(supabase,branding?.logo_path||null));
    }
    void loadBranding();
    const onBranding=(event:Event)=>{
      const logoPath=(event as CustomEvent<{logoPath?:string|null}>).detail?.logoPath||null;
      setLogoUrl(companyLogoPublicUrl(supabase,logoPath));
    };
    window.addEventListener(COMPANY_BRANDING_CHANGED_EVENT,onBranding);
    return()=>{cancelled=true;window.removeEventListener(COMPANY_BRANDING_CHANGED_EVENT,onBranding)};
  },[supabase]);

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
      <CarezTopShell userName={userName} logoUrl={logoUrl} pathname={pathname} onNavigate={navigate} onOpenCommand={()=>setCommandOpen(true)} onOpenMobile={()=>setMobileOpen(true)}/>
    </div>
    <main aria-label={current.label} className={workstation?'min-h-0 min-w-0 flex-1 overflow-hidden':'min-h-0 min-w-0 flex-1 overflow-auto bg-background p-4 md:p-5'}>{children}</main>
    <CarezCommandMenu open={commandOpen} onOpenChange={setCommandOpen} onNavigate={navigate}/>
    <CarezMobileNavigation open={mobileOpen} onOpenChange={setMobileOpen} pathname={pathname} logoUrl={logoUrl}/>
  </div>;
}
