'use server';
import {cookies} from 'next/headers';
import {createRecoveryClient,clearRecoveryCookies,recoveryConfiguration,recoveryLedger,recoveryIssuanceService,recoveryEmailSender} from '@/lib/auth/recovery.server';
import {RECOVERY_RESET_COOKIE} from '@/lib/auth/recoveryContext';
import {resetRecoveredPassword} from '@/lib/auth/recoveryFlow';
import {issueRecovery} from '@/lib/auth/recoveryIssuance';

export async function requestPasswordRecovery(_:unknown,form:FormData){
 const email=String(form.get('email')||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return{status:'error',message:'Enter a valid account email.'};
 try{
  const {key,origin}=recoveryConfiguration(),send=recoveryEmailSender();
  await clearRecoveryCookies();
  const {issuer,ledger}=recoveryIssuanceService();
  return await issueRecovery(issuer,ledger,send,email,key,origin);
 }catch{return{status:'error',message:'Password recovery is unavailable. Try again later or contact your workspace administrator.'};}
}
export async function saveRecoveredPassword(_:unknown,form:FormData){
 try{
  const {key}=recoveryConfiguration(),client=await createRecoveryClient(),store=await cookies();
  await resetRecoveredPassword(client,recoveryLedger(),store.get(RECOVERY_RESET_COOKIE)?.value,key,form.get('password'),form.get('confirmation'));
  // The reset session is never promoted into an ordinary workspace session.
  try{await client.auth.signOut({scope:'global'});}catch{/* Password write was confirmed; clear local recovery credentials below. */}
  await clearRecoveryCookies();
  return{status:'saved',message:'Password updated. Sign in with your new password.'};
 }catch(error){return{status:'error',message:error instanceof Error?error.message:'Password update was not confirmed. Request a new link before retrying.'};}
}
