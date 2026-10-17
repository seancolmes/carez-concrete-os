'use client';

import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {Tab,TabList} from '@fluentui/react-components';

export type FieldTab='dispatch'|'schedule'|'look-ahead'|'production'|'crew';

const tabs:{id:FieldTab;label:string}[]=[
  {id:'dispatch',label:'Dispatch'},
  {id:'schedule',label:'Schedule'},
  {id:'look-ahead',label:'Look-Ahead'},
  {id:'production',label:'Production & Daily Logs'},
  {id:'crew',label:'Crew Allocation'},
];

export function FieldTabNav({activeTab}:{activeTab:FieldTab}){
  const router=useRouter();
  const pathname=usePathname();
  const searchParams=useSearchParams();

  function selectTab(tab:FieldTab){
    const next=new URLSearchParams(searchParams.toString());
    next.set('tab',tab);
    next.delete('view');
    router.replace(`${pathname}?${next.toString()}`,{scroll:false});
  }

  return <nav aria-label="Field workspace" className="pt-local-navigation">
    <TabList selectedValue={activeTab} onTabSelect={(_,data)=>selectTab(data.value as FieldTab)}>
      {tabs.map(tab=><Tab key={tab.id} value={tab.id}>{tab.label}</Tab>)}
    </TabList>
  </nav>;
}
