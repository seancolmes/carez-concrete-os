'use client';
import Link from 'next/link';
import { X } from 'lucide-react';

type NavItem={href:string;label:string;Icon:any;hint?:string};

export function MobileNavSheet({open,onClose,groups,active}:{open:boolean;onClose:()=>void;groups:{label:string;items:NavItem[]}[];active:(href:string)=>boolean}){
  if(!open)return null;
  return <div className="mobile-menu-backdrop" role="dialog" aria-modal="true" aria-label="Carez OS menu">
    <div className="mobile-menu-sheet">
      <div className="mobile-menu-head"><div><div className="mobile-menu-kicker">CAREZ CONCRETE</div><div className="mobile-menu-title">All Tools</div><div className="mobile-menu-subtitle">Everything available on desktop, organized for the field.</div></div><button type="button" className="mobile-menu-close" onClick={onClose} aria-label="Close menu"><X size={22}/></button></div>
      <div className="mobile-menu-groups">{groups.map(group=><section className="mobile-menu-group" key={group.label}><div className="mobile-menu-group-title">{group.label}</div><div className="mobile-menu-items">{group.items.map(({href,label,Icon,hint})=><Link key={href} href={href} prefetch={false} onClick={onClose} className={active(href)?'active':''}><span className="mobile-menu-icon"><Icon size={18}/></span><span><strong>{label}</strong>{hint&&<small>{hint}</small>}</span></Link>)}</div></section>)}</div>
    </div>
  </div>;
}
