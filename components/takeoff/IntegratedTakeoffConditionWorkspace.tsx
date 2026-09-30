'use client';

import {useEffect,useMemo,useRef,useState,useTransition,type ReactNode} from 'react';
import editorFields from './ConditionEditorFields.module.css';
import {calculateCondition} from '@/lib/takeoff/conditions/calculate';
import {resolveConditionInputGroups} from '@/lib/takeoff/conditions/persistence';
import type {ConditionMeasurementRole,ConditionOutputTrace,ConditionOutputOverride} from '@/lib/takeoff/conditions/types';
import {useRouter} from 'next/navigation';
import dynamic from 'next/dynamic';
import {Layout,Model} from 'flexlayout-react';
import {CheckmarkCircleRegular as CheckCircle2,ChevronDownRegular as ChevronDown,EyeRegular as Eye,EyeOffRegular as EyeOff,LayerRegular as Layers3,AddRegular as Plus,ArrowClockwiseRegular as RefreshCw,RulerRegular as Ruler} from '@fluentui/react-icons';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Badge,Button as FluentButton,Dialog,DialogActions,DialogBody,DialogContent,DialogSurface,DialogTitle,Dropdown,Input as FluentInput,Option,Select} from '@fluentui/react-components';
import {AddRegular,ArrowRightRegular,ChevronDownRegular,ErrorCircleRegular,SaveRegular,SearchRegular} from '@fluentui/react-icons';
import {
  assignConditionPrimaryTakeoffSection,
  createProjectConcreteConditionPilot,
  saveAndRecalculateConcreteConditionPilot,
  saveUnmeasuredConcreteConditionDraft,
  upgradeProjectConcreteConditionDraftToLatest,
} from '@/app/takeoff/[setId]/conditionActions';
import {InspectorRow,InspectorInput,InspectorNumberInput,InspectorImperialInput,InspectorBoolean,inspectorSelectClass} from './ConditionInspectorControls';
import {CONDITION_ARCHETYPES,conditionArchetype} from '@/lib/takeoff/conditions/catalog';
import {FOOTING_PLACEMENT_MH_PER_CY,footingPlacementRecommendation} from '@/lib/takeoff/conditions/nationalEstimatorRecommendations';
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
  summarizeConditionIssues,
  type ConditionIssue,
} from '@/lib/takeoff/conditions/issues';
import {STRIP_FOOTING_V2_DEFINITION,calculateStripFootingV2} from '@/lib/takeoff/conditions/stripFootingV2';
import {STRIP_FOOTING_V3_DEFINITION,calculateStripFootingV3} from '@/lib/takeoff/conditions/stripFootingV3';
import {STRIP_FOOTING_V4_DEFINITION,calculateStripFootingV4,STRIP_FOOTING_V4_ENDPOINT_ROLE} from '@/lib/takeoff/conditions/stripFootingV4';
import type {ConditionWorksheetAuthority} from '@/lib/takeoff/conditionWorksheet';
import type {
  ConditionArchetypeKey,
  ConditionInputDefinition,
  ConditionInputGroup,
  ConditionModuleConfiguration,
  ConditionModuleKey,
} from '@/lib/takeoff/conditions/types';
import {ConditionModuleEditor} from './ConditionModuleEditor';
import {ConditionDeletionManager} from './ConditionDeletionManager';
import {ConditionRolePicker} from './ConditionRolePicker';
import {DEFAULT_DERIVED_3D_VIEW_STATE, type Derived3DViewState} from '@/lib/takeoff/3d/viewState';
import {useTakeoff3DCamera} from './3d/useTakeoff3DCamera';
import {resolvedPhysicalInputs} from '@/lib/takeoff/conditions/derived3d/sources';
import {TakeoffDrawingWorkspace} from './TakeoffDrawingWorkspace';
import {SmartLaborCell} from './SmartLaborCell';
import {useTakeoffWorkspaceUi,type TakeoffPhase,type TakeoffViewMode} from './useTakeoffWorkspaceUi';
import direction from './ConditionPropertiesDirectionA.module.css';
import styles from './IntegratedTakeoffConditionWorkspace.module.css';

const Takeoff3DViewport=dynamic(
  ()=>import('./3d/Takeoff3DViewport').then(module=>module.Takeoff3DViewport),
  {ssr:false},
);

function ConditionSection({id,heading,children}:{id:string;heading:ReactNode;children:ReactNode}){
  return <Accordion multiple collapsible defaultOpenItems={[id]} className={styles.propertySection}>
    <AccordionItem value={id} id={id}>
      <AccordionHeader className={`${styles.sectionHead} ${styles.propertySectionTrigger}`}>{heading}</AccordionHeader>
      <AccordionPanel className={styles.propertySectionContent}>{children}</AccordionPanel>
    </AccordionItem>
  </Accordion>;
}

type ConditionSummary={
  condition_id:string;condition_version_id:string;code:string;name:string;revision_no:number;version_status:string;
  template_version_id:string;archetype_code:ConditionArchetypeKey;archetype_name:string;measurement_count:number;
  output_count:number;held_output_count:number;open_hold_count:number;direct_cost:number|string;
};
type ConditionVersion={
  id:string;template_version_id:string;archetype_version_id:string;status:string;plan_facts:Record<string,unknown>;method_inputs:Record<string,unknown>;
  production_inputs:Record<string,unknown>;commercial_inputs:Record<string,unknown>;drawing_inputs:Record<string,unknown>;updated_at:string;output_overrides?:Record<string,ConditionOutputOverride>;
};
type ConditionModule={
  condition_version_id:string;module_key:ConditionModuleKey;instance_key:string;label:string;enabled:boolean;
  input_values:Record<string,any>;input_provenance:Record<string,any>;legacy_child_key:string|null;sort_order:number;
};
type ConditionOutputRow={
  id:string;condition_version_id:string;output_key:string;label:string;production_quantity:number|string|null;production_unit:string;
  status:string;direct_cost:number|string;pricing_status:string;generated_estimate_item_id:string|null;legacy_takeoff_output_id:string|null;calculation_trace?:ConditionOutputTrace|null;
};
type LegacyOutputRow={
  id:string;measurement_id:string;generated_estimate_item_id:string|null;component_key:string;label:string;estimate_item_type:string;
  production_quantity:number|string|null;production_unit:string;baseline_man_hours_per_unit:number|string|null;job_man_hours_per_unit:number|string|null;
  unit_cost:number|string|null;direct_cost:number|string|null;pricing_status:string;is_active:boolean;estimate_visible:boolean;
};
type RecapRow={
  key:string;conditionVersionId:string|null;conditionCode:string;label:string;outputKey:string;productionQuantity:number|string|null;
  productionUnit:string;status:string;directCost:number|string|null;pending:boolean;laborOutput:LegacyOutputRow|null;
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
type Props={setId:string;workspaceProps:any;conditionData:ConditionData;mobileReview?:boolean};
type PropertyTab='general'|'concrete'|'rebar'|'forms'|'embeds'|'excavation'|'placement'|'finish'|'labor'|'review'|'drawing'|'more';
type ViewMode=TakeoffViewMode;
type PendingSwitch=
  |{kind:'condition';versionId:string;focusPlan:boolean;measurementId?:string|null;propertyTab?:PropertyTab;viewMode?:ViewMode;startPrimaryDraw?:boolean}
  |{kind:'create'}
  |{kind:'open-create'};
type PendingRoleDraw={conditionVersionId:string;roleKey:string;existingMeasurementIds:Set<string>};

const MODULE_LABELS:Record<ConditionModuleKey,string>={
  concrete:'Concrete',forms:'Forms',reinforcing:'Reinforcing',anchors_embeds:'Anchors / embeds',slab_systems:'Slab systems',
  excavation_backfill:'Excavation / backfill',placement_equipment:'Placement / equipment',finish_cure_protection:'Finish / cure / protection',labor:'Labor',miscellaneous:'Miscellaneous',
};
const LABOR_ACTIVITIES=[
  ['place_concrete','Place concrete'],['forms','Forms'],['reinforcing','Reinforcing'],['anchors_embeds','Anchors / embeds'],
  ['excavation','Excavation'],['backfill','Backfill'],['finish','Finish concrete'],['cure_protection','Cure / protection'],['misc','Miscellaneous'],
] as const;
const money=(value:number|string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0));
const quantity=(value:number|string|null,unit:string)=>value===null?'—':`${Number(value).toLocaleString('en-US',{maximumFractionDigits:3})} ${unit}`;
const humanize=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
const conditionColor=(key:ConditionArchetypeKey)=>key==='slab_on_grade'?'#426F93':key==='pad_column_footing'?'#8A610B':'#347A46';
const switchId=(...parts:string[])=>`condition-${parts.join('-').replace(/[^a-zA-Z0-9_-]/g,'-')}`;
const isArchitecturalDimension=(input:ConditionInputDefinition):input is ConditionInputDefinition&{unit:'FT'|'IN'}=>input.group==='planFacts'&&input.valueType==='number'&&(input.unit==='FT'||input.unit==='IN');

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

