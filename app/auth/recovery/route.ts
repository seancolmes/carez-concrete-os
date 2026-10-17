import {cookies} from 'next/headers';
import {createRecoveryClient,clearRecoveryCookies,recoveryConfiguration,recoveryCookieOptions,recoveryIssuanceService} from '@/lib/auth/recovery.server';
import {RECOVERY_REQUEST_COOKIE,RECOVERY_RESET_COOKIE} from '@/lib/auth/recoveryContext';
import {verifyRecovery} from '@/lib/auth/recoveryFlow';
import {recoveryHttp} from '@/lib/auth/recoveryHttp';

async function handle(request:Request){
 let origin:string;
 try{origin=recoveryConfiguration().origin;}catch{return new Response('Password recovery is unavailable.',{status:503,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
 return recoveryHttp(request,origin,async tokenHash=>{
  const {key}=recoveryConfiguration();
  const pending=new Map<string,{name:string;value:string}>();
  const client=await createRecoveryClient({getAll:()=>[],setAll:items=>{for(const item of items)pending.set(item.name,item);}});
  const proof=await verifyRecovery(client,{tokenHash,type:'recovery'},key,recoveryIssuanceService().verification);
  // Publish only after token, identity and session verification all succeed.
  // A replay/failed confirmation leaves any established reset session intact.
  const store=await cookies();
  await clearRecoveryCookies();
  for(const item of pending.values())store.set(item.name,item.value,recoveryCookieOptions(origin,item.value?900:0));
  store.set(RECOVERY_REQUEST_COOKIE,'',recoveryCookieOptions(origin,0));
  store.set(RECOVERY_RESET_COOKIE,proof,recoveryCookieOptions(origin,600));
 });
}
export const GET=handle;
export const HEAD=handle;
export const POST=handle;
