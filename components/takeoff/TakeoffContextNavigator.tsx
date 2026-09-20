'use client';

import {useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {ChevronDown,ChevronRight,Copy,Eye,EyeOff,Focus,Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {CONDITION_ARCHETYPES} from '@/lib/takeoff/conditions/catalog';
import type {ConditionArchetypeKey} from '@/lib/takeoff/conditions/types';
import styles from './TakeoffContextNavigator.module.css';

export type TakeoffNavigatorTab='plans'|'conditions'|'zones';

export type TakeoffConditionNavigatorRow={
  conditionId:string;
  conditionVersionId:string;
  code:string;
  name:string;
  family:string;
  color:string|null;
  primaryRoleLabel:string|null;
  primaryUnit:string|null;
  measurementCount:number;
  productionLabel:string|null;
  stateLabel:string;
  hidden:boolean;
};

export type TakeoffContextNavigatorProps={
  tab:TakeoffNavigatorTab;
  onTabChange:(tab:TakeoffNavigatorTab)=>void;
  sheets:any[];
  scaleRegions:any[];
  activeSheetId:string|null;
  onSelectSheet:(sheetId:string)=>void;
  conditions:TakeoffConditionNavigatorRow[];
  selectedConditionVersionId:string|null;
  onSelectCondition:(conditionVersionId:string)=>void;
  onCreateCondition:(input:{archetypeKey:ConditionArchetypeKey;code:string;name:string})=>void|Promise<void>;
  onDuplicateCondition:(conditionVersionId:string)=>void;
  hiddenConditionVersionIds:Set<string>;
  isolatedConditionVersionId:string|null;
  onToggleVisibility:(conditionVersionId:string)=>void;
  onIsolateCondition:(conditionVersionId:string)=>void;
  locked:boolean;
};

const TABS:Array<{key:TakeoffNavigatorTab;label:string}>=[
  {key:'plans',label:'Plans'},
  {key:'conditions',label:'Conditions'},
  {key:'zones',label:'Zones'},
];

export function TakeoffContextNavigator(props:TakeoffContextNavigatorProps){
  const tab=props.tab||'conditions';
  const [createOpen,setCreateOpen]=useState(false);
  const [family,setFamily]=useState<ConditionArchetypeKey>('strip_wall_footing');
  const [code,setCode]=useState('');
  const [name,setName]=useState('');
  const [pending,setPending]=useState(false);
  const [collapsed,setCollapsed]=useState<Record<TakeoffNavigatorTab,boolean>>({plans:false,conditions:false,zones:false});
  const rowRefs=useRef<Array<HTMLButtonElement|null>>([]);
  const groupHeaderRef=useRef<HTMLButtonElement|null>(null);
  const activeRows=tab==='plans'?props.sheets:tab==='conditions'?props.conditions:[];
  const scaleBySheet=useMemo(()=>new Map(props.scaleRegions.map(region=>[String(region.sheet_id??region.sheetId),region])),[props.scaleRegions]);

  const selectRow=(index:number)=>{
    const row=activeRows[index];
    if(!row)return;
    if(tab==='plans')props.onSelectSheet(String(row.id));
    if(tab==='conditions')props.onSelectCondition(String(row.conditionVersionId));
  };
  const onRowKeyDown=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      const offset=event.key==='ArrowDown'?1:-1;
      const next=Math.max(0,Math.min(activeRows.length-1,index+offset));
      rowRefs.current[next]?.focus();
    }else if(event.key==='ArrowLeft'){
      event.preventDefault();
      groupHeaderRef.current?.focus();
      setCollapsed(current=>({...current,[tab]:true}));
    }else if(event.key==='ArrowRight'){
      event.preventDefault();setCollapsed(current=>({...current,[tab]:false}));
    }else if(event.key==='Enter'){
      event.preventDefault();selectRow(index);
    }
  };
  const onGroupHeaderKeyDown=(event:KeyboardEvent<HTMLButtonElement>)=>{
    if(event.key==='ArrowLeft'){
      event.preventDefault();setCollapsed(current=>({...current,[tab]:true}));
    }else if(event.key==='ArrowRight'){
      event.preventDefault();setCollapsed(current=>({...current,[tab]:false}));
    }
  };
  const createCondition=async()=>{
    if(props.locked||pending||!code.trim()||!name.trim())return;
    setPending(true);
    try{
      await props.onCreateCondition({archetypeKey:family,code:code.trim(),name:name.trim()});
      setCreateOpen(false);
    }finally{
      setPending(false);
    }
  };

  return <nav className={styles.navigator} aria-label="Takeoff context navigator" onKeyDown={event=>event.stopPropagation()}>
    <div className={styles.tabs} role="tablist">
      {TABS.map(item=><button key={item.key} type="button" role="tab" aria-selected={tab===item.key} className={tab===item.key?styles.tabActive:styles.tab} onClick={()=>props.onTabChange(item.key)}>{item.label}</button>)}
    </div>
    <div className={styles.groupHeader}>
      <button ref={groupHeaderRef} type="button" aria-expanded={!collapsed[tab]} onKeyDown={onGroupHeaderKeyDown} onClick={()=>setCollapsed(current=>({...current,[tab]:!current[tab]}))}>
        {collapsed[tab]?<ChevronRight/>:<ChevronDown/>}{TABS.find(item=>item.key===tab)?.label}
      </button>
      {tab==='conditions'?<Button type="button" size="sm" variant="ghost" disabled={props.locked} onClick={()=>setCreateOpen(true)}><Plus/>Condition</Button>:null}
    </div>
    {!collapsed[tab]?<div className={styles.rows} role="tree">
      {tab==='plans'?props.sheets.map((sheet,index)=>{
        const id=String(sheet.id);const scale=scaleBySheet.get(id);
        return <button ref={node=>{rowRefs.current[index]=node;}} onKeyDown={event=>onRowKeyDown(event,index)} onClick={()=>props.onSelectSheet(id)} type="button" role="treeitem" aria-selected={props.activeSheetId===id} className={props.activeSheetId===id?styles.rowActive:styles.row} key={id}>
          <span><strong>{sheet.sheet_number||sheet.name||`Sheet ${index+1}`}</strong><small>{sheet.name&&sheet.sheet_number?sheet.name:'Plan sheet'}</small></span>
          <em>{scale?String(scale.label||scale.scale_label||'Scale set'):'Scale not set'}</em>
        </button>;
      }):null}
      {tab==='conditions'?props.conditions.map((condition,index)=>{
        const hidden=condition.hidden||props.hiddenConditionVersionIds.has(condition.conditionVersionId);
        return <div className={styles.conditionRow} role="none" key={condition.conditionVersionId}>
          <button ref={node=>{rowRefs.current[index]=node;}} onKeyDown={event=>onRowKeyDown(event,index)} onClick={()=>props.onSelectCondition(condition.conditionVersionId)} type="button" role="treeitem" aria-selected={props.selectedConditionVersionId===condition.conditionVersionId} className={props.selectedConditionVersionId===condition.conditionVersionId?styles.rowActive:styles.row}>
            <i style={condition.color?{backgroundColor:condition.color}:undefined}/><span><strong>{condition.code} · {condition.name}</strong><small>{condition.primaryRoleLabel||condition.family}{condition.primaryUnit?` · ${condition.primaryUnit}`:''} · {condition.measurementCount} takeoff{condition.measurementCount===1?'':'s'}</small><small>{condition.productionLabel||'Production not set'} · {condition.stateLabel}</small></span>
          </button>
          <div className={styles.rowActions}>
            <button type="button" aria-label={`${hidden?'Show':'Hide'} ${condition.name}`} onClick={()=>props.onToggleVisibility(condition.conditionVersionId)}>{hidden?<EyeOff/>:<Eye/>}</button>
            <button type="button" aria-label={`Isolate ${condition.name}`} aria-pressed={props.isolatedConditionVersionId===condition.conditionVersionId} onClick={()=>props.onIsolateCondition(condition.conditionVersionId)}><Focus/></button>
            <button type="button" aria-label={`Duplicate ${condition.name}`} disabled={props.locked} onClick={()=>props.onDuplicateCondition(condition.conditionVersionId)}><Copy/></button>
          </div>
        </div>;
      }):null}
      {tab==='zones'?<p className={styles.empty}>No Zone or group records are available for this takeoff set.</p>:null}
      {tab!=='zones'&&!activeRows.length?<p className={styles.empty}>No {tab} available.</p>:null}
    </div>:null}
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent onKeyDown={event=>event.stopPropagation()}>
        <DialogHeader><DialogTitle>New Condition</DialogTitle></DialogHeader>
        <Select value={family} onValueChange={value=>setFamily(value as ConditionArchetypeKey)}>
          <SelectTrigger><SelectValue placeholder="Condition family"/></SelectTrigger>
          <SelectContent>{Object.entries(CONDITION_ARCHETYPES).map(([key,item])=><SelectItem key={key} value={key}>{item.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input value={code} onChange={event=>setCode(event.target.value)} aria-label="Condition code"/>
        <Input value={name} onChange={event=>setName(event.target.value)} aria-label="Condition name"/>
        <DialogFooter><Button onClick={createCondition} disabled={props.locked||pending}>Create Condition</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </nav>;
}
