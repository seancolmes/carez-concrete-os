'use client';

import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import { ChevronRightRegular as ChevronRight } from '@fluentui/react-icons';
import {Badge,Button,Input} from '@fluentui/react-components';
import type {CarezStatusTone} from '@/lib/ui/state';
import {opportunityValuePresentation,type OpportunityValue} from './opportunity-value';

export type OpportunityGridRow={key:string;leadId:string|null;estimateId:string|null;number:string;name:string;customer:string;stage:string;bidDue:string|null;takeoff:string;estimate:string}&OpportunityValue;

const PAGE_SIZE=25;
const date=(value:string|null)=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value)):'—';
const statusTone=(value:string):CarezStatusTone=>/hold|blocked|lost|declined|overdue/i.test(value)?'error':/attention|review|pending/i.test(value)?'warning':/ready|won|awarded|complete|sent/i.test(value)?'success':/not started/i.test(value)?'neutral':'info';

export function OpportunitiesGrid({rows,selectedKey}:{rows:OpportunityGridRow[];selectedKey:string|null}){
  const router=useRouter();
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const visibleRows=useMemo(()=>{const term=search.trim().toLowerCase();return term?rows.filter(row=>[row.number,row.name,row.customer,row.stage,row.estimate].some(value=>value.toLowerCase().includes(term))):rows;},[rows,search]);
  const pageCount=Math.max(1,Math.ceil(visibleRows.length/PAGE_SIZE));
  const currentPage=Math.min(page,pageCount);
  const pageRows=visibleRows.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  const open=(row:OpportunityGridRow)=>{
    const query=row.leadId?'lead='+encodeURIComponent(row.leadId):'estimate='+encodeURIComponent(row.estimateId||'');
    router.push('/opportunities?'+query+'&section=overview',{scroll:false});
  };

  return <div className="flex min-w-0 flex-col overflow-hidden border border-border bg-card">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2"><label className="sr-only" htmlFor="opportunity-search">Search opportunities</label><Input appearance="underline" id="opportunity-search" value={search} onChange={(_,data)=>{setSearch(data.value);setPage(1);}} placeholder="Search opportunities, customers, bids…" className="w-full max-w-sm"/><span className="text-xs text-muted-foreground">{visibleRows.length} {visibleRows.length===1?'bid':'bids'}</span></div>
    <div className="max-h-[min(65vh,44rem)] overflow-auto">
      <div role="list" aria-label="Opportunity bids" className="divide-y divide-border md:hidden">
        {visibleRows.length===0?<p className="px-4 py-10 text-center text-sm text-muted-foreground">{rows.length?'No matching opportunities.':'No opportunities or estimate bids are recorded yet.'}</p>:pageRows.map(row=><OpportunityPhoneRow key={row.key} row={row} selected={selectedKey===row.key} onOpen={()=>open(row)}/>)}
      </div>
      <table className="hidden w-full min-w-[880px] border-collapse text-left text-xs md:table">
        <thead className="sticky top-0 z-10 bg-secondary text-muted-foreground"><tr className="border-b border-border"><th className="w-[36%] px-3 py-2 font-semibold">Opportunity / customer</th><th className="px-3 py-2 font-semibold">Stage</th><th className="px-3 py-2 font-semibold">Bid due</th><th className="px-3 py-2 font-semibold">Takeoff</th><th className="px-3 py-2 font-semibold">Estimate</th><th className="px-3 py-2 text-right font-semibold">Bid / lead value</th><th className="w-8 px-2 py-2"><span className="sr-only">View bid</span></th></tr></thead>
        <tbody>{visibleRows.length===0?<tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{rows.length?'No matching opportunities.':'No opportunities or estimate bids are recorded yet.'}</td></tr>:pageRows.map(row=><OpportunityRow key={row.key} row={row} selected={selectedKey===row.key} onOpen={()=>open(row)}/>)}</tbody>
      </table>
    </div>
    {pageCount>1?<div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-3 py-1.5 text-xs text-muted-foreground"><Button type="button" appearance="outline" size="small" disabled={currentPage===1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Previous</Button><span aria-live="polite">Page {currentPage} of {pageCount}</span><Button type="button" appearance="outline" size="small" disabled={currentPage===pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>Next</Button></div>:null}
  </div>;
}

function OpportunityRow({row,selected,onOpen}:{row:OpportunityGridRow;selected:boolean;onOpen:()=>void}){
  return <tr onClick={onOpen} aria-selected={selected} className={selected?'cursor-pointer border-b border-border bg-accent/70 text-foreground':'cursor-pointer border-b border-border text-foreground hover:bg-accent/50'}>
    <td className="w-[36%] px-3 py-1.5"><Button type="button" appearance="subtle" aria-label={'View bid for '+row.name} onClick={event=>{event.stopPropagation();onOpen();}} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const target=event.key==='ArrowDown'?event.currentTarget.closest('tr')?.nextElementSibling:event.currentTarget.closest('tr')?.previousElementSibling;target?.querySelector('button')?.focus();}}} className="!h-auto !max-w-full !justify-start !whitespace-normal !text-left"><span className="flex min-w-0 flex-col items-start gap-0.5"><span className="rounded-sm border border-border bg-secondary px-1 font-mono text-[10px]">{row.number}</span><span className="max-w-full break-words font-semibold [overflow-wrap:anywhere]">{row.name}</span><span className="max-w-full break-words text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{row.customer}</span></span></Button></td>
    <td className="px-3 py-1.5"><Badge appearance="tint" color={badgeColor(row.stage)}>{row.stage}</Badge></td><td className="px-3 py-1.5 font-mono tabular-nums">{date(row.bidDue)}</td><td className="px-3 py-1.5"><Badge appearance="tint" color={badgeColor(row.takeoff)}>{row.takeoff}</Badge></td><td className="px-3 py-1.5 font-mono tabular-nums">{row.estimate}</td><td className="max-w-64 px-3 py-1.5 text-right"><BidLeadValue value={row}/></td><td className="px-2 py-1.5"><ChevronRight className="size-4" aria-hidden="true"/></td>
  </tr>;
}

