'use client';

import {useState} from 'react';
import Link from 'next/link';
import {GripVertical} from 'lucide-react';
import {CarezDataGrid,CarezDataGridBody,CarezDataGridCell,CarezDataGridHead,CarezDataGridHeaderCell,CarezDataGridRow,CarezDataGridTable,CarezStatus} from '@/components/carez';

export type TodayOperation={id:string;time:string;project:string;operation:string;quantity:string;status:string;tone:'success'|'blocked'|'neutral';href:string};
const columns=['time','project','operation','quantity','status'] as const;
type Column=typeof columns[number];
const label:Record<Column,string>={time:'Time',project:'Project',operation:'Operation',quantity:'Quantity',status:'Status'};

export function TodayOperationsGrid({operations}:{operations:TodayOperation[]}){
  const [order,setOrder]=useState<Column[]>([...columns]);
  const [dragged,setDragged]=useState<Column|null>(null);
  const move=(over:Column)=>{if(!dragged||dragged===over)return;setOrder(current=>{const next=[...current];next.splice(next.indexOf(over),0,next.splice(next.indexOf(dragged),1)[0]);return next;});setDragged(null);};
  if(!operations.length)return <div className="flex min-h-24 items-center gap-3 rounded-md border border-border bg-muted/35 px-4 py-4 text-sm"><span className="grid size-8 shrink-0 place-items-center rounded-sm bg-background text-primary"><GripVertical aria-hidden="true" className="size-4"/></span><span><span className="block font-semibold">No active operations</span><span className="mt-0.5 block text-xs text-muted-foreground">Today&apos;s schedule is clear.</span></span></div>;
  const cell=(row:TodayOperation,column:Column)=>{
    if(column==='project')return <Link href={row.href} className="font-semibold hover:text-primary">{row.project}</Link>;
    if(column==='operation')return <span className="text-muted-foreground">{row.operation}</span>;
    if(column==='status')return <CarezStatus tone={row.tone} label={row.status}/>;
    return <span className={column==='quantity'?'font-mono tabular-nums':''}>{row[column]}</span>;
  };
  return <CarezDataGrid className="rounded-md border-border bg-muted/20"><CarezDataGridTable><CarezDataGridHead><CarezDataGridRow>{order.map(column=><CarezDataGridHeaderCell key={column} draggable onDragStart={()=>setDragged(column)} onDragOver={event=>event.preventDefault()} onDrop={()=>move(column)} className={column==='quantity'?'text-right max-sm:hidden':column==='status'?'text-right':''}><span className="inline-flex items-center gap-1"><GripVertical aria-hidden="true" className="size-3 cursor-grab text-muted-foreground/0 transition-colors group-hover/row:text-muted-foreground/60 group-focus-within/row:text-muted-foreground"/>{label[column]}</span></CarezDataGridHeaderCell>)}</CarezDataGridRow></CarezDataGridHead><CarezDataGridBody>{operations.map(row=><CarezDataGridRow key={row.id} className="group/row transition-colors hover:bg-muted/50">{order.map(column=><CarezDataGridCell key={column} numeric={column==='quantity'} className={column==='quantity'?'max-sm:hidden':column==='status'?'text-right':''}>{cell(row,column)}</CarezDataGridCell>)}</CarezDataGridRow>)}</CarezDataGridBody></CarezDataGridTable></CarezDataGrid>;
}
