import test from 'node:test';import assert from 'node:assert/strict';
import {sourceWriterConfiguration} from '../lib/documents/sourceWriterConfiguration.ts';
const jwt=(claims:object)=>'fixture.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.unsigned-test-only';
test('missing, public and wrong-project service configuration fail without exposing a credential',()=>{
 assert.throws(()=>sourceWriterConfiguration(undefined,undefined),/configuration/);
 assert.throws(()=>sourceWriterConfiguration('https://correct.supabase.co',jwt({role:'anon',ref:'correct'})),/server service/);
 assert.throws(()=>sourceWriterConfiguration('https://correct.supabase.co',jwt({role:'service_role',ref:'other'})),/different Supabase project/);
 assert.throws(()=>sourceWriterConfiguration('http://external.invalid','sb_secret_fixture'),/HTTPS/);
});
test('valid project and loopback shapes pass to provider authentication; opaque secrets are not falsely decoded',()=>{
 assert.equal(sourceWriterConfiguration('https://correct.supabase.co',jwt({role:'service_role',ref:'correct'})).url,'https://correct.supabase.co');
 assert.equal(sourceWriterConfiguration('http://127.0.0.1:55661',jwt({role:'service_role',ref:'local'})).url,'http://127.0.0.1:55661');
 assert.equal(sourceWriterConfiguration('https://correct.supabase.co','sb_secret_fixture').key,'sb_secret_fixture');
});
test('dedicated server credential takes precedence and cannot silently fall back when it is invalid',()=>{
 const correct=jwt({role:'service_role',ref:'correct'}),other=jwt({role:'service_role',ref:'other'}),url='https://correct.supabase.co';
 assert.equal(sourceWriterConfiguration(url,correct,other).key,correct);
 assert.throws(()=>sourceWriterConfiguration(url,other,correct),/different Supabase project/);
 assert.throws(()=>sourceWriterConfiguration(url,'',correct),/configuration/);
 assert.equal(sourceWriterConfiguration(url,undefined,correct).key,correct);
});
