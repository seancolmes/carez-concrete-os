export const WORKSHEET_VIEWS=['quantities','resources','labor','pricing','holds','recap'] as const;
export type SpecialistWorksheetView=(typeof WORKSHEET_VIEWS)[number];

export type SpecialistWorksheetInput={
  measurements:Array<{
    id:string;sheet_id:string|null;estimate_section_id:string|null;
    name:string;location:string|null;raw_quantity:number;raw_unit:string;
  }>;
  conditions:Array<{
    condition_version_id:string;code:string;name:string;measurement_count:number;
  }>;
  roles:Array<{
    condition_version_id:string;measurement_id:string;role_key:string;role_instance_key:string;
  }>;
  modules:Array<{
    condition_version_id:string;module_key:string;instance_key:string;label:string;enabled:boolean;
  }>;
  outputs:Array<{
    id:string;condition_version_id:string;module_instance_id:string|null;
    driver_measurement_role_id:string|null;output_key:string;output_instance_key:string;
    label:string;resource_class:string;production_quantity:number|null;production_unit:string;
    status:string;estimated_man_hours:number;unit_cost:number;direct_cost:number;
    pricing_status:string;provenance:Record<string,unknown>;
    legacy_takeoff_output_id:string|null;generated_estimate_item_id:string|null;
  }>;
  holds:Array<{
    id:string;condition_version_id:string;output_id:string|null;
    hold_code:string;status:string;message:string;
  }>;
  sections:Array<{id:string;name:string}>;
  sheets:Array<{id:string;sheet_number:string|null;page_number:number}>;
  legacyOutputs:Array<{
    id:string;measurement_id:string;catalog_item_id:string|null;
    cost_source:string|null;resource_behavior:string|null;
  }>;
  pendingConditionVersionIds:Set<string>;
};

export type WorksheetState='ready'|'pending'|'held'|'not_included'|'unknown';
export type WorksheetPricingState='priced'|'price_required'|'manual_override'|'pending'|'not_included'|'unknown';

export type SpecialistQuantityRow={
  id:string;
  measurementId:string;
  conditionVersionId:string|null;
  conditionCode:string|null;
  conditionName:string|null;
  roleKey:string|null;
  roleInstanceKey:string|null;
  name:string;
  location:string|null;
  sheetId:string|null;
  sheet:string;
  sectionId:string|null;
  section:string;
  quantity:number;
  unit:string;
  state:WorksheetState;
};

export type SpecialistResourceRow={
  id:string;
  outputId:string;
  conditionVersionId:string;
  conditionCode:string|null;
  conditionName:string|null;
  label:string;
  outputKey:string;
  outputInstanceKey:string;
  resourceClass:string;
  quantity:number|null;
  unit:string;
  state:WorksheetState;
  costSource:string|null;
  catalogReference:string|null;
  resourceBehavior:string|null;
  provenance:Record<string,unknown>;
  generatedEstimateItemId:string|null;
};

export type SpecialistLaborRow={
  id:string;
  outputId:string;
  conditionVersionId:string;
  conditionCode:string|null;
  conditionName:string|null;
  label:string;
  outputKey:string;
  productionQuantity:number|null;
  productionUnit:string;
  estimatedManHours:number|null;
  state:WorksheetState;
  pricingState:WorksheetPricingState;
};

export type SpecialistPricingRow={
  id:string;
  outputId:string;
  conditionVersionId:string;
  conditionCode:string|null;
  conditionName:string|null;
  label:string;
  outputKey:string;
  productionQuantity:number|null;
  productionUnit:string;
  unitCost:number|null;
  directCost:number|null;
  pricingState:WorksheetPricingState;
  costSource:string|null;
  catalogReference:string|null;
  provenance:Record<string,unknown>;
  legacyTakeoffOutputId:string|null;
  generatedEstimateItemId:string|null;
};

export type SpecialistHoldRow={
  id:string;
  conditionVersionId:string;
  conditionCode:string|null;
  conditionName:string|null;
  outputId:string|null;
  code:string;
  message:string;
  source:'condition'|'pricing';
  destination:{
    view:'labor'|'pricing'|'recap';
    conditionVersionId:string;
    outputId:string|null;
  };
};

