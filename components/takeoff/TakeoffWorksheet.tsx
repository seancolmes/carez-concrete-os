'use client';

import {useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {AlertTriangle,ChevronDown,ChevronUp,GripHorizontal,Search,Table2} from 'lucide-react';
import {updateTakeoffOutputPrice} from '@/app/takeoff/actions';
import {CarezEmptyState,CarezProvenance,CarezStatus} from '@/components/carez/state';
import {
  WORKSHEET_VIEWS,
  type SpecialistWorksheetModel,
  type SpecialistWorksheetView,
} from '@/lib/takeoff/specialistWorksheet';
import styles from './TakeoffWorksheet.module.css';

type Props={
  model:SpecialistWorksheetModel;
  takeoffSetId:string;
  currentSheetId:string|null;
  selectedMeasurementId:string|null;
  selectedConditionVersionId:string|null;
  locked:boolean;
  onSelectedMeasurementChange:(measurementId:string|null)=>void;
  onSelectedConditionVersionChange:(conditionVersionId:string|null)=>void;
};

type GridRow={
  id:string;
  measurementId?:string|null;
  conditionVersionId?:string|null;
  sheetId?:string|null;
  search:string;
  cells:ReactNode[];
};

type Column={label:string;width:number;min:number};

const ROW_HEIGHT=36;
const STORAGE_PREFIX='carez.takeoff.specialistWorksheet.columns.v1';
const money=(value:number|null)=>value===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
const qty=(value:number|null,digits=2)=>value===null?'—':Number(value).toLocaleString('en-US',{maximumFractionDigits:digits});
const humanize=(value:string)=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());

const COLUMNS:Record<SpecialistWorksheetView,Column[]>={
  quantities:[
    {label:'Measurement',width:220,min:150},{label:'Condition',width:170,min:120},{label:'Role',width:140,min:105},
    {label:'Section',width:150,min:105},{label:'Sheet',width:100,min:78},{label:'Quantity',width:120,min:90},{label:'State',width:130,min:100},
  ],
  resources:[
    {label:'Resource',width:230,min:150},{label:'Condition',width:170,min:120},{label:'Class',width:110,min:80},
    {label:'Quantity',width:120,min:90},{label:'Cost source',width:190,min:120},{label:'Catalog',width:150,min:110},{label:'State',width:130,min:100},
  ],
  labor:[
    {label:'Labor',width:230,min:150},{label:'Condition',width:170,min:120},{label:'Production basis',width:150,min:105},
    {label:'Man-hours',width:110,min:85},{label:'Pricing',width:140,min:105},{label:'State',width:130,min:100},
  ],
  pricing:[
    {label:'Output',width:230,min:150},{label:'Condition',width:170,min:120},{label:'Quantity',width:125,min:90},
    {label:'Unit cost',width:115,min:88},{label:'Direct cost',width:120,min:92},{label:'Pricing',width:145,min:110},
    {label:'Source',width:180,min:120},{label:'Estimate lineage',width:160,min:110},{label:'Override',width:190,min:150},
  ],
  holds:[
    {label:'Condition',width:180,min:120},{label:'Issue',width:170,min:110},{label:'Message',width:360,min:200},{label:'Destination',width:140,min:100},
  ],
  recap:[
    {label:'Metric',width:230,min:150},{label:'Value',width:180,min:120},{label:'State',width:220,min:140},
  ],
};

function statusNode(state:string){
  const normalized=String(state||'unknown').toLowerCase();
  const tone=normalized.includes('ready')||normalized.includes('priced')||normalized.includes('complete')
    ?'success'
    :normalized.includes('held')||normalized.includes('required')||normalized.includes('pending')||normalized.includes('partial')
      ?'warning'
      :'neutral';
  return <CarezStatus tone={tone} label={humanize(state)}/>;
}

function conditionLabel(code:string|null,name:string|null){
  return [code,name].filter(Boolean).join(' · ')||'Unlinked';
}

