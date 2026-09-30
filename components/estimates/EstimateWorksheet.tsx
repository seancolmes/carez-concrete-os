'use client';

import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Badge,Button,Dropdown,Input,Option,Tooltip} from '@fluentui/react-components';
import {ArrowDownloadRegular,SearchRegular} from '@fluentui/react-icons';
import {
  assignTakeoffMeasurementSection,
  updateGeneratedEstimateItemPrice,
  updateManualEstimateCell,
} from '@/app/estimates/actions';
import type {ManualEstimateField} from '@/lib/estimating/manualEstimateCell';
import {formatTakeoffMeasurement} from '@/lib/takeoff/lengthFormat';
import {getWorksheetLineQuantity,getWorksheetPricingLabel,getWorksheetPricingState} from '@/lib/estimating/worksheet';
import styles from './EstimateWorksheet.module.css';

type Section={id:string;name:string;scope_type?:string|null;sort_order?:number|null};
type Measurement={
  id:string;name:string;location?:string|null;drawing_reference?:string|null;
  raw_quantity?:number|string|null;raw_unit?:string|null;estimate_section_id?:string|null;
  created_at?:string|null;
};
type EstimateItem={
  id:string;section_id?:string|null;item_type?:string|null;description?:string|null;
  quantity?:number|string|null;unit?:string|null;unit_cost?:number|string|null;
  direct_cost?:number|string|null;regular_hours?:number|string|null;overtime_hours?:number|string|null;
  source_takeoff_measurement_id?:string|null;source_takeoff_output_id?:string|null;
  sort_order?:number|null;created_at?:string|null;
};
type TakeoffOutput={
  id:string;measurement_id:string;generated_estimate_item_id?:string|null;label?:string|null;
  pricing_status?:string|null;cost_source?:string|null;price_source_kind?:string|null;
  price_source_label?:string|null;price_source_reference?:string|null;price_effective_date?:string|null;
  baseline_man_hours_per_unit?:number|string|null;baseline_source?:string|null;
};
type SortOrder='scope'|'name'|'cost';

const money=(value:unknown)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));
const decimal=(value:unknown)=>Number(value||0).toLocaleString('en-US',{maximumFractionDigits:3});
const sortLabels:Record<SortOrder,string>={scope:'Scope order',name:'Condition A–Z',cost:'Direct cost, high to low'};

function clearCostFocus(){
  const url=new URL(window.location.href);
  if(!url.searchParams.has('costOutput'))return;
  url.searchParams.delete('costOutput');
  window.history.replaceState(null,'',url);
}

function EditableCell({
  value,display,label,onCommit,numeric=false,disabled=false,autoEdit=false,onDone,
}:{
  value:string;display:string;label:string;onCommit:(value:string)=>Promise<void>;
  numeric?:boolean;disabled?:boolean;autoEdit?:boolean;onDone?:()=>void;
}){
  const [editing,setEditing]=useState(autoEdit&&!disabled);
  const [draft,setDraft]=useState(value);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const committing=useRef(false);
  const cancelled=useRef(false);

  useEffect(()=>{if(autoEdit&&!disabled){setEditing(true);setDraft(value);}},[autoEdit,disabled,value]);
  useEffect(()=>{if(!editing)setDraft(value);},[value,editing]);

  const commit=async()=>{
    if(committing.current||cancelled.current)return;
    if(draft.trim()===value.trim()){setEditing(false);onDone?.();return;}
    committing.current=true;
    setPending(true);
    setError('');
    try{
      await onCommit(draft);
      setEditing(false);
      onDone?.();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Could not save this cell.');
    }finally{
      setPending(false);
      committing.current=false;
    }
  };

  if(disabled)return <span className={numeric?styles.numericCell:styles.readonlyCell} title="This value is governed by Takeoff or labor review.">{display}</span>;
  if(editing)return <div className={styles.editCell}>
    <Input
      appearance="underline" size="small" autoFocus aria-label={label} aria-invalid={Boolean(error)}
      className={numeric?styles.numericInput:styles.textInput}
      value={draft} onChange={(_,data)=>setDraft(data.value)}
      disabled={pending}
      onKeyDown={event=>{
        if(event.key==='Enter'){event.preventDefault();void commit();}
        if(event.key==='Escape'){event.preventDefault();cancelled.current=true;setError('');setDraft(value);setEditing(false);onDone?.();}
      }}
      onBlur={()=>{if(!cancelled.current)void commit();}}
    />
    {error?<span role="alert" className={styles.cellError}>{error}</span>:null}
  </div>;
  const beginEdit=()=>{cancelled.current=false;setDraft(value);setError('');setEditing(true);};
  return <span
    role="button" tabIndex={0} className={numeric?styles.numericTrigger:styles.textTrigger}
    aria-label={`Edit ${label}`} title={`Edit ${label}`}
    onClick={beginEdit}
    onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();beginEdit();}}}
  >{display}</span>;
}

