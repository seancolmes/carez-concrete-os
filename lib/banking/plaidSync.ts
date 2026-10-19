type RpcClient={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:any;error:any}>};
type Post=(path:string,body:Record<string,unknown>,options?:{signal?:AbortSignal})=>Promise<any>;
type Scope={companyId:string;actorId:string;connectionId:string};
type Options={realtimeBalance?:boolean;pageCap?:number};
type Dependencies={writer:RpcClient;post:Post;decrypt:(row:any)=>string;uuid:()=>string;now?:()=>number};
type OpenRun={run_id:string;lease_token:string;generation:number;page_index:number;cursor:string|null};

const object=(v:unknown):Record<string,any>=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Complete provider object required.');
 return v as Record<string,any>;
};
const id=(v:unknown):string=>{
 if(typeof v!=='string'||!v.trim())throw new Error('Provider identity missing.');return v;
};
const text=(v:unknown):string|null=>{
 if(v===null||v===undefined)return null;
 if(typeof v!=='string')throw new Error('Provider text invalid.');return v||null;
};
const array=(v:unknown):any[]=>{
 if(!Array.isArray(v))throw new Error('Complete provider array required.');return v;
};
const boolean=(v:unknown):boolean=>{
 if(typeof v!=='boolean')throw new Error('Explicit provider state required.');return v;
};
// Preserve existing cent rounding; no false zero for a missing/invalid amount.
const cents=(v:unknown,nullable=false):number|null=>{
 if(v===null&&nullable)return null;
 if(typeof v!=='number'||!Number.isFinite(v))throw new Error('Provider amount unavailable.');
 const n=Math.round(v*100)/100;if(!Number.isFinite(n))throw new Error('Provider amount invalid.');return n;
};
const date=(v:unknown,nullable=false):string|null=>{
 if((v===null||v===undefined)&&nullable)return null;
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new Error('Provider date invalid.');
 const d=new Date(`${v}T00:00:00Z`);
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)throw new Error('Provider date invalid.');return v;
};
function unique(values:string[]){if(new Set(values).size!==values.length)throw new Error('Provider page repeated an identity.');}

export function normalizePlaidAccounts(response:unknown){
 const value=object(response),rows=array(value.accounts).map(raw=>{
  const a=object(raw),balances=object(a.balances);
  // `current`/`available` must be present; explicit null is supported unknown.
  if(!Object.hasOwn(balances,'current')||!Object.hasOwn(balances,'available'))throw new Error('Complete provider balances required.');
  return {plaid_account_id:id(a.account_id),name:text(a.name)||text(a.official_name)||'Bank account',
   official_name:text(a.official_name),mask:text(a.mask),account_type:id(a.type),account_subtype:text(a.subtype),
   iso_currency_code:text(balances.iso_currency_code),current_balance:cents(balances.current,true),available_balance:cents(balances.available,true)};
 });
 unique(rows.map(a=>a.plaid_account_id));return rows;
}
function transaction(raw:unknown){
 const t=object(raw),category=t.personal_finance_category==null?null:object(t.personal_finance_category);
 const counterparties=t.counterparties==null?[]:array(t.counterparties);
 const first=counterparties.length?object(counterparties[0]):null;
 const amount=cents(t.amount) as number;
 return {plaid_transaction_id:id(t.transaction_id),plaid_account_id:id(t.account_id),transaction_date:date(t.date),
  authorized_date:date(t.authorized_date,true),name:text(t.name)||text(t.merchant_name)||'Bank transaction',merchant_name:text(t.merchant_name),
  plaid_amount:amount,cash_amount:cents(-t.amount),pending:boolean(t.pending),payment_channel:text(t.payment_channel),
  category_primary:text(category?.primary),category_detailed:text(category?.detailed),website:text(t.website)||text(first?.website),
  logo_url:text(t.logo_url),raw_data:t};
}
export function normalizePlaidPage(response:unknown,expectedCursor:string|null){
 const value=object(response),added=array(value.added).map(transaction),modified=array(value.modified).map(transaction),
  removed=array(value.removed).map(raw=>({plaid_transaction_id:id(object(raw).transaction_id)})),
  next_cursor=id(value.next_cursor),has_more=boolean(value.has_more);
 unique([...added,...modified,...removed].map(t=>t.plaid_transaction_id));
 if(has_more&&next_cursor===expectedCursor)throw new Error('Provider cursor did not progress.');
 return {added,modified,removed,next_cursor,has_more};
}

// One bounded identical RPC retry resolves a lost response through durable
// begin/page identities. A failed acknowledgement never permits another fetch.
async function rpc(deps:Dependencies,name:string,args:Record<string,unknown>,retry=false){
 let failure:unknown;
 for(let attempt=0;attempt<(retry?2:1);attempt++){
  try{const response=await deps.writer.rpc(name,args);if(response.error||response.data?.ok!==true)throw new Error(response.error?.message||'Bank command was not confirmed.');return response.data;}
  catch(error){failure=error;}
 }
 throw failure;
}
const scopeArgs=(s:Scope)=>({p_company:s.companyId,p_actor:s.actorId,p_connection:s.connectionId});

