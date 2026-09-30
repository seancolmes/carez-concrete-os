'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {OpenRegular as ExternalLink,SearchRegular as Search} from '@fluentui/react-icons';
import {Badge,Button,Checkbox,DrawerBody,DrawerHeader,DrawerHeaderTitle,Input,OverlayDrawer,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow,Tab,TabList} from '@fluentui/react-components';
import {cn} from '@/lib/utils';

export type EstimateGridStage='working'|'ready'|'issued'|'awarded'|'history';

export type EstimateGridRow={
  id:string;
  displayNumber:string;
  name:string;
  projectNumber:string|null;
  projectName:string|null;
  stage:EstimateGridStage;
  stageLabel:string;
  takeoffObjects:number;
  priceHolds:number;
  directCost:number;
  quote:number;
  projectedMargin:number;
  targetMargin:number;
  updatedAt:string|null;
  estimateHref:string;
  secondaryHref:string|null;
  secondaryLabel:string|null;
};

const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0));
const date=(value:string|null)=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'2-digit'}).format(new Date(value)):'—';
const stageOrder:EstimateGridStage[]=['working','ready','issued','awarded','history'];
const stageLabels:Record<EstimateGridStage,string>={working:'Pricing',ready:'Ready',issued:'Issued',awarded:'Awarded',history:'History'};
const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';

function interactiveTarget(target:EventTarget|null){
  const element=target as HTMLElement|null;
  return Boolean(element?.closest('a,button,input,select,textarea,summary,[role=checkbox]'));
}

function StageBadge({stage,label}:{stage:EstimateGridStage;label:string}){
  if(stage==='awarded')return <Badge appearance="tint" className="bg-success/10 text-success">{label}</Badge>;
  if(stage==='ready')return <Badge appearance="tint" className="bg-primary/10 text-primary">{label}</Badge>;
  if(stage==='issued')return <Badge appearance="outline">{label}</Badge>;
  if(stage==='history')return <Badge appearance="tint" className="text-muted-foreground">{label}</Badge>;
  return <Badge appearance="filled">{label}</Badge>;
}

