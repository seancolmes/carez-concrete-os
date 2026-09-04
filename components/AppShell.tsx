'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {
  BarChart3,Bell,BriefcaseBusiness,Calculator,CalendarDays,ClipboardCheck,ClipboardList,
  CreditCard,FileText,Gauge,HardHat,Home,Inbox,KeyRound,Landmark,LibraryBig,ListChecks,
  PackageCheck,Receipt,ReceiptText,Ruler,Search,Settings,ShieldCheck,ShoppingCart,
  SlidersHorizontal,TrendingUp,Users,Wallet,Wrench,Hammer,Banknote,ChevronRight,
} from 'lucide-react';
import {BankSyncPulse} from '@/components/PlaidBankControls';
import {OutlookSyncPulse} from '@/components/OutlookSyncPulse';
import {Button} from '@/components/ui/button';
import {
  Breadcrumb,BreadcrumbItem,BreadcrumbList,BreadcrumbPage,BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Command,CommandDialog,CommandEmpty,CommandGroup,CommandInput,CommandItem,CommandList,
} from '@/components/ui/command';
import {Separator} from '@/components/ui/separator';
import {
  Sidebar,SidebarContent,SidebarFooter,SidebarGroup,SidebarGroupContent,SidebarGroupLabel,
  SidebarHeader,SidebarInset,SidebarMenu,SidebarMenuButton,SidebarMenuItem,SidebarProvider,
  SidebarRail,SidebarTrigger,
} from '@/components/ui/sidebar';
import {Tooltip,TooltipContent,TooltipTrigger} from '@/components/ui/tooltip';

type NavItem={href:string;label:string;Icon:any;hint?:string};
type NavGroup={label:string;items:NavItem[]};

const navGroups:NavGroup[]=[
  {label:'Overview',items:[
    {href:'/',label:'Today',Icon:Home,hint:'Daily operating command center'},
    {href:'/reports',label:'Owner reports',Icon:BarChart3,hint:'Company and job reporting'},
  ]},
  {label:'Preconstruction',items:[
    {href:'/leads',label:'Leads',Icon:Users,hint:'Opportunities and customer follow-up'},
    {href:'/leads/inbox',label:'Lead inbox',Icon:Inbox,hint:'Incoming bid opportunities'},
    {href:'/bid-intelligence',label:'Bid intelligence',Icon:TrendingUp,hint:'Pursuit and pricing intelligence'},
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
    {href:'/pour-control',label:'Pour control',Icon:ShieldCheck,hint:'Concrete placement readiness'},
    {href:'/production/work-packages',label:'Work packages',Icon:PackageCheck,hint:'Physical scopes connected to quantities'},
    {href:'/scope-drift',label:'Scope drift',Icon:ClipboardList,hint:'Changed or unplanned work'},
    {href:'/change-orders',label:'Change orders',Icon:ClipboardList,hint:'Price and control extra work'},
    {href:'/forecast',label:'Forecast',Icon:TrendingUp,hint:'Where each job is headed'},
    {href:'/procurement',label:'Procurement',Icon:ShoppingCart,hint:'Quotes, purchase orders and vendor control'},
    {href:'/equipment',label:'Equipment & inventory',Icon:Wrench,hint:'Tools, forms and equipment'},
  ]},
  {label:'Field',items:[
    {href:'/field',label:'Field control',Icon:Hammer,hint:'Time review and field control'},
    {href:'/production',label:'Production',Icon:Gauge,hint:'Earned quantities and actual production rates'},
    {href:'/documents',label:'Documents',Icon:FileText,hint:'Tickets, receipts, plans and job photos'},
    {href:'/crew',label:'Crew',Icon:HardHat,hint:'Workers, rates and labor setup'},
    {href:'/crew/access',label:'Employee access',Icon:KeyRound,hint:'Employee clock logins and access'},
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
  ]},
  {label:'System',items:[
    {href:'/settings',label:'Settings',Icon:Settings,hint:'Company setup and system controls'},
  ]},
];

const allItems=navGroups.flatMap(group=>group.items.map(item=>({...item,group:group.label})));

function matchesPath(pathname:string,href:string){
  if(href==='/')return pathname==='/';
  return pathname===href||pathname.startsWith(`${href}/`);
}

