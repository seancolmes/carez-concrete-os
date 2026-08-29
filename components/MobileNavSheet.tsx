'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import {Search,X} from 'lucide-react';

type NavItem={href:string;label:string;Icon:any;hint?:string};

export function MobileNavSheet({open,onClose,groups,active}:{open:boolean;onClose:()=>void;groups:{label:string;items:NavItem[]}[];active:(href:string)=>boolean}){
  const [query,setQuery]=useState('');
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return groups;
    return groups.map(group=>({...group,items:group.items.filter(item=>[group.label,item.label,item.hint,item.href].some(value=>String(value||'').toLowerCase().includes(q)))})).filter(group=>group.items.length);
  },[groups,query]);
  if(!open)return null;
  const close=()=>{setQuery('');onClose();};
  return <div className="mobile-menu-backdrop" role="dialog" aria-modal="true" aria-label="Carez OS menu" onMouseDown={event=>{if(event.currentTarget===event.target)close();}}>
    <div className="mobile-menu-sheet tool-finder-sheet">
      <div className="mobile-menu-head"><div><div className="mobile-menu-kicker">CAREZ CONCRETE</div><div className="mobile-menu-title">Find a Tool</div><div className="mobile-menu-subtitle">Search the deeper system only when you need it.</div></div><button type="button" className="mobile-menu-close" onClick={close} aria-label="Close menu"><X size={22}/></button></div>
      <label className="tool-finder-search"><Search size={18}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search: pour, invoice, crew, rebar…"/><kbd>ESC</kbd></label>
      <div className="tool-finder-meta">{query?`${filtered.reduce((sum,group)=>sum+group.items.length,0)} matching tool${filtered.reduce((sum,group)=>sum+group.items.length,0)===1?'':'s'}`:'Browse by workflow'}</div>
      <div className="mobile-menu-groups">{filtered.length?filtered.map(group=><section className="mobile-menu-group" key={group.label}><div className="mobile-menu-group-title">{group.label}</div><div className="mobile-menu-items">{group.items.map(({href,label,Icon,hint})=><Link key={href} href={href} prefetch={false} onClick={close} className={active(href)?'active':''}><span className="mobile-menu-icon"><Icon size={18}/></span><span><strong>{label}</strong>{hint&&<small>{hint}</small>}</span></Link>)}</div></section>):<div className="tool-finder-empty"><Search size={24}/><strong>No Carez tool matches “{query}”</strong><span>Try a workflow word such as estimate, crew, pour, invoice, bank or equipment.</span></div>}</div>
    </div>
  </div>;
}
