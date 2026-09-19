import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';
import {resolveProjectRoute} from '../lib/ui/navigation.ts';

const root=new URL('../',import.meta.url);
const readMaybe=(path:string)=>{
  const url=new URL(path,root);
  return existsSync(url)?readFileSync(url,'utf8'):'';
};

test('shared Carez state/workspace components are exported from one source-owned package',()=>{
  const index=readMaybe('components/carez/index.ts');
  const state=readMaybe('components/carez/state.tsx');
  const record=readMaybe('components/carez/record-header.tsx');
  const inspector=readMaybe('components/carez/inspector.tsx');
  const projectContext=readMaybe('components/carez/project-context.tsx');

  assert.match(index,/state/);
  assert.match(index,/record-header/);
  assert.match(index,/inspector/);
  assert.match(index,/project-context/);

  for(const [name,source] of [['state',state],['record header',record],['inspector',inspector],['project context',projectContext]]){
    assert.ok(source.length>0,`${name} source must exist`);
    assert.doesNotMatch(source,/#[0-9a-fA-F]{3,8}\b/,`${name} must use semantic tokens instead of hard-coded colors`);
  }

  assert.match(state,/CarezStatus/);
  assert.match(state,/CarezAuthorityState/);
  assert.match(state,/CarezSaveState/);
  assert.match(state,/CarezFeedback/);
  assert.match(state,/CarezProvenance/);
  assert.match(state,/aria-live/);
  assert.match(state,/role=.alert.|role=\{[^}]*alert/);

  assert.match(record,/data-slot=.carez-record-header/);
  assert.match(record,/actions/);
  assert.match(record,/status/);

  assert.match(inspector,/data-slot=.carez-inspector/);
  assert.match(inspector,/CarezInspectorHeader/);
  assert.match(inspector,/CarezInspectorSection/);
  assert.match(inspector,/CarezInspectorFooter/);
});

test('shared Data Grid exposes selected, sortable, loading, empty, and error semantics',()=>{
  const grid=readMaybe('components/carez/data-grid.tsx');
  assert.match(grid,/aria-selected/);
  assert.match(grid,/aria-sort/);
  assert.match(grid,/error/);
  assert.match(grid,/CarezLoadingSkeleton/);
  assert.match(grid,/CarezEmptyState/);
  assert.match(grid,/var\(--density-row-height\)/);
});

test('semantic number field exposes presentation metadata without client calculation authority',()=>{
  const fields=readMaybe('components/carez/fields.tsx');
  const start=fields.indexOf('type NumberInputProps');
  const end=fields.indexOf('export type CarezDateTimeMode');
  const numberField=start>=0&&end>start?fields.slice(start,end):fields;
  assert.match(numberField,/kind\?/);
  assert.match(numberField,/resolveNumericKind/);
  assert.match(numberField,/data-numeric-kind/);
  assert.match(numberField,/aria-invalid/);
  assert.doesNotMatch(numberField,/toFixed\(/);
  assert.doesNotMatch(numberField,/Math\.round\(/);
});
test('toolbar foundation prevents uncontrolled wrapping and remains task-local',()=>{
  const workspace=readMaybe('components/carez/workspace.tsx');
  assert.match(workspace,/data-slot=.carez-toolbar/);
  assert.match(workspace,/flex-nowrap/);
  assert.match(workspace,/overflow-x-auto|overflow-hidden/);
});

test('project context remains limited to the authoritative Issue #71 route boundary after extraction',()=>{
  assert.ok(readMaybe('components/carez/project-context.tsx').length>0);
  assert.deepEqual(resolveProjectRoute('/projects/project-1'),{projectId:'project-1',workspace:'project-overview',workspaceLabel:'Overview'});
  assert.deepEqual(resolveProjectRoute('/job-setup/project-1'),{projectId:'project-1',workspace:'job-setup',workspaceLabel:'Job setup'});
  assert.equal(resolveProjectRoute('/schedule'),null);
  assert.equal(resolveProjectRoute('/takeoff/set-1'),null);
  assert.equal(resolveProjectRoute('/estimates/estimate-1'),null);
});

test('Project Overview adopts only the shared record header in this slice',()=>{
  const page=readMaybe('app/projects/[id]/page.tsx');
  assert.match(page,/CarezRecordHeader/);
  assert.match(page,/Review Crew Time/);
  assert.match(page,/Plan Pour/);
  assert.match(page,/Order Materials/);
  assert.match(page,/What Needs Your Attention/);
});
