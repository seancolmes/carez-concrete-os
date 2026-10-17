import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingRecovery,readRecovery,recoveryOrigin,recoveryVerifier,sealRecovery,RECOVERY_STORAGE_KEY,type ResetContext} from '../lib/auth/recoveryContext.ts';
import {recoveryRequestResult,verifyRecovery,verifiedResetContext,resetRecoveredPassword} from '../lib/auth/recoveryFlow.ts';
import {validateNewPassword} from '../lib/auth/passwordPolicy.ts';
import {recoveryRequestCookies} from '../lib/auth/recoveryCookies.ts';
const key='isolated-test-only-signing-key-not-a-real-secret';
const user={id:'e7100000-0000-4000-8000-000000000001',email:'synthetic-recovery@example.invalid'};
const sessionId='e7200000-0000-4000-8000-000000000001';
const nonce='e7300000-0000-4000-8000-000000000001';
const verifier='synthetic-private-verifier/recovery';
const issuance={claim:async()=>user.id};
function setup(){
 const calls:string[]=[];
 const session={access_token:'fixture.'+Buffer.from(JSON.stringify({sub:user.id,session_id:sessionId,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.not-a-real-signature'};
 const client={auth:{
  verifyOtp:async(args:any)=>{calls.push('verify:'+args.type);return{data:{user,session},error:null};},
  exchangeCodeForSession:async()=>{calls.push('exchange');return{data:{user,session,redirectType:'recovery'},error:null};},
  getUser:async()=>{calls.push('getUser');return{data:{user},error:null};},
  getSession:async()=>{calls.push('getSession');return{data:{session},error:null};},
  updateUser:async(args:any)=>{calls.push('password:'+Object.keys(args).join(','));return{data:{user},error:null};},
 }};
 const used=new Set<string>(),results:boolean[]=[];
 const ledger={claim:async(context:ResetContext)=>{if(used.has(context.nonce))throw new Error('already used');used.add(context.nonce);},finish:async(_:ResetContext,confirmed:boolean)=>{results.push(confirmed);}};
 const cookie=()=>sealRecovery({purpose:'reset',nonce,userId:user.id,sessionId,expires:Math.floor(Date.now()/1000)+600},key);
 return{calls,client,ledger,used,results,cookie};
}
test('known/unknown addresses have identical request confirmation; provider failures do not imply delivery',()=>{
 assert.deepEqual(recoveryRequestResult(null),recoveryRequestResult({code:'user_not_found',status:400}));
 for(const error of [{status:500},{status:429},{code:'email_provider_disabled',status:400}])assert.equal(recoveryRequestResult(error).status,'error');
});
test('fixed configured callback origins reject arbitrary URLs and production loopback',()=>{
 assert.equal(recoveryOrigin('https://example.invalid'),'https://example.invalid');
 assert.equal(recoveryOrigin('http://localhost:3000',true),'http://localhost:3000');
 for(const origin of ['https://example.invalid/evil','https://user:pass@example.invalid','javascript:alert(1)','http://localhost:3000','https://example.invalid?next=https://evil.invalid'])assert.throws(()=>recoveryOrigin(origin));
});
test('ordinary PKCE codes cannot grant recovery even with a locally marked recovery verifier',async()=>{
 const f=setup(),requestCookie=pendingRecovery(user.email,verifier,key);
 await assert.rejects(verifyRecovery(f.client,{code:'fixture-code',requestCookie,verifier},key),/wrong purpose/);
 assert.deepEqual(f.calls,[],'unattested SDK redirectType is never accepted or exchanged');
 for(const values of [{code:'ordinary-signup-code',verifier},{code:'code',requestCookie,verifier:'different/recovery'},{code:'code',requestCookie:requestCookie+'tampered',verifier}])await assert.rejects(verifyRecovery(f.client,values,key));
 await assert.rejects(verifyRecovery(f.client,{code:'code',requestCookie:pendingRecovery('other@example.invalid',verifier,key),verifier},key),/wrong purpose/);
});
test('token hash passes recovery request type and rejects wrong local type or provider failure (mock only)',async()=>{
 const f=setup();const cookie=await verifyRecovery(f.client,{tokenHash:'fixture-token',type:'recovery'},key,issuance);assert.equal(f.calls[0],'verify:recovery');const proof=readRecovery(cookie,key,'reset');assert.equal(proof?.userId,user.id);assert.equal(proof?.sessionId,sessionId);
 await assert.rejects(verifyRecovery(f.client,{tokenHash:'fixture-token',type:'signup'},key));
 f.client.auth.verifyOtp=async()=>({data:null,error:{message:'expired or reused'}} as any);
 await assert.rejects(verifyRecovery(f.client,{tokenHash:'reused-token',type:'recovery'},key,issuance),/expired, or already used/);
});
test('unregistered magiclink and absent issuance ledger cannot reach OTP or reset proof',async()=>{
 const f=setup();
 await assert.rejects(verifyRecovery(f.client,{tokenHash:'ordinary-token',type:'recovery'},key));
 await assert.rejects(verifyRecovery(f.client,{tokenHash:'ordinary-token',type:'recovery'},key,{claim:async()=>{throw new Error('Not issued here');}}),/Not issued/);
 assert.deepEqual(f.calls,[]);
 await assert.rejects(verifyRecovery(f.client,{tokenHash:'wrong-user-token',type:'recovery'},key,{claim:async()=> 'other-user'}),/invalid, expired/);
});
test('ordinary sessions, expired proofs, different users and different sessions cannot reset',async()=>{
 const f=setup();await assert.rejects(verifiedResetContext(f.client,undefined,key));
 const expired=sealRecovery({purpose:'reset',nonce,userId:user.id,sessionId,expires:Math.floor(Date.now()/1000)-1},key);
 await assert.rejects(verifiedResetContext(f.client,expired,key));
 const wrong=sealRecovery({purpose:'reset',nonce,userId:user.id,sessionId:'e7200000-0000-4000-8000-000000000002',expires:Math.floor(Date.now()/1000)+600},key);
 await assert.rejects(verifiedResetContext(f.client,wrong,key),/does not match/);
});
test('one durable claim permits only one password update under concurrent or repeated submission',async()=>{
 const f=setup(),cookie=f.cookie();
 const result=await Promise.allSettled([resetRecoveredPassword(f.client,f.ledger,cookie,key,'Synthetic-password-123','Synthetic-password-123'),resetRecoveredPassword(f.client,f.ledger,cookie,key,'Another-password-123','Another-password-123')]);
 assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.calls.filter(x=>x==='password:password').length,1);assert.deepEqual(f.results,[true]);
 await assert.rejects(resetRecoveredPassword(f.client,f.ledger,cookie,key,'Synthetic-password-123','Synthetic-password-123'),/already used/);
});
test('invalid passwords never claim a recovery or call Auth; failed Auth updates are never reported successful',async()=>{
 const f=setup();assert.throws(()=>validateNewPassword('short'));assert.throws(()=>validateNewPassword('Long-enough-password','different'));
 await assert.rejects(resetRecoveredPassword(f.client,f.ledger,f.cookie(),key,'short','short'));assert.equal(f.used.size,0);assert.deepEqual(f.calls,[]);
 f.client.auth.updateUser=async()=>{f.calls.push('password:password');return{data:{user:null},error:{message:'fixture failure'}} as any;};
 await assert.rejects(resetRecoveredPassword(f.client,f.ledger,f.cookie(),key,'Synthetic-password-123','Synthetic-password-123'),/not be confirmed/);assert.deepEqual(f.results,[false]);
 await assert.rejects(resetRecoveredPassword(f.client,f.ledger,f.cookie(),key,'Synthetic-password-123','Synthetic-password-123'),/already used/);
});
test('dedicated HttpOnly-storage cookie decoder accepts only recovery verifiers',()=>{
 const encode=(value:string)=>'base64-'+Buffer.from(JSON.stringify(value)).toString('base64url');
 assert.equal(recoveryVerifier([{name:RECOVERY_STORAGE_KEY+'-code-verifier',value:encode(verifier)}]),verifier);
 assert.equal(recoveryVerifier([{name:RECOVERY_STORAGE_KEY+'-code-verifier',value:encode('ordinary-login-verifier')}]),null);
 assert.equal(recoveryVerifier([{name:'ordinary-session-code-verifier',value:encode(verifier)}]),null);
});
test('masked account-error cookies match successful-request handling after SDK cleanup',()=>{
 const cookie={name:RECOVERY_STORAGE_KEY+'-code-verifier',value:'base64-'+Buffer.from(JSON.stringify(verifier)).toString('base64url'),options:{maxAge:900}};
 const success=recoveryRequestCookies(),unknown=recoveryRequestCookies();
 success.setAll([cookie]);unknown.setAll([cookie]);unknown.setAll([{...cookie,value:'',options:{maxAge:0}}]);
 assert.deepEqual(unknown.completed(true),success.completed(false));
 assert.equal(recoveryVerifier(unknown.completed(true)),verifier);
 assert.deepEqual(recoveryRequestResult({code:'user_not_found'}),recoveryRequestResult(null));
});
