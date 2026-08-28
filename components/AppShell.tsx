'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Calculator, Briefcase, ClipboardList, ReceiptText, TrendingUp, ShieldCheck, ShoppingCart, CreditCard, Wallet, Landmark, Banknote, Hammer, Receipt, HardHat, Gauge, Settings } from 'lucide-react';
import { BankSyncPulse } from '@/components/PlaidBankControls';

type NavItem={href:string;label:string;Icon:any};
const navGroups:{label:string;items:NavItem[]}[]=[
  {label:'Overview',items:[{href:'/',label:'Home',Icon:Home}]},
  {label:'Sales & Estimating',items:[{href:'/leads',label:'Leads',Icon:Users},{href:'/estimates',label:'Estimates',Icon:Calculator}]},
  {label:'Project Operations',items:[
    {href:'/projects',label:'Projects',Icon:Briefcase},{href:'/change-orders',label:'Change Orders',Icon:ClipboardList},{href:'/forecast',label:'Forecast',Icon:TrendingUp},{href:'/pour-control',label:'Pour Control',Icon:ShieldCheck},{href:'/field',label:'Field',Icon:Hammer},{href:'/crew',label:'Crew',Icon:HardHat},
  ]},
  {label:'Purchasing',items:[{href:'/procurement',label:'Procurement',Icon:ShoppingCart}]},
  {label:'Accounting',items:[
    {href:'/billing',label:'Billing',Icon:ReceiptText},{href:'/payables',label:'Accounts Payable',Icon:CreditCard},{href:'/cashflow',label:'Cashflow',Icon:Wallet},{href:'/banking',label:'Banking',Icon:Landmark},{href:'/payroll',label:'Payroll',Icon:Banknote},{href:'/costs',label:'Job Costs',Icon:Receipt},{href:'/overhead',label:'Overhead',Icon:Gauge},
  ]},
  {label:'Administration',items:[{href:'/settings',label:'Settings',Icon:Settings}]},
];
const mobileItems:NavItem[]=[{href:'/',label:'Home',Icon:Home},{href:'/projects',label:'Projects',Icon:Briefcase},{href:'/field',label:'Field',Icon:Hammer},{href:'/pour-control',label:'Pours',Icon:ShieldCheck},{href:'/change-orders',label:'COs',Icon:ClipboardList},{href:'/procurement',label:'POs',Icon:ShoppingCart}];

export function AppShell({children,userName}:{children:React.ReactNode;userName:string}){
  const pathname=usePathname();const active=(href:string)=>href==='/'?pathname==='/':pathname.startsWith(href);
  return <div className="shell"><BankSyncPulse/>
    <aside className="sidebar"><div className="brand-lockup"><img src="/brand/carez-wordmark.png" alt="Carez" className="brand-wordmark"/><span className="brand-concrete-label">CONCRETE</span><span className="brand-os">Operating System</span></div>
      <nav className="nav nav-grouped" aria-label="Primary navigation">{navGroups.map(group=><div className="nav-section" key={group.label}><div className="nav-section-label">{group.label}</div><div className="nav-section-items">{group.items.map(({href,label,Icon})=><Link key={href} href={href} className={active(href)?'active':''}><Icon className="nav-icon" aria-hidden="true"/><span>{label}</span></Link>)}</div></div>)}</nav>
      <div className="sidebar-user"><div className="sidebar-user-label">Signed in</div><div className="sidebar-user-name">{userName}</div></div>
    </aside>
    <main className="main"><div className="topbar"><div className="mobile-brand-lockup"><img src="/brand/carez-wordmark.png" alt="Carez" className="mobile-brand-wordmark"/><span>CONCRETE</span></div><div className="user-chip">{userName}</div></div>{children}</main>
    <nav className="mobile-nav" style={{gridTemplateColumns:'repeat(6,1fr)'}}>{mobileItems.map(({href,label,Icon})=><Link key={href} href={href} className={active(href)?'active':''}><Icon className="nav-icon" aria-hidden="true"/><span>{label}</span></Link>)}</nav>
  </div>;
}
