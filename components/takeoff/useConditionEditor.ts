'use client';

import {useCallback,useEffect,useMemo,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {
  assignConditionPrimaryTakeoffSection,
  saveAndRecalculateConcreteConditionPilot,
  upgradeProjectConcreteConditionDraftToLatest,
} from '@/app/takeoff/[setId]/conditionActions';
import {
  conditionMeasurementMatchesRole,
  prepareConditionAuthoringInputs,
  prepareConditionRoleAssignments,
  type ConditionInputDraft,
} from '@/lib/takeoff/conditions/authoring';
import {conditionArchetype} from '@/lib/takeoff/conditions/catalog';
import {STRIP_FOOTING_V2_DEFINITION} from '@/lib/takeoff/conditions/stripFootingV2';
import {STRIP_FOOTING_V3_DEFINITION} from '@/lib/takeoff/conditions/stripFootingV3';
import {STRIP_FOOTING_V4_DEFINITION} from '@/lib/takeoff/conditions/stripFootingV4';
import {
  executeDirtySwitchAction,
  type ConditionRoleMeasurementRequest as SpecialistRoleMeasurementRequest,
  type DirtySwitchAction,
} from '@/lib/takeoff/specialistWorkstation';
import type {
  ConditionInputDefinition,
  ConditionModuleConfiguration,
} from '@/lib/takeoff/conditions/types';

export type {DirtySwitchAction};

export type ConditionPropertyTab='general'|'concrete'|'rebar'|'forms'|'embeds'|'excavation'|'placement'|'finish'|'labor'|'review'|'drawing'|'more';

export type ConditionSelectionRequest={
  versionId:string;
  focusPlan?:boolean;
  measurementId?:string|null;
  propertyTab?:ConditionPropertyTab;
  viewMode?:'2d'|'3d';
};

export type ConditionRoleMeasurementRequest=SpecialistRoleMeasurementRequest&{
  unit:string;
  existingMeasurementIds:string[];
};

type EditorArgs={
  setId:string;
  conditionData:any;
  measurements:any[];
  sections:any[];
  assemblies:any[];
  assemblyVersions:any[];
  locked:boolean;
  initialVersionId?:string|null;
  onSelectionApplied?:(request:ConditionSelectionRequest)=>void;
};

export function draftFromVersion(version:any|null):ConditionInputDraft{
  if(!version)return{};
  return{
    planFacts:{...(version.plan_facts||{})},
    methods:{...(version.method_inputs||{})},
    production:{...(version.production_inputs||{})},
    commercial:{...(version.commercial_inputs||{})},
    drawing:{...(version.drawing_inputs||{})},
  };
}

const toModule=(module:any):ConditionModuleConfiguration=>({
  moduleKey:module.module_key,
  instanceKey:module.instance_key,
  label:module.label,
  enabled:Boolean(module.enabled),
  inputValues:{...(module.input_values||{})},
  inputProvenance:{...(module.input_provenance||{})},
  legacyChildKey:module.legacy_child_key,
  sortOrder:module.sort_order,
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
  .sort((a,b)=>(a.moduleKey+':'+a.instanceKey).localeCompare(b.moduleKey+':'+b.instanceKey));

const roleSignature=(roles:Record<string,string>)=>Object.entries(roles).sort(([a],[b])=>a.localeCompare(b));

export function conditionIssueTab(issue:{category?:string;hold_code?:string;message?:string}):ConditionPropertyTab{
  const category=String(issue.category||'').toLowerCase();
  if(category==='production')return'labor';
  if(category==='pricing'||category==='commercial')return'review';
  if(category==='scope')return'general';
  const text=(String(issue.hold_code||'')+' '+String(issue.message||'')).toLowerCase();
  if(/rebar|reinforc/.test(text))return'rebar';
  if(/form/.test(text))return'forms';
  if(/labor|production|hour|crew/.test(text))return'labor';
  if(/price|procure|commercial/.test(text))return'review';
  return'general';
}

export function useConditionEditor({
  setId,
  conditionData,
  measurements,
  sections,
  assemblies,
  assemblyVersions,
  locked,
  initialVersionId=null,
  onSelectionApplied,
}:EditorArgs){
  const router=useRouter();
  const conditions=conditionData.conditions||[];
  const [selectedVersionId,setSelectedVersionId]=useState<string|null>(
    initialVersionId||conditions[0]?.condition_version_id||null,
  );
  const [loadedVersionId,setLoadedVersionId]=useState<string|null>(null);
  const [draft,setDraft]=useState<ConditionInputDraft>({});
  const [moduleConfigurations,setModuleConfigurations]=useState<ConditionModuleConfiguration[]>([]);
  const [roleSelections,setRoleSelections]=useState<Record<string,string>>({});
  const [propertyTab,setPropertyTab]=useState<ConditionPropertyTab>('general');
  const [pendingSwitch,setPendingSwitch]=useState<ConditionSelectionRequest|null>(null);
  const [message,setMessage]=useState('');
  const [isPending,startTransition]=useTransition();

  const selectedSummary=conditions.find((row:any)=>row.condition_version_id===selectedVersionId)||null;
  const selectedVersion=(conditionData.versions||[]).find((row:any)=>row.id===selectedVersionId)||null;
  const contractVersion=Number(
    (conditionData.archetypeVersions||[]).find((row:any)=>row.id===selectedVersion?.archetype_version_id)?.version_no||1,
  );
  const definition=selectedSummary
    ?selectedSummary.archetype_code==='strip_wall_footing'
      ?contractVersion>=4
        ?STRIP_FOOTING_V4_DEFINITION
        :contractVersion>=3
          ?STRIP_FOOTING_V3_DEFINITION
          :contractVersion>=2
            ?STRIP_FOOTING_V2_DEFINITION
            :conditionArchetype(selectedSummary.archetype_code)
      :conditionArchetype(selectedSummary.archetype_code)
    :null;

  const selectedPersistedModules=useMemo(
    ()=>(conditionData.modules||[])
      .filter((row:any)=>row.condition_version_id===selectedVersionId)
      .sort((a:any,b:any)=>Number(a.sort_order||0)-Number(b.sort_order||0)),
    [conditionData.modules,selectedVersionId],
  );
  const persistedRoles=useMemo(
    ()=>Object.fromEntries(
      (conditionData.roles||[])
        .filter((row:any)=>row.condition_version_id===selectedVersionId)
        .map((role:any)=>[role.role_key,role.measurement_id]),
    ),
    [conditionData.roles,selectedVersionId],
  );
  const selectedOutputs=useMemo(
    ()=>(conditionData.outputs||[]).filter((row:any)=>row.condition_version_id===selectedVersionId),
    [conditionData.outputs,selectedVersionId],
  );
  const selectedHolds=useMemo(
    ()=>(conditionData.holds||[]).filter((row:any)=>row.condition_version_id===selectedVersionId&&row.status==='open'),
    [conditionData.holds,selectedVersionId],
  );

  const persistedSignature=useMemo(
    ()=>selectedVersion?JSON.stringify({
      draft:draftFromVersion(selectedVersion),
      modules:moduleSignature(selectedPersistedModules.map(toModule)),
      roles:roleSignature(persistedRoles),
    }):'',
    [selectedVersion,selectedPersistedModules,persistedRoles],
  );
  const currentSignature=useMemo(
    ()=>selectedVersion?JSON.stringify({
      draft,
      modules:moduleSignature(moduleConfigurations),
      roles:roleSignature(roleSelections),
    }):'',
    [selectedVersion,draft,moduleConfigurations,roleSelections],
  );
  const dirty=Boolean(
    selectedVersion&&loadedVersionId===selectedVersion.id&&currentSignature!==persistedSignature,
  );

  useEffect(()=>{
    if(!selectedVersion)return;
    setDraft(draftFromVersion(selectedVersion));
    setModuleConfigurations(selectedPersistedModules.map(toModule));
    setRoleSelections(persistedRoles);
    setLoadedVersionId(selectedVersion.id);
    setMessage('');
  },[selectedVersion?.id,selectedVersion?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const applySelection=useCallback((request:ConditionSelectionRequest)=>{
    setSelectedVersionId(request.versionId);
    if(request.propertyTab)setPropertyTab(request.propertyTab);
    onSelectionApplied?.(request);
  },[onSelectionApplied]);

  const requestConditionSelection=useCallback((request:ConditionSelectionRequest|string)=>{
    const normalized=typeof request==='string'?{versionId:request}:request;
    if(normalized.versionId!==selectedVersionId&&dirty){
      setPendingSwitch(normalized);
      return false;
    }
    applySelection(normalized);
    return true;
  },[applySelection,dirty,selectedVersionId]);

  const updateInput=(input:ConditionInputDefinition,value:string)=>{
    const parsed=input.valueType==='number'||input.valueType==='integer'
      ?value===''?'':Number(value)
      :input.valueType==='boolean'
        ?value==='true'
        :value;
    setDraft(current=>({
      ...current,
      [input.group]:{...(current[input.group]||{}),[input.key]:parsed},
    }));
    setMessage('');
  };

  const updateModule=(
    next:ConditionModuleConfiguration[]|((current:ConditionModuleConfiguration[])=>ConditionModuleConfiguration[]),
  )=>{
    setModuleConfigurations(current=>typeof next==='function'?next(current):next);
    setMessage('');
  };

  const setRole=(roleKey:string,measurementId:string)=>{
    setRoleSelections(current=>{
      const next={...current};
      if(measurementId){
        for(const key of Object.keys(next)){
          if(key!==roleKey&&next[key]===measurementId)next[key]='';
        }
      }
      next[roleKey]=measurementId;
      return next;
    });
    setMessage('');
  };

  const templateVersion=(conditionData.templateVersions||[])
    .find((row:any)=>row.id===selectedVersion?.template_version_id)||null;
  const compatibilityAssemblyVersionId=templateVersion?.legacy_assembly_version_id||null;

  const roleChoices=(role:any)=>(measurements||[])
    .filter((measurement:any)=>conditionMeasurementMatchesRole(
      measurement,
      role,
      role.primary?compatibilityAssemblyVersionId:null,
    ))
    .map((measurement:any)=>({
      id:String(measurement.id),
      label:String(measurement.name||'Takeoff'),
      meta:[measurement.raw_quantity,measurement.raw_unit,measurement.drawing_reference].filter(value=>value!==null&&value!==undefined&&value!=='').join(' · '),
    }));

  const startRoleMeasurement=(role:any):ConditionRoleMeasurementRequest|null=>{
    if(!selectedVersion||!definition)return null;
    let assemblyVersionId=role.primary?compatibilityAssemblyVersionId:null;
    if(!assemblyVersionId){
      const assemblyIds=new Set(
        assemblies
          .filter((row:any)=>row.primary_measurement===role.unit)
          .map((row:any)=>row.id),
      );
      assemblyVersionId=assemblyVersions.find((row:any)=>assemblyIds.has(row.assembly_id))?.id||null;
    }
    if(!assemblyVersionId){
      setMessage('No '+role.unit+' takeoff is available for this role.');
      return null;
    }
    return{
      requestId:selectedVersion.id+':'+role.key,
      conditionVersionId:selectedVersion.id,
      roleKey:role.key,
      roleLabel:role.label,
      assemblyVersionId,
      objectName:selectedSummary?.name||definition.name,
      unit:role.unit,
      existingMeasurementIds:measurements.map((row:any)=>String(row.id)),
    };
  };

  const saveAndRecalculate=useCallback(()=>new Promise<boolean>(resolve=>{
    if(!selectedVersion||!definition||locked||selectedVersion.status!=='draft'){
      resolve(false);
      return;
    }
    const primary=definition.roles.find(role=>role.primary);
    const anchorId=primary?roleSelections[primary.key]:'';
    if(!anchorId){
      setMessage('Assign '+(primary?.label||'the primary takeoff')+' before calculating.');
      resolve(false);
      return;
    }
    const {inputs,provenance}=prepareConditionAuthoringInputs(draft);
    const roles=prepareConditionRoleAssignments(definition.roles,roleSelections);
    setMessage('Saving…');
    startTransition(async()=>{
      try{
        await saveAndRecalculateConcreteConditionPilot({
          conditionVersionId:selectedVersion.id,
          inputs,
          inputProvenance:provenance,
          modules:moduleConfigurations,
          measurementRoles:roles,
          compatibilityAnchorMeasurementId:anchorId,
        });
        setMessage('');
        router.refresh();
        resolve(true);
      }catch(error:any){
        setMessage(error?.message||'Could not save condition.');
        resolve(false);
      }
    });
  }),[
    selectedVersion,
    definition,
    locked,
    roleSelections,
    draft,
    moduleConfigurations,
    router,
  ]);

  const choosePendingSwitchAction=async(action:DirtySwitchAction)=>{
    const pending=pendingSwitch;
    if(!pending)return false;
    return executeDirtySwitchAction(action,{
      restorePersisted:()=>{
        setDraft(draftFromVersion(selectedVersion));
        setModuleConfigurations(selectedPersistedModules.map(toModule));
        setRoleSelections(persistedRoles);
      },
      save:saveAndRecalculate,
      clearPending:()=>setPendingSwitch(null),
      applyPending:()=>applySelection(pending),
    });
  };

  const latestContractVersion=selectedSummary
    ?(conditionData.archetypeVersions||[])
      .filter((row:any)=>
        row.archetype_code_snapshot===selectedSummary.archetype_code
        &&row.status==='published'
        &&row.engine_key==='concrete_condition_v1'
      )
      .reduce((max:number,row:any)=>Math.max(max,Number(row.version_no||0)),contractVersion)
    :contractVersion;
  const canUpgrade=Boolean(
    selectedVersion
    &&selectedVersion.status==='draft'
    &&latestContractVersion>contractVersion
    &&!locked
    &&!dirty,
  );

  const upgradeContract=async()=>{
    if(!selectedVersion||!canUpgrade)return false;
    setMessage('Upgrading to Contract v'+latestContractVersion+'…');
    try{
      await upgradeProjectConcreteConditionDraftToLatest({
        takeoffSetId:setId,
        conditionVersionId:selectedVersion.id,
      });
      setPropertyTab('general');
      setMessage('Contract upgraded. Review and recalculate.');
      router.refresh();
      return true;
    }catch(error:any){
      setMessage(error?.message||'Could not upgrade Condition contract.');
      return false;
    }
  };

  const primaryRole=definition?.roles.find(role=>role.primary)||null;
  const primaryMeasurementId=primaryRole?roleSelections[primaryRole.key]||'':'';
  const primaryMeasurement=measurements.find((row:any)=>String(row.id)===String(primaryMeasurementId))||null;

  const assignSection=async(sectionId:string|null)=>{
    if(!primaryMeasurementId||locked||selectedVersion?.status!=='draft')return false;
    setMessage('Saving estimate section…');
    try{
      await assignConditionPrimaryTakeoffSection({
        takeoffSetId:setId,
        measurementId:primaryMeasurementId,
        sectionId,
      });
      setMessage('');
      router.refresh();
      return true;
    }catch(error:any){
      setMessage(error?.message||'Could not assign estimate section.');
      return false;
    }
  };

  const availableTabs:ConditionPropertyTab[]=['general','concrete','forms','rebar','labor','review'];
  const routeIssue=(issue:{category?:string;hold_code?:string;message?:string})=>{
    const tab=conditionIssueTab(issue);
    setPropertyTab(availableTabs.includes(tab)?tab:'general');
  };

  return{
    selectedVersionId,
    selectedSummary,
    selectedVersion,
    definition,
    draft,
    moduleConfigurations,
    selectedPersistedModules,
    roleSelections,
    dirty,
    saveState:{pending:isPending,message},
    availableTabs,
    propertyTab,
    setPropertyTab,
    pendingSwitch,
    requestConditionSelection,
    choosePendingSwitchAction,
    updateInput,
    updateModule,
    setRole,
    roleChoices,
    startRoleMeasurement,
    saveAndRecalculate,
    upgradeContract,
    canUpgrade,
    contractVersion,
    latestContractVersion,
    persistedInputProvenance:selectedVersion?.input_provenance||{},
    templateInputProvenance:templateVersion?.input_provenance||{},
    selectedOutputs,
    selectedHolds,
    sections,
    primaryMeasurement,
    assignSection,
    routeIssue,
    measurements,
    conditionMeasurementMatchesRole,
  };
}
