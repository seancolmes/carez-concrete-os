export const companyExpensePostingEnabled=false;
export const companyExpensePilotNotice='Company expense posting is unavailable in this controlled pilot. Existing records remain available for review; expense inclusion and tenant-policy contracts require separate qualification.';
export function assertCompanyExpensePostingAvailable():void{if(!companyExpensePostingEnabled)throw new Error(companyExpensePilotNotice);}
export function companyExpenseAmount(value:unknown,failed:boolean):number|'Unavailable'|'Not recorded'{
 if(failed)return 'Unavailable';
 if(value===null||value===undefined||typeof value==='string'&&!value.trim())return 'Not recorded';
 if(typeof value!=='string'&&typeof value!=='number')return 'Unavailable';
 const amount=Number(value);return Number.isFinite(amount)?amount:'Unavailable';
}
