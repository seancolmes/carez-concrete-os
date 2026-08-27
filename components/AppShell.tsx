'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const desktopItems=[['/','Home'],['/leads','Leads'],['/projects','Projects'],['/field','Field'],['/crew','Crew'],['/overhead','Overhead'],['/settings','Settings']];
const mobileItems=[['/','Home'],['/leads','Leads'],['/projects','Projects'],['/field','Field'],['/overhead','OH']];

export function AppShell({children,userName}:{children:React.ReactNode;userName:string}){
  const pathname=usePathname();
  const active=(href:string)=>href==='/'?pathname==='/':pathname.startsWith(href);
  return <div className="shell">
    <aside className="sidebar"><div className="brand">CAREZ CONCRETE<br/><span className="meta">OPERATING SYSTEM</span></div><nav className="nav">{desktopItems.map(([href,label])=><Link key={href} href={href} className={active(href)?'success':''}>{label}</Link>)}</nav><div className="meta" style={{marginTop:24}}>{userName}</div></aside>
    <main className="main"><div className="topbar"><div className="brand">CAREZ CONCRETE</div><div className="meta">{userName}</div></div>{children}</main>
    <nav className="mobile-nav">{mobileItems.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>
  </div>;
}
