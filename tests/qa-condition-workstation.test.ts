import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const workstation = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
const conditionProperties = readFileSync('components/takeoff/ConditionProperties.tsx', 'utf8');
const conditionEditor = readFileSync('components/takeoff/useConditionEditor.ts', 'utf8');
const workflowShell = readFileSync('components/takeoff/TakeoffConditionWorkflowShell.tsx', 'utf8');
const workspaceStyles = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.module.css', 'utf8');
const quantityDock = readFileSync('components/takeoff/TakeoffQuantityDock.tsx', 'utf8');
const derived3d = readFileSync('lib/takeoff/conditions/derived3d.ts', 'utf8');
const coordinates = readFileSync('lib/takeoff/conditions/derived3d/coordinates.ts', 'utf8');
const conditionCatalog = readFileSync('lib/takeoff/conditions/catalog.ts', 'utf8');
const conditionActions = readFileSync('app/takeoff/[setId]/conditionActions.ts', 'utf8');
const direction = readFileSync('components/takeoff/ConditionPropertiesDirectionA.module.css', 'utf8');
const r3fViewport = readFileSync('components/takeoff/3d/Takeoff3DViewport.tsx', 'utf8');
const r3fPlan = readFileSync('components/takeoff/3d/Takeoff3DPlan.tsx', 'utf8');
const r3fScene = readFileSync('components/takeoff/3d/Takeoff3DScene.tsx', 'utf8');
const r3fControls = readFileSync('components/takeoff/3d/Takeoff3DControls.tsx', 'utf8');
const r3fToolbar = readFileSync('components/takeoff/3d/Takeoff3DToolbar.tsx', 'utf8');

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|js|jsx|mjs|cjs|css|md|json)$/.test(entry.name) ? [path] : [];
  });
}

test('R3F foundation uses an orthographic Canvas and a direct PDF reference', () => {
  assert.match(r3fScene, /<Canvas/);
  assert.match(r3fScene, /orthographic/);
  assert.match(r3fPlan, /renderPdfPageCanvas/);
  assert.match(r3fPlan, /flipY = true/);
  assert.match(r3fPlan, /depthWrite=\{false\} depthTest=\{false\}/);
  assert.doesNotMatch(r3fPlan, /querySelector/);
  assert.match(r3fViewport, /activeSheetId/);
  assert.match(r3fControls, /maxPolarAngle=\{MAX_POLAR\}/);
  assert.match(r3fControls, /screenSpacePanning=\{false\}/);
  assert.match(r3fScene, /<Takeoff3DSolid/);
  assert.doesNotMatch(r3fScene, /buildTakeoffMeshGeometry/);
});

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
  assert.match(r3fViewport, /sheetSolidsForSelection\(scene, activeSheetId\)/);
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
  assert.match(workstation, /focusMeasurement\(primaryMeasurementForVersion\(versionId\)\)/);
});

test('R3F exposes Focus, filters and active-sheet partial-model holds without hiding siblings', () => {
  assert.match(r3fViewport, /issue\.sheetId === activeSheetId/);
  assert.match(r3fViewport, /issue\.measurementId === selectedMeasurementId/);
  assert.match(r3fViewport, /3D input required/);
  assert.match(r3fViewport, /3D unavailable for this Takeoff/);
  assert.match(r3fViewport, /Resolve input/);
  assert.match(r3fViewport, /calibrated && pdfUrl \? <Takeoff3DErrorBoundary/);
  assert.match(r3fViewport, /solids=\{visibleSolids\}/);
  assert.match(r3fViewport, /actions\.current\?\.focusSelected/);
  assert.match(r3fToolbar, /onClick=\{onFocus\}/);
  assert.match(r3fToolbar, /onClick=\{onToggleFilters\}/);
  assert.match(r3fToolbar, /3D checks \{issueCount\}/);
  assert.match(r3fViewport, /aria-label="3D zone"/);
  assert.match(r3fViewport, /aria-label="3D top elevation"/);
  assert.match(r3fViewport, /Show all/);
  assert.match(r3fViewport, /Isolate/);
  assert.doesNotMatch(r3fViewport, /sourceQuantities|raw_quantity|production_quantity|direct_cost/);
});

test('3D toggles in the current drawing viewport and Split is not exposed', () => {
  const retiredSplitClass = ['derived', 'Overlay', 'Split'].join('');
  assert.doesNotMatch(workspaceStyles, /\.viewModeSwitch button:last-child\{display:none\}/);
  assert.match(workspaceStyles, /\.derivedOverlay3d\{left:260px\}/);
  assert.match(workspaceStyles, /\.derivedOverlay3d\{left:0\}/);
  assert.equal(workspaceStyles.includes(retiredSplitClass), false);
  assert.doesNotMatch(workspaceStyles, /data-view-mode="split"/);
  assert.doesNotMatch(workstation, /\['2d','3d','split'\]/);
  assert.doesNotMatch(workflowShell, /settleSplitView/);
  assert.doesNotMatch(workflowShell, /requestAnimationFrame/);
});