export function makePlaidConnectionSync(deps:Dependencies){
 return async function sync(s:Scope,{realtimeBalance=false,pageCap=20}:Options={}){
  if(!Number.isInteger(pageCap)||pageCap<1||pageCap>20)throw new Error('Invalid sync page cap.');
  const lease=deps.uuid();
  const opened=await rpc(deps,'carez_plaid_sync_begin',{...scopeArgs(s),p_lease:lease},true);
  if(opened.busy===true)return {connectionId:s.connectionId,complete:false,busy:true,changed:0,accounts:0,matchedSourceChanges:0};
  if(typeof opened.run_id!=='string'||opened.lease_token!==lease||!Number.isSafeInteger(opened.generation)||!Number.isSafeInteger(opened.page_index)
   ||!(opened.cursor===null||typeof opened.cursor==='string'))throw new Error('Sync lease was not confirmed.');
  const run=opened as OpenRun;let changed=0,accounts=0,matchedSourceChanges=0;
  const now=deps.now||Date.now,started=now();
  const runArgs=()=>({...scopeArgs(s),p_run:run.run_id,p_lease:lease});
  const renew=()=>rpc(deps,'carez_plaid_sync_renew',runArgs());
  const stop=(outcome:'failed'|'incomplete',code:string,message:string)=>rpc(deps,'carez_plaid_sync_stop',{
   ...runArgs(),p_outcome:outcome,p_code:code,p_message:message},true);
  try{
   const accessToken=deps.decrypt(opened);
   await renew();
   // Required small lib/plaid.ts change: optional third {signal} argument to
   // plaidPost forwarded to fetch. Existing callers need no changes.
   const response=await deps.post(realtimeBalance?'/accounts/balance/get':'/accounts/get',{access_token:accessToken},{signal:AbortSignal.timeout(45_000)});
   const accountRows=normalizePlaidAccounts(response);
   for(let index=0;index<pageCap;index++){
    if(now()-started>180_000){await stop('incomplete','SYNC_TIME_LIMIT','Bank synchronization has more work. Sync again to continue.');return{connectionId:s.connectionId,complete:false,busy:false,changed,accounts,matchedSourceChanges,code:'SYNC_TIME_LIMIT'};}
    await renew();
    const rawPage=await deps.post('/transactions/sync',{access_token:accessToken,...(run.cursor===null?{}:{cursor:run.cursor}),count:500},{signal:AbortSignal.timeout(45_000)});
    const page=normalizePlaidPage(rawPage,run.cursor),pageId=deps.uuid();
    // Same args/page ID are reused on uncertain acknowledgement; do not fetch
    // the next page until this exact commit is confirmed.
    const committed=await rpc(deps,'carez_plaid_sync_commit_page',{
     ...runArgs(),p_page_id:pageId,p_generation:run.generation,p_page_index:run.page_index,p_expected_cursor:run.cursor,p_page:page,
     p_accounts:index===0?accountRows:null,p_realtime_balance:index===0&&realtimeBalance},true);
    if(committed.run_id!==run.run_id||committed.page_id!==pageId||committed.generation!==run.generation||committed.page_index!==run.page_index+1
     ||committed.cursor!==page.next_cursor||committed.complete!==!page.has_more
     ||![committed.changed,committed.accounts,committed.matched_source_changes].every(n=>Number.isSafeInteger(n)&&n>=0))throw new Error('Page completion receipt invalid.');
    changed+=committed.changed;accounts+=committed.accounts;matchedSourceChanges+=committed.matched_source_changes;
    run.page_index=committed.page_index;run.cursor=committed.cursor;
    if(committed.complete)return {connectionId:s.connectionId,complete:true,busy:false,changed,accounts,matchedSourceChanges};
   }
   await stop('incomplete','SYNC_PAGE_LIMIT','More bank pages remain. Sync again to continue.');
   return {connectionId:s.connectionId,complete:false,busy:false,changed,accounts,matchedSourceChanges,code:'SYNC_PAGE_LIMIT'};
  }catch(error){
   // Includes provider pagination-mutation code unchanged; begin then resets
   // work cursor to the saved completed cursor. Never log credentials/payload.
   const code=error&&typeof error==='object'&&'code' in error&&typeof error.code==='string'?error.code:'SYNC_FAILED';
   let receiptConfirmed=true;
   try{await stop('failed',code,error instanceof Error?error.message:'Bank sync failed.');}catch{receiptConfirmed=false;}
   const problem=new Error(receiptConfirmed?'Bank sync was not completed. Retry sync.':'Bank sync outcome receipt was not confirmed. Retry sync after the lease expires.');
   Object.assign(problem,{code,receiptConfirmed,connectionId:s.connectionId,changed,accounts,matchedSourceChanges});throw problem;
  }
 };
}
