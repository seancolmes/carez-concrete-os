'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import {WorkspaceSubnav,workspacePillClass} from '@/components/ui/workspace-subnav';
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

export function ExpandedOpportunityWorkspace({initialTab='scope',context,scope,takeoff,worksheet,proposal}:{initialTab?:OpportunityTab;context:OpportunityGridRow;scope:ReactNode;takeoff:ReactNode;worksheet:ReactNode;proposal:ReactNode}){
  const [active,setActive]=useState<OpportunityTab>(initialTab);
  const reduceMotion=useReducedMotion();
  const content={scope,takeoff,worksheet,proposal};
  useEffect(()=>setActive(initialTab),[initialTab]);

  return <div className={`${active==='takeoff'?'':archetype.workspace} border-y border-[#D4DBD7] bg-[#F5F7F6] p-4 shadow-inner dark:border-[#343A3F] dark:bg-[#121212] md:p-6`}>
    <section aria-label="Opportunity record pulse" className="mb-5 rounded-lg border border-[#D4DBD7] bg-white px-6 py-3 text-sm dark:border-[#343A3F] dark:bg-[#181A1B]">
      <dl className="flex flex-row flex-wrap gap-x-6 gap-y-2">
        <div className="flex gap-2"><dt className="text-muted-foreground">Open value</dt><dd className="font-mono font-semibold tabular-nums">{money(context.value)}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">Bid due</dt><dd className="font-mono tabular-nums">{context.bidDue||'Not set'}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">Estimate</dt><dd className="font-mono tabular-nums">{context.estimate}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">Takeoff</dt><dd>{context.takeoff}</dd></div>
      </dl>
    </section>
    <WorkspaceSubnav label="Opportunity workspace views" tablist>
      {tabs.map(([value,label])=><button key={value} id={`opportunity-tab-${value}`} type="button" role="tab" aria-selected={active===value} aria-controls={`opportunity-panel-${value}`} onClick={()=>setActive(value)} className={workspacePillClass(active===value)}>{label}</button>)}
    </WorkspaceSubnav>
    <div className="w-full min-w-0 pt-5">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={active} id={`opportunity-panel-${active}`} role="tabpanel" aria-labelledby={`opportunity-tab-${active}`} className="min-h-48 w-full min-w-0" initial={{opacity:0,y:reduceMotion?0:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduceMotion?0:-6}} transition={{duration:reduceMotion?0:0.18}}>{content[active]}</motion.div>
      </AnimatePresence>
    </div>
  </div>;
}
