import test from 'node:test';
import assert from 'node:assert/strict';
import {proposalSnapshotRead} from '../lib/estimating/proposalSnapshotReads.ts';

test('Proposal snapshot reads preserve populated, empty and recorded zero',()=>{
 for(const data of [[{id:'scope'}],[],{selected_sell_price:0},null])assert.deepEqual(proposalSnapshotRead('fixture',{data,error:null}),{data,unavailable:false});
});
test('failed scope, customer, sender and financial reads prevent publication',()=>{
 for(const label of ['Scope','Customer','Company invoice profile','Estimate financial summary'])assert.throws(()=>proposalSnapshotRead(label,{data:null,error:{code:'PGRST205'}}),/unavailable/);
});
test('only deliberately excluded absent Intelligence relation may be unavailable',()=>{
 assert.deepEqual(proposalSnapshotRead('Value options',{data:null,error:{code:'PGRST205'}},true),{data:null,unavailable:true});
 for(const code of ['42501','TIMEOUT','PGRST116'])assert.throws(()=>proposalSnapshotRead('Value options',{data:null,error:{code}},true),/unavailable/);
});
