'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';

export type OpportunityTool='intake'|'audit'|'intelligence';

const tools:[OpportunityTool,string][]=[
  ['intake','Outlook lead intake'],
  ['audit','Estimate release review'],
  ['intelligence','Bid intelligence'],
];

const inactiveClass='border border-[#D4DBD7] bg-white text-muted-foreground hover:bg-[#EFF2F0] hover:text-foreground transition-all dark:bg-[#181A1B] dark:border-[#343A3F] dark:hover:bg-[#1C1F23] dark:hover:text-white';
const activeClass='border border-[#007A52] bg-[#007A52]/10 text-[#007A52] font-semibold shadow-[0_0_15px_rgba(0,153,102,0.15)] dark:bg-[#009966]/20 dark:border-[#009966] dark:text-[#009966]';

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
    <nav aria-label="Opportunity tools" className="mb-4 flex flex-wrap gap-2">
      {tools.map(([view,label])=><button key={view} type="button" aria-expanded={active===view} aria-controls="opportunity-tool-panel" onClick={()=>toggle(view)} className={`rounded-xl px-3 py-2 text-xs ${active===view?activeClass:inactiveClass}`}>{label}</button>)}
    </nav>
    {active&&active===initialView&&panel?<section id="opportunity-tool-panel" aria-label="Opportunity tool" className={`animate-in slide-in-from-top-2 fade-in duration-200 ease-out mb-4 ${active==='intelligence'?'':'rounded-xl border border-[#D4DBD7] bg-white p-4 dark:border-[#343A3F] dark:bg-[#181A1B]'}`}>{panel}</section>:null}
  </>;
}
