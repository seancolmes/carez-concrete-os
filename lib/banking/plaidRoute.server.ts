import 'server-only';
import {createClient} from '@/lib/supabase/server';
import {syncPlaidConnection} from '@/lib/plaidSync.server';
class BankAccessError extends Error{constructor(message:string,public status:number){super(message);}}
export const bankAccessStatus=(error:unknown)=>error instanceof BankAccessError?error.status:503;
export async function bankProviderContext(){
 const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)throw new BankAccessError('Sign in with an owner or office account.',401);
 const result=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
 if(result.error)throw new BankAccessError('Company access unavailable.',503);
 if(!result.data?.company_id||!['owner','office'].includes(result.data.role))throw new BankAccessError('Owner or office authority required.',403);
 return {supabase,companyId:result.data.company_id as string,actorId:user.id};
}
export async function syncBankConnections(context:Awaited<ReturnType<typeof bankProviderContext>>,realtimeBalance=false){
 const read=await context.supabase.from('plaid_connections').select('id,status').eq('company_id',context.companyId).in('status',['active','needs_attention']);
 if(read.error||read.data===null)throw new Error('Bank connections unavailable.');
 const outcomes=[];
 for(const connection of read.data){try{outcomes.push(await syncPlaidConnection({...context,connectionId:connection.id},{realtimeBalance}));}
  catch(error){const known=(key:string)=>{const value=(error as any)?.[key];return Number.isSafeInteger(value)&&value>=0?value:0;};outcomes.push({connectionId:connection.id,complete:false,busy:false,failed:true,changed:known('changed'),accounts:known('accounts'),matchedSourceChanges:known('matchedSourceChanges'),error:'Synchronization failed. Retry sync; the last completed cursor is retained.'});}}
 const complete=outcomes.every(row=>row.complete),failed=outcomes.some(row=>'failed' in row);
 return {ok:complete,complete,failed,connections:outcomes,changed:outcomes.reduce((sum,row)=>sum+row.changed,0),matchedSourceChanges:outcomes.reduce((sum,row)=>sum+row.matchedSourceChanges,0)};
}
