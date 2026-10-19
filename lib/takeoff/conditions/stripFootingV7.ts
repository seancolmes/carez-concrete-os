import {calculateStripFootingV6,STRIP_FOOTING_V6_DEFINITION} from './stripFootingV6.ts';
import type {ConditionArchetypeDefinition,ConditionCalculationRequest} from './types.ts';

export const STRIP_FOOTING_V7_CONTRACT_VERSION=7;
export const STRIP_FOOTING_V7_DEFINITION:ConditionArchetypeDefinition={...STRIP_FOOTING_V6_DEFINITION,contractVersion:7};
export const isInstalledConcreteReference=(contract:number,key:string)=>contract===7&&key==='concrete.installed_cy';
export function stripConcreteEstimateVisible(contract:number,key:string,recorded:boolean|undefined){
 return isInstalledConcreteReference(contract,key)?false:recorded;
}
/** Quantity algorithms are unchanged. Pricing uses a distinct, versioned basis. */
export function calculateStripFootingV7(request:ConditionCalculationRequest){
 const result=calculateStripFootingV6(request);
 return{...result,outputs:result.outputs.map(output=>({...output,trace:{...output.trace,values:[
  ...output.trace.values.filter(value=>value.key!=='calculation.contract_version'),
  {key:'calculation.contract_version',value:7},
  ...(output.outputKey==='concrete.installed_cy'?[{key:'pricing.quantity_basis',value:'installed_reference'}]:
   output.outputKey==='concrete.procurement_cy'?[{key:'pricing.quantity_basis',value:'ordered_supply'}]:[]),
 ]}}))};
}
