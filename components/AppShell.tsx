'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items=[['/','Home'],['/leads','Leads'],['/projects','Projects'],['/crew','Crew'],['/settings','Settings']];

export function AppShell({children,userName}:{children:React.ReactNode;userName:string}){
  const pathname=usePathname();
  return <div className="shell">
    <aside className="sidebar"><div className="brand">CAREZ CONCRETE<br/><span className="meta">OPERATING SYSTEM</span></div><nav className="nav">{items.map(([href,label])=><Link key={href} href={href} className={pathname===href?'success':''}>{label}</Link>)}</nav><div className="meta" style={{marginTop:24}}>{userName}</div></aside>
    <main className="main"><div className="topbar"><div className="brand">CAREZ CONCRETE</div><div className="meta">{userName}</div></div>{children}</main>
    <nav className="mobile-nav">{items.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>
  </div>;
}
