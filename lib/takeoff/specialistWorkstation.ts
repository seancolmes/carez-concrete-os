export type TakeoffNavigatorTab='plans'|'conditions'|'zones';

export type TakeoffViewMode='2d'|'3d';

export type TakeoffWorksheetView=
  |'quantities'
  |'resources'
  |'labor'
  |'pricing'
  |'holds'
  |'recap';

export type TakeoffSelection={
  sheetId:string|null;
  conditionVersionId:string|null;
  roleKey:string|null;
  measurementId:string|null;
};

export type ConditionRoleMeasurementRequest={
  requestId:string;
  conditionVersionId:string;
  roleKey:string;
  roleLabel:string;
  assemblyVersionId:string;
  objectName:string;
};

export type ConditionPresentationInput={
  locked:boolean;
  dirty:boolean;
  pending:boolean;
  calculated:boolean;
  openHolds:number;
  pricingMissing:number;
};

export type ConditionPresentationState={
  label:string;
};

export function resolveTakeoffViewMode(value:unknown):TakeoffViewMode|null{
  return value==='2d'||value==='3d'?value:null;
}

export function resolveTakeoffWorksheetView(value:unknown):TakeoffWorksheetView|null{
  const allowed=[
    'quantities',
    'resources',
    'labor',
    'pricing',
    'holds',
    'recap',
  ] as const;

  return allowed.includes(value as TakeoffWorksheetView)
    ? value as TakeoffWorksheetView
    : null;
}

export function resolveConditionPresentationState(
  input:ConditionPresentationInput,
):ConditionPresentationState{
  if(input.locked)return {label:'Locked'};
  if(input.dirty)return {label:'Unsaved changes'};
  if(input.pending)return {label:'Pending recalculation'};
  if(!input.calculated)return {label:'Not calculated'};
  if(input.openHolds>0)return {label:'Calculation hold'};
  if(input.pricingMissing>0)return {label:'Qty ready · Price missing'};
  return {label:'Ready'};
}

export type DirtySwitchAction='cancel'|'discard'|'save-and-switch';

export type DirtySwitchHandlers={
  restorePersisted:()=>void;
  save:()=>Promise<boolean>;
  clearPending:()=>void;
  applyPending:()=>void;
};

export async function executeDirtySwitchAction(
  action:DirtySwitchAction,
  handlers:DirtySwitchHandlers,
){
  if(action==='cancel'){
    handlers.clearPending();
    return false;
  }
  if(action==='discard'){
    handlers.restorePersisted();
    handlers.clearPending();
    handlers.applyPending();
    return true;
  }
  const saved=await handlers.save();
  if(saved){
    handlers.clearPending();
    handlers.applyPending();
  }
  return saved;
}
