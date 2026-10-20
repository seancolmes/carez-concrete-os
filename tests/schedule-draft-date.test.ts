import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleDraftDate} from '../lib/field/scheduleDraftDate.ts';

test('choosing tomorrow replaces the company-day draft before opening Schedule work',()=>{
 const companyDate='2026-10-19';
 assert.equal(scheduleDraftDate(companyDate,{type:'select-day',date:'2026-10-20'}),'2026-10-20');
});
test('selection keeps ISO calendar dates across month/year changes without clock conversion',()=>{
 assert.equal(scheduleDraftDate('2026-12-31',{type:'select-day',date:'2027-01-01'}),'2027-01-01');
 assert.equal(scheduleDraftDate('',{type:'select-day',date:'2026-10-20'}),'2026-10-20');
 assert.equal(scheduleDraftDate('2026-10-20',{type:'select-day',date:'Tue Oct 21'}),'2026-10-20');
});
test('explicit form edits remain editable and blank is not replaced with today',()=>{
 const selected=scheduleDraftDate('2026-10-19',{type:'select-day',date:'2026-10-20'});
 assert.equal(scheduleDraftDate(selected,{type:'edit-date',date:'2026-10-22'}),'2026-10-22');
 assert.equal(scheduleDraftDate(selected,{type:'edit-date',date:''}),'');
});
