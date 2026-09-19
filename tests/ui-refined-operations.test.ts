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


test('Projects uses the canonical grid, status, and Inspector foundations',()=>{
  const board=read('components/projects/JobsOperationsBoard.tsx');
  const page=read('app/projects/page.tsx');

  assert.match(board,/CarezDataGrid/);
  assert.match(board,/CarezInspector/);
  assert.match(board,/CarezStatus/);
  assert.match(board,/resolveOperationalState/);
  assert.match(board,/resolvePriority/);
  assert.match(board,/aria-selected|selected=\{selectedRow\}/);
  assert.match(board,/event\.key===['"]Enter['"]/);
  assert.match(board,/Open Project/);
  assert.match(board,/matchMedia\(['"]\(min-width: 1536px\)['"]\)/);
  assert.match(board,/Sheet/);
  assert.doesNotMatch(board,/function ToneBadge/);
  assert.doesNotMatch(board,/amber-|red-|green-|blue-/);

  assert.match(page,/href="\/schedule"/);
  assert.match(page,/New direct job/);
  assert.doesNotMatch(page,/CarezProjectContextBar/);
});

test('Projects selection does not broaden authoritative project context',async()=>{
  const navigation=await import(new URL('lib/ui/navigation.ts',root).href);
  assert.equal(navigation.resolveProjectRoute('/'),null);
  assert.equal(navigation.resolveProjectRoute('/projects'),null);
  assert.deepEqual(
    navigation.resolveProjectRoute('/projects/project-1'),
    {projectId:'project-1',workspace:'project-overview',workspaceLabel:'Overview'},
  );
});


test('Project Overview follows the approved operating-record hierarchy',()=>{
  const page=read('app/projects/[id]/page.tsx');

  assert.match(page,/CarezRecordHeader/);
  assert.match(page,/CarezOperatingMetricStrip/);
  assert.match(page,/CarezStatus/);
  assert.match(page,/CarezFeedback|CarezEmptyState/);
  assert.match(page,/CarezDataGrid/);
  assert.match(page,/resolveProjectRecordStatus/);

  const attention=page.indexOf('What Needs Your Attention');
  const operating=page.indexOf('Operating Position');
  const field=page.indexOf('Field & Production');
  const cost=page.indexOf('Cost & Forecast');
  const commercial=page.indexOf('Commercial & Billing');
  const next=page.indexOf('Next Job Action');

  assert.ok(attention>=0&&operating>attention);
  assert.ok(field>operating);
  assert.ok(cost>field);
  assert.ok(commercial>cost);
  assert.ok(next>commercial);

  assert.match(page,/order-3[^\"]*lg:order-6/);
  assert.match(page,/order-4[^\"]*lg:order-3/);
  assert.match(page,/const budgetAvailable=Boolean\(budgetR\.data\)/);
  assert.match(page,/const billingAvailable=Boolean\(billingR\.data\)/);
  assert.match(page,/No authoritative budget snapshot|Approve an estimate to establish the baseline/);
  assert.match(page,/Need Progress/);

  for(const href of ['/field/review','/pour-control','/procurement','/forecast','/billing','/change-orders']){
    assert.ok(page.includes('href="'+href+'"'),'missing '+href+' action');
  }

  assert.doesNotMatch(page,/function Metric/);
  assert.doesNotMatch(page,/amber-|red-|green-|blue-/);
});


test('reference slice preserves unavailable-state language and route boundaries',()=>{
  const today=read('app/page.tsx');
  const projects=read('components/projects/JobsOperationsBoard.tsx');
  const projectsPage=read('app/projects/page.tsx');
  const overview=read('app/projects/[id]/page.tsx');

  assert.match(today,/No authoritative budget snapshot/);
  assert.match(overview,/Need Progress/);
  assert.match(projects,/does not fabricate them/);
  assert.match(projectsPage,/budgetAvailable:Boolean\(b\.project_id\)/);
  assert.match(projectsPage,/billingAvailable:Boolean\(bill\.project_id\)/);

  assert.doesNotMatch(today,/CarezProjectContextBar/);
  assert.doesNotMatch(projects,/CarezProjectContextBar/);
  assert.match(overview,/CarezRecordHeader/);
});

test('reference slice keeps explicit pointer-independent project opening',()=>{
  const projects=read('components/projects/JobsOperationsBoard.tsx');

  assert.match(projects,/event\.key===['"]Enter['"]/);
  assert.match(projects,/Open Project/);
  assert.match(projects,/onDoubleClick/);
});

test('reference slice stays on the accepted Carez component system',()=>{
  const sources=[
    read('app/page.tsx'),
    read('components/projects/JobsOperationsBoard.tsx'),
    read('app/projects/[id]/page.tsx'),
  ].join('\n');

  assert.doesNotMatch(sources,/from ['"]@mui\//);
  assert.doesNotMatch(sources,/from ['"]antd/);
  assert.doesNotMatch(sources,/from ['"]chakra-ui/);
  assert.doesNotMatch(sources,/#[0-9a-fA-F]{3,8}\b/);
});


test('reference slice preserves semantic severity and keyboard interaction boundaries',()=>{
  const today=read('app/page.tsx');
  const projects=read('components/projects/JobsOperationsBoard.tsx');

  assert.match(today,/const attentionStatusTone=attention\.some/);
  assert.match(today,/resolveOperationalState\(row\.state\)/);
  assert.match(projects,/event\.currentTarget===event\.target/);
  assert.match(projects,/aria-label=\{'Job inspector: '\+selected\.name\}/);
});


test('Projects supports keyboard selection without hijacking child controls',()=>{
  const projects=read('components/projects/JobsOperationsBoard.tsx');

  assert.match(projects,/event\.key===['"] ['"]/);
  assert.match(projects,/event\.preventDefault\(\);setSelectedId\(row\.id\)/);
  assert.match(projects,/Space selects; Enter or double-click opens the project/);
});
