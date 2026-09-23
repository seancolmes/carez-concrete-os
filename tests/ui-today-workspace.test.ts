import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const root=new URL('../',import.meta.url);
const page=readFileSync(new URL('app/page.tsx',root),'utf8');

const rendered=page;

test('Today implements the approved compact operating hierarchy',()=>{
  for(const text of ['Open Schedule',"Today&apos;s Work",'Attention','Operating Status','Ready to move','Field active','Hard holds','Customers owe','7-day cash','Next Operations','Business Pulse','Pipeline','Cash'])assert.match(rendered,new RegExp(text));
  for(const text of ['READY TO MOVE','FIELD ACTIVE','HARD HOLDS','CUSTOMERS OWE','7-DAY CASH'])assert.doesNotMatch(rendered,new RegExp(`>${text}<`));
  assert.equal((rendered.match(/Open Schedule/g)||[]).length,1);
  const header=rendered.slice(rendered.indexOf('<header'),rendered.indexOf('</header>'));
  const nextSection=rendered.slice(rendered.indexOf('id="today-next-heading"'),rendered.indexOf('id="business-pulse-heading"'));
  assert.doesNotMatch(header,/Open Schedule/);
  assert.doesNotMatch(nextSection,/Open Schedule/);
  assert.doesNotMatch(rendered,/Good morning|Good afternoon|Good evening|Nothing needs your attention right now|No urgent exceptions|href="\/leads"|href="\/takeoff"|href="\/estimates"|href="\/proposals"|href="\/billing"|href="\/cashflow"/);
  const work=rendered.indexOf('id="today-work-heading"');
  const attention=rendered.indexOf('id="today-attention-heading"');
  const next=rendered.indexOf('id="today-next-heading"');
  assert.ok(work>=0&&attention>work&&next>attention);
});
