import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_DESKTOP_PINNED_DESTINATIONS,
  NAVIGATION_DESTINATIONS,
  NAVIGATION_COMMAND_GROUPS,
  WORKSPACE_PRESENTATION_SURFACES,
  getWorkspacePresentationForDestination,
  buildProjectSwitchHref,
  getRoleDefaultDestinationIds,
  movePinnedDestination,
  navigationPreferenceStorageKey,
  normalizeNavigationPreference,
  normalizePinnedDestinationIds,
  normalizeRecentDestinationIds,
  normalizeRecentProjectIds,
  prependRecentId,
  resetNavigationPreference,
  resolveActiveDestination,
  resolveProjectRoute,
  togglePinnedDestination,
} from '../lib/ui/navigation.ts';

test('every registered destination remains represented by one command group',()=>{
  const groupedIds=NAVIGATION_COMMAND_GROUPS.flatMap(group=>group.destinationIds);
  assert.equal(new Set(groupedIds).size,groupedIds.length);
  assert.deepEqual([...groupedIds].sort(),NAVIGATION_DESTINATIONS.map(destination=>destination.id).sort());
});

test('Estimate review keeps the compatibility route with Review product language',()=>{
  const destination=NAVIGATION_DESTINATIONS.find(item=>item.id==='estimate-audit');
  assert.equal(destination?.href,'/estimates/audit');
  assert.equal(destination?.label,'Estimate review');
  assert.equal(destination?.hint,'Commercial recap and release review');
});

test('seven-surface presentation classifies every destination once with canonical surface routes',()=>{
  assert.deepEqual(WORKSPACE_PRESENTATION_SURFACES.map(surface=>surface.label),['Today','Preconstruction','Projects','Field','Production','Finance','System']);
  assert.deepEqual(WORKSPACE_PRESENTATION_SURFACES.map(surface=>surface.href),['/','/leads','/projects','/field','/production','/cashflow','/settings']);
  const destinationIds=WORKSPACE_PRESENTATION_SURFACES.flatMap(surface=>surface.sections.flatMap(section=>section.destinations.map(destination=>destination.id)));
  assert.equal(new Set(destinationIds).size,destinationIds.length);
  assert.deepEqual([...destinationIds].sort(),NAVIGATION_DESTINATIONS.map(destination=>destination.id).sort());
  for(const destination of NAVIGATION_DESTINATIONS){
    assert.ok(getWorkspacePresentationForDestination(destination.id));
    assert.ok(getWorkspacePresentationForDestination(destination.id)?.surface.href);
  }
});

test('role defaults expose 3-5 stable destinations with safe unknown fallback',()=>{
  for(const role of ['owner','admin','estimator','project manager','foreman','superintendent','accounting','finance']){
    const ids=getRoleDefaultDestinationIds(role);
    assert.ok(ids.length>=3);
    assert.ok(ids.length<=MAX_DESKTOP_PINNED_DESTINATIONS);
    assert.equal(new Set(ids).size,ids.length);
    for(const id of ids)assert.ok(NAVIGATION_DESTINATIONS.some(destination=>destination.id===id));
  }
  assert.deepEqual(getRoleDefaultDestinationIds('unknown-role'),['today','projects','documents']);
  assert.deepEqual(getRoleDefaultDestinationIds('project_manager'),getRoleDefaultDestinationIds('project manager'));
});

test('personalization normalization rejects duplicates, removed ids, invalid versions, and more than five pins',()=>{
  const normalized=normalizePinnedDestinationIds(['takeoff','takeoff','removed','projects','billing','documents','field','estimates']);
  assert.deepEqual(normalized,['takeoff','projects','billing','documents','field']);
  assert.equal(normalized.length,MAX_DESKTOP_PINNED_DESTINATIONS);
  assert.deepEqual(
    normalizeNavigationPreference({version:1,pinnedIds:['removed','takeoff']},'owner').pinnedIds,
    ['takeoff'],
  );
  assert.deepEqual(
    normalizeNavigationPreference({version:999,pinnedIds:['takeoff']},'estimator'),
    resetNavigationPreference('estimator'),
  );
  assert.deepEqual(
    normalizeNavigationPreference({version:1,pinnedIds:['removed']},'finance'),
    resetNavigationPreference('finance'),
  );
});

test('pin, unpin, reorder, and reset helpers remain bounded and deterministic',()=>{
  assert.deepEqual(togglePinnedDestination(['today','projects'],'documents'),['today','projects','documents']);
  assert.deepEqual(togglePinnedDestination(['today','projects'],'projects'),['today']);
  assert.deepEqual(togglePinnedDestination(['today'],'today'),['today']);
  assert.deepEqual(
    togglePinnedDestination(['today','projects','documents','billing','field'],'takeoff'),
    ['today','projects','documents','billing','field'],
  );
  assert.deepEqual(movePinnedDestination(['today','projects','documents'],'projects',-1),['projects','today','documents']);
  assert.deepEqual(movePinnedDestination(['today','projects','documents'],'today',-1),['today','projects','documents']);
  assert.deepEqual(resetNavigationPreference('estimator').pinnedIds,getRoleDefaultDestinationIds('estimator'));
});

test('active destination resolution prefers the most specific nested route',()=>{
  assert.equal(resolveActiveDestination('/')?.id,'today');
  assert.equal(resolveActiveDestination('/estimates/audit/review')?.id,'estimate-audit');
  assert.equal(resolveActiveDestination('/takeoff/assemblies/library')?.id,'assemblies');
  assert.equal(resolveActiveDestination('/banking/reconcile/session')?.id,'reconcile');
  assert.equal(resolveActiveDestination('/not-a-carez-route'),null);
});

test('project route detection accepts one authoritative id segment only',()=>{
  assert.deepEqual(resolveProjectRoute('/projects/abc-123'),{projectId:'abc-123',workspace:'project-overview',workspaceLabel:'Overview'});
  assert.deepEqual(resolveProjectRoute('/job-setup/4d2b5f2e-1234'),{projectId:'4d2b5f2e-1234',workspace:'job-setup',workspaceLabel:'Job setup'});
  assert.equal(resolveProjectRoute('/projects'),null);
  assert.equal(resolveProjectRoute('/projects/abc/extra'),null);
  assert.equal(resolveProjectRoute('/schedule'),null);
  assert.equal(resolveProjectRoute('/takeoff/set-1'),null);
});

test('project switching preserves only proven route mappings and otherwise falls back to overview',()=>{
  assert.equal(buildProjectSwitchHref('/projects/old','new-project'),'/projects/new-project');
  assert.equal(buildProjectSwitchHref('/job-setup/old','new-project'),'/job-setup/new-project');
  assert.equal(buildProjectSwitchHref('/schedule','new-project'),'/projects/new-project');
  assert.equal(buildProjectSwitchHref('/takeoff/set-1','new-project'),'/projects/new-project');
});

test('device-local keys are scoped by authenticated user and company',()=>{
  assert.notEqual(navigationPreferenceStorageKey('user-a','company-a'),navigationPreferenceStorageKey('user-b','company-a'));
  assert.notEqual(navigationPreferenceStorageKey('user-a','company-a'),navigationPreferenceStorageKey('user-a','company-b'));
});

test('recent navigation and project ids normalize deterministically',()=>{
  assert.deepEqual(normalizeRecentDestinationIds(['projects','removed','projects','today']),['projects','today']);
  assert.deepEqual(normalizeRecentProjectIds(['p1','','p1','p2']),['p1','p2']);
  assert.deepEqual(prependRecentId(['b','a'],'a',6),['a','b']);
});