function isWorkstation(pathname:string){
  const segment=pathname.match(/^\/takeoff\/([^/]+)/)?.[1];
  const takeoffWorkspace=Boolean(segment&&!['assemblies','intelligence','plans'].includes(segment));
  return takeoffWorkspace||/^\/estimates\/[^/]+/.test(pathname);
}

export function AppShell({children,userName,immersive=false}:{children:React.ReactNode;userName:string;immersive?:boolean}){
  const pathname=usePathname();
  const router=useRouter();
  const [commandOpen,setCommandOpen]=useState(false);
  const current=useMemo(()=>[...allItems].sort((a,b)=>b.href.length-a.href.length).find(item=>matchesPath(pathname,item.href))||allItems[0],[pathname]);
  const workstation=isWorkstation(pathname);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();
        setCommandOpen(open=>!open);
      }
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);

  const navigate=(href:string)=>{
    setCommandOpen(false);
    router.push(href);
  };

  if(immersive)return <div className="min-h-svh bg-background text-foreground">{children}</div>;

  return <SidebarProvider defaultOpen style={{'--sidebar-width':'15.5rem','--sidebar-width-icon':'3.5rem'} as React.CSSProperties}>
    <BankSyncPulse/><OutlookSyncPulse/>
    <Sidebar collapsible="icon" variant="sidebar" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Carez Concrete OS" render={<Link href="/" prefetch={false}/> } className="h-12 data-active:bg-sidebar-accent">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-black tracking-tight text-sidebar-primary-foreground">C</span>
              <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <Image src="/brand/carez-wordmark.png" alt="Carez Concrete" width={128} height={48} priority className="h-6 w-auto object-contain object-left"/>
                <span className="mt-0.5 block truncate text-[10px] font-medium text-sidebar-foreground/55">Concrete OS</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map(group=><SidebarGroup key={group.label} className="py-1.5">
          <SidebarGroupLabel className="h-7 text-[10px] uppercase tracking-[.08em]">{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map(({href,label,Icon,hint})=><SidebarMenuItem key={href}>
                <SidebarMenuButton
                  render={<Link href={href} prefetch={false}/>}
                  isActive={matchesPath(pathname,href)}
                  tooltip={hint||label}
                  className="h-8"
                >
                  <Icon/>
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/settings" prefetch={false}/>} tooltip="Account and settings" size="lg">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">{userName.trim().charAt(0).toUpperCase()||'C'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{userName}</span>
                <span className="block truncate text-[10px] text-sidebar-foreground/55">Carez workspace</span>
              </span>
              <ChevronRight className="ml-auto size-3.5 text-sidebar-foreground/45"/>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail/>
    </Sidebar>

    <SidebarInset className="min-w-0 overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <SidebarTrigger className="-ml-1"/>
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4"/>
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="hidden sm:flex">
              <span className="text-xs text-muted-foreground">{current.group}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block"/>
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate text-sm font-medium">{current.label}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={()=>setCommandOpen(true)} className="hidden min-w-48 justify-start gap-2 text-muted-foreground md:inline-flex">
            <Search className="size-3.5"/><span>Search Carez</span><kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
          </Button>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={()=>setCommandOpen(true)}/> } className="md:hidden"><Search/></TooltipTrigger>
            <TooltipContent>Search Carez</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm"/>}><Bell/></TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>
        </div>
      </header>
      <div className={workstation?'min-h-0 flex-1 overflow-hidden':'min-w-0 flex-1 overflow-auto bg-muted/20 p-4 md:p-6'}>
        {children}
      </div>
    </SidebarInset>

    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} title="Search Carez" description="Open a Carez workspace">
      <Command>
        <CommandInput placeholder="Search pages and workspaces..." autoFocus/>
        <CommandList>
          <CommandEmpty>No matching Carez page.</CommandEmpty>
          {navGroups.map(group=><CommandGroup heading={group.label} key={group.label}>
            {group.items.map(({href,label,Icon,hint})=><CommandItem key={href} value={`${label} ${hint||''}`} onSelect={()=>navigate(href)}>
              <Icon/><div className="min-w-0"><div className="text-sm font-medium">{label}</div>{hint?<div className="truncate text-xs text-muted-foreground">{hint}</div>:null}</div>
            </CommandItem>)}
          </CommandGroup>)}
        </CommandList>
      </Command>
    </CommandDialog>
  </SidebarProvider>;
}
