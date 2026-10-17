export function financialNumber(value:unknown):number|null{
 if(value===null||value===undefined||value==='')return null;
 const number=Number(value);return Number.isFinite(number)?number:null;
}
export const financialMoney=(value:unknown)=>{const number=financialNumber(value);return number===null?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(number);};
export function completeFinancialSum(rows:Record<string,any>[]|null,field:string){
 if(rows===null)return null;let total=0;for(const row of rows){const value=financialNumber(row[field]);if(value===null)return null;total+=value;}return total;
}