export function TakeoffWorksheet({
  model,
  takeoffSetId,
  currentSheetId,
  selectedMeasurementId,
  selectedConditionVersionId,
  locked,
  onSelectedMeasurementChange,
  onSelectedConditionVersionChange,
}:Props){
  const bodyRef=useRef<HTMLDivElement|null>(null);
  const heightDragRef=useRef<{y:number;height:number}|null>(null);
  const columnDragRef=useRef<{index:number;x:number;width:number}|null>(null);
  const [view,setView]=useState<SpecialistWorksheetView>('quantities');
  const [scope,setScope]=useState<'sheet'|'all'>('sheet');
  const [query,setQuery]=useState('');
  const [height,setHeight]=useState(244);
  const [collapsed,setCollapsed]=useState(false);
  const [scrollTop,setScrollTop]=useState(0);
  const [viewportHeight,setViewportHeight]=useState(160);
  const [columnWidths,setColumnWidths]=useState<number[]>(()=>COLUMNS.quantities.map(column=>column.width));

  const conditionSheetIds=useMemo(()=>{
    const map=new Map<string,Set<string>>();
    for(const row of model.quantities){
      if(!row.conditionVersionId||!row.sheetId)continue;
      const ids=map.get(row.conditionVersionId)||new Set<string>();
      ids.add(row.sheetId);
      map.set(row.conditionVersionId,ids);
    }
    return map;
  },[model.quantities]);

  useEffect(()=>{
    const defaults=COLUMNS[view].map(column=>column.width);
    try{
      const saved=localStorage.getItem(`${STORAGE_PREFIX}:${view}`);
      const parsed=saved?JSON.parse(saved):null;
      setColumnWidths(Array.isArray(parsed)&&parsed.length===defaults.length
        ?parsed.map((value,index)=>Math.max(COLUMNS[view][index].min,Math.min(520,Number(value)||defaults[index])))
        :defaults);
    }catch{
      setColumnWidths(defaults);
    }
    setScrollTop(0);
  },[view]);

  useEffect(()=>{
    try{localStorage.setItem(`${STORAGE_PREFIX}:${view}`,JSON.stringify(columnWidths));}catch{}
  },[columnWidths,view]);

  useEffect(()=>{
    const move=(event:PointerEvent)=>{
      if(heightDragRef.current){
        const delta=heightDragRef.current.y-event.clientY;
        setHeight(Math.max(150,Math.min(window.innerHeight*.62,heightDragRef.current.height+delta)));
      }
      if(columnDragRef.current){
        const {index,x,width}=columnDragRef.current;
        const next=Math.max(COLUMNS[view][index].min,Math.min(520,width+event.clientX-x));
        setColumnWidths(current=>current.map((value,currentIndex)=>currentIndex===index?next:value));
      }
    };
    const up=()=>{
      heightDragRef.current=null;
      columnDragRef.current=null;
      document.body.style.cursor='';
      document.body.style.userSelect='';
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};
  },[view]);

  useEffect(()=>{
    const body=bodyRef.current;
    if(!body)return;
    const update=()=>setViewportHeight(body.clientHeight);
    update();
    const observer=new ResizeObserver(update);
    observer.observe(body);
    return()=>observer.disconnect();
  },[collapsed,view]);

  const rows=useMemo<GridRow[]>(()=>{
    if(view==='quantities'){
      return model.quantities.map(row=>({
        id:row.id,measurementId:row.measurementId,conditionVersionId:row.conditionVersionId,sheetId:row.sheetId,
        search:[row.name,row.location,row.conditionCode,row.conditionName,row.roleKey,row.section,row.sheet,row.unit,row.state].filter(Boolean).join(' ').toLowerCase(),
        cells:[
          <span className={styles.primaryCell} key="name"><strong>{row.name}</strong><small>{row.location||'No location'}</small></span>,
          conditionLabel(row.conditionCode,row.conditionName),
          row.roleKey?humanize(row.roleKey):'Legacy takeoff',
          row.section,
          row.sheet,
          <span className={styles.numeric} key="quantity">{qty(row.quantity)} {row.unit}</span>,
          statusNode(row.state),
        ],
      }));
    }
    if(view==='resources'){
      return model.resources.map(row=>({
        id:row.id,conditionVersionId:row.conditionVersionId,
        search:[row.label,row.conditionCode,row.conditionName,row.resourceClass,row.outputKey,row.costSource,row.catalogReference,row.state].filter(Boolean).join(' ').toLowerCase(),
        cells:[
          <span className={styles.primaryCell} key="resource"><strong>{row.label}</strong><small>{row.outputKey}</small></span>,
          conditionLabel(row.conditionCode,row.conditionName),
          humanize(row.resourceClass),
          <span className={styles.numeric} key="quantity">{qty(row.quantity)} {row.unit}</span>,
          row.costSource||'—',
          row.catalogReference||'—',
          statusNode(row.state),
        ],
      }));
    }
    if(view==='labor'){
      return model.labor.map(row=>({
        id:row.id,conditionVersionId:row.conditionVersionId,
        search:[row.label,row.conditionCode,row.conditionName,row.outputKey,row.productionUnit,row.pricingState,row.state].filter(Boolean).join(' ').toLowerCase(),
        cells:[
          <span className={styles.primaryCell} key="labor"><strong>{row.label}</strong><small>{row.outputKey}</small></span>,
          conditionLabel(row.conditionCode,row.conditionName),
          <span className={styles.numeric} key="basis">{qty(row.productionQuantity)} {row.productionUnit}</span>,
          <span className={styles.numeric} key="mh">{qty(row.estimatedManHours)} MH</span>,
          statusNode(row.pricingState),
          statusNode(row.state),
        ],
      }));
    }
    if(view==='pricing'){
      return model.pricing.map(row=>{
        const override=!locked&&row.legacyTakeoffOutputId
          ?<form action={updateTakeoffOutputPrice} className={styles.overrideForm} onClick={event=>event.stopPropagation()} key="override">
            <span>$</span>
            <input aria-label={`Direct cost unit price for ${row.label}`} name="unit_cost" type="number" min="0" step="0.01" inputMode="decimal" required placeholder="0.00"/>
            <input type="hidden" name="output_id" value={row.legacyTakeoffOutputId}/>
            <input type="hidden" name="takeoff_set_id" value={takeoffSetId}/>
            <button type="submit">Save</button>
          </form>
          :<span key="override" className={styles.muted}>{locked?'Locked':'—'}</span>;
        return{
          id:row.id,conditionVersionId:row.conditionVersionId,
          search:[row.label,row.conditionCode,row.conditionName,row.outputKey,row.pricingState,row.costSource,row.catalogReference,row.generatedEstimateItemId].filter(Boolean).join(' ').toLowerCase(),
          cells:[
            <span className={styles.primaryCell} key="output"><strong>{row.label}</strong><small>{row.outputKey}</small></span>,
            conditionLabel(row.conditionCode,row.conditionName),
            <span className={styles.numeric} key="quantity">{qty(row.productionQuantity)} {row.productionUnit}</span>,
            <span className={styles.numeric} key="unit-cost">{money(row.unitCost)}</span>,
            <span className={styles.numeric} key="direct-cost">{money(row.directCost)}</span>,
            statusNode(row.pricingState),
            row.costSource
              ?<CarezProvenance key="source" label="Source" summary={row.costSource}/>
              :<span key="source">—</span>,
            row.generatedEstimateItemId?<span className={styles.mono} key="lineage">{row.generatedEstimateItemId}</span>:<span key="lineage">—</span>,
            override,
          ],
        };
      });
    }
    if(view==='holds'){
      return model.holds.map(row=>({
        id:row.id,conditionVersionId:row.conditionVersionId,
        search:[row.conditionCode,row.conditionName,row.code,row.message,row.destination.view].filter(Boolean).join(' ').toLowerCase(),
        cells:[
          conditionLabel(row.conditionCode,row.conditionName),
          <span className={styles.warningText} key="issue"><AlertTriangle size={12}/>{humanize(row.code)}</span>,
          row.message,
          humanize(row.destination.view),
        ],
      }));
    }

    const recapRows:GridRow[]=[
      {id:'measurements',search:'measurements',cells:['Measurements',String(model.recap.measurementCount),statusNode('ready')]},
      {id:'conditions',search:'conditions',cells:['Conditions',String(model.recap.conditionCount),statusNode(model.recap.pendingConditions?'pending':'ready')]},
      {id:'man-hours',search:'man hours labor',cells:['Estimated man-hours',`${qty(model.recap.estimatedManHours)} MH`,statusNode('ready')]},
      {id:'direct-cost',search:'direct cost',cells:['Direct cost',money(model.recap.directCost),statusNode(model.recap.directCostComplete?'complete':'partial')]},
      {id:'holds',search:'holds issues',cells:['Open issues',String(model.recap.openHolds),statusNode(model.recap.openHolds?'held':'ready')]},
      ...model.recap.quantitiesByUnit.map(entry=>({
        id:`quantity-${entry.unit}`,
        search:`quantity ${entry.unit}`.toLowerCase(),
        cells:[`Measured quantity · ${entry.unit}`,qty(entry.quantity),statusNode('ready')],
      })),
    ];
    return recapRows;
  },[view,model,locked,takeoffSetId]);

  const filteredRows=useMemo(()=>{
    const search=query.trim().toLowerCase();
    return rows.filter(row=>{
      const sheetMatch=scope==='all'||!currentSheetId
        ||row.sheetId===currentSheetId
        ||Boolean(row.conditionVersionId&&conditionSheetIds.get(row.conditionVersionId)?.has(currentSheetId))
        ||view==='recap';
      return sheetMatch&&(!search||row.search.includes(search));
    });
  },[rows,scope,currentSheetId,conditionSheetIds,query,view]);

  const columns=COLUMNS[view];
  const gridWidth=columnWidths.reduce((sum,width)=>sum+width,0);
  const gridStyle={gridTemplateColumns:columnWidths.map(width=>`${width}px`).join(' '),minWidth:gridWidth} as CSSProperties;
  const overscan=5;
  const start=Math.max(0,Math.floor(scrollTop/ROW_HEIGHT)-overscan);
  const count=Math.ceil(viewportHeight/ROW_HEIGHT)+overscan*2;
  const visibleRows=filteredRows.slice(start,start+count);

  const chooseRow=(row:GridRow)=>{
    if(row.measurementId)onSelectedMeasurementChange(row.measurementId);
    if(row.conditionVersionId)onSelectedConditionVersionChange(row.conditionVersionId);
  };

  return <section
    className={`${styles.dock} ${collapsed?styles.collapsed:''}`}
    style={{height:collapsed?38:height}}
    aria-label="Quantity / Estimate Worksheet"
    data-view={view}
    data-current-sheet-id={currentSheetId||''}
  >
    {!collapsed?<button type="button" className={styles.resizeHandle} aria-label="Resize Quantity / Estimate Worksheet" onPointerDown={event=>{
      heightDragRef.current={y:event.clientY,height};
      document.body.style.cursor='ns-resize';
      document.body.style.userSelect='none';
      event.currentTarget.setPointerCapture(event.pointerId);
    }}><GripHorizontal size={15}/></button>:null}

    <header className={styles.header}>
      <div className={styles.title}><Table2 size={15}/><strong>Quantity / Estimate Worksheet</strong><span>{filteredRows.length} row{filteredRows.length===1?'':'s'}</span></div>
      {!collapsed?<>
        <div className={styles.views} role="tablist" aria-label="Worksheet view">
          {WORKSHEET_VIEWS.map(item=><button key={item} type="button" role="tab" aria-selected={view===item} className={view===item?styles.active:''} onClick={()=>setView(item)}>{humanize(item)}</button>)}
        </div>
        <div className={styles.scope} aria-label="Worksheet scope">
          <button type="button" className={scope==='sheet'?styles.active:''} onClick={()=>setScope('sheet')}>This Sheet</button>
          <button type="button" className={scope==='all'?styles.active:''} onClick={()=>setScope('all')}>All Sheets</button>
        </div>
        <label className={styles.search}><Search size={13}/><span className="sr-only">Filter worksheet</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Filter worksheet"/></label>
        <div className={styles.summary}>
          <span><b>{qty(model.recap.estimatedManHours)}</b> MH</span>
          <span><b>{money(model.recap.directCost)}</b> direct{model.recap.directCostComplete?'':' partial'}</span>
          {model.recap.openHolds?<span className={styles.warningText}><AlertTriangle size={12}/><b>{model.recap.openHolds}</b> issue{model.recap.openHolds===1?'':'s'}</span>:null}
        </div>
      </>:null}
      <button type="button" className={styles.collapse} aria-expanded={!collapsed} onClick={()=>setCollapsed(value=>!value)}>{collapsed?<ChevronUp size={15}/>:<ChevronDown size={15}/>}<span>{collapsed?'Open':'Collapse'}</span></button>
    </header>

    {!collapsed?<div className={styles.grid} role="table" aria-rowcount={filteredRows.length}>
      <div className={`${styles.gridRow} ${styles.gridHeader}`} role="row" style={gridStyle}>
        {columns.map((column,index)=><span role="columnheader" key={column.label}>{column.label}<button
          type="button"
          className={styles.columnResizeHandle}
          aria-label={`Resize ${column.label} column`}
          title="Drag to resize · double-click to reset"
          onDoubleClick={event=>{
            event.preventDefault();event.stopPropagation();
            setColumnWidths(current=>current.map((width,currentIndex)=>currentIndex===index?column.width:width));
          }}
          onPointerDown={event=>{
            event.preventDefault();event.stopPropagation();
            columnDragRef.current={index,x:event.clientX,width:columnWidths[index]};
            document.body.style.cursor='col-resize';
            document.body.style.userSelect='none';
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
        /></span>)}
      </div>
      <div ref={bodyRef} className={styles.body} onScroll={event=>setScrollTop(event.currentTarget.scrollTop)}>
        {!filteredRows.length
          ?<CarezEmptyState title="No worksheet rows" description="No records match this view, sheet scope, and filter." className={styles.empty}/>
          :<div className={styles.virtual} style={{height:filteredRows.length*ROW_HEIGHT,minWidth:gridWidth}}>
            <div style={{transform:`translateY(${start*ROW_HEIGHT}px)`}}>
              {visibleRows.map((row,index)=>{
                const selected=Boolean(
                  (row.measurementId&&row.measurementId===selectedMeasurementId)
                  ||(row.conditionVersionId&&row.conditionVersionId===selectedConditionVersionId),
                );
                return <div
                  role="row"
                  tabIndex={0}
                  aria-rowindex={start+index+2}
                  aria-selected={selected}
                  key={row.id}
                  className={`${styles.gridRow} ${styles.dataRow} ${selected?styles.selected:''}`}
                  style={gridStyle}
                  onClick={()=>chooseRow(row)}
                  onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseRow(row);}}}
                >
                  {row.cells.map((cell,cellIndex)=><span role="cell" key={cellIndex}>{cell}</span>)}
                </div>;
              })}
            </div>
          </div>}
      </div>
    </div>:null}
  </section>;
}
