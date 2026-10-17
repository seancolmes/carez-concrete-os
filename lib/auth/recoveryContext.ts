import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';

export const RECOVERY_REQUEST_COOKIE='pt-recovery-request';
export const RECOVERY_RESET_COOKIE='pt-recovery-reset';
export const RECOVERY_STORAGE_KEY='pt-recovery-session';
type RequestContext={purpose:'request';nonce:string;emailHash:string;verifierHash:string;expires:number};
export type ResetContext={purpose:'reset';nonce:string;userId:string;sessionId:string;expires:number};
type Context=RequestContext|ResetContext;
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export const recoveryHash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const recoveryEmailHash=(email:string)=>recoveryHash(email.trim().toLowerCase());
export function recoverySigningKey(key:string|undefined){
 if(!key||Buffer.byteLength(key)<32)throw new Error('Password recovery is unavailable. Server recovery configuration is required.');return key;
}
export function recoveryOrigin(value:string|undefined,development=false){
 let url:URL;try{url=new URL(value||'');}catch{throw new Error('Password recovery requires the configured application origin.');}
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||(url.protocol!=='https:'&&!(development&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error('Password recovery requires the configured HTTPS application origin.');
 return url.origin;
}
export function sealRecovery(context:Context,key:string){
 const payload=Buffer.from(JSON.stringify(context)).toString('base64url');
 return `${payload}.${createHmac('sha256',recoverySigningKey(key)).update('pourtrace-auth-recovery-v1:'+payload).digest('base64url')}`;
}
export function readRecovery<T extends Context['purpose']>(value:string|undefined,key:string,purpose:T,now=Date.now()):Extract<Context,{purpose:T}>|null{
 try{
  if(!value||value.length>3000)return null;
  const [payload,signature,...extra]=value.split('.');if(!payload||!signature||extra.length)return null;
  const expected=createHmac('sha256',recoverySigningKey(key)).update('pourtrace-auth-recovery-v1:'+payload).digest();
  const supplied=Buffer.from(signature,'base64url');if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return null;
  const context=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')) as Context;
  const limit=purpose==='request'?900:600;
  if(context.purpose!==purpose||!uuid.test(context.nonce)||!Number.isSafeInteger(context.expires)||context.expires<=Math.floor(now/1000)||context.expires>Math.floor(now/1000)+limit)return null;
  if(context.purpose==='request'&&(!/^[a-f0-9]{64}$/.test(context.emailHash)||!/^[a-f0-9]{64}$/.test(context.verifierHash)))return null;
  if(context.purpose==='reset'&&(!uuid.test(context.userId)||!uuid.test(context.sessionId)))return null;
  return context as Extract<Context,{purpose:T}>;
 }catch{return null;}
}
export function pendingRecovery(email:string,verifier:string,key:string,now=Date.now()){
 if(!verifier.endsWith('/recovery'))throw new Error('Password recovery could not establish its private verification context.');
 return sealRecovery({purpose:'request',nonce:randomUUID(),emailHash:recoveryEmailHash(email),verifierHash:recoveryHash(verifier),expires:Math.floor(now/1000)+900},key);
}
/** Only use after Auth getUser verifies this exact access token's user. */
export function recoverySessionId(accessToken:string,userId:string,now=Date.now()){
 try{const claims=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url').toString('utf8'));if(claims.sub!==userId||!uuid.test(claims.session_id)||!Number.isFinite(claims.exp)||claims.exp<=now/1000)return null;return claims.session_id as string;}catch{return null;}
}
export function recoveryVerifier(cookies:{name:string;value:string}[]){
 const key=RECOVERY_STORAGE_KEY+'-code-verifier';
 let value=cookies.find(cookie=>cookie.name===key)?.value;
 if(value===undefined){const parts=cookies.filter(cookie=>new RegExp('^'+key+'\\.\\d+$').test(cookie.name)).sort((a,b)=>Number(a.name.split('.').at(-1))-Number(b.name.split('.').at(-1)));if(!parts.length)return null;value=parts.map(part=>part.value).join('');}
 try{const parsed=JSON.parse(value.startsWith('base64-')?Buffer.from(value.slice(7),'base64url').toString('utf8'):value);return typeof parsed==='string'&&parsed.endsWith('/recovery')?parsed:null;}catch{return null;}
}
