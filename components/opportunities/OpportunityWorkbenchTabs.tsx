'use client';

import {useRouter} from 'next/navigation';
import {Tab,TabList} from '@fluentui/react-components';

export type WorkbenchSection='overview'|'scope'|'commercial'|'proposal'|'activity';

const sections:[WorkbenchSection,string][]=[
  ['overview','Bid'],
  ['scope','Scope & plans'],
  ['commercial','Pricing'],
  ['proposal','Proposal'],
  ['activity','Activity'],
];

export function OpportunityWorkbenchTabs({active,hrefFor}:{active:WorkbenchSection;hrefFor:Record<WorkbenchSection,string>}){
  const router=useRouter();
  return <nav aria-label="Opportunity workbench" className="pt-local-navigation min-w-0 px-2">
    <TabList selectedValue={active} onTabSelect={(_,data)=>router.push(hrefFor[data.value as WorkbenchSection],{scroll:false})} size="small" className="w-full flex-wrap gap-1">
      {sections.map(([key,label])=><Tab key={key} value={key} className="whitespace-nowrap px-3 py-2 text-xs">{label}</Tab>)}
    </TabList>
  </nav>;
}
