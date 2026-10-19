import {financialNumber,completeFinancialSum} from '../financials/amount.ts';
type Read={data:any;error:unknown;count?:number|null};
export type BankRead=Read;
export function bankRows(read:Read,complete=false):any[]|null{
 if(read.error||!Array.isArray(read.data)||complete&&read.count!==read.data.length)return null;
 return read.data;
}
export function bankMetric(read:Read,field:string){return read.error?null:financialNumber(read.data?.[field]);}
export type BankingReads=Record<'summary'|'reconciliation'|'accounts'|'transactions'|'connections'|'changedMatches',Read>;
export function bankingReadModel(reads:BankingReads){
 const rows=(key:keyof BankingReads)=>!reads[key].error&&Array.isArray(reads[key].data)?reads[key].data:null;
 const value=(key:'summary'|'reconciliation',field:string)=>reads[key].error?null:financialNumber(reads[key].data?.[field]);
 const accounts=rows('accounts'),connections=rows('connections'),transactions=rows('transactions');
 const included=(accounts||[]).filter(a=>a.active===true&&a.include_in_cash===true&&a.account_type==='depository');
 const coverage=accounts!==null&&reads.accounts.count===accounts.length&&accounts.every(a=>typeof a.active==='boolean'&&typeof a.include_in_cash==='boolean'&&typeof a.account_type==='string');
 const cash=coverage&&included.length>0&&included.every(a=>a.last_balance_at&&Number.isFinite(Date.parse(a.last_balance_at)))?completeFinancialSum(included,'cash_balance'):null;
 return{accounts,connections,transactions,includedCount:coverage?included.length:null,connectedCash:cash,
  needs:value('reconciliation','needs_review_count'),high:value('reconciliation','high_confidence_count'),
  activeConnections:value('summary','active_connections'),linkedAccounts:value('summary','linked_accounts'),
  lastSync:reads.summary.error?null:reads.summary.data?.last_transactions_sync_at??null,
  summaryAvailable:!reads.summary.error&&reads.summary.data!==null,
  changedMatches:reads.changedMatches.error?null:reads.changedMatches.count??null};
}
