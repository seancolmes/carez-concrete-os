import test from 'node:test';import assert from 'node:assert/strict';
import {calculateStripFootingV6} from '../lib/takeoff/conditions/stripFootingV6.ts';
import {calculateStripFootingV5} from '../lib/takeoff/conditions/stripFootingV5.ts';
import type {ConditionCalculationRequest,ConditionMeasurementRole,ConditionModuleConfiguration} from '../lib/takeoff/conditions/types.ts';
const value=(value:number|string)=>({value,mode:'project_value' as const});
function request(lengths=[18,18],closed=false):ConditionCalculationRequest{
 const role=(roleKey:string,id:string,quantity:number,unit:'LF'|'EA',geometryType:'polyline'|'count'):ConditionMeasurementRole=>({roleKey,measurementId:id,sheetId:'synthetic-sheet',quantity,unit,geometryType});
 const module=(moduleKey:string,enabled:boolean,inputValues:Record<string,any>={}):ConditionModuleConfiguration=>({moduleKey,instanceKey:'default',enabled,inputValues});
 return{archetypeKey:'strip_wall_footing',conditionVersionId:'synthetic-v6',measurementRoles:lengths.flatMap((length,n)=>[role('run','run-'+n,length,'LF','polyline'),role('__run_endpoints','run-'+n,closed?0:2,'EA','count')]),inputs:{planFacts:{width_ft:value(2),depth_ft:value(1)},commercial:{concrete_waste_pct:value(0)},production:{reinforcing_labor_method:value('factor'),reinforcing_mh_per_unit:value(.1)}},modules:[
 module('concrete',true,{profile:'rectangular'}),module('forms',true,{form_method:'two_sides',formed_sides:2,bulkhead_count_source:'run_endpoints',form_system:'wood_lumber',resource_tracking:true,form_resource_model:'physical_boards_v5',form_board_size:'2x12',stakes_enabled:true,stake_spacing_ft:4,stakes_per_location:1}),
 module('reinforcing',true,{kind:'bottom_longitudinal',bar_size:'#4',bar_count:2,splice_policy:'stock_lap',stock_length_ft:20,lap_length_in:24,waste_pct:0}),module('anchors_embeds',false),module('labor',true),module('excavation_backfill',false),module('placement_equipment',false),module('finish_cure_protection',false),module('miscellaneous',false)]};
}
const output=(request:ConditionCalculationRequest,key:string)=>calculateStripFootingV6(request).outputs.find(o=>o.outputKey===key)!;
test('independent short runs do not acquire a phantom stock splice; reinforcing labor follows corrected steel',()=>{
 const r=request();assert.equal(output(r,'reinforcing.installed_lb').quantity,48.096);assert.equal(output(r,'reinforcing.stock_bars_ea').quantity,4);assert.equal(output(r,'labor.reinforcing_mh').quantity,4.8096);
 const combined=request([36]);assert.equal(output(combined,'reinforcing.installed_lb').quantity,50.768);assert.equal(output(combined,'reinforcing.stock_bars_ea').quantity,4);
 assert.equal(calculateStripFootingV5(r).outputs.find(o=>o.outputKey==='reinforcing.installed_lb')!.quantity,50.768,'v5 aggregate history remains unchanged');
});
test('stakes and spacing resources retain the ends of each separate run',()=>{
 const r=request();assert.equal(output(r,'forms.stakes_ea').quantity,24);
 assert.equal(calculateStripFootingV5(r).outputs.find(o=>o.outputKey==='forms.stakes_ea')!.quantity,20);
 const anchors=r.modules!.find(m=>m.moduleKey==='anchors_embeds')!;anchors.enabled=true;anchors.inputValues={count_mode:'spacing',spacing_in:48,per_location:1,extra_count:2};
 assert.equal(output(r,'anchors_embeds.anchor_ea').quantity,14,'explicit extra count applies once to set');
 const steel=r.modules!.find(m=>m.moduleKey==='reinforcing')!;steel.inputValues={kind:'dowel',bar_size:'#4',spacing_in:48,pieces_per_location:1,piece_length_ft:2,extra_locations:0,waste_pct:0};
 assert.equal(output(r,'reinforcing.installed_lb').quantity,16.032);
});
test('closed runs have no invented endpoints; stock/lap remains held without a closure basis',()=>{
 const r=request([18],true);assert.equal(output(r,'forms.stakes_ea').quantity,10);assert.equal(output(r,'forms.end_contact_sf').quantity,0);
 assert.equal(output(r,'reinforcing.installed_lb').status,'held');assert.match(output(r,'reinforcing.installed_lb').holds[0].message,/closure/);
 r.outputOverrides={'reinforcing.installed_lb':{quantity:30,reason:'Explicit engineer-reviewed closure quantity'}};
 assert.equal(output(r,'reinforcing.installed_lb').quantity,30);assert.equal(output(r,'labor.reinforcing_mh').quantity,3);assert.equal(output(r,'reinforcing.procurement_lb').status,'held','installed override does not invent procurement basis');
});
test('missing or duplicate topology cannot silently count open ends',()=>{
 const missing=request();missing.measurementRoles.pop();assert.equal(output(missing,'forms.stakes_ea').status,'held');assert.equal(output(missing,'reinforcing.installed_lb').status,'held');assert.equal(output(missing,'forms.end_contact_sf').status,'held');
 const duplicate=request();duplicate.measurementRoles.push({...duplicate.measurementRoles[1]});assert.equal(output(duplicate,'forms.end_contact_sf').status,'held');
 const empty=request([0]);assert.throws(()=>calculateStripFootingV6(empty),/greater than zero/,'zero-length geometry cannot acquire a stock bar');
});
test('repeated reinforcing sets preserve allowance rounding and fixed quantities once per module',()=>{
 const r=request();r.modules![2].inputValues!.waste_pct=10;
 r.modules!.push({moduleKey:'reinforcing',instanceKey:'fixed',enabled:true,inputValues:{kind:'custom',bar_size:'#4',custom_total_length_ft:5,waste_pct:0}});
 assert.equal(output(r,'reinforcing.installed_lb').quantity,51.436);assert.equal(output(r,'reinforcing.procurement_lb').quantity,56.2456);assert.equal(output(r,'reinforcing.stock_bars_ea').quantity,5);
});