test('R3F is the only 3D renderer and remains client-only', () => {
  const retiredGate = ['NEXT', 'PUBLIC', 'CAREZ', '3D', 'RENDERER'].join('_');
  const retiredViewer = ['Takeoff', 'Derived3DView'].join('');
  assert.equal(workstation.includes(retiredGate), false);
  assert.equal(workstation.includes(retiredViewer), false);
  assert.doesNotMatch(workstation, /TakeoffDerived3DBoundary|Derived3DViewMemory/);
  assert.match(workstation, /dynamic\(/);
  assert.match(workstation, /ssr:\s*false/);
  assert.match(workstation, /pdfUrl=\{workspaceProps\.pdfUrl\}/);
  assert.match(workstation, /activePageNumber=\{Number\(activeSheet\?\.page_number\|\|1\)\}/);
  assert.match(workstation, /@\/lib\/takeoff\/3d\/viewState/);
  assert.match(workstation, /cameraMemory=\{r3fMemory\.current\}/);
  assert.match(workstation, /selectedMeasurementId=\{selectedMeasurementId\}/);
  assert.match(workstation, /onSelectSolid=\{selectDerivedSolid\}/);
});

test('retired 3D migration markers are absent from active source and tests', () => {
  const markers = [
    ['Takeoff', 'Derived3DView'].join(''),
    ['derived', 'Overlay', 'Split'].join(''),
    ['NEXT', 'PUBLIC', 'CAREZ', '3D', 'RENDERER'].join('_'),
  ];
  for (const path of ['components', 'tests', 'lib'].flatMap(sourceFiles)) {
    const content = readFileSync(path, 'utf8');
    for (const marker of markers) assert.equal(content.includes(marker), false, `${marker} remains in ${path}`);
  }
});

test('3D uses the rendered PDF sheet as the spatial reference plane', () => {
  assert.match(derived3d, /sheetPlanes/);
  assert.match(derived3d, /worldWidth: scaleFtPerPdfUnit \? pageWidth \* scaleFtPerPdfUnit : null/);
  assert.match(coordinates, /point\.x \* Number\(sheet\.page_width\) \* scale/);
  assert.match(coordinates, /point\.y \* Number\(sheet\.page_height\) \* scale/);
  assert.match(r3fViewport, /scene\.sheetPlanes\[activeSheetId\]/);
  assert.match(r3fPlan, /renderPdfPageCanvas/);
  assert.match(r3fPlan, /sheetPlaneFrame\(plane\)/);
  assert.match(r3fPlan, /planeGeometry args=\{\[frame\.width, frame\.height\]\}/);
  assert.doesNotMatch(r3fPlan, /querySelector<HTMLCanvasElement>|patternUnits=/);
});

test('R3F camera and review controls remain constrained and legible', () => {
  assert.match(r3fControls, /MIN_POLAR/);
  assert.match(r3fControls, /MAX_POLAR/);
  assert.match(r3fControls, /maxPolarAngle=\{MAX_POLAR\}/);
  assert.match(r3fToolbar, /Home/);
  assert.match(r3fToolbar, /Top/);
  assert.match(r3fToolbar, /Focus/);
  assert.match(r3fToolbar, /Filters/);
});

test('3D elevation reference exposes governed choices required by projection', () => {
  assert.ok(conditionCatalog.includes("key: 'elevation_reference'"));
  assert.ok(conditionCatalog.includes("options: ['top', 'bottom', 'centerline']"));
});

test('Condition contract version is visible and an older editable Strip draft has a governed latest-contract upgrade action', () => {
  assert.match(conditionProperties, /Contract v\{contractVersion\}/);
  assert.match(conditionProperties, /Upgrade to v\{latestContractVersion\}/);
  assert.match(conditionEditor, /upgradeProjectConcreteConditionDraftToLatest/);
  assert.match(conditionEditor, /canUpgrade/);
  assert.match(conditionActions, /carez_upgrade_strip_condition_draft_to_v5/);
  assert.match(conditionActions, /carez_ensure_strip_footing_v5_template/);
  assert.match(conditionProperties, /Verified Condition history is never changed/);
});

test('Condition Properties renders provenance only from persisted provenance records', () => {
  assert.match(conditionProperties, /persistedInputProvenance/);
  assert.match(conditionProperties, /selectedPersistedModules/);
  assert.match(conditionProperties, /CarezProvenance/);
  assert.doesNotMatch(conditionProperties, /updated_at/);
  assert.doesNotMatch(conditionProperties, /value.*provenance|provenance.*value/);
});
