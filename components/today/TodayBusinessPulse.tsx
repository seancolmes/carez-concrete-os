'use client';

import {useState} from 'react';
import {ProgressBar,Tab,TabList} from '@fluentui/react-components';

type Props={openLeads:string;openProposals:string;proposalValue:string;nextFollowUp:string;customersOwe:string;expectedIn:string;expectedOut:string;cashNet:string};

export function TodayBusinessPulse({openLeads,openProposals,proposalValue,nextFollowUp,customersOwe,expectedIn,expectedOut,cashNet}:Props){
  const [view,setView]=useState('pipeline');
  const leadCount=Number(openLeads)||0,proposalCount=Number(openProposals)||0,maxPipeline=Math.max(leadCount,proposalCount,1);
  return <section aria-labelledby="today-business-heading" className="surface-card min-w-0 shrink-0 rounded-md p-4 lg:max-h-[48%] lg:overflow-y-auto">
    <h2 id="today-business-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business pulse</h2>
    <TabList selectedValue={view} onTabSelect={(_,data)=>setView(String(data.value))} className="mt-3 w-full">
      <Tab value="pipeline">Pipeline</Tab><Tab value="cash">Cash</Tab>
    </TabList>
    {view==='pipeline'?<div role="tabpanel" aria-label="Pipeline" className="mt-3 space-y-3 text-xs">
      <div><div className="mb-1 flex justify-between"><span>Open leads</span><span className="font-mono">{openLeads}</span></div><ProgressBar value={leadCount/maxPipeline} aria-label="Open leads"/></div>
      <div><div className="mb-1 flex justify-between"><span>Proposals out</span><span className="font-mono">{openProposals}</span></div><ProgressBar value={proposalCount/maxPipeline} aria-label="Proposals out"/></div>
      <div className="flex justify-between gap-3 border-t border-border pt-2"><span className="text-muted-foreground">Proposal value</span><strong className="font-mono">{proposalValue}</strong></div>
      <p className="text-[11px] text-muted-foreground">Next follow-up: {nextFollowUp}</p>
    </div>:<dl role="tabpanel" aria-label="Cash" className="mt-3 divide-y divide-border text-xs">{[['Customers owe',customersOwe],['Expected in · 7 days',expectedIn],['Expected out · 7 days',expectedOut],['7-day net',cashNet]].map(([label,value])=><div key={label} className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono font-semibold">{value}</dd></div>)}</dl>}
  </section>;
}
