export type PayrollRead<T>={data:T|null;error:unknown};
export function payrollAmount(value:unknown):number|null{
 if(value===null||value===undefined||typeof value==='boolean'||typeof value==='object')return null;
 if(typeof value==='string'&&!value.trim())return null;
 const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;
}
export function payrollSum(...values:unknown[]):number|null{
 const amounts=values.map(payrollAmount);return amounts.some(value=>value===null)?null:(amounts as number[]).reduce((sum,value)=>sum+value,0);
}
export function payrollRead<T>(result:PayrollRead<T>){
 return result.error?{available:false as const,data:null}:{available:true as const,data:result.data};
}
/** Blank is intentionally NULL: it preserves the stored cash amount in SQL. */
export function optionalPayrollCash(value:FormDataEntryValue|null):number|null{
 const raw=typeof value==='string'?value.trim():value===null?'':null;
 if(raw===null)throw new Error('Enter a valid payroll cash amount.');
 if(raw==='')return null;
 if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw new Error('Enter a finite nonnegative cash amount with up to two decimal places.');
 const amount=Number(raw);
 if(!Number.isFinite(amount)||amount>999999999999.99)throw new Error('Payroll cash amount is outside the supported range.');
 return amount;
}
