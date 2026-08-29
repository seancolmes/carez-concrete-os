'use client';

import Link from 'next/link';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {
  Home,Users,Inbox,Calculator,Briefcase,ClipboardCheck,ClipboardList,ReceiptText,TrendingUp,
  ShieldCheck,ShoppingCart,CreditCard,Wallet,Landmark,ListChecks,SlidersHorizontal,Banknote,Hammer,
  Receipt,HardHat,Gauge,Settings,Menu,KeyRound,CalendarDays,FileText,Wrench,PackageCheck,BarChart3,
  Truck,Ruler,Search,ChevronRight,Boxes,LibraryBig,PanelLeftOpen,X
} from 'lucide-react';
import {BankSyncPulse} from '@/components/PlaidBankControls';
import {OutlookSyncPulse} from '@/components/OutlookSyncPulse';
import {MobileNavSheet} from '@/components/MobileNavSheet';

type NavItem={href:string;label:string;Icon:any;hint?:string};
type NavSection={label:string;items:NavItem[]};
type Workspace={key:string;label:string;Icon:any;home:string;sections:NavSection[]};

const workspaces:Workspace[]=[
  {
    key:'home',label:'Home',Icon:Home,home:'/',sections:[
      {label:'Overview',items:[
        {href:'/',label:'Today',Icon:Home,hint:'What needs your attention today'},
        {href:'/reports',label:'Owner Reports',Icon:BarChart3,hint:'Job profit, company performance and operating trends'},
      ]},
    ],
  },
  {
    key:'estimate',label:'Estimate',Icon:Calculator,home:'/takeoff',sections:[
      {label:'Pipeline',items:[
        {href:'/leads',label:'Leads',Icon:Users,hint:'Possible jobs, customers and follow-ups'},
        {href:'/leads/inbox',label:'Lead Inbox',Icon:Inbox,hint:'Incoming opportunities waiting for review'},
        {href:'/bid-intelligence',label:'Bid Intelligence',Icon:TrendingUp,hint:'Pursuit score, win rate and pricing guardrails'},
      ]},
      {label:'Build The Bid',items:[
        {href:'/takeoff',label:'Takeoff',Icon:Ruler,hint:'Measure concrete scope and drive assemblies directly from plans'},
        {href:'/estimates',label:'Estimate',Icon:Calculator,hint:'Price labor, materials, equipment, overhead and margin'},
        {href:'/estimates/audit',label:'Estimate Audit',Icon:ShieldCheck,hint:'Catch scope, pricing and risk problems before issue'},
        {href:'/proposals',label:'Proposal',Icon:FileText,hint:'Present pricing and capture customer acceptance'},
      ]},
      {label:'Estimating System',items:[
        {href:'/takeoff/assemblies',label:'Assembly Library',Icon:LibraryBig,hint:'Concrete recipes, estimating inputs and labor-cost setup'},
        {href:'/takeoff/intelligence',label:'Production Intelligence',Icon:Gauge,hint:'Compare estimating baselines with clean Carez production evidence'},
      ]},
    ],
  },
  {
    key:'jobs',label:'Jobs',Icon:Briefcase,home:'/projects',sections:[
      {label:'Plan The Work',items:[
        {href:'/projects',label:'Projects',Icon:Briefcase,hint:'Active jobs and job health'},
        {href:'/job-setup',label:'Job Setup',Icon:ClipboardCheck,hint:'Turn accepted work into a job ready for execution'},
        {href:'/schedule',label:'Schedule',Icon:CalendarDays,hint:'Who is working where and what happens next'},
        {href:'/look-ahead',label:'21-Day Look-Ahead',Icon:CalendarDays,hint:'Upcoming work, blockers and ready alternatives'},
      ]},
      {label:'Ready To Build',items:[
        {href:'/readiness',label:'Work Readiness',Icon:ListChecks,hint:'Physical prerequisites and inspections before labor starts'},
        {href:'/readiness/resources',label:'Materials & Resources',Icon:ShieldCheck,hint:'Materials, equipment and vendors needed before start'},
        {href:'/pour-control',label:'Pour Control',Icon:ShieldCheck,hint:'Financial and operational authorization for concrete placement'},
        {href:'/pour-control/deliveries',label:'Concrete Deliveries',Icon:Truck,hint:'Planned, ordered and delivered CY with ticket evidence'},
      ]},
      {label:'Control The Job',items:[
        {href:'/production/work-packages',label:'Work Packages',Icon:PackageCheck,hint:'Physical scopes created from takeoff quantities'},
        {href:'/production/work-packages/financials',label:'Package Financials',Icon:BarChart3,hint:'Actual labor and procurement by physical scope'},
        {href:'/scope-drift',label:'Scope Drift',Icon:ClipboardList,hint:'Catch changed or unplanned work before it disappears'},
        {href:'/change-orders',label:'Change Orders',Icon:ClipboardList,hint:'Price and control extra work'},
        {href:'/forecast',label:'Forecast',Icon:TrendingUp,hint:'Where each job is headed'},
        {href:'/closeout',label:'Closeout',Icon:PackageCheck,hint:'Finish documentation and close the job cleanly'},
      ]},
      {label:'Supply The Job',items:[
        {href:'/procurement',label:'Procurement',Icon:ShoppingCart,hint:'Quotes, purchase orders, deliveries and vendor bills'},
        {href:'/equipment',label:'Equipment & Inventory',Icon:Wrench,hint:'Tools, form inventory, equipment and service'},
      ]},
    ],
  },
  {
    key:'field',label:'Field',Icon:HardHat,home:'/field',sections:[
      {label:'Field Operations',items:[
        {href:'/field',label:'Field Control',Icon:Hammer,hint:'Time review, daily logs and field activity'},
        {href:'/production',label:'Production',Icon:Gauge,hint:'Earned quantities, crew time and actual production rates'},
        {href:'/documents',label:'Documents',Icon:FileText,hint:'Receipts, tickets, plans and job photos'},
      ]},
      {label:'People',items:[
        {href:'/crew',label:'Crew',Icon:HardHat,hint:'Workers, rates and labor setup'},
        {href:'/crew/access',label:'Employee Access',Icon:KeyRound,hint:'Employee clock logins and access'},
      ]},
    ],
  },
  {
    key:'money',label:'Money',Icon:Wallet,home:'/cashflow',sections:[
      {label:'Get Paid',items:[
        {href:'/billing',label:'Billing',Icon:ReceiptText,hint:'Invoices and customer balances'},
        {href:'/cashflow',label:'Cashflow',Icon:Wallet,hint:'Cash position and upcoming obligations'},
      ]},
      {label:'Pay & Reconcile',items:[
        {href:'/payables',label:'Accounts Payable',Icon:CreditCard,hint:'Bills owed to vendors'},
        {href:'/banking',label:'Banking',Icon:Landmark,hint:'Connected accounts and activity'},
        {href:'/banking/reconcile',label:'Reconcile',Icon:ListChecks,hint:'Match charges, deposits and supporting documents'},
        {href:'/banking/rules',label:'Bank Rules',Icon:SlidersHorizontal,hint:'Automation rules Carez has learned'},
        {href:'/payroll',label:'Payroll',Icon:Banknote,hint:'Crew payroll and labor cash needs'},
      ]},
      {label:'Know The Cost',items:[
        {href:'/costs',label:'Job Costs',Icon:Receipt,hint:'What each job has actually cost'},
        {href:'/overhead',label:'Overhead',Icon:Gauge,hint:'Cost to keep Carez running'},
      ]},
    ],
  },
  {
    key:'system',label:'System',Icon:Boxes,home:'/settings',sections:[
      {label:'Carez OS',items:[
        {href:'/settings',label:'Settings',Icon:Settings,hint:'Company setup and system controls'},
      ]},
    ],
  },
];

