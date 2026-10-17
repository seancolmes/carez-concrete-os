import {randomUUID} from 'node:crypto';
import {readRecovery,recoverySessionId,sealRecovery,type ResetContext} from './recoveryContext.ts';
import {validateNewPassword} from './passwordPolicy.ts';
type Client={auth:{verifyOtp:(args:any)=>Promise<any>;exchangeCodeForSession:(code:string)=>Promise<any>;getUser:()=>Promise<any>;getSession:()=>Promise<any>;updateUser:(args:{password:string})=>Promise<any>}};
export const RECOVERY_REQUEST_MESSAGE='If this address belongs to an account, check for a password-reset email. Delivery may take a few minutes. Use the latest link.';
export function recoveryRequestResult(error:{code?:string;status?:number}|null){
 // Account-specific outcomes never expose whether an address exists. Service
 // failures are truthful and identical for every address.
 if(error&&!['user_not_found','email_not_found','identity_not_found'].includes(error.code||''))return{status:'error' as const,message:'The email service could not process the request. Try again later.'};
 return{status:'sent' as const,message:RECOVERY_REQUEST_MESSAGE};
}
export async function verifyRecovery(client:Client,values:{tokenHash?:string|null;type?:string|null;code?:string|null;requestCookie?:string;verifier?:string|null},key:string,issuance?:{claim:(tokenHash:string)=>Promise<string>},now=Date.now()){
 let result:any;
 let issuedUserId:string;
 if(values.tokenHash&&values.type==='recovery'&&issuance){issuedUserId=await issuance.claim(values.tokenHash);result=await client.auth.verifyOtp({token_hash:values.tokenHash,type:'recovery'});}
 else throw new Error('Recovery link is invalid or has the wrong purpose. Request a new link.');
 // SDK redirectType is derived from local PKCE storage, not provider-attested
 // purpose. Token-hash issuance purpose still requires the server ledger;
 // GoTrue accepts magiclink tokens through the recovery verification endpoint.
 if(result.error||!result.data?.user||!result.data?.session||result.data.user.id!==issuedUserId)throw new Error('Recovery link is invalid, expired, or already used.');
 const verified=await client.auth.getUser();
 const user=verified.data?.user;
 if(verified.error||!user||user.id!==result.data.user.id)throw new Error('Recovery identity could not be verified.');
 const sessionId=recoverySessionId(result.data.session.access_token,user.id,now);
 if(!sessionId)throw new Error('Recovery session could not be verified.');
 const context:ResetContext={purpose:'reset',nonce:randomUUID(),userId:user.id,sessionId,expires:Math.floor(now/1000)+600};
 return sealRecovery(context,key);
}
export async function verifiedResetContext(client:Client,cookie:string|undefined,key:string,now=Date.now()){
 const context=readRecovery(cookie,key,'reset',now);if(!context)throw new Error('Request a new password-reset link. This recovery session has expired or is unavailable.');
 const [verified,session]=await Promise.all([client.auth.getUser(),client.auth.getSession()]);
 if(verified.error||session.error||verified.data?.user?.id!==context.userId||recoverySessionId(session.data?.session?.access_token||'',context.userId,now)!==context.sessionId)throw new Error('Request a new password-reset link. This recovery session does not match.');
 return context;
}
export async function resetRecoveredPassword(client:Client,ledger:{claim:(context:ResetContext)=>Promise<void>;finish:(context:ResetContext,confirmed:boolean)=>Promise<void>},cookie:string|undefined,key:string,password:unknown,confirmation:unknown){
 const valid=validateNewPassword(password,confirmation);
 const context=await verifiedResetContext(client,cookie,key);
 await ledger.claim(context); // One durable claim before the nontransactional Auth call.
 try{
  const result=await client.auth.updateUser({password:valid});
  if(result.error||result.data?.user?.id!==context.userId)throw new Error('Password update could not be confirmed. Request a new link before retrying.');
 }catch(error){try{await ledger.finish(context,false);}catch{/* The claim remains consumed even if receipt completion fails. */}throw error;}
 try{await ledger.finish(context,true);}catch{/* A confirmed Auth write is not repeated; the durable claim still prevents reuse. */}
 return context;
}