export type SpecialistWorksheetModel={
  quantities:SpecialistQuantityRow[];
  resources:SpecialistResourceRow[];
  labor:SpecialistLaborRow[];
  pricing:SpecialistPricingRow[];
  holds:SpecialistHoldRow[];
  recap:{
    measurementCount:number;
    conditionCount:number;
    pendingConditions:number;
    openHolds:number;
    quantitiesByUnit:Array<{unit:string;quantity:number}>;
    estimatedManHours:number;
    directCost:number;
    directCostComplete:boolean;
  };
};

const str=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
const num=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
const upper=(value:unknown)=>String(value||'').trim().toUpperCase();

const inactive=(status:string)=>['inactive','not_included','excluded'].includes(String(status||'').toLowerCase());
const held=(status:string)=>String(status||'').toLowerCase()==='held';

function pricingState(output:SpecialistWorksheetInput['outputs'][number],pending:boolean):WorksheetPricingState{
  if(pending)return'pending';
  if(inactive(output.status))return'not_included';
  const status=String(output.pricing_status||'').toLowerCase();
  if(status==='manual_override')return'manual_override';
  if(['missing_price','missing_labor_rate','missing_input','price_required'].includes(status))return'price_required';
  if(['catalog','priced','ready'].includes(status))return'priced';
  if(held(output.status))return'pending';
  return status?'unknown':'unknown';
}

function outputState(
  output:SpecialistWorksheetInput['outputs'][number],
  pending:boolean,
  openHold:boolean,
):WorksheetState{
  if(pending)return'pending';
  if(inactive(output.status))return'not_included';
  if(openHold||held(output.status))return'held';
  if(output.production_quantity===null||output.production_quantity===undefined)return'unknown';
  return String(output.status||'').toLowerCase()==='ready'?'ready':'unknown';
}

function evidence(provenance:Record<string,unknown>,legacy:SpecialistWorksheetInput['legacyOutputs'][number]|undefined){
  const candidates=[
    provenance?.cost_source,
    provenance?.source_label,
    provenance?.source,
    provenance?.vendor_name,
    provenance?.supplier,
    provenance?.catalog_source,
    legacy?.cost_source,
  ];
  return candidates.map(str).find(Boolean)||null;
}

function sheetLabel(sheet:SpecialistWorksheetInput['sheets'][number]|undefined){
  return sheet?.sheet_number||`Page ${sheet?.page_number||'—'}`;
}

function conditionMaps(input:SpecialistWorksheetInput){
  const conditions=new Map(input.conditions.map(condition=>[condition.condition_version_id,condition]));
  const outputsByCondition=new Map<string,SpecialistWorksheetInput['outputs']>();
  const holdsByCondition=new Map<string,SpecialistWorksheetInput['holds']>();
  for(const output of input.outputs){
    const rows=outputsByCondition.get(output.condition_version_id)||[];
    rows.push(output);
    outputsByCondition.set(output.condition_version_id,rows);
  }
  for(const hold of input.holds){
    if(hold.status!=='open')continue;
    const rows=holdsByCondition.get(hold.condition_version_id)||[];
    rows.push(hold);
    holdsByCondition.set(hold.condition_version_id,rows);
  }
  return{conditions,outputsByCondition,holdsByCondition};
}

function quantityState(
  conditionVersionId:string|null,
  outputRows:SpecialistWorksheetInput['outputs'],
  holdRows:SpecialistWorksheetInput['holds'],
  pending:Set<string>,
):WorksheetState{
  if(!conditionVersionId)return'ready';
  if(pending.has(conditionVersionId))return'pending';
  if(holdRows.some(hold=>hold.status==='open')||outputRows.some(output=>held(output.status)))return'held';
  if(outputRows.length&&outputRows.every(output=>inactive(output.status)))return'not_included';
  if(outputRows.some(output=>String(output.status||'').toLowerCase()==='ready'))return'ready';
  return'unknown';
}

