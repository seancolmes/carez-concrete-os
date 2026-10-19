import {financialNumber} from '../financials/amount.ts';
type Row=Record<string,any>;
type Read={data:Row[]|null;error:unknown|null;count?:number|null};
export function reportReferenceTotal(projects:Read,source:Read,field:string){
 if(projects.error||projects.data===null||source.error||source.data===null||source.count!==undefined&&source.count!==source.data.length)return null;
 const map=new Map(source.data.map(row=>[row.project_id,row]));let total=0;
 for(const project of projects.data){const amount=financialNumber(map.get(project.id)?.[field]);if(amount===null)return null;total+=amount;}
 return total;
}
/** Keep verified quantities with unknown attribution; never divide all quantity
 * by only the known subset of labor or conflate equal task names. */
export function productionReportGroups(rows:Row[]){
 const map=new Map<string,{id:string;task:string;unit:string;quantity:number;hours:number;quantityKnown:boolean;missingLabor:number;samples:number}>();
 for(const row of rows){const key=`${row.production_task_id}|${row.unit}`,value=map.get(key)||{id:row.production_task_id,task:row.task_name,unit:row.unit,quantity:0,hours:0,quantityKnown:true,missingLabor:0,samples:0};
  const quantity=financialNumber(row.quantity_completed),hours=financialNumber(row.man_hours);value.samples++;
  if(quantity===null)value.quantityKnown=false;else value.quantity+=quantity;
  if(hours===null)value.missingLabor++;else value.hours+=hours;map.set(key,value);
 }
 return [...map.values()].map(row=>({...row,rate:row.quantityKnown&&!row.missingLabor&&row.hours>0?row.quantity/row.hours:null,inverse:row.quantityKnown&&!row.missingLabor&&row.quantity>0?row.hours/row.quantity:null})).sort((a,b)=>b.samples-a.samples);
}
