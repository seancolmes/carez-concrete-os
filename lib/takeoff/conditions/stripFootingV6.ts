import {calculateStripFootingV5,STRIP_FOOTING_V5_DEFINITION} from './stripFootingV5.ts';
import {geometryRunBasis} from './discreteRuns.ts';
import type {ConditionArchetypeDefinition,ConditionCalculationRequest} from './types.ts';
export const STRIP_FOOTING_V6_CONTRACT_VERSION=6;
const changed=new Set(['forms.stakes_ea','anchors_embeds.anchor_ea','reinforcing.installed_lb','reinforcing.procurement_lb','reinforcing.stock_bars_ea','labor.reinforcing_mh']);
export const STRIP_FOOTING_V6_DEFINITION:ConditionArchetypeDefinition={...STRIP_FOOTING_V5_DEFINITION,contractVersion:6,outputs:STRIP_FOOTING_V5_DEFINITION.outputs.map(o=>changed.has(o.outputKey)?{...o,algorithm:o.algorithm+'-per-run-v6'}:o)};
/** Opt-in only. Legacy calculators retain their aggregate semantics by default. */
export function calculateStripFootingV6(request:ConditionCalculationRequest){
 const basis=geometryRunBasis(request);
 // A partial endpoint set must not become a confirmed bulkhead count either.
 const measurementRoles=basis?request.measurementRoles:request.measurementRoles.filter(r=>r.roleKey!=='__run_endpoints');
 const result=calculateStripFootingV5({...request,measurementRoles,discreteRunBasis:basis});
 return{...result,outputs:result.outputs.map(output=>({...output,trace:{...output.trace,algorithm:STRIP_FOOTING_V6_DEFINITION.outputs.find(o=>o.outputKey===output.outputKey)!.algorithm,values:[...output.trace.values,{key:'calculation.contract_version',value:6}]}}))};
}
