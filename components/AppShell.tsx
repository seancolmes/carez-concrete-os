'use client';

import Link from 'next/link';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {usePathname} from 'next/navigation';
import {
  BarChart3,Briefcase,Calculator,CreditCard,FileText,Gauge,HardHat,Home,Inbox,KeyRound,
  Landmark,LibraryBig,ListChecks,Menu,PackageCheck,Receipt,ReceiptText,Ruler,Search,Settings,
  ShieldCheck,ShoppingCart,SlidersHorizontal,TrendingUp,Users,Wallet,Wrench,CalendarDays,
  ClipboardCheck,ClipboardList,Banknote,Hammer,HelpCircle,Bell,ChevronRight,X
} from 'lucide-react';
import {BankSyncPulse} from '@/components/PlaidBankControls';
import {OutlookSyncPulse} from '@/components/OutlookSyncPulse';
import {MobileNavSheet} from '@/components/MobileNavSheet';

type NavItem={href:string;label:string;Icon:any;hint?:string};
type NavGroup={label:string;items:NavItem[]};
type RailKey='dashboard'|'projects'|'takeoff'|'estimate'|'assemblies'|'field'|'money'|'reports'|'settings';
type RailItem=NavItem&{key:RailKey};

const railItems:RailItem[]=[
  {key:'dashboard',href:'/',label:'Dashboard',Icon:Home,hint:'Carez operating overview'},
  {key:'projects',href:'/projects',label:'Projects',Icon:Briefcase,hint:'Projects and job control'},
  {key:'takeoff',href:'/takeoff',label:'Takeoff',Icon:Ruler,hint:'Plans and concrete takeoff'},
  {key:'estimate',href:'/estimates',label:'Estimate',Icon:Calculator,hint:'Estimate worksheet and pricing'},
  {key:'assemblies',href:'/takeoff/assemblies',label:'Assemblies',Icon:LibraryBig,hint:'Concrete assembly library'},
  {key:'field',href:'/field',label:'Field',Icon:HardHat,hint:'Field operations'},
  {key:'money',href:'/cashflow',label:'Money',Icon:Wallet,hint:'Commercial and cash control'},
  {key:'reports',href:'/reports',label:'Reports',Icon:BarChart3,hint:'Owner and project reporting'},
  {key:'settings',href:'/settings',label:'Settings',Icon:Settings,hint:'Carez OS configuration'},
];

const toolGroups:NavGroup[]=[
  {label:'Estimate',items:[
    {href:'/leads',label:'Leads',Icon:Users},{href:'/leads/inbox',label:'Lead Inbox',Icon:Inbox},
    {href:'/bid-intelligence',label:'Bid Intelligence',Icon:TrendingUp},{href:'/takeoff',label:'Takeoff',Icon:Ruler},
    {href:'/estimates',label:'Estimate',Icon:Calculator},{href:'/estimates/audit',label:'Estimate Audit',Icon:ShieldCheck},
    {href:'/proposals',label:'Proposal',Icon:FileText},{href:'/takeoff/assemblies',label:'Assembly Library',Icon:LibraryBig},
    {href:'/takeoff/intelligence',label:'Production Intelligence',Icon:Gauge},
  ]},
  {label:'Jobs',items:[
    {href:'/projects',label:'Projects',Icon:Briefcase},{href:'/job-setup',label:'Job Setup',Icon:ClipboardCheck},
    {href:'/schedule',label:'Schedule',Icon:CalendarDays},{href:'/look-ahead',label:'21-Day Look-Ahead',Icon:CalendarDays},
    {href:'/readiness',label:'Work Readiness',Icon:ListChecks},{href:'/readiness/resources',label:'Materials & Resources',Icon:ShieldCheck},
    {href:'/pour-control',label:'Pour Control',Icon:ShieldCheck},{href:'/production/work-packages',label:'Work Packages',Icon:PackageCheck},
    {href:'/scope-drift',label:'Scope Drift',Icon:ClipboardList},{href:'/change-orders',label:'Change Orders',Icon:ClipboardList},
    {href:'/forecast',label:'Forecast',Icon:TrendingUp},{href:'/procurement',label:'Procurement',Icon:ShoppingCart},
    {href:'/equipment',label:'Equipment & Inventory',Icon:Wrench},
  ]},
  {label:'Field',items:[
    {href:'/field',label:'Field Control',Icon:Hammer},{href:'/production',label:'Production',Icon:Gauge},
    {href:'/documents',label:'Documents',Icon:FileText},{href:'/crew',label:'Crew',Icon:HardHat},
    {href:'/crew/access',label:'Employee Access',Icon:KeyRound},
  ]},
  {label:'Money',items:[
    {href:'/billing',label:'Billing',Icon:ReceiptText},{href:'/cashflow',label:'Cashflow',Icon:Wallet},
    {href:'/payables',label:'Accounts Payable',Icon:CreditCard},{href:'/banking',label:'Banking',Icon:Landmark},
    {href:'/banking/reconcile',label:'Reconcile',Icon:ListChecks},{href:'/banking/rules',label:'Bank Rules',Icon:SlidersHorizontal},
    {href:'/payroll',label:'Payroll',Icon:Banknote},{href:'/costs',label:'Job Costs',Icon:Receipt},{href:'/overhead',label:'Overhead',Icon:Gauge},
  ]},
  {label:'System',items:[{href:'/settings',label:'Settings',Icon:Settings},{href:'/reports',label:'Reports',Icon:BarChart3}]},
];

