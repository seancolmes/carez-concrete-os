'use client';

import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import { ChevronRightRegular as ChevronRight } from '@fluentui/react-icons';
import {Badge,Button,Input} from '@fluentui/react-components';
import type {CarezStatusTone} from '@/lib/ui/state';

export type OpportunityGridRow={key:string;leadId:string|null;estimateId:string|null;number:string;name:string;customer:string;stage:string;bidDue:string|null;takeoff:string;estimate:string;value:number|null};

const PAGE_SIZE=25;
const money=(value:number|null)=>value===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
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
      <table className="w-full min-w-[880px] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-secondary text-muted-foreground"><tr className="border-b border-border"><th className="px-3 py-2 font-semibold">Opportunity / customer</th><th className="px-3 py-2 font-semibold">Stage</th><th className="px-3 py-2 font-semibold">Bid due</th><th className="px-3 py-2 font-semibold">Takeoff</th><th className="px-3 py-2 font-semibold">Estimate</th><th className="px-3 py-2 text-right font-semibold">Open value</th><th className="w-8 px-2 py-2"><span className="sr-only">View bid</span></th></tr></thead>
        <tbody>{visibleRows.length===0?<tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{rows.length?'No matching opportunities.':'No opportunities or estimate bids are recorded yet.'}</td></tr>:pageRows.map(row=><OpportunityRow key={row.key} row={row} selected={selectedKey===row.key} onOpen={()=>open(row)}/>)}</tbody>
      </table>
    </div>
    {pageCount>1?<div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-3 py-1.5 text-xs text-muted-foreground"><Button type="button" appearance="outline" size="small" disabled={currentPage===1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Previous</Button><span aria-live="polite">Page {currentPage} of {pageCount}</span><Button type="button" appearance="outline" size="small" disabled={currentPage===pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>Next</Button></div>:null}
  </div>;
}

function OpportunityRow({row,selected,onOpen}:{row:OpportunityGridRow;selected:boolean;onOpen:()=>void}){
  return <tr onClick={onOpen} aria-selected={selected} className={selected?'cursor-pointer border-b border-border bg-accent/70 text-foreground':'cursor-pointer border-b border-border text-foreground hover:bg-accent/50'}>
    <td className="max-w-80 px-3 py-1.5"><Button type="button" appearance="subtle" aria-label={'View bid for '+row.name} onClick={event=>{event.stopPropagation();onOpen();}} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const target=event.key==='ArrowDown'?event.currentTarget.closest('tr')?.nextElementSibling:event.currentTarget.closest('tr')?.previousElementSibling;target?.querySelector('button')?.focus();}}} className="max-w-full text-left"><span className="block truncate font-semibold"><span className="mr-2 inline-block rounded-sm border border-border bg-secondary px-1 font-mono text-[10px]">{row.number}</span>{row.name}</span><span className="block truncate text-[11px] text-muted-foreground">{row.customer}</span></Button></td>
    <td className="px-3 py-1.5"><Badge appearance="tint" color={badgeColor(row.stage)}>{row.stage}</Badge></td><td className="px-3 py-1.5 font-mono tabular-nums">{date(row.bidDue)}</td><td className="px-3 py-1.5"><Badge appearance="tint" color={badgeColor(row.takeoff)}>{row.takeoff}</Badge></td><td className="px-3 py-1.5 font-mono tabular-nums">{row.estimate}</td><td className="px-3 py-1.5 text-right font-mono tabular-nums">{money(row.value)}</td><td className="px-2 py-1.5"><ChevronRight className="size-4" aria-hidden="true"/></td>
  </tr>;
}

const badgeColor=(value:string)=>{const tone=statusTone(value);return tone==='error'?'danger':tone==='warning'?'warning':tone==='success'?'success':'informative';};
