'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {ChevronDown,Search} from 'lucide-react';
import {motion,useReducedMotion} from 'framer-motion';
import {CarezStatus} from '@/components/carez';
import type {CarezStatusTone} from '@/lib/ui/state';

export type WorkspaceRecordRow={
  id:string;
  code:string;
  title:string;
  context:string;
  status:string;
  tone:CarezStatusTone;
  date:string|null;
  figureLabel:string;
  figure:string;
  details:{label:string;value:string}[];
  progress?:{label:string;used:number;total:number;valueLabel:string};
  href:string;
  actionLabel:string;
};

export function WorkspaceRecordBoard({title,description,rows,empty}:{title:string;description:string;rows:WorkspaceRecordRow[];empty:string}){
  const [search,setSearch]=useState('');
  const [expanded,setExpanded]=useState<string|null>(null);
  const reducedMotion=useReducedMotion();
  const visible=useMemo(()=>{const term=search.trim().toLowerCase();return term?rows.filter(row=>`${row.code} ${row.title} ${row.context} ${row.status}`.toLowerCase().includes(term)):rows;},[rows,search]);
  const toggle=(id:string)=>setExpanded(current=>current===id?null:id);

  return <section aria-label={title} className="mb-6 min-w-0 overflow-hidden rounded-xl border border-[#D4DBD7] bg-white shadow-md dark:border-[#343A3F] dark:bg-[#181A1B]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D4DBD7] p-4 dark:border-[#343A3F]"><div><h2 className="text-sm font-bold tracking-tight">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><div className="relative min-w-48"><Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/><input aria-label={`Search ${title.toLowerCase()}`} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search records" className="h-8 w-full rounded-md border border-[#D4DBD7] bg-[#F5F7F6] pl-8 pr-2 text-xs outline-none focus:border-[#007A52] dark:border-[#343A3F] dark:bg-[#121212] dark:focus:border-[#009966]"/></div></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-left text-xs"><thead className="bg-[#EFF2F0] text-[#525C57] dark:bg-[#25292C] dark:text-[#B6BEBA]"><tr><th className="px-3 py-2 font-semibold">Record</th><th className="px-3 py-2 font-semibold">State</th><th className="px-3 py-2 font-semibold">Date</th><th className="px-3 py-2 text-right font-semibold">Figure</th><th className="w-10 px-2 py-2"><span className="sr-only">Expand</span></th></tr></thead><tbody>{visible.length===0?<tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{rows.length?'No records match the search.':empty}</td></tr>:visible.map(row=><RecordRow key={row.id} row={row} expanded={expanded===row.id} toggle={()=>toggle(row.id)} reducedMotion={Boolean(reducedMotion)}/>)}</tbody></table></div>
  </section>;
}

function RecordRow({row,expanded,toggle,reducedMotion}:{row:WorkspaceRecordRow;expanded:boolean;toggle:()=>void;reducedMotion:boolean}){
  return <>
    <tr className={`cursor-pointer border-b border-[#D4DBD7]/50 transition-colors hover:bg-[#EFF2F0] dark:border-[#343A3F]/50 dark:hover:bg-[#1C1F23] ${expanded?'bg-[#EFF2F0] dark:bg-[#25292C]':''}`} onClick={toggle}>
      <td className="px-3 py-1.5"><button type="button" aria-expanded={expanded} aria-label={`${expanded?'Collapse':'Expand'} ${row.code}`} onClick={event=>{event.stopPropagation();toggle();}} className="block max-w-sm text-left focus-visible:outline-2 focus-visible:outline-[#007A52] dark:focus-visible:outline-[#009966]"><span className="block truncate font-semibold"><span className="mr-2 inline-block rounded-sm border border-[#D4DBD7] bg-[#EFF2F0] px-1 font-mono text-[10px] dark:border-[#343A3F] dark:bg-[#25292C]">{row.code}</span>{row.title}</span><span className="block truncate text-[11px] text-muted-foreground">{row.context}</span></button></td>
      <td className="px-3 py-1.5"><CarezStatus tone={row.tone} label={row.status}/></td><td className="px-3 py-1.5 font-mono tabular-nums">{row.date||'—'}</td><td className="px-3 py-1.5 text-right"><span className="font-mono font-semibold tabular-nums">{row.figure}</span><span className="block text-[10px] text-muted-foreground">{row.figureLabel}</span></td><td className="px-2 py-1.5"><ChevronDown aria-hidden="true" className={`size-4 transition-transform motion-reduce:transition-none ${expanded?'rotate-180':''}`}/></td>
    </tr>
    {expanded&&<tr><td colSpan={5} className="p-0"><motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} transition={{duration:reducedMotion?0:.18}} className="overflow-hidden"><div className="border-y border-[#D4DBD7] bg-[#F5F7F6] p-6 shadow-inner dark:border-[#343A3F] dark:bg-[#121212]"><div className="grid gap-6 lg:grid-cols-3"><div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Record</h3><p className="mt-2 text-base font-semibold">{row.title}</p><p className="mt-1 text-sm text-muted-foreground">{row.context}</p></div><div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operational pulse</h3><dl className="mt-2 divide-y divide-[#D4DBD7]/50 text-xs dark:divide-[#343A3F]/50">{row.details.map(item=><div key={item.label} className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">{item.label}</dt><dd className="text-right font-mono tabular-nums">{item.value}</dd></div>)}</dl>{row.progress&&row.progress.total>0&&<div className="mt-4"><div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground"><span>{row.progress.label}</span><span className="font-mono tabular-nums">{row.progress.valueLabel}</span></div><div role="progressbar" aria-label={row.progress.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.max(0,row.progress.used/row.progress.total*100))} className="h-1.5 overflow-hidden rounded-full bg-[#E6EAE8] dark:bg-[#2D3236]"><div className={`h-full ${row.progress.used>row.progress.total?'bg-[#B84558] dark:bg-[#E06B74]':'bg-[#007A52] dark:bg-[#009966]'}`} style={{width:`${Math.min(100,Math.max(0,row.progress.used/row.progress.total*100))}%`}}/></div></div>}</div><div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next action</h3><p className="mt-2 text-xs text-muted-foreground">Open the owning workflow for details and changes.</p><Link href={row.href} className="mt-3 inline-flex rounded-md bg-[#007A52] px-3 py-2 text-xs font-semibold text-white hover:bg-[#009966] dark:bg-[#009966] dark:text-[#121212] dark:hover:bg-[#00AD73]">{row.actionLabel}</Link></div></div></div></motion.div></td></tr>}
  </>;
}
