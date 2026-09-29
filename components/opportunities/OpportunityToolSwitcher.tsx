'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';

export type OpportunityTool='intake'|'audit'|'intelligence';

const tools:[OpportunityTool,string][]=[
  ['intake','Outlook lead intake'],
  ['audit','Estimate release review'],
  ['intelligence','Bid intelligence'],
];

const inactiveClass='bg-[#181A1B] border border-[#343A3F] text-[#8B949E] text-xs font-medium px-4 py-2 rounded-xl hover:text-white hover:border-[#525B62] transition-all';
const activeClass='bg-[#007A52]/20 border border-[#007A52] text-[#009966] text-xs font-semibold px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(0,153,102,0.15)]';

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
      {tools.map(([view,label])=><button key={view} type="button" aria-expanded={active===view} aria-controls="opportunity-tool-panel" onClick={()=>toggle(view)} className={active===view?activeClass:inactiveClass}>{label}</button>)}
    </nav>
    <div aria-hidden="true" className="horizon-divider mb-4"/>
    {active&&active===initialView&&panel?<section id="opportunity-tool-panel" aria-label="Opportunity tool" className={`animate-in slide-in-from-top-2 fade-in duration-200 ease-out mb-4 ${active==='intelligence'?'':'surface-card rounded-xl p-4'}`}>{panel}</section>:null}
  </>;
}
