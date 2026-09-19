import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';

const root=new URL('../',import.meta.url);
const operationsUrl=new URL('lib/ui/operations.ts',root);
const read=(path:string)=>readFileSync(new URL(path,root),'utf8');

test('operational presentation helpers exist and keep concepts distinct',async()=>{
  assert.equal(existsSync(operationsUrl),true,'lib/ui/operations.ts must exist');
  const ui=await import(operationsUrl.href);

  assert.deepEqual(ui.resolveOperationalState('ready'),{kind:'ready',label:'Ready',tone:'success'});
  assert.deepEqual(ui.resolveOperationalState('hold'),{kind:'hold',label:'Hold',tone:'blocked'});
  assert.deepEqual(ui.resolveOperationalState('planning'),{kind:'planning',label:'In progress',tone:'info'});
  assert.deepEqual(ui.resolveOperationalState('setup'),{kind:'setup',label:'Waiting',tone:'warning'});
  assert.deepEqual(ui.resolveOperationalState('completed'),{kind:'completed',label:'Complete',tone:'success'});
  assert.equal(ui.resolveOperationalState('mystery'),null);

  assert.deepEqual(ui.resolvePriority('critical'),{kind:'critical',label:'Critical',tone:'error'});
  assert.deepEqual(ui.resolvePriority('high'),{kind:'high',label:'High',tone:'warning'});
  assert.deepEqual(ui.resolvePriority('normal'),{kind:'normal',label:'Normal',tone:'neutral'});
  assert.equal(ui.resolvePriority('mystery'),null);

  assert.deepEqual(ui.resolveProjectRecordStatus('active'),{kind:'active',label:'Active',tone:'info'});
  assert.deepEqual(ui.resolveProjectRecordStatus('on_hold'),{kind:'on_hold',label:'On hold',tone:'blocked'});
  assert.deepEqual(ui.resolveProjectRecordStatus('planning'),{kind:'planning',label:'Planning',tone:'neutral'});
  assert.deepEqual(ui.resolveProjectRecordStatus('completed'),{kind:'completed',label:'Complete',tone:'success'});
  assert.equal(ui.resolveProjectRecordStatus('mystery'),null);
});

test('operating metric composition is source-owned and token based',()=>{
  const metric=read('components/carez/operating-metric.tsx');
  const index=read('components/carez/index.ts');

  assert.match(metric,/data-slot=.carez-operating-metric/);
  assert.match(metric,/data-slot=.carez-operating-metric-strip/);
  assert.match(metric,/CarezVisualTone/);
  assert.doesNotMatch(metric,/#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(metric,/amber-|red-|green-|blue-/);
  assert.match(index,/operating-metric/);
});


test('Today is exception-first and uses shared operational components',()=>{
  const page=read('app/page.tsx');

  assert.match(page,/CarezOperatingMetricStrip/);
  assert.match(page,/CarezOperatingMetric/);
  assert.match(page,/CarezStatus/);
  assert.match(page,/CarezDataGrid/);
  assert.match(page,/CarezEmptyState|CarezFeedback/);

  const attention=page.indexOf('Management attention');
  const metrics=page.indexOf("Today's operating position");
  const production=page.indexOf('Scheduled production');
  const moves=page.indexOf('What moves next');

  assert.ok(attention>=0&&metrics>attention,'Management Attention must precede Operating Position');
  assert.ok(production>metrics,'Scheduled Production must follow Operating Position');
  assert.ok(moves>production,'What Moves Next must follow Scheduled Production');

  assert.match(page,/href="\/projects"/);
  assert.match(page,/href="\/schedule"/);
  assert.match(page,/href="\/cashflow"/);
  assert.match(page,/href="\/billing"/);
  assert.doesNotMatch(page,/function StatusBadge/);
  assert.doesNotMatch(page,/function OperatingMetric/);
  assert.doesNotMatch(page,/amber-|red-|green-|blue-/);
});
