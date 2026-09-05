'use client';

import {createPortal} from 'react-dom';
import {useEffect,useMemo,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {AlertTriangle,CheckCircle2,ChevronDown,Layers3,Plus,RefreshCw,Ruler,Save,Search} from 'lucide-react';
import {
  assignConditionPrimaryTakeoffSection,
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
  type BuildDerived3DSceneInput,
  type Derived3DGeometryCache,
} from '@/lib/takeoff/conditions/derived3d';
import {
  buildConditionIssues,
  conditionOutputStatus,
  pricedDirectCostSummary,
  summarizeConditionIssues,
  type ConditionIssue,
} from '@/lib/takeoff/conditions/issues';
import {STRIP_FOOTING_V2_DEFINITION} from '@/lib/takeoff/conditions/stripFootingV2';
import {STRIP_FOOTING_V3_DEFINITION} from '@/lib/takeoff/conditions/stripFootingV3';
import type {ConditionWorksheetAuthority} from '@/lib/takeoff/conditionWorksheet';
import type {
  ConditionArchetypeKey,
  ConditionInputDefinition,
  ConditionInputGroup,
  ConditionModuleConfiguration,
  ConditionModuleKey,
} from '@/lib/takeoff/conditions/types';
import {ConditionModuleEditor} from './ConditionModuleEditor';
import {ConditionRolePicker} from './ConditionRolePicker';
import {TakeoffDerived3DView, TakeoffDerived3DBoundary, type Derived3DViewState, type Derived3DViewMemory} from './TakeoffDerived3DView';
import {resolvedPhysicalInputs} from '@/lib/takeoff/conditions/derived3d/sources';
import {TakeoffDrawingWorkspace} from './TakeoffDrawingWorkspace';
import direction from './ConditionPropertiesDirectionA.module.css';
import styles from './IntegratedTakeoffConditionWorkspace.module.css';

type ConditionSummary={
  condition_id:string;condition_version_id:string;code:string;name:string;revision_no:number;version_status:string;
  template_version_id:string;archetype_code:ConditionArchetypeKey;archetype_name:string;measurement_count:number;
  output_count:number;held_output_count:number;open_hold_count:number;direct_cost:number|string;
};
type ConditionVersion={
  id:string;template_version_id:string;archetype_version_id:string;status:string;plan_facts:Record<string,unknown>;method_inputs:Record<string,unknown>;
  production_inputs:Record<string,unknown>;commercial_inputs:Record<string,unknown>;drawing_inputs:Record<string,unknown>;updated_at:string;
};
type ConditionModule={
  condition_version_id:string;module_key:ConditionModuleKey;instance_key:string;label:string;enabled:boolean;
  input_values:Record<string,any>;input_provenance:Record<string,any>;legacy_child_key:string|null;sort_order:number;
};
type ConditionOutputRow={
  id:string;condition_version_id:string;output_key:string;label:string;production_quantity:number|string|null;production_unit:string;
  status:string;direct_cost:number|string;pricing_status:string;generated_estimate_item_id:string|null;
};
type ConditionHoldRow={id:string;condition_version_id:string;output_id:string|null;hold_code:string;status:string;message:string};
type ConditionData={
  derived3DSnapshot?:BuildDerived3DSceneInput;
  conditions:ConditionSummary[];
  versions:ConditionVersion[];
  templateVersions:Array<{id:string;archetype_version_id:string;legacy_assembly_version_id:string|null;input_defaults?:any;input_provenance?:any}>;
  archetypeVersions:Array<{id:string;version_no:number;archetype_code_snapshot:string;status:string;engine_key:string}>;
  modules:ConditionModule[];
  roles:Array<{condition_version_id:string;measurement_id:string;role_key:string;role_instance_key:string;sort_order:number}>;
  outputs:ConditionOutputRow[];
  holds:ConditionHoldRow[];
  reconciliation:Array<{condition_version_id:string;output_key:string;reconciliation_status:string}>;
};
type Props={setId:string;workspaceProps:any;conditionData:ConditionData};
type ContextTab='plans'|'conditions'|'zones';
type PropertyTab='general'|'concrete'|'rebar'|'forms'|'embeds'|'excavation'|'placement'|'finish'|'labor'|'review'|'drawing'|'more';
type ViewMode='2d'|'3d'|'split';
type PendingSwitch={versionId:string;focusPlan:boolean;measurementId?:string|null;propertyTab?:PropertyTab;viewMode?:ViewMode};

const MODULE_LABELS:Record<ConditionModuleKey,string>={
  concrete:'Concrete',forms:'Forms',reinforcing:'Reinforcing',anchors_embeds:'Anchors / embeds',slab_systems:'Slab systems',
  excavation_backfill:'Excavation / backfill',placement_equipment:'Placement / equipment',finish_cure_protection:'Finish / cure / protection',labor:'Labor',miscellaneous:'Miscellaneous',
};
const TAB_LABELS:Record<PropertyTab,string>={
  general:'Scope',concrete:'Concrete',forms:'Forms',rebar:'Rebar',embeds:'Embeds',excavation:'Excavation',placement:'Placement',finish:'Finish / cure',labor:'Labor',review:'Review',drawing:'Drawing',more:'More',
};
const LABOR_ACTIVITIES=[
  ['place_concrete','Place concrete'],['forms','Forms'],['reinforcing','Reinforcing'],['anchors_embeds','Anchors / embeds'],
  ['excavation','Excavation'],['backfill','Backfill'],['finish','Finish concrete'],['cure_protection','Cure / protection'],['misc','Miscellaneous'],
] as const;
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
  .map(module=>({moduleKey:module.moduleKey,instanceKey:module.instanceKey||'',label:module.label||'',enabled:Boolean(module.enabled),inputValues:module.inputValues||{},legacyChildKey:module.legacyChildKey||null,sortOrder:Number(module.sortOrder||0)}))
  .sort((a,b)=>`${a.moduleKey}:${a.instanceKey}`.localeCompare(`${b.moduleKey}:${b.instanceKey}`));
const roleSignature=(roles:Record<string,string>)=>Object.entries(roles).sort(([a],[b])=>a.localeCompare(b));
const tabForHold=(hold:{hold_code?:string;message:string}):PropertyTab=>{
  const text=`${hold.hold_code||''} ${hold.message}`.toLowerCase();
  if(/rebar|reinforc/.test(text))return'rebar';
  if(/form/.test(text))return'forms';
  if(/excavat|backfill/.test(text))return'excavation';
  if(/labor|production|hour|crew/.test(text))return'labor';
  if(/3d|draw|elev/.test(text))return'drawing';
  if(/anchor|embed/.test(text))return'embeds';
  if(/placement|pump|equipment/.test(text))return'placement';
  if(/finish|cure|protect/.test(text))return'finish';
  if(/price|procure|commercial/.test(text))return'review';
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
  const [derivedViewState,setDerivedViewState]=useState<Derived3DViewState>({hidden:[],isolated:null,zone:'all',elevation:'all'});
  const derivedMemory=useRef<Derived3DViewMemory>(new Map());
  const derivedCache=useRef<Derived3DGeometryCache>(new Map());
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
  const sections=workspaceProps.sections||[];
  const assemblies=workspaceProps.assemblies||[];
  const assemblyVersions=workspaceProps.versions||[];
  const scaleRegionMap=useMemo(()=>new Map<string,any>((workspaceProps.scaleRegions||[]).map((region:any)=>[region.id,region])),[workspaceProps.scaleRegions]);
  const conditions=useMemo(()=>currentConditionRows(conditionData.conditions||[]),[conditionData.conditions]);
  const selectedSummary=conditions.find(row=>row.condition_version_id===selectedVersionId)||null;
  const selectedVersion=conditionData.versions.find(row=>row.id===selectedVersionId)||null;
  const selectedArchetypeVersion=selectedVersion?conditionData.archetypeVersions.find(row=>row.id===selectedVersion.archetype_version_id)||null:null;
  const stripContractVersion=selectedSummary?.archetype_code==='strip_wall_footing'?Number(selectedArchetypeVersion?.version_no||1):0;
  const stripModern=stripContractVersion>=2;
  const stripV3=stripContractVersion>=3;
  const templateVersion=selectedVersion?conditionData.templateVersions.find(row=>row.id===selectedVersion.template_version_id)||null:null;
  const compatibilityAssemblyVersionId=templateVersion?.legacy_assembly_version_id||null;
  const selectedModules=useMemo(()=>selectedVersionId?conditionData.modules.filter(row=>row.condition_version_id===selectedVersionId).sort((a,b)=>a.sort_order-b.sort_order):[],[conditionData.modules,selectedVersionId]);
  const definition=selectedSummary?(stripV3?STRIP_FOOTING_V3_DEFINITION:stripModern?STRIP_FOOTING_V2_DEFINITION:conditionArchetype(selectedSummary.archetype_code)):null;
  const selectedOutputs=selectedVersionId?conditionData.outputs.filter(row=>row.condition_version_id===selectedVersionId):[];
  const selectedHolds=selectedVersionId?conditionData.holds.filter(row=>row.condition_version_id===selectedVersionId&&row.status==='open'):[];
  const selectedIssues=useMemo(()=>buildConditionIssues(selectedHolds,selectedOutputs),[selectedHolds,selectedOutputs]);
  const selectedIssueSummary=useMemo(()=>summarizeConditionIssues(selectedIssues),[selectedIssues]);
  const costSummary=useMemo(()=>pricedDirectCostSummary(selectedOutputs),[selectedOutputs]);
  const activeOutputCount=selectedOutputs.filter(output=>output.status!=='inactive').length;
  const activeSheet=sheets.find((sheet:any)=>sheet.id===activeSheetId)||sheets[0]||null;
  const activeSheetLabel=activeSheet?.sheet_number||`Page ${activeSheet?.page_number||'—'}`;

  const supportsModule=(moduleKey:ConditionModuleKey)=>Boolean(
    selectedModules.some(module=>module.module_key===moduleKey)||definition?.modules?.some(module=>module.key===moduleKey)||definition?.defaultModules.includes(moduleKey)
  );
  const moduleIncluded=(moduleKey:ConditionModuleKey)=>{
    const source=stripModern?moduleConfigurations:selectedModules.map(toModuleConfiguration);
    return source.some(module=>module.moduleKey===moduleKey&&module.enabled);
  };
  const availableTabs=useMemo<PropertyTab[]>(()=>{
    if(!definition)return['general'];
    if(stripV3)return['general','concrete','forms','rebar','embeds','excavation','placement','finish','labor','review','drawing'];
    const tabs:PropertyTab[]=['general'];
    if(supportsModule('reinforcing'))tabs.push('rebar');
    if(supportsModule('forms'))tabs.push('forms');
    if(supportsModule('excavation_backfill'))tabs.push('excavation');
    if(definition.inputs.some(input=>input.group==='production')||supportsModule('labor'))tabs.push('labor');
    if(definition.inputs.some(input=>input.group==='drawing'))tabs.push('drawing');
    const hasMore=definition.inputs.some(input=>input.group==='methods'||input.group==='commercial')||['concrete','anchors_embeds','slab_systems','placement_equipment','finish_cure_protection','miscellaneous'].some(key=>supportsModule(key));
    if(hasMore)tabs.push('more');
    return tabs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[definition,selectedModules,stripV3]);

  const persistedRoles=useMemo(()=>Object.fromEntries(conditionData.roles.filter(row=>row.condition_version_id===selectedVersionId).map(role=>[role.role_key,role.measurement_id])),[conditionData.roles,selectedVersionId]);
  const currentModulesForSignature=useMemo<ConditionModuleConfiguration[]>(()=>{
    if(stripModern)return moduleConfigurations;
    return selectedModules.map(module=>({...toModuleConfiguration(module),enabled:moduleEnabled[module.module_key]!==false,inputValues:module.instance_key==='default'?(moduleDraft[module.module_key]||module.input_values):module.input_values}));
  },[stripModern,moduleConfigurations,selectedModules,moduleEnabled,moduleDraft]);
  const persistedSignature=useMemo(()=>selectedVersion?JSON.stringify({draft:draftFromVersion(selectedVersion),modules:moduleSignature(selectedModules.map(toModuleConfiguration)),roles:roleSignature(persistedRoles)}):'',[selectedVersion,selectedModules,persistedRoles]);
  const currentSignature=useMemo(()=>selectedVersion?JSON.stringify({draft,modules:moduleSignature(currentModulesForSignature),roles:roleSignature(roleSelections)}):'',[selectedVersion,draft,currentModulesForSignature,roleSelections]);
  const dirty=Boolean(selectedVersion&&loadedVersionId===selectedVersion.id&&currentSignature!==persistedSignature);
  const conditionMeasurementIds=useMemo(()=>Array.from(new Set([...(conditionData.roles||[]).map(role=>role.measurement_id).filter(Boolean),...Object.values(roleSelections).filter(Boolean)])),[conditionData.roles,roleSelections]);

  const contractForVersion=(versionId:string)=>{
    const summary=conditions.find(row=>row.condition_version_id===versionId);
    const version=conditionData.versions.find(row=>row.id===versionId);
    if(!summary||!version)return{definition:null as typeof definition,versionNo:0};
    const versionNo=Number(conditionData.archetypeVersions.find(row=>row.id===version.archetype_version_id)?.version_no||1);
    return{definition:summary.archetype_code==='strip_wall_footing'?(versionNo>=3?STRIP_FOOTING_V3_DEFINITION:versionNo>=2?STRIP_FOOTING_V2_DEFINITION:conditionArchetype(summary.archetype_code)):conditionArchetype(summary.archetype_code),versionNo};
  };

  const conditionWorksheetAuthorities=useMemo<ConditionWorksheetAuthority[]>(()=>conditions.flatMap(summary=>{
    const contract=contractForVersion(summary.condition_version_id).definition;
    if(!contract)return[];
    const primary=contract.roles.find(role=>role.primary);
    if(!primary)return[];
    const isSelected=summary.condition_version_id===selectedVersionId;
    const persistedPrimary=conditionData.roles.find(role=>role.condition_version_id===summary.condition_version_id&&role.role_key===primary.key)?.measurement_id||'';
    const measurementId=isSelected?(roleSelections[primary.key]||persistedPrimary):persistedPrimary;
    if(!measurementId)return[];
    const outputs=conditionData.outputs.filter(row=>row.condition_version_id===summary.condition_version_id);
    const holds=conditionData.holds.filter(row=>row.condition_version_id===summary.condition_version_id&&row.status==='open');
    const pending=Boolean(isSelected&&dirty);
    return[{measurementId,conditionVersionId:summary.condition_version_id,conditionName:summary.name,calculated:outputs.length>0&&!pending,pendingRecalculation:pending&&outputs.length>0,outputs,holds}];
  // contractForVersion is stable across the supplied canonical data for this render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }),[conditions,conditionData.roles,conditionData.outputs,conditionData.holds,selectedVersionId,roleSelections,dirty]);

  useEffect(()=>{
    const send=()=>window.dispatchEvent(new CustomEvent('carez:condition-worksheet-state',{detail:{authorities:conditionWorksheetAuthorities}}));
    send();
    window.addEventListener('carez:condition-worksheet-request',send);
    return()=>window.removeEventListener('carez:condition-worksheet-request',send);
  },[conditionWorksheetAuthorities]);

  const derived3DScene=useMemo(()=>{
    const saved=conditionData.derived3DSnapshot;
    if(!saved)return buildDerived3DScene({scopeKey:setId,conditions:[],measurements:[],sheets:[]});
    if(!dirty||!selectedVersion)return buildDerived3DScene(saved,derivedCache.current);
    const {inputs,provenance}=prepareConditionAuthoringInputs(draft);
    const effective=resolvedPhysicalInputs({companyDefaults:templateVersion?.input_defaults,companyProvenance:templateVersion?.input_provenance,projectValues:inputs,projectProvenance:provenance});
    const concrete=currentModulesForSignature.find(module=>module.moduleKey==='concrete'&&(module.instanceKey||'default')==='default');
    const preview={...saved,state:'preview' as const,conditions:saved.conditions.map(source=>{
      if(source.conditionVersionId!==selectedVersion.id)return source;
      return{...source,...effective,concreteProfile:concrete?{enabled:Boolean(concrete.enabled),profile:concrete.inputValues?.profile,topWidthFt:concrete.inputValues?.top_width_ft}:source.concreteProfile,roles:Object.entries(roleSelections).filter(([,id])=>id).map(([roleKey,measurementId])=>({roleKey,measurementId,roleInstanceKey:source.roles.find(role=>role.roleKey===roleKey)?.roleInstanceKey||`${roleKey}-1`}))};
    })};
    return buildDerived3DScene(preview,derivedCache.current);
  },[conditionData.derived3DSnapshot,setId,dirty,selectedVersion,draft,templateVersion,currentModulesForSignature,roleSelections]);
  const drawingPresentation=useMemo(()=>{
    const hidden=new Set<string>();const colors:Record<string,string>={};
    for(const source of conditionData.derived3DSnapshot?.conditions||[])for(const role of source.roles){
      const measurement=measurements.find((m:any)=>m.id===role.measurementId);
      colors[role.measurementId]=source.color;
      const shapes=derived3DScene.solids.filter(solid=>solid.measurementId===role.measurementId);
      if(derivedViewState.hidden.includes(source.conditionVersionId)||(derivedViewState.isolated&&derivedViewState.isolated!==source.conditionVersionId)||(derivedViewState.zone!=='all'&&String(measurement?.location||'').trim()!==derivedViewState.zone)||(derivedViewState.elevation!=='all'&&shapes.length>0&&!shapes.some(solid=>String(solid.shape.top)===derivedViewState.elevation)))hidden.add(role.measurementId);
    }
    return{hiddenMeasurementIds:[...hidden],colors};
  },[conditionData.derived3DSnapshot,measurements,derived3DScene,derivedViewState]);

  const treeNodes=useMemo<CarezConditionTreeNode[]>(()=>{
    const query=conditionQuery.trim().toLowerCase();
    const visible=conditions.filter(row=>!query||[row.code,row.name,row.archetype_name].some(value=>String(value||'').toLowerCase().includes(query)));
    const child=(row:ConditionSummary):CarezConditionTreeNode=>{
      const rowOutputs=conditionData.outputs.filter(output=>output.condition_version_id===row.condition_version_id);
      const rowHolds=conditionData.holds.filter(hold=>hold.condition_version_id===row.condition_version_id&&hold.status==='open');
      const issueCount=buildConditionIssues(rowHolds,rowOutputs).length;
      const isDirty=row.condition_version_id===selectedVersionId&&dirty;
      return{id:row.condition_version_id,label:row.name,status:isDirty?'Unsaved':issueCount?`${issueCount} issue${issueCount===1?'':'s'}`:rowOutputs.length?'Ready':'Not calculated',color:conditionData.derived3DSnapshot?.conditions.find(source=>source.conditionVersionId===row.condition_version_id)?.color||conditionColor(row.archetype_code),hidden:derivedViewState.hidden.includes(row.condition_version_id)};
    };
    return[{id:'condition-group-footings',label:'Footings',children:visible.filter(row=>row.archetype_code!=='slab_on_grade').map(child)},{id:'condition-group-slabs',label:'Slabs',children:visible.filter(row=>row.archetype_code==='slab_on_grade').map(child)}];
  },[conditions,conditionQuery,conditionData.outputs,conditionData.holds,conditionData.derived3DSnapshot,selectedVersionId,dirty,derivedViewState.hidden]);

  const zones=useMemo(()=>{const counts=new Map<string,number>();for(const measurement of measurements){const label=String(measurement.location||'').trim();if(label)counts.set(label,(counts.get(label)||0)+1);}return[...counts].map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label));},[measurements]);
  const focusMeasurement=(measurementId:string|null)=>{setSelectedMeasurementId(measurementId);};
  const applyConditionSelection=(versionId:string,focusPlan=true,measurementId?:string|null,nextTab?:PropertyTab,nextMode?:ViewMode)=>{
    setSelectedVersionId(versionId);setCreating(false);
    if(nextTab)setPropertyTab(nextTab);if(nextMode)setViewMode(nextMode);
    if(measurementId!==undefined){focusMeasurement(measurementId);return;}
    if(!focusPlan)return;
    const contract=contractForVersion(versionId).definition;if(!contract)return;
    const primary=contract.roles.find(role=>role.primary);const assigned=primary?conditionData.roles.find(role=>role.condition_version_id===versionId&&role.role_key===primary.key):null;
    focusMeasurement(assigned?.measurement_id||null);
  };
  const requestConditionSelection=(versionId:string,focusPlan=true,measurementId?:string|null,nextTab?:PropertyTab,nextMode?:ViewMode)=>{
    if(versionId!==selectedVersionId&&dirty){setPendingSwitch({versionId,focusPlan,measurementId,propertyTab:nextTab,viewMode:nextMode});return;}
    applyConditionSelection(versionId,focusPlan,measurementId,nextTab,nextMode);
  };
  const requestMeasurementSelection=(measurementId:string|null)=>{
    const role=conditionData.roles.find(role=>role.measurement_id===measurementId&&conditions.some(row=>row.condition_version_id===role.condition_version_id));
    if(role){requestConditionSelection(role.condition_version_id,false,measurementId);return;}
    focusMeasurement(measurementId);
  };
  const selectDerivedSolid=(solid:Derived3DSolid)=>requestConditionSelection(solid.conditionVersionId,false,solid.measurementId);
  const jumpToDerivedIssue=(entry:Derived3DIssue)=>requestConditionSelection(entry.conditionVersionId,false,entry.measurementId,entry.target||'drawing','split');

  useEffect(()=>{const findSidebar=()=>setSidebarHost(drawingHostRef.current?.querySelector('aside') as HTMLElement|null);findSidebar();const id=window.setTimeout(findSidebar,0);return()=>window.clearTimeout(id);},[]);
  useEffect(()=>{const host=drawingHostRef.current;if(!host)return;let observer:ResizeObserver|null=null;let timer=0;const attach=()=>{const dock=host.querySelector<HTMLElement>('[aria-label="Takeoff quantity worksheet"]');if(!dock)return false;const update=()=>setDockHeight(Math.max(38,Math.round(dock.getBoundingClientRect().height)));update();observer=new ResizeObserver(update);observer.observe(dock);return true;};if(!attach())timer=window.setTimeout(()=>{attach();},0);return()=>{if(timer)window.clearTimeout(timer);observer?.disconnect();};},[]);
  useEffect(()=>{if(!selectedVersionId&&conditions[0])setSelectedVersionId(conditions[0].condition_version_id);if(selectedVersionId&&!conditions.some(row=>row.condition_version_id===selectedVersionId)&&conditions[0])setSelectedVersionId(conditions[0].condition_version_id);},[conditions,selectedVersionId]);
  useEffect(()=>{if(!selectedVersion)return;setDraft(draftFromVersion(selectedVersion));setModuleEnabled(Object.fromEntries(selectedModules.map(module=>[module.module_key,Boolean(module.enabled)])));setModuleDraft(Object.fromEntries(selectedModules.filter(module=>module.instance_key==='default').map(module=>[module.module_key,{...(module.input_values||{})}])));setModuleConfigurations(selectedModules.map(toModuleConfiguration));const assigned=conditionData.roles.filter(row=>row.condition_version_id===selectedVersion.id);setRoleSelections(Object.fromEntries(assigned.map(role=>[role.role_key,role.measurement_id])));setLoadedVersionId(selectedVersion.id);setOutputsOpen(false);setMessage('');},[selectedVersion?.id,selectedVersion?.updated_at]);
  useEffect(()=>{if(!availableTabs.includes(propertyTab))setPropertyTab('general');},[availableTabs,propertyTab]);
  useEffect(()=>{const open=()=>{setContextTab('conditions');setCreating(false);};window.addEventListener('carez:open-conditions',open);return()=>window.removeEventListener('carez:open-conditions',open);},[]);
  useEffect(()=>{const sheet=(event:Event)=>{const sheetId=String((event as CustomEvent<{sheetId?:string|null}>).detail?.sheetId||'')||null;setActiveSheetId(sheetId);};window.addEventListener('carez:takeoff-sheet-change',sheet as EventListener);return()=>window.removeEventListener('carez:takeoff-sheet-change',sheet as EventListener);},[]);


  const updateInput=(input:ConditionInputDefinition,value:string)=>{const parsed=input.valueType==='number'||input.valueType==='integer'?(value===''?'':Number(value)):input.valueType==='boolean'?value==='true':value;setDraft(current=>({...current,[input.group]:{...(current[input.group]||{}),[input.key]:parsed}}));setMessage('');};
  const setRole=(roleKey:string,measurementId:string)=>setRoleSelections(current=>{const next={...current};if(measurementId)for(const key of Object.keys(next))if(key!==roleKey&&next[key]===measurementId)next[key]='';next[roleKey]=measurementId;setMessage('');return next;});
  const updateModuleInput=(moduleKey:string,key:string,value:unknown)=>{setModuleDraft(current=>({...current,[moduleKey]:{...(current[moduleKey]||{}),[key]:value}}));setMessage('');};
  const assemblyVersionForRole=(role:any)=>{if(role.primary&&compatibilityAssemblyVersionId)return compatibilityAssemblyVersionId;const ids=new Set(assemblies.filter((row:any)=>row.category==='Concrete Conditions'&&row.primary_measurement===role.unit).map((row:any)=>row.id));return assemblyVersions.find((version:any)=>ids.has(version.assembly_id))?.id||assemblyVersions.find((version:any)=>assemblies.some((assembly:any)=>assembly.id===version.assembly_id&&assembly.primary_measurement===role.unit))?.id||null;};
  const startTakeoff=(role:any)=>{const assemblyVersionId=assemblyVersionForRole(role);if(!assemblyVersionId){setMessage(`No ${role.unit} takeoff is available for this role.`);return;}setViewMode('2d');window.dispatchEvent(new CustomEvent('carez:start-condition-takeoff',{detail:{assemblyVersionId,name:selectedSummary?.name||definition?.name||'Concrete Condition',roleLabel:role.label}}));setContextTab('plans');setMessage(`Drawing ${role.label}.`);};
  const chooseFamily=(key:ConditionArchetypeKey)=>{const next=CONDITION_ARCHETYPES[key];setFamily(key);setCreateName(next.name);setCreateCode(conditionCodeFromName(next.name));setCodeTouched(false);};
  const createCondition=()=>{setMessage('Creating condition…');startTransition(async()=>{try{const result=await createProjectConcreteConditionPilot({takeoffSetId:setId,archetypeKey:family,code:createCode,name:createName});setSelectedVersionId(result.condition_version_id);setCreating(false);setContextTab('conditions');setMessage('');router.refresh();}catch(error:any){setMessage(error?.message||'Could not create condition.');}});};
  const saveCondition=(afterSave?:()=>void)=>{if(!selectedVersion||!definition)return;const roles=prepareConditionRoleAssignments(definition.roles,roleSelections);const primary=definition.roles.find(role=>role.primary);const anchorId=primary?roleSelections[primary.key]:'';if(!anchorId){setMessage(`Assign ${primary?.label||'the primary takeoff'} before calculating.`);return;}const {inputs,provenance}=prepareConditionAuthoringInputs(draft);const modulesForSave=stripModern?moduleConfigurations:selectedModules.map((module,index)=>({moduleKey:module.module_key,instanceKey:module.instance_key,label:module.label,enabled:moduleEnabled[module.module_key]!==false,inputValues:(moduleDraft[module.module_key]||module.input_values) as Record<string,any>,inputProvenance:module.input_provenance as Record<string,any>,legacyChildKey:module.legacy_child_key,sortOrder:module.sort_order||(index+1)*10}));setMessage('Saving…');startTransition(async()=>{try{await saveAndRecalculateConcreteConditionPilot({conditionVersionId:selectedVersion.id,inputs,inputProvenance:provenance,modules:modulesForSave,measurementRoles:roles,compatibilityAnchorMeasurementId:anchorId});setMessage('');afterSave?.();router.refresh();}catch(error:any){setMessage(error?.message||'Could not save condition.');}});};

  const renderInputs=(inputs:ConditionInputDefinition[])=>!inputs.length?<div className={styles.compactEmpty}>No inputs in this section.</div>:<div className={styles.fieldGrid}>{inputs.map(input=>input.valueType==='boolean'
    ?<LabeledSwitch key={`${input.group}-${input.key}`} id={switchId(selectedVersionId||'draft',input.group,input.key)} checked={Boolean(draft[input.group]?.[input.key])} onCheckedChange={checked=>updateInput(input,checked?'true':'false')} disabled={locked||isPending} label={input.label} className={direction.switchField}/>
    :<Field key={`${input.group}-${input.key}`} className={direction.propertyField}><FieldLabel className={direction.propertyFieldLabel}>{input.label}</FieldLabel>{input.valueType==='select'?<Select value={String(draft[input.group]?.[input.key]??'')} onValueChange={value=>updateInput(input,String(value??''))} disabled={locked||isPending}><SelectTrigger className="w-full"><SelectValue placeholder="Select…"/></SelectTrigger><SelectContent align="start">{(input.options||[]).map(option=><SelectItem key={option} value={option}>{humanize(option)}</SelectItem>)}</SelectContent></Select>:input.valueType==='text'?<Input value={String(draft[input.group]?.[input.key]??'')} onChange={event=>updateInput(input,event.target.value)} disabled={locked||isPending}/>:<CarezNumberField value={String(draft[input.group]?.[input.key]??'')} onChange={event=>updateInput(input,event.target.value)} unit={input.unit} min={input.minimum} max={input.maximum} step={input.valueType==='integer'?1:'any'} disabled={locked||isPending}/>}</Field>)}</div>;
  const renderInputGroup=(group:ConditionInputGroup)=>renderInputs(definition?.inputs.filter(input=>input.group===group)||[]);
  const renderLaborProductivity=()=>{
    if(!definition)return null;
    const production=definition.inputs.filter(input=>input.group==='production');
    return <div className="grid gap-2">{LABOR_ACTIVITIES.map(([prefix,label])=>{
      const methodInput=production.find(input=>input.key===`${prefix}_labor_method`);if(!methodInput)return null;
      const method=String(draft.production?.[methodInput.key]||'');
      const active=method==='crew_rate'?[methodInput,production.find(input=>input.key===`${prefix}_crew_size`),production.find(input=>input.key===`${prefix}_production_per_crew_hr`)]:[methodInput,production.find(input=>input.key===`${prefix}_mh_per_unit`)];
      return <section key={prefix} className="rounded-md border border-border bg-card/25 p-2.5"><div className="mb-2 text-xs font-semibold text-foreground">{label}</div>{renderInputs(active.filter(Boolean) as ConditionInputDefinition[])}</section>;
    })}</div>;
  };
  const renderModule=(moduleKey:ConditionModuleKey)=>{const module=selectedModules.find(row=>row.module_key===moduleKey);if(!module)return <div className={styles.compactEmpty}>{MODULE_LABELS[moduleKey]} is not available for this condition.</div>;const enabled=moduleEnabled[moduleKey]!==false;const entries=Object.entries(moduleDraft[moduleKey]||{});return <><div className={direction.moduleControlRow}><LabeledSwitch id={switchId(selectedVersionId||'draft',moduleKey,'enabled')} checked={enabled} onCheckedChange={checked=>{setModuleEnabled(current=>({...current,[moduleKey]:checked}));setMessage('');}} disabled={locked||isPending} label="Include in Condition" description={enabled?'Included in this Condition':'Excluded from this Condition'} className="min-h-0 flex-1 border-0 bg-transparent p-0 data-[checked=true]:border-0 data-[checked=true]:bg-transparent"/></div>{enabled?(entries.length?<div className={styles.fieldGrid}>{entries.map(([key,value])=>typeof value==='boolean'?<LabeledSwitch key={`${moduleKey}-${key}`} id={switchId(selectedVersionId||'draft',moduleKey,key)} checked={value} onCheckedChange={checked=>updateModuleInput(moduleKey,key,checked)} disabled={locked||isPending} label={humanize(key)} className={direction.switchField}/>:<Field key={`${moduleKey}-${key}`} className={direction.propertyField}><FieldLabel className={direction.propertyFieldLabel}>{humanize(key)}</FieldLabel>{typeof value==='number'?<CarezNumberField value={String(value)} onChange={event=>updateModuleInput(moduleKey,key,event.target.value===''?'':Number(event.target.value))} step="any" disabled={locked||isPending}/>:<Input value={String(value??'')} onChange={event=>updateModuleInput(moduleKey,key,event.target.value)} disabled={locked||isPending}/>}</Field>)}</div>:<div className={styles.moduleReady}><CheckCircle2/><span>Included</span></div>):null}</>;};
  const moduleEditor=(moduleKey:ConditionModuleKey)=>stripModern&&definition?<ConditionModuleEditor definition={definition} moduleKey={moduleKey} modules={moduleConfigurations} onChange={modules=>{setModuleConfigurations(modules);setMessage('');}} disabled={locked||isPending}/>:renderModule(moduleKey);

  const primaryRole=definition?.roles.find(role=>role.primary)||null;
  const primaryMeasurementId=primaryRole?roleSelections[primaryRole.key]||'':'';
  const primaryMeasurement=measurements.find((row:any)=>row.id===primaryMeasurementId)||null;
  const currentSection=sections.find((row:any)=>row.id===primaryMeasurement?.estimate_section_id)||null;
  const suggestedSection=stripV3?(sections.find((row:any)=>/strip\s*foot|wall\s*foot/i.test(String(row.name)))||sections.find((row:any)=>/footing|foundation/i.test(String(row.name)))):null;
  const assignSection=(sectionId:string|null)=>{if(!primaryMeasurementId)return;setMessage('Assigning estimate section…');startTransition(async()=>{try{await assignConditionPrimaryTakeoffSection({takeoffSetId:setId,measurementId:primaryMeasurementId,sectionId});setMessage('');router.refresh();}catch(error:any){setMessage(error?.message||'Could not assign estimate section.');}});};

  const output=(key:string)=>selectedOutputs.find(row=>row.output_key===key);
  const outputText=(key:string)=>{const row=output(key);return row&&row.status!=='inactive'?quantity(row.production_quantity,row.production_unit):'—';};
  const laborTotal=selectedOutputs.filter(row=>row.output_key.startsWith('labor.')&&row.status==='ready').reduce((sum,row)=>sum+Number(row.production_quantity||0),0);
  const modulePricing=(keys:string[])=>{const rows=selectedOutputs.filter(row=>keys.includes(row.output_key)&&row.status!=='inactive');if(!rows.length)return'Not calculated';if(rows.some(row=>row.status==='held'))return'Calculation hold';if(rows.some(row=>row.pricing_status==='missing_price'||row.pricing_status==='missing_labor_rate'))return'Price missing';return'Ready';};
  const reviewRows=stripV3?[
    {label:'Concrete',included:moduleIncluded('concrete'),detail:`${outputText('concrete.installed_cy')} installed · ${outputText('concrete.procurement_cy')} order`,status:modulePricing(['concrete.installed_cy','concrete.procurement_cy'])},
    {label:'Forms',included:moduleIncluded('forms'),detail:`${outputText('forms.side_contact_sf')} side · ${outputText('forms.end_contact_sf')} ends · ${outputText('labor.forms_mh')} labor`,status:modulePricing(['forms.side_contact_sf','labor.forms_mh'])},
    {label:'Reinforcing',included:moduleIncluded('reinforcing'),detail:`${outputText('reinforcing.installed_lb')} installed · ${outputText('reinforcing.procurement_lb')} order · ${outputText('labor.reinforcing_mh')} labor`,status:modulePricing(['reinforcing.installed_lb','reinforcing.procurement_lb','labor.reinforcing_mh'])},
    {label:'Embeds',included:moduleIncluded('anchors_embeds'),detail:`${outputText('anchors_embeds.anchor_ea')} · ${outputText('labor.anchors_embeds_mh')} labor`,status:modulePricing(['anchors_embeds.anchor_ea','labor.anchors_embeds_mh'])},
    {label:'Excavation',included:moduleIncluded('excavation_backfill'),detail:`${outputText('excavation_backfill.excavation_cy')} excavated · ${outputText('excavation_backfill.backfill_cy')} backfill`,status:modulePricing(['excavation_backfill.excavation_cy','excavation_backfill.backfill_cy'])},
    {label:'Placement',included:moduleIncluded('placement_equipment'),detail:`${outputText('placement_equipment.equipment_hr')} equipment`,status:modulePricing(['placement_equipment.equipment_hr'])},
    {label:'Finish / cure',included:moduleIncluded('finish_cure_protection'),detail:`${outputText('finish_cure_protection.finish_sf')} finish · ${outputText('labor.finish_mh')} finish labor · ${outputText('labor.cure_protection_mh')} cure labor`,status:modulePricing(['finish_cure_protection.finish_sf','finish_cure_protection.protection_sf','labor.finish_mh','labor.cure_protection_mh'])},
    {label:'Labor / productivity',included:moduleIncluded('labor'),detail:`${Number(laborTotal).toLocaleString('en-US',{maximumFractionDigits:2})} MH`,status:modulePricing(selectedOutputs.filter(row=>row.output_key.startsWith('labor.')).map(row=>row.output_key))},
    {label:'Pricing / review',included:true,detail:`${money(costSummary.priced)}${costSummary.partial?' priced · partial':' direct'}`,status:selectedIssueSummary.total?`${selectedIssueSummary.total} issue${selectedIssueSummary.total===1?'':'s'}`:'Ready'},
  ]:[];

  const issueTab=(issue:ConditionIssue):PropertyTab=>issue.category==='production'?'labor':issue.category==='pricing'||issue.category==='commercial'?'review':issue.category==='scope'?'general':tabForHold({message:issue.message});
  const safeIssueTab=(issue:ConditionIssue)=>{const tab=issueTab(issue);return availableTabs.includes(tab)?tab:'general';};
  const workingRoleCount=Object.values(roleSelections).filter(Boolean).length;
  const summaryText=dirty?`${workingRoleCount} takeoff${workingRoleCount===1?'':'s'} assigned · unsaved`:`${selectedSummary?.measurement_count||0} takeoff${Number(selectedSummary?.measurement_count||0)===1?'':'s'} · ${activeOutputCount} outputs`;
  const emptyOutputMessage=primaryMeasurementId?'Save & recalculate to calculate outputs.':'Assign the primary takeoff and save to calculate outputs.';

  const contextPortal=sidebarHost?createPortal(<div className={`${styles.contextPortal} ${contextTab==='plans'?'':styles.contextPortalExpanded}`}><div className={styles.contextTabs} role="tablist" aria-label="Takeoff navigator">{(['plans','conditions','zones'] as ContextTab[]).map(tab=><button key={tab} type="button" role="tab" aria-selected={contextTab===tab} className={contextTab===tab?styles.contextTabActive:styles.contextTab} onClick={()=>setContextTab(tab)}>{tab[0].toUpperCase()+tab.slice(1)}</button>)}</div>{contextTab==='conditions'?<div className={styles.contextBody}><div className={styles.contextTools}><label><Search/><input value={conditionQuery} onChange={event=>setConditionQuery(event.target.value)} placeholder="Filter conditions"/></label><Button size="icon-sm" variant="outline" onClick={()=>setCreating(true)} disabled={locked}><Plus/></Button></div>{conditions.length?<CarezConditionTree onVisibilityChange={(node,hidden)=>{const ids=node.children?.map(child=>child.id)||[node.id];setDerivedViewState(current=>({...current,hidden:hidden?[...new Set([...current.hidden,...ids])]:current.hidden.filter(id=>!ids.includes(id))}));}} searchable={false} nodes={treeNodes} selectedId={selectedVersionId} onSelect={node=>{if(conditions.some(row=>row.condition_version_id===node.id))requestConditionSelection(node.id);}}/>:<div className={styles.contextEmpty}>No conditions</div>}</div>:contextTab==='zones'?<div className={styles.contextBody}><div className={styles.paneLabel}>Zones</div>{zones.length?<div className={styles.zoneList}>{zones.map(zone=><div key={zone.label}><span>{zone.label}</span><b>{zone.count}</b></div>)}</div>:<div className={styles.contextEmpty}>No zones assigned</div>}</div>:null}</div>,sidebarHost):null;

  return <div className={styles.integrated} data-context-tab={contextTab} data-view-mode={viewMode}>
    <div className={styles.drawingHost} ref={drawingHostRef}>
      <TakeoffDrawingWorkspace {...workspaceProps} conditionAuthoringActive conditionMeasurementIds={conditionMeasurementIds} conditionSelectedMeasurementId={selectedMeasurementId} onConditionMeasurementSelect={requestMeasurementSelection} conditionPresentation={drawingPresentation}/>
      {contextPortal}
      <div className={direction.drawingViewModes} aria-label="Takeoff view controls"><div className={styles.viewModeSwitch} role="tablist" aria-label="Takeoff view mode">{(['2d','3d','split'] as ViewMode[]).map(mode=><button key={mode} type="button" role="tab" aria-selected={viewMode===mode} className={viewMode===mode?styles.viewModeActive:''} onClick={()=>setViewMode(mode)}>{mode==='2d'?'2D':mode==='3d'?'3D':'Split'}</button>)}</div></div>
      {viewMode!=='2d'&&<div className={`${styles.derivedOverlay} ${viewMode==='split'?styles.derivedOverlaySplit:styles.derivedOverlay3d}`} style={{bottom:dockHeight}}><TakeoffDerived3DBoundary><TakeoffDerived3DView scene={derived3DScene} viewState={derivedViewState} onViewStateChange={setDerivedViewState} memory={derivedMemory.current} activeSheetId={activeSheetId} activeSheetLabel={activeSheetLabel} selectedConditionVersionId={selectedVersionId} selectedMeasurementId={selectedMeasurementId} onSelectSolid={selectDerivedSolid} onJumpToIssue={jumpToDerivedIssue}/></TakeoffDerived3DBoundary></div>}
    </div>
    <aside className={styles.propertiesPane} aria-label="Condition Properties">
      <header className={styles.propertiesHeader}><div><span>Condition Properties</span><strong>{creating?'New condition':selectedSummary?.name||'No condition selected'}</strong>{selectedSummary?<small>{selectedSummary.code} · R{selectedSummary.revision_no} · {humanize(selectedSummary.version_status)}</small>:null}</div></header>

      {creating?<div className={styles.createPane}><div className={styles.familyList}>{(Object.keys(CONDITION_ARCHETYPES) as ConditionArchetypeKey[]).map(key=>{const item=CONDITION_ARCHETYPES[key];return <button type="button" key={key} className={family===key?styles.familyActive:styles.familyButton} onClick={()=>chooseFamily(key)}><b>{item.primaryUnit}</b><span>{item.name}</span></button>;})}</div><Field className={direction.propertyField}><FieldLabel className={direction.propertyFieldLabel}>Condition name</FieldLabel><Input value={createName} onChange={event=>{const name=event.target.value;setCreateName(name);if(!codeTouched)setCreateCode(conditionCodeFromName(name));}}/></Field><Field className={direction.propertyField}><FieldLabel className={direction.propertyFieldLabel}>Code</FieldLabel><Input value={createCode} onChange={event=>{setCodeTouched(true);setCreateCode(event.target.value.toUpperCase());}}/></Field><div className={styles.createActions}><Button variant="outline" onClick={()=>setCreating(false)}>Cancel</Button><Button onClick={createCondition} disabled={locked||isPending||!createName.trim()||!createCode.trim()}>{isPending?<RefreshCw className={styles.spin}/>:<Plus/>}Create</Button></div><div className={styles.statusLine} role="status">{message}</div></div>
      :!selectedSummary||!selectedVersion||!definition?<div className={styles.propertiesEmpty}><Layers3/><strong>Select a condition</strong></div>:<>
        <div className={direction.conditionSummaryLine}><span className={styles.conditionColor} data-family={selectedSummary.archetype_code}/><span className={direction.summaryMeta}>{summaryText}</span>{selectedIssueSummary.total?<button type="button" className={direction.summaryHold} onClick={()=>setPropertyTab(safeIssueTab(selectedIssues[0]))}>{selectedIssueSummary.total} issue{selectedIssueSummary.total===1?'':'s'}</button>:null}</div>
        {selectedIssues.length?<div className={direction.holdsDock} aria-label="Condition issues">{selectedIssues.map(issue=><button key={issue.key} type="button" className={direction.holdRow} onClick={()=>setPropertyTab(safeIssueTab(issue))}><AlertTriangle/><span className={direction.holdText}><strong>{issue.label}</strong><small>{issue.message}</small></span><span className={direction.holdJump}>{TAB_LABELS[safeIssueTab(issue)]} →</span></button>)}</div>:null}
        <Tabs value={propertyTab} onValueChange={value=>setPropertyTab(value as PropertyTab)} className={styles.tabsWrap}><TabsList variant="line" className={styles.tabsList}>{availableTabs.map(tab=><TabsTrigger key={tab} value={tab}>{TAB_LABELS[tab]}</TabsTrigger>)}</TabsList></Tabs>
        <div className={styles.propertiesScroll}>
          {propertyTab==='general'?<><section className={styles.propertySection}><div className={styles.sectionHead}><Ruler/><strong>Scope / geometry</strong></div><div className={styles.roleList}>{definition.roles.map(role=>{const choices=measurements.filter((measurement:any)=>conditionMeasurementMatchesRole(measurement,role,compatibilityAssemblyVersionId));return <div className={styles.roleRow} key={role.key}><div><strong>{role.label}</strong><small>{role.unit}{role.primary?' · Primary':' · Optional'}</small></div><ConditionRolePicker value={roleSelections[role.key]||''} choices={choices.map((measurement:any)=>{const sheet=sheets.find((item:any)=>item.id===measurement.sheet_id);return{id:measurement.id,label:measurement.name,meta:`${quantity(measurement.raw_quantity,measurement.raw_unit)} · ${sheet?.sheet_number||`Page ${sheet?.page_number||'?'}`}`};})} placeholder={role.required?'Select takeoff…':'Not used'} emptyLabel={role.required?'No takeoff selected':'Not used'} disabled={locked||isPending} onChange={value=>setRole(role.key,value)}/><Button size="sm" variant="outline" onClick={()=>startTakeoff(role)} disabled={locked||isPending}>Draw {role.unit}</Button></div>;})}</div></section><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Dimensions</strong></div>{renderInputGroup('planFacts')}</section>{stripModern&&!stripV3?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Concrete</strong></div>{moduleEditor('concrete')}</section>:null}</>:null}
          {propertyTab==='concrete'?<><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Concrete</strong><small>Section · mix</small></div>{moduleEditor('concrete')}</section><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Order allowance</strong></div>{renderInputs(definition.inputs.filter(input=>input.group==='commercial'&&input.key==='concrete_waste_pct'))}</section></>:null}
          {propertyTab==='forms'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Forms</strong><small>Sides · system · resources</small></div>{moduleEditor('forms')}</section>:null}
          {propertyTab==='rebar'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Reinforcing</strong><small>Construction-native sets</small></div>{moduleEditor('reinforcing')}</section>:null}
          {propertyTab==='embeds'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Anchors / embeds</strong><small>Repeatable sets</small></div>{moduleEditor('anchors_embeds')}</section>:null}
          {propertyTab==='excavation'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Excavation / backfill</strong></div>{moduleEditor('excavation_backfill')}</section>:null}
          {propertyTab==='placement'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Placement / equipment</strong></div>{moduleEditor('placement_equipment')}</section>:null}
          {propertyTab==='finish'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Finish / cure / protection</strong></div>{moduleEditor('finish_cure_protection')}</section>:null}
          {propertyTab==='labor'?<><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Labor / productivity</strong><small>Factor or crew-rate method</small></div>{supportsModule('labor')?moduleEditor('labor'):null}</section>{stripV3&&moduleIncluded('labor')?<section className={styles.propertySection}>{renderLaborProductivity()}</section>:!stripV3?<section className={styles.propertySection}>{renderInputGroup('production')}</section>:null}</>:null}
          {propertyTab==='review'?<><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Estimate section</strong><small>{currentSection?.name||'Unassigned'}</small></div>{primaryMeasurementId?<div className="grid gap-2"><Select value={String(primaryMeasurement?.estimate_section_id||'__unassigned')} onValueChange={value=>assignSection(value==='__unassigned'?null:String(value))} disabled={locked||isPending}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="__unassigned">Unassigned</SelectItem>{sections.map((section:any)=><SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>)}</SelectContent></Select>{!currentSection&&suggestedSection?<Button type="button" size="sm" variant="outline" onClick={()=>assignSection(suggestedSection.id)} disabled={locked||isPending}>Use suggested: {suggestedSection.name}</Button>:null}{!currentSection?<small className="text-warning">Assign an estimate section before estimate review.</small>:null}</div>:<div className={styles.compactEmpty}>Assign the primary takeoff before selecting its estimate section.</div>}</section><section className={styles.propertySection}><div className={styles.sectionHead}><strong>Condition review</strong><small>{selectedIssueSummary.total?selectedIssueSummary.detail:'No open issues'}</small></div><div className="divide-y divide-border overflow-hidden rounded-md border border-border">{reviewRows.map(row=><div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2 text-xs"><div className="min-w-0"><strong className="block text-foreground">{row.label}</strong><span className="block truncate text-muted-foreground">{row.included?row.detail:'Not included'}</span></div><span className={row.status==='Ready'?'text-success':'text-warning'}>{row.included?row.status:'Not included'}</span></div>)}</div></section></>:null}
          {propertyTab==='drawing'?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Drawing</strong></div>{renderInputGroup('drawing')}</section>:null}
          {propertyTab==='more'?<>{definition.inputs.some(input=>input.group==='methods')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Methods</strong></div>{renderInputGroup('methods')}</section>:null}{definition.inputs.some(input=>input.group==='commercial')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Commercial / procurement</strong></div>{renderInputGroup('commercial')}</section>:null}{!stripModern&&supportsModule('concrete')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Concrete</strong></div>{moduleEditor('concrete')}</section>:null}{supportsModule('anchors_embeds')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Anchors / embeds</strong></div>{moduleEditor('anchors_embeds')}</section>:null}{supportsModule('slab_systems')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Slab systems</strong></div>{moduleEditor('slab_systems')}</section>:null}{supportsModule('placement_equipment')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Placement / equipment</strong></div>{moduleEditor('placement_equipment')}</section>:null}{supportsModule('finish_cure_protection')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Finish / cure / protection</strong></div>{moduleEditor('finish_cure_protection')}</section>:null}{supportsModule('miscellaneous')?<section className={styles.propertySection}><div className={styles.sectionHead}><strong>Miscellaneous</strong></div>{moduleEditor('miscellaneous')}</section>:null}</>:null}

          <Collapsible open={outputsOpen} onOpenChange={setOutputsOpen} className={styles.propertySection}><CollapsibleTrigger className={`${styles.sectionHead} ${direction.collapsibleTrigger}`}><CheckCircle2/><strong>Calculated outputs</strong><span className={`${direction.outputSummary} ${selectedIssueSummary.total?direction.outputSummaryHeld:''}`}>{activeOutputCount} active · {money(costSummary.priced)}{costSummary.partial?' priced · partial':''}{selectedIssueSummary.total?` · ${selectedIssueSummary.total} issues`:''}</span><ChevronDown className={`${direction.outputChevron} ${outputsOpen?direction.outputChevronOpen:''}`}/></CollapsibleTrigger><CollapsibleContent><CarezDataGrid isEmpty={!selectedOutputs.length} empty={<div className={styles.gridEmpty}>{emptyOutputMessage}</div>}><CarezDataGridTable><CarezDataGridHead><CarezDataGridRow><CarezDataGridHeaderCell>Output</CarezDataGridHeaderCell><CarezDataGridHeaderCell numeric>Quantity</CarezDataGridHeaderCell><CarezDataGridHeaderCell numeric>Cost</CarezDataGridHeaderCell></CarezDataGridRow></CarezDataGridHead><CarezDataGridBody>{selectedOutputs.filter(output=>output.status!=='inactive').map(row=><CarezDataGridRow key={row.id}><CarezDataGridCell><strong>{row.label}</strong><small className={styles.outputMeta}>{conditionOutputStatus(row)}</small></CarezDataGridCell><CarezDataGridCell numeric>{quantity(row.production_quantity,row.production_unit)}</CarezDataGridCell><CarezDataGridCell numeric>{row.pricing_status==='missing_price'||row.pricing_status==='missing_labor_rate'?'—':money(row.direct_cost)}</CarezDataGridCell></CarezDataGridRow>)}</CarezDataGridBody></CarezDataGridTable></CarezDataGrid></CollapsibleContent></Collapsible>
        </div>
        <footer className={styles.propertiesFooter}><span className={dirty&&!message?direction.dirtyStatus:undefined} role="status">{message||(dirty?'Unsaved changes':'')}</span><Button onClick={()=>saveCondition()} disabled={locked||isPending||selectedVersion.status!=='draft'||!dirty}>{isPending?<RefreshCw className={styles.spin}/>:<Save/>}Save & recalculate</Button></footer>
      </>}
    </aside>

    <Dialog open={Boolean(pendingSwitch)} onOpenChange={open=>{if(!open)setPendingSwitch(null);}}><DialogContent showCloseButton={false}><DialogHeader><DialogTitle>Unsaved Condition changes</DialogTitle><DialogDescription>Save this Condition before switching, or discard the current edits.</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" onClick={()=>setPendingSwitch(null)} disabled={isPending}>Cancel</Button><Button variant="outline" onClick={()=>{const next=pendingSwitch;setPendingSwitch(null);if(next)applyConditionSelection(next.versionId,next.focusPlan,next.measurementId,next.propertyTab,next.viewMode);}} disabled={isPending}>Discard</Button><Button onClick={()=>{const next=pendingSwitch;if(next)saveCondition(()=>{setPendingSwitch(null);applyConditionSelection(next.versionId,next.focusPlan,next.measurementId,next.propertyTab,next.viewMode);});}} disabled={isPending}>Save & switch</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

