'use client';

import {usePathname,useRouter,useSearchParams} from 'next/navigation';

export type FieldTab='dispatch'|'schedule'|'look-ahead'|'production'|'crew';

const tabs:{id:FieldTab;label:string}[]=[
  {id:'dispatch',label:'Dispatch'},
  {id:'schedule',label:'Schedule'},
  {id:'look-ahead',label:'Look-Ahead'},
  {id:'production',label:'Production & Daily Logs'},
  {id:'crew',label:'Crew Allocation'},
];

const inactive='bg-[#181A1B] border border-[#343A3F] text-[#8B949E] text-xs font-medium px-4 py-1.5 rounded-lg hover:text-white hover:border-[#525B62] transition-all cursor-pointer whitespace-nowrap';
const active='bg-[#009966]/15 border border-[#009966] text-[#009966] text-xs font-semibold px-4 py-1.5 rounded-lg shadow-[0_0_10px_rgba(0,153,102,0.15)] whitespace-nowrap';

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

  return <nav aria-label="Field workspace" className="mb-3 flex gap-2 overflow-x-auto pb-1">
    {tabs.map(tab=><button key={tab.id} type="button" aria-current={activeTab===tab.id?'page':undefined} onClick={()=>selectTab(tab.id)} className={activeTab===tab.id?active:inactive}>{tab.label}</button>)}
  </nav>;
}
