'use client';

import {useMemo,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {motion,useReducedMotion} from 'framer-motion';
import {ChevronDown} from 'lucide-react';
import {CarezStatus} from '@/components/carez';
import type {CarezStatusTone} from '@/lib/ui/state';

export type OpportunityGridRow={key:string;leadId:string|null;estimateId:string|null;number:string;name:string;customer:string;stage:string;bidDue:string|null;takeoff:string;estimate:string;value:number|null};

const money=(value:number|null)=>value===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const date=(value:string|null)=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value)):'—';
const statusTone=(value:string):CarezStatusTone=>/hold|blocked|lost|declined|overdue/i.test(value)?'error':/attention|review|pending/i.test(value)?'warning':/ready|won|awarded|complete|sent/i.test(value)?'success':/not started/i.test(value)?'neutral':'info';

export function OpportunitiesGrid({rows,selectedKey,workspace}:{rows:OpportunityGridRow[];selectedKey:string|null;workspace:ReactNode}){
  const router=useRouter();
  const reduceMotion=useReducedMotion();
  const [search,setSearch]=useState('');
  const visibleRows=useMemo(()=>{const term=search.trim().toLowerCase();return term?rows.filter(row=>[row.number,row.name,row.customer,row.stage,row.estimate].some(value=>value.toLowerCase().includes(term))):rows;},[rows,search]);
  const toggle=(row:OpportunityGridRow)=>{
    if(selectedKey===row.key){router.replace('/opportunities',{scroll:false});return;}
    const query=row.leadId?`lead=${encodeURIComponent(row.leadId)}`:`estimate=${encodeURIComponent(row.estimateId||'')}`;
    router.replace(`/opportunities?${query}`,{scroll:false});
  };

  return <div className="overflow-x-auto rounded-xl border border-[#D4DBD7] bg-white shadow-md dark:border-[#343A3F] dark:bg-[#181A1B]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4DBD7] px-3 py-2 dark:border-[#343A3F]"><label className="sr-only" htmlFor="opportunity-search">Search opportunities</label><input id="opportunity-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search opportunities, customers, bids…" className="h-8 w-full max-w-sm rounded-sm border border-[#D4DBD7] bg-[#F5F7F6] px-2 text-xs outline-none focus:border-[#007A52] dark:border-[#343A3F] dark:bg-[#121212] dark:focus:border-[#009966]"/><span className="text-xs text-[#7B8580] dark:text-[#7C8580]">{visibleRows.length} records</span></div>
    <table className="w-full min-w-[880px] border-collapse text-left text-xs">
      <thead className="bg-[#EFF2F0] text-[#525C57] dark:bg-[#25292C] dark:text-[#B6BEBA]"><tr className="border-b border-[#D4DBD7]/50 dark:border-[#343A3F]/50"><th className="px-3 py-2 font-semibold">Opportunity / customer</th><th className="px-3 py-2 font-semibold">Stage</th><th className="px-3 py-2 font-semibold">Bid due</th><th className="px-3 py-2 font-semibold">Takeoff</th><th className="px-3 py-2 font-semibold">Estimate</th><th className="px-3 py-2 text-right font-semibold">Open value</th><th className="w-8 px-2 py-2"><span className="sr-only">Expand</span></th></tr></thead>
      <tbody>{visibleRows.length===0?<tr><td colSpan={7} className="px-4 py-10 text-center text-[#525C57] dark:text-[#B6BEBA]">{rows.length?'No matching opportunities.':'No opportunities or estimate bids are recorded yet.'}</td></tr>:visibleRows.map(row=><FragmentRow key={row.key} row={row} expanded={selectedKey===row.key} onToggle={()=>toggle(row)} workspace={workspace} reduceMotion={Boolean(reduceMotion)}/>)}</tbody>
    </table>
  </div>;
}

function FragmentRow({row,expanded,onToggle,workspace,reduceMotion}:{row:OpportunityGridRow;expanded:boolean;onToggle:()=>void;workspace:ReactNode;reduceMotion:boolean}){
  return <>
    <tr onClick={onToggle} className={`cursor-pointer border-b border-[#D4DBD7]/50 text-[#171B19] transition-colors hover:bg-[#EFF2F0] dark:border-[#343A3F]/50 dark:text-[#F4F6F5] dark:hover:bg-[#1C1F23] ${expanded?'bg-[#EFF2F0] dark:bg-[#25292C]':''}`}>
      <td className="max-w-80 px-3 py-1.5"><button type="button" aria-expanded={expanded} aria-label={`${expanded?'Collapse':'Expand'} ${row.name}`} onClick={event=>{event.stopPropagation();onToggle();}} className="block max-w-full text-left focus-visible:outline-2 focus-visible:outline-[#007A52] dark:focus-visible:outline-[#009966]"><span className="block truncate font-semibold"><span className="mr-2 inline-block rounded-sm border border-[#D4DBD7] bg-[#EFF2F0] px-1 font-mono text-[10px] dark:border-[#343A3F] dark:bg-[#25292C]">{row.number}</span>{row.name}</span><span className="block truncate text-[11px] text-[#525C57] dark:text-[#B6BEBA]">{row.customer}</span></button></td>
      <td className="px-3 py-1.5"><CarezStatus tone={statusTone(row.stage)} label={row.stage} className={/sent/i.test(row.stage)?'bg-[#009966]/15 border border-[#009966]/50 text-[#009966]':''}/></td><td className="px-3 py-1.5 font-mono tabular-nums">{date(row.bidDue)}</td><td className="px-3 py-1.5"><CarezStatus tone={statusTone(row.takeoff)} label={row.takeoff}/></td><td className="px-3 py-1.5 font-mono tabular-nums">{row.estimate}</td><td className="px-3 py-1.5 text-right font-mono tabular-nums">{money(row.value)}</td><td className="px-2 py-1.5"><ChevronDown className={`size-4 transition-transform ${expanded?'rotate-180':''}`} aria-hidden="true"/></td>
    </tr>
    {expanded&&<tr><td colSpan={7} className="p-0"><motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:reduceMotion?0:0.22}} className="overflow-hidden">{workspace}</motion.div></td></tr>}
  </>;
}