const drawerSections:Record<RailKey,NavGroup[]>={
  dashboard:[{label:'Overview',items:[
    {href:'/',label:'Today',Icon:Home,hint:'Daily operating command center'},
    {href:'/reports',label:'Owner Reports',Icon:BarChart3,hint:'Company and job reporting'},
  ]}],
  projects:[
    {label:'Plan The Work',items:[
      {href:'/projects',label:'Projects',Icon:Briefcase,hint:'Active jobs and project control'},
      {href:'/job-setup',label:'Job Setup',Icon:ClipboardCheck,hint:'Turn accepted work into an executable job'},
      {href:'/schedule',label:'Schedule',Icon:CalendarDays,hint:'Who is working where and what happens next'},
      {href:'/look-ahead',label:'21-Day Look-Ahead',Icon:CalendarDays,hint:'Upcoming operations and blockers'},
    ]},
    {label:'Ready To Build',items:[
      {href:'/readiness',label:'Work Readiness',Icon:ListChecks,hint:'Physical prerequisites before labor starts'},
      {href:'/readiness/resources',label:'Materials & Resources',Icon:ShieldCheck,hint:'Materials, equipment and vendors needed before start'},
      {href:'/pour-control',label:'Pour Control',Icon:ShieldCheck,hint:'Concrete placement readiness and authorization'},
      {href:'/production/work-packages',label:'Work Packages',Icon:PackageCheck,hint:'Physical scopes connected to takeoff quantities'},
    ]},
    {label:'Control The Job',items:[
      {href:'/scope-drift',label:'Scope Drift',Icon:ClipboardList,hint:'Catch changed or unplanned work'},
      {href:'/change-orders',label:'Change Orders',Icon:ClipboardList,hint:'Price and control extra work'},
      {href:'/forecast',label:'Forecast',Icon:TrendingUp,hint:'Where each job is headed'},
      {href:'/procurement',label:'Procurement',Icon:ShoppingCart,hint:'Quotes, purchase orders and vendor control'},
      {href:'/equipment',label:'Equipment & Inventory',Icon:Wrench,hint:'Tools, forms and equipment'},
    ]},
  ],
  takeoff:[
    {label:'Measure',items:[
      {href:'/takeoff',label:'Takeoff',Icon:Ruler,hint:'Plans, measurements and assemblies'},
      {href:'/takeoff/assemblies',label:'Assembly Library',Icon:LibraryBig,hint:'Concrete recipes and resource build-ups'},
      {href:'/takeoff/intelligence',label:'Production Intelligence',Icon:Gauge,hint:'Production evidence and estimating baselines'},
    ]},
    {label:'Continue The Bid',items:[
      {href:'/estimates',label:'Estimate',Icon:Calculator,hint:'Price measured scope'},
      {href:'/proposals',label:'Proposal',Icon:FileText,hint:'Issue customer pricing'},
    ]},
  ],
  estimate:[
    {label:'Pipeline',items:[
      {href:'/leads',label:'Leads',Icon:Users,hint:'Possible jobs and customer follow-up'},
      {href:'/leads/inbox',label:'Lead Inbox',Icon:Inbox,hint:'Incoming opportunities'},
      {href:'/bid-intelligence',label:'Bid Intelligence',Icon:TrendingUp,hint:'Pursuit and pricing intelligence'},
    ]},
    {label:'Price & Issue',items:[
      {href:'/estimates',label:'Estimate',Icon:Calculator,hint:'Estimate worksheet and pricing'},
      {href:'/estimates/audit',label:'Estimate Audit',Icon:ShieldCheck,hint:'Scope, pricing and risk review'},
      {href:'/proposals',label:'Proposal',Icon:FileText,hint:'Customer proposal workflow'},
    ]},
  ],
  assemblies:[{label:'Assembly System',items:[
    {href:'/takeoff/assemblies',label:'Assembly Library',Icon:LibraryBig,hint:'Concrete assembly recipes and resources'},
    {href:'/takeoff/intelligence',label:'Production Intelligence',Icon:Gauge,hint:'Actual production evidence'},
    {href:'/takeoff',label:'Open Takeoff',Icon:Ruler,hint:'Use assemblies on the drawings'},
  ]}],
  field:[
    {label:'Field Operations',items:[
      {href:'/field',label:'Field Control',Icon:Hammer,hint:'Time review, daily activity and field control'},
      {href:'/production',label:'Production',Icon:Gauge,hint:'Earned quantities and actual production rates'},
      {href:'/documents',label:'Documents',Icon:FileText,hint:'Tickets, receipts, plans and job photos'},
    ]},
    {label:'People',items:[
      {href:'/crew',label:'Crew',Icon:HardHat,hint:'Workers, rates and labor setup'},
      {href:'/crew/access',label:'Employee Access',Icon:KeyRound,hint:'Employee clock logins and access'},
    ]},
  ],
  money:[
    {label:'Get Paid',items:[
      {href:'/billing',label:'Billing',Icon:ReceiptText,hint:'Invoices and customer balances'},
      {href:'/cashflow',label:'Cashflow',Icon:Wallet,hint:'Cash position and upcoming obligations'},
    ]},
    {label:'Pay & Reconcile',items:[
      {href:'/payables',label:'Accounts Payable',Icon:CreditCard,hint:'Bills owed to vendors'},
      {href:'/banking',label:'Banking',Icon:Landmark,hint:'Connected accounts and activity'},
      {href:'/banking/reconcile',label:'Reconcile',Icon:ListChecks,hint:'Match charges, deposits and documents'},
      {href:'/banking/rules',label:'Bank Rules',Icon:SlidersHorizontal,hint:'Banking automation rules'},
      {href:'/payroll',label:'Payroll',Icon:Banknote,hint:'Crew payroll and labor cash needs'},
    ]},
    {label:'Know The Cost',items:[
      {href:'/costs',label:'Job Costs',Icon:Receipt,hint:'Actual cost by job'},
      {href:'/overhead',label:'Overhead',Icon:Gauge,hint:'Cost to keep Carez running'},
    ]},
  ],
  reports:[{label:'Reporting',items:[
    {href:'/reports',label:'Reports',Icon:BarChart3,hint:'Owner and project reporting'},
    {href:'/forecast',label:'Forecast',Icon:TrendingUp,hint:'Job forecast and exposure'},
    {href:'/estimates/audit',label:'Estimate Audit',Icon:ShieldCheck,hint:'Preconstruction review'},
    {href:'/takeoff/intelligence',label:'Production Intelligence',Icon:Gauge,hint:'Estimating versus actual production'},
  ]}],
  settings:[{label:'Carez OS',items:[
    {href:'/settings',label:'Settings',Icon:Settings,hint:'Company setup and system controls'},
  ]}],
};

