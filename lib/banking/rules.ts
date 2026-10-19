import {optionalFinancialNumber} from '../financials/commands.ts';
export function bankRuleBusinessUse(value:FormDataEntryValue|null,action:string){
 if(action!=='company_expense')return 100;
 const result=optionalFinancialNumber(value,{max:100});
 if(result===null)throw new Error('Enter the business-use percentage before saving an expense rule.');
 return result;
}
