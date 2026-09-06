import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workstation = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
const viewer = readFileSync('components/takeoff/TakeoffDerived3DView.tsx', 'utf8');
const conditionActions = readFileSync('app/takeoff/[setId]/conditionActions.ts', 'utf8');
const direction = readFileSync('components/takeoff/ConditionPropertiesDirectionA.module.css', 'utf8');

test('Condition issues stay below permanent tabs and are compact/collapsible', () => {
  const tabsIndex = workstation.indexOf('<Tabs value={propertyTab}');
  const issuesIndex = workstation.indexOf('<Collapsible open={issuesOpen}');
  assert.ok(tabsIndex >= 0 && issuesIndex > tabsIndex);
  assert.match(workstation, /aria-controls="condition-issues"/);
  assert.match(direction, /\.holdsDock\{[^}]*max-height:min\(180px,30vh\);overflow:auto/);
});

test('pricing issues route to Review when available or the linked Estimate otherwise', () => {
  assert.match(workstation, /issue\.category==='pricing'\|\|issue\.category==='commercial'\?'review'/);
  assert.match(workstation, /router\.push\(`\/estimates\/\$\{estimateId\}`\)/);
  assert.match(workstation, /return'Estimate'/);
});

test('selected Condition primary takeoff drives the active 2D and 3D sheet', () => {
  assert.match(workstation, /focusMeasurement=\(measurementId:string\|null\)=>\{setSelectedMeasurementId\(measurementId\);const measurement=.*setActiveSheetId\(measurement\.sheet_id\)/);
  assert.match(workstation, /changeViewMode=\(mode:ViewMode\)=>\{if\(mode!=='2d'&&selectedVersionId\)/);
  assert.match(workstation, /primaryAssignment=.*focusMeasurement\(primaryAssignment\?\.measurement_id\|\|null\)/);
});

test('3D empty state identifies selected missing inputs and separates model checks from estimating issues', () => {
  assert.match(viewer, /selectedInputIssue/);
  assert.match(viewer, /<strong>3D input required<\/strong><span>\{selectedInputIssue\.message\}<\/span>/);
  assert.match(viewer, />Resolve input<\/Button>/);
  assert.match(viewer, />3D checks \{sheetIssues\.length\}<\/Button>/);
  assert.match(viewer, /Current model/);
  assert.doesNotMatch(viewer, /Saved model/);
});

test('Condition contract version is visible and an older editable Strip draft has a governed latest-contract upgrade action', () => {
  assert.match(workstation, /Contract v\{contractVersion\}/);
  assert.match(workstation, /Upgrade to v\{latestContractVersion\}/);
  assert.match(conditionActions, /carez_upgrade_strip_condition_draft_to_v5/);
  assert.match(conditionActions, /carez_ensure_strip_footing_v5_template/);
  assert.match(workstation, /Verified Condition history is never changed/);
});