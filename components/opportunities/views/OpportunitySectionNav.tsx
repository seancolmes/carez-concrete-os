'use client';

import {useEffect,useState} from 'react';

const sections=[['scope','Scope'],['plans','Plans & Takeoff'],['estimates','Estimates'],['proposals','Proposals'],['activity','Activity']] as const;
const inactive='bg-white border border-[#D4DBD7] text-[#525C57] dark:bg-[#181A1B] dark:border-[#343A3F] dark:text-[#8B949E] text-sm font-medium px-4 py-1.5 rounded-lg hover:text-[#171B19] hover:border-[#B9C3BE] hover:bg-[#EFF2F0] dark:hover:text-white dark:hover:border-[#525B62] dark:hover:bg-[#1C1F23] transition-all cursor-pointer whitespace-nowrap';
const activeClass='bg-[#007A52]/10 border border-[#007A52] text-[#007A52] dark:bg-[#009966]/15 dark:border-[#009966] dark:text-[#009966] text-sm font-semibold px-4 py-1.5 rounded-lg shadow-[0_0_10px_rgba(0,153,102,0.15)] whitespace-nowrap';

export function OpportunitySectionNav(){
  const [active,setActive]=useState<string>('scope');
  useEffect(()=>{
    const sync=()=>setActive(sections.some(([id])=>`#${id}`===window.location.hash)?window.location.hash.slice(1):'scope');
    sync();
    window.addEventListener('hashchange',sync);
    return ()=>window.removeEventListener('hashchange',sync);
  },[]);
  return <nav aria-label="Opportunity sections" className="mb-6 flex w-full items-center gap-2 overflow-x-auto border-b border-[#D4DBD7] pb-4 dark:border-[#343A3F]">
    {sections.map(([id,label])=><a key={id} href={`#${id}`} aria-current={active===id?'location':undefined} onClick={()=>setActive(id)} className={active===id?activeClass:inactive}>{label}</a>)}
  </nav>;
}
