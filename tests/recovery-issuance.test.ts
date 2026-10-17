import test from 'node:test';import assert from 'node:assert/strict';
import {issueRecovery,recoveryTokenDigest} from '../lib/auth/recoveryIssuance.ts';
function setup(){
 const calls:string[]=[],registered=new Map<string,string>();
 const issuer={generateLink:async()=>{calls.push('generate');return{data:{properties:{verification_type:'recovery',hashed_token:'synthetic-hash'},user:{id:'synthetic-user',email:'tester@example.invalid'}},error:null} as any;}};
 const ledger={begin:async(key:string)=>{assert.match(key,/^[a-f0-9]{64}$/);calls.push('limit');return'synthetic-request';},register:async(_id:string,digest:string,uid:string)=>{calls.push('register');registered.set(digest,uid);},claim:async(digest:string)=>{const uid=registered.get(digest);if(!uid)throw new Error('Unregistered');registered.delete(digest);return uid;},finish:async(_id:string,state:string)=>{calls.push('receipt:'+state);}};
 const send=async(args:{email:string;url:string})=>{calls.push('send');assert.equal(args.email,'tester@example.invalid');assert.equal(new URL(args.url).origin,'https://example.invalid');assert.equal(new URL(args.url).pathname,'/auth/recovery');assert.equal(new URL(args.url).searchParams.get('token_hash'),'synthetic-hash');assert.ok(registered.has(recoveryTokenDigest('synthetic-hash')));};
 return{calls,issuer,ledger,send};
}
const issue=(f:ReturnType<typeof setup>)=>issueRecovery(f.issuer,f.ledger,f.send,'Tester@example.invalid','fixture-HMAC-key','https://example.invalid');
test('durable rate limit then trusted recovery issuance then ledger then email',async()=>{const f=setup();assert.equal((await issue(f)).status,'sent');assert.deepEqual(f.calls,['limit','generate','register','send','receipt:sent']);});
test('missing account confirmation does not disclose account or send an unregistered token',async()=>{const known=setup(),missing=setup();missing.issuer.generateLink=async()=>({data:null,error:{code:'user_not_found'}});assert.deepEqual(await issue(missing),await issue(known));assert.deepEqual(missing.calls,['limit','receipt:not-issued']);});
test('wrong issuer purpose or identity, unavailable ledger and rate limit never send',async()=>{
 for(const wrong of [{verification_type:'magiclink',id:'synthetic-user',email:'tester@example.invalid'},{verification_type:'recovery',id:'other',email:'other@example.invalid'}]){const f=setup();f.issuer.generateLink=async()=>({data:{properties:{...wrong,hashed_token:'synthetic-hash'},user:wrong},error:null});assert.equal((await issue(f)).status,'sent');assert.ok(!f.calls.includes('send'));assert.ok(f.calls.includes('receipt:unconfirmed'));}
 const noLedger=setup();noLedger.ledger.register=async()=>{throw new Error('Ledger unavailable');};assert.equal((await issue(noLedger)).status,'sent');assert.ok(!noLedger.calls.includes('send'));
 const limited=setup();limited.ledger.begin=async()=>{throw new Error('Limited');};await assert.rejects(issue(limited));assert.deepEqual(limited.calls,[]);
});
test('registration and sender failures have the same public result as missing account',async()=>{
 const missing=setup();missing.issuer.generateLink=async()=>({data:null,error:{code:'user_not_found'}});const expected=await issue(missing);
 for(const stage of ['register','send','receipt']){const f=setup();if(stage==='register')f.ledger.register=async()=>{throw new Error('Private register failure');};if(stage==='send')f.send=async()=>{throw new Error('Private sender failure');};if(stage==='receipt')f.ledger.finish=async()=>{throw new Error('Private receipt failure');};assert.deepEqual(await issue(f),expected);}
});
