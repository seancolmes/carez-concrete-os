export type ResourceReads={requirements:boolean;operations:boolean;inventory:boolean;equipment:boolean;vendors:boolean;purchaseOrders:boolean;calendar:boolean};
export function resourceReadState(errors:Partial<Record<keyof ResourceReads,unknown>>):ResourceReads{
 return {requirements:!errors.requirements,operations:!errors.operations,inventory:!errors.inventory,equipment:!errors.equipment,vendors:!errors.vendors,purchaseOrders:!errors.purchaseOrders,calendar:!errors.calendar};
}
export function resourceQuantity(value:unknown,unit?:string){
 const number=value===null||value===undefined||value===''?null:Number(value);
 return number===null||!Number.isFinite(number)?'Unavailable':`${number.toLocaleString('en-US',{maximumFractionDigits:2})}${unit?` ${unit}`:''}`;
}