const allItems=workspaces.flatMap(workspace=>workspace.sections.flatMap(section=>section.items.map(item=>({...item,workspaceKey:workspace.key}))));
const allToolGroups=workspaces.flatMap(workspace=>workspace.sections.map(section=>({label:workspace.key==='home'?section.label:`${workspace.label} · ${section.label}`,items:section.items})));

function matchesPath(pathname:string,href:string){
  if(href==='/')return pathname==='/';
  return pathname===href||pathname.startsWith(`${href}/`);
}

export function AppShell({children,userName,immersive=false}:{children:React.ReactNode;userName:string;immersive?:boolean}){
  const pathname=usePathname();
  const [menuOpen,setMenuOpen]=useState(false);
  const [contextOpen,setContextOpen]=useState(false);
  const currentItem=useMemo(()=>{
    return [...allItems].sort((a,b)=>b.href.length-a.href.length).find(item=>matchesPath(pathname,item.href))||allItems.find(item=>item.href==='/');
  },[pathname]);
  const currentWorkspace=workspaces.find(workspace=>workspace.key===currentItem?.workspaceKey)||workspaces[0];
  const active=(href:string)=>currentItem?.href===href;
  const mobileItems:NavItem[]=[
    {href:'/',label:'Home',Icon:Home},
    {href:'/takeoff',label:'Estimate',Icon:Ruler},
    {href:'/projects',label:'Jobs',Icon:Briefcase},
    {href:'/field',label:'Field',Icon:HardHat},
  ];

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();
        setContextOpen(false);
        setMenuOpen(true);
        return;
      }
      if(event.key==='Escape'){
        setContextOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);

  return <div className={`shell app-shell-v3 industrial-shell ${immersive?'shell-immersive':''}`}>
    <BankSyncPulse/><OutlookSyncPulse/>

    {!immersive&&<>
      <aside className="app-rail" aria-label="Carez workspaces">
        <Link href="/" className="app-rail-mark" aria-label="Carez Concrete home"><span>C</span></Link>
        <button
          type="button"
          className={`rail-context-toggle ${contextOpen?'active':''}`}
          title={`Open ${currentWorkspace.label} tools`}
          aria-label={`Open ${currentWorkspace.label} tools`}
          aria-expanded={contextOpen}
          aria-controls="carez-context-drawer"
          onClick={()=>setContextOpen(open=>!open)}
        ><PanelLeftOpen/><span>Tools</span></button>
        <nav className="app-rail-nav">{workspaces.slice(0,5).map(({key,label,Icon,home})=><Link key={key} href={home} prefetch={false} className={currentWorkspace.key===key?'active':''} title={label} aria-current={currentWorkspace.key===key?'page':undefined} onClick={()=>setContextOpen(true)}><Icon aria-hidden="true"/><span>{label}</span></Link>)}</nav>
        <div className="app-rail-bottom"><button type="button" onClick={()=>setMenuOpen(true)} title="All Carez tools"><Menu aria-hidden="true"/><span>More</span></button><Link href="/settings" className={currentWorkspace.key==='system'?'active':''} title="Settings" aria-current={currentWorkspace.key==='system'?'page':undefined}><Settings aria-hidden="true"/><span>Setup</span></Link></div>
      </aside>

      {contextOpen&&<div className="context-open">
        <button type="button" className="context-drawer-backdrop" aria-label="Close workspace tools" onClick={()=>setContextOpen(false)}/>
        <aside id="carez-context-drawer" className="sidebar context-sidebar" aria-label={`${currentWorkspace.label} tools`}>
          <div className="context-brand"><Image src="/brand/carez-wordmark.png" alt="Carez" width={104} height={57} priority sizes="104px"/><span>CONCRETE</span></div>
          <div className="context-heading"><div className="context-heading-row"><div><div className="context-kicker">WORKSPACE</div><div className="context-title"><currentWorkspace.Icon/>{currentWorkspace.label}</div></div><button type="button" className="context-drawer-close" onClick={()=>setContextOpen(false)} aria-label="Close workspace tools"><X size={15}/></button></div></div>
          <nav className="context-nav" aria-label={`${currentWorkspace.label} navigation`}>{currentWorkspace.sections.map(section=><section key={section.label} className="context-section"><div className="context-section-label">{section.label}</div>{section.items.map(({href,label,Icon,hint})=><Link key={href} href={href} prefetch={false} title={hint||label} className={active(href)?'active':''} onClick={()=>setContextOpen(false)}><span className="context-link-icon"><Icon/></span><span className="context-link-copy"><strong>{label}</strong>{active(href)&&hint&&<small>{hint}</small>}</span><ChevronRight className="context-chevron"/></Link>)}</section>)}</nav>
          <div className="context-footer"><button type="button" className="context-all-tools" onClick={()=>{setContextOpen(false);setMenuOpen(true);}}><Search/> Find any Carez tool</button><div className="sidebar-user"><div className="sidebar-user-label">Signed in</div><div className="sidebar-user-name">{userName}</div></div></div>
        </aside>
      </div>}
    </>}

    <main className={`main ${immersive?'main-immersive':''}`}>
      {!immersive&&<div className="topbar app-topbar"><div className="mobile-brand-lockup"><Image src="/brand/carez-wordmark.png" alt="Carez" width={104} height={57} priority sizes="104px" className="mobile-brand-wordmark"/><span>CONCRETE</span></div><div className="topbar-context"><span>{currentWorkspace.label}</span><strong>{currentItem?.label||'Home'}</strong>{currentItem?.hint&&<small>{currentItem.hint}</small>}</div><div className="topbar-actions"><button type="button" className="workspace-context-button" onClick={()=>setContextOpen(true)} aria-label={`Open ${currentWorkspace.label} tools`}><PanelLeftOpen/><span>{currentWorkspace.label} tools</span></button><button type="button" className="topbar-search" onClick={()=>setMenuOpen(true)} aria-keyshortcuts="Control+K Meta+K"><Search/><span>Find tool</span><kbd>Ctrl K</kbd></button><div className="user-chip" title={userName}>{userName}</div></div></div>}
      {children}
    </main>

    {!immersive&&<nav className="mobile-nav app-bottom-nav">{mobileItems.map(({href,label,Icon})=><Link key={href} href={href} prefetch={false} className={matchesPath(pathname,href)&&href!=='/'||pathname==='/'&&href==='/'?'active':''}><Icon className="nav-icon" aria-hidden="true"/><span>{label}</span></Link>)}<button type="button" className={menuOpen?'active':''} onClick={()=>setMenuOpen(true)} aria-label="Open Carez tools"><Menu className="nav-icon"/><span>More</span></button></nav>}

    <MobileNavSheet open={menuOpen} onClose={()=>setMenuOpen(false)} groups={allToolGroups} active={active}/>
  </div>;
}