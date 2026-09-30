export type ManualEstimateField='description'|'quantity'|'unit'|'unit_cost';

export type ManualEstimateItem={
  item_type?:string|null;
  source_takeoff_measurement_id?:string|null;
  source_takeoff_output_id?:string|null;
  quantity?:number|string|null;
  unit_cost?:number|string|null;
};

const ALLOWED_UNITS=new Set(['CY','LF','SF','LB','EA','HR','DAY','TON','GAL','LS']);
const moneyPrecision=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;

export function manualEstimateCellPatch(item:ManualEstimateItem,field:ManualEstimateField,rawValue:string){
  if(item.source_takeoff_measurement_id||item.source_takeoff_output_id){
    throw new Error('Takeoff quantities and descriptions must be changed in Takeoff.');
  }
  if(String(item.item_type||'').toLowerCase()==='labor'){
    throw new Error('Labor hours and burden must be changed through labor review.');
  }
  const value=rawValue.trim();
  if(field==='description'){
    if(!value||value.length>500)throw new Error('Enter a description of 1 to 500 characters.');
    return {description:value};
  }
  if(field==='unit'){
    const unit=value.toUpperCase();
    if(!ALLOWED_UNITS.has(unit))throw new Error('Choose a valid estimate unit.');
    return {unit};
  }
  if(value==='')throw new Error(`Enter a valid ${field==='quantity'?'quantity':'unit cost'}.`);
  const number=Number(value);
  if(!Number.isFinite(number)||number<0)throw new Error(`Enter a nonnegative ${field==='quantity'?'quantity':'unit cost'}.`);
  const quantity=field==='quantity'?number:Number(item.quantity);
  const unitCost=field==='unit_cost'?number:Number(item.unit_cost);
  if(!Number.isFinite(quantity)||!Number.isFinite(unitCost))throw new Error('The estimate line has invalid calculation inputs.');
  return field==='quantity'
    ? {quantity:number,direct_cost:moneyPrecision(quantity*unitCost)}
    : {unit_cost:number,direct_cost:moneyPrecision(quantity*unitCost)};
}