function OpportunityPhoneRow({row,selected,onOpen}:{row:OpportunityGridRow;selected:boolean;onOpen:()=>void}){
  return <div role="listitem" className={selected?'bg-accent/70':'hover:bg-accent/50'}>
    <Button type="button" appearance="subtle" aria-label={'View bid for '+row.name} aria-current={selected?'true':undefined} onClick={onOpen} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const item=event.currentTarget.closest('[role="listitem"]');const target=event.key==='ArrowDown'?item?.nextElementSibling:item?.previousElementSibling;target?.querySelector('button')?.focus();}}} className="!flex !h-auto !w-full !min-w-0 !flex-col !items-stretch !justify-start !gap-0 !rounded-none !px-3 !py-3 !text-left">
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{row.number}</span>
        <span className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{row.name}</span>
        <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{row.customer}</span>
      </span>
      <span className="mt-3 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-2 text-xs">
        <span className="min-w-0"><span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Stage</span><Badge appearance="tint" color={badgeColor(row.stage)}>{row.stage}</Badge></span>
        <span className="min-w-0"><span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Bid due</span><span className="font-mono tabular-nums text-foreground">{date(row.bidDue)}</span></span>
        <span className="min-w-0"><span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Takeoff</span><Badge appearance="tint" color={badgeColor(row.takeoff)}>{row.takeoff}</Badge></span>
        <span className="min-w-0"><span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Estimate</span><span className="block font-mono tabular-nums text-foreground [overflow-wrap:anywhere]">{row.estimate}</span></span>
      </span>
      <span className="mt-2 block min-w-0 border-t border-border pt-2 text-xs"><span className="mb-1 block text-muted-foreground">Bid / lead value</span><BidLeadValue value={row}/></span>
    </Button>
  </div>;
}

export function BidLeadValue({value}:{value:OpportunityValue}){
  const presentation=opportunityValuePresentation(value);
  return <span className="block min-w-0 space-y-1 whitespace-normal [overflow-wrap:anywhere]">
    <span className="block font-mono font-semibold tabular-nums text-foreground">{presentation.amount}</span>
    <span className="block text-[11px] text-muted-foreground">{presentation.basis}</span>
    {presentation.guidance?<span className="block text-[11px] text-muted-foreground">{presentation.guidance}</span>:null}
    {presentation.summaryWarning?<span className="block text-[11px] text-warning">{presentation.summaryWarning}</span>:null}
  </span>;
}

const badgeColor=(value:string)=>{const tone=statusTone(value);return tone==='error'?'danger':tone==='warning'?'warning':tone==='success'?'success':'informative';};
