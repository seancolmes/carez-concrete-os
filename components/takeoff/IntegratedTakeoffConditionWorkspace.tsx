'use client';

import {createPortal} from 'react-dom';
import {useEffect,useMemo,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {AlertTriangle,CheckCircle2,Layers3,Plus,RefreshCw,Ruler,Save,Search} from 'lucide-react';
import {
  createProjectConcreteConditionPilot,
  saveAndRecalculateConcreteConditionPilot,
} from '@/app/takeoff/[setId]/conditionActions';
import {CarezConditionTree,type CarezConditionTreeNode} from '@/components/carez/workspace';
import {CarezNumberField} from '@/components/carez/fields';
import {
  CarezDataGrid,
  CarezDataGridBody,
  CarezDataGridCell,
  CarezDataGridHead,
  CarezDataGridHeaderCell,
  CarezDataGridRow,
  CarezDataGridTable,
} from '@/components/carez/data-grid';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {CONDITION_ARCHETYPES,conditionArchetype} from '@/lib/takeoff/conditions/catalog';
import {
  conditionCodeFromName,
  conditionMeasurementMatchesRole,
  prepareConditionAuthoringInputs,
  prepareConditionRoleAssignments,
  type ConditionInputDraft,
} from '@/lib/takeoff/conditions/authoring';
import {
  buildDerived3DScene,
  type Derived3DIssue,
  type Derived3DSolid,
} from '@/lib/takeoff/conditions/derived3d';
import type {
  ConditionArchetypeKey,
  ConditionInputDefinition,
  ConditionInputGroup,
  ConditionModuleKey,
} from '@/lib/takeoff/conditions/types';
import {TakeoffDerived3DView} from './TakeoffDerived3DView';
import {TakeoffDrawingWorkspace} from './TakeoffDrawingWorkspace';
import styles from './IntegratedTakeoffConditionWorkspace.module.css';

type ConditionSummary={
  condition_id:string;condition_version_id:string;code:string;name:string;revision_no:number;version_status:string;
  template_version_id:string;archetype_code:ConditionArchetypeKey;archetype_name:string;measurement_count:number;
  output_count:number;held_output_count:number;open_hold_count:number;direct_cost:number|string;
};
type ConditionVersion={
  id:string;template_version_id:string;status:string;plan_facts:Record<string,unknown>;method_inputs:Record<string,unknown>;
  production_inputs:Record<string,unknown>;commercial_inputs:Record<string,unknown>;drawing_inputs:Record<string,unknown>;updated_at:string;
};
type ConditionModule={
  condition_version_id:string;module_key:ConditionModuleKey;instance_key:string;label:string;enabled:boolean;
  input_values:Record<string,unknown>;input_provenance:Record<string,unknown>;legacy_child_key:string|null;sort_order:number;
};
type ConditionData={
  conditions:ConditionSummary[];versions:ConditionVersion[];templateVersions:Array<{id:string;legacy_assembly_version_id:string|null}>;
  modules:ConditionModule[];roles:Array<{condition_version_id:string;measurement_id:string;role_key:string;role_instance_key:string;sort_order:number}>;
  outputs:Array<{id:string;condition_version_id:string;output_key:string;label:string;production_quantity:number|string|null;production_unit:string;status:string;direct_cost:number|string;pricing_status:string;generated_estimate_item_id:string|null}>;
  holds:Array<{id:string;condition_version_id:string;output_id:string|null;hold_code:string;status:string;message:string}>;
  reconciliation:Array<{condition_version_id:string;output_key:string;reconciliation_status:string}>;
};
type Props={setId:string;workspaceProps:any;conditionData:ConditionData};
type ContextTab='plans'|'conditions'|'zones';
type PropertyTab='general'|'rebar'|'forms'|'excavation'|'labor'|'drawing'|'more';
type ViewMode='2d'|'3d'|'split';

const PROPERTY_WIDTH_KEY='carez.takeoff.integrated.properties.width.v1';
const PROPERTY_MIN=340;
const PROPERTY_MAX=620;
const MODULE_LABELS:Record<ConditionModuleKey,string>={
  concrete:'Concrete',forms:'Forms',reinforcing:'Reinforcing',anchors_embeds:'Anchors / embeds',slab_systems:'Slab systems',labor:'Labor',
};
const money=(value:number|string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0));
const quantity=(value:number|string|null,unit:string)=>value===null?'—':`${Number(value).toLocaleString('en-US',{maximumFractionDigits:3})} ${unit}`;
const humanize=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const conditionColor=(key:ConditionArchetypeKey)=>key==='slab_on_grade'?'#60a5fa':key==='pad_column_footing'?'#f59e0b':'#34d399';