const allItems=[...railItems,...toolGroups.flatMap(group=>group.items)];

function matchesPath(pathname:string,href:string){
  if(href==='/')return pathname==='/';
  return pathname===href||pathname.startsWith(`${href}/`);
}

function railKeyForPath(pathname:string):RailKey{
  if(pathname==='/')return 'dashboard';
  if(pathname.startsWith('/takeoff/assemblies')||pathname.startsWith('/takeoff/intelligence'))return 'assemblies';
  if(pathname.startsWith('/takeoff'))return 'takeoff';
  if(pathname.startsWith('/estimates')||pathname.startsWith('/leads')||pathname.startsWith('/bid-intelligence')||pathname.startsWith('/proposals'))return 'estimate';
  if(pathname.startsWith('/field')||pathname.startsWith('/documents')||pathname.startsWith('/crew')||(pathname.startsWith('/production')&&!pathname.startsWith('/production/work-packages')))return 'field';
  if(pathname.startsWith('/billing')||pathname.startsWith('/cashflow')||pathname.startsWith('/payables')||pathname.startsWith('/banking')||pathname.startsWith('/payroll')||pathname.startsWith('/costs')||pathname.startsWith('/overhead'))return 'money';
  if(pathname.startsWith('/reports'))return 'reports';
  if(pathname.startsWith('/settings'))return 'settings';
  if(pathname.startsWith('/projects')||pathname.startsWith('/job-setup')||pathname.startsWith('/schedule')||pathname.startsWith('/look-ahead')||pathname.startsWith('/readiness')||pathname.startsWith('/pour-control')||pathname.startsWith('/production/work-packages')||pathname.startsWith('/scope-drift')||pathname.startsWith('/change-orders')||pathname.startsWith('/forecast')||pathname.startsWith('/procurement')||pathname.startsWith('/equipment')||pathname.startsWith('/closeout'))return 'projects';
  return 'dashboard';
}

