import 'server-only';
import {randomUUID} from 'node:crypto';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {sourceWriterConfiguration} from '@/lib/documents/sourceWriterConfiguration';
import {decryptAccessToken,plaidPost} from '@/lib/plaid';
import {makePlaidConnectionSync} from '@/lib/banking/plaidSync';
type Scope={companyId:string;actorId:string;connectionId:string};
function writer(){const {url,key}=sourceWriterConfiguration(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.POURTRACE_SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY);return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
async function confirmed(name:string,args:Record<string,unknown>){
 const client=writer();let problem:unknown;
 for(let attempt=0;attempt<2;attempt++){try{const {data,error}=await client.rpc(name,args);if(error||data?.ok!==true)throw new Error(error?.message||'Bank command was not confirmed');return data;}catch(error){problem=error;}}
 throw problem;
}
/** Verify installed write authority before consuming a one-use provider token. */
export async function assertPlaidSyncWriterConfigured(scope:Omit<Scope,'connectionId'>){
 const result=await confirmed('carez_plaid_writer_capability',{p_company:scope.companyId,p_actor:scope.actorId});
 if(result.version!=='leased_pages_v1')throw new Error('Bank sync writer unavailable.');
}
export async function syncPlaidConnection(scope:Scope,options:{realtimeBalance?:boolean;pageCap?:number}={}){
 return makePlaidConnectionSync({writer:writer(),post:plaidPost,decrypt:decryptAccessToken,uuid:randomUUID})(scope,options);
}
export async function registerPlaidConnection(scope:Omit<Scope,'connectionId'>,itemId:string,values:Record<string,unknown>){
 const result=await confirmed('carez_plaid_register_connection',{p_company:scope.companyId,p_actor:scope.actorId,p_request_id:randomUUID(),p_item:itemId,p_values:values});
 if(typeof result.id!=='string')throw new Error('Bank connection registration was not confirmed.');return result.id as string;
}
