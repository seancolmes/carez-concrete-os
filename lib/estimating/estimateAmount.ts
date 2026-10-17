export function estimateAmount(value:unknown):number|null{
 if(value===null||value===undefined||value==='')return null;
 const amount=Number(value);return Number.isFinite(amount)?amount:null;
}
export function estimateMoney(value:unknown,maximumFractionDigits=2){
 const amount=estimateAmount(value);return amount===null?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:maximumFractionDigits,maximumFractionDigits}).format(amount);
}