function currentConditionRows(rows:ConditionSummary[]){
  const latest=new Map<string,ConditionSummary>();
  for(const row of rows){const prior=latest.get(row.condition_id);if(!prior||Number(row.revision_no)>Number(prior.revision_no))latest.set(row.condition_id,row);}
  return [...latest.values()].sort((a,b)=>a.code.localeCompare(b.code));
}
function draftFromVersion(version:ConditionVersion|null):ConditionInputDraft{
  if(!version)return{};
  return{
    planFacts:{...(version.plan_facts||{})} as Record<string,any>,
    methods:{...(version.method_inputs||{})} as Record<string,any>,
    production:{...(version.production_inputs||{})} as Record<string,any>,
    commercial:{...(version.commercial_inputs||{})} as Record<string,any>,
    drawing:{...(version.drawing_inputs||{})} as Record<string,any>,
  };
}

export function IntegratedTakeoffConditionWorkspace({setId,workspaceProps,conditionData}:Props){
  const router=useRouter();
  const drawingHostRef=useRef<HTMLDivElement|null>(null);
  const resizeRef=useRef<{x:number;width:number}|null>(null);
  const [sidebarHost,setSidebarHost]=useState<HTMLElement|null>(null);
  const [contextTab,setContextTab]=useState<ContextTab>('plans');
  const [conditionQuery,setConditionQuery]=useState('');
  const [propertiesWidth,setPropertiesWidth]=useState(390);
  const [selectedVersionId,setSelectedVersionId]=useState<string|null>(null);
  const [propertyTab,setPropertyTab]=useState<PropertyTab>('general');
  const [viewMode,setViewMode]=useState<ViewMode>('2d');
  const [activeSheetId,setActiveSheetId]=useState<string|null>(workspaceProps.initialSheets?.[0]?.id||null);
  const [selectedMeasurementId,setSelectedMeasurementId]=useState<string|null>(null);
  const [dockHeight,setDockHeight]=useState(228);
  const [draft,setDraft]=useState<ConditionInputDraft>({});
  const [moduleEnabled,setModuleEnabled]=useState<Record<string,boolean>>({});
  const [moduleDraft,setModuleDraft]=useState<Record<string,Record<string,unknown>>>({});
  const [roleSelections,setRoleSelections]=useState<Record<string,string>>({});
  const [message,setMessage]=useState('');
  const [creating,setCreating]=useState(false);
  const [family,setFamily]=useState<ConditionArchetypeKey>('strip_wall_footing');
  const [createName,setCreateName]=useState('Strip / Wall Footing');
  const [createCode,setCreateCode]=useState('STRIP-WALL-FOOTING');
  const [codeTouched,setCodeTouched]=useState(false);
  const [isPending,startTransition]=useTransition();

  const locked=Boolean(workspaceProps.locked);
  const measurements=workspaceProps.initialMeasurements||[];
  const sheets=workspaceProps.initialSheets||[];
  const assemblies=workspaceProps.assemblies||[];
  const assemblyVersions=workspaceProps.versions||[];
  const scaleRegionMap=useMemo(()=>new Map<string,any>((workspaceProps.scaleRegions||[]).map((region:any)=>[region.id,region])),[workspaceProps.scaleRegions]);
  const conditionMeasurementIds=useMemo(()=>Array.from(new Set((conditionData.roles||[]).map(role=>role.measurement_id).filter(Boolean))),[conditionData.roles]);
  const conditions=useMemo(()=>currentConditionRows(conditionData.conditions||[]),[conditionData.conditions]);
  const selectedSummary=conditions.find(row=>row.condition_version_id===selectedVersionId)||null;
  const selectedVersion=conditionData.versions.find(row=>row.id===selectedVersionId)||null;
  const definition=selectedSummary?conditionArchetype(selectedSummary.archetype_code):null;
  const templateVersion=selectedVersion?conditionData.templateVersions.find(row=>row.id===selectedVersion.template_version_id)||null:null;
  const compatibilityAssemblyVersionId=templateVersion?.legacy_assembly_version_id||null;
  const selectedModules=selectedVersionId?conditionData.modules.filter(row=>row.condition_version_id===selectedVersionId).sort((a,b)=>a.sort_order-b.sort_order):[];
  const selectedOutputs=selectedVersionId?conditionData.outputs.filter(row=>row.condition_version_id===selectedVersionId):[];
  const selectedHolds=selectedVersionId?conditionData.holds.filter(row=>row.condition_version_id===selectedVersionId&&row.status==='open'):[];
  const selectedReconciliation=selectedVersionId?conditionData.reconciliation.filter(row=>row.condition_version_id===selectedVersionId):[];
  const reconciledCount=selectedReconciliation.filter(row=>['exact','held','inactive'].includes(row.reconciliation_status)).length;
  const activeSheet=sheets.find((sheet:any)=>sheet.id===activeSheetId)||sheets[0]||null;
  const activeSheetLabel=activeSheet?.sheet_number||`Page ${activeSheet?.page_number||'—'}`;

  const derived3DScene=useMemo(()=>buildDerived3DScene({
    conditions:conditions.flatMap(summary=>{
      const version=conditionData.versions.find(row=>row.id===summary.condition_version_id);
      if(!version)return[];
      const persisted=draftFromVersion(version);
      const isSelected=summary.condition_version_id===selectedVersionId;
      const planFacts={...(persisted.planFacts||{}),...(isSelected?(draft.planFacts||{}):{})};
      const drawingInputs={...(persisted.drawing||{}),...(isSelected?(draft.drawing||{}):{})};
      const roleMap=new Map<string,string>(conditionData.roles.filter(row=>row.condition_version_id===summary.condition_version_id).map(row=>[row.role_key,row.measurement_id]));
      if(isSelected)for(const [roleKey,measurementId] of Object.entries(roleSelections)){if(measurementId)roleMap.set(roleKey,measurementId);else roleMap.delete(roleKey);}
      return[{conditionId:summary.condition_id,conditionVersionId:summary.condition_version_id,code:summary.code,name:summary.name,archetypeKey:summary.archetype_code,color:conditionColor(summary.archetype_code),planFacts,drawingInputs,roles:[...roleMap].map(([roleKey,measurementId])=>({roleKey,measurementId}))}];
    }),
    measurements:measurements.map((measurement:any)=>{
      const region=scaleRegionMap.get(measurement.scale_region_id);
      const sheet=sheets.find((item:any)=>item.id===measurement.sheet_id);
      return{id:measurement.id,sheet_id:measurement.sheet_id,name:measurement.name,location:measurement.location,raw_quantity:measurement.raw_quantity,raw_unit:measurement.raw_unit,geometry:measurement.geometry,calibration:region?.calibration||sheet?.calibration||null};
    }),
    sheets:sheets.map((sheet:any)=>({id:sheet.id,page_width:sheet.page_width,page_height:sheet.page_height,calibration:sheet.calibration})),
  }),[conditions,conditionData.versions,conditionData.roles,measurements,sheets,scaleRegionMap,selectedVersionId,draft,roleSelections]);

  const treeNodes=useMemo<CarezConditionTreeNode[]>(()=>{
    const query=conditionQuery.trim().toLowerCase();
    const visible=conditions.filter(row=>!query||[row.code,row.name,row.archetype_name].some(value=>String(value||'').toLowerCase().includes(query)));
    const child=(row:ConditionSummary):CarezConditionTreeNode=>({
      id:row.condition_version_id,label:row.name,
      status:Number(row.open_hold_count)?`${row.open_hold_count} hold${Number(row.open_hold_count)===1?'':'s'}`:'Ready',
      color:conditionColor(row.archetype_code),
    });
    return[
      {id:'condition-group-footings',label:'Footings',children:visible.filter(row=>row.archetype_code!=='slab_on_grade').map(child)},
      {id:'condition-group-slabs',label:'Slabs',children:visible.filter(row=>row.archetype_code==='slab_on_grade').map(child)},
    ];
  },[conditions,conditionQuery]);

  const zones=useMemo(()=>{
    const counts=new Map<string,number>();
    for(const measurement of measurements){const label=String(measurement.location||'').trim();if(label)counts.set(label,(counts.get(label)||0)+1);}
    return [...counts].map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label));
  },[measurements]);

  const focusMeasurement=(measurementId:string|null)=>{
    if(!measurementId)return;
    setSelectedMeasurementId(measurementId);
    window.dispatchEvent(new CustomEvent('carez:select-takeoff-measurement',{detail:{measurementId}}));
  };
  const focusCondition=(versionId:string,focusPlan=true)=>{
    setSelectedVersionId(versionId);setCreating(false);
    if(!focusPlan)return;
    const row=conditions.find(item=>item.condition_version_id===versionId);
    if(!row)return;
    const primary=conditionArchetype(row.archetype_code).roles.find(role=>role.primary);
    const assigned=primary?conditionData.roles.find(role=>role.condition_version_id===versionId&&role.role_key===primary.key):null;
    if(assigned?.measurement_id)focusMeasurement(assigned.measurement_id);
  };
  const selectDerivedSolid=(solid:Derived3DSolid)=>{setSelectedVersionId(solid.conditionVersionId);setCreating(false);focusMeasurement(solid.measurementId);};
  const jumpToDerivedIssue=(entry:Derived3DIssue)=>{setSelectedVersionId(entry.conditionVersionId);setCreating(false);if(entry.measurementId)focusMeasurement(entry.measurementId);setViewMode('split');};

  useEffect(()=>{
    const findSidebar=()=>setSidebarHost(drawingHostRef.current?.querySelector('aside') as HTMLElement|null);
    findSidebar();
    const id=window.setTimeout(findSidebar,0);
    return()=>window.clearTimeout(id);
  },[]);
  useEffect(()=>{
    const host=drawingHostRef.current;if(!host)return;
    let observer:ResizeObserver|null=null;let timer=0;
    const attach=()=>{const dock=host.querySelector<HTMLElement>('[aria-label="Takeoff quantity worksheet"]');if(!dock)return false;const update=()=>setDockHeight(Math.max(38,Math.round(dock.getBoundingClientRect().height)));update();observer=new ResizeObserver(update);observer.observe(dock);return true;};
    if(!attach())timer=window.setTimeout(()=>{attach();},0);
    return()=>{if(timer)window.clearTimeout(timer);observer?.disconnect();};
  },[]);
  useEffect(()=>{
    try{const saved=Number(window.localStorage.getItem(PROPERTY_WIDTH_KEY));if(Number.isFinite(saved)&&saved>=PROPERTY_MIN)setPropertiesWidth(clamp(saved,PROPERTY_MIN,PROPERTY_MAX));}catch{}
  },[]);
  useEffect(()=>{try{window.localStorage.setItem(PROPERTY_WIDTH_KEY,String(propertiesWidth));}catch{}},[propertiesWidth]);
  useEffect(()=>{
    const move=(event:PointerEvent)=>{if(resizeRef.current)setPropertiesWidth(clamp(resizeRef.current.width+resizeRef.current.x-event.clientX,PROPERTY_MIN,PROPERTY_MAX));};
    const end=()=>{resizeRef.current=null;document.body.style.cursor='';document.body.style.userSelect='';};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);end();};
  },[]);
  useEffect(()=>{
    if(!selectedVersionId&&conditions[0])setSelectedVersionId(conditions[0].condition_version_id);
    if(selectedVersionId&&!conditions.some(row=>row.condition_version_id===selectedVersionId)&&conditions[0])setSelectedVersionId(conditions[0].condition_version_id);
  },[conditions,selectedVersionId]);
  useEffect(()=>{
    if(!selectedVersion)return;
    setDraft(draftFromVersion(selectedVersion));
    setModuleEnabled(Object.fromEntries(selectedModules.map(module=>[module.module_key,Boolean(module.enabled)])));
    setModuleDraft(Object.fromEntries(selectedModules.map(module=>[module.module_key,{...(module.input_values||{})}])));
    const assigned=conditionData.roles.filter(row=>row.condition_version_id===selectedVersion.id);
    setRoleSelections(Object.fromEntries(assigned.map(role=>[role.role_key,role.measurement_id])));
    setMessage('');
  },[selectedVersion?.id,selectedVersion?.updated_at]);
  useEffect(()=>{
    const open=()=>{setContextTab('conditions');setCreating(false);};
    window.addEventListener('carez:open-conditions',open);
    return()=>window.removeEventListener('carez:open-conditions',open);
  },[]);
  useEffect(()=>{
    const selection=(event:Event)=>{
      const measurementId=String((event as CustomEvent<{measurementId?:string|null}>).detail?.measurementId||'')||null;
      setSelectedMeasurementId(measurementId);
      if(!measurementId)return;
      const currentIds=new Set(conditions.map(row=>row.condition_version_id));
      const role=conditionData.roles.find(row=>row.measurement_id===measurementId&&currentIds.has(row.condition_version_id));
      if(role){setSelectedVersionId(role.condition_version_id);setCreating(false);}
    };
    const sheet=(event:Event)=>{const sheetId=String((event as CustomEvent<{sheetId?:string|null}>).detail?.sheetId||'')||null;setActiveSheetId(sheetId);};
    window.addEventListener('carez:takeoff-selection-change',selection as EventListener);
    window.addEventListener('carez:takeoff-sheet-change',sheet as EventListener);
    return()=>{window.removeEventListener('carez:takeoff-selection-change',selection as EventListener);window.removeEventListener('carez:takeoff-sheet-change',sheet as EventListener);};
  },[conditionData.roles,conditions]);

  const updateInput=(input:ConditionInputDefinition,value:string)=>{
    const parsed=input.valueType==='number'||input.valueType==='integer'?(value===''?'':Number(value)):value;
    setDraft(current=>({...current,[input.group]:{...(current[input.group]||{}),[input.key]:parsed}}));
  };
  const setRole=(roleKey:string,measurementId:string)=>setRoleSelections(current=>{
    const next={...current};if(measurementId)for(const key of Object.keys(next))if(key!==roleKey&&next[key]===measurementId)next[key]='';next[roleKey]=measurementId;return next;
  });
  const updateModuleInput=(moduleKey:string,key:string,value:unknown)=>setModuleDraft(current=>({...current,[moduleKey]:{...(current[moduleKey]||{}),[key]:value}}));

  const assemblyVersionForRole=(role:any)=>{
    if(role.primary&&compatibilityAssemblyVersionId)return compatibilityAssemblyVersionId;
    const ids=new Set(assemblies.filter((row:any)=>row.category==='Concrete Conditions'&&row.primary_measurement===role.unit).map((row:any)=>row.id));
    return assemblyVersions.find((version:any)=>ids.has(version.assembly_id))?.id
      ||assemblyVersions.find((version:any)=>assemblies.some((assembly:any)=>assembly.id===version.assembly_id&&assembly.primary_measurement===role.unit))?.id
      ||null;
  };
  const startTakeoff=(role:any)=>{
    const assemblyVersionId=assemblyVersionForRole(role);
    if(!assemblyVersionId){setMessage(`No ${role.unit} takeoff is available for this role.`);return;}
    setViewMode('2d');
    window.dispatchEvent(new CustomEvent('carez:start-condition-takeoff',{detail:{assemblyVersionId,name:selectedSummary?.name||definition?.name||'Concrete Condition',roleLabel:role.label}}));
    setContextTab('plans');
    setMessage(`Drawing ${role.label}.`);
  };
  const chooseFamily=(key:ConditionArchetypeKey)=>{const next=CONDITION_ARCHETYPES[key];setFamily(key);setCreateName(next.name);setCreateCode(conditionCodeFromName(next.name));setCodeTouched(false);};
  const createCondition=()=>{
    setMessage('Creating condition…');
    startTransition(async()=>{try{
      const result=await createProjectConcreteConditionPilot({takeoffSetId:setId,archetypeKey:family,code:createCode,name:createName});
      setSelectedVersionId(result.condition_version_id);setCreating(false);setContextTab('conditions');setMessage('Condition created.');router.refresh();
    }catch(error:any){setMessage(error?.message||'Could not create condition.');}});
  };
  const saveCondition=()=>{
    if(!selectedVersion||!definition)return;
    const roles=prepareConditionRoleAssignments(definition.roles,roleSelections);
    const primary=definition.roles.find(role=>role.primary);
    const anchorId=primary?roleSelections[primary.key]:'';
    if(!anchorId){setMessage(`Assign ${primary?.label||'the primary takeoff'} before calculating.`);return;}
    const {inputs,provenance}=prepareConditionAuthoringInputs(draft);
    setMessage('Saving…');
    startTransition(async()=>{try{
      const result=await saveAndRecalculateConcreteConditionPilot({
        conditionVersionId:selectedVersion.id,inputs,inputProvenance:provenance,
        modules:selectedModules.map((module,index)=>({
          moduleKey:module.module_key,instanceKey:module.instance_key,label:module.label,enabled:moduleEnabled[module.module_key]!==false,
          inputValues:(moduleDraft[module.module_key]||module.input_values) as Record<string,any>,inputProvenance:module.input_provenance as Record<string,any>,
          legacyChildKey:module.legacy_child_key,sortOrder:module.sort_order||(index+1)*10,
        })),
        measurementRoles:roles,compatibilityAnchorMeasurementId:anchorId,
      });
      setMessage(`Saved · ${result?.output_count||0} outputs`);router.refresh();
    }catch(error:any){setMessage(error?.message||'Could not save condition.');}});
  };

  const renderInputGroup=(group:ConditionInputGroup)=>{
    const inputs=definition?.inputs.filter(input=>input.group===group)||[];
    if(!inputs.length)return <div className={styles.compactEmpty}>No inputs in this section.</div>;
    return <div className={styles.fieldGrid}>{inputs.map(input=><label className={styles.field} key={`${group}-${input.key}`}><span>{input.label}</span>
      {input.valueType==='boolean'?<label className={styles.checkLine}><input type="checkbox" checked={Boolean(draft[group]?.[input.key])} onChange={event=>updateInput(input,event.target.checked?'true':'')} disabled={locked||isPending}/><span>Enabled</span></label>
      :input.valueType==='select'?<select value={String(draft[group]?.[input.key]??'')} onChange={event=>updateInput(input,event.target.value)} disabled={locked||isPending}><option value="">Select…</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="centerline">Centerline</option></select>
      :<CarezNumberField value={String(draft[group]?.[input.key]??'')} onChange={event=>updateInput(input,event.target.value)} unit={input.unit} min={input.minimum} max={input.maximum} step={input.valueType==='integer'?1:'any'} disabled={locked||isPending}/>}</label>)}</div>;
  };

  const renderModule=(moduleKey:ConditionModuleKey)=>{
    const module=selectedModules.find(row=>row.module_key===moduleKey);
    if(!module||moduleEnabled[moduleKey]===false)return <div className={styles.compactEmpty}>{MODULE_LABELS[moduleKey]} is not active for this condition.</div>;
    const entries=Object.entries(moduleDraft[moduleKey]||{});
    if(!entries.length)return <div className={styles.moduleReady}><CheckCircle2/> <span>{MODULE_LABELS[moduleKey]} enabled</span></div>;
    return <div className={styles.fieldGrid}>{entries.map(([key,value])=><label className={styles.field} key={`${moduleKey}-${key}`}><span>{humanize(key)}</span>
      {typeof value==='boolean'?<label className={styles.checkLine}><input type="checkbox" checked={value} onChange={event=>updateModuleInput(moduleKey,key,event.target.checked)} disabled={locked||isPending}/><span>Enabled</span></label>
      :typeof value==='number'?<CarezNumberField value={String(value)} onChange={event=>updateModuleInput(moduleKey,key,event.target.value===''?'':Number(event.target.value))} step="any" disabled={locked||isPending}/>
      :<Input value={String(value??'')} onChange={event=>updateModuleInput(moduleKey,key,event.target.value)} disabled={locked||isPending}/>}</label>)}</div>;
  };

  const contextPortal=sidebarHost?createPortal(<div className={`${styles.contextPortal} ${contextTab==='plans'?'':styles.contextPortalExpanded}`}>
    <div className={styles.contextTabs} role="tablist" aria-label="Takeoff navigator">
      {(['plans','conditions','zones'] as ContextTab[]).map(tab=><button key={tab} type="button" role="tab" aria-selected={contextTab===tab} className={contextTab===tab?styles.contextTabActive:styles.contextTab} onClick={()=>setContextTab(tab)}>{tab[0].toUpperCase()+tab.slice(1)}</button>)}
    </div>
    {contextTab==='conditions'?<div className={styles.contextBody}>
      <div className={styles.contextTools}><label><Search/><input value={conditionQuery} onChange={event=>setConditionQuery(event.target.value)} placeholder="Filter conditions"/></label><Button size="icon-sm" variant="outline" onClick={()=>setCreating(true)} disabled={locked}><Plus/></Button></div>
      {conditions.length?<CarezConditionTree nodes={treeNodes} selectedId={selectedVersionId} onSelect={node=>{if(conditions.some(row=>row.condition_version_id===node.id))focusCondition(node.id);}}/>:<div className={styles.contextEmpty}>No conditions</div>}
    </div>:contextTab==='zones'?<div className={styles.contextBody}><div className={styles.paneLabel}>Zones</div>{zones.length?<div className={styles.zoneList}>{zones.map(zone=><div key={zone.label}><span>{zone.label}</span><b>{zone.count}</b></div>)}</div>:<div className={styles.contextEmpty}>No zones assigned</div>}</div>:null}
  </div>,sidebarHost):null;

  return <div className={styles.integrated} data-context-tab={contextTab} data-view-mode={viewMode} style={{gridTemplateColumns:`minmax(0,1fr) 5px ${propertiesWidth}px`}}>
    <div className={styles.drawingHost} ref={drawingHostRef}>
      <TakeoffDrawingWorkspace {...workspaceProps} conditionAuthoringActive conditionMeasurementIds={conditionMeasurementIds}/>
      {contextPortal}
      {viewMode!=='2d'&&<div className={`${styles.derivedOverlay} ${viewMode==='split'?styles.derivedOverlaySplit:styles.derivedOverlay3d}`} style={{bottom:dockHeight}}>
        <TakeoffDerived3DView scene={derived3DScene} activeSheetId={activeSheetId} activeSheetLabel={activeSheetLabel} selectedConditionVersionId={selectedVersionId} selectedMeasurementId={selectedMeasurementId} onSelectSolid={selectDerivedSolid} onJumpToIssue={jumpToDerivedIssue}/>
      </div>}
    </div>
    <button type="button" className={styles.propertiesResize} aria-label="Resize Condition Properties" onPointerDown={event=>{resizeRef.current={x:event.clientX,width:propertiesWidth};document.body.style.cursor='ew-resize';document.body.style.userSelect='none';event.preventDefault();}}/>
    <aside className={styles.propertiesPane} aria-label="Condition Properties">
      <header className={styles.propertiesHeader}>
        <div><span>Condition Properties</span><strong>{creating?'New condition':selectedSummary?.name||'No condition selected'}</strong>{selectedSummary?<small>{selectedSummary.code} · R{selectedSummary.revision_no}</small>:null}</div>
        <div className={styles.propertiesHeaderActions}>
          <div className={styles.viewModeSwitch} role="tablist" aria-label="Takeoff view mode">{(['2d','3d','split'] as ViewMode[]).map(mode=><button key={mode} type="button" role="tab" aria-selected={viewMode===mode} className={viewMode===mode?styles.viewModeActive:''} onClick={()=>setViewMode(mode)}>{mode==='2d'?'2D':mode==='3d'?'3D':'Split'}</button>)}</div>
          <Button size="sm" variant="outline" onClick={()=>setCreating(true)} disabled={locked||isPending}><Plus/>New</Button>
        </div>
      </header>

      {creating?<div className={styles.createPane}>
        <div className={styles.familyList}>{(Object.keys(CONDITION_ARCHETYPES) as ConditionArchetypeKey[]).map(key=>{const item=CONDITION_ARCHETYPES[key];return <button type="button" key={key} className={family===key?styles.familyActive:styles.familyButton} onClick={()=>chooseFamily(key)}><b>{item.primaryUnit}</b><span>{item.name}</span></button>;})}</div>
        <label className={styles.field}><span>Condition name</span><Input value={createName} onChange={event=>{const name=event.target.value;setCreateName(name);if(!codeTouched)setCreateCode(conditionCodeFromName(name));}}/></label>
        <label className={styles.field}><span>Code</span><Input value={createCode} onChange={event=>{setCodeTouched(true);setCreateCode(event.target.value.toUpperCase());}}/></label>
        <div className={styles.createActions}><Button variant="outline" onClick={()=>setCreating(false)}>Cancel</Button><Button onClick={createCondition} disabled={locked||isPending||!createName.trim()||!createCode.trim()}>{isPending?<RefreshCw className={styles.spin}/>:<Plus/>}Create</Button></div>
        <div className={styles.statusLine} role="status">{message}</div>
      </div>:!selectedSummary||!selectedVersion||!definition?<div className={styles.propertiesEmpty}><Layers3/><strong>Select a condition</strong></div>:<>
        <div className={styles.conditionSummary}>
          <div><span className={styles.conditionColor} data-family={selectedSummary.archetype_code}/><div><strong>{selectedSummary.archetype_name}</strong><small>{selectedSummary.version_status}</small></div></div>
          <div className={styles.metrics}><span><b>{selectedSummary.measurement_count}</b>Takeoffs</span><span><b>{selectedSummary.output_count}</b>Outputs</span><span className={Number(selectedSummary.open_hold_count)?styles.metricWarn:''}><b>{selectedSummary.open_hold_count}</b>Holds</span></div>
        </div>
        <Tabs value={propertyTab} onValueChange={value=>setPropertyTab(value as PropertyTab)} className={styles.tabsWrap}>
          <TabsList variant="line" className={styles.tabsList}>{(['general','rebar','forms','excavation','labor','drawing','more'] as PropertyTab[]).map(tab=><TabsTrigger key={tab} value={tab}>{tab[0].toUpperCase()+tab.slice(1)}</TabsTrigger>)}</TabsList>
        </Tabs>
        <div className={styles.propertiesScroll}>
          {propertyTab==='general'?<>
            <section className={styles.propertySection}><div className={styles.sectionHead}><Ruler/><strong>Takeoff roles</strong></div><div className={styles.roleList}>{definition.roles.map(role=>{const choices=measurements.filter((measurement:any)=>conditionMeasurementMatchesRole(measurement,role,compatibilityAssemblyVersionId));return <div className={styles.roleRow} key={role.key}><div><strong>{role.label}</strong><small>{role.unit}{role.primary?' · Primary':' · Optional'}</small></div><select value={roleSelections[role.key]||''} onChange={event=>setRole(role.key,event.target.value)} disabled={locked||isPending}><option value="">{role.required?'Select takeoff…':'Not used'}</option>{choices.map((measurement:any)=>{const sheet=sheets.find((item:any)=>item.id===measurement.sheet_id);return <option key={measurement.id} value={measurement.id}>{measurement.name} · {quantity(measurement.raw_quantity,measurement.raw_unit)} · {sheet?.sheet_number||`Page ${sheet?.page_number||'?'}`}</option>;})}</select><Button size="sm" variant="outline" onClick={()=>startTakeoff(role)} disabled={locked||isPending}>Draw {role.unit}</Button></div>;})}</div></section>
            <section className={styles.propertySection}><div className={styles.sectionHead}><Layers3/><strong>Modules</strong></div><div className={styles.moduleToggles}>{selectedModules.map(module=><label key={module.module_key}><input type="checkbox" checked={moduleEnabled[module.module_key]!==false} onChange={event=>setModuleEnabled(current=>({...current,[module.module_key]:event.target.checked}))} disabled={locked||isPending}/><span>{MODULE_LABELS[module.module_key]||module.label}</span></label>)}</div></section>
            <section className={styles.propertySection}><div className={styles.sectionHead}><strong>General</strong></div>{renderInputGroup('planFacts')}</section>
          </>:null}
          {propertyTab==='rebar'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Rebar</strong></div>{renderModule('reinforcing')}</section>:null}
          {propertyTab==='forms'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Forms</strong></div>{renderModule('forms')}</section>:null}
          {propertyTab==='excavation'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Excavation</strong></div><div className={styles.compactEmpty}>No excavation inputs for this condition.</div></section>:null}
          {propertyTab==='labor'?<><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Production</strong></div>{renderInputGroup('production')}</section><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Labor</strong></div>{renderModule('labor')}</section></>:null}
          {propertyTab==='drawing'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Drawing</strong></div>{renderInputGroup('drawing')}</section>:null}
          {propertyTab==='more'?<><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Methods</strong></div>{renderInputGroup('methods')}</section><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Commercial</strong></div>{renderInputGroup('commercial')}</section><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Concrete</strong></div>{renderModule('concrete')}</section><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Anchors / embeds</strong></div>{renderModule('anchors_embeds')}</section>{selectedModules.some(module=>module.module_key==='slab_systems')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Slab systems</strong></div>{renderModule('slab_systems')}</section>:null}</>:null}

          <section className={styles.propertySection}><div className={styles.sectionHead}><CheckCircle2/><strong>Calculated outputs</strong><small>{selectedReconciliation.length?`${reconciledCount}/${selectedReconciliation.length} reconciled`:'—'}</small></div><CarezDataGrid isEmpty={!selectedOutputs.length} empty={<div className={styles.gridEmpty}>Assign the primary takeoff and save to calculate outputs.</div>}><CarezDataGridTable><CarezDataGridHead><CarezDataGridRow><CarezDataGridHeaderCell>Output</CarezDataGridHeaderCell><CarezDataGridHeaderCell numeric>Quantity</CarezDataGridHeaderCell><CarezDataGridHeaderCell numeric>Cost</CarezDataGridHeaderCell></CarezDataGridRow></CarezDataGridHead><CarezDataGridBody>{selectedOutputs.map(output=><CarezDataGridRow key={output.id}><CarezDataGridCell><strong>{output.label}</strong><small className={styles.outputMeta}>{humanize(output.status)}</small></CarezDataGridCell><CarezDataGridCell numeric>{quantity(output.production_quantity,output.production_unit)}</CarezDataGridCell><CarezDataGridCell numeric>{money(output.direct_cost)}</CarezDataGridCell></CarezDataGridRow>)}</CarezDataGridBody></CarezDataGridTable></CarezDataGrid></section>
          {selectedHolds.length?<section className={styles.holdSection}><div className={styles.sectionHead}><AlertTriangle/><strong>Open holds</strong></div>{selectedHolds.map(hold=><div key={hold.id}><AlertTriangle/><span><strong>{humanize(hold.hold_code)}</strong><small>{hold.message}</small></span></div>)}</section>:null}
        </div>
        <footer className={styles.propertiesFooter}><span role="status">{message}</span><Button onClick={saveCondition} disabled={locked||isPending||selectedVersion.status!=='draft'}>{isPending?<RefreshCw className={styles.spin}/>:<Save/>}Save & recalculate</Button></footer>
      </>}
    </aside>
  </div>;
}
