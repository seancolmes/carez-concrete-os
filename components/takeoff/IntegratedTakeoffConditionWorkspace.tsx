'use client';

import {createPortal} from 'react-dom';
import {useEffect,useMemo,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {AlertTriangle,CheckCircle2,ChevronDown,Layers3,Plus,RefreshCw,Ruler,Save,Search} from 'lucide-react';
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
import {Collapsible,CollapsibleContent,CollapsibleTrigger} from '@/components/ui/collapsible';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Field,FieldLabel} from '@/components/ui/field';
import {Input} from '@/components/ui/input';
import {LabeledSwitch} from '@/components/ui/labeled-switch';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
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
import {STRIP_FOOTING_V2_DEFINITION} from '@/lib/takeoff/conditions/stripFootingV2';
import type {
  ConditionArchetypeKey,
  ConditionInputDefinition,
  ConditionInputGroup,
  ConditionModuleConfiguration,
  ConditionModuleKey,
} from '@/lib/takeoff/conditions/types';
import {ConditionModuleEditor} from './ConditionModuleEditor';
import {ConditionRolePicker} from './ConditionRolePicker';
import {TakeoffDerived3DView} from './TakeoffDerived3DView';
import {TakeoffDrawingWorkspace} from './TakeoffDrawingWorkspace';
import direction from './ConditionPropertiesDirectionA.module.css';
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
  input_values:Record<string,any>;input_provenance:Record<string,any>;legacy_child_key:string|null;sort_order:number;
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
type PendingSwitch={versionId:string;focusPlan:boolean};

const MODULE_LABELS:Record<ConditionModuleKey,string>={
  concrete:'Concrete',forms:'Forms',reinforcing:'Reinforcing',anchors_embeds:'Anchors / embeds',slab_systems:'Slab systems',
  excavation_backfill:'Excavation / backfill',placement_equipment:'Placement / equipment',finish_cure_protection:'Finish / cure / protection',labor:'Labor',miscellaneous:'Miscellaneous',
};
const money=(value:number|string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0));
const quantity=(value:number|string|null,unit:string)=>value===null?'—':`${Number(value).toLocaleString('en-US',{maximumFractionDigits:3})} ${unit}`;
const humanize=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
const conditionColor=(key:ConditionArchetypeKey)=>key==='slab_on_grade'?'#60a5fa':key==='pad_column_footing'?'#f59e0b':'#34d399';
const switchId=(...parts:string[])=>`condition-${parts.join('-').replace(/[^a-zA-Z0-9_-]/g,'-')}`;

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
const toModuleConfiguration=(module:ConditionModule):ConditionModuleConfiguration=>({
  moduleKey:module.module_key,instanceKey:module.instance_key,label:module.label,enabled:Boolean(module.enabled),
  inputValues:{...(module.input_values||{})},inputProvenance:{...(module.input_provenance||{})},legacyChildKey:module.legacy_child_key,sortOrder:module.sort_order,
});
const moduleSignature=(modules:ConditionModuleConfiguration[])=>modules
  .map(module=>({
    moduleKey:module.moduleKey,
    instanceKey:module.instanceKey||'',
    label:module.label||'',
    enabled:Boolean(module.enabled),
    inputValues:module.inputValues||{},
    legacyChildKey:module.legacyChildKey||null,
    sortOrder:Number(module.sortOrder||0),
  }))
  .sort((a,b)=>`${a.moduleKey}:${a.instanceKey}`.localeCompare(`${b.moduleKey}:${b.instanceKey}`));
const roleSignature=(roles:Record<string,string>)=>Object.entries(roles).sort(([a],[b])=>a.localeCompare(b));
const tabForHold=(hold:{hold_code:string;message:string}):PropertyTab=>{
  const text=`${hold.hold_code} ${hold.message}`.toLowerCase();
  if(/rebar|reinforc/.test(text))return'rebar';
  if(/form/.test(text))return'forms';
  if(/excavat|backfill/.test(text))return'excavation';
  if(/labor|production|hour|crew/.test(text))return'labor';
  if(/3d|draw|elev/.test(text))return'drawing';
  if(/anchor|embed|price|procure|equipment|finish|cure|misc/.test(text))return'more';
  return'general';
};

