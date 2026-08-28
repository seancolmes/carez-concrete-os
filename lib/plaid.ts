import crypto from 'node:crypto';

const PLAID_BASE:Record<string,string>={sandbox:'https://sandbox.plaid.com',development:'https://development.plaid.com',production:'https://production.plaid.com'};

export function plaidConfigured(){return Boolean(process.env.PLAID_CLIENT_ID&&process.env.PLAID_SECRET);}
function cfg(){
  const clientId=process.env.PLAID_CLIENT_ID,secret=process.env.PLAID_SECRET;
  if(!clientId||!secret)throw new Error('Plaid environment variables are missing.');
  const env=(process.env.PLAID_ENV||'production').toLowerCase();
  return {clientId,secret,env,base:PLAID_BASE[env]||PLAID_BASE.production};
}
export async function plaidPost<T=any>(path:string,body:Record<string,any>):Promise<T>{
  const {clientId,secret,base}=cfg();
  const response=await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json','PLAID-CLIENT-ID':clientId,'PLAID-SECRET':secret},body:JSON.stringify(body),cache:'no-store'});
  const data=await response.json();
  if(!response.ok||data?.error_code){const e=new Error(data?.display_message||data?.error_message||`Plaid request failed (${response.status})`) as Error&{code?:string};e.code=data?.error_code;e.name='PlaidError';throw e;}
  return data as T;
}
function tokenKey(){const material=process.env.PLAID_TOKEN_ENCRYPTION_KEY||process.env.PLAID_SECRET;if(!material)throw new Error('Plaid token encryption key is unavailable.');return crypto.createHash('sha256').update(material).digest();}
export function encryptAccessToken(value:string){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',tokenKey(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return {ciphertext:encrypted.toString('base64'),iv:iv.toString('base64'),authTag:cipher.getAuthTag().toString('base64')};}
export function decryptAccessToken(row:{access_token_ciphertext:string;token_iv:string;token_auth_tag:string}){const decipher=crypto.createDecipheriv('aes-256-gcm',tokenKey(),Buffer.from(row.token_iv,'base64'));decipher.setAuthTag(Buffer.from(row.token_auth_tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(row.access_token_ciphertext,'base64')),decipher.final()]).toString('utf8');}

const money=(v:any)=>Math.round(Number(v||0)*100)/100;
function txRow(companyId:string,connectionId:string,accountMap:Map<string,string>,t:any){
  const primary=t.personal_finance_category?.primary||null,detailed=t.personal_finance_category?.detailed||null;
  return {company_id:companyId,connection_id:connectionId,account_id:accountMap.get(t.account_id)||null,plaid_transaction_id:t.transaction_id,plaid_account_id:t.account_id,transaction_date:t.date,authorized_date:t.authorized_date||null,name:t.name||t.merchant_name||'Bank transaction',merchant_name:t.merchant_name||null,plaid_amount:money(t.amount),cash_amount:money(-Number(t.amount||0)),pending:Boolean(t.pending),payment_channel:t.payment_channel||null,category_primary:primary,category_detailed:detailed,website:t.website||t.counterparties?.[0]?.website||null,logo_url:t.logo_url||null,removed:false,raw_data:t,updated_at:new Date().toISOString()};
}

export async function syncPlaidConnection(supabase:any,companyId:string,connection:any,{realtimeBalance=false}:{realtimeBalance?:boolean}={}){
  const accessToken=decryptAccessToken(connection);
  const accountResponse:any=await plaidPost(realtimeBalance?'/accounts/balance/get':'/accounts/get',{access_token:accessToken});
  const {data:existing}=await supabase.from('plaid_accounts').select('id,plaid_account_id,include_in_cash').eq('company_id',companyId).eq('connection_id',connection.id);
  const existingMap=new Map((existing||[]).map((x:any)=>[x.plaid_account_id,x]));
  const now=new Date().toISOString();
  const accountRows=(accountResponse.accounts||[]).map((a:any)=>({company_id:companyId,connection_id:connection.id,plaid_account_id:a.account_id,name:a.name||a.official_name||'Bank account',official_name:a.official_name||null,mask:a.mask||null,account_type:a.type||null,account_subtype:a.subtype||null,iso_currency_code:a.balances?.iso_currency_code||null,current_balance:a.balances?.current==null?null:money(a.balances.current),available_balance:a.balances?.available==null?null:money(a.balances.available),include_in_cash:existingMap.has(a.account_id)?Boolean(existingMap.get(a.account_id).include_in_cash):a.type==='depository',active:true,last_balance_at:now,updated_at:now}));
  if(accountRows.length){const {error}=await supabase.from('plaid_accounts').upsert(accountRows,{onConflict:'company_id,plaid_account_id'});if(error)throw new Error(error.message);}
  const {data:savedAccounts}=await supabase.from('plaid_accounts').select('id,plaid_account_id').eq('company_id',companyId).eq('connection_id',connection.id);
  const accountMap=new Map((savedAccounts||[]).map((x:any)=>[x.plaid_account_id,x.id]));

  let cursor=connection.transactions_cursor||null,hasMore=true,pages=0,changed=0;
  while(hasMore&&pages<20){
    pages++;
    const r:any=await plaidPost('/transactions/sync',{access_token:accessToken,cursor:cursor||undefined,count:500});
    const upserts=[...(r.added||[]),...(r.modified||[])].map((t:any)=>txRow(companyId,connection.id,accountMap,t));
    if(upserts.length){const {error}=await supabase.from('plaid_transactions').upsert(upserts,{onConflict:'company_id,plaid_transaction_id'});if(error)throw new Error(error.message);changed+=upserts.length;}
    for(const removed of r.removed||[]){await supabase.from('plaid_transactions').update({removed:true,updated_at:now}).eq('company_id',companyId).eq('plaid_transaction_id',removed.transaction_id);changed++;}
    cursor=r.next_cursor||cursor;hasMore=Boolean(r.has_more);
  }
  const update:any={transactions_cursor:cursor,last_transactions_sync_at:now,last_accounts_sync_at:now,last_error_code:null,last_error_message:null,status:'active',updated_at:now};if(realtimeBalance)update.last_realtime_balance_at=now;
  await supabase.from('plaid_connections').update(update).eq('id',connection.id).eq('company_id',companyId);
  return {changed,accounts:accountRows.length};
}
