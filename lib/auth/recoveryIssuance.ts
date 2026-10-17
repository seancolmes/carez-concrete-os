import {createHash,createHmac} from 'node:crypto';
import {RECOVERY_REQUEST_MESSAGE} from './recoveryFlow.ts';
export const recoveryTokenDigest=(token:string)=>createHash('sha256').update(token).digest('hex');
export type RecoveryIssuanceLedger={
 begin:(emailKey:string)=>Promise<string>;
 register:(requestId:string,digest:string,userId:string,expires:string)=>Promise<void>;
 claim:(digest:string)=>Promise<string>;
 finish:(requestId:string,state:'sent'|'unconfirmed'|'not-issued')=>Promise<void>;
};
type Issuer={generateLink:(args:{type:'recovery';email:string;options:{redirectTo:string}})=>Promise<any>};
/** Trusted issuance, durable purpose registration, then delivery—in that order. */
export async function issueRecovery(issuer:Issuer,ledger:RecoveryIssuanceLedger,send:(args:{id:string;email:string;url:string})=>Promise<void>,email:string,key:string,origin:string,now=Date.now()){
 const normalized=email.trim().toLowerCase();
 const requestId=await ledger.begin(createHmac('sha256',key).update(normalized).digest('hex'));
 let outcome:'sent'|'unconfirmed'|'not-issued'='unconfirmed';
 try{
  const result=await issuer.generateLink({type:'recovery',email:normalized,options:{redirectTo:new URL('/auth/recovery',origin).href}});
  if(result.error){
   if(['user_not_found','email_not_found','identity_not_found'].includes(result.error.code))outcome='not-issued';
  }else{
   const {properties,user}=result.data||{};
   if(properties?.verification_type!=='recovery'||typeof properties.hashed_token!=='string'||!properties.hashed_token||!user?.id||String(user.email||'').toLowerCase()!==normalized)throw new Error('Recovery issuance could not be verified.');
   await ledger.register(requestId,recoveryTokenDigest(properties.hashed_token),user.id,new Date(now+15*60*1000).toISOString());
   const link=new URL('/auth/recovery',origin);link.searchParams.set('token_hash',properties.hashed_token);link.searchParams.set('type','recovery');
   await send({id:requestId,email:normalized,url:link.href});outcome='sent';
  }
 }catch{
  // Account-dependent provider, registration and delivery outcomes are private.
  // Exposing an error only for an existing account would enumerate identities.
 }
 try{await ledger.finish(requestId,outcome);}catch{/* The requested row remains; never expose account-dependent receipts. */}
 return{status:'sent' as const,message:RECOVERY_REQUEST_MESSAGE};
}
