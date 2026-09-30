'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@fluentui/react-components';

export type OpportunityTool='intake'|'audit'|'intelligence';

const tools:[OpportunityTool,string][]=[
  ['intake','Outlook lead intake'],
  ['audit','Estimate release review'],
  ['intelligence','Bid intelligence'],
];

const inactiveClass='bg-card border border-border text-muted-foreground text-xs font-medium px-4 py-2 rounded-xl hover:text-foreground hover:border-[var(--border-strong)] transition-all';
const activeClass='bg-[var(--selection-fill)] border border-[var(--selection-border)] text-[var(--selection-text)] text-xs font-semibold px-4 py-2 rounded-xl shadow-[inset_0_1px_var(--selection-highlight)]';

export function OpportunityToolSwitcher({initialView,panel}:{initialView:OpportunityTool|null;panel:ReactNode}){
  const router=useRouter();
  const [active,setActive]=useState<OpportunityTool|null>(initialView);
  useEffect(()=>setActive(initialView),[initialView]);

  const toggle=(view:OpportunityTool)=>{
    const next=active===view?null:view;
    setActive(next);
    const params=new URLSearchParams(window.location.search);
    if(next)params.set('view',next);
    else params.delete('view');
    const query=params.toString();
    router.replace(`/opportunities${query?`?${query}`:''}`,{scroll:false});
  };

  return <>
    <nav aria-label="Opportunity tools" className="mb-2 flex flex-wrap gap-2">
      {tools.map(([view,label])=><Button key={view} type="button" appearance={active===view?'primary':'outline'} aria-expanded={active===view} aria-controls="opportunity-tool-panel" onClick={()=>toggle(view)} className={active===view?activeClass:inactiveClass}>{label}</Button>)}
    </nav>
    <div aria-hidden="true" className="horizon-divider mb-4"/>
    {active&&active===initialView&&panel?<section id="opportunity-tool-panel" aria-label="Opportunity tool" className={`animate-in slide-in-from-top-2 fade-in duration-200 ease-out mb-4 ${active==='intelligence'?'':'surface-card rounded-xl p-4'}`}>{panel}</section>:null}
  </>;
}
