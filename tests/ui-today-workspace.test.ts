import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const root=new URL('../',import.meta.url);
const page=readFileSync(new URL('app/page.tsx',root),'utf8');
const surface=readFileSync(new URL('components/today/TodaySurface.tsx',root),'utf8');
const pulse=readFileSync(new URL('components/today/TodayBusinessPulse.tsx',root),'utf8');

test('authenticated Overview renders the consolidated Command Center',()=>{
  assert.match(page,/TodaySurface/);
  for(const text of ['Operating summary','Action inbox','Logistics timeline'])
    assert.match(surface,new RegExp(text));
  assert.match(surface,/<TodayBusinessPulse/);
  for(const text of ['Business pulse','Pipeline','Cash'])assert.match(pulse,new RegExp(text));
  assert.match(pulse,/<TabList selectedValue=\{view\}/);
  assert.ok(surface.indexOf('Operating summary')<surface.indexOf('Action inbox'));
  assert.match(surface,/lg:grid-cols-12 lg:overflow-hidden/);
  assert.match(surface,/MetricBentoTile/);
  assert.match(surface,/Zero inbox/);
  assert.match(surface,/\/field\?view=schedule/);
  assert.doesNotMatch(page,/\/leads\/|\/proposals\/|href:'\/billing'|href:'\/cashflow'/);
});
