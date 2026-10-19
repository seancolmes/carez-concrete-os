export const companyExpensePostingEnabled=true;
export const companyExpensePilotNotice='Record company-wide operating costs here. Bank-linked expenses and vendor-payment fees stay with their originating workflows.';
export function assertCompanyExpensePostingAvailable():void{if(!companyExpensePostingEnabled)throw new Error(companyExpensePilotNotice);}
export function companyExpenseAmount(value:unknown,failed:boolean):number|'Unavailable'|'Not recorded'{
 if(failed)return 'Unavailable';
 if(value===null||value===undefined||typeof value==='string'&&!value.trim())return 'Not recorded';
 if(typeof value!=='string'&&typeof value!=='number')return 'Unavailable';
 const amount=Number(value);return Number.isFinite(amount)?amount:'Unavailable';
}