export function AppShell({children,userName,immersive=false}:{children:React.ReactNode;userName:string;immersive?:boolean}){
  const pathname=usePathname();
  const [menuOpen,setMenuOpen]=useState(false);
  const [contextKey,setContextKey]=useState<RailKey|null>(null);
  const currentItem=useMemo(()=>[...allItems].sort((a,b)=>b.href.length-a.href.length).find(item=>matchesPath(pathname,item.href))||railItems[0],[pathname]);
  const currentRailKey=useMemo(()=>railKeyForPath(pathname),[pathname]);
  const active=(href:string)=>currentItem?.href===href;
  const workstation=pathname.startsWith('/takeoff/')||pathname.startsWith('/estimates/');
  const estimatingContext=pathname.startsWith('/takeoff')||pathname.startsWith('/estimates')||pathname.startsWith('/proposals');
  const contextRail=contextKey?railItems.find(item=>item.key===contextKey):null;

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();setContextKey(null);setMenuOpen(true);return;
      }
      if(event.key==='Escape'){setContextKey(null);setMenuOpen(false);}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);

  const toggleContext=(key:RailKey)=>setContextKey(current=>current===key?null:key);

  if(immersive)return <div className="b2-immersive">{children}</div>;

  return <div className={`shell b2-shell ${contextKey?'b2-context-open':''}`}>
    <BankSyncPulse/><OutlookSyncPulse/>
    <aside className="b2-rail" aria-label="Carez Concrete OS navigation">
      <Link href="/" className="b2-rail-brand" aria-label="Carez Concrete OS home">
        <Image src="/brand/carez-wordmark.png" alt="Carez Concrete" width={112} height={61} priority sizes="112px"/>
      </Link>
      <nav className="b2-rail-nav">
        {railItems.map(({key,href,label,Icon})=><Link key={key} href={href} prefetch={false} className={(contextKey||currentRailKey)===key?'active':''} aria-current={currentRailKey===key?'page':undefined} aria-expanded={contextKey===key} title={`${label} tools`} onClick={(event)=>{event.preventDefault();toggleContext(key);}}>
          <Icon aria-hidden="true"/><span>{label}</span>
        </Link>)}
      </nav>
      <button type="button" className="b2-rail-more" onClick={()=>{setContextKey(null);setMenuOpen(true);}} title="All Carez tools"><Menu/><span>More</span></button>
    </aside>

    {contextKey&&contextRail&&<aside className="b2-context-drawer" aria-label={`${contextRail.label} tools`}>
      <div className="b2-context-head">
        <div><span>WORKSPACE</span><strong><contextRail.Icon/>{contextRail.label}</strong></div>
        <button type="button" onClick={()=>setContextKey(null)} aria-label={`Close ${contextRail.label} tools`}><X/></button>
      </div>
      <nav className="b2-context-nav">
        {drawerSections[contextKey].map(section=><section key={section.label}>
          <div className="b2-context-section-label">{section.label}</div>
          {section.items.map(({href,label,Icon,hint})=><Link key={`${contextKey}-${href}`} href={href} prefetch={false} className={active(href)?'active':''} onClick={()=>setContextKey(null)} title={hint||label}>
            <Icon aria-hidden="true"/><span><strong>{label}</strong>{hint&&<small>{hint}</small>}</span><ChevronRight className="b2-context-chevron"/>
          </Link>)}
        </section>)}
      </nav>
      <div className="b2-context-footer">
        <button type="button" onClick={()=>{setContextKey(null);setMenuOpen(true);}}><Search/>Find any Carez tool</button>
      </div>
    </aside>}

    <main className="main b2-main">
      <header className={`b2-topbar ${workstation?'b2-topbar-workstation':''}`}>
        {estimatingContext?<Link href="/" className="b2-topbar-logo" aria-label="Carez Concrete OS home">
          <Image src="/brand/carez-wordmark.png" alt="Carez Concrete" width={150} height={82} priority sizes="150px"/>
        </Link>:<div className="b2-topbar-identity">
          <span className="b2-topbar-kicker">CAREZ CONCRETE OS</span>
          <strong>{currentItem?.label||'Dashboard'}</strong>
        </div>}
        {estimatingContext&&<nav className="b2-project-nav" aria-label="Estimating workflow">
          <Link href="/takeoff" className={pathname.startsWith('/takeoff')?'active':''}>Takeoff</Link>
          <Link href="/estimates" className={pathname.startsWith('/estimates')?'active':''}>Estimate</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/proposals">Proposal</Link>
        </nav>}
        <div className="b2-topbar-actions">
          <button type="button" className="b2-icon-action" title="Notifications" aria-label="Notifications"><Bell/></button>
          <button type="button" className="b2-icon-action" title="Help" aria-label="Help"><HelpCircle/></button>
          <button type="button" className="b2-search" onClick={()=>{setContextKey(null);setMenuOpen(true);}} aria-keyshortcuts="Control+K Meta+K"><Search/><span>Find tool</span><kbd>Ctrl K</kbd></button>
          <div className="b2-user" title={userName}>{userName}</div>
        </div>
      </header>
      <div className={`b2-content ${workstation?'b2-content-workstation':''}`}>{children}</div>
    </main>

    <nav className="mobile-nav b2-mobile-nav">
      {railItems.slice(0,4).map(({href,label,Icon})=><Link key={href} href={href} prefetch={false} className={matchesPath(pathname,href)?'active':''}><Icon/><span>{label}</span></Link>)}
      <button type="button" onClick={()=>setMenuOpen(true)} className={menuOpen?'active':''}><Menu/><span>More</span></button>
    </nav>
    <MobileNavSheet open={menuOpen} onClose={()=>setMenuOpen(false)} groups={toolGroups} active={active}/>
  </div>;
}