export function EstimateGrid({rows}:{rows:EstimateGridRow[]}){
  const router=useRouter();
  const shellRef=useRef<HTMLDivElement|null>(null);
  const [query,setQuery]=useState('');
  const [stage,setStage]=useState<'all'|EstimateGridStage>('all');
  const [activeIndex,setActiveIndex]=useState(0);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(()=>new Set());
  const [inspectedId,setInspectedId]=useState<string|null>(null);

  const visibleRows=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    return rows.filter(row=>{
      if(stage!=='all'&&row.stage!==stage)return false;
      if(!normalized)return true;
      return [row.displayNumber,row.name,row.projectNumber,row.projectName,row.stageLabel]
        .some(value=>String(value||'').toLowerCase().includes(normalized));
    });
  },[rows,query,stage]);

  useEffect(()=>{
    setActiveIndex(index=>Math.max(0,Math.min(index,Math.max(visibleRows.length-1,0))));
  },[visibleRows.length]);

  useEffect(()=>{
    const activeRow=shellRef.current?.querySelector<HTMLTableRowElement>(`tr[data-grid-index="${activeIndex}"]`);
    activeRow?.scrollIntoView({block:'nearest'});
  },[activeIndex]);

  function toggleRow(id:string){
    setSelectedIds(current=>{
      const next=new Set(current);
      if(next.has(id))next.delete(id);else next.add(id);
      return next;
    });
  }

  function toggleAllVisible(){
    setSelectedIds(current=>{
      const next=new Set(current);
      const allVisibleSelected=visibleRows.length>0&&visibleRows.every(row=>next.has(row.id));
      for(const row of visibleRows){if(allVisibleSelected)next.delete(row.id);else next.add(row.id);}
      return next;
    });
  }

  function handleKeyDown(event:React.KeyboardEvent<HTMLDivElement>){
    if(interactiveTarget(event.target))return;
    if(event.key==='ArrowDown'){
      event.preventDefault();setActiveIndex(index=>Math.min(index+1,Math.max(visibleRows.length-1,0)));return;
    }
    if(event.key==='ArrowUp'){
      event.preventDefault();setActiveIndex(index=>Math.max(index-1,0));return;
    }
    if(event.key==='Home'){event.preventDefault();setActiveIndex(0);return;}
    if(event.key==='End'){event.preventDefault();setActiveIndex(Math.max(visibleRows.length-1,0));return;}
    const activeRow=visibleRows[activeIndex];
    if(!activeRow)return;
    if(event.key===' '){event.preventDefault();toggleRow(activeRow.id);return;}
    if(event.key==='Enter'){event.preventDefault();router.push(activeRow.estimateHref);return;}
    if(event.key==='Escape'){setSelectedIds(new Set());setInspectedId(null);}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();toggleAllVisible();}
  }

  const allVisibleSelected=visibleRows.length>0&&visibleRows.every(row=>selectedIds.has(row.id));
  const inspected=rows.find(row=>row.id===inspectedId)||null;

  return <div className="space-y-3">
    <div ref={shellRef} tabIndex={0} onKeyDown={handleKeyDown} className="min-w-0 overflow-hidden border-y border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring/30" aria-label="Estimate workbench grid">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative min-w-64 flex-1 lg:max-w-md"><Input appearance="underline" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search estimate, job, or project" aria-label="Search estimates" contentBefore={<Search className="size-3.5 text-muted-foreground"/>} className="h-8 text-xs"/></div>
        <TabList selectedValue={stage} onTabSelect={(_,data)=>setStage(data.value as 'all'|EstimateGridStage)} className="min-h-8 flex-wrap">
            <Tab value="all" className="px-2 text-xs">All <span className="text-muted-foreground">{rows.length}</span></Tab>
            {stageOrder.map(value=>{
              const count=rows.filter(row=>row.stage===value).length;
              return <Tab key={value} value={value} className="px-2 text-xs">{stageLabels[value]} <span className="text-muted-foreground">{count}</span></Tab>;
            })}
        </TabList>
        <div className="ml-auto hidden text-xs text-muted-foreground xl:block">{selectedIds.size} selected · ↑↓ move · Space select · Enter open</div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground"><span>{visibleRows.length} visible of {rows.length}</span><span className="hidden md:inline">{selectedIds.size} selected</span></div>

      {visibleRows.length===0?<div className="flex min-h-64 flex-col items-center justify-center gap-2 p-6 text-center"><Search fontSize={24} aria-hidden="true"/><h3 className="text-sm font-semibold">No estimates match this view</h3><p className="text-xs text-muted-foreground">Change the search or stage filter to see other estimate revisions.</p></div>:
        <><div className="hidden overflow-x-auto md:block"><Table>
          <TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHeaderCell className="w-10"><Checkbox checked={allVisibleSelected} onChange={toggleAllVisible} aria-label={allVisibleSelected?'Clear visible estimate selection':'Select all visible estimates'}/></TableHeaderCell>
            <TableHeaderCell>Estimate</TableHeaderCell>
            <TableHeaderCell className="min-w-64">Description / job</TableHeaderCell>
            <TableHeaderCell>Stage</TableHeaderCell>
            <TableHeaderCell className="text-right">Takeoff</TableHeaderCell>
            <TableHeaderCell className="text-right">Holds</TableHeaderCell>
            <TableHeaderCell className="text-right">Direct cost</TableHeaderCell>
            <TableHeaderCell className="text-right">Quote</TableHeaderCell>
            <TableHeaderCell className="text-right">Margin</TableHeaderCell>
            <TableHeaderCell className="text-right">Target</TableHeaderCell>
            <TableHeaderCell>Updated</TableHeaderCell>
            <TableHeaderCell className="min-w-40">Actions</TableHeaderCell>
          </TableRow></TableHeader>
          <TableBody>{visibleRows.map((row,index)=>{
            const selected=selectedIds.has(row.id),active=index===activeIndex,marginLow=row.projectedMargin<row.targetMargin;
            return <TableRow key={row.id} data-grid-index={index} data-state={selected?'selected':undefined} className={cn('cursor-pointer',active&&'ring-1 ring-inset ring-foreground/20')} aria-selected={selected} onClick={()=>{setActiveIndex(index);setInspectedId(row.id)}} onDoubleClick={()=>router.push(row.estimateHref)}>
              <TableCell onClick={event=>event.stopPropagation()}><Checkbox checked={selected} onChange={()=>toggleRow(row.id)} aria-label={selected?`Clear ${row.displayNumber} selection`:`Select ${row.displayNumber}`}/></TableCell>
              <TableCell><Link className="font-mono text-xs font-semibold text-foreground hover:underline" href={row.estimateHref}>{row.displayNumber}</Link></TableCell>
              <TableCell><div className="font-medium">{row.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{row.projectNumber?`Job ${row.projectNumber} · ${row.projectName||'Project'}`:'New opportunity / no job yet'}</div></TableCell>
              <TableCell><StageBadge stage={row.stage} label={row.stageLabel}/></TableCell>
              <TableCell className="carez-data-number text-right">{row.takeoffObjects?`${row.takeoffObjects} obj`:'—'}</TableCell>
              <TableCell className={cn('carez-data-number text-right',row.priceHolds&&'text-warning')}>{row.priceHolds}</TableCell>
              <TableCell className="carez-data-number text-right">{money(row.directCost)}</TableCell>
              <TableCell className="carez-data-number text-right font-semibold">{money(row.quote)}</TableCell>
              <TableCell className={cn('carez-data-number text-right font-medium',marginLow?'text-warning':'text-success')}>{row.projectedMargin.toFixed(1)}%</TableCell>
              <TableCell className="carez-data-number text-right text-muted-foreground">{row.targetMargin.toFixed(1)}%</TableCell>
              <TableCell className="text-xs text-muted-foreground">{date(row.updatedAt)}</TableCell>
              <TableCell onClick={event=>event.stopPropagation()}><div className="flex items-center gap-1.5"><Link className={primaryLinkClass} href={row.estimateHref}>Open<ExternalLink/></Link>{row.secondaryHref&&row.secondaryLabel?<Link className={secondaryLinkClass} href={row.secondaryHref}>{row.secondaryLabel}</Link>:null}</div></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table></div><div className="divide-y md:hidden">{visibleRows.map(row=><div key={row.id} className="grid gap-2 px-3 py-2"><div className="flex items-center justify-between gap-2"><strong className="font-mono text-xs">{row.displayNumber}</strong><StageBadge stage={row.stage} label={row.stageLabel}/></div><div className="min-w-0"><strong className="block truncate text-sm">{row.name}</strong><span className="block truncate text-xs text-muted-foreground">{row.projectNumber?`Job ${row.projectNumber} · ${row.projectName||'Project'}`:'New opportunity / no job yet'}</span></div><div className="flex items-center justify-between gap-3 text-xs"><span className="font-mono tabular-nums">{money(row.quote)} quote · {row.projectedMargin.toFixed(1)}% margin</span><span className={row.priceHolds?'text-warning':'text-muted-foreground'}>{row.priceHolds} holds</span></div><div className="flex gap-2"><Link className={primaryLinkClass} href={row.estimateHref}>Open estimate</Link><Button type="button" appearance="outline" size="small" onClick={()=>setInspectedId(row.id)}>View details</Button></div></div>)}</div></>}
    </div>

    <OverlayDrawer open={Boolean(inspected)} onOpenChange={(_,data)=>{if(!data.open)setInspectedId(null)}} position="end" size="medium">
      {inspected?<><DrawerHeader><DrawerHeaderTitle>{inspected.displayNumber}</DrawerHeaderTitle><p className="text-xs text-muted-foreground">{inspected.name}</p></DrawerHeader><DrawerBody className="overflow-y-auto">
        <div className="space-y-5 px-4 pb-6">
          <section className="space-y-2"><div className="text-xs font-semibold text-muted-foreground">Pricing summary</div><dl className="divide-y rounded-lg border">
            <InspectorRow label="Stage"><StageBadge stage={inspected.stage} label={inspected.stageLabel}/></InspectorRow>
            <InspectorRow label="Takeoff"><span className="carez-data-number">{inspected.takeoffObjects} obj</span></InspectorRow>
            <InspectorRow label="Direct cost"><span className="carez-data-number">{money(inspected.directCost)}</span></InspectorRow>
            <InspectorRow label="Sell"><span className="carez-data-number">{money(inspected.quote)}</span></InspectorRow>
            <InspectorRow label="Margin"><span className={cn('carez-data-number',inspected.projectedMargin<inspected.targetMargin?'text-warning':'text-success')}>{inspected.projectedMargin.toFixed(1)}%</span></InspectorRow>
            <InspectorRow label="Target"><span className="carez-data-number">{inspected.targetMargin.toFixed(1)}%</span></InspectorRow>
            <InspectorRow label="Price holds"><span className={cn('carez-data-number',inspected.priceHolds&&'text-warning')}>{inspected.priceHolds}</span></InspectorRow>
            <InspectorRow label="Updated"><span>{date(inspected.updatedAt)}</span></InspectorRow>
          </dl></section>
          <div className="flex flex-wrap gap-2"><Link className={primaryLinkClass} href={inspected.estimateHref}>Open estimate<ExternalLink/></Link>{inspected.secondaryHref&&inspected.secondaryLabel?<Link className={secondaryLinkClass} href={inspected.secondaryHref}>{inspected.secondaryLabel}</Link>:null}</div>
        </div>
      </DrawerBody></>:null}
    </OverlayDrawer>
  </div>;
}

function InspectorRow({label,children}:{label:string;children:React.ReactNode}){
  return <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 px-3 py-2.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="min-w-0 text-right text-xs font-medium">{children}</dd></div>;
}
