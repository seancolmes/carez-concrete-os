export const FINANCIAL_COMMANDS=[
 'reconcile_document_receipt_to_job_cost','reconcile_document_receipt_to_company_expense',
 'record_vendor_bill_payment','void_vendor_payment','apply_bank_reconciliation_rule','ignore_bank_transaction',
 'reconcile_bank_as_transfer','reconcile_bank_existing','reconcile_bank_to_company_expense','reconcile_bank_to_invoice',
 'reconcile_bank_to_job_cost','reconcile_bank_to_payroll_run','reconcile_bank_to_tax','reconcile_bank_to_vendor_bill',
] as const;
type Client={rpc:(name:string,args:Record<string,unknown>)=>any};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export function financialRequestId(form:FormData):string{
 const value=form.get('financial_request_id');
 if(typeof value!=='string'||!uuid.test(value))throw new Error('Financial request identity is missing. Reload the form before submitting.');
 return value;
}
export function executeFinancialCommand(client:Client,name:string,args:Record<string,unknown>,requestId:string=crypto.randomUUID()){
 if(!(FINANCIAL_COMMANDS as readonly string[]).includes(name)||!uuid.test(requestId))throw new Error('Unsupported financial command or request identity.');
 return client.rpc(`carez_${name}_v2`,{...args,p_request_id:requestId});
}
export function optionalFinancialNumber(value:FormDataEntryValue|null,{min=0,max=Number.MAX_SAFE_INTEGER}: {min?:number;max?:number}={}):number|null{
 if(value===null||typeof value==='string'&&!value.trim())return null;
 if(typeof value!=='string'||!/^\d+(?:\.\d+)?$/.test(value.trim()))throw new Error('Enter a finite financial amount.');
 const parsed=Number(value);
 if(!Number.isFinite(parsed)||parsed<min||parsed>max)throw new Error('Financial amount is outside the allowed range.');
 return parsed;
}
