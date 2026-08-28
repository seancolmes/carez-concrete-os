'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Calculator, Briefcase, ClipboardList, ReceiptText, TrendingUp, ShieldCheck, ShoppingCart, CreditCard, Wallet, Landmark, ListChecks, SlidersHorizontal, Banknote, Hammer, Receipt, HardHat, Gauge, Settings } from 'lucide-react';
import { BankSyncPulse } from '@/components/PlaidBankControls';

type NavItem={href:string;label:string;Icon:any;hint?:string};
const navGroups:{label:string;items:NavItem[]}[]=[
  {label:'Overview',items:[{href:'/',label:'Home',Icon:Home,hint:'What needs your attention today'}]},
  {label:'Sales & Estimating',items:[{href:'/leads',label:'Leads',Icon:Users,hint:'Possible jobs and follow-ups'},{href:'/estimates',label:'Estimates',Icon:Calculator,hint:'Price jobs and build budgets'}]},
  {label:'Jobs & Field',items:[
    {href:'/projects',label:'Projects',Icon:Briefcase,hint:'Active jobs and job health'},{href:'/change-orders',label:'Change Orders',Icon:ClipboardList,hint:'Extra work and approved changes'},{href:'/forecast',label:'Forecast',Icon:TrendingUp,hint:'Where each job is headed'},{href:'/pour-control',label:'Pour Control',Icon:ShieldCheck,hint:'Can we safely commit to the next pour?'},{href:'/field',label:'Field',Icon:Hammer,hint:'Timecards and daily field entry'},{href:'/crew',label:'Crew',Icon:HardHat,hint:'Workers, rates and labor setup'},
  ]},
  {label:'Purchasing',items:[{href:'/procurement',label:'Procurement',Icon:ShoppingCart,hint:'Quotes, orders, deliveries and vendor bills'}]},
  {label:'Money & Accounting',items:[
    {href:'/billing',label:'Billing',Icon:ReceiptText,hint:'Invoices and money customers owe us'},{href:'/payables',label:'Accounts Payable',Icon:CreditCard,hint:'Bills we owe vendors'},{href:'/cashflow',label:'Cashflow',Icon:Wallet,hint:'Where our money stands'},{href:'/banking',label:'Banking',Icon:Landmark,hint:'Connected bank accounts and activity'},{href:'/banking/reconcile',label:'Reconcile Transactions',Icon:ListChecks,hint:'Match bank charges and deposits'},{href:'/banking/rules',label:'Bank Rules',Icon:SlidersHorizontal,hint:'What Carez has learned to handle automatically'},{href:'/payroll',label:'Payroll',Icon:Banknote,hint:'Money needed to pay the crew'},{href:'/costs',label:'Job Costs',Icon:Receipt,hint:'What each job has actually cost'},{href:'/overhead',label:'Overhead',Icon:Gauge,hint:'Cost to keep Carez running'},
  ]},
  {label:'Company',items:[{href:'/settings',label:'Settings',Icon:Settings,hint:'Company setup and system controls'}]},
];
const mobileItems:NavItem[]=[{href:'/',label:'Home',Icon:Home},{href:'/projects',label:'Projects',Icon:Briefcase},{href:'/field',label:'Field',Icon:Hammer},{href:'/pour-control',label:'Pours',Icon:ShieldCheck},{href:'/change-orders',label:'COs',Icon:ClipboardList},{href:'/procurement',label:'Orders',Icon:ShoppingCart}];

export function AppShell({children,userName}:{children:React.ReactNode;userName:string}){
  const pathname=usePathname();
  const active=(href:string)=>href==='/'?pathname==='/':href==='/banking'?pathname==='/banking':pathname.startsWith(href);
  const currentGroup=navGroups.find(g=>g.items.some(i=>active(i.href)));
  const currentItem=currentGroup?.items.find(i=>active(i.href));
  return <div className="shell"><BankSyncPulse/>
    <aside className="sidebar"><div className="brand-lockup"><img src="/brand/carez-wordmark.png" alt="Carez" className="brand-wordmark"/><span className="brand-concrete-label">CONCRETE</span><span className="brand-os">Operating System</span></div>
      <nav className="nav nav-grouped" aria-label="Primary navigation">{navGroups.map(group=><div className="nav-section" key={group.label}><div className="nav-section-label">{group.label}</div><div className="nav-section-items">{group.items.map(({href,label,Icon,hint})=><Link key={href} href={href} title={hint||label} className={active(href)?'active':''}><Icon className="nav-icon" aria-hidden="true"/><span>{label}</span></Link>)}</div></div>)}</nav>
      <div className="sidebar-user"><div className="sidebar-user-label">Signed in</div><div className="sidebar-user-name">{userName}</div></div>
    </aside>
    <main className="main"><div className="topbar"><div className="mobile-brand-lockup"><img src="/brand/carez-wordmark.png" alt="Carez" className="mobile-brand-wordmark"/><span>CONCRETE</span></div><div className="topbar-context"><span>{currentGroup?.label||'Carez OS'}</span><strong>{currentItem?.label||'Home'}</strong>{currentItem?.hint&&<small>{currentItem.hint}</small>}</div><div className="user-chip">{userName}</div></div>{children}</main>
    <nav className="mobile-nav" style={{gridTemplateColumns:'repeat(6,1fr)'}}>{mobileItems.map(({href,label,Icon})=><Link key={href} href={href} className={active(href)?'active':''}><Icon className="nav-icon" aria-hidden="true"/><span>{label}</span></Link>)}</nav>
  </div>;
}
