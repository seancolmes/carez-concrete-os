import assert from 'node:assert/strict';
import test from 'node:test';
import {proposalQuantityItems} from '../lib/opportunities/proposalQuantityBasis.ts';
const item={id:'supply',section_id:'footing',description:'Concrete supply',quantity:2.8,unit:'CY',item_type:'material',sort_order:10};
const basis={estimate_item_id:'supply',installed_quantity:2.6667,ordered_quantity:2.8,production_unit:'CY',basis_ready:true,quantity_basis:'ordered_concrete'};
test('new v7 customer scope uses installed CY while recording the distinct ordered basis',()=>{
 const result=proposalQuantityItems([item],[basis],true)[0] as any;
 assert.equal(result.quantity,2.6667);assert.equal(result.ordered_quantity,2.8);assert.equal(result.quantity_basis,'installed_concrete');
 assert.match(result.description,/Installed concrete scope/);assert.equal(item.quantity,2.8,'internal cost demand is unchanged');
});
test('hidden customer quantities do not leak installed or ordered numbers into snapshots',()=>{
 const result=proposalQuantityItems([item],[basis],false)[0];
 assert.equal('quantity' in result,false);assert.equal('ordered_quantity' in result,false);assert.doesNotMatch(result.description,/2\.6667|2\.8/);
});
test('missing, failed reconciliation and ambiguous v7 basis cannot fall back to ordered customer quantity',()=>{
 for(const row of [{...basis,basis_ready:false},{...basis,installed_quantity:null},{...basis,ordered_quantity:'NaN'},{...basis,production_unit:'SF'},{...basis,production_unit:null},{...basis,quantity_basis:'unavailable'}])
  assert.throws(()=>proposalQuantityItems([item],[row],true),/unavailable|reconcile/);
 assert.throws(()=>proposalQuantityItems([item],[basis,basis],true),/ambiguous/);
});
test('legacy and unrelated items retain existing customer quantity and labor behavior',()=>{
 assert.equal((proposalQuantityItems([item],[],true)[0] as any).quantity,2.8);
 assert.equal('quantity' in proposalQuantityItems([{...item,item_type:'labor'}],[],true)[0],false);
 assert.equal((proposalQuantityItems([item],[{...basis,quantity_basis:'other'}],true)[0] as any).quantity,2.8);
});
