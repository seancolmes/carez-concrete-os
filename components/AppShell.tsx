'use client';

import Link from 'next/link';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {usePathname} from 'next/navigation';
import {
  BarChart3,Briefcase,Calculator,CreditCard,FileText,Gauge,HardHat,Home,Inbox,KeyRound,
  Landmark,LibraryBig,ListChecks,Menu,PackageCheck,Receipt,ReceiptText,Ruler,Search,Settings,
  ShieldCheck,ShoppingCart,SlidersHorizontal,TrendingUp,Users,Wallet,Wrench,CalendarDays,
  ClipboardCheck,ClipboardList,Banknote,Hammer,Boxes,HelpCircle,Bell
} from 'lucide-react';
import {BankSyncPulse} from '@/components/PlaidBankControls';
import {OutlookSyncPulse} from '@/components/OutlookSyncPulse';
import {MobileNavSheet} from '@/components/MobileNavSheet';

type NavItem={href:string;label:string;Icon:any;hint?:string};
type NavGroup={label:string;items:NavItem[]};

const railItems:NavItem[]=[
  {href:'/',label:'Dashboard',Icon:Home,hint:'Carez operating overview'},
  {href:'/projects',label:'Projects',Icon:Briefcase,hint:'Projects and job control'},
  {href:'/takeoff',label:'Takeoff',Icon:Ruler,hint:'Plans and concrete takeoff'},
  {href:'/estimates',label:'Estimate',Icon:Calculator,hint:'Estimate worksheet and pricing'},
  {href:'/takeoff/assemblies',label:'Assemblies',Icon:LibraryBig,hint:'Concrete assembly library'},
  {href:'/field',label:'Field',Icon:HardHat,hint:'Field operations'},
  {href:'/cashflow',label:'Money',Icon:Wallet,hint:'Commercial and cash control'},
  {href:'/reports',label:'Reports',Icon:BarChart3,hint:'Owner and project reporting'},
  {href:'/settings',label:'Settings',Icon:Settings,hint:'Carez OS configuration'},
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

const allItems=[...railItems,...toolGroups.flatMap(group=>group.items)];

function matchesPath(pathname:string,href:string){
  if(href==='/')return pathname==='/';
  return pathname===href||pathname.startsWith(`${href}/`);
}

export function AppShell({children,userName,immersive=false}:{children:React.ReactNode;userName:string;immersive?:boolean}){
  const pathname=usePathname();
  const [menuOpen,setMenuOpen]=useState(false);
  const currentItem=useMemo(()=>[...allItems].sort((a,b)=>b.href.length-a.href.length).find(item=>matchesPath(pathname,item.href))||railItems[0],[pathname]);
  const active=(href:string)=>currentItem?.href===href;
  const workstation=pathname.startsWith('/takeoff/')||pathname.startsWith('/estimates/');
  const estimatingContext=pathname.startsWith('/takeoff')||pathname.startsWith('/estimates')||pathname.startsWith('/proposals');

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();setMenuOpen(true);return;
      }
      if(event.key==='Escape')setMenuOpen(false);
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);

  if(immersive)return <div className="b2-immersive">{children}</div>;

  return <div className="shell b2-shell">
    <BankSyncPulse/><OutlookSyncPulse/>
    <aside className="b2-rail" aria-label="Carez Concrete OS navigation">
      <Link href="/" className="b2-rail-brand" aria-label="Carez Concrete OS home">
        <Image src="/brand/carez-wordmark.png" alt="Carez Concrete" width={112} height={61} priority sizes="112px"/>
      </Link>
      <nav className="b2-rail-nav">
        {railItems.map(({href,label,Icon})=><Link key={href} href={href} prefetch={false} className={active(href)?'active':''} aria-current={active(href)?'page':undefined} title={label}>
          <Icon aria-hidden="true"/><span>{label}</span>
        </Link>)}
      </nav>
      <button type="button" className="b2-rail-more" onClick={()=>setMenuOpen(true)} title="All Carez tools"><Menu/><span>More</span></button>
    </aside>

    <main className="main b2-main">
      <header className="b2-topbar">
        <div className="b2-topbar-identity">
          <span className="b2-topbar-kicker">CAREZ CONCRETE OS</span>
          <strong>{currentItem?.label||'Dashboard'}</strong>
        </div>
        {estimatingContext&&<nav className="b2-project-nav" aria-label="Estimating workflow">
          <Link href="/takeoff" className={pathname.startsWith('/takeoff')?'active':''}>Takeoff</Link>
          <Link href="/estimates" className={pathname.startsWith('/estimates')?'active':''}>Estimate</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/proposals">Proposal</Link>
        </nav>}
        <div className="b2-topbar-actions">
          <button type="button" className="b2-icon-action" title="Notifications" aria-label="Notifications"><Bell/></button>
          <button type="button" className="b2-icon-action" title="Help" aria-label="Help"><HelpCircle/></button>
          <button type="button" className="b2-search" onClick={()=>setMenuOpen(true)} aria-keyshortcuts="Control+K Meta+K"><Search/><span>Find tool</span><kbd>Ctrl K</kbd></button>
          <div className="b2-user" title={userName}>{userName}</div>
        </div>
      </header>
      <div className={`b2-content ${workstation?'b2-content-workstation':''}`}>{children}</div>
    </main>

    <nav className="mobile-nav b2-mobile-nav">
      {railItems.slice(0,4).map(({href,label,Icon})=><Link key={href} href={href} prefetch={false} className={active(href)?'active':''}><Icon/><span>{label}</span></Link>)}
      <button type="button" onClick={()=>setMenuOpen(true)} className={menuOpen?'active':''}><Menu/><span>More</span></button>
    </nav>
    <MobileNavSheet open={menuOpen} onClose={()=>setMenuOpen(false)} groups={toolGroups} active={active}/>
  </div>;
}
