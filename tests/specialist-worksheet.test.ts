import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {buildSpecialistWorksheetModel,type SpecialistWorksheetInput} from '../lib/takeoff/specialistWorksheet.ts';

const base:SpecialistWorksheetInput={
  measurements:[{id:'m1',sheet_id:'s1',estimate_section_id:'sec1',name:'North footing',location:'North',raw_quantity:84,raw_unit:'LF'}],
  conditions:[{condition_version_id:'cv1',code:'F-01',name:'Strip Footing',measurement_count:1}],
  roles:[{condition_version_id:'cv1',measurement_id:'m1',role_key:'footing_run',role_instance_key:'default'}],
  modules:[],
  outputs:[],
  holds:[],
  sections:[{id:'sec1',name:'Footings'}],
  sheets:[{id:'s1',sheet_number:'S2.1',page_number:2}],
  legacyOutputs:[],
  pendingConditionVersionIds:new Set<string>(),
};

test('missing price is unknown and partial rather than zero-cost authority',()=>{
  const input:SpecialistWorksheetInput={...base,outputs:[{
    id:'o1',condition_version_id:'cv1',module_instance_id:null,driver_measurement_role_id:null,
    output_key:'reinforcing.installed_lb',output_instance_key:'default',label:'#5 Rebar',
    resource_class:'material',production_quantity:517,production_unit:'LB',status:'ready',
    estimated_man_hours:0,unit_cost:0,direct_cost:0,pricing_status:'missing_price',
    provenance:{},legacy_takeoff_output_id:'lo1',generated_estimate_item_id:'ei1',
  }]};
  const model=buildSpecialistWorksheetModel(input);
  assert.equal(model.pricing[0].pricingState,'price_required');
  assert.equal(model.pricing[0].unitCost,null);
  assert.equal(model.pricing[0].directCost,null);
  assert.equal(model.recap.directCostComplete,false);
});

test('pending recalculation does not publish stale Condition output as current',()=>{
  const model=buildSpecialistWorksheetModel({...base,pendingConditionVersionIds:new Set(['cv1'])});
  assert.equal(model.quantities[0].state,'pending');
  assert.equal(model.recap.pendingConditions,1);
  assert.equal(model.recap.directCostComplete,false);
});

test('recap never adds incompatible LF SF and EA into one quantity total',()=>{
  const measurements=[
    base.measurements[0],
    {id:'m2',sheet_id:'s1',estimate_section_id:'sec1',name:'Slab',location:null,raw_quantity:1842,raw_unit:'SF'},
    {id:'m3',sheet_id:'s1',estimate_section_id:'sec1',name:'Pads',location:null,raw_quantity:4,raw_unit:'EA'},
  ];
  const model=buildSpecialistWorksheetModel({...base,measurements});
  assert.equal('totalQuantity' in model.recap,false);
  assert.deepEqual(model.recap.quantitiesByUnit,[
    {unit:'LF',quantity:84},
    {unit:'SF',quantity:1842},
    {unit:'EA',quantity:4},
  ]);
});

test('resources preserve installed versus procurement output identity',()=>{
  const outputs:SpecialistWorksheetInput['outputs']=[
    {
      id:'o1',condition_version_id:'cv1',module_instance_id:null,driver_measurement_role_id:null,
      output_key:'reinforcing.installed_lb',output_instance_key:'default',label:'Rebar installed',
      resource_class:'material',production_quantity:500,production_unit:'LB',status:'ready',
      estimated_man_hours:0,unit_cost:1,direct_cost:500,pricing_status:'catalog',
      provenance:{source_label:'Carez catalog'},legacy_takeoff_output_id:'lo1',generated_estimate_item_id:'ei1',
    },
    {
      id:'o2',condition_version_id:'cv1',module_instance_id:null,driver_measurement_role_id:null,
      output_key:'reinforcing.procurement_lb',output_instance_key:'default',label:'Rebar procurement',
      resource_class:'material',production_quantity:525,production_unit:'LB',status:'ready',
      estimated_man_hours:0,unit_cost:1,direct_cost:525,pricing_status:'catalog',
      provenance:{source_label:'Carez catalog'},legacy_takeoff_output_id:'lo2',generated_estimate_item_id:'ei2',
    },
  ];
  const model=buildSpecialistWorksheetModel({...base,outputs});
  assert.deepEqual(model.resources.map(row=>row.outputKey),['reinforcing.installed_lb','reinforcing.procurement_lb']);
  assert.deepEqual(model.resources.map(row=>row.quantity),[500,525]);
});