export function IntegratedTakeoffConditionWorkspace({setId,workspaceProps,conditionData,mobileReview=false}:Props){
  const router=useRouter();
  const [assemblyDockModel]=useState(()=>Model.fromJson({
    global:{tabEnableClose:false,tabEnableRename:false,tabEnableFloat:false,tabEnablePopout:false,tabEnableRenderOnDemand:false,tabSetEnableDeleteWhenEmpty:false,tabSetMinWidth:180},
    borders:[],
    layout:{type:'row',children:[
      {type:'tabset',id:'assembly-scope-tabset',weight:24,children:[{type:'tab',id:'assembly-scope-tree',name:'Assembly tree',component:'scope-tree'}]},
      {type:'tabset',id:'assembly-editor-tabset',weight:76,minWidth:480,children:[{type:'tab',id:'assembly-input-editor',name:'Assembly inputs',component:'assembly-editor'}]},
    ]},
  }));
  const drawingHostRef=useRef<HTMLDivElement|null>(null);
  const propertyScrollRef=useRef<HTMLDivElement|null>(null);
  const pendingRoleDrawRef=useRef<PendingRoleDraw|null>(null);
  const pendingPrimaryDrawRef=useRef<string|null>(null);
  const sourceMeasurementAppliedRef=useRef(false);
  const phase=useTakeoffWorkspaceUi(state=>state.phase);
  const setPhase=useTakeoffWorkspaceUi(state=>state.setPhase);
  const setScope=useTakeoffWorkspaceUi(state=>state.setScope);
  const conditionQuery=useTakeoffWorkspaceUi(state=>state.conditionQuery);
  const setConditionQuery=useTakeoffWorkspaceUi(state=>state.setConditionQuery);
  const collapsedAssemblies=useTakeoffWorkspaceUi(state=>state.collapsedFamilies);
  const toggleFamily=useTakeoffWorkspaceUi(state=>state.toggleFamily);
  const viewMode=useTakeoffWorkspaceUi(state=>state.viewMode);
  const setViewMode=useTakeoffWorkspaceUi(state=>state.setViewMode);
  const selectedVersionId=useTakeoffWorkspaceUi(state=>state.selectedConditionVersionId);
  const setSelectedVersionId=useTakeoffWorkspaceUi(state=>state.setSelectedConditionVersionId);
  const selectedMeasurementId=useTakeoffWorkspaceUi(state=>state.selectedMeasurementId);
  const setSelectedMeasurementId=useTakeoffWorkspaceUi(state=>state.setSelectedMeasurementId);
  const conditionOpen=phase==='assembly';
  const [focusedRateKey,setFocusedRateKey]=useState<string|null>(null);
  const [loadedVersionId,setLoadedVersionId]=useState<string|null>(null);
  const [pendingSwitch,setPendingSwitch]=useState<PendingSwitch|null>(null);
  const [drawRequestSequence,setDrawRequestSequence]=useState(0);
  const [propertyTab,setPropertyTab]=useState<PropertyTab>('general');
  const [derivedViewState,setDerivedViewState]=useState<Derived3DViewState>(DEFAULT_DERIVED_3D_VIEW_STATE);
  const r3fMemory=useTakeoff3DCamera();
  const derivedCache=useRef<Derived3DGeometryCache>(new Map());
  const [issuesOpen,setIssuesOpen]=useState(false);
  const [upgradeOpen,setUpgradeOpen]=useState(false);
  const [activeSheetId,setActiveSheetId]=useState<string|null>(workspaceProps.initialSheets?.[0]?.id||null);
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

  useEffect(()=>{setScope(setId);},[setId,setScope]);

  useEffect(()=>{
    if(!mobileReview)return;
    setViewMode('2d');
    setCreating(false);
    setIssuesOpen(false);
    setUpgradeOpen(false);
  },[mobileReview]);


  useEffect(()=>{
    const element=propertyScrollRef.current;
    if(!element||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const animation=element.animate([{opacity:.65,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
    return()=>animation.cancel();
  },[selectedVersionId,propertyTab]);

  useEffect(()=>{
    if(!conditionOpen)return;
    const target:Record<PropertyTab,string>={general:'dimensions',concrete:'concrete',rebar:'reinforcement',forms:'forms',embeds:'reinforcement',excavation:'excavation',placement:'pour',finish:'finish',labor:'labor',review:'review',drawing:'dimensions',more:'procurement'};
    const frame=window.requestAnimationFrame(()=>{
      const viewport=propertyScrollRef.current;
      const narrow=window.matchMedia('(max-width: 860px)').matches;
      if(propertyTab==='general'){
        if(narrow)viewport?.scrollIntoView({block:'start'});
        else viewport?.querySelectorAll<HTMLElement>(`.${styles.columnScroll}`).forEach(column=>column.scrollTo({top:0}));
        return;
      }
      const section=viewport?.querySelector<HTMLElement>(`#condition-section-${target[propertyTab]}`);
      if(!section)return;
      if(narrow){section.scrollIntoView({block:'start'});return;}
      const column=section.closest<HTMLElement>(`.${styles.columnScroll}`);
      if(column)column.scrollTo({top:column.scrollTop+section.getBoundingClientRect().top-column.getBoundingClientRect().top});
    });
    return()=>window.cancelAnimationFrame(frame);
  },[conditionOpen,propertyTab,selectedVersionId]);

  const locked=Boolean(workspaceProps.locked);
  const editorLocked=locked||mobileReview;
  const estimateId=String(workspaceProps.estimate?.id||workspaceProps.takeoffSet?.estimate_id||'');
  const measurements=workspaceProps.initialMeasurements||[];
  const sheets=workspaceProps.initialSheets||[];
  const sections=workspaceProps.sections||[];
  const assemblies=workspaceProps.assemblies||[];
  const assemblyVersions=workspaceProps.versions||[];
  const conditions=useMemo(()=>currentConditionRows(conditionData.conditions||[]),[conditionData.conditions]);
  const assemblyGroups=useMemo(()=>{
    const groups=new Map<string,{key:string;name:string;conditions:ConditionSummary[]}>();
    for(const row of conditions){
      if(!`${row.code} ${row.name} ${row.archetype_name}`.toLowerCase().includes(conditionQuery.toLowerCase()))continue;
      const key=row.archetype_code;
      const group=groups.get(key)||{key,name:row.archetype_name,conditions:[]};
      group.conditions.push(row);groups.set(key,group);
    }
    return [...groups.values()];
  },[conditions,conditionQuery]);
  const selectedSummary=conditions.find(row=>row.condition_version_id===selectedVersionId)||null;
  const selectedVersion=conditionData.versions.find(row=>row.id===selectedVersionId)||null;
  const selectedArchetypeVersion=selectedVersion?conditionData.archetypeVersions.find(row=>row.id===selectedVersion.archetype_version_id)||null:null;
  const contractVersion=Number(selectedArchetypeVersion?.version_no||1);
  const latestContractVersion=selectedSummary?conditionData.archetypeVersions.filter(row=>row.archetype_code_snapshot===selectedSummary.archetype_code&&row.status==='published'&&row.engine_key==='concrete_condition_v1').reduce((max,row)=>Math.max(max,Number(row.version_no||0)),contractVersion):contractVersion;
  const latestVersionAvailable=latestContractVersion>contractVersion;
  const stripContractVersion=selectedSummary?.archetype_code==='strip_wall_footing'?contractVersion:0;
  const stripModern=stripContractVersion>=2;
  const stripV3=stripContractVersion>=3;
  const stripV4=stripContractVersion>=4;
  const templateVersion=selectedVersion?conditionData.templateVersions.find(row=>row.id===selectedVersion.template_version_id)||null:null;
  const compatibilityAssemblyVersionId=templateVersion?.legacy_assembly_version_id||null;
  const selectedModules=useMemo(()=>selectedVersionId?conditionData.modules.filter(row=>row.condition_version_id===selectedVersionId).sort((a,b)=>a.sort_order-b.sort_order):[],[conditionData.modules,selectedVersionId]);
  const definition=selectedSummary?(stripV4?STRIP_FOOTING_V4_DEFINITION:stripV3?STRIP_FOOTING_V3_DEFINITION:stripModern?STRIP_FOOTING_V2_DEFINITION:conditionArchetype(selectedSummary.archetype_code)):null;
  const selectedOutputs=selectedVersionId?conditionData.outputs.filter(row=>row.condition_version_id===selectedVersionId):[];
  const selectedHolds=selectedVersionId?conditionData.holds.filter(row=>row.condition_version_id===selectedVersionId&&row.status==='open'):[];
  const selectedIssues=useMemo(()=>buildConditionIssues(selectedHolds,selectedOutputs),[selectedHolds,selectedOutputs]);
  const selectedIssueSummary=useMemo(()=>summarizeConditionIssues(selectedIssues),[selectedIssues]);
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
  const selectedPourMethod=String(currentModulesForSignature.find(module=>module.moduleKey==='placement_equipment'&&module.enabled)?.inputValues?.method||currentModulesForSignature.find(module=>module.moduleKey==='concrete'&&module.enabled)?.inputValues?.placement_method||'');
  const placementRecommendation=selectedSummary?.archetype_code==='strip_wall_footing'?footingPlacementRecommendation(selectedPourMethod):null;
  const persistedSignature=useMemo(()=>selectedVersion?JSON.stringify({draft:draftFromVersion(selectedVersion),modules:moduleSignature(selectedModules.map(toModuleConfiguration)),roles:roleSignature(persistedRoles)}):'',[selectedVersion,selectedModules,persistedRoles]);
  const currentSignature=useMemo(()=>selectedVersion?JSON.stringify({draft,modules:moduleSignature(currentModulesForSignature),roles:roleSignature(roleSelections)}):'',[selectedVersion,draft,currentModulesForSignature,roleSelections]);
  const dirty=Boolean(selectedVersion&&loadedVersionId===selectedVersion.id&&currentSignature!==persistedSignature);
  // Local telemetry uses the same versioned kernels as the save path. It is never persisted.
  const liveCalculation=useMemo(()=>{
    if(!selectedSummary||!selectedVersion||!definition)return {outputs:[],error:''};
    try{
      const prepared=prepareConditionAuthoringInputs(draft);
      const inputs=resolveConditionInputGroups({companyDefaults:templateVersion?.input_defaults,companyProvenance:templateVersion?.input_provenance,projectValues:prepared.inputs,projectProvenance:prepared.provenance});
      const roles:ConditionMeasurementRole[]=definition.roles.flatMap(role=>{
        const measurement=measurements.find((row:any)=>row.id===roleSelections[role.key]);
        if(!measurement)return [];
        if(!conditionMeasurementMatchesRole(measurement,role,compatibilityAssemblyVersionId))throw new Error(`${role.label} needs compatible plan geometry.`);
        return [{roleKey:role.key,measurementId:measurement.id,sheetId:measurement.sheet_id,quantity:Number(measurement.raw_quantity),unit:role.unit,geometryType:role.geometryType}];
      });
      if(stripV4){
        for(const role of roles.filter(row=>row.roleKey==='run')){
          const geometry=measurements.find((row:any)=>row.id===role.measurementId)?.geometry;
          const points=(Array.isArray(geometry?.points)?geometry.points:[]).filter((point:any)=>Number.isFinite(Number(point?.x))&&Number.isFinite(Number(point?.y)));
          if(geometry?.type!=='polyline'||points.length<2)throw new Error('Run geometry requires at least two points.');
          const first=points[0],last=points[points.length-1];
          const closed=Math.abs(Number(first.x)-Number(last.x))<=1e-7&&Math.abs(Number(first.y)-Number(last.y))<=1e-7;
          roles.push({...role,roleKey:STRIP_FOOTING_V4_ENDPOINT_ROLE,quantity:closed?0:2,unit:'EA',geometryType:'count'});
        }
      }
      const calculate=stripV4?calculateStripFootingV4:stripV3?calculateStripFootingV3:stripModern?calculateStripFootingV2:calculateCondition;
      return {outputs:calculate({archetypeKey:selectedSummary.archetype_code,conditionVersionId:selectedVersion.id,inputs,measurementRoles:roles,modules:currentModulesForSignature,outputOverrides:selectedVersion.output_overrides}).outputs,error:''};
    }catch(error){return {outputs:[],error:error instanceof Error?error.message:'Calculation inputs required.'};}
  },[selectedSummary,selectedVersion,definition,draft,templateVersion,measurements,roleSelections,compatibilityAssemblyVersionId,stripV4,stripV3,stripModern,currentModulesForSignature]);
  const liveConcrete=liveCalculation.outputs.find(row=>row.outputKey==='concrete.installed_cy');
  const conditionMeasurementIds=useMemo(()=>Array.from(new Set([...(conditionData.roles||[]).map(role=>role.measurement_id).filter(Boolean),...Object.values(roleSelections).filter(Boolean)])),[conditionData.roles,roleSelections]);

  const contractForVersion=(versionId:string)=>{
    const summary=conditions.find(row=>row.condition_version_id===versionId);
    const version=conditionData.versions.find(row=>row.id===versionId);
    if(!summary||!version)return{definition:null as typeof definition,versionNo:0};
    const versionNo=Number(conditionData.archetypeVersions.find(row=>row.id===version.archetype_version_id)?.version_no||1);
    return{definition:summary.archetype_code==='strip_wall_footing'?(versionNo>=4?STRIP_FOOTING_V4_DEFINITION:versionNo>=3?STRIP_FOOTING_V3_DEFINITION:versionNo>=2?STRIP_FOOTING_V2_DEFINITION:conditionArchetype(summary.archetype_code)):conditionArchetype(summary.archetype_code),versionNo};
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
    if(mobileReview)return buildDerived3DScene({scopeKey:setId,conditions:[],measurements:[],sheets:[]});
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
  },[conditionData.derived3DSnapshot,setId,dirty,selectedVersion,draft,templateVersion,currentModulesForSignature,roleSelections,mobileReview]);
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

  const focusMeasurement=(measurementId:string|null)=>{setSelectedMeasurementId(measurementId);const measurement=measurementId?measurements.find((row:any)=>row.id===measurementId):null;if(measurement?.sheet_id)setActiveSheetId(measurement.sheet_id);};
  const primaryMeasurementForVersion=(versionId:string)=>{const contract=contractForVersion(versionId).definition;if(!contract)return null;const primary=contract.roles.find(role=>role.primary);if(!primary)return null;const working=versionId===selectedVersionId?roleSelections[primary.key]||'':'';return working||conditionData.roles.find(role=>role.condition_version_id===versionId&&role.role_key===primary.key)?.measurement_id||null;};
  const changeViewMode=(mode:ViewMode)=>{setViewMode(mode);};
  const applyConditionSelection=(versionId:string,focusPlan=true,measurementId?:string|null,nextTab?:PropertyTab,nextMode?:ViewMode,startPrimaryDraw=false)=>{
    pendingPrimaryDrawRef.current=null;
    setSelectedVersionId(versionId);setCreating(false);
    if(nextTab){setPropertyTab(nextTab);setPhase('assembly');}if(nextMode)setViewMode(nextMode);
    if(measurementId!==undefined){focusMeasurement(measurementId);return;}
    if(!focusPlan)return;
    const primaryMeasurementId=primaryMeasurementForVersion(versionId);
    focusMeasurement(primaryMeasurementId);
    if(startPrimaryDraw&&!editorLocked&&!primaryMeasurementId){
      pendingPrimaryDrawRef.current=versionId;
      setDrawRequestSequence(value=>value+1);
    }
  };
  const requestConditionSelection=(versionId:string,focusPlan=true,measurementId?:string|null,nextTab?:PropertyTab,nextMode?:ViewMode,startPrimaryDraw=false)=>{
    if(versionId!==selectedVersionId&&dirty){setMessage('');setPendingSwitch({kind:'condition',versionId,focusPlan,measurementId,propertyTab:nextTab,viewMode:nextMode,startPrimaryDraw});return;}
    applyConditionSelection(versionId,focusPlan,measurementId,nextTab,nextMode,startPrimaryDraw);
  };
  const requestMeasurementSelection=(measurementId:string|null)=>{
    const role=conditionData.roles.find(role=>role.measurement_id===measurementId&&conditions.some(row=>row.condition_version_id===role.condition_version_id));
    if(role){requestConditionSelection(role.condition_version_id,false,measurementId);return;}
    focusMeasurement(measurementId);
  };
  const selectDerivedSolid=(solid:Derived3DSolid)=>requestConditionSelection(solid.conditionVersionId,false,solid.measurementId);
  const jumpToDerivedIssue=(entry:Derived3DIssue)=>requestConditionSelection(entry.conditionVersionId,false,entry.measurementId,entry.target||'drawing','split');

  useEffect(()=>{if(!selectedVersionId&&conditions[0])setSelectedVersionId(conditions[0].condition_version_id);if(selectedVersionId&&!conditions.some(row=>row.condition_version_id===selectedVersionId)&&conditions[0])setSelectedVersionId(conditions[0].condition_version_id);},[conditions,selectedVersionId]);
  useEffect(()=>{
    if(sourceMeasurementAppliedRef.current)return;
    const measurementId=new URLSearchParams(window.location.search).get('measurement');
    if(!measurementId||!measurements.some((row:any)=>row.id===measurementId))return;
    sourceMeasurementAppliedRef.current=true;
    requestMeasurementSelection(measurementId);
    setPropertyTab('general');
    setPhase('assembly');
  },[measurements,conditionData.roles,conditions]); // Apply the source link after the default Condition selection.
  useEffect(()=>{if(!selectedVersion)return;setDraft(draftFromVersion(selectedVersion));setModuleEnabled(Object.fromEntries(selectedModules.map(module=>[module.module_key,Boolean(module.enabled)])));setModuleDraft(Object.fromEntries(selectedModules.filter(module=>module.instance_key==='default').map(module=>[module.module_key,{...(module.input_values||{})}])));setModuleConfigurations(selectedModules.map(toModuleConfiguration));const assigned=conditionData.roles.filter(row=>row.condition_version_id===selectedVersion.id);setRoleSelections(Object.fromEntries(assigned.map(role=>[role.role_key,role.measurement_id])));setLoadedVersionId(selectedVersion.id);setIssuesOpen(false);setUpgradeOpen(false);setMessage('');},[selectedVersion?.id,selectedVersion?.updated_at]);
  useEffect(()=>{if(!availableTabs.includes(propertyTab))setPropertyTab('general');},[availableTabs,propertyTab]);
  useEffect(()=>{const open=()=>{setCreating(false);setPhase('assembly');};window.addEventListener('carez:open-conditions',open);return()=>window.removeEventListener('carez:open-conditions',open);},[setPhase]);
  useEffect(()=>{const sheet=(event:Event)=>{const sheetId=String((event as CustomEvent<{sheetId?:string|null}>).detail?.sheetId||'')||null;setActiveSheetId(sheetId);setSelectedMeasurementId(current=>measurements.some((row:any)=>row.id===current&&row.sheet_id===sheetId)?current:null);};window.addEventListener('carez:takeoff-sheet-change',sheet as EventListener);return()=>window.removeEventListener('carez:takeoff-sheet-change',sheet as EventListener);},[measurements]);
  useEffect(()=>{
    const pending=pendingRoleDrawRef.current;
    if(!pending)return;
    if(pending.conditionVersionId!==selectedVersionId){pendingRoleDrawRef.current=null;return;}
    const role=definition?.roles.find(entry=>entry.key===pending.roleKey);
    if(!role)return;
    const candidates=measurements.filter((measurement:any)=>!pending.existingMeasurementIds.has(String(measurement.id))&&conditionMeasurementMatchesRole(measurement,role,compatibilityAssemblyVersionId));
    if(candidates.length!==1)return;
    const measurementId=String(candidates[0].id);
    setRoleSelections(current=>{
      const next={...current};
      for(const key of Object.keys(next))if(key!==role.key&&next[key]===measurementId)next[key]='';
      next[role.key]=measurementId;
      return next;
    });
    focusMeasurement(measurementId);
    pendingRoleDrawRef.current=null;
    setMessage(`${role.label} assigned · save & recalculate.`);
  },[measurements,selectedVersionId,definition,compatibilityAssemblyVersionId]);

  const updateInput=(input:ConditionInputDefinition,value:string)=>{const parsed=input.valueType==='number'||input.valueType==='integer'?(value===''?'':Number(value)):input.valueType==='boolean'?value==='true':value;setDraft(current=>({...current,[input.group]:{...(current[input.group]||{}),[input.key]:parsed}}));setMessage('');};
  const setRole=(roleKey:string,measurementId:string)=>setRoleSelections(current=>{const next={...current};if(measurementId)for(const key of Object.keys(next))if(key!==roleKey&&next[key]===measurementId)next[key]='';next[roleKey]=measurementId;setMessage('');return next;});
  const updateModuleInput=(moduleKey:string,key:string,value:unknown)=>{setModuleDraft(current=>({...current,[moduleKey]:{...(current[moduleKey]||{}),[key]:value}}));setMessage('');};
  const v4RoleAssemblyCode=(role:any)=>stripV4&&selectedSummary?.archetype_code==='strip_wall_footing'&&role.key==='anchors_embeds'?'COND-STRIP-ANCHOR-EMBED-RUNTIME':null;
  const assemblyVersionForRole=(role:any)=>{
    if(role.primary&&compatibilityAssemblyVersionId)return compatibilityAssemblyVersionId;
    if(stripV4){
      const code=v4RoleAssemblyCode(role);if(!code)return null;
      const assembly=assemblies.find((row:any)=>row.code===code);if(!assembly)return null;
      return [...assemblyVersions].filter((version:any)=>version.assembly_id===assembly.id).sort((a:any,b:any)=>Number(b.version_no||0)-Number(a.version_no||0))[0]?.id||null;
    }
    const ids=new Set(assemblies.filter((row:any)=>row.category==='Concrete Conditions'&&row.primary_measurement===role.unit).map((row:any)=>row.id));
    return assemblyVersions.find((version:any)=>ids.has(version.assembly_id))?.id||assemblyVersions.find((version:any)=>assemblies.some((assembly:any)=>assembly.id===version.assembly_id&&assembly.primary_measurement===role.unit))?.id||null;
  };
  const startTakeoff=(role:any)=>{
    if(mobileReview){setMessage('Takeoff authoring is available on desktop.');return;}
    const assemblyVersionId=assemblyVersionForRole(role);
    if(!assemblyVersionId||!selectedVersion){setMessage(`No ${role.unit} takeoff is available for this role.`);return;}
    const begin=()=>{
      pendingRoleDrawRef.current={conditionVersionId:selectedVersion.id,roleKey:role.key,existingMeasurementIds:new Set(measurements.map((measurement:any)=>String(measurement.id)))};
      setViewMode('2d');
      setPhase('tracing');
      window.dispatchEvent(new CustomEvent('carez:start-condition-takeoff',{detail:{assemblyVersionId,name:selectedSummary?.name||definition?.name||'Concrete Condition',roleLabel:role.label}}));
      setMessage(`Drawing ${role.label}.`);
    };
    if(dirty&&!Object.values(roleSelections).some(Boolean)){saveCondition(begin);return;}
    begin();
  };
  useEffect(()=>{
    const requestedVersionId=pendingPrimaryDrawRef.current;
    if(!requestedVersionId||requestedVersionId!==selectedVersionId||requestedVersionId!==loadedVersionId)return;
    pendingPrimaryDrawRef.current=null;
    const primaryRole=definition?.roles.find(role=>role.primary);
    if(primaryRole)startTakeoff(primaryRole);
  },[drawRequestSequence,selectedVersionId,loadedVersionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const chooseFamily=(key:ConditionArchetypeKey)=>{const next=CONDITION_ARCHETYPES[key];setFamily(key);setCreateName(next.name);setCreateCode(conditionCodeFromName(next.name));setCodeTouched(false);};
  const openCreateEditor=()=>{if(dirty){setMessage('');setPendingSwitch({kind:'open-create'});return;}setIssuesOpen(false);setCreating(true);setPhase('assembly');};
  const commitCreateCondition=()=>{setMessage('Creating condition…');startTransition(async()=>{try{const result=await createProjectConcreteConditionPilot({takeoffSetId:setId,archetypeKey:family,code:createCode,name:createName});setSelectedVersionId(result.condition_version_id);setCreating(false);setPhase('assembly');setMessage('Condition created. Add dimensions and link a takeoff when ready.');router.refresh();}catch(error:any){setMessage(error?.message||'Could not create condition.');}});};
  const createCondition=()=>{if(dirty){setMessage('');setPendingSwitch({kind:'create'});return;}commitCreateCondition();};
  const saveCondition=(afterSave?:()=>void)=>{
    if(!selectedVersion||!definition)return;
    const roles=prepareConditionRoleAssignments(definition.roles,roleSelections);
    const primary=definition.roles.find(role=>role.primary);
    const anchorId=primary?roleSelections[primary.key]:'';
    if(!anchorId&&roles.length){setMessage('Link the primary takeoff before saving measurement assignments.');return;}
    if(!anchorId&&selectedOutputs.length){setMessage('A calculated Condition needs its primary takeoff. Restore the link before saving.');return;}
    const {inputs,provenance}=prepareConditionAuthoringInputs(draft);
    const modulesForSave=stripModern?moduleConfigurations:selectedModules.map((module,index)=>({
      moduleKey:module.module_key,instanceKey:module.instance_key,label:module.label,
      enabled:moduleEnabled[module.module_key]!==false,
      inputValues:(moduleDraft[module.module_key]||module.input_values) as Record<string,any>,
      inputProvenance:module.input_provenance as Record<string,any>,
      legacyChildKey:module.legacy_child_key,sortOrder:module.sort_order||(index+1)*10,
    }));
    setMessage(anchorId?'Saving and recalculating…':'Saving unmeasured draft…');
    startTransition(async()=>{
      try{
        if(anchorId){
          await saveAndRecalculateConcreteConditionPilot({
            conditionVersionId:selectedVersion.id,inputs,inputProvenance:provenance,
            modules:modulesForSave,measurementRoles:roles,compatibilityAnchorMeasurementId:anchorId,
          });
        }else{
          await saveUnmeasuredConcreteConditionDraft({
            conditionVersionId:selectedVersion.id,inputs,inputProvenance:provenance,modules:modulesForSave,
          });
        }
        setMessage(anchorId?'Saved and recalculated.':'Draft saved. Draw or link a takeoff to calculate.');
        afterSave?.();
        router.refresh();
      }catch(error:any){setMessage(error?.message||'Could not save condition.');}
    });
  };
  const completePendingSwitch=(next:PendingSwitch)=>{
    if(next.kind==='create'){commitCreateCondition();return;}
    if(next.kind==='open-create'){setIssuesOpen(false);setCreating(true);setPhase('assembly');return;}
    applyConditionSelection(next.versionId,next.focusPlan,next.measurementId,next.propertyTab,next.viewMode,next.startPrimaryDraw);
  };
  const upgradeCondition=()=>{if(!selectedVersion||!latestVersionAvailable)return;setMessage(`Upgrading to Contract v${latestContractVersion}…`);startTransition(async()=>{try{const result=await upgradeProjectConcreteConditionDraftToLatest({takeoffSetId:setId,conditionVersionId:selectedVersion.id});setUpgradeOpen(false);setPropertyTab('general');setIssuesOpen(false);setMessage(result.message||`Contract upgraded to v${result.to_contract_version}. Review and recalculate.`);router.refresh();}catch(error:any){setUpgradeOpen(false);setMessage(error?.message||'Could not upgrade Condition contract.');}});};

  const renderInputs=(inputs:ConditionInputDefinition[])=>{
    if(!inputs.length)return <div className={styles.compactEmpty}>No inputs in this section.</div>;
    return <div className={styles.fieldGrid}>{inputs.map(input=>{
      if(input.valueType==='boolean')return <InspectorBoolean key={`${input.group}-${input.key}`} id={switchId(selectedVersionId||'draft',input.group,input.key)} checked={Boolean(draft[input.group]?.[input.key])} onCheckedChange={checked=>updateInput(input,checked?'true':'false')} disabled={editorLocked||isPending} label={input.label} includeLabel="Yes" excludeLabel="No"/>;
      const value=String(draft[input.group]?.[input.key]??'');
      const dimension=isArchitecturalDimension(input);
      const numeric=input.valueType==='number'||input.valueType==='integer';
      const numericValue=numeric&&value!==''?Number(value):null;
      const invalidNumber=numericValue!==null&&Number.isFinite(numericValue)&&((input.minimum!==undefined&&numericValue<input.minimum)||(input.maximum!==undefined&&numericValue>input.maximum));
      const validationText=invalidNumber
        ?input.minimum!==undefined&&input.maximum!==undefined
          ?`Allowed range: ${input.minimum}–${input.maximum}${input.unit?` ${input.unit}`:''}.`
          :input.minimum!==undefined
            ?`Minimum: ${input.minimum}${input.unit?` ${input.unit}`:''}.`
            :`Maximum: ${input.maximum}${input.unit?` ${input.unit}`:''}.`
        :'';
      const showPlacementGuide=input.group==='production'&&input.key==='place_concrete_mh_per_unit'&&selectedSummary?.archetype_code==='strip_wall_footing'&&String(draft.production?.place_concrete_labor_method||'')==='factor';
      return <InspectorRow key={`${input.group}-${input.key}`} label={input.label} error={validationText}>
        {input.valueType==='select'
          ?<Dropdown aria-label={input.label} appearance="underline" className={inspectorSelectClass} value={value?humanize(value):''} selectedOptions={value?[value]:[]} placeholder="Select…" onOptionSelect={(_,data)=>updateInput(input,data.optionValue||'')} disabled={editorLocked||isPending}>{(input.options||[]).map(option=><Option key={option} value={option} text={humanize(option)}>{humanize(option)}</Option>)}</Dropdown>
          :input.valueType==='text'
            ?<InspectorInput aria-label={input.label} value={value} onChange={event=>updateInput(input,event.target.value)} disabled={editorLocked||isPending}/>
            :dimension
              ?<InspectorImperialInput value={value} canonicalUnit={input.unit} onValueChange={next=>updateInput(input,next)} disabled={editorLocked||isPending} ariaLabel={input.label} ariaInvalid={invalidNumber} />
              :<div className="relative w-full" onFocus={()=>{if(showPlacementGuide)setFocusedRateKey(input.key);}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocusedRateKey(null);}}><InspectorNumberInput aria-label={input.label} value={value} onChange={event=>updateInput(input,event.target.value)} unit={input.unit} min={input.minimum} max={input.maximum} step={input.valueType==='integer'?1:'any'} disabled={editorLocked||isPending} aria-invalid={invalidNumber||undefined}/>{showPlacementGuide&&focusedRateKey===input.key?<div className={styles.rateRecommendation} role="status"><strong>{placementRecommendation?`Recommended: ${placementRecommendation.factor.toFixed(3)} MH/CY`:'National Estimator recommendations'}</strong><span>{placementRecommendation?placementRecommendation.label:'Select a pour method to narrow the recommendation.'} · 2026 National Construction Estimator, Concrete, p. 351. Placing only; pump equipment, forms, finishing, and reinforcing are separate.</span>{!placementRecommendation?<span>{Object.values(FOOTING_PLACEMENT_MH_PER_CY).map(row=>`${row.label}: ${row.factor.toFixed(3)}`).join(' · ')} MH/CY</span>:null}<small>The input remains blank until you enter your chosen rate.</small></div>:null}</div>}
      </InspectorRow>;
    })}</div>;
  };
  const renderInputGroup=(group:ConditionInputGroup)=>renderInputs(definition?.inputs.filter(input=>input.group===group)||[]);
  const renderLaborProductivity=()=>{
    if(!definition)return null;
    const production=definition.inputs.filter(input=>input.group==='production');
    return <div className="grid gap-1">{LABOR_ACTIVITIES.map(([prefix,label])=>{
      const methodInput=production.find(input=>input.key===`${prefix}_labor_method`);if(!methodInput)return null;
      const method=String(draft.production?.[methodInput.key]||'');
      const active=method==='crew_rate'?[methodInput,production.find(input=>input.key===`${prefix}_crew_size`),production.find(input=>input.key===`${prefix}_production_per_crew_hr`)]:[methodInput,production.find(input=>input.key===`${prefix}_mh_per_unit`)];
      return <section key={prefix} className={`${styles.laborGroup} overflow-hidden rounded-[4px] border border-border px-2`}><div className="border-b border-border py-1 text-[10px] font-medium text-muted-foreground">{label}</div>{renderInputs(active.filter(Boolean) as ConditionInputDefinition[])}</section>;
    })}</div>;
  };
  const renderModule=(moduleKey:ConditionModuleKey)=>{const module=selectedModules.find(row=>row.module_key===moduleKey);if(!module)return <div className={styles.compactEmpty}>{MODULE_LABELS[moduleKey]} is not available for this condition.</div>;const enabled=moduleEnabled[moduleKey]!==false;const entries=Object.entries(moduleDraft[moduleKey]||{});return <><div className={direction.moduleControlRow}><InspectorBoolean id={switchId(selectedVersionId||'draft',moduleKey,'enabled')} checked={enabled} onCheckedChange={checked=>{setModuleEnabled(current=>({...current,[moduleKey]:checked}));setMessage('');}} disabled={editorLocked||isPending} label={moduleKey==='forms'?'Forms required?':'Include in Condition'} description={moduleKey==='forms'?(enabled?'Yes':'No'):(enabled?'Included in this Condition':'Excluded from this Condition')} className="w-full"/></div>{enabled?(entries.length?<div className={styles.fieldGrid}>{entries.map(([key,value])=>typeof value==='boolean'?<InspectorBoolean key={`${moduleKey}-${key}`} id={switchId(selectedVersionId||'draft',moduleKey,key)} checked={value} onCheckedChange={checked=>updateModuleInput(moduleKey,key,checked)} disabled={editorLocked||isPending} label={humanize(key)} includeLabel="Yes" excludeLabel="No"/>:<InspectorRow key={`${moduleKey}-${key}`} label={humanize(key)}>{typeof value==='number'?<InspectorNumberInput aria-label={humanize(key)} value={String(value)} onChange={event=>updateModuleInput(moduleKey,key,event.target.value===''?'':Number(event.target.value))} step="any" disabled={editorLocked||isPending}/>:<InspectorInput aria-label={humanize(key)} value={String(value??'')} onChange={event=>updateModuleInput(moduleKey,key,event.target.value)} disabled={editorLocked||isPending}/>}</InspectorRow>)}</div>:<div className={styles.moduleReady}><CheckCircle2/><span>Included</span></div>):null}</>;};
  const moduleEditor=(moduleKey:ConditionModuleKey)=>stripModern&&definition?<ConditionModuleEditor definition={definition} moduleKey={moduleKey} modules={moduleConfigurations} onChange={modules=>{setModuleConfigurations(modules);setMessage('');}} disabled={editorLocked||isPending} enableLabel={moduleKey==='forms'?'Forms required?':undefined} validationError={liveCalculation.error}/>:renderModule(moduleKey);

  const primaryRole=definition?.roles.find(role=>role.primary)||null;
  const primaryMeasurementId=primaryRole?roleSelections[primaryRole.key]||'':'';
  const primaryMeasurement=measurements.find((row:any)=>row.id===primaryMeasurementId)||null;
  const currentSection=sections.find((row:any)=>row.id===primaryMeasurement?.estimate_section_id)||null;
  const assignSection=(sectionId:string|null)=>{if(!primaryMeasurementId)return;setMessage('Assigning estimate section…');startTransition(async()=>{try{await assignConditionPrimaryTakeoffSection({takeoffSetId:setId,measurementId:primaryMeasurementId,sectionId});setMessage('');router.refresh();}catch(error:any){setMessage(error?.message||'Could not assign estimate section.');}});};

  const output=(key:string)=>selectedOutputs.find(row=>row.output_key===key);
  const outputText=(key:string)=>{const row=output(key);return row&&row.status!=='inactive'?quantity(row.production_quantity,row.production_unit):'—';};
  const issueTab=(issue:ConditionIssue):PropertyTab=>issue.category==='production'?'labor':issue.category==='pricing'||issue.category==='commercial'?'review':issue.category==='scope'?'general':tabForHold({message:issue.message});
  const openIssue=(issue:ConditionIssue)=>{const tab=issueTab(issue);if(availableTabs.includes(tab)){setPropertyTab(tab);setPhase('assembly');setIssuesOpen(false);return;}if((issue.category==='pricing'||issue.category==='commercial')&&estimateId){if(dirty){setMessage('Save or discard Condition changes before opening Estimate pricing.');return;}router.push(`/opportunities?estimate=${encodeURIComponent(estimateId)}&tab=worksheet#pricing-coverage`);return;}setPropertyTab('general');setPhase('assembly');setIssuesOpen(false);};
  const workingRoleCount=Object.values(roleSelections).filter(Boolean).length;
  const summaryText=dirty?`${workingRoleCount} takeoffs · unsaved`:`${selectedSummary?.measurement_count||0} takeoffs · ${activeOutputCount} outputs`;
  const legacyOutputs=(workspaceProps.measurementSummaries||[]) as LegacyOutputRow[];
  const recapRows=useMemo<RecapRow[]>(()=>{
    const linkedOutputIds=new Set(conditionData.outputs.map(row=>row.legacy_takeoff_output_id).filter(Boolean));
    const linkedItemIds=new Set(conditionData.outputs.map(row=>row.generated_estimate_item_id).filter(Boolean));
    const laborByOutputId=new Map(legacyOutputs.filter(row=>row.estimate_item_type==='labor').map(row=>[row.id,row]));
    const laborByItemId=new Map(legacyOutputs.filter(row=>row.estimate_item_type==='labor'&&row.generated_estimate_item_id).map(row=>[row.generated_estimate_item_id,row]));
    const conditionRows=conditionData.outputs.filter(row=>row.status!=='inactive').map(row=>({
      key:`condition:${row.id}`,
      conditionVersionId:row.condition_version_id,
      conditionCode:conditions.find(condition=>condition.condition_version_id===row.condition_version_id)?.code||'Condition',
      label:row.label,
      outputKey:row.output_key,
      productionQuantity:row.production_quantity,
      productionUnit:row.production_unit,
      status:conditionOutputStatus(row),
      directCost:row.direct_cost,
      pending:dirty&&row.condition_version_id===selectedVersionId,
      laborOutput:(row.legacy_takeoff_output_id?laborByOutputId.get(row.legacy_takeoff_output_id):null)||(row.generated_estimate_item_id?laborByItemId.get(row.generated_estimate_item_id):null)||null,
    }));
    const historicalRows=legacyOutputs.filter(row=>row.is_active&&row.estimate_visible&&!linkedOutputIds.has(row.id)&&!linkedItemIds.has(row.generated_estimate_item_id)).map(row=>({
      key:`legacy:${row.id}`,
      conditionVersionId:null,
      conditionCode:measurements.find((measurement:any)=>measurement.id===row.measurement_id)?.name||'Historical takeoff',
      label:row.label,
      outputKey:row.component_key,
      productionQuantity:row.production_quantity,
      productionUnit:row.production_unit,
      status:row.pricing_status==='missing_input'?'Calculation hold':row.pricing_status==='missing_price'||row.pricing_status==='missing_labor_rate'?'Qty ready · Price missing':row.pricing_status==='priced'||row.pricing_status==='manual_override'?'Ready':row.pricing_status==='not_priced'?'Not priced':'Qty ready',
      directCost:row.direct_cost,
      pending:false,
      laborOutput:row.estimate_item_type==='labor'?row:null,
    }));
    return [...conditionRows,...historicalRows].sort((a,b)=>`${a.conditionCode}:${a.outputKey}`.localeCompare(`${b.conditionCode}:${b.outputKey}`));
  },[conditionData.outputs,conditions,dirty,selectedVersionId,legacyOutputs,measurements]);
  const recapCost=recapRows.filter(row=>!row.pending&&row.status==='Ready').reduce((total,row)=>total+Number(row.directCost||0),0);
  const recapPartial=recapRows.some(row=>row.pending||row.status!=='Ready');
  const recapHolds=(conditionData.holds||[]).filter(row=>row.status==='open').length+recapRows.filter(row=>row.key.startsWith('legacy:')&&row.status==='Calculation hold').length;



  const setupTreePanel=(
          <aside className={styles.setupTree} aria-label="Assembly tree">
            <div className={styles.treeHeading}><strong>Assemblies</strong><Badge appearance="outline" size="small">{conditions.length}</Badge></div>
            <div className={styles.treeSearch}><FluentInput appearance="underline" size="small" contentBefore={<SearchRegular/>} aria-label="Filter assemblies" placeholder="Filter assemblies" value={conditionQuery} onChange={(_,data)=>setConditionQuery(data.value)}/></div>
            <nav className={styles.treeScroll} aria-label="Condition families">
              {assemblyGroups.map(group=>{
                const expanded=!collapsedAssemblies.includes(group.key);
                return <div key={group.key} className={styles.treeGroup}>
                  <FluentButton type="button" className={styles.treeGroupButton} aria-expanded={expanded} aria-controls={`setup-assembly-${group.key}`} onClick={()=>toggleFamily(group.key)}><ChevronDownRegular className={expanded?styles.treeChevron:styles.treeChevronCollapsed}/><span>{group.name}</span><small>{group.conditions.length}</small></FluentButton>
                  <div id={`setup-assembly-${group.key}`} hidden={!expanded} className={styles.treeChildren}>{group.conditions.map(row=><FluentButton type="button" key={row.condition_version_id} className={row.condition_version_id===selectedVersionId&&!creating?styles.treeItemSelected:styles.treeItem} aria-current={row.condition_version_id===selectedVersionId&&!creating?'true':undefined} onClick={()=>requestConditionSelection(row.condition_version_id,false)} title={`${row.code} · ${row.name} · R${row.revision_no}`}><span className={styles.treeSwatch} style={{backgroundColor:conditionColor(row.archetype_code)}}/><span className={styles.treeItemName}>{row.name}</span>{row.open_hold_count?<small className={styles.treeIssueCount}>{row.open_hold_count}</small>:null}</FluentButton>)}</div>
                </div>;
              })}
              {!conditions.length?<p className={styles.treeEmpty}>Create an assembly to define the first Condition.</p>:conditionQuery&&!assemblyGroups.length?<p className={styles.treeEmpty}>No assemblies match this filter.</p>:null}
            </nav>
            <div className={styles.treeFooter}>{conditions.length} condition{conditions.length===1?'':'s'} · {measurements.length} takeoff{measurements.length===1?'':'s'}</div>
          </aside>
  );
  const setupEditorPanel=(
        <div className={`${editorFields.surface} ${styles.commandDrawer} ${styles.setupEditor}`}>
          <header className={styles.editorToolbar}>
            <div className={styles.editorIdentity}><h2>{creating?'New condition':selectedSummary?.name||'Select a condition'}</h2>{selectedSummary&&!creating?<span>{selectedSummary.code} · R{selectedSummary.revision_no} · Contract v{contractVersion} · {humanize(selectedSummary.version_status)}</span>:null}</div>
            <div className={styles.editorActions}>{!creating&&selectedVersion?<FluentButton type="button" appearance="primary" size="small" icon={<SaveRegular/>} onClick={()=>saveCondition()} disabled={editorLocked||isPending||selectedVersion.status!=='draft'||!dirty}>{isPending?'Saving…':'Save Condition'}</FluentButton>:null}<FluentButton type="button" appearance="subtle" size="small" icon={<ArrowRightRegular/>} iconPosition="after" onClick={()=>setPhase('tracing')}>Open tracing</FluentButton></div>
          </header>
      {editorLocked&&<div role="note" className="border-b border-border bg-muted px-5 py-2 text-xs text-muted-foreground">{mobileReview?'Mobile review is read only. Open this workspace on desktop to edit a draft.':'This issued revision is read only. You can review these values; create the next estimate revision to edit them.'}</div>}

      {creating?<div className={`${styles.inspectorScroll} flex-1 min-h-0 overflow-y-auto p-5`}><div className={styles.familyList}>{(Object.keys(CONDITION_ARCHETYPES) as ConditionArchetypeKey[]).map(key=>{const item=CONDITION_ARCHETYPES[key];return <FluentButton type="button" key={key} className={family===key?styles.familyActive:styles.familyButton} onClick={()=>chooseFamily(key)}><b>{item.primaryUnit}</b><span>{item.name}</span></FluentButton>;})}</div><InspectorRow label="Condition name" htmlFor="new-condition-name"><InspectorInput id="new-condition-name" value={createName} onChange={event=>{const name=event.target.value;setCreateName(name);if(!codeTouched)setCreateCode(conditionCodeFromName(name));}}/></InspectorRow><InspectorRow label="Code" htmlFor="new-condition-code"><InspectorInput id="new-condition-code" value={createCode} onChange={event=>{setCodeTouched(true);setCreateCode(event.target.value.toUpperCase());}}/></InspectorRow><div className={styles.createActions}><FluentButton appearance="outline" onClick={()=>setCreating(false)}>Cancel</FluentButton><FluentButton onClick={createCondition} disabled={locked||isPending||!createName.trim()||!createCode.trim()}>{isPending?<RefreshCw className={styles.spin}/>:<Plus/>}Create</FluentButton></div><div className={styles.statusLine} role="status">{message}</div></div>
      :!selectedSummary||!selectedVersion||!definition?<div className={styles.propertiesEmpty}><Layers3/><strong>Select a condition</strong></div>:<>
        <div className={direction.conditionSummaryLine}><span className={styles.conditionColor} data-family={selectedSummary.archetype_code}/><span className={direction.summaryMeta}>{summaryText}</span>{latestVersionAvailable&&selectedSummary.archetype_code==='strip_wall_footing'?(selectedVersion.status==='draft'?<FluentButton type="button" className={direction.versionAction} onClick={()=>setUpgradeOpen(true)} disabled={locked||isPending||dirty}>Upgrade to v{latestContractVersion}</FluentButton>:<span className={direction.versionNotice}>v{latestContractVersion} available · new draft required</span>):null}{selectedIssueSummary.total?<FluentButton type="button" className={direction.summaryHold} aria-expanded={issuesOpen} aria-controls="condition-issues" title={selectedIssueSummary.detail} onClick={()=>setIssuesOpen(open=>!open)}>Issues {selectedIssueSummary.total}<ChevronDown className={`${direction.issueChevron} ${issuesOpen?direction.issueChevronOpen:''}`}/></FluentButton>:null}</div>
        <div key={selectedVersionId} ref={propertyScrollRef} className={`${styles.inspectorGrid} ${styles.editorGridViewport}`}>
            <section className={styles.editorColumn} aria-labelledby="physical-variables"><h3 id="physical-variables" className={styles.columnHeading}>Physical variables</h3>
            <div className={`${styles.inspectorScroll} ${styles.columnScroll}`}>
          <ConditionSection id="condition-section-dimensions" heading={<><Ruler/><strong>Dimensions</strong><small>{selectedSummary.archetype_name} · feet and inches</small></>}><div className={styles.drawingFacts}>{definition.roles.filter(role=>role.primary).map(role=>{const measurement=measurements.find((row:any)=>String(row.id)===roleSelections[role.key]);const sheet=measurement?sheets.find((row:any)=>row.id===measurement.sheet_id):null;return <div className={styles.drawingFact} key={role.key}><span><strong>{role.label}</strong><small>{measurement?`${sheet?.sheet_number||`Page ${sheet?.page_number||'?'}`} · drawing measurement`:'No takeoff linked · draw now or link later'}</small></span><b>{measurement?quantity(measurement.raw_quantity,measurement.raw_unit):'Pending'}</b></div>;})}</div>{renderInputGroup('planFacts')}{definition.inputs.some(input=>input.group==='drawing')?renderInputGroup('drawing'):null}</ConditionSection>
          {supportsModule('concrete')?<ConditionSection id="condition-section-concrete" heading={<><strong>Concrete</strong><small>Section and mix</small></>}>{moduleEditor('concrete')}</ConditionSection>:null}
          <ConditionSection id="condition-section-reinforcement" heading={<><strong>Reinforcement</strong><small>Bars, dowels, anchors, hold downs, embeds</small></>}>{supportsModule('reinforcing')?moduleEditor('reinforcing'):null}{supportsModule('anchors_embeds')?moduleEditor('anchors_embeds'):null}</ConditionSection>
          {supportsModule('forms')?<ConditionSection id="condition-section-forms" heading={<><strong>Forms</strong><small>Yes shows form properties; No excludes forms</small></>}>{moduleEditor('forms')}</ConditionSection>:null}
          <ConditionSection id="condition-section-pour" heading={<><strong>Pour method</strong><small>Confirm the matching company productivity in Labor</small></>}>{supportsModule('placement_equipment')?moduleEditor('placement_equipment'):null}{definition.inputs.some(input=>input.group==='methods')?renderInputGroup('methods'):null}{!supportsModule('placement_equipment')&&!definition.inputs.some(input=>input.group==='methods')?<p className={styles.compactEmpty}>This Condition contract has no pour-method field. Enter the approved placement rate in Labor.</p>:null}</ConditionSection>
          {supportsModule('excavation_backfill')?<ConditionSection id="condition-section-excavation" heading={<><strong>Excavation and backfill</strong></>}>{moduleEditor('excavation_backfill')}</ConditionSection>:null}
          {supportsModule('finish_cure_protection')?<ConditionSection id="condition-section-finish" heading={<><strong>Finish, cure, and protection</strong></>}>{moduleEditor('finish_cure_protection')}</ConditionSection>:null}
          {supportsModule('slab_systems')?<ConditionSection id="condition-section-slab" heading={<><strong>Slab system</strong></>}>{moduleEditor('slab_systems')}</ConditionSection>:null}
          <ConditionSection id="condition-section-takeoff" heading={<><strong>Takeoff link</strong><small>Draw first or link an existing measurement</small></>}><div className={styles.roleList}>{definition.roles.map(role=>{const roleAssemblyVersionId=assemblyVersionForRole(role);const choices=measurements.filter((measurement:any)=>conditionMeasurementMatchesRole(measurement,role,compatibilityAssemblyVersionId)&&(!stripV4||role.primary||Boolean(roleAssemblyVersionId&&measurement.assembly_version_id===roleAssemblyVersionId)));return <InspectorRow key={role.key} label={role.label} hint={`${role.unit} · ${role.primary?'Primary':'Optional'}`}><div className="flex w-full min-w-0 items-center gap-1"><ConditionRolePicker value={roleSelections[role.key]||''} choices={choices.map((measurement:any)=>{const sheet=sheets.find((item:any)=>item.id===measurement.sheet_id);return{id:measurement.id,label:measurement.name,meta:`${quantity(measurement.raw_quantity,measurement.raw_unit)} · ${sheet?.sheet_number||`Page ${sheet?.page_number||'?'}`}`};})} placeholder={role.required?'Select takeoff…':'Not used'} emptyLabel={role.required?'No takeoff selected':'Not used'} disabled={editorLocked||isPending} onChange={value=>setRole(role.key,value)}/><FluentButton size="small" appearance="outline" className="h-6 shrink-0 px-1.5 text-[10px]" onClick={()=>startTakeoff(role)} disabled={editorLocked||isPending||(!role.primary&&stripV4&&!roleAssemblyVersionId)}>Draw {role.unit}</FluentButton></div></InspectorRow>;})}</div></ConditionSection>
            </div>
            </section>
            <section className={`${styles.editorColumn} ${styles.commercialColumn}`} aria-labelledby="commercial-variables"><h3 id="commercial-variables" className={styles.columnHeading}>Commercial variables</h3>
            <div className={`${styles.inspectorScroll} ${styles.columnScroll}`}>
          <ConditionSection id="condition-section-labor" heading={<><strong>Labor</strong><small>{selectedPourMethod?`${humanize(selectedPourMethod)} · confirm placement productivity`:'Company production rates or condition override'}</small></>}>{supportsModule('labor')?moduleEditor('labor'):null}{stripV3&&moduleIncluded('labor')?renderLaborProductivity():!stripV3?renderInputGroup('production'):null}</ConditionSection>
          {supportsModule('miscellaneous')?<ConditionSection id="condition-section-resources" heading={<><strong>Other resources</strong></>}>{moduleEditor('miscellaneous')}</ConditionSection>:null}
          {definition.inputs.some(input=>input.group==='commercial')?<ConditionSection id="condition-section-procurement" heading={<><strong>Procurement allowances</strong></>}>{renderInputs(definition.inputs.filter(input=>input.group==='commercial'))}</ConditionSection>:null}
          <ConditionSection id="condition-section-review" heading={<><strong>Review</strong><small>{selectedIssueSummary.total?selectedIssueSummary.detail:'No open issues'}</small></>}>{primaryMeasurementId?<InspectorRow label="Estimate section"><Dropdown aria-label="Estimate section" appearance="underline" className={inspectorSelectClass} value={currentSection?.name||'Estimate section · unassigned'} selectedOptions={[String(primaryMeasurement?.estimate_section_id||'__unassigned')]} onOptionSelect={(_,data)=>assignSection(data.optionValue==='__unassigned'?null:data.optionValue||null)} disabled={editorLocked||isPending}><Option value="__unassigned" text="Estimate section · unassigned">Estimate section · unassigned</Option>{sections.map((section:any)=><Option key={section.id} value={section.id} text={section.name}>{section.name}</Option>)}</Dropdown></InspectorRow>:<p className={styles.compactEmpty}>Link a takeoff to assign an estimate section and calculate outputs.</p>}</ConditionSection>
            </div>
            </section>
        </div>
      </>}
        </div>
  );

  return <div className={styles.integrated} data-mobile-review={mobileReview?'true':'false'} data-context-tab="plans" data-view-mode={mobileReview?'2d':viewMode}>
    <nav className={styles.phaseNav} aria-label="Takeoff workflow">
      {([['assembly','01','Assembly Setup'],['tracing','02','Tracing Engine'],['recap','03','Commercial Recap']] as const).map(([key,index,label])=><FluentButton key={key} type="button" className={phase===key?styles.phaseActive:styles.phaseButton} aria-current={phase===key?'step':undefined} onClick={()=>setPhase(key as TakeoffPhase)}><span>{index}</span>{label}</FluentButton>)}
      <span className={styles.phaseContext}>{workspaceProps.sourceTitle||'Plan set'}</span>
    </nav>
    <div className={styles.phaseWorkspace}>
    <div className={styles.drawingHost} data-phase-active={phase==='tracing'?'true':'false'} aria-hidden={phase!=='tracing'} ref={drawingHostRef}>
      <TakeoffDrawingWorkspace {...workspaceProps} mobileReview={mobileReview} conditionMeasurementIds={conditionMeasurementIds} conditionSelectedMeasurementId={selectedMeasurementId} onConditionMeasurementSelect={requestMeasurementSelection} conditionPresentation={drawingPresentation} drawingViewHidden={phase!=='tracing'||(!mobileReview&&viewMode==='3d')} sidebar={mobileReview?null:<aside className="flex-none w-full bg-card border-r border-border h-full flex flex-col z-10 text-foreground" aria-label="Condition roster" onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}>
        <header className="sticky top-0 shrink-0 border-b border-border bg-card p-4">
          <h2 className="text-[11px] font-semibold">Assemblies</h2>
          <p className="mt-1 text-xs text-muted-foreground">{workspaceProps.sourceTitle}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
             <FluentButton type="button" onClick={openCreateEditor} disabled={locked||mobileReview}><Plus/>New Assembly</FluentButton>
            <FluentButton type="button" appearance="outline" onClick={()=>{setCreating(false);setPhase('assembly');}} disabled={!selectedVersionId}>Edit Conditions</FluentButton>
          </div>
           <label className="mt-4 block text-xs text-muted-foreground">Filter assemblies<FluentInput appearance="underline" className="mt-1.5 w-full rounded border border-input bg-secondary px-3 py-2 text-[11px] text-foreground focus:border-ring focus:outline-none" value={conditionQuery} onChange={event=>setConditionQuery(event.target.value)}/></label>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {assemblyGroups.map(group=>{
            const expanded=!collapsedAssemblies.includes(group.key);
            const selected=group.conditions.some(row=>row.condition_version_id===selectedVersionId);
            return <section key={group.key} aria-label={group.name}>
               <div className={`flex h-8 items-center border-b border-border px-2 ${selected?'bg-secondary':'bg-card'}`}>
                 <FluentButton type="button" aria-label={`${expanded?'Collapse':'Expand'} ${group.name}`} aria-expanded={expanded} aria-controls={`assembly-${group.key}`} className="p-1 text-muted-foreground" onClick={()=>toggleFamily(group.key)}><ChevronDown fontSize={12} className={expanded?'':'-rotate-90'}/></FluentButton>
                <FluentButton type="button" className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-foreground" aria-pressed={selected} onClick={()=>requestConditionSelection((group.conditions.find(row=>row.condition_version_id===selectedVersionId)||group.conditions[0]).condition_version_id)}>{group.name}</FluentButton>
                <span className="pl-2 text-[10px] text-muted-foreground">{group.conditions.length} conditions</span>
              </div>
              <div id={`assembly-${group.key}`} hidden={!expanded}>
                 {group.conditions.map(row=><div key={row.condition_version_id} className={`group relative ml-4 flex h-[32px] items-center border-b border-border px-3 hover:bg-accent ${selectedVersionId===row.condition_version_id?'bg-secondary border border-input text-foreground shadow-[inset_0px_1px_0px_rgba(255,255,255,0.05)]':''}`}>
                  <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[2px]" style={{backgroundColor:conditionData.derived3DSnapshot?.conditions.find(source=>source.conditionVersionId===row.condition_version_id)?.color||conditionColor(row.archetype_code)}}/>
                  <FluentButton type="button" aria-pressed={selectedVersionId===row.condition_version_id} onClick={()=>requestConditionSelection(row.condition_version_id,true,undefined,undefined,undefined,true)} className="flex h-full min-w-0 flex-1 items-center gap-2 text-left" title={`${row.name} · ${row.code} · R${row.revision_no}`}>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{row.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{row.measurement_count} takeoffs · {row.output_count} outputs{row.open_hold_count?` · ${row.open_hold_count} holds`:''}</span>
                   </FluentButton><FluentButton type="button" className="ml-1 shrink-0 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity hover:text-foreground [@media(hover:none)]:opacity-100" aria-label={`${derivedViewState.hidden.includes(row.condition_version_id)?'Show':'Hide'} ${row.name}`} aria-pressed={!derivedViewState.hidden.includes(row.condition_version_id)} onClick={()=>setDerivedViewState(current=>({...current,hidden:current.hidden.includes(row.condition_version_id)?current.hidden.filter(id=>id!==row.condition_version_id):[...current.hidden,row.condition_version_id]}))}>{derivedViewState.hidden.includes(row.condition_version_id)?<EyeOff fontSize={12}/>:<Eye fontSize={12}/>}</FluentButton>
                </div>)}
              </div>
            </section>;
          })}
          {!conditions.length?<p className="text-[11px] text-muted-foreground">Create an assembly to start measuring.</p>:null}
        </div>
         <footer className="border-t border-border p-4 text-xs text-muted-foreground">{selectedSummary?summaryText:'Select or create a condition'}</footer>
      </aside>} verificationPane={!mobileReview&&phase==='tracing'&&viewMode!=='2d'?<div className={`${styles.derivedOverlay} ${viewMode==='split'?styles.splitVerification:styles.derivedOverlay3d}`}><Takeoff3DViewport scene={derived3DScene} pdfUrl={workspaceProps.pdfUrl} activeSheetId={activeSheetId} activePageNumber={Number(activeSheet?.page_number||1)} activeSheetLabel={activeSheetLabel} selectedMeasurementId={selectedMeasurementId} selectedConditionVersionId={selectedVersionId} viewState={derivedViewState} onViewStateChange={setDerivedViewState} cameraMemory={r3fMemory.current} onSelectSolid={selectDerivedSolid} onJumpToIssue={jumpToDerivedIssue}/></div>:null}/>
      <div className={`${direction.drawingViewModes} ${styles.spatialRail}`} onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} aria-label="Takeoff view controls">
        <div className={styles.spatialContext} title={`${activeSheetLabel} · ${selectedSummary?.name||'Select a Condition'}`}>
          <span className={styles.datumMark} aria-hidden="true">+</span>
          <span>{activeSheetLabel}</span><span aria-hidden="true">/</span>
          <strong key={selectedMeasurementId||selectedVersionId||'empty'}>{measurements.find((row:any)=>row.id===selectedMeasurementId)?.name||selectedSummary?.name||'Select a Condition'}</strong>
        </div>
        {mobileReview?<div className="flex items-center gap-2"><label className="sr-only" htmlFor="mobile-condition-review">Condition</label><Select id="mobile-condition-review" value={selectedVersionId||''} onChange={event=>requestConditionSelection(event.target.value,false)} className="max-w-48 bg-secondary px-2 py-1 text-xs text-foreground"><option value="" disabled>Select condition</option>{conditions.map(row=><option key={row.condition_version_id} value={row.condition_version_id}>{row.name}</option>)}</Select><FluentButton size="small" onClick={()=>{setCreating(false);setPhase('assembly');}} disabled={!selectedVersionId}>Edit Conditions</FluentButton></div>:null}
        {!mobileReview&&<>
          <span className={styles.viewAuthority}>{viewMode==='2d'?'Plan · Measure':viewMode==='split'?'Plan + verification':'Derived · Verify'}</span>
          <div className={styles.viewModeSwitch} role="group" aria-label="Takeoff view mode">
            {(['2d','split','3d'] as ViewMode[]).map(mode=><FluentButton key={mode} type="button" aria-pressed={viewMode===mode} className={viewMode===mode?styles.viewModeActive:''} onClick={()=>changeViewMode(mode)}>{mode==='2d'?'2D':mode==='3d'?'3D':'Split'}</FluentButton>)}
          </div>
        </>}
      </div>
    </div>
    <section className={styles.setupPanel} hidden={phase!=='assembly'} aria-label="Assembly setup">
      <div className={styles.setupFrame}>
        <header className={styles.setupIntro}>
          <div className={styles.ribbonTitle}><span className={styles.eyebrow}>Takeoff / Conditions</span><h1>Assembly Setup</h1></div>
          <div className={styles.setupActions}><span className={styles.ribbonContext}>{workspaceProps.sourceTitle||'Plan set'}</span><label htmlFor="setup-condition" className={styles.mobileConditionLabel}>Condition</label><Select id="setup-condition" className={styles.mobileConditionSelect} value={selectedVersionId||''} onChange={event=>requestConditionSelection(event.target.value,false)} disabled={!conditions.length}>{!conditions.length?<option value="">No conditions</option>:conditions.map(row=><option key={row.condition_version_id} value={row.condition_version_id}>{row.code} · {row.name}</option>)}</Select><FluentButton type="button" size="small" appearance="subtle" icon={<AddRegular/>} disabled={editorLocked} onClick={openCreateEditor}>New Assembly</FluentButton>{!mobileReview?<ConditionDeletionManager setId={setId} locked={locked} conditions={conditionData.conditions}/>:null}</div>
        </header>
        <div className={styles.setupBody}>
          {mobileReview?<>{setupTreePanel}{setupEditorPanel}</>:<div className={styles.setupDockingLayout}><Layout model={assemblyDockModel} factory={node=>node.getComponent()==='scope-tree'?setupTreePanel:setupEditorPanel} supportsPopout={false}/></div>}
        </div>
        <div id="condition-issues" className={styles.diagnosticsPanel} hidden={!issuesOpen}>
          {creating?<p>Choose an assembly type, enter its name and code, then create the Condition.</p>:selectedIssues.length?selectedIssues.map(issue=><FluentButton key={issue.key} type="button" className={styles.diagnosticIssue} onClick={()=>openIssue(issue)}><ErrorCircleRegular/><strong>{issue.label}</strong><span>{issue.message}</span></FluentButton>):<p>No open issues for this Condition.</p>}
          {!creating&&liveCalculation.error?<p className={styles.diagnosticError}>{liveCalculation.error}</p>:null}
        </div>
        <footer className={styles.diagnosticsBar}>
          <FluentButton type="button" className={!creating&&(selectedIssueSummary.total||liveCalculation.error)?styles.diagnosticToggleError:styles.diagnosticToggle} aria-expanded={issuesOpen} aria-controls="condition-issues" onClick={()=>setIssuesOpen(open=>!open)}><ErrorCircleRegular/>Diagnostics <strong>{creating?0:selectedIssueSummary.total||(liveCalculation.error?1:0)}</strong><ChevronDownRegular className={issuesOpen?styles.diagnosticChevronOpen:styles.diagnosticChevron}/></FluentButton>
          <span className={styles.diagnosticMessage} role="status">{message||(creating?'New Condition draft':dirty?(liveCalculation.error||'Unsaved changes'):'Saved calculation')}</span>
          {!creating?<span className={styles.diagnosticQuantity}>{dirty?'Live concrete':'Installed concrete'} <output aria-live="polite">{dirty?(liveConcrete?.status==='ready'?quantity(liveConcrete.quantity,liveConcrete.unit):'—'):outputText('concrete.installed_cy')}</output></span>:null}
        </footer>
      </div>
    </section>

    <section className={styles.recapPanel} hidden={phase!=='recap'} aria-label="Commercial recap">
      <div className={styles.recapHeader}><div><span className={styles.eyebrow}>Saved calculation</span><h1>Commercial Recap</h1><p>Production quantities, direct cost, and pricing status remain separate. Resolve missing inputs and prices before issuing.</p></div><FluentButton appearance="outline" type="button" onClick={()=>setPhase('assembly')}>Edit assemblies</FluentButton></div>
      <div className={styles.recapMetrics}>
        <div><span>Conditions</span><strong>{conditions.length}</strong></div>
        <div><span>Measured takeoffs</span><strong>{measurements.length}</strong></div>
        <div><span>Active outputs</span><strong>{recapRows.length}</strong></div>
        <div><span>Priced direct cost</span><strong>{money(recapCost)}</strong><small>{recapRows.length===0?'No outputs':recapPartial?'Partial':'Complete pricing'}</small></div>
        <div><span>Open holds</span><strong>{recapHolds}</strong></div>
      </div>
      <div className={styles.recapTableScroll}><table className={styles.recapTable}><thead><tr><th>Condition</th><th>Resource / operation</th><th>Production quantity</th><th>Status</th><th>Direct cost</th><th>Labor assumption</th></tr></thead><tbody>
        {recapRows.map(row=>{const labor=row.laborOutput;const baseline=labor?.job_man_hours_per_unit??labor?.baseline_man_hours_per_unit;const currentRate=baseline===null||baseline===undefined?null:Number(baseline);const hourlyRate=labor&&['priced','manual_override'].includes(labor.pricing_status)&&Number(labor.unit_cost)>0?Number(labor.unit_cost):null;return <tr key={row.key}><td>{row.conditionVersionId?<FluentButton type="button" onClick={()=>requestConditionSelection(row.conditionVersionId!,false,undefined,'review')}>{row.conditionCode}</FluentButton>:<span>{row.conditionCode}</span>}</td><td><strong>{row.label}</strong><small>{row.outputKey}</small></td><td>{row.pending?'—':quantity(row.productionQuantity,row.productionUnit)}</td><td>{row.pending?'Pending recalculation':row.status}</td><td>{row.pending||row.status!=='Ready'?'—':money(row.directCost||0)}</td><td>{!row.pending&&labor?.generated_estimate_item_id&&estimateId&&Number(labor.production_quantity)>0?<SmartLaborCell estimateId={estimateId} outputId={labor.id} productionQuantity={Number(labor.production_quantity)} productionUnit={labor.production_unit} currentManHoursPerUnit={Number.isFinite(currentRate)?currentRate:null} laborHourlyRate={hourlyRate} disabled={editorLocked}/>:<span className={styles.recapDash}>—</span>}</td></tr>;})}
        {!recapRows.length?<tr><td colSpan={6} className={styles.recapEmpty}>No calculated outputs yet. Set up a condition, trace the plan, then save and recalculate.</td></tr>:null}
      </tbody></table></div>
      <div className={styles.recapFootnote}>Crew days require explicit crew size, hours per day, and positive production quantity. Labor direct $/SF also requires an SF output and a selected burdened labor rate. Both save as MH per unit.</div>
    </section>
    </div>

    {!mobileReview&&<Dialog open={Boolean(pendingSwitch)} onOpenChange={(_,data)=>{if(!data.open)setPendingSwitch(null);}}>
      <DialogSurface className="z-[120]">
        <DialogBody>
          <DialogTitle>Unsaved Condition changes</DialogTitle>
          <DialogContent>{pendingSwitch?.kind==='condition'?'Save this Condition before switching, or discard the current edits.':'Save this Condition before creating another, or discard the current edits.'}{message?<span role="status" className="mt-2 block">{message}</span>:null}</DialogContent>
          <DialogActions>
            <FluentButton appearance="subtle" onClick={()=>setPendingSwitch(null)} disabled={isPending}>Cancel</FluentButton>
            <FluentButton appearance="outline" onClick={()=>{const next=pendingSwitch;setPendingSwitch(null);if(next)completePendingSwitch(next);}} disabled={isPending}>Discard</FluentButton>
            <FluentButton appearance="primary" onClick={()=>{const next=pendingSwitch;if(next)saveCondition(()=>{setPendingSwitch(null);completePendingSwitch(next);});}} disabled={isPending}>{pendingSwitch?.kind==='condition'?'Save & switch':'Save & continue'}</FluentButton>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>}
    {!mobileReview&&<Dialog open={upgradeOpen} onOpenChange={(_,data)=>setUpgradeOpen(data.open)}>
      <DialogSurface className="z-[120]">
        <DialogBody>
          <DialogTitle>Upgrade to Contract v{latestContractVersion}?</DialogTitle>
          <DialogContent>Compatible plan facts, modules, productivity, commercial inputs, and drawing settings are carried forward where the target contract supports them. Superseded contract fields are converted or detached as required, and calculated outputs are cleared for review. Verified Condition history is never changed.</DialogContent>
          <DialogActions>
            <FluentButton appearance="subtle" onClick={()=>setUpgradeOpen(false)} disabled={isPending}>Cancel</FluentButton>
            <FluentButton appearance="primary" icon={isPending?<RefreshCw className={styles.spin}/>:undefined} onClick={upgradeCondition} disabled={locked||isPending||dirty||selectedVersion?.status!=='draft'}>Upgrade & review</FluentButton>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>}
  </div>;
}
