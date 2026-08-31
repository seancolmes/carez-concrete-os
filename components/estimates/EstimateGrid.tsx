'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CheckSquare,ExternalLink,Search,Square,X} from 'lucide-react';

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

function interactiveTarget(target:EventTarget|null){
  const element=target as HTMLElement|null;
  return Boolean(element?.closest('a,button,input,select,textarea,summary'));
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
      event.preventDefault();
      setActiveIndex(index=>Math.min(index+1,Math.max(visibleRows.length-1,0)));
      return;
    }
    if(event.key==='ArrowUp'){
      event.preventDefault();
      setActiveIndex(index=>Math.max(index-1,0));
      return;
    }
    if(event.key==='Home'){
      event.preventDefault();setActiveIndex(0);return;
    }
    if(event.key==='End'){
      event.preventDefault();setActiveIndex(Math.max(visibleRows.length-1,0));return;
    }
    const activeRow=visibleRows[activeIndex];
    if(!activeRow)return;
    if(event.key===' '){event.preventDefault();toggleRow(activeRow.id);return;}
    if(event.key==='Enter'){event.preventDefault();router.push(activeRow.estimateHref);return;}
    if(event.key==='Escape'){setSelectedIds(new Set());}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();toggleAllVisible();}
  }

  const allVisibleSelected=visibleRows.length>0&&visibleRows.every(row=>selectedIds.has(row.id));
  const inspected=rows.find(row=>row.id===inspectedId)||null;

  return <div className="estimate-workbench-layout"><div ref={shellRef} className="industrial-grid-shell estimate-grid-shell" tabIndex={0} onKeyDown={handleKeyDown} aria-label="Estimate workbench grid">
    <div className="industrial-grid-toolbar">
      <label className="industrial-grid-search"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search estimate, job, or project" aria-label="Search estimates"/></label>
      <div className="industrial-filter-group" aria-label="Estimate status filter">
        <button type="button" className={`industrial-filter-button ${stage==='all'?'active safety-orange':''}`} onClick={()=>setStage('all')}>All {rows.length}</button>
        {stageOrder.map(value=>{
          const count=rows.filter(row=>row.stage===value).length;
          return <button key={value} type="button" className={`industrial-filter-button ${stage===value?'active safety-orange':''}`} onClick={()=>setStage(value)}>{stageLabels[value]} {count}</button>;
        })}
      </div>
      <div className="industrial-grid-toolbar-spacer"/>
      <span className="industrial-grid-selection">{selectedIds.size} selected · ↑↓ move · Space select · Enter open</span>
    </div>

    <div className="industrial-grid-scroll">
      <table className="industrial-grid-table estimate-grid-table">
        <thead><tr>
          <th className="freeze-select center"><button type="button" className={`industrial-row-check ${allVisibleSelected?'selected':''}`} onClick={toggleAllVisible} aria-label={allVisibleSelected?'Clear visible estimate selection':'Select all visible estimates'}>{allVisibleSelected?<CheckSquare size={14}/>:<Square size={14}/>}</button></th>
          <th className="freeze-primary">Estimate</th>
          <th className="freeze-secondary">Description / Job</th>
          <th style={{width:92}}>Stage</th>
          <th className="numeric" style={{width:82}}>Takeoff</th>
          <th className="numeric" style={{width:76}}>Holds</th>
          <th className="numeric" style={{width:112}}>Direct Cost</th>
          <th className="numeric" style={{width:112}}>Quote</th>
          <th className="numeric" style={{width:92}}>Margin</th>
          <th className="numeric" style={{width:82}}>Target</th>
          <th style={{width:92}}>Updated</th>
          <th style={{width:188}}>Actions</th>
        </tr></thead>
        <tbody>{visibleRows.length===0?<tr><td colSpan={12} style={{height:72,textAlign:'center',color:'var(--muted)'}}>No estimates match the current filter.</td></tr>:visibleRows.map((row,index)=>{
          const selected=selectedIds.has(row.id),active=index===activeIndex,marginLow=row.projectedMargin<row.targetMargin;
          return <tr key={row.id} data-grid-index={index} className={`${active?'is-active':''} ${selected?'is-selected':''}`} aria-selected={selected} onClick={()=>{setActiveIndex(index);setInspectedId(row.id)}} onDoubleClick={()=>router.push(row.estimateHref)}>
            <td className="freeze-select center"><button type="button" className={`industrial-row-check ${selected?'selected':''}`} onClick={event=>{event.stopPropagation();toggleRow(row.id);}} aria-label={selected?`Clear ${row.displayNumber} selection`:`Select ${row.displayNumber}`}>{selected?<CheckSquare size={14}/>:<Square size={14}/>}</button></td>
            <td className="freeze-primary"><Link className="industrial-grid-link" href={row.estimateHref}>{row.displayNumber}</Link></td>
            <td className="freeze-secondary"><span className="industrial-grid-primary">{row.name}</span><span className="industrial-grid-secondary">{row.projectNumber?`Job ${row.projectNumber} · ${row.projectName||'Project'}`:'New opportunity / no job yet'}</span></td>
            <td><span className={`grid-status ${row.stage}`}>{row.stageLabel}</span></td>
            <td className="numeric">{row.takeoffObjects?`${row.takeoffObjects} obj`:'—'}</td>
            <td className={`numeric ${row.priceHolds?'warning-text':''}`}>{row.priceHolds}</td>
            <td className="numeric">{money(row.directCost)}</td>
            <td className="numeric"><strong>{money(row.quote)}</strong></td>
            <td className={`numeric ${marginLow?'warning-text':'success-text'}`}>{row.projectedMargin.toFixed(1)}%</td>
            <td className="numeric muted">{row.targetMargin.toFixed(1)}%</td>
            <td className="muted">{date(row.updatedAt)}</td>
            <td><div className="industrial-grid-actions"><Link className="industrial-grid-action primary" href={row.estimateHref}>Open <ExternalLink size={11}/></Link>{row.secondaryHref&&row.secondaryLabel&&<Link className="industrial-grid-action" href={row.secondaryHref}>{row.secondaryLabel}</Link>}</div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    <div className="industrial-grid-statusbar"><span>{visibleRows.length} visible of {rows.length}</span><span>{selectedIds.size} selected</span><span>Frozen estimate and project columns remain visible while scrolling.</span></div>
  </div><aside className="estimate-inspector" aria-label="Selected estimate inspector">{inspected?<><button className="estimate-inspector-close" type="button" onClick={()=>setInspectedId(null)} aria-label="Close estimate inspector"><X size={14}/></button><div className="section-kicker">ESTIMATE REVISION</div><strong>{inspected.displayNumber}</strong><p>{inspected.name}</p><div className="estimate-inspector-grid"><span>Stage<b>{inspected.stageLabel}</b></span><span>Takeoff<b>{inspected.takeoffObjects} obj</b></span><span>Direct Cost<b>{money(inspected.directCost)}</b></span><span>Sell<b>{money(inspected.quote)}</b></span><span>Margin<b>{inspected.projectedMargin.toFixed(1)}%</b></span><span>Target<b>{inspected.targetMargin.toFixed(1)}%</b></span><span>Holds<b>{inspected.priceHolds}</b></span><span>Updated<b>{date(inspected.updatedAt)}</b></span></div><Link className="button" href={inspected.estimateHref}>Open Estimate <ExternalLink size={13}/></Link></>:<div className="estimate-inspector-empty">Select an estimate to inspect its authoritative pricing summary and available actions.</div>}</aside></div>;
}
