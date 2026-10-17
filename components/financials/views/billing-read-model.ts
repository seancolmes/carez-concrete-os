import {invoiceCollectionKind} from '../../../lib/billing/invoiceCollection.ts';
export type BillingRow = {
  project_id:string;
  job_number:string|null;
  name:string|null;
  recorded_contract:number|null;
  unbilled_contract:number|null;
  billed_amount:number|null;
  outstanding_ar:number|null;
  overdue_ar:number|null;
  collected_amount:number|null;
};

export type BillingSummary = {
  unbilled:number|null;
  unbilledMissingContract:boolean;
  owed:number|null;
  late:number|null;
  collected:number|null;
  retainage:number|null;
  drafts:number|null;
};

type BillingSourceRow = {
  project_id:string;
  job_number:string|null;
  name:string|null;
  original_contract_value:unknown;
  unbilled_contract:unknown;
  billed_amount:unknown;
  outstanding_ar:unknown;
  collected_amount:unknown;
};
type InvoiceSourceRow = {
  project_id:string|null;
  status:string|null;
  collection_status:string|null;
  balance_due:unknown;
};
type RetainageSourceRow = {available_to_release:unknown};
type ReadResult<T> = {data:readonly T[]|null;error:unknown|null};

export type BillingReadModel = {
  rows:BillingRow[];
  summary:BillingSummary;
  billingUnavailable:boolean;
  invoicesUnavailable:boolean;
  retainageUnavailable:boolean;
};

const amount=(value:unknown):number|null=>{
  if(value===null||value===undefined||value==='')return null;
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:null;
};

const sumKnown=(values:readonly (number|null)[]):number|null=>
  values.some(value=>value===null)?null:values.reduce<number>((total,value)=>total+(value as number),0);

export function billingRowState(row:BillingRow):'unavailable'|'late'|'owed'|'missing-contract'|'current'{
  if(row.overdue_ar===null||row.outstanding_ar===null)return 'unavailable';
  if(row.overdue_ar>0)return 'late';
  if(row.outstanding_ar>0)return 'owed';
  if(row.recorded_contract===null)return 'missing-contract';
  return 'current';
}

export function buildBillingReadModel({billing,invoices,retainage}:{
  billing:ReadResult<BillingSourceRow>;
  invoices:ReadResult<InvoiceSourceRow>;
  retainage:ReadResult<RetainageSourceRow>;
}):BillingReadModel{
  const billingUnavailable=Boolean(billing.error)||billing.data===null;
  const invoicesUnavailable=Boolean(invoices.error)||invoices.data===null;
  const retainageUnavailable=Boolean(retainage.error)||retainage.data===null;

  const lateByProject=new Map<string,number|null>();
  let lateTotal:number|null=invoicesUnavailable?null:0;
  if(!invoicesUnavailable){
    for(const invoice of invoices.data||[]){
      if(invoiceCollectionKind(invoice.collection_status)==='unavailable'){lateTotal=null;continue;}
      if(invoiceCollectionKind(invoice.collection_status)!=='overdue')continue;
      const balance=amount(invoice.balance_due);
      if(balance===null||!invoice.project_id){lateTotal=null;continue;}
      const previous=lateByProject.get(invoice.project_id)??0;
      lateByProject.set(invoice.project_id,previous+balance);
      if(lateTotal!==null)lateTotal+=balance;
    }
  }

  const rows:BillingRow[]=billingUnavailable?[]:(billing.data||[]).map(source=>{
    const recorded=amount(source.original_contract_value);
    return {
      project_id:String(source.project_id),job_number:source.job_number,name:source.name,
      recorded_contract:recorded,
      unbilled_contract:recorded===null?null:amount(source.unbilled_contract),
      billed_amount:amount(source.billed_amount),
      outstanding_ar:amount(source.outstanding_ar),
      overdue_ar:invoicesUnavailable||lateTotal===null?null:lateByProject.get(source.project_id)??0,
      collected_amount:amount(source.collected_amount),
    };
  });
  const unbilledMissingContract=rows.some(row=>row.recorded_contract===null);
  return {
    rows,billingUnavailable,invoicesUnavailable,retainageUnavailable,
    summary:{
      unbilled:billingUnavailable?null:sumKnown(rows.map(row=>row.unbilled_contract)),
      unbilledMissingContract,
      owed:billingUnavailable?null:sumKnown(rows.map(row=>row.outstanding_ar)),
      late:lateTotal,
      collected:billingUnavailable?null:sumKnown(rows.map(row=>row.collected_amount)),
      retainage:retainageUnavailable?null:sumKnown((retainage.data||[]).map(row=>amount(row.available_to_release))),
      drafts:invoicesUnavailable?null:(invoices.data||[]).filter(row=>row.status==='draft').length,
    },
  };
}