test('labor uses persisted man-hours and production basis without recalculating price',()=>{
  const model=buildSpecialistWorksheetModel({...base,outputs:[{
    id:'o1',condition_version_id:'cv1',module_instance_id:null,driver_measurement_role_id:null,
    output_key:'labor.forms_mh',output_instance_key:'default',label:'Form labor',
    resource_class:'labor',production_quantity:12,production_unit:'HR',status:'ready',
    estimated_man_hours:12,unit_cost:75,direct_cost:900,pricing_status:'manual_override',
    provenance:{source_label:'Estimator override'},legacy_takeoff_output_id:'lo1',generated_estimate_item_id:'ei1',
  }]});
  assert.equal(model.labor[0].estimatedManHours,12);
  assert.equal(model.labor[0].productionQuantity,12);
  assert.equal(model.pricing[0].pricingState,'manual_override');
  assert.equal(model.pricing[0].directCost,900);
});

test('open holds and pricing incompleteness expose explicit destinations',()=>{
  const model=buildSpecialistWorksheetModel({...base,
    outputs:[{
      id:'o1',condition_version_id:'cv1',module_instance_id:null,driver_measurement_role_id:null,
      output_key:'labor.place_mh',output_instance_key:'default',label:'Placement labor',
      resource_class:'labor',production_quantity:8,production_unit:'HR',status:'ready',
      estimated_man_hours:8,unit_cost:0,direct_cost:0,pricing_status:'missing_labor_rate',
      provenance:{},legacy_takeoff_output_id:'lo1',generated_estimate_item_id:'ei1',
    }],
    holds:[{id:'h1',condition_version_id:'cv1',output_id:null,hold_code:'FORM_METHOD_REQUIRED',status:'open',message:'Choose form method.'}],
  });
  assert.equal(model.holds.some(row=>row.destination.view==='labor'),true);
  assert.equal(model.holds.some(row=>row.source==='condition'),true);
  assert.equal(model.recap.directCostComplete,false);
});

test('persisted vendor/catalog evidence is display-only compatibility data',()=>{
  const model=buildSpecialistWorksheetModel({...base,
    outputs:[{
      id:'o1',condition_version_id:'cv1',module_instance_id:null,driver_measurement_role_id:null,
      output_key:'concrete.installed_cy',output_instance_key:'default',label:'Ready mix',
      resource_class:'material',production_quantity:9,production_unit:'CY',status:'ready',
      estimated_man_hours:0,unit_cost:190,direct_cost:1710,pricing_status:'catalog',
      provenance:{source_label:'Northwest normalized vendor catalog'},legacy_takeoff_output_id:'lo1',generated_estimate_item_id:'ei1',
    }],
    legacyOutputs:[{id:'lo1',measurement_id:'m1',catalog_item_id:'catalog-42',cost_source:'Vendor quote Q-19',resource_behavior:'consumable'}],
  });
  assert.equal(model.resources[0].costSource,'Northwest normalized vendor catalog');
  assert.equal(model.resources[0].catalogReference,'catalog-42');
  assert.equal(model.pricing[0].costSource,'Northwest normalized vendor catalog');
  assert.equal(model.pricing[0].catalogReference,'catalog-42');

  const projector=readFileSync(new URL('../lib/takeoff/specialistWorksheet.ts',import.meta.url),'utf8');
  const worksheet=readFileSync(new URL('../components/takeoff/TakeoffWorksheet.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(projector+worksheet,/fetch\(|axios|download|supplier-specific|grainger|white\s*cap|hd\s*supply/i);
});
