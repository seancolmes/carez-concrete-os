import 'server-only';
import {cookies} from 'next/headers';
import {createServerClient} from '@supabase/ssr';
import {createClient as serviceClient} from '@supabase/supabase-js';
import {sourceWriterConfiguration} from '@/lib/documents/sourceWriterConfiguration';
import {RECOVERY_REQUEST_COOKIE,RECOVERY_RESET_COOKIE,RECOVERY_STORAGE_KEY,recoveryOrigin,recoverySigningKey,type ResetContext} from './recoveryContext';
import {recoveryTokenDigest,type RecoveryIssuanceLedger} from './recoveryIssuance';

export function recoveryConfiguration(){
 return {key:recoverySigningKey(process.env.AUTH_RECOVERY_SIGNING_KEY),origin:recoveryOrigin(process.env.NEXT_PUBLIC_SITE_URL,process.env.NODE_ENV!=='production')};
}
export const recoveryCookieOptions=(origin:string,maxAge:number)=>({httpOnly:true,secure:new URL(origin).protocol==='https:',sameSite:'lax' as const,path:'/auth',maxAge});
/** Separate HttpOnly storage: ordinary workspace/signup sessions cannot reset a password. */
export async function createRecoveryClient(buffer?:{getAll:()=>{name:string;value:string}[];setAll:(items:Array<{name:string;value:string;options?:any}>)=>void}){
 const store=await cookies(),{origin}=recoveryConfiguration();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Password recovery is unavailable. Authentication configuration is required.');
 return createServerClient(url,key,{cookieOptions:{name:RECOVERY_STORAGE_KEY,...recoveryCookieOptions(origin,900)},cookies:buffer||{getAll:()=>store.getAll(),setAll:(items:Array<{name:string;value:string;options?:any}>)=>{for(const item of items)store.set(item.name,item.value,{...item.options,...recoveryCookieOptions(origin,item.options?.maxAge===0?0:900)});}}});
}
export async function clearRecoveryCookies(){
 const store=await cookies(),{origin}=recoveryConfiguration();
 for(const cookie of store.getAll())if(cookie.name.startsWith(RECOVERY_STORAGE_KEY)||cookie.name===RECOVERY_REQUEST_COOKIE||cookie.name===RECOVERY_RESET_COOKIE)store.set(cookie.name,'',recoveryCookieOptions(origin,0));
}
export function recoveryLedger(){
 const {url,key}=sourceWriterConfiguration(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.POURTRACE_SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const writer=serviceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return {
  async claim(context:ResetContext){
   const result=await writer.rpc('carez_claim_password_recovery',{p_nonce:context.nonce,p_user_id:context.userId,p_session_id:context.sessionId,p_expires_at:new Date(context.expires*1000).toISOString()});
   if(result.error||result.data?.ok!==true||result.data.nonce!==context.nonce)throw new Error('Password recovery could not claim this link. It may be used or unavailable. Request a new link before retrying.');
  },
  async finish(context:ResetContext,confirmed:boolean){
   const result=await writer.rpc('carez_finish_password_recovery',{p_nonce:context.nonce,p_user_id:context.userId,p_session_id:context.sessionId,p_confirmed:confirmed});
   if(result.error)throw new Error('Recovery receipt completion unavailable.');
  },
 };
}
export function recoveryIssuanceService(){
 const {url,key}=sourceWriterConfiguration(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.POURTRACE_SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const writer=serviceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const ledger:RecoveryIssuanceLedger={
  async begin(emailKey){const result=await writer.rpc('carez_begin_password_recovery_request',{p_email_key:emailKey});if(result.error||typeof result.data!=='string')throw new Error('Recovery is temporarily unavailable or limited. Try again later.');return result.data;},
  async register(requestId,digest,userId,expires){const result=await writer.rpc('carez_register_password_recovery_token',{p_request_id:requestId,p_token_digest:digest,p_user_id:userId,p_expires_at:expires});if(result.error)throw new Error('Recovery issuance could not be registered.');},
  async claim(digest){const result=await writer.rpc('carez_claim_password_recovery_token',{p_token_digest:digest});if(result.error||typeof result.data!=='string')throw new Error('Recovery link was not issued here, expired or already used. Request a new link.');return result.data;},
  async finish(requestId,state){const result=await writer.rpc('carez_finish_password_recovery_request',{p_request_id:requestId,p_state:state});if(result.error)throw new Error('Recovery delivery receipt unavailable.');},
 };
 return{issuer:writer.auth.admin,ledger,verification:{claim:(tokenHash:string)=>ledger.claim(recoveryTokenDigest(tokenHash))}};
}
export function recoveryEmailSender(){
 const key=process.env.AUTH_RECOVERY_EMAIL_API_KEY,from=process.env.AUTH_RECOVERY_EMAIL_FROM;
 if(!key||!from)throw new Error('Password recovery email is unavailable.');
 return async({id,email,url}:{id:string;email:string;url:string})=>{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`pourtrace-recovery-${id}`},body:JSON.stringify({from,to:[email],subject:'Reset your PourTrace password',text:`A password reset was requested for your PourTrace account.\n\nContinue to choose a new password:\n${url}\n\nThis link expires in15 minutes. If you did not request this, ignore this email.`}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Recovery email delivery could not be confirmed. Request a new link later.');
  const result=await response.json();if(!result?.id)throw new Error('Recovery email delivery could not be confirmed.');
 };
}
