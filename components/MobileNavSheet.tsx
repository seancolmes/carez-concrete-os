'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import {Button,DrawerBody,DrawerHeader,Input,OverlayDrawer} from '@fluentui/react-components';
import {SearchRegular as Search,DismissRegular as X,type FluentIcon} from '@fluentui/react-icons';

type NavItem={href:string;label:string;Icon:FluentIcon;hint?:string};

export function MobileNavSheet({open,onClose,groups,active}:{open:boolean;onClose:()=>void;groups:{label:string;items:NavItem[]}[];active:(href:string)=>boolean}){
  const [query,setQuery]=useState('');
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return groups;
    return groups.map(group=>({...group,items:group.items.filter(item=>[group.label,item.label,item.hint,item.href].some(value=>String(value||'').toLowerCase().includes(q)))})).filter(group=>group.items.length);
  },[groups,query]);
  const close=()=>{setQuery('');onClose();};
  const matchCount=filtered.reduce((sum,group)=>sum+group.items.length,0);
  return <OverlayDrawer open={open} onOpenChange={(_,data)=>{if(!data.open)close()}} position="start" size="medium" aria-label="Pourtrace tools menu" className="tool-finder-sheet">
    <DrawerHeader className="mobile-menu-head"><div><div className="mobile-menu-kicker">POURTRACE</div><div className="mobile-menu-title">Find a Tool</div><div className="mobile-menu-subtitle">Search the deeper system only when you need it.</div></div><Button appearance="subtle" icon={<X fontSize={22}/>} onClick={close} aria-label="Close menu" className="mobile-menu-close"/></DrawerHeader>
    <DrawerBody className="min-h-0 p-0">
      <Input appearance="underline" autoFocus value={query} onChange={(_,data)=>setQuery(data.value)} placeholder="Search: pour, invoice, crew, rebar…" contentBefore={<Search fontSize={18}/>} contentAfter={<kbd>ESC</kbd>} aria-label="Search tools" className="mx-4 mt-3 w-[calc(100%-2rem)]"/>
      <div className="tool-finder-meta">{query?`${matchCount} matching tool${matchCount===1?'':'s'}`:'Browse by workflow'}</div>
      <div className="mobile-menu-groups">{filtered.length?filtered.map(group=><section className="mobile-menu-group" key={group.label}><div className="mobile-menu-group-title">{group.label}</div><div className="mobile-menu-items">{group.items.map(({href,label,Icon,hint})=><Link key={href} href={href} prefetch={false} onClick={close} className={active(href)?'active':''}><span className="mobile-menu-icon"><Icon fontSize={18}/></span><span><strong>{label}</strong>{hint&&<small>{hint}</small>}</span></Link>)}</div></section>):<div className="tool-finder-empty"><Search fontSize={24}/><strong>No Pourtrace tool matches “{query}”</strong><span>Try a workflow word such as estimate, crew, pour, invoice, bank or equipment.</span></div>}</div>
    </DrawerBody>
  </OverlayDrawer>;
}
