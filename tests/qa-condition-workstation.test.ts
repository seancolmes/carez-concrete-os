import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workstation = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
const workflowShell = readFileSync('components/takeoff/TakeoffConditionWorkflowShell.tsx', 'utf8');
const workspaceStyles = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.module.css', 'utf8');
const quantityDock = readFileSync('components/takeoff/TakeoffQuantityDock.tsx', 'utf8');
const viewer = readFileSync('components/takeoff/TakeoffDerived3DView.tsx', 'utf8');
const derived3d = readFileSync('lib/takeoff/conditions/derived3d.ts', 'utf8');
const conditionCatalog = readFileSync('lib/takeoff/conditions/catalog.ts', 'utf8');
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

test('full-sheet 3D preserves active sheet and synchronizes exact Takeoff selection', () => {
  assert.match(viewer, /scene\.solids\.filter\(solid => solid\.sheetId === activeSheetId\)/);
  assert.match(workstation, /changeViewMode=\(mode:ViewMode\)=>\{setViewMode\(mode\);\}/);
  assert.doesNotMatch(workstation, /changeViewMode=\(mode:ViewMode\)=>\{if\(mode!=='2d'&&selectedVersionId\)/);

  assert.match(quantityDock, /new CustomEvent\('carez:takeoff-sheet-change', \{ detail: \{ sheetId: currentSheetId \} \}\)/);
  assert.match(workstation, /window\.addEventListener\('carez:takeoff-sheet-change'/);
  assert.match(quantityDock, /new CustomEvent\('carez:takeoff-selection-change', \{ detail: \{ measurementId: selectedMeasurementId \} \}\)/);

  assert.match(workstation, /focusMeasurement=\(measurementId:string\|null\)=>\{setSelectedMeasurementId\(measurementId\);const measurement=.*setActiveSheetId\(measurement\.sheet_id\)/);
  assert.match(workstation, /requestMeasurementSelection=\(measurementId:string\|null\)=>\{/);
  assert.match(workstation, /requestConditionSelection\(role\.condition_version_id,false,measurementId\)/);
  assert.match(workstation, /selectDerivedSolid=\(solid:Derived3DSolid\)=>requestConditionSelection\(solid\.conditionVersionId,false,solid\.measurementId\)/);
  assert.match(workstation, /conditionSelectedMeasurementId=\{selectedMeasurementId\} onConditionMeasurementSelect=\{requestMeasurementSelection\}/);
  assert.match(workstation, /primaryAssignment=.*focusMeasurement\(primaryAssignment\?\.measurement_id\|\|null\)/);
});

test('3D toggles in the current drawing viewport and Split is not exposed', () => {
  assert.match(workspaceStyles, /\.viewModeSwitch button:last-child\{display:none\}/);
  assert.match(workspaceStyles, /\.derivedOverlay3d,\.derivedOverlaySplit\{left:260px\}/);
  assert.match(workspaceStyles, /data-view-mode="split"[^\n]*section\{width:100%;min-width:0\}/);
  assert.doesNotMatch(workflowShell, /settleSplitView/);
  assert.doesNotMatch(workflowShell, /requestAnimationFrame/);
});

test('3D uses the rendered PDF sheet as the spatial reference plane', () => {
  assert.match(derived3d, /sheetPlanes/);
  assert.match(derived3d, /worldWidth: scaleFtPerPdfUnit \? pageWidth \* scaleFtPerPdfUnit : null/);
  assert.match(viewer, /scene\.sheetPlanes\[activeSheetId\]/);
  assert.match(viewer, /querySelector<HTMLCanvasElement>\('canvas'\)/);
  assert.match(viewer, /<image href=\{planImageUrl\}/);
  assert.match(viewer, /PLAN_DATUM_ELEVATION = 0/);
  assert.doesNotMatch(viewer, /patternUnits=/);
});

test('3D elevation reference exposes governed choices required by projection', () => {
  assert.ok(conditionCatalog.includes("key: 'elevation_reference'"));
  assert.ok(conditionCatalog.includes("options: ['top', 'bottom', 'centerline']"));
});

test('3D identifies selected missing inputs in empty and partial sheet models', () => {
  assert.match(viewer, /selectedInputIssue/);
  assert.match(viewer, /<strong>3D input required<\/strong><span>\{selectedInputIssue\.message\}<\/span>/);
  assert.ok(viewer.includes('visibleSolids.length>0&&!selectedHasSolid'));
  assert.ok(viewer.includes('Selected takeoff needs a 3D input'));
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
