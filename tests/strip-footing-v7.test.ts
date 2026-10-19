import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateStripFootingV6} from '../lib/takeoff/conditions/stripFootingV6.ts';
import {calculateStripFootingV7,stripConcreteEstimateVisible} from '../lib/takeoff/conditions/stripFootingV7.ts';
import {adaptConditionOutputsToLegacy} from '../lib/takeoff/conditions/legacyAdapter.ts';
import type {ConditionCalculationRequest} from '../lib/takeoff/conditions/types.ts';

function request(allowance=5):ConditionCalculationRequest{
 const value=(value:number)=>({value,mode:'project_value' as const});
 return{archetypeKey:'strip_wall_footing',conditionVersionId:'synthetic-v7',
  measurementRoles:[{roleKey:'run',measurementId:'run',sheetId:'synthetic-sheet',quantity:36,unit:'LF',geometryType:'polyline'}],
  inputs:{planFacts:{width_ft:value(2),depth_ft:value(1)},commercial:{concrete_waste_pct:value(allowance)}},
  modules:[{moduleKey:'concrete',instanceKey:'default',enabled:true,inputValues:{profile:'rectangular'}},
   {moduleKey:'forms',instanceKey:'default',enabled:false,inputValues:{form_resource_model:'physical_boards_v5'}}],
 };
}
test('v7 preserves measured production and prices ordered concrete once',()=>{
 const r=request(),calculation=calculateStripFootingV7(r),legacy=calculateStripFootingV6(r);
 assert.deepEqual(calculation.outputs.map(o=>[o.outputKey,o.quantity,o.status]),legacy.outputs.map(o=>[o.outputKey,o.quantity,o.status]));
 const installed=calculation.outputs.find(o=>o.outputKey==='concrete.installed_cy')!,ordered=calculation.outputs.find(o=>o.outputKey==='concrete.procurement_cy')!;
 assert.equal(installed.quantity,2.6667);assert.equal(ordered.quantity,2.8);
 const priced=adaptConditionOutputsToLegacy(calculation,calculation.outputs.map((o,n)=>({
  outputKey:o.outputKey,assemblyComponentId:`component-${n}`,componentKey:`component-${n}`,label:o.label,
  estimateItemType:'material',outputUnit:o.unit,unitCost:150,
  estimateVisible:stripConcreteEstimateVisible(7,o.outputKey,true),
 })));
 const reference=priced.find(o=>o.condition_output_key==='concrete.installed_cy')!;
 assert.equal(reference.production_quantity,2.6667);assert.equal(reference.estimate_visible,false);
 assert.equal(reference.pricing_status,'not_priced');assert.equal(reference.direct_cost,0);
 assert.equal(priced.filter(o=>o.estimate_visible&&o.production_quantity>0).length,1);
 assert.equal(priced.reduce((total,o)=>total+o.direct_cost,0),420);
 assert.equal(installed.trace.values.find(v=>v.key==='calculation.contract_version')?.value,7);
});
test('order allowance changes material demand without changing installed quantity or legacy price policy',()=>{
 const a=calculateStripFootingV7(request(0)),b=calculateStripFootingV7(request(10));
 assert.equal(a.outputs.find(o=>o.outputKey==='concrete.installed_cy')!.quantity,b.outputs.find(o=>o.outputKey==='concrete.installed_cy')!.quantity);
 assert.equal(b.outputs.find(o=>o.outputKey==='concrete.procurement_cy')!.quantity,2.9334);
 assert.equal(stripConcreteEstimateVisible(6,'concrete.installed_cy',true),true);
 assert.equal(stripConcreteEstimateVisible(7,'concrete.procurement_cy',true),true);
 assert.equal(stripConcreteEstimateVisible(7,'reinforcing.installed_lb',false),false);
});