function LedgerRow({
  estimateId,item,output,locked,autoEditCost,onCostDone,
}:{
  estimateId:string;item:EstimateItem;output?:TakeoffOutput;locked:boolean;autoEditCost:boolean;onCostDone:()=>void;
}){
  const router=useRouter();
  const {quantity,unit}=getWorksheetLineQuantity(item);
  const generated=Boolean(item.source_takeoff_measurement_id||item.source_takeoff_output_id||output);
  const manualEditable=!locked&&!generated&&String(item.item_type||'').toLowerCase()!=='labor';
  const priceEditable=!locked&&(manualEditable||Boolean(output));
  const pricingState=getWorksheetPricingState(item,output);
  const description=output?.label||item.description||'Estimate line';
  const source=output?.price_source_label||output?.cost_source||'Manual estimate line';
  const provenance=[source,output?.price_source_reference,output?.price_effective_date].filter(Boolean).join(' · ');
  const saveManual=async(field:ManualEstimateField,value:string)=>{
    await updateManualEstimateCell(estimateId,item.id,field,value);
    router.refresh();
  };
  const savePrice=async(value:string)=>{
    if(output){
      const form=new FormData();
      form.set('estimate_id',estimateId);
      form.set('output_id',output.id);
      form.set('unit_cost',value);
      await updateGeneratedEstimateItemPrice(form);
    }else{
      await updateManualEstimateCell(estimateId,item.id,'unit_cost',value);
    }
    router.refresh();
  };
  return <div role="row" className={styles.row} data-pricing={pricingState}>
    <div role="cell" className={styles.description}>
      <EditableCell value={item.description||''} display={description} label={`description for ${description}`} disabled={!manualEditable} onCommit={value=>saveManual('description',value)}/>
      <div className={styles.lineMeta}><Badge appearance="outline" size="small">{String(item.item_type||'cost')}</Badge><Tooltip content={provenance} relationship="description"><span>{provenance}</span></Tooltip><span data-state={pricingState}>{getWorksheetPricingLabel(pricingState)}</span></div>
    </div>
    <div role="cell" className={styles.cell}>
      <EditableCell value={String(quantity)} display={decimal(quantity)} label={`quantity for ${description}`} numeric disabled={!manualEditable} onCommit={value=>saveManual('quantity',value)}/>
    </div>
    <div role="cell" className={styles.cell}>
      <EditableCell value={unit} display={unit||'—'} label={`unit for ${description}`} disabled={!manualEditable} onCommit={value=>saveManual('unit',value)}/>
    </div>
    <div role="cell" className={styles.cell}>
      <EditableCell value={String(Number(item.unit_cost||0))} display={money(item.unit_cost)} label={`unit cost for ${description}`} numeric disabled={!priceEditable} autoEdit={autoEditCost} onDone={onCostDone} onCommit={savePrice}/>
    </div>
    <div role="cell" className={styles.extension} title="Saved server-calculated direct cost">{money(item.direct_cost)}</div>
  </div>;
}