export function buildSpecialistWorksheetModel(input:SpecialistWorksheetInput):SpecialistWorksheetModel{
  const sectionMap=new Map(input.sections.map(section=>[section.id,section]));
  const sheetMap=new Map(input.sheets.map(sheet=>[sheet.id,sheet]));
  const legacyMap=new Map(input.legacyOutputs.map(output=>[output.id,output]));
  const rolesByMeasurement=new Map<string,SpecialistWorksheetInput['roles']>();
  for(const role of input.roles){
    const rows=rolesByMeasurement.get(role.measurement_id)||[];
    rows.push(role);
    rolesByMeasurement.set(role.measurement_id,rows);
  }
  const {conditions,outputsByCondition,holdsByCondition}=conditionMaps(input);

  const quantities:SpecialistQuantityRow[]=[];
  for(const measurement of input.measurements){
    const roles=rolesByMeasurement.get(measurement.id)||[];
    if(!roles.length){
      quantities.push({
        id:`measurement:${measurement.id}`,
        measurementId:measurement.id,
        conditionVersionId:null,
        conditionCode:null,
        conditionName:null,
        roleKey:null,
        roleInstanceKey:null,
        name:measurement.name,
        location:measurement.location,
        sheetId:measurement.sheet_id,
        sheet:sheetLabel(measurement.sheet_id?sheetMap.get(measurement.sheet_id):undefined),
        sectionId:measurement.estimate_section_id,
        section:measurement.estimate_section_id?sectionMap.get(measurement.estimate_section_id)?.name||'Unassigned':'Unassigned',
        quantity:Number(measurement.raw_quantity||0),
        unit:upper(measurement.raw_unit),
        state:'ready',
      });
      continue;
    }
    for(const role of roles){
      const condition=conditions.get(role.condition_version_id);
      quantities.push({
        id:`role:${role.condition_version_id}:${role.role_key}:${role.role_instance_key}:${measurement.id}`,
        measurementId:measurement.id,
        conditionVersionId:role.condition_version_id,
        conditionCode:condition?.code||null,
        conditionName:condition?.name||null,
        roleKey:role.role_key,
        roleInstanceKey:role.role_instance_key,
        name:measurement.name,
        location:measurement.location,
        sheetId:measurement.sheet_id,
        sheet:sheetLabel(measurement.sheet_id?sheetMap.get(measurement.sheet_id):undefined),
        sectionId:measurement.estimate_section_id,
        section:measurement.estimate_section_id?sectionMap.get(measurement.estimate_section_id)?.name||'Unassigned':'Unassigned',
        quantity:Number(measurement.raw_quantity||0),
        unit:upper(measurement.raw_unit),
        state:quantityState(
          role.condition_version_id,
          outputsByCondition.get(role.condition_version_id)||[],
          holdsByCondition.get(role.condition_version_id)||[],
          input.pendingConditionVersionIds,
        ),
      });
    }
  }

  const resources:SpecialistResourceRow[]=[];
  const labor:SpecialistLaborRow[]=[];
  const pricing:SpecialistPricingRow[]=[];
  for(const output of input.outputs){
    const pending=input.pendingConditionVersionIds.has(output.condition_version_id);
    const explicitHold=(holdsByCondition.get(output.condition_version_id)||[]).some(
      hold=>hold.output_id===output.id&&hold.status==='open',
    );
    const state=outputState(output,pending,explicitHold);
    const pState=pricingState(output,pending);
    const condition=conditions.get(output.condition_version_id);
    const legacy=output.legacy_takeoff_output_id?legacyMap.get(output.legacy_takeoff_output_id):undefined;
    const costSource=evidence(output.provenance||{},legacy);
    const catalogReference=legacy?.catalog_item_id||str(output.provenance?.catalog_item_id)||str(output.provenance?.catalog_reference);
    const isLabor=String(output.resource_class||'').toLowerCase()==='labor'||String(output.output_key||'').startsWith('labor.');

    if(!isLabor&&!inactive(output.status)){
      resources.push({
        id:`resource:${output.id}`,
        outputId:output.id,
        conditionVersionId:output.condition_version_id,
        conditionCode:condition?.code||null,
        conditionName:condition?.name||null,
        label:output.label,
        outputKey:output.output_key,
        outputInstanceKey:output.output_instance_key,
        resourceClass:output.resource_class,
        quantity:num(output.production_quantity),
        unit:upper(output.production_unit),
        state,
        costSource,
        catalogReference,
        resourceBehavior:legacy?.resource_behavior||str(output.provenance?.resource_behavior),
        provenance:output.provenance||{},
        generatedEstimateItemId:output.generated_estimate_item_id,
      });
    }

    if(isLabor&&!inactive(output.status)){
      labor.push({
        id:`labor:${output.id}`,
        outputId:output.id,
        conditionVersionId:output.condition_version_id,
        conditionCode:condition?.code||null,
        conditionName:condition?.name||null,
        label:output.label,
        outputKey:output.output_key,
        productionQuantity:num(output.production_quantity),
        productionUnit:upper(output.production_unit),
        estimatedManHours:num(output.estimated_man_hours),
        state,
        pricingState:pState,
      });
    }

    if(!inactive(output.status)){
      const unresolved=pState==='price_required'||pState==='pending'||pState==='unknown'||state==='held';
      pricing.push({
        id:`pricing:${output.id}`,
        outputId:output.id,
        conditionVersionId:output.condition_version_id,
        conditionCode:condition?.code||null,
        conditionName:condition?.name||null,
        label:output.label,
        outputKey:output.output_key,
        productionQuantity:num(output.production_quantity),
        productionUnit:upper(output.production_unit),
        unitCost:unresolved?null:num(output.unit_cost),
        directCost:unresolved?null:num(output.direct_cost),
        pricingState:pState,
        costSource,
        catalogReference,
        provenance:output.provenance||{},
        legacyTakeoffOutputId:output.legacy_takeoff_output_id,
        generatedEstimateItemId:output.generated_estimate_item_id,
      });
    }
  }

  const holds:SpecialistHoldRow[]=[];
  for(const hold of input.holds){
    if(hold.status!=='open')continue;
    const condition=conditions.get(hold.condition_version_id);
    const text=`${hold.hold_code} ${hold.message}`.toLowerCase();
    const destination:textDestination=/labor|production|crew|hour/.test(text)
      ?'labor'
      :/price|cost|catalog|vendor|procure/.test(text)
        ?'pricing'
        :'recap';
    holds.push({
      id:`hold:${hold.id}`,
      conditionVersionId:hold.condition_version_id,
      conditionCode:condition?.code||null,
      conditionName:condition?.name||null,
      outputId:hold.output_id,
      code:hold.hold_code,
      message:hold.message,
      source:'condition',
      destination:{view:destination,conditionVersionId:hold.condition_version_id,outputId:hold.output_id},
    });
  }

  const explicitOutputHolds=new Set(holds.map(hold=>hold.outputId).filter(Boolean));
  for(const row of pricing){
    if(row.pricingState!=='price_required'||explicitOutputHolds.has(row.outputId))continue;
    const output=input.outputs.find(entry=>entry.id===row.outputId);
    const laborOutput=String(output?.resource_class||'').toLowerCase()==='labor'||String(output?.output_key||'').startsWith('labor.');
    holds.push({
      id:`pricing:${row.outputId}`,
      conditionVersionId:row.conditionVersionId,
      conditionCode:row.conditionCode,
      conditionName:row.conditionName,
      outputId:row.outputId,
      code:laborOutput&&output?.pricing_status==='missing_labor_rate'?'LABOR_RATE_REQUIRED':'PRICE_REQUIRED',
      message:laborOutput&&output?.pricing_status==='missing_labor_rate'
        ?`${row.label} requires a persisted labor rate.`
        :`${row.label} requires a persisted direct-cost price.`,
      source:'pricing',
      destination:{view:laborOutput?'labor':'pricing',conditionVersionId:row.conditionVersionId,outputId:row.outputId},
    });
  }

  const quantityTotals=new Map<string,number>();
  for(const row of quantities){
    if(row.state==='not_included')continue;
    const unit=upper(row.unit);
    if(!unit)continue;
    quantityTotals.set(unit,(quantityTotals.get(unit)||0)+Number(row.quantity||0));
  }
  const pendingConditions=[...new Set([...input.pendingConditionVersionIds])].length;
  const directCostComplete=
    pendingConditions===0
    &&holds.length===0
    &&pricing.every(row=>['priced','manual_override','not_included'].includes(row.pricingState)&&row.directCost!==null);

  return{
    quantities,
    resources,
    labor,
    pricing,
    holds,
    recap:{
      measurementCount:input.measurements.length,
      conditionCount:input.conditions.length,
      pendingConditions,
      openHolds:holds.length,
      quantitiesByUnit:[...quantityTotals].map(([unit,quantity])=>({unit,quantity})),
      estimatedManHours:labor.reduce((sum,row)=>sum+Number(row.estimatedManHours||0),0),
      directCost:pricing.reduce((sum,row)=>sum+Number(row.directCost||0),0),
      directCostComplete,
    },
  };
}

type textDestination='labor'|'pricing'|'recap';
