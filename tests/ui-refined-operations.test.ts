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
  const project=read('app/projects/[id]/page.tsx');

  assert.match(metric,/data-slot=.carez-operating-metric/);
  assert.match(metric,/data-slot=.carez-operating-metric-strip/);
  assert.match(metric,/CarezVisualTone/);
  assert.doesNotMatch(metric,/#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(metric,/amber-|red-|green-|blue-/);
  assert.match(project,/from '@\/components\/carez\/operating-metric'/);
  assert.doesNotMatch(project,/from '@\/components\/carez'/);
});


test('authenticated Dashboard puts company status before actionable work',()=>{
  const page=read('app/page.tsx');
  const surface=read('components/today/TodaySurface.tsx');
  assert.match(page,/TodaySurface/);
  assert.match(surface,/<h1[^>]*>Dashboard<\/h1>/);
  assert.ok(surface.indexOf('Live company status')<surface.indexOf('Work requiring attention'));
  assert.match(surface,/DataGrid/);
  assert.match(surface,/<DialogSurface className="pt-dialog/);
  assert.doesNotMatch(surface,/OverlayDrawer/);
  assert.match(surface,/14-day pour \/ crew outlook/);
  assert.match(surface,/Clear for now/);
  assert.doesNotMatch(page,/\/leads\/|\/proposals\/|\/billing['"]|\/readiness['"]/);
});

test('Projects retains a dense expandable keyboard-accessible grid',()=>{
  const board=read('components/projects/JobsOperationsBoard.tsx');
  const page=read('app/projects/page.tsx');
  assert.match(board,/from '@fluentui\/react-components'/);
  assert.match(board,/<Table size="small"/);
  assert.match(board,/<Badge appearance="outline"/);
  assert.doesNotMatch(board,/CarezDataGrid|CarezStatus/);
  assert.match(board,/resolveOperationalState/);
  assert.match(board,/resolvePriority/);
  assert.match(board,/aria-selected=\{selectedRow\}/);
  assert.match(board,/onDoubleClick/);
  assert.match(board,/event\.key===['"]Enter['"]/);
  assert.match(board,/ChevronDown/);
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

test('Project command center preserves record, field, cost and commercial authority in separate tabs',()=>{
  const page=read('app/projects/[id]/page.tsx');
  for(const component of ['CarezRecordHeader','CarezOperatingMetricStrip','<Table size="small"','<Badge appearance="outline"','resolveProjectRecordStatus'])
    assert.match(page,new RegExp(component));
  assert.doesNotMatch(page,/<CarezStatus\b|<CarezDataGrid\b/);
  assert.match(page,/projectTabs=\['overview','commercial-baseline','scope-specs','activity'\]/);
  assert.match(page,/<CarezOperatingMetricStrip columns=\{5\}>/);
  const sections=['What Needs Your Attention','Field & Production','Commercial & Billing','Cost & Forecast'].map(value=>page.indexOf(value));
  assert.ok(sections.every(index=>index>=0));
  assert.deepEqual(sections,[...sections].sort((a,b)=>a-b));
  assert.match(page,/const budgetAvailable=Boolean\(budgetR\.data\)/);
  assert.match(page,/const billingAvailable=Boolean\(billingR\.data\)/);
  assert.match(page,/No authoritative budget snapshot/);
  assert.match(page,/Need Progress/);
  for(const href of ['/field?view=time-review','/field?view=production','/financials?tab=billing&view=billing'])
    assert.ok(page.includes(href),`missing consolidated destination ${href}`);
  assert.ok(!page.includes('/financials?tab=procurement&view=procurement'),'project commands must not advertise unavailable procurement');
});

test('Projects keeps blocked work visible without changing the governing hold',async()=>{
  const {projectGoverningHold,projectOperationalState}=await import(new URL('lib/projects/projectReadiness.ts',root).href);
  const agreement=projectGoverningHold('job 1',{award_setup_applies:true,job_ready:false,readiness_reason:'Accepted agreement record is missing.'},{blocked_operation_count:0,ready_operation_count:0});
  assert.equal(agreement.hardHold,true);
  assert.equal(agreement.reason,'Accepted agreement record is missing.');
  assert.equal(agreement.href,'/job-setup/job%201');
  const setupClear={award_setup_applies:true,job_ready:true};
  const fullyBlocked=projectGoverningHold('job-2',setupClear,{blocked_operation_count:2,ready_operation_count:0});
  assert.equal(fullyBlocked.hardHold,true);
  assert.equal(fullyBlocked.blockedAttention,true);
  assert.equal(fullyBlocked.activeOperations,2);
  assert.equal(fullyBlocked.href,'/field?view=work-packages');
  assert.equal(projectOperationalState('active',fullyBlocked,0),'hold');
  const mixed=projectGoverningHold('job-3',setupClear,{blocked_operation_count:1,ready_operation_count:1});
  assert.equal(mixed.hardHold,false,'ready work must not change the hard-hold formula');
  assert.equal(mixed.blockedAttention,true,'blocked work must still need attention');
  assert.equal(mixed.reason,null);
  assert.match(mixed.blockedReason||'',/1 active operation is blocked by readiness checks.*1 is ready/);
  assert.equal(mixed.blockedHref,'/field?view=work-packages');
  assert.equal(mixed.activeOperations,2,'only active ready and blocked operations are counted');
  assert.equal(projectOperationalState('active',mixed,0),'ready');
  assert.equal(projectOperationalState('active',mixed,1),'planning','an actual in-progress operation has a distinct presentation');
  const fullyReady=projectGoverningHold('job-4',setupClear,{blocked_operation_count:0,ready_operation_count:1});
  assert.equal(fullyReady.hardHold,false);
  assert.equal(fullyReady.blockedAttention,false);
  assert.equal(fullyReady.blockedReason,null);
  assert.equal(fullyReady.activeOperations,1);
  assert.equal(projectOperationalState('active',fullyReady,0),'ready');
});

test('Projects derives active counts from readiness and in-progress state from recorded operation status',()=>{
  const page=read('app/projects/page.tsx');
  const overview=read('app/projects/[id]/page.tsx');
  const board=read('components/projects/JobsOperationsBoard.tsx');
  assert.doesNotMatch(page,/wr\.open_operations/);
  assert.match(page,/openOps=hold\.activeOperations/);
  assert.match(page,/operation_status','in_progress'/);
  assert.match(page,/hold\.blockedAttention/);
  assert.match(page,/holds:activeRows\.filter\(row=>row\.hardHold\)/);
  assert.match(board,/row\.blockedOperations>0/);
  assert.match(board,/row\.blockedReason/);
  assert.match(overview,/hold\.blockedReason&&hold\.blockedHref/);
});

test('Project commercial display uses billing-view columns and distinguishes an absent baseline',()=>{
  const page=read('app/projects/[id]/page.tsx');
  assert.match(page,/bill\.billed_amount/);
  assert.match(page,/bill\.collected_amount/);
  assert.match(page,/acceptedContract=authorizedContractR\.error\?'Unavailable':authorizedContractR\.data\?recordedMoney/);
  assert.doesNotMatch(page,/bill\.authorized_contract|bill\.billed_contract|bill\.cash_collected/);
});

test('current workspaces preserve actionable empty states and distinct numeric authority',()=>{
  const overview=read('components/today/TodaySurface.tsx');
  const projects=read('components/projects/JobsOperationsBoard.tsx');
  const project=read('app/projects/[id]/page.tsx');
  assert.match(overview,/Clear for now/);
  assert.match(overview,/No concrete scheduled in the next 7 days/);
  assert.match(project,/No authoritative budget snapshot/);
  assert.match(projects,/No authoritative budget snapshot/);
  assert.match(projects,/Billing summary unavailable/);
  assert.match(project,/total_direct_cost/);
  assert.match(project,/total_sell/);
});

test('current workspaces keep semantic severity and keyboard interaction',()=>{
  const overview=read('components/today/TodaySurface.tsx');
  const projects=read('components/projects/JobsOperationsBoard.tsx');
  assert.match(overview,/color=\{item\.tone==='danger'\?'danger'/);
  assert.match(overview,/focus-visible:ring-2/);
  assert.match(projects,/event\.currentTarget!==event\.target/);
  assert.match(projects,/aria-expanded=\{selectedRow\}/);
  assert.match(projects,/event\.preventDefault\(\)/);
});

test('workspace screens keep the accepted component system',()=>{
  const sources=[read('components/today/TodaySurface.tsx'),read('components/projects/JobsOperationsBoard.tsx'),read('app/projects/[id]/page.tsx')].join('\n');
  assert.match(sources,/from '@fluentui\/react-components'/);
  assert.match(sources,/from '@fluentui\/react-icons'/);
  assert.doesNotMatch(sources,/from ['"]@\/components\/ui(?:\/|['"])/);
  assert.doesNotMatch(sources,/from ['"](?:@base-ui\/|@radix-ui\/|lucide-react)/);
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
