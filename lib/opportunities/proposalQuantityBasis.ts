import {financialNumber} from '../financials/amount.ts';
type Item={id:string;section_id:unknown;description:string;quantity:unknown;unit:string;item_type:string;sort_order:unknown};
type Basis={estimate_item_id:string;installed_quantity:unknown;ordered_quantity:unknown;production_unit:string|null;basis_ready:boolean|null;quantity_basis:string};
/** Preserve cost-demand quantities internally; expose explicitly installed scope
 * only for source-identified v7 supply items in NEW customer snapshots. */
export function proposalQuantityItems(items:Item[],basisRows:Basis[],showQuantities:boolean){
 const basis=new Map<string,Basis>();
 for(const row of basisRows){if(basis.has(row.estimate_item_id))throw new Error('Concrete quantity basis is ambiguous; review the Condition projection.');basis.set(row.estimate_item_id,row);}
 return items.map(item=>{
  const row=basis.get(item.id),base={id:item.id,section_id:item.section_id,description:item.description,item_type:item.item_type,sort_order:item.sort_order};
  if(!row||row.quantity_basis==='other')return showQuantities&&item.item_type!=='labor'?{...base,quantity:Number(item.quantity||0),unit:item.unit}:base;
  const installed=financialNumber(row.installed_quantity),ordered=financialNumber(row.ordered_quantity);
  if(row.quantity_basis!=='ordered_concrete'||row.basis_ready!==true||installed===null||ordered===null||installed<0||ordered<0||row.production_unit?.toUpperCase()!=='CY'||item.unit.toUpperCase()!=='CY')
   throw new Error('Installed concrete scope is unavailable or does not reconcile with ordered supply. Recalculate and review before issuing.');
  const scope={...base,description:`${item.description} · Installed concrete scope; material supply includes order allowance`,quantity_basis:'installed_concrete'};
  return showQuantities?{...scope,quantity:installed,unit:'CY',ordered_quantity:ordered,material_quantity_basis:'ordered_concrete'}:scope;
 });
}
