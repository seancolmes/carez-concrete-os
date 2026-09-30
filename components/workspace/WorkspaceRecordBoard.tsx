'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {ChevronDownRegular,SearchRegular} from '@fluentui/react-icons';
import {motion,useReducedMotion} from 'framer-motion';
import {Badge,Button,Input,ProgressBar,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow} from '@fluentui/react-components';
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

  return <section aria-label={title} className="surface-card mb-3 min-w-0 overflow-hidden rounded-sm">
    <div className="industrial-header flex flex-wrap items-center justify-between gap-3 p-3"><div><h2 className="text-sm font-bold tracking-tight">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Input appearance="underline" aria-label={`Search ${title.toLowerCase()}`} value={search} onChange={(_,data)=>setSearch(data.value)} placeholder="Search records" contentBefore={<SearchRegular aria-hidden="true"/>} className="min-w-48"/></div>
    <div className="overflow-x-auto"><Table className="w-full min-w-[680px] text-left text-xs"><TableHeader className="industrial-header text-muted-foreground"><TableRow><TableHeaderCell className="px-3 py-2 font-semibold">Record</TableHeaderCell><TableHeaderCell className="px-3 py-2 font-semibold">State</TableHeaderCell><TableHeaderCell className="px-3 py-2 font-semibold">Date</TableHeaderCell><TableHeaderCell className="px-3 py-2 text-right font-semibold">Figure</TableHeaderCell><TableHeaderCell className="w-10 px-2 py-2"><span className="sr-only">Expand</span></TableHeaderCell></TableRow></TableHeader><TableBody>{visible.length===0?<TableRow><TableCell colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{rows.length?'No records match the search.':empty}</TableCell></TableRow>:visible.map(row=><RecordRow key={row.id} row={row} expanded={expanded===row.id} toggle={()=>toggle(row.id)} reducedMotion={Boolean(reducedMotion)}/>)}</TableBody></Table></div>
  </section>;
}

function RecordRow({row,expanded,toggle,reducedMotion}:{row:WorkspaceRecordRow;expanded:boolean;toggle:()=>void;reducedMotion:boolean}){
  return <>
    <TableRow className={`tabular-row cursor-pointer transition-colors ${expanded?'font-semibold':''}`} onClick={toggle}>
      <TableCell className="px-3 py-1.5"><Button type="button" appearance="subtle" aria-expanded={expanded} aria-label={`${expanded?'Collapse':'Expand'} ${row.code}`} onClick={event=>{event.stopPropagation();toggle();}} className="max-w-sm text-left"><span className="block truncate font-semibold"><span className="mr-2 inline-block rounded-sm border border-border bg-secondary px-1 font-mono text-[10px] ">{row.code}</span>{row.title}</span><span className="block truncate text-[11px] text-muted-foreground">{row.context}</span></Button></TableCell>
      <TableCell className="px-3 py-1.5"><Badge appearance="tint" color={row.tone==='error'?'danger':row.tone==='success'?'success':row.tone==='warning'?'warning':'informative'}>{row.status}</Badge></TableCell><TableCell className="px-3 py-1.5 font-mono tabular-nums">{row.date||'—'}</TableCell><TableCell className="px-3 py-1.5 text-right"><span className="font-mono font-semibold tabular-nums">{row.figure}</span><span className="block text-[10px] text-muted-foreground">{row.figureLabel}</span></TableCell><TableCell className="px-2 py-1.5"><ChevronDownRegular aria-hidden="true" className={`size-4 transition-transform motion-reduce:transition-none ${expanded?'rotate-180':''}`}/></TableCell>
    </TableRow>
    {expanded&&<TableRow><TableCell colSpan={5} className="p-0"><motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} transition={{duration:reducedMotion?0:.18}} className="overflow-hidden"><div className="border-y border-border bg-muted/30 p-4"><div className="grid gap-4 lg:grid-cols-3"><div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Record</h3><p className="mt-2 text-base font-semibold">{row.title}</p><p className="mt-1 text-sm text-muted-foreground">{row.context}</p></div><div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operational pulse</h3><dl className="mt-2 divide-y divide-border text-xs">{row.details.map(item=><div key={item.label} className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">{item.label}</dt><dd className="text-right font-mono tabular-nums">{item.value}</dd></div>)}</dl>{row.progress&&row.progress.total>0&&<div className="mt-4"><div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground"><span>{row.progress.label}</span><span className="font-mono tabular-nums">{row.progress.valueLabel}</span></div><ProgressBar aria-label={row.progress.label} value={Math.min(1,Math.max(0,row.progress.used/row.progress.total))} color={row.progress.used>row.progress.total?'error':'warning'}/></div>}</div><div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next action</h3><p className="mt-2 text-xs text-muted-foreground">Open the owning workflow for details and changes.</p><Link href={row.href} className={secondaryLinkClass}>{row.actionLabel}</Link></div></div></div></motion.div></TableCell></TableRow>}
  </>;
}

const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
