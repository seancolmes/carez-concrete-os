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


test('authenticated Overview delegates to the Command Center with summary before the inbox',()=>{
  const page=read('app/page.tsx');
  const surface=read('components/today/TodaySurface.tsx');
  assert.match(page,/TodaySurface/);
  assert.match(surface,/grid-cols-12 gap-6/);
  assert.match(surface,/MetricBentoTile/);
  assert.ok(surface.indexOf('Operating summary')<surface.indexOf('Action inbox'));
  assert.match(surface,/Logistics timeline/);
  assert.match(surface,/Business pulse/);
  assert.match(surface,/Zero inbox/);
  assert.doesNotMatch(page,/\/leads\/|\/proposals\/|\/billing['"]|\/readiness['"]/);
});

test('Projects retains a dense expandable keyboard-accessible grid',()=>{
  const board=read('components/projects/JobsOperationsBoard.tsx');
  const page=read('app/projects/page.tsx');
  assert.match(board,/CarezDataGrid/);
  assert.match(board,/CarezStatus/);
  assert.match(board,/resolveOperationalState/);
  assert.match(board,/resolvePriority/);
  assert.match(board,/selected=\{selectedRow\}/);
  assert.match(board,/onDoubleClick/);
  assert.match(board,/event\.key===['"]Enter['"]/);
  assert.match(board,/ChevronDown/);
  assert.match(board,/hover:bg-\[#EFF2F0\] dark:hover:bg-\[#1E2123\]/);
  assert.match(board,/Open Project Workspace/);
  assert.match(page,/href="\/field\?view=schedule"/);
  assert.match(page,/New direct job/);
});

test('Projects selection does not broaden authoritative project context',async()=>{
  const navigation=await import(new URL('lib/ui/navigation.ts',root).href);
  assert.equal(navigation.resolveProjectRoute('/'),null);
  assert.equal(navigation.resolveProjectRoute('/projects'),null);
  assert.deepEqual(navigation.resolveProjectRoute('/projects/project-1'),{projectId:'project-1',workspace:'project-overview',workspaceLabel:'Overview'});
});

test('Project Overview preserves record, operating, field, cost and commercial authority',()=>{
  const page=read('app/projects/[id]/page.tsx');
  for(const component of ['CarezRecordHeader','CarezOperatingMetricStrip','CarezStatus','CarezDataGrid','resolveProjectRecordStatus'])
    assert.match(page,new RegExp(component));
  const sections=['What Needs Your Attention','Operating Position','Field & Production','Cost & Forecast','Commercial & Billing'].map(value=>page.indexOf(value));
  assert.ok(sections.every(index=>index>=0));
  assert.deepEqual(sections,[...sections].sort((a,b)=>a-b));
  assert.match(page,/const budgetAvailable=Boolean\(budgetR\.data\)/);
  assert.match(page,/const billingAvailable=Boolean\(billingR\.data\)/);
  assert.match(page,/No authoritative budget snapshot/);
  assert.match(page,/Need Progress/);
  for(const href of ['/field?view=time-review','/field?view=production','/financials?tab=procurement&view=procurement','/financials?tab=billing&view=billing'])
    assert.ok(page.includes(href),`missing consolidated destination ${href}`);
});

test('current workspaces preserve actionable empty states and distinct numeric authority',()=>{
  const overview=read('components/today/TodaySurface.tsx');
  const projects=read('components/projects/JobsOperationsBoard.tsx');
  const project=read('app/projects/[id]/page.tsx');
  assert.match(overview,/Zero inbox/);
  assert.match(overview,/No field operations are scheduled/);
  assert.match(project,/No authoritative budget snapshot/);
  assert.match(projects,/No authoritative budget snapshot/);
  assert.match(projects,/Billing summary unavailable/);
  assert.match(project,/total_direct_cost/);
  assert.match(project,/total_sell/);
});

test('current workspaces keep semantic severity and keyboard interaction',()=>{
  const overview=read('components/today/TodaySurface.tsx');
  const projects=read('components/projects/JobsOperationsBoard.tsx');
  assert.match(overview,/urgent\?'border-l-\[#B84558\]/);
  assert.match(overview,/motion-safe:animate-pulse/);
  assert.match(projects,/event\.currentTarget!==event\.target/);
  assert.match(projects,/aria-expanded=\{selectedRow\}/);
  assert.match(projects,/event\.preventDefault\(\)/);
});

test('workspace screens keep the accepted component system',()=>{
  const sources=[read('components/today/TodaySurface.tsx'),read('components/projects/JobsOperationsBoard.tsx'),read('app/projects/[id]/page.tsx')].join('\n');
  assert.doesNotMatch(sources,/from ['"]@mui\//);
  assert.doesNotMatch(sources,/from ['"]antd/);
  assert.doesNotMatch(sources,/from ['"]chakra-ui/);
});

test('consolidated workspace links do not reopen retired preconstruction or field routes',async()=>{
  const {opportunityHref,estimateHref,auditHref}=await import(new URL('components/opportunities/opportunityHref.ts',root).href);
  assert.equal(opportunityHref('lead 1'),'/opportunities?lead=lead%201&tab=scope');
  assert.equal(estimateHref('estimate 1','proposal'),'/opportunities?estimate=estimate%201&tab=proposal');
  assert.equal(auditHref('estimate 1'),'/opportunities?view=audit&estimate=estimate%201');
  const liveViews=['WorksheetView','ProposalView','ScopeView','TakeoffView','AuditView','IntakeView','BidIntelligenceView'].map(name=>read(`components/opportunities/views/${name}.tsx`)).join('\n');
  assert.doesNotMatch(liveViews,/href=(?:"|\{`)(?:\/leads|\/estimates|\/proposals)/);
  const activePages=[read('app/page.tsx'),read('app/projects/page.tsx'),read('app/projects/[id]/page.tsx'),read('components/today/TodaySurface.tsx')].join('\n');
  assert.doesNotMatch(activePages,/href=(?:"|\{`|:')\/(?:schedule|readiness|production|billing|procurement|cashflow|field\/review|leads|estimates|proposals)(?:["`']|\/)/);
});
