'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Calculator, Briefcase, ClipboardList, ReceiptText, TrendingUp, ShieldCheck, Hammer, Receipt, HardHat, Gauge, Settings } from 'lucide-react';

const desktopItems=[
  {href:'/',label:'Home',Icon:Home},
  {href:'/leads',label:'Leads',Icon:Users},
  {href:'/estimates',label:'Estimates',Icon:Calculator},
  {href:'/projects',label:'Projects',Icon:Briefcase},
  {href:'/change-orders',label:'Change Orders',Icon:ClipboardList},
  {href:'/billing',label:'Billing',Icon:ReceiptText},
  {href:'/forecast',label:'Forecast',Icon:TrendingUp},
  {href:'/pour-control',label:'Pour Control',Icon:ShieldCheck},
  {href:'/field',label:'Field',Icon:Hammer},
  {href:'/costs',label:'Job Costs',Icon:Receipt},
  {href:'/crew',label:'Crew',Icon:HardHat},
  {href:'/overhead',label:'Overhead',Icon:Gauge},
  {href:'/settings',label:'Settings',Icon:Settings},
];
const mobileItems=[
  {href:'/',label:'Home',Icon:Home},
  {href:'/projects',label:'Projects',Icon:Briefcase},
  {href:'/field',label:'Field',Icon:Hammer},
  {href:'/pour-control',label:'Pours',Icon:ShieldCheck},
  {href:'/change-orders',label:'COs',Icon:ClipboardList},
  {href:'/billing',label:'Billing',Icon:ReceiptText},
];

export function AppShell({children,userName}:{children:React.ReactNode;userName:string}){
  const pathname=usePathname();
  const active=(href:string)=>href==='/'?pathname==='/':pathname.startsWith(href);
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand-lockup">
        <img src="/brand/carez-wordmark.png" alt="Carez" className="brand-wordmark"/>
        <span style={{display:'block',fontSize:11,fontWeight:900,letterSpacing:'.22em',color:'#b8c4d4',marginTop:2}}>CONCRETE</span>
        <span className="brand-os">Operating System</span>
      </div>
      <nav className="nav">{desktopItems.map(({href,label,Icon})=><Link key={href} href={href} className={active(href)?'active':''}><Icon className="nav-icon" aria-hidden="true"/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-user"><div className="sidebar-user-label">Signed in</div><div className="sidebar-user-name">{userName}</div></div>
    </aside>
    <main className="main">
      <div className="topbar"><div style={{display:'grid',justifyItems:'start'}}><img src="/brand/carez-wordmark.png" alt="Carez" className="mobile-brand-wordmark"/><span style={{fontSize:8,fontWeight:900,letterSpacing:'.18em',color:'#b8c4d4'}}>CONCRETE</span></div><div className="user-chip">{userName}</div></div>
      {children}
    </main>
    <nav className="mobile-nav" style={{gridTemplateColumns:'repeat(6,1fr)'}}>{mobileItems.map(({href,label,Icon})=><Link key={href} href={href} className={active(href)?'active':''}><Icon className="nav-icon" aria-hidden="true"/><span>{label}</span></Link>)}</nav>
  </div>;
}