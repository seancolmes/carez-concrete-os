'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import archetype from '@/components/ui/workspace-archetype.module.css';
import type {OpportunityGridRow} from './OpportunitiesGrid';

export type OpportunityTab='scope'|'takeoff'|'worksheet'|'proposal';

const tabs:[OpportunityTab,string][]=[
  ['scope','Scope & Specs'],
  ['takeoff','Takeoff Engine'],
  ['worksheet','CSI Worksheet'],
  ['proposal','Proposal Generation'],
];

const money=(value:number|null)=>value===null?'Not available':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const inactiveTab='bg-white border border-[#D4DBD7] text-[#525C57] dark:bg-[#181A1B] dark:border-[#343A3F] dark:text-[#8B949E] text-sm font-medium px-4 py-1.5 rounded-lg hover:text-[#171B19] hover:border-[#B9C3BE] hover:bg-[#EFF2F0] dark:hover:text-white dark:hover:border-[#525B62] dark:hover:bg-[#1C1F23] transition-all cursor-pointer whitespace-nowrap';
const activeTab='bg-[#007A52]/10 border border-[#007A52] text-[#007A52] dark:bg-[#009966]/15 dark:border-[#009966] dark:text-[#009966] text-sm font-semibold px-4 py-1.5 rounded-lg shadow-[0_0_10px_rgba(0,153,102,0.15)] whitespace-nowrap';

export function ExpandedOpportunityWorkspace({initialTab='scope',context,scope,takeoff,worksheet,proposal}:{initialTab?:OpportunityTab;context:OpportunityGridRow;scope:ReactNode;takeoff:ReactNode;worksheet:ReactNode;proposal:ReactNode}){
  const [active,setActive]=useState<OpportunityTab>(initialTab);
  const reduceMotion=useReducedMotion();
  const content={scope,takeoff,worksheet,proposal};
  useEffect(()=>setActive(initialTab),[initialTab]);

  return <div className={`${active==='takeoff'?'fixed inset-x-0 bottom-0 top-14 z-[60] flex flex-col flex-1 min-h-0 overflow-hidden border-y border-[#D4DBD7] bg-[#F5F7F6] shadow-inner dark:border-[#343A3F] dark:bg-[#121212]':`${archetype.workspace} surface-card p-4 md:p-6`}`}>
    {active!=='takeoff'&&<section aria-label="Opportunity record pulse" className="surface-card mb-6 overflow-hidden rounded-xl">
      <h2 className="industrial-header px-4 py-3 text-base font-semibold tracking-tight text-[#171B19] dark:text-white">Record pulse</h2>
      <dl className="flex flex-row flex-wrap gap-x-6 gap-y-2 p-4">
        <div className="flex gap-2"><dt className="text-xs font-mono uppercase tracking-wider text-[#7B8580] dark:text-[#525B62]">Open value</dt><dd className="text-sm font-medium tabular-nums text-[#171B19] dark:text-[#E1E7E3]">{money(context.value)}</dd></div>
        <div className="flex gap-2"><dt className="text-xs font-mono uppercase tracking-wider text-[#7B8580] dark:text-[#525B62]">Bid due</dt><dd className="text-sm font-medium text-[#171B19] dark:text-[#E1E7E3]">{context.bidDue||'Not set'}</dd></div>
        <div className="flex gap-2"><dt className="text-xs font-mono uppercase tracking-wider text-[#7B8580] dark:text-[#525B62]">Estimate</dt><dd className="text-sm font-medium text-[#171B19] dark:text-[#E1E7E3]">{context.estimate}</dd></div>
        <div className="flex gap-2"><dt className="text-xs font-mono uppercase tracking-wider text-[#7B8580] dark:text-[#525B62]">Takeoff</dt><dd className="text-sm font-medium text-[#171B19] dark:text-[#E1E7E3]">{context.takeoff}</dd></div>
      </dl>
    </section>}
    <div role="tablist" aria-label="Opportunity workspace views" className={`${active==='takeoff'?'shrink-0 p-2':'mb-6 pb-4'} flex w-full items-center gap-2 overflow-x-auto border-b border-[#D4DBD7] dark:border-[#343A3F]`}>
      {tabs.map(([value,label])=><button key={value} id={`opportunity-tab-${value}`} type="button" role="tab" aria-selected={active===value} aria-controls={`opportunity-panel-${value}`} onClick={()=>setActive(value)} className={active===value?activeTab:inactiveTab}>{label}</button>)}
    </div>
    <div className={active==='takeoff'?'flex flex-1 min-h-0 overflow-hidden w-full min-w-0':'w-full min-w-0'}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={active} id={`opportunity-panel-${active}`} role="tabpanel" aria-labelledby={`opportunity-tab-${active}`} className={active==='takeoff'?'flex flex-col flex-1 min-h-0 overflow-hidden w-full min-w-0':'min-h-48 w-full min-w-0'} initial={{opacity:0,y:reduceMotion?0:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduceMotion?0:-6}} transition={{duration:reduceMotion?0:0.18}}>{content[active]}</motion.div>
      </AnimatePresence>
    </div>
  </div>;
}
