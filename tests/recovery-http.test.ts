import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryHttp} from '../lib/auth/recoveryHttp.ts';
const origin='https://example.invalid';
const url=origin+'/auth/recovery?type=recovery&token_hash=one-use-token';
function post(from:string|null=origin,type='recovery'){
 const headers:Record<string,string>={};if(from!==null)headers.Origin=from;
 return new Request(origin+'/auth/recovery',{method:'POST',headers,body:new URLSearchParams({token_hash:'one-use-token',type})});
}
test('GET and HEAD prefetch never verify, consume or publish recovery credentials',async()=>{
 let calls=0;const confirm=async()=>{calls++;};
 for(const method of ['GET','HEAD','GET','HEAD']){
  const response=await recoveryHttp(new Request(url,{method}),origin,confirm);
  assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  if(method==='HEAD')assert.equal(await response.text(),'');
 }
 assert.equal(calls,0);
 const page=await (await recoveryHttp(new Request(url.replace('one-use-token',encodeURIComponent('\"><script>bad</script>'))),origin,confirm)).text();
 assert.match(page,/method="post"/);assert.match(page,/Continue to password reset/);assert.doesNotMatch(page,/<script>/);assert.match(page,/&quot;&gt;&lt;script&gt;/);
});
test('confirmation requires canonical origin and recovery form purpose before Auth',async()=>{
 let calls=0;const confirm=async()=>{calls++;};
 for(const from of [null,'null','https://foreign.invalid'])assert.equal((await recoveryHttp(post(from),origin,confirm)).status,403);
 const wrong=await recoveryHttp(post(origin,'signup'),origin,confirm);assert.equal(wrong.status,303);assert.match(wrong.headers.get('location')!,/recovery=failed/);assert.equal(calls,0);
});
test('explicit confirmation verifies once, redirects with303; failed replay never mutates cookies',async()=>{
 let consumed=false;
 const confirm=async(token:string)=>{assert.equal(token,'one-use-token');if(consumed)throw new Error('Already used');consumed=true;};
 const success=await recoveryHttp(post(),origin,confirm);assert.equal(success.status,303);assert.equal(success.headers.get('location'),origin+'/auth/reset-password');
 const replay=await recoveryHttp(post(),origin,confirm);assert.equal(replay.status,303);assert.match(replay.headers.get('location')!,/recovery=failed/);assert.equal(replay.headers.get('set-cookie'),null);
});
