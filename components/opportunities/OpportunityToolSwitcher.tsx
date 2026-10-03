'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Menu,MenuButton,MenuItem,MenuList,MenuPopover,MenuTrigger} from '@fluentui/react-components';

export type OpportunityTool='intake'|'audit'|'intelligence';

const tools:[OpportunityTool,string][]=[
  ['intake','Outlook lead intake'],
  ['audit','Estimate release review'],
  ['intelligence','Bid intelligence'],
];

export function OpportunityToolSwitcher({initialView,panel}:{initialView:OpportunityTool|null;panel:ReactNode}){
  const router=useRouter();
  const [active,setActive]=useState<OpportunityTool|null>(initialView);
  useEffect(()=>setActive(initialView),[initialView]);

  const select=(next:OpportunityTool|null)=>{
    setActive(next);
    const params=new URLSearchParams(window.location.search);
    if(next)params.set('view',next);
    else params.delete('view');
    const query=params.toString();
    router.replace(`/opportunities${query?`?${query}`:''}`,{scroll:false});
  };

  return <div className="mb-4">
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
      <Menu><MenuTrigger disableButtonEnhancement><MenuButton appearance="outline" size="small">Related tools</MenuButton></MenuTrigger>
        <MenuPopover><MenuList>{tools.map(([view,label])=><MenuItem key={view} onClick={()=>select(view)}>{label}</MenuItem>)}</MenuList></MenuPopover>
      </Menu>
      {active?<><span className="text-xs font-medium text-foreground">{tools.find(([key])=>key===active)?.[1]}</span><Button appearance="subtle" size="small" onClick={()=>select(null)}>Close tool</Button></>:null}
    </div>
    {active&&active===initialView&&panel?<section id="opportunity-tool-panel" aria-label="Opportunity tool" className="mt-3 min-w-0 border-y border-border bg-[var(--pt-surface-1)] p-3">{panel}</section>:null}
  </div>;
}
