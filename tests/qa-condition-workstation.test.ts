import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workstation = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
const workflowShell = readFileSync('components/takeoff/TakeoffConditionWorkflowShell.tsx', 'utf8');
const workspaceStyles = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.module.css', 'utf8');
const quantityDock = readFileSync('components/takeoff/TakeoffQuantityDock.tsx', 'utf8');
const viewer = readFileSync('components/takeoff/TakeoffDerived3DView.tsx', 'utf8');
const viewerStyles = readFileSync('components/takeoff/TakeoffDerived3DView.module.css', 'utf8');
const derived3d = readFileSync('lib/takeoff/conditions/derived3d.ts', 'utf8');
const coordinates = readFileSync('lib/takeoff/conditions/derived3d/coordinates.ts', 'utf8');
const conditionCatalog = readFileSync('lib/takeoff/conditions/catalog.ts', 'utf8');
const conditionActions = readFileSync('app/takeoff/[setId]/conditionActions.ts', 'utf8');
const direction = readFileSync('components/takeoff/ConditionPropertiesDirectionA.module.css', 'utf8');

test('R3F foundation uses an orthographic Canvas and a direct PDF reference', () => {
  const viewport = readFileSync('components/takeoff/3d/Takeoff3DViewport.tsx', 'utf8');
  const plan = readFileSync('components/takeoff/3d/Takeoff3DPlan.tsx', 'utf8');
  const scene = readFileSync('components/takeoff/3d/Takeoff3DScene.tsx', 'utf8');
  const controls = readFileSync('components/takeoff/3d/Takeoff3DControls.tsx', 'utf8');
  assert.match(scene, /<Canvas/);
  assert.match(scene, /orthographic/);
  assert.match(plan, /renderPdfPageCanvas/);
  assert.match(plan, /flipY = true/);
  assert.match(plan, /depthWrite=\{false\} depthTest=\{false\}/);
  assert.doesNotMatch(plan, /querySelector/);
  assert.match(viewport, /activeSheetId/);
  assert.match(controls, /maxPolarAngle=\{MAX_POLAR\}/);
  assert.match(controls, /screenSpacePanning=\{false\}/);
  assert.match(scene, /<Takeoff3DSolid/);
  assert.doesNotMatch(scene, /buildTakeoffMeshGeometry/);
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
  assert.match(workstation, /focusMeasurement\(primaryMeasurementForVersion\(versionId\)\)/);
});

test('R3F exposes Focus, filters and active-sheet partial-model holds without hiding siblings', () => {
  const viewport = readFileSync('components/takeoff/3d/Takeoff3DViewport.tsx', 'utf8');
  const toolbar = readFileSync('components/takeoff/3d/Takeoff3DToolbar.tsx', 'utf8');
  assert.match(viewport, /issue\.sheetId === activeSheetId/);
  assert.match(viewport, /issue\.measurementId === selectedMeasurementId/);
  assert.match(viewport, /3D input required/);
  assert.match(viewport, /3D unavailable for this Takeoff/);
  assert.match(viewport, /Resolve input/);
  assert.match(viewport, /calibrated && pdfUrl \? <Takeoff3DErrorBoundary/);
  assert.match(viewport, /solids=\{visibleSolids\}/);
  assert.match(viewport, /actions\.current\?\.focusSelected/);
  assert.match(toolbar, /onClick=\{onFocus\}/);
  assert.match(toolbar, /onClick=\{onToggleFilters\}/);
  assert.match(toolbar, /3D checks \{issueCount\}/);
  assert.match(viewport, /aria-label="3D zone"/);
  assert.match(viewport, /aria-label="3D top elevation"/);
  assert.match(viewport, /Show all/);
  assert.match(viewport, /Isolate/);
  assert.doesNotMatch(viewport, /sourceQuantities|raw_quantity|production_quantity|direct_cost/);
});

test('3D toggles in the current drawing viewport and Split is not exposed', () => {
  assert.doesNotMatch(workspaceStyles, /\.viewModeSwitch button:last-child\{display:none\}/);
  assert.match(workspaceStyles, /\.derivedOverlay3d\{left:260px\}/);
  assert.match(workspaceStyles, /\.derivedOverlay3d\{left:0\}/);
  assert.doesNotMatch(workspaceStyles, /derivedOverlaySplit|data-view-mode="split"/);
  assert.doesNotMatch(workstation, /\['2d','3d','split'\]/);
  assert.doesNotMatch(workflowShell, /settleSplitView/);
  assert.doesNotMatch(workflowShell, /requestAnimationFrame/);
});

test('R3F migration is client-only and shares existing sheet, selection and view state', () => {
  assert.match(workstation, /NEXT_PUBLIC_CAREZ_3D_RENDERER/);
  assert.match(workstation, /dynamic\(/);
  assert.match(workstation, /ssr:\s*false/);
  assert.match(workstation, /pdfUrl=\{workspaceProps\.pdfUrl\}/);
  assert.match(workstation, /activePageNumber=\{Number\(activeSheet\?\.page_number\|\|1\)\}/);
  assert.match(workstation, /@\/lib\/takeoff\/3d\/viewState/);
  assert.match(viewer, /@\/lib\/takeoff\/3d\/viewState/);
  assert.match(workstation, /cameraMemory=\{r3fMemory\.current\}/);
  assert.match(workstation, /selectedMeasurementId=\{selectedMeasurementId\}/);
  assert.match(workstation, /onSelectSolid=\{selectDerivedSolid\}/);
});

test('3D uses the rendered PDF sheet as the spatial reference plane', () => {
  assert.match(derived3d, /sheetPlanes/);
  assert.match(derived3d, /worldWidth: scaleFtPerPdfUnit \? pageWidth \* scaleFtPerPdfUnit : null/);
  assert.match(coordinates, /point\.x \* Number\(sheet\.page_width\) \* scale/);
  assert.match(coordinates, /point\.y \* Number\(sheet\.page_height\) \* scale/);
  assert.match(viewer, /scene\.sheetPlanes\[activeSheetId\]/);
  assert.match(viewer, /querySelector<HTMLCanvasElement>\('canvas'\)/);
  assert.match(viewer, /sheetPlane\.worldWidth/);
  assert.match(viewer, /sheetPlane\.worldHeight/);
  assert.match(viewer, /<image className=\{styles\.planImage\} href=\{planImageUrl\}/);
  assert.match(viewer, /PLAN_DATUM_ELEVATION = 0/);
  assert.match(viewer, /frameForScene\(sheetSolids, sheetPlane\)/);
  assert.doesNotMatch(viewer, /patternUnits=/);
});

test('3D viewer constrains orbit and keeps the plan and solids legible', () => {
  assert.match(viewer, /MIN_CAMERA_PITCH = -1\.38/);
  assert.match(viewer, /MAX_CAMERA_PITCH = -0\.32/);
  assert.match(viewer, /normalizeCamera/);
  assert.match(viewer, /MAX_PLAN_TEXTURE_DIMENSION = 3072/);
  assert.match(viewer, /imageSmoothingQuality = 'high'/);
  assert.match(viewer, /opacity="0\.98"/);
  assert.match(viewer, /styles\.faceSelected/);
  assert.match(viewer, /<summary><SlidersHorizontal size=\{14\}\/?>Filters<\/summary>/);
  assert.match(viewerStyles, /\.sheetPlane\{[^}]*drop-shadow/);
  assert.match(viewerStyles, /\.filtersPanel\{/);
  assert.match(viewerStyles, /\.faceSelected\{/);
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