export function IntegratedTakeoffConditionWorkspace({setId,workspaceProps,conditionData}:Props){
  const router=useRouter();
  const drawingHostRef=useRef<HTMLDivElement|null>(null);
  const [sidebarHost,setSidebarHost]=useState<HTMLElement|null>(null);
  const [contextTab,setContextTab]=useState<ContextTab>('plans');
  const [conditionQuery,setConditionQuery]=useState('');
  const [selectedVersionId,setSelectedVersionId]=useState<string|null>(null);
  const [loadedVersionId,setLoadedVersionId]=useState<string|null>(null);
  const [pendingSwitch,setPendingSwitch]=useState<PendingSwitch|null>(null);
  const [propertyTab,setPropertyTab]=useState<PropertyTab>('general');
  const [viewMode,setViewMode]=useState<ViewMode>('2d');
  const [outputsOpen,setOutputsOpen]=useState(false);
  const [activeSheetId,setActiveSheetId]=useState<string|null>(workspaceProps.initialSheets?.[0]?.id||null);
  const [selectedMeasurementId,setSelectedMeasurementId]=useState<string|null>(null);
  const [dockHeight,setDockHeight]=useState(228);
  const [draft,setDraft]=useState<ConditionInputDraft>({});
  const [moduleEnabled,setModuleEnabled]=useState<Record<string,boolean>>({});
  const [moduleDraft,setModuleDraft]=useState<Record<string,Record<string,unknown>>>({});
  const [moduleConfigurations,setModuleConfigurations]=useState<ConditionModuleConfiguration[]>([]);
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
  const templateVersion=selectedVersion?conditionData.templateVersions.find(row=>row.id===selectedVersion.template_version_id)||null:null;
  const compatibilityAssemblyVersionId=templateVersion?.legacy_assembly_version_id||null;
  const selectedModules=selectedVersionId?conditionData.modules.filter(row=>row.condition_version_id===selectedVersionId).sort((a,b)=>a.sort_order-b.sort_order):[];
  const stripV2=selectedSummary?.archetype_code==='strip_wall_footing'&&selectedModules.some(module=>module.module_key==='excavation_backfill');
  const definition=selectedSummary?(stripV2?STRIP_FOOTING_V2_DEFINITION:conditionArchetype(selectedSummary.archetype_code)):null;
  const selectedOutputs=selectedVersionId?conditionData.outputs.filter(row=>row.condition_version_id===selectedVersionId):[];
  const selectedHolds=selectedVersionId?conditionData.holds.filter(row=>row.condition_version_id===selectedVersionId&&row.status==='open'):[];
  const totalDirectCost=selectedOutputs.reduce((sum,row)=>sum+Number(row.direct_cost||0),0);
  const activeSheet=sheets.find((sheet:any)=>sheet.id===activeSheetId)||sheets[0]||null;
  const activeSheetLabel=activeSheet?.sheet_number||`Page ${activeSheet?.page_number||'—'}`;

  const supportsModule=(moduleKey:ConditionModuleKey)=>Boolean(
    selectedModules.some(module=>module.module_key===moduleKey)
    ||definition?.modules?.some(module=>module.key===moduleKey)
    ||definition?.defaultModules.includes(moduleKey)
  );
  const availableTabs=useMemo<PropertyTab[]>(()=>{
    if(!definition)return['general'];
    const tabs:PropertyTab[]=['general'];
    if(supportsModule('reinforcing'))tabs.push('rebar');
    if(supportsModule('forms'))tabs.push('forms');
    if(supportsModule('excavation_backfill'))tabs.push('excavation');
    if(definition.inputs.some(input=>input.group==='production')||supportsModule('labor'))tabs.push('labor');
    if(definition.inputs.some(input=>input.group==='drawing'))tabs.push('drawing');
    const hasMore=definition.inputs.some(input=>input.group==='methods'||input.group==='commercial')
      ||['concrete','anchors_embeds','slab_systems','placement_equipment','finish_cure_protection','miscellaneous'].some(key=>supportsModule(key));
    if(hasMore)tabs.push('more');
    return tabs;
  // supportsModule derives only from these two sources.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[definition,selectedModules]);

  const persistedRoles=useMemo(()=>Object.fromEntries(
    conditionData.roles
      .filter(row=>row.condition_version_id===selectedVersionId)
      .map(role=>[role.role_key,role.measurement_id])
  ),[conditionData.roles,selectedVersionId]);
  const currentModulesForSignature=useMemo<ConditionModuleConfiguration[]>(()=>{
    if(stripV2)return moduleConfigurations;
    return selectedModules.map(module=>({
      ...toModuleConfiguration(module),
      enabled:moduleEnabled[module.module_key]!==false,
      inputValues:module.instance_key==='default'?(moduleDraft[module.module_key]||module.input_values):module.input_values,
    }));
  },[stripV2,moduleConfigurations,selectedModules,moduleEnabled,moduleDraft]);
  const persistedSignature=useMemo(()=>selectedVersion?JSON.stringify({
    draft:draftFromVersion(selectedVersion),
    modules:moduleSignature(selectedModules.map(toModuleConfiguration)),
    roles:roleSignature(persistedRoles),
  }):'',[selectedVersion,selectedModules,persistedRoles]);
  const currentSignature=useMemo(()=>selectedVersion?JSON.stringify({
    draft,
    modules:moduleSignature(currentModulesForSignature),
    roles:roleSignature(roleSelections),
  }):'',[selectedVersion,draft,currentModulesForSignature,roleSelections]);
  const dirty=Boolean(selectedVersion&&loadedVersionId===selectedVersion.id&&currentSignature!==persistedSignature);

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
    return[...counts].map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label));
  },[measurements]);

  const focusMeasurement=(measurementId:string|null)=>{
    if(!measurementId)return;
    setSelectedMeasurementId(measurementId);
    window.dispatchEvent(new CustomEvent('carez:select-takeoff-measurement',{detail:{measurementId}}));
  };
  const applyConditionSelection=(versionId:string,focusPlan=true)=>{
    setSelectedVersionId(versionId);
    setCreating(false);
    if(!focusPlan)return;
    const row=conditions.find(item=>item.condition_version_id===versionId);
    if(!row)return;
    const rowDefinition=row.archetype_code==='strip_wall_footing'&&conditionData.modules.some(module=>module.condition_version_id===versionId&&module.module_key==='excavation_backfill')?STRIP_FOOTING_V2_DEFINITION:conditionArchetype(row.archetype_code);
    const primary=rowDefinition.roles.find(role=>role.primary);
    const assigned=primary?conditionData.roles.find(role=>role.condition_version_id===versionId&&role.role_key===primary.key):null;
    if(assigned?.measurement_id)focusMeasurement(assigned.measurement_id);
  };
  const requestConditionSelection=(versionId:string,focusPlan=true)=>{
    if(versionId===selectedVersionId){if(focusPlan)applyConditionSelection(versionId,true);return;}
    if(dirty){setPendingSwitch({versionId,focusPlan});return;}
    applyConditionSelection(versionId,focusPlan);
  };
  const selectDerivedSolid=(solid:Derived3DSolid)=>{requestConditionSelection(solid.conditionVersionId,false);focusMeasurement(solid.measurementId);};
  const jumpToDerivedIssue=(entry:Derived3DIssue)=>{requestConditionSelection(entry.conditionVersionId,false);if(entry.measurementId)focusMeasurement(entry.measurementId);setViewMode('split');};

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
    if(!selectedVersionId&&conditions[0])setSelectedVersionId(conditions[0].condition_version_id);
    if(selectedVersionId&&!conditions.some(row=>row.condition_version_id===selectedVersionId)&&conditions[0])setSelectedVersionId(conditions[0].condition_version_id);
  },[conditions,selectedVersionId]);
  useEffect(()=>{
    if(!selectedVersion)return;
    setDraft(draftFromVersion(selectedVersion));
    setModuleEnabled(Object.fromEntries(selectedModules.map(module=>[module.module_key,Boolean(module.enabled)])));
    setModuleDraft(Object.fromEntries(selectedModules.filter(module=>module.instance_key==='default').map(module=>[module.module_key,{...(module.input_values||{})}])));
    setModuleConfigurations(selectedModules.map(toModuleConfiguration));
    const assigned=conditionData.roles.filter(row=>row.condition_version_id===selectedVersion.id);
    setRoleSelections(Object.fromEntries(assigned.map(role=>[role.role_key,role.measurement_id])));
    setLoadedVersionId(selectedVersion.id);
    setOutputsOpen(false);
    setMessage('');
  },[selectedVersion?.id,selectedVersion?.updated_at]);
  useEffect(()=>{if(stripV2&&viewMode!=='2d')setViewMode('2d');},[stripV2,viewMode]);
  useEffect(()=>{if(!availableTabs.includes(propertyTab))setPropertyTab('general');},[availableTabs,propertyTab]);
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
      if(role&&role.condition_version_id!==selectedVersionId){
        if(dirty)setPendingSwitch({versionId:role.condition_version_id,focusPlan:false});
        else{setSelectedVersionId(role.condition_version_id);setCreating(false);}
      }
    };
    const sheet=(event:Event)=>{const sheetId=String((event as CustomEvent<{sheetId?:string|null}>).detail?.sheetId||'')||null;setActiveSheetId(sheetId);};
    window.addEventListener('carez:takeoff-selection-change',selection as EventListener);
    window.addEventListener('carez:takeoff-sheet-change',sheet as EventListener);
    return()=>{window.removeEventListener('carez:takeoff-selection-change',selection as EventListener);window.removeEventListener('carez:takeoff-sheet-change',sheet as EventListener);};
  },[conditionData.roles,conditions,dirty,selectedVersionId]);

  const updateInput=(input:ConditionInputDefinition,value:string)=>{
    const parsed=input.valueType==='number'||input.valueType==='integer'?(value===''?'':Number(value)):input.valueType==='boolean'?value==='true':value;
    setDraft(current=>({...current,[input.group]:{...(current[input.group]||{}),[input.key]:parsed}}));
    setMessage('');
  };
  const setRole=(roleKey:string,measurementId:string)=>setRoleSelections(current=>{
    const next={...current};if(measurementId)for(const key of Object.keys(next))if(key!==roleKey&&next[key]===measurementId)next[key]='';next[roleKey]=measurementId;return next;
  });
  const updateModuleInput=(moduleKey:string,key:string,value:unknown)=>{setModuleDraft(current=>({...current,[moduleKey]:{...(current[moduleKey]||{}),[key]:value}}));setMessage('');};

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
      setSelectedVersionId(result.condition_version_id);setCreating(false);setContextTab('conditions');setMessage('');router.refresh();
    }catch(error:any){setMessage(error?.message||'Could not create condition.');}});
  };
  const saveCondition=(afterSave?:()=>void)=>{
    if(!selectedVersion||!definition)return;
    const roles=prepareConditionRoleAssignments(definition.roles,roleSelections);
    const primary=definition.roles.find(role=>role.primary);
    const anchorId=primary?roleSelections[primary.key]:'';
    if(!anchorId){setMessage(`Assign ${primary?.label||'the primary takeoff'} before calculating.`);return;}
    const {inputs,provenance}=prepareConditionAuthoringInputs(draft);
    const modulesForSave=stripV2?moduleConfigurations:selectedModules.map((module,index)=>({
      moduleKey:module.module_key,instanceKey:module.instance_key,label:module.label,enabled:moduleEnabled[module.module_key]!==false,
      inputValues:(moduleDraft[module.module_key]||module.input_values) as Record<string,any>,inputProvenance:module.input_provenance as Record<string,any>,
      legacyChildKey:module.legacy_child_key,sortOrder:module.sort_order||(index+1)*10,
    }));
    setMessage('Saving…');
    startTransition(async()=>{try{
      await saveAndRecalculateConcreteConditionPilot({
        conditionVersionId:selectedVersion.id,inputs,inputProvenance:provenance,modules:modulesForSave,
        measurementRoles:roles,compatibilityAnchorMeasurementId:anchorId,
      });
      setMessage('');
      afterSave?.();
      router.refresh();
    }catch(error:any){setMessage(error?.message||'Could not save condition.');}});
  };

  const renderInputGroup=(group:ConditionInputGroup)=>{
    const inputs=definition?.inputs.filter(input=>input.group===group)||[];
    if(!inputs.length)return <div className={styles.compactEmpty}>No inputs in this section.</div>;
    return <div className={styles.fieldGrid}>{inputs.map(input=>input.valueType==='boolean'
      ?<LabeledSwitch
        key={`${group}-${input.key}`}
        id={switchId(selectedVersionId||'draft',group,input.key)}
        checked={Boolean(draft[group]?.[input.key])}
        onCheckedChange={checked=>updateInput(input,checked?'true':'false')}
        disabled={locked||isPending}
        label={input.label}
        className={direction.switchField}
      />
      :<Field key={`${group}-${input.key}`} className={direction.propertyField}>
        <FieldLabel className={direction.propertyFieldLabel}>{input.label}</FieldLabel>
        {input.valueType==='select'?<Select value={String(draft[group]?.[input.key]??'')} onValueChange={value=>updateInput(input,String(value??''))} disabled={locked||isPending}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select…"/></SelectTrigger>
          <SelectContent align="start">{(input.options||['top','bottom','centerline']).map(option=><SelectItem key={option} value={option}>{humanize(option)}</SelectItem>)}</SelectContent>
        </Select>
        :input.valueType==='text'?<Input value={String(draft[group]?.[input.key]??'')} onChange={event=>updateInput(input,event.target.value)} disabled={locked||isPending}/>
        :<CarezNumberField value={String(draft[group]?.[input.key]??'')} onChange={event=>updateInput(input,event.target.value)} unit={input.unit} min={input.minimum} max={input.maximum} step={input.valueType==='integer'?1:'any'} disabled={locked||isPending}/>} 
      </Field>)}</div>;
  };

  const renderModule=(moduleKey:ConditionModuleKey)=>{
    const module=selectedModules.find(row=>row.module_key===moduleKey);
    if(!module)return <div className={styles.compactEmpty}>{MODULE_LABELS[moduleKey]} is not available for this condition.</div>;
    const enabled=moduleEnabled[moduleKey]!==false;
    const entries=Object.entries(moduleDraft[moduleKey]||{});
    return <>
      <div className={direction.moduleControlRow}>
        <LabeledSwitch
          id={switchId(selectedVersionId||'draft',moduleKey,'enabled')}
          checked={enabled}
          onCheckedChange={checked=>{setModuleEnabled(current=>({...current,[moduleKey]:checked}));setMessage('');}}
          disabled={locked||isPending}
          label="Include in Condition"
          description={enabled?'Included in this Condition':'Excluded from this Condition'}
          className="min-h-0 flex-1 border-0 bg-transparent p-0 data-[checked=true]:border-0 data-[checked=true]:bg-transparent"
        />
      </div>
      {enabled?(entries.length?<div className={styles.fieldGrid}>{entries.map(([key,value])=>typeof value==='boolean'
        ?<LabeledSwitch
          key={`${moduleKey}-${key}`}
          id={switchId(selectedVersionId||'draft',moduleKey,key)}
          checked={value}
          onCheckedChange={checked=>updateModuleInput(moduleKey,key,checked)}
          disabled={locked||isPending}
          label={humanize(key)}
          className={direction.switchField}
        />
        :<Field key={`${moduleKey}-${key}`} className={direction.propertyField}>
          <FieldLabel className={direction.propertyFieldLabel}>{humanize(key)}</FieldLabel>
          {typeof value==='number'?<CarezNumberField value={String(value)} onChange={event=>updateModuleInput(moduleKey,key,event.target.value===''?'':Number(event.target.value))} step="any" disabled={locked||isPending}/>
          :<Input value={String(value??'')} onChange={event=>updateModuleInput(moduleKey,key,event.target.value)} disabled={locked||isPending}/>} 
        </Field>)}</div>:<div className={styles.moduleReady}><CheckCircle2/><span>Included</span></div>):null}
    </>;
  };
  const moduleEditor=(moduleKey:ConditionModuleKey)=>stripV2&&definition?<ConditionModuleEditor definition={definition} moduleKey={moduleKey} modules={moduleConfigurations} onChange={modules=>{setModuleConfigurations(modules);setMessage('');}} disabled={locked||isPending}/>:renderModule(moduleKey);

  const contextPortal=sidebarHost?createPortal(<div className={`${styles.contextPortal} ${contextTab==='plans'?'':styles.contextPortalExpanded}`}>
    <div className={styles.contextTabs} role="tablist" aria-label="Takeoff navigator">
      {(['plans','conditions','zones'] as ContextTab[]).map(tab=><button key={tab} type="button" role="tab" aria-selected={contextTab===tab} className={contextTab===tab?styles.contextTabActive:styles.contextTab} onClick={()=>setContextTab(tab)}>{tab[0].toUpperCase()+tab.slice(1)}</button>)}
    </div>
    {contextTab==='conditions'?<div className={styles.contextBody}>
      <div className={styles.contextTools}><label><Search/><input value={conditionQuery} onChange={event=>setConditionQuery(event.target.value)} placeholder="Filter conditions"/></label><Button size="icon-sm" variant="outline" onClick={()=>setCreating(true)} disabled={locked}><Plus/></Button></div>
      {conditions.length?<CarezConditionTree searchable={false} nodes={treeNodes} selectedId={selectedVersionId} onSelect={node=>{if(conditions.some(row=>row.condition_version_id===node.id))requestConditionSelection(node.id);}}/>:<div className={styles.contextEmpty}>No conditions</div>}
    </div>:contextTab==='zones'?<div className={styles.contextBody}><div className={styles.paneLabel}>Zones</div>{zones.length?<div className={styles.zoneList}>{zones.map(zone=><div key={zone.label}><span>{zone.label}</span><b>{zone.count}</b></div>)}</div>:<div className={styles.contextEmpty}>No zones assigned</div>}</div>:null}
  </div>,sidebarHost):null;

  const firstHoldTab=selectedHolds.length?tabForHold(selectedHolds[0]):'general';
  const safeHoldTab=(hold:ConditionData['holds'][number])=>{const tab=tabForHold(hold);return availableTabs.includes(tab)?tab:'general';};

  return <div className={styles.integrated} data-context-tab={contextTab} data-view-mode={viewMode}>
    <div className={styles.drawingHost} ref={drawingHostRef}>
      <TakeoffDrawingWorkspace {...workspaceProps} conditionAuthoringActive conditionMeasurementIds={conditionMeasurementIds}/>
      {contextPortal}
      <div className={direction.drawingViewModes} aria-label="Takeoff view controls">
        <div className={styles.viewModeSwitch} role="tablist" aria-label="Takeoff view mode">{(['2d','3d','split'] as ViewMode[]).map(mode=><button key={mode} type="button" role="tab" aria-selected={viewMode===mode} className={viewMode===mode?styles.viewModeActive:''} disabled={stripV2&&mode!=='2d'} title={stripV2&&mode!=='2d'?'3D verification is not available for this Condition version.':undefined} onClick={()=>setViewMode(mode)}>{mode==='2d'?'2D':mode==='3d'?'3D':'Split'}</button>)}</div>
      </div>
      {viewMode!=='2d'&&!stripV2&&<div className={`${styles.derivedOverlay} ${viewMode==='split'?styles.derivedOverlaySplit:styles.derivedOverlay3d}`} style={{bottom:dockHeight}}>
        <TakeoffDerived3DView scene={derived3DScene} activeSheetId={activeSheetId} activeSheetLabel={activeSheetLabel} selectedConditionVersionId={selectedVersionId} selectedMeasurementId={selectedMeasurementId} onSelectSolid={selectDerivedSolid} onJumpToIssue={jumpToDerivedIssue}/>
      </div>}
    </div>
    <aside className={styles.propertiesPane} aria-label="Condition Properties">
      <header className={styles.propertiesHeader}>
        <div><span>Condition Properties</span><strong>{creating?'New condition':selectedSummary?.name||'No condition selected'}</strong>{selectedSummary?<small>{selectedSummary.code} · R{selectedSummary.revision_no} · {humanize(selectedSummary.version_status)}</small>:null}</div>
      </header>

      {creating?<div className={styles.createPane}>
        <div className={styles.familyList}>{(Object.keys(CONDITION_ARCHETYPES) as ConditionArchetypeKey[]).map(key=>{const item=CONDITION_ARCHETYPES[key];return <button type="button" key={key} className={family===key?styles.familyActive:styles.familyButton} onClick={()=>chooseFamily(key)}><b>{item.primaryUnit}</b><span>{item.name}</span></button>;})}</div>
        <Field className={direction.propertyField}><FieldLabel className={direction.propertyFieldLabel}>Condition name</FieldLabel><Input value={createName} onChange={event=>{const name=event.target.value;setCreateName(name);if(!codeTouched)setCreateCode(conditionCodeFromName(name));}}/></Field>
        <Field className={direction.propertyField}><FieldLabel className={direction.propertyFieldLabel}>Code</FieldLabel><Input value={createCode} onChange={event=>{setCodeTouched(true);setCreateCode(event.target.value.toUpperCase());}}/></Field>
        <div className={styles.createActions}><Button variant="outline" onClick={()=>setCreating(false)}>Cancel</Button><Button onClick={createCondition} disabled={locked||isPending||!createName.trim()||!createCode.trim()}>{isPending?<RefreshCw className={styles.spin}/>:<Plus/>}Create</Button></div>
        <div className={styles.statusLine} role="status">{message}</div>
      </div>:!selectedSummary||!selectedVersion||!definition?<div className={styles.propertiesEmpty}><Layers3/><strong>Select a condition</strong></div>:<>
        <div className={direction.conditionSummaryLine}>
          <span className={styles.conditionColor} data-family={selectedSummary.archetype_code}/>
          <span className={direction.summaryMeta}>{selectedSummary.measurement_count} takeoff{selectedSummary.measurement_count===1?'':'s'} · {selectedSummary.output_count} outputs</span>
          {selectedHolds.length?<button type="button" className={direction.summaryHold} onClick={()=>setPropertyTab(availableTabs.includes(firstHoldTab)?firstHoldTab:'general')}>{selectedHolds.length} hold{selectedHolds.length===1?'':'s'}</button>:null}
        </div>
        {selectedHolds.length?<div className={direction.holdsDock} aria-label="Open Condition holds">{selectedHolds.map(hold=><button key={hold.id} type="button" className={direction.holdRow} onClick={()=>setPropertyTab(safeHoldTab(hold))}><AlertTriangle/><span className={direction.holdText}><strong>{humanize(hold.hold_code)}</strong><small>{hold.message}</small></span><span className={direction.holdJump}>{humanize(safeHoldTab(hold))} →</span></button>)}</div>:null}
        <Tabs value={propertyTab} onValueChange={value=>setPropertyTab(value as PropertyTab)} className={styles.tabsWrap}>
          <TabsList variant="line" className={styles.tabsList}>{availableTabs.map(tab=><TabsTrigger key={tab} value={tab}>{tab[0].toUpperCase()+tab.slice(1)}</TabsTrigger>)}</TabsList>
        </Tabs>
        <div className={styles.propertiesScroll}>
          {propertyTab==='general'?<>
            <section className={styles.propertySection}><div className={styles.sectionHead}><Ruler/><strong>Takeoff roles</strong></div><div className={styles.roleList}>{definition.roles.map(role=>{const choices=measurements.filter((measurement:any)=>conditionMeasurementMatchesRole(measurement,role,compatibilityAssemblyVersionId));return <div className={styles.roleRow} key={role.key}><div><strong>{role.label}</strong><small>{role.unit}{role.primary?' · Primary':' · Optional'}</small></div><ConditionRolePicker value={roleSelections[role.key]||''} choices={choices.map((measurement:any)=>{const sheet=sheets.find((item:any)=>item.id===measurement.sheet_id);return{id:measurement.id,label:measurement.name,meta:`${quantity(measurement.raw_quantity,measurement.raw_unit)} · ${sheet?.sheet_number||`Page ${sheet?.page_number||'?'}`}`};})} placeholder={role.required?'Select takeoff…':'Not used'} emptyLabel={role.required?'No takeoff selected':'Not used'} disabled={locked||isPending} onChange={value=>setRole(role.key,value)}/><Button size="sm" variant="outline" onClick={()=>startTakeoff(role)} disabled={locked||isPending}>Draw {role.unit}</Button></div>;})}</div></section>
            <section className={styles.propertySection}><div className={styles.sectionHead}><strong>Dimensions</strong></div>{renderInputGroup('planFacts')}</section>
            {stripV2?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Concrete</strong><small>Profile · mix · placement</small></div>{moduleEditor('concrete')}</section>:null}
          </>:null}
          {propertyTab==='rebar'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Rebar</strong>{stripV2?<small>Repeatable sets</small>:null}</div>{moduleEditor('reinforcing')}</section>:null}
          {propertyTab==='forms'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Forms</strong>{stripV2?<small>Sides · material · stakes</small>:null}</div>{moduleEditor('forms')}</section>:null}
          {propertyTab==='excavation'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Excavation / backfill</strong></div>{moduleEditor('excavation_backfill')}</section>:null}
          {propertyTab==='labor'?<><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Production</strong></div>{renderInputGroup('production')}</section>{supportsModule('labor')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Labor outputs</strong></div>{moduleEditor('labor')}</section>:null}</>:null}
          {propertyTab==='drawing'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Drawing</strong></div>{renderInputGroup('drawing')}</section>:null}
          {propertyTab==='more'?<>
            {definition.inputs.some(input=>input.group==='methods')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Methods</strong></div>{renderInputGroup('methods')}</section>:null}
            {definition.inputs.some(input=>input.group==='commercial')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Commercial / procurement</strong></div>{renderInputGroup('commercial')}</section>:null}
            {!stripV2&&supportsModule('concrete')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Concrete</strong></div>{moduleEditor('concrete')}</section>:null}
            {supportsModule('anchors_embeds')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Anchors / embeds</strong>{stripV2?<small>Repeatable sets</small>:null}</div>{moduleEditor('anchors_embeds')}</section>:null}
            {supportsModule('slab_systems')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Slab systems</strong></div>{moduleEditor('slab_systems')}</section>:null}
            {supportsModule('placement_equipment')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Placement / equipment</strong></div>{moduleEditor('placement_equipment')}</section>:null}
            {supportsModule('finish_cure_protection')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Finish / cure / protection</strong></div>{moduleEditor('finish_cure_protection')}</section>:null}
            {supportsModule('miscellaneous')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Miscellaneous</strong>{stripV2?<small>Repeatable items</small>:null}</div>{moduleEditor('miscellaneous')}</section>:null}
          </>:null}

          <Collapsible open={outputsOpen} onOpenChange={setOutputsOpen} className={styles.propertySection}>
            <CollapsibleTrigger className={`${styles.sectionHead} ${direction.collapsibleTrigger}`}>
              <CheckCircle2/><strong>Calculated outputs</strong>
              <span className={`${direction.outputSummary} ${Number(selectedSummary.held_output_count)?direction.outputSummaryHeld:''}`}>{selectedOutputs.length} outputs · {money(totalDirectCost)}{Number(selectedSummary.held_output_count)?` · ${selectedSummary.held_output_count} held`:''}</span>
              <ChevronDown className={`${direction.outputChevron} ${outputsOpen?direction.outputChevronOpen:''}`}/>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CarezDataGrid isEmpty={!selectedOutputs.length} empty={<div className={styles.gridEmpty}>Assign the primary takeoff and save to calculate outputs.</div>}><CarezDataGridTable><CarezDataGridHead><CarezDataGridRow><CarezDataGridHeaderCell>Output</CarezDataGridHeaderCell><CarezDataGridHeaderCell numeric>Quantity</CarezDataGridHeaderCell><CarezDataGridHeaderCell numeric>Cost</CarezDataGridHeaderCell></CarezDataGridRow></CarezDataGridHead><CarezDataGridBody>{selectedOutputs.map(output=><CarezDataGridRow key={output.id}><CarezDataGridCell><strong>{output.label}</strong><small className={styles.outputMeta}>{humanize(output.status)}</small></CarezDataGridCell><CarezDataGridCell numeric>{quantity(output.production_quantity,output.production_unit)}</CarezDataGridCell><CarezDataGridCell numeric>{money(output.direct_cost)}</CarezDataGridCell></CarezDataGridRow>)}</CarezDataGridBody></CarezDataGridTable></CarezDataGrid>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <footer className={styles.propertiesFooter}><span className={dirty&&!message?direction.dirtyStatus:undefined} role="status">{message||(dirty?'Unsaved changes':'')}</span><Button onClick={()=>saveCondition()} disabled={locked||isPending||selectedVersion.status!=='draft'||!dirty}>{isPending?<RefreshCw className={styles.spin}/>:<Save/>}Save & recalculate</Button></footer>
      </>}
    </aside>

    <Dialog open={Boolean(pendingSwitch)} onOpenChange={open=>{if(!open)setPendingSwitch(null);}}>
      <DialogContent showCloseButton={false}>
        <DialogHeader><DialogTitle>Unsaved Condition changes</DialogTitle><DialogDescription>Save this Condition before switching, or discard the current edits.</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>setPendingSwitch(null)} disabled={isPending}>Cancel</Button>
          <Button variant="outline" onClick={()=>{const next=pendingSwitch;setPendingSwitch(null);if(next)applyConditionSelection(next.versionId,next.focusPlan);}} disabled={isPending}>Discard</Button>
          <Button onClick={()=>{const next=pendingSwitch;if(next)saveCondition(()=>{setPendingSwitch(null);applyConditionSelection(next.versionId,next.focusPlan);});}} disabled={isPending}>Save & switch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
