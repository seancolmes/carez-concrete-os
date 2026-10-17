import type {ConditionCalculationRequest,ConditionHold} from './types.ts';
export type DiscreteRun={measurementId:string;lengthFt:number;closed:boolean};
export const DISCRETE_RUN_HOLD:ConditionHold={code:'review_required',message:'Review each footing run’s saved geometry before calculating per-run resources.',requiredInputs:['role.run.geometry']};
/** Internal v6 basis; never read this from client-supplied input values. */
export function geometryRunBasis(request:ConditionCalculationRequest):DiscreteRun[]|null{
 const runs=request.measurementRoles.filter(r=>r.roleKey==='run');
 if(!runs.length||new Set(runs.map(r=>r.measurementId)).size!==runs.length)return null;
 const endpoints=request.measurementRoles.filter(r=>r.roleKey==='__run_endpoints');
 if(endpoints.length!==runs.length)return null;
 const result:DiscreteRun[]=[];
 for(const run of runs){
  const facts=endpoints.filter(e=>e.measurementId===run.measurementId&&e.sheetId===run.sheetId&&e.unit==='EA');
  if(run.unit!=='LF'||run.geometryType!=='polyline'||!Number.isFinite(run.quantity)||run.quantity<=0||facts.length!==1||![0,2].includes(facts[0].quantity))return null;
  result.push({measurementId:run.measurementId,lengthFt:run.quantity,closed:facts[0].quantity===0});
 }
 return result;
}
export function discreteLocations(runs:DiscreteRun[]|null,spacingFt:number):number|null{
 if(!runs||!Number.isFinite(spacingFt)||spacingFt<=0)return null;
 return runs.reduce((sum,r)=>sum+Math.ceil(r.lengthFt/spacingFt)+(r.closed?0:1),0);
}
