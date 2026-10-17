import assert from 'node:assert/strict';
import test from 'node:test';
import {scheduleWindow,inScheduleWindow,staffingRisk,type ScheduleScale} from '../lib/ui/schedule-window.ts';
const days=Array.from({length:90},(_,index)=>{const date=new Date('2026-10-16T12:00:00Z');date.setUTCDate(date.getUTCDate()+index);return {date:date.toISOString().slice(0,10),label:date.toISOString().slice(0,10)};});

test('Day covers the visible fourteen days and reaches every later loaded day',()=>{
  const first=scheduleWindow(days,'day',0);
  assert.equal(first.start,'2026-10-16');assert.equal(first.end,'2026-10-29');assert.equal(first.label,'Oct 16 – Oct 29, 2026');
  assert.equal(first.hasPrevious,false);assert.equal(first.hasNext,true);
  const next=scheduleWindow(days,'day',1);
  assert.equal(next.start,'2026-10-30');assert.equal(next.end,'2026-11-12');assert.equal(next.hasPrevious,true);
  const visited=Array.from({length:first.pageCount},(_,page)=>scheduleWindow(days,'day',page).periods).flat().map(period=>period.start);
  assert.deepEqual(visited,days.map(day=>day.date));
  const last=scheduleWindow(days,'day',99);assert.equal(last.end,'2027-01-13');assert.equal(last.hasNext,false);
  assert.equal(scheduleWindow(days,'day',5).label,'Dec 25, 2026 – Jan 7, 2027');
});
test('Week and Month windows retain grouped periods and clamp to loaded coverage',()=>{
  for(const scale of ['week','month'] as ScheduleScale[]){
    const first=scheduleWindow(days,scale,0),last=scheduleWindow(days,scale,99);
    assert.equal(first.start,days[0].date);assert.equal(last.end,days.at(-1)!.date);
    assert.equal(first.hasNext,true);assert.equal(last.hasNext,false);
  }
  assert.equal(scheduleWindow(days,'week',0).periods[0].start,'2026-10-12');
  assert.equal(scheduleWindow(days,'month',0).periods.length,3);
});
test('window counts include only represented records, preserving recorded zero and untouched inputs',()=>{
  const items=[{id:'visible',scheduleDate:'2026-10-16',quantity:0},{id:'later',scheduleDate:'2026-12-15',quantity:40}];
  const original=structuredClone(items);
  assert.deepEqual(inScheduleWindow(items,scheduleWindow(days,'day',0)),[items[0]]);
  assert.deepEqual(inScheduleWindow(items,scheduleWindow(days,'day',4)),[items[1]]);
  assert.deepEqual(items,original);
});
test('empty loaded dates remain explicit and staffing text does not replace schedule status',()=>{
  const empty=scheduleWindow([],'day',0);
  assert.equal(empty.label,'No loaded dates');assert.equal(empty.hasNext,false);assert.equal(empty.hasPrevious,false);
  assert.deepEqual(inScheduleWindow([{scheduleDate:'2026-10-16'}],empty),[]);
  assert.equal(staffingRisk(0),null);assert.equal(staffingRisk(1),'1 crew position unassigned.');assert.equal(staffingRisk(2),'2 crew positions unassigned.');
});