export function EstimateWorksheet({
  estimateId,sections,measurements,items,outputs,locked,
}:{
  estimateId:string;sections:Section[];measurements:Measurement[];
  items:EstimateItem[];outputs:TakeoffOutput[];locked:boolean;
}){
  const router=useRouter();
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState<SortOrder>('scope');
  const [focusOutputId,setFocusOutputId]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('costOutput');
    const output=outputs.find(row=>row.id===id);
    const item=output?.generated_estimate_item_id?items.find(row=>row.id===output.generated_estimate_item_id):null;
    if(!output||!item)return;
    setQuery(item.description||output.label||'');
    setFocusOutputId(output.id);
  },[outputs,items]);

  const ledger=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase();
    const sectionMap=new Map(sections.map(section=>[section.id,section]));
    const sectionOrder=new Map(sections.map((section,index)=>[section.id,Number(section.sort_order??index)]));
    const outputByItem=new Map(outputs.filter(output=>output.generated_estimate_item_id).map(output=>[output.generated_estimate_item_id!,output]));
    const generatedByMeasurement=new Map<string,EstimateItem[]>();
    const manualBySection=new Map<string,EstimateItem[]>();
    for(const item of items){
      if(item.source_takeoff_measurement_id){
        const rows=generatedByMeasurement.get(item.source_takeoff_measurement_id)||[];
        rows.push(item);generatedByMeasurement.set(item.source_takeoff_measurement_id,rows);
      }else{
        const key=item.section_id||'unassigned';
        const rows=manualBySection.get(key)||[];
        rows.push(item);manualBySection.set(key,rows);
      }
    }
    const measurementGroups=measurements
      .filter(measurement=>(generatedByMeasurement.get(measurement.id)||[]).length>0)
      .sort((first,second)=>{
        if(sort==='name')return first.name.localeCompare(second.name);
        if(sort==='cost'){
          const cost=(row:Measurement)=>(generatedByMeasurement.get(row.id)||[]).reduce((sum,item)=>sum+Number(item.direct_cost||0),0);
          return cost(second)-cost(first)||first.name.localeCompare(second.name);
        }
        return (sectionOrder.get(first.estimate_section_id||'')??999999)-(sectionOrder.get(second.estimate_section_id||'')??999999)||first.name.localeCompare(second.name);
      })
      .filter(measurement=>!term||[
        measurement.name,measurement.location,measurement.drawing_reference,
        sectionMap.get(measurement.estimate_section_id||'')?.name,
        ...(generatedByMeasurement.get(measurement.id)||[]).map(item=>item.description),
      ].some(value=>String(value||'').toLocaleLowerCase().includes(term)));
    const assemblyGroups=[...new Set(measurementGroups.map(row=>row.estimate_section_id||'unassigned'))]
      .map(sectionId=>{
        const grouped=measurementGroups.filter(row=>(row.estimate_section_id||'unassigned')===sectionId);
        const lines=grouped.flatMap(row=>generatedByMeasurement.get(row.id)||[]);
        return {sectionId,name:sectionMap.get(sectionId)?.name||'Unassigned scope',measurements:grouped,lines,cost:lines.reduce((sum,item)=>sum+Number(item.direct_cost||0),0)};
      }).sort((first,second)=>sort==='name'?first.name.localeCompare(second.name):sort==='cost'?second.cost-first.cost:(sectionOrder.get(first.sectionId)??999999)-(sectionOrder.get(second.sectionId)??999999));
    const manualGroups=[...manualBySection.entries()]
      .sort(([first],[second])=>(sectionOrder.get(first)??999999)-(sectionOrder.get(second)??999999))
      .map(([sectionId,rows])=>({sectionId,name:sectionMap.get(sectionId)?.name||'Unassigned / General',lines:rows.filter(item=>!term||[sectionMap.get(sectionId)?.name,item.description,item.item_type].some(value=>String(value||'').toLocaleLowerCase().includes(term)))}))
      .filter(group=>group.lines.length>0);
    const visibleLines=[...assemblyGroups.flatMap(group=>group.lines),...manualGroups.flatMap(group=>group.lines)];
    return {sectionMap,outputByItem,generatedByMeasurement,assemblyGroups,manualGroups,visibleLines};
  },[items,measurements,outputs,query,sections,sort]);

  const assignSection=async(measurementId:string,sectionId:string)=>{
    setMessage('');
    const form=new FormData();
    form.set('estimate_id',estimateId);
    form.set('measurement_id',measurementId);
    form.set('section_id',sectionId==='__unassigned'?'':sectionId);
    try{await assignTakeoffMeasurementSection(form);router.refresh();}
    catch(cause){setMessage(cause instanceof Error?cause.message:'Could not change this scope.');}
  };
  const finishCostEdit=()=>{clearCostFocus();setFocusOutputId(null);};

  const exportVisible=()=>{
    const columns=['Assembly','Condition','Cost line','Type','Quantity','Unit','Unit cost','Direct cost','Pricing status'];
    const records=[
      ...ledger.assemblyGroups.flatMap(group=>group.measurements.flatMap(measurement=>(ledger.generatedByMeasurement.get(measurement.id)||[]).map(item=>{
        const output=ledger.outputByItem.get(item.id);
        const {quantity,unit}=getWorksheetLineQuantity(item);
        return [group.name,measurement.name,output?.label||item.description||'',item.item_type||'',quantity,unit,item.unit_cost||0,item.direct_cost||0,getWorksheetPricingLabel(getWorksheetPricingState(item,output))];
      }))),
      ...ledger.manualGroups.flatMap(group=>group.lines.map(item=>{
        const {quantity,unit}=getWorksheetLineQuantity(item);
        return [group.name,'Manual costs',item.description||'',item.item_type||'',quantity,unit,item.unit_cost||0,item.direct_cost||0,'MANUAL'];
      })),
    ];
    const csv=[columns,...records].map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download=`estimate-${estimateId}-lines.csv`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  };

  if(items.length===0)return <div className={styles.shell}><div className={styles.empty}>No estimate cost lines yet. Start with Takeoff so assemblies can generate the cost structure.</div></div>;

  return <section className={styles.shell} aria-label="Estimate calculation ledger">
    <div className={styles.toolbar}>
      <Input appearance="underline" size="small" type="search" contentBefore={<SearchRegular/>} value={query} onChange={(_,data)=>setQuery(data.value)} placeholder="Find assembly, condition, or line" aria-label="Search estimate lines"/>
      <Dropdown size="small" aria-label="Sort estimate lines" value={sortLabels[sort]} selectedOptions={[sort]} onOptionSelect={(_,data)=>setSort(data.optionValue as SortOrder)}>
        <Option value="scope">Scope order</Option><Option value="name">Condition A–Z</Option><Option value="cost">Direct cost, high to low</Option>
      </Dropdown>
      <span className={styles.resultCount}>{ledger.assemblyGroups.length+ledger.manualGroups.length} assemblies · {ledger.visibleLines.length} lines</span>
      <Button type="button" size="small" appearance="subtle" icon={<ArrowDownloadRegular/>} onClick={exportVisible} disabled={!ledger.visibleLines.length}>Export CSV</Button>
    </div>
    <div role="table" className={styles.table} aria-label="Estimate line items">
      <div className={styles.scroller} role="rowgroup">
        <div role="row" className={styles.header}><span role="columnheader">Description</span><span role="columnheader">Qty</span><span role="columnheader">Unit</span><span role="columnheader">Unit cost</span><span role="columnheader">Line extension</span></div>
        {ledger.assemblyGroups.map(group=><Fragment key={group.sectionId}>
          <div className={styles.assemblyHead}><strong>{group.name}</strong><span>{group.measurements.length} conditions · {group.lines.length} lines</span><b>{money(group.cost)}</b></div>
          {group.measurements.map(measurement=>{
            const rows=ledger.generatedByMeasurement.get(measurement.id)||[];
            const sectionId=measurement.estimate_section_id||'__unassigned';
            return <Fragment key={measurement.id}>
              <div className={styles.measurementHead}>
                <div><strong>{measurement.name}</strong><span>{[measurement.location,measurement.drawing_reference].filter(Boolean).join(' · ')||formatTakeoffMeasurement(measurement.raw_quantity,measurement.raw_unit)}</span></div>
                {locked?<span>{ledger.sectionMap.get(sectionId)?.name||'Unassigned scope'}</span>:
                  <Dropdown size="small" aria-label={`Scope section for ${measurement.name}`} value={ledger.sectionMap.get(sectionId)?.name||'Unassigned scope'} selectedOptions={[sectionId]} onOptionSelect={(_,data)=>void assignSection(measurement.id,data.optionValue||'__unassigned')}>
                    <Option value="__unassigned">Unassigned scope</Option>
                    {sections.map(section=><Option key={section.id} value={section.id}>{section.name}</Option>)}
                  </Dropdown>}
              </div>
              {rows.map(item=><LedgerRow key={item.id} estimateId={estimateId} item={item} output={ledger.outputByItem.get(item.id)} locked={locked} autoEditCost={ledger.outputByItem.get(item.id)?.id===focusOutputId} onCostDone={finishCostEdit}/>)}
            </Fragment>;
          })}
        </Fragment>)}
        {ledger.manualGroups.map(group=><Fragment key={`manual-${group.sectionId}`}>
          <div className={styles.assemblyHead}><strong>{group.name} · Manual costs</strong><span>{group.lines.length} lines</span><b>{money(group.lines.reduce((sum,item)=>sum+Number(item.direct_cost||0),0))}</b></div>
          {group.lines.map(item=><LedgerRow key={item.id} estimateId={estimateId} item={item} locked={locked} autoEditCost={false} onCostDone={finishCostEdit}/>)}
        </Fragment>)}
        {!ledger.visibleLines.length?<div className={styles.empty}>No estimate lines match this search.</div>:null}
      </div>
    </div>
    <footer className={styles.footer}><span role="status">{message||`${ledger.visibleLines.length} visible lines`}</span><strong>Visible direct cost <output>{money(ledger.visibleLines.reduce((sum,item)=>sum+Number(item.direct_cost||0),0))}</output></strong></footer>
  </section>;
}
