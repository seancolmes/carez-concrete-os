# Specialist Takeoff Reference Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace the active Condition-first Takeoff compatibility composition with the approved EDGE-informed Carez specialist workstation while preserving authoritative 2D geometry, Condition calculation/lineage, derived-3D verification, Direct Cost vs Sell boundaries, and historical compatibility.

**Architecture:** Keep the existing server/domain model and geometry engine intact. Extract the Condition-first experience into explicit specialist units—identity, workspace state, navigator, Condition Properties, 2D canvas, derived 3D, and Worksheet—then compose them directly under the current Takeoff route. The legacy Assembly Builder path remains available behind the existing dependency gate, while the active Condition path stops depending on hidden legacy panes, DOM querying/portals, broad compatibility-theme selectors, or browser-wide CustomEvents for normal synchronization.

**Tech Stack:** Next.js 15.5, React 19, TypeScript 5.9, Supabase/PostgreSQL, shadcn/Base UI, Carez shared UI components, pdfjs-dist, React Three Fiber/Three.js, Node built-in test runner, pnpm 11.

**Spec:** docs/superpowers/specs/2026-09-19-specialist-takeoff-reference-slice-design.md

## Global Constraints

- Work only from current staging; main is production only and must not be touched.
- Root AGENTS.md and CODEX.md remain the execution contracts.
- ADR-024 is visual/theme/token/density authority; ADR-020 plus docs/modules/takeoff.md remain Takeoff workstation/domain authority where current.
- Persisted stable page-coordinate 2D/vector geometry remains the sole Takeoff quantity geometry authority.
- Derived 3D remains verification only and must never calculate or persist independent commercial quantity.
- Production Quantity, Direct Cost, and Sell remain distinct; Sell, margin, and customer price remain Estimate authority.
- Preserve company_id tenant isolation, RLS, immutable/versioned history, generated Estimate lineage, and issued/accepted locking.
- Preserve human authority over scope, Conditions, means/methods, reinforcing, production rates, pricing, margin, budgets, approvals, and final commercial decisions.
- No new component system, no revived B2/legacy palette, no dark-only Takeoff styling, and no active compatibility-theme overlay in the accepted Condition-first reference path.
- Do not broaden Issue #71 Project Context route recognition; /takeoff/[setId] remains Estimate-authoritative.
- No supplier/manufacturer document ingestion in this plan. Resources/Pricing only become compatible with normalized future catalog provenance.
- Do not add a database migration unless implementation proves a spec requirement cannot be met with the existing schema; stop and re-plan before doing so.
- Normal task validation is targeted tests plus pnpm typecheck. Run pnpm check for the final/high-risk integrated pass.
- UI work is not accepted until deployed Vercel staging is authenticated-browser tested.

## File Structure

### New focused files

- lib/takeoff/specialistWorkstation.ts — pure specialist UI state types, status mapping, workspace selection helpers, and guarded transitions.
- lib/takeoff/specialistWorksheet.ts — pure projection from authoritative Condition/measurement/output/hold data into the six Worksheet views.
- components/takeoff/TakeoffWorkspaceIdentity.tsx — Takeoff/Estimate/optional Project lineage identity and return actions.
- components/takeoff/TakeoffContextNavigator.tsx — Plans / Conditions / Zones specialist navigator.
- components/takeoff/ConditionProperties.tsx — single governed Condition editor/presentation surface.
- components/takeoff/useConditionEditor.ts — Condition draft, dirty/save/recalculate, role assignment, upgrade, and unsaved-switch coordination.
- components/takeoff/TakeoffDrawingCanvas.tsx — extracted 2D drawing/tool/status engine used directly by the Condition-first specialist workspace.
- components/takeoff/TakeoffWorksheet.tsx — six-view virtualized/resizable bottom workbench.
- components/takeoff/TakeoffSpecialistWorkspace.tsx — one direct controller/composition for Navigator + Canvas + Properties + Worksheet + derived 3D.
- components/takeoff/TakeoffSpecialistWorkspace.module.css — direct ADR-024 workstation geometry/responsive rules.
- components/takeoff/TakeoffContextNavigator.module.css — specialist navigator density/selection rules.
- components/takeoff/ConditionProperties.module.css — Condition Properties density/state rules.
- components/takeoff/TakeoffWorksheet.module.css — specialist Worksheet layout/virtualization/resize rules.
- tests/ui-takeoff-specialist-reference.test.ts — source/architecture/authority contract for Subproject 5.
- tests/specialist-workstation.test.ts — pure state/status/transition tests.
- tests/specialist-worksheet.test.ts — pure six-view Worksheet projection tests.

### Existing files intentionally modified

- app/takeoff/[setId]/page.tsx — exact Estimate/optional Project lineage reads, richer Condition output projection inputs, direct specialist props.
- app/takeoff/[setId]/TakeoffDrawingPage.module.css — semantic compact identity shell only; remove hard-coded alternate dark palette.
- app/takeoff/[setId]/conditionActions.ts — bounded Condition duplicate action using existing Condition tables/RPCs; no schema change.
- app/takeoff/actions.ts — only if needed to revalidate the active set after existing direct-cost override; keep existing RPC authority.
- app/projects/[id]/page.tsx — exact source_estimate_id to unique Takeoff-set related-workflow link.
- components/takeoff/TakeoffConditionWorkflowShell.tsx — mount direct TakeoffSpecialistWorkspace and own pane collapse state without browser events.
- components/takeoff/TakeoffConditionWorkflowShell.module.css — direct pane rails and responsive containment; remove descendant DOM assumptions.
- components/takeoff/TakeoffDrawingWorkspace.tsx — become legacy wrapper plus shared TakeoffDrawingCanvas composition; Condition-first path no longer renders hidden legacy panes.
- components/takeoff/TakeoffQuantityDock.tsx — remain legacy Assembly Builder wrapper or compatibility adapter after the specialist Worksheet is introduced.
- components/takeoff/3d/Takeoff3DViewport.tsx — presentation-only derived/preview labels and direct specialist callbacks if required; no quantity logic.
- components/takeoff/3d/Takeoff3DToolbar.tsx — keep Home/Top/Focus/Filters/Checks; semantic specialist styling only.
- docs/design-system/CAREZ_COMPONENT_PACK.md — document specialist extension rules only after the new components are real.
- tests/qa-condition-workstation.test.ts — update existing QA source contracts away from retired event/DOM coupling.
- tests/condition-first-cutover.test.ts — assert direct specialist composition and legacy gate separation.
- tests/condition-worksheet.test.ts — preserve current Not calculated/Pending/Ready trust behavior while the new projector is added.
- tests/ui-navigation.test.ts and tests/ui-shared-components.test.ts — keep /takeoff outside authoritative Project Context.
- docs/CURRENT_STATE.md and docs/ROADMAP.md — update only after explicit rendered/user acceptance.

### Files expected to retire from the active Condition path

- components/takeoff/IntegratedTakeoffConditionWorkspace.tsx
- components/takeoff/IntegratedTakeoffConditionWorkspace.module.css
- components/takeoff/TakeoffShadcnTheme.module.css
- components/takeoff/ConditionPropertiesDirectionA.module.css

Delete a retired file only after no active or legacy consumer imports it. Do not remove historical/legacy paths merely because the Condition-first reference no longer uses them.

## Review Focus

1. **Exact Project lineage is absent or ambiguous:** source_estimate_id missing, no active Takeoff set, or more than one candidate must result in no guessed Original Takeoff link; Task 2 pins this.
2. **Dirty Condition during cross-pane selection:** selecting another Condition, 3D issue, or Worksheet Condition must never discard edits silently; Task 4 pins Cancel/Discard/Save-and-switch transition behavior.
3. **Role measurement starts on an uncalibrated sheet:** physical LF/SF measuring must remain blocked or routed to calibration without losing the pending Condition/role intent; Task 5 pins this.
4. **Derived 3D is unavailable or partially held:** 2D, Condition Properties, authoritative outputs, and Worksheet remain usable; Task 7 pins this.
5. **Direct Cost is incomplete or stale:** missing price or pending recalculation must never render as authoritative zero or editable Sell; Task 6 pins partial/unknown semantics.

---

### Task 1: Pin the specialist state and authority contracts

**Files:**
- Create: lib/takeoff/specialistWorkstation.ts
- Create: tests/specialist-workstation.test.ts
- Create: tests/ui-takeoff-specialist-reference.test.ts
- Modify: tests/ui-navigation.test.ts
- Modify: tests/ui-shared-components.test.ts

**Interfaces:**
- Consumes: existing Condition/Takeoff identifiers and shared Carez state semantics.
- Produces:
  - TakeoffNavigatorTab = plans | conditions | zones
  - TakeoffViewMode = 2d | 3d
  - TakeoffWorksheetView = quantities | resources | labor | pricing | holds | recap
  - TakeoffSelection = { sheetId, conditionVersionId, roleKey, measurementId }
  - resolveTakeoffViewMode(value)
  - resolveTakeoffWorksheetView(value)
  - resolveConditionPresentationState(input)
  - nextTakeoffSelection(current,intent)

- [ ] **Step 1: Write failing pure-state tests**

~~~ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveTakeoffViewMode,
  resolveTakeoffWorksheetView,
  resolveConditionPresentationState,
} from '../lib/takeoff/specialistWorkstation.ts';

test('specialist views expose only the approved modes',()=>{
  assert.equal(resolveTakeoffViewMode('2d'),'2d');
  assert.equal(resolveTakeoffViewMode('3d'),'3d');
  assert.equal(resolveTakeoffViewMode('split'),null);
  assert.equal(resolveTakeoffWorksheetView('pricing'),'pricing');
  assert.equal(resolveTakeoffWorksheetView('unknown'),null);
});

test('Condition state preserves pending, holds, and price-missing semantics',()=>{
  assert.equal(resolveConditionPresentationState({locked:false,dirty:false,pending:false,calculated:false,openHolds:0,pricingMissing:0}).label,'Not calculated');
  assert.equal(resolveConditionPresentationState({locked:false,dirty:true,pending:false,calculated:true,openHolds:0,pricingMissing:0}).label,'Unsaved changes');
  assert.equal(resolveConditionPresentationState({locked:false,dirty:false,pending:true,calculated:true,openHolds:0,pricingMissing:0}).label,'Pending recalculation');
  assert.equal(resolveConditionPresentationState({locked:false,dirty:false,pending:false,calculated:true,openHolds:2,pricingMissing:0}).label,'Calculation hold');
  assert.equal(resolveConditionPresentationState({locked:false,dirty:false,pending:false,calculated:true,openHolds:0,pricingMissing:2}).label,'Qty ready · Price missing');
  assert.equal(resolveConditionPresentationState({locked:true,dirty:false,pending:false,calculated:true,openHolds:0,pricingMissing:0}).label,'Locked');
});
~~~

- [ ] **Step 2: Write the initial failing specialist source contract**

~~~ts
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Subproject 5 has direct specialist component boundaries',()=>{
  for(const path of [
    'components/takeoff/TakeoffSpecialistWorkspace.tsx',
    'components/takeoff/TakeoffContextNavigator.tsx',
    'components/takeoff/ConditionProperties.tsx',
    'components/takeoff/TakeoffDrawingCanvas.tsx',
    'components/takeoff/TakeoffWorksheet.tsx',
  ]) assert.equal(existsSync(new URL('../'+path,import.meta.url)),true,path+' must exist');
});

test('Takeoff does not become an authoritative project-context route',async()=>{
  const navigation=await import(new URL('../lib/ui/navigation.ts',import.meta.url).href);
  assert.equal(navigation.resolveProjectRoute('/takeoff/set-1'),null);
});
~~~

- [ ] **Step 3: Run the new tests and confirm RED**

Run:

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/specialist-workstation.test.ts tests/ui-takeoff-specialist-reference.test.ts
~~~

Expected: FAIL because specialistWorkstation.ts and direct specialist components do not exist.

- [ ] **Step 4: Implement the pure state module only**

~~~ts
export type TakeoffNavigatorTab='plans'|'conditions'|'zones';
export type TakeoffViewMode='2d'|'3d';
export type TakeoffWorksheetView='quantities'|'resources'|'labor'|'pricing'|'holds'|'recap';

export type TakeoffSelection={
  sheetId:string|null;
  conditionVersionId:string|null;
  roleKey:string|null;
  measurementId:string|null;
};

export function resolveTakeoffViewMode(value:unknown):TakeoffViewMode|null{
  return value==='2d'||value==='3d'?value:null;
}

export function resolveTakeoffWorksheetView(value:unknown):TakeoffWorksheetView|null{
  const allowed=['quantities','resources','labor','pricing','holds','recap'] as const;
  return allowed.includes(value as TakeoffWorksheetView)?value as TakeoffWorksheetView:null;
}
~~~

Implement resolveConditionPresentationState with the exact priority locked → dirty → pending → not-calculated → holds → price-missing → ready. Return only presentation metadata; do not calculate domain state.

- [ ] **Step 5: Run state/navigation tests**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/specialist-workstation.test.ts tests/ui-navigation.test.ts tests/ui-shared-components.test.ts
pnpm typecheck
~~~

Expected: PASS for pure-state/navigation tests. The architecture test remains RED until later tasks create the UI units.

- [ ] **Step 6: Commit**

~~~bash
git add lib/takeoff/specialistWorkstation.ts tests/specialist-workstation.test.ts tests/ui-takeoff-specialist-reference.test.ts tests/ui-navigation.test.ts tests/ui-shared-components.test.ts
git commit -m "test: define specialist takeoff contracts"
~~~

### Task 2: Establish exact Takeoff / Estimate / optional Project lineage

**Files:**
- Create: components/takeoff/TakeoffWorkspaceIdentity.tsx
- Modify: app/takeoff/[setId]/page.tsx
- Modify: app/takeoff/[setId]/TakeoffDrawingPage.module.css
- Modify: app/projects/[id]/page.tsx
- Modify: tests/ui-takeoff-specialist-reference.test.ts

**Interfaces:**
- Consumes: takeoff_sets.estimate_id, estimates.project_id, projects.source_estimate_id, exact active takeoff_sets for the source Estimate.
- Produces:
  - TakeoffWorkspaceIdentity props: takeoffName, estimateId, estimateLabel, estimateStatus, revisionLabel, optional project identity, sheetCount, conditionCount, holdCount, locked.
  - Project Overview Original Takeoff link only when exactly one active set exists for projects.source_estimate_id.

- [ ] **Step 1: Add RED lineage assertions**

~~~ts
test('Takeoff identity stays Estimate-authoritative with optional Project lineage',()=>{
  const page=read('app/takeoff/[setId]/page.tsx');
  assert.match(page,/project_id/);
  assert.match(page,/TakeoffWorkspaceIdentity/);
  assert.doesNotMatch(page,/CarezProjectContextBar/);
});

test('Project Overview links only an exact originating Takeoff',()=>{
  const page=read('app/projects/[id]/page.tsx');
  assert.match(page,/source_estimate_id/);
  assert.match(page,/Original Takeoff/);
  assert.match(page,/takeoff_sets/);
});
~~~

- [ ] **Step 2: Run the focused test and verify RED**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-takeoff-specialist-reference.test.ts
~~~

Expected: FAIL because the identity component and lineage reads do not exist.

- [ ] **Step 3: Extend the Takeoff route reads without changing authority**

In app/takeoff/[setId]/page.tsx:

~~~ts
const {data:estimate}=await supabase
  .from('estimates')
  .select('id,estimate_number,name,version,status,project_id')
  .eq('id',set.estimate_id)
  .eq('company_id',companyId)
  .maybeSingle();

const {data:project}=estimate?.project_id
  ? await supabase.from('projects')
      .select('id,job_number,name,source_estimate_id')
      .eq('id',estimate.project_id)
      .eq('company_id',companyId)
      .maybeSingle()
  : {data:null};
~~~

Do not feed Project identity into resolveProjectRoute or the global Project Context row.

- [ ] **Step 4: Implement the compact identity component**

Use CarezStatus plus current Button/Link primitives and semantic tokens only. Render Open Estimate always when estimate exists and Open Project only when project exists.

- [ ] **Step 5: Add exact Project Overview source-estimate lookup**

Use p.source_estimate_id from the existing project row:

~~~ts
const sourceEstimateId=String(p.source_estimate_id||'');
const sourceTakeoffs=sourceEstimateId
  ? (await supabase.from('takeoff_sets')
      .select('id,name,status')
      .eq('company_id',profile.company_id)
      .eq('estimate_id',sourceEstimateId)
      .eq('status','active')).data||[]
  : [];
const originalTakeoff=sourceTakeoffs.length===1?sourceTakeoffs[0]:null;
~~~

No candidate or multiple candidates means no guessed Original Takeoff link.

- [ ] **Step 6: Run tests/typecheck**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-takeoff-specialist-reference.test.ts tests/ui-navigation.test.ts
pnpm typecheck
~~~

Expected: PASS for the lineage assertions.

- [ ] **Step 7: Commit**

~~~bash
git add app/takeoff/[setId]/page.tsx app/takeoff/[setId]/TakeoffDrawingPage.module.css app/projects/[id]/page.tsx components/takeoff/TakeoffWorkspaceIdentity.tsx tests/ui-takeoff-specialist-reference.test.ts
git commit -m "feat: add takeoff lineage identity"
~~~

### Task 3: Build the direct Plans / Conditions / Zones navigator

**Files:**
- Create: components/takeoff/TakeoffContextNavigator.tsx
- Create: components/takeoff/TakeoffContextNavigator.module.css
- Modify: app/takeoff/[setId]/conditionActions.ts
- Modify: tests/ui-takeoff-specialist-reference.test.ts
- Modify: tests/concrete-condition-authoring.test.ts

**Interfaces:**
- Consumes: sheets, scaleRegions, Conditions, Condition versions/roles/outputs/holds, current sheet, selected Condition, and only Zone/group data already represented by existing records.
- Produces:
  - TakeoffContextNavigatorProps with explicit selected IDs and callbacks.
  - duplicateProjectConcreteConditionPilot({takeoffSetId,conditionVersionId}) returning a new Condition version ID.
  - No browser event listeners, createPortal, or DOM queries.

- [ ] **Step 1: Add RED navigator assertions**

~~~ts
test('navigator owns Plans Conditions Zones directly',()=>{
  const nav=read('components/takeoff/TakeoffContextNavigator.tsx');
  assert.match(nav,/Plans/);
  assert.match(nav,/Conditions/);
  assert.match(nav,/Zones/);
  assert.match(nav,/onSelectSheet/);
  assert.match(nav,/onSelectCondition/);
  assert.match(nav,/onToggleVisibility/);
  assert.doesNotMatch(nav,/querySelector|createPortal|CustomEvent/);
});
~~~

Add a source-contract assertion that duplicate creates a new Condition identity and does not copy measurement-role/output rows.

- [ ] **Step 2: Run focused tests and verify RED**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-takeoff-specialist-reference.test.ts tests/concrete-condition-authoring.test.ts
~~~

- [ ] **Step 3: Implement TakeoffContextNavigator**

Use an explicit prop contract:

~~~ts
export type TakeoffContextNavigatorProps={
  tab:TakeoffNavigatorTab;
  onTabChange:(tab:TakeoffNavigatorTab)=>void;
  sheets:any[];
  scaleRegions:any[];
  activeSheetId:string|null;
  onSelectSheet:(sheetId:string)=>void;
  conditions:TakeoffConditionNavigatorRow[];
  selectedConditionVersionId:string|null;
  onSelectCondition:(conditionVersionId:string)=>void;
  onCreateCondition:()=>void;
  onDuplicateCondition:(conditionVersionId:string)=>void;
  hiddenConditionVersionIds:Set<string>;
  isolatedConditionVersionId:string|null;
  onToggleVisibility:(conditionVersionId:string)=>void;
  onIsolateCondition:(conditionVersionId:string)=>void;
  locked:boolean;
};
~~~

Conditions is the fresh-entry default. Show explicit scale state and Condition state text. Do not fabricate a Zone hierarchy.

- [ ] **Step 4: Implement bounded Condition duplication using existing schema/RPCs**

The server action must:

1. call editableTakeoffSet;
2. load the source Condition/version and verify same company/set;
3. create a new Condition identity through carez_create_project_concrete_condition with copied governed input groups/provenance and a unique new code/name;
4. copy source module configuration into the new draft only through existing draft-owned module rows;
5. intentionally copy no measurement-role assignments, outputs, holds, generated Estimate lineage, or persisted geometry;
6. revalidate Takeoff/Estimate surfaces.

Return:

~~~ts
return {
  condition_version_id:newVersionId,
  copied_measurement_roles:0,
  copied_outputs:0,
};
~~~

Do not add a migration.

- [ ] **Step 5: Pin keyboard behavior**

Tests must cover Arrow Up/Down row movement, Arrow Left/Right group collapse/expand, Enter selection, and that drawing shortcuts do not fire while navigator inputs/controls own focus.

- [ ] **Step 6: Run targeted tests/typecheck**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-takeoff-specialist-reference.test.ts tests/concrete-condition-authoring.test.ts
pnpm typecheck
~~~

- [ ] **Step 7: Commit**

~~~bash
git add components/takeoff/TakeoffContextNavigator.tsx components/takeoff/TakeoffContextNavigator.module.css app/takeoff/[setId]/conditionActions.ts tests/ui-takeoff-specialist-reference.test.ts tests/concrete-condition-authoring.test.ts
git commit -m "feat: add takeoff context navigator"
~~~


### Task 4: Extract the single governed Condition Properties editor

**Files:**
- Create: components/takeoff/useConditionEditor.ts
- Create: components/takeoff/ConditionProperties.tsx
- Create: components/takeoff/ConditionProperties.module.css
- Modify: tests/ui-takeoff-specialist-reference.test.ts
- Modify: tests/qa-condition-workstation.test.ts
- Modify: tests/concrete-condition-authoring.test.ts

**Interfaces:**
- Consumes: conditionData, measurements, sections, assemblies/versions required for compatibility role measurement, locked flag, and existing conditionActions.
- Produces:
  - useConditionEditor({setId,conditionData,measurements,sections,assemblies,assemblyVersions,locked})
  - ConditionProperties driven by selected Condition/editor state.
  - requestConditionSelection(...) that either applies the requested selection or opens the unsaved-change guard.
  - startRoleMeasurement(role) returns a direct role-measurement request object; it does not dispatch a CustomEvent.

- [ ] **Step 1: Add RED single-authority and dirty-guard tests**

~~~ts
test('Condition Properties is the only active property authority',()=>{
  const properties=read('components/takeoff/ConditionProperties.tsx');
  assert.match(properties,/Scope/);
  assert.match(properties,/Concrete/);
  assert.match(properties,/Forms/);
  assert.match(properties,/Rebar/);
  assert.match(properties,/Labor/);
  assert.match(properties,/Review/);
  assert.match(properties,/Save & Recalculate/);
  assert.doesNotMatch(properties,/createPortal|querySelector|CustomEvent/);
});

test('dirty Condition selection requires an explicit decision',()=>{
  const editor=read('components/takeoff/useConditionEditor.ts');
  assert.match(editor,/pendingSwitch/);
  assert.match(editor,/discard/);
  assert.match(editor,/saveAndSwitch/);
});
~~~

- [ ] **Step 2: Run tests and verify RED**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-takeoff-specialist-reference.test.ts tests/qa-condition-workstation.test.ts tests/concrete-condition-authoring.test.ts
~~~

Expected: FAIL because the extracted editor/Properties files do not exist.

- [ ] **Step 3: Move current draft/dirty/save logic into useConditionEditor without changing calculation authority**

Preserve these current behaviors from IntegratedTakeoffConditionWorkspace:

- draftFromVersion;
- prepareConditionAuthoringInputs;
- prepareConditionRoleAssignments;
- module enable/input edits;
- repeatable module configurations;
- explicit saveAndRecalculateConcreteConditionPilot;
- upgradeProjectConcreteConditionDraftToLatest;
- primary-role requirement;
- exact dirty signature;
- unsaved-switch guard;
- existing issue routing.

Representative hook return shape:

~~~ts
return {
  selectedVersionId,
  selectedSummary,
  definition,
  draft,
  moduleConfigurations,
  roleSelections,
  dirty,
  saveState,
  availableTabs,
  propertyTab,
  pendingSwitch,
  requestConditionSelection,
  choosePendingSwitchAction,
  updateInput,
  updateModule,
  setRole,
  startRoleMeasurement,
  saveAndRecalculate,
  upgradeContract,
};
~~~

No quantity, Direct Cost, or Sell calculation moves into the hook.

- [ ] **Step 4: Extract ConditionProperties presentation**

Use CarezSaveState, CarezStatus, CarezFeedback, CarezProvenance, CarezNumberField and current shadcn controls.

Scope is the first tab. Present primary and secondary roles in estimator language:

~~~tsx
<Button onClick={()=>onStartRoleMeasurement(primaryRole)}>
  {'Measure '+primaryRole.label}
</Button>
~~~

Calculated outputs are read-only. Unknown, pending, held, not-included, and price-missing states remain explicit.

- [ ] **Step 5: Implement the unsaved-switch actions exactly**

The guard supports:

~~~ts
type DirtySwitchAction='cancel'|'discard'|'save-and-switch';
~~~

- cancel keeps the current Condition/draft;
- discard restores the persisted selected version, then applies the pending selection;
- save-and-switch calls the existing Save & Recalculate action and applies the pending selection only after success;
- save failure keeps the current draft visible and does not switch.

Add tests for all four outcomes, including save failure.

- [ ] **Step 6: Pin contract-upgrade and provenance behavior**

Update qa-condition-workstation.test.ts so contract/version action and the statement that verified Condition history is never changed point to ConditionProperties/useConditionEditor instead of the retiring integrated monolith.

Provenance labels are rendered only from persisted provenance; no value-based inference.

- [ ] **Step 7: Run targeted tests/typecheck**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-takeoff-specialist-reference.test.ts tests/qa-condition-workstation.test.ts tests/concrete-condition-authoring.test.ts tests/condition-repeatable-role-linkage.test.ts
pnpm typecheck
~~~

Expected: PASS.

- [ ] **Step 8: Commit**

~~~bash
git add components/takeoff/useConditionEditor.ts components/takeoff/ConditionProperties.tsx components/takeoff/ConditionProperties.module.css tests/ui-takeoff-specialist-reference.test.ts tests/qa-condition-workstation.test.ts tests/concrete-condition-authoring.test.ts
git commit -m "refactor: extract condition properties editor"
~~~

### Task 5: Extract the authoritative 2D canvas and replace role-measurement events with callbacks

**Files:**
- Create: components/takeoff/TakeoffDrawingCanvas.tsx
- Modify: components/takeoff/TakeoffDrawingWorkspace.tsx
- Modify: components/takeoff/TakeoffDrawingWorkspace.module.css
- Modify: tests/ui-takeoff-specialist-reference.test.ts
- Modify: tests/qa-condition-workstation.test.ts
- Modify: tests/condition-first-cutover.test.ts
- Modify: tests/condition-measurement-update.test.ts
- Modify: tests/scale-regions.test.ts

**Interfaces:**
- Consumes: exact existing geometry helpers/server actions and workspaceProps.
- Produces:
  - ConditionRoleMeasurementRequest
  - TakeoffDrawingCanvasProps with direct active-sheet/selection/role-request callbacks.
  - TakeoffDrawingWorkspace as the legacy Assembly Builder wrapper around TakeoffDrawingCanvas plus legacy panes/dock.

- [ ] **Step 1: Add RED direct-canvas assertions**

~~~ts
test('Condition-first drawing uses a direct canvas API instead of browser events',()=>{
  const canvas=read('components/takeoff/TakeoffDrawingCanvas.tsx');
  assert.match(canvas,/roleMeasurementRequest/);
  assert.match(canvas,/onMeasurementCommitted/);
  assert.match(canvas,/onActiveSheetChange/);
  assert.match(canvas,/onSelectedMeasurementChange/);
  assert.doesNotMatch(canvas,/carez:start-condition-takeoff|CustomEvent/);
});
~~~

Add a behavioral/pure helper test that an LF/SF role request with no valid scale yields scale-required state and leaves the request/Condition context intact.

- [ ] **Step 2: Run drawing/scale tests and verify RED**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-takeoff-specialist-reference.test.ts tests/condition-measurement-update.test.ts tests/scale-regions.test.ts
~~~

- [ ] **Step 3: Extract the current drawing engine with no geometry-semantic rewrite**

Move existing PDF render, normalized page-coordinate geometry, zoom/pan, drawing state, cutouts, vertex edit, duplicate, history, calibration, snap, ortho, and persistence behavior into TakeoffDrawingCanvas.

Use this direct interface shape:

~~~ts
export type ConditionRoleMeasurementRequest={
  requestId:string;
  conditionVersionId:string;
  roleKey:string;
  roleLabel:string;
  assemblyVersionId:string;
  objectName:string;
};

export type TakeoffDrawingCanvasProps=TakeoffDrawingDataProps&{
  activeSheetId:string|null;
  selectedMeasurementId:string|null;
  roleMeasurementRequest:ConditionRoleMeasurementRequest|null;
  conditionPresentation:{hiddenMeasurementIds:string[];colors:Record<string,string>};
  onActiveSheetChange:(sheetId:string|null)=>void;
  onSelectedMeasurementChange:(measurementId:string|null)=>void;
  onMeasurementCommitted:(measurementId:string)=>void;
  onRoleMeasurementRequestConsumed:(requestId:string)=>void;
};
~~~

The canvas continues to call the existing drawing server actions. It does not calculate Condition outputs.

- [ ] **Step 4: Preserve the legacy wrapper**

TakeoffDrawingWorkspace continues to support the Assembly Builder fallback by composing TakeoffDrawingCanvas with its existing legacy navigator, Inspector, and TakeoffQuantityDock.

The Condition-first specialist route will later render TakeoffDrawingCanvas directly and will not render those legacy panes.

- [ ] **Step 5: Replace the role-start CustomEvent path**

Remove the Condition-first listener for carez:start-condition-takeoff from the direct canvas path.

The request arrives through roleMeasurementRequest. After successful commit:

~~~ts
onMeasurementCommitted(createdMeasurementId);
onRoleMeasurementRequestConsumed(roleMeasurementRequest.requestId);
~~~

The owning specialist controller/editor performs role assignment by stable measurement ID.

- [ ] **Step 6: Preserve scale/calibration behavior and pending intent**

For LF/SF measurement requests:

- if current scale is invalid, do not create geometry;
- retain roleMeasurementRequest;
- expose Scale required and route/open calibration;
- after calibration succeeds, the same request can begin without losing the active Condition/role.

EA/count behavior follows the existing geometry contract and does not invent a scale requirement if current domain behavior does not require one.

- [ ] **Step 7: Preserve exact keyboard/tool behavior**

Keep:

- cursor-centered wheel zoom;
- Space/middle-mouse pan;
- M/E/D/K;
- Arrow nudge;
- Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z;
- PageUp/PageDown;
- S/O;
- Enter/Esc;
- typing-target guards.

M activates the pending/current Condition role measurement when one exists rather than requiring the estimator to reason about a generic assembly.

- [ ] **Step 8: Run geometry/scale/QA tests**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-measurement-update.test.ts tests/scale-regions.test.ts tests/qa-condition-workstation.test.ts tests/condition-first-cutover.test.ts tests/ui-takeoff-specialist-reference.test.ts
pnpm typecheck
~~~

Expected: PASS.

- [ ] **Step 9: Commit**

~~~bash
git add components/takeoff/TakeoffDrawingCanvas.tsx components/takeoff/TakeoffDrawingWorkspace.tsx components/takeoff/TakeoffDrawingWorkspace.module.css tests/ui-takeoff-specialist-reference.test.ts tests/qa-condition-workstation.test.ts tests/condition-first-cutover.test.ts tests/condition-measurement-update.test.ts tests/scale-regions.test.ts
git commit -m "refactor: extract authoritative takeoff canvas"
~~~

### Task 6: Build the six-view Quantity / Estimate Worksheet

**Files:**
- Create: lib/takeoff/specialistWorksheet.ts
- Create: components/takeoff/TakeoffWorksheet.tsx
- Create: components/takeoff/TakeoffWorksheet.module.css
- Create: tests/specialist-worksheet.test.ts
- Modify: app/takeoff/[setId]/page.tsx
- Modify: app/takeoff/actions.ts only if set-specific revalidation is needed
- Modify: tests/condition-worksheet.test.ts
- Modify: tests/ui-takeoff-specialist-reference.test.ts
- Modify: tests/estimate-worksheet.test.ts

**Interfaces:**
- Consumes: measurements, Condition summaries/versions/roles/modules/outputs/holds, Estimate sections, sheets, and existing legacy takeoff_measurement_outputs lineage/provenance.
- Produces:
  - buildSpecialistWorksheetModel(input) returning quantities, resources, labor, pricing, holds, recap.
  - TakeoffWorksheet with selected IDs and direct callbacks.
  - No Sell/margin/customer-price edits.

- [ ] **Step 1: Add RED pure projection tests**

~~~ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {buildSpecialistWorksheetModel} from '../lib/takeoff/specialistWorksheet.ts';

test('missing price is unknown and partial rather than zero-cost authority',()=>{
  const model=buildSpecialistWorksheetModel(fixtureWithMissingRebarPrice());
  assert.equal(model.pricing[0].pricingState,'price_required');
  assert.equal(model.pricing[0].unitCost,null);
  assert.equal(model.recap.directCostComplete,false);
});

test('pending recalculation does not publish stale Condition output as current',()=>{
  const model=buildSpecialistWorksheetModel(fixtureWithPendingCondition());
  assert.equal(model.quantities[0].state,'pending');
  assert.equal(model.recap.pendingConditions,1);
});

test('recap never adds incompatible LF SF and EA into one quantity total',()=>{
  const model=buildSpecialistWorksheetModel(fixtureWithMixedUnits());
  assert.equal('totalQuantity' in model.recap,false);
});
~~~

Define the three small fixtures in tests/specialist-worksheet.test.ts with literal measurement/output/hold rows. They must not call Supabase.

- [ ] **Step 2: Run tests and verify RED**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/specialist-worksheet.test.ts tests/condition-worksheet.test.ts
~~~

- [ ] **Step 3: Expand only route SELECT fields already present in schema**

For project_condition_outputs select:

~~~text
id,condition_version_id,module_instance_id,driver_measurement_role_id,
output_key,output_instance_key,label,resource_class,production_quantity,
production_unit,status,estimated_man_hours,unit_cost,direct_cost,
pricing_status,provenance,legacy_takeoff_output_id,generated_estimate_item_id
~~~

For legacy takeoff_measurement_outputs include id, catalog_item_id, resource_behavior, cost_source and existing output facts needed by the projector.

No migration.

- [ ] **Step 4: Implement the pure projector**

Projection rules:

- Quantities: raw measurement + Condition role + current production-output state.
- Resources: non-labor resource_class outputs; preserve installed/production versus procurement outputs by existing output identity; do not invent procurement demand.
- Labor: labor resource_class plus estimated_man_hours and available production basis.
- Pricing: unit_cost/direct_cost/pricing_status/provenance/generated Estimate lineage.
- Holds: open project_condition_holds plus pricing/labor incompleteness, with explicit destination metadata.
- Recap: unit-compatible aggregates only; directCostComplete is false if any included costed scope is unresolved.

Cost source/provenance is display evidence only. The projector never recalculates price.

- [ ] **Step 5: Implement TakeoffWorksheet while preserving mature dock mechanics**

Carry forward:

- vertical resize;
- collapse;
- virtualization;
- This Sheet / All Sheets;
- search;
- selected-row synchronization;
- resizable columns;
- double-click column reset;
- device-local per-view widths.

Expose exactly:

~~~ts
const WORKSHEET_VIEWS=['quantities','resources','labor','pricing','holds','recap'] as const;
~~~

Use shared Carez status/empty/feedback semantics where appropriate.

- [ ] **Step 6: Wire existing direct-cost override only to Direct Cost**

When a project Condition output has legacy_takeoff_output_id and the revision is editable, Pricing can submit that existing output ID to updateTakeoffOutputPrice.

Never add customer price, margin, markup, overhead, reserve, or Sell fields.

After refresh, manual override renders MANUAL OVERRIDE from persisted pricing_status/provenance.

- [ ] **Step 7: Pin supplier-catalog compatibility without ingestion**

Add a fixture whose output provenance/cost source identifies a normalized catalog/vendor source. Assert Resources/Pricing can expose that string and optional catalog reference.

Also assert the active specialist files contain no network/catalog download/import code or named supplier-specific parser.

- [ ] **Step 8: Run focused tests/typecheck**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/specialist-worksheet.test.ts tests/condition-worksheet.test.ts tests/estimate-worksheet.test.ts tests/ui-takeoff-specialist-reference.test.ts
pnpm typecheck
~~~

Expected: PASS.

- [ ] **Step 9: Commit**

~~~bash
git add lib/takeoff/specialistWorksheet.ts components/takeoff/TakeoffWorksheet.tsx components/takeoff/TakeoffWorksheet.module.css app/takeoff/[setId]/page.tsx app/takeoff/actions.ts tests/specialist-worksheet.test.ts tests/condition-worksheet.test.ts tests/estimate-worksheet.test.ts tests/ui-takeoff-specialist-reference.test.ts
git commit -m "feat: add specialist takeoff worksheet"
~~~

### Task 7: Compose the direct specialist workstation and derived 3D

**Files:**
- Create: components/takeoff/TakeoffSpecialistWorkspace.tsx
- Create: components/takeoff/TakeoffSpecialistWorkspace.module.css
- Modify: components/takeoff/TakeoffConditionWorkflowShell.tsx
- Modify: components/takeoff/TakeoffConditionWorkflowShell.module.css
- Modify: components/takeoff/3d/Takeoff3DViewport.tsx
- Modify: components/takeoff/3d/Takeoff3DToolbar.tsx
- Modify: tests/ui-takeoff-specialist-reference.test.ts
- Modify: tests/qa-condition-workstation.test.ts
- Modify: tests/condition-first-cutover.test.ts
- Modify: tests/derived-3d.test.ts
- Modify: tests/takeoff-3d-selection.test.ts

**Interfaces:**
- Consumes: Task 1 state, Task 3 navigator, Task 4 editor/Properties, Task 5 canvas, Task 6 Worksheet, existing Takeoff3DViewport.
- Produces: one direct synchronized Condition-first workspace with no active DOM/portal/event compatibility coupling.

- [ ] **Step 1: Add RED direct-composition assertions**

~~~ts
test('Condition-first shell composes the specialist workstation directly',()=>{
  const shell=read('components/takeoff/TakeoffConditionWorkflowShell.tsx');
  const specialist=read('components/takeoff/TakeoffSpecialistWorkspace.tsx');
  assert.match(shell,/TakeoffSpecialistWorkspace/);
  assert.doesNotMatch(shell,/IntegratedTakeoffConditionWorkspace|TakeoffShadcnTheme/);
  for(const name of ['TakeoffContextNavigator','TakeoffDrawingCanvas','ConditionProperties','TakeoffWorksheet','Takeoff3DViewport']){
    assert.match(specialist,new RegExp(name));
  }
  assert.doesNotMatch(specialist,/createPortal|querySelector|carez:takeoff-|carez:start-condition-takeoff|CustomEvent/);
});
~~~

- [ ] **Step 2: Run source/3D tests and verify RED**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-takeoff-specialist-reference.test.ts tests/qa-condition-workstation.test.ts tests/takeoff-3d-selection.test.ts
~~~

- [ ] **Step 3: Implement the direct controller**

TakeoffSpecialistWorkspace owns presentation/selection state:

~~~ts
const [navigatorTab,setNavigatorTab]=useState<TakeoffNavigatorTab>('conditions');
const [viewMode,setViewMode]=useState<TakeoffViewMode>('2d');
const [activeSheetId,setActiveSheetId]=useState<string|null>(initialSheetId);
const [selectedMeasurementId,setSelectedMeasurementId]=useState<string|null>(null);
const [worksheetView,setWorksheetView]=useState<TakeoffWorksheetView>('quantities');
const [hiddenConditionVersionIds,setHiddenConditionVersionIds]=useState<Set<string>>(new Set());
const [isolatedConditionVersionId,setIsolatedConditionVersionId]=useState<string|null>(null);
~~~

Condition selection and dirty guards flow through useConditionEditor. Measurement selection resolves the owning role/Condition by stable IDs.

- [ ] **Step 4: Wire role measurement explicitly**

ConditionProperties startRoleMeasurement → controller creates ConditionRoleMeasurementRequest → TakeoffDrawingCanvas commits measurement → controller/editor assigns the new stable measurement ID to the role → Condition remains dirty until Save & Recalculate.

No global event bus.

- [ ] **Step 5: Wire 2D and derived 3D as one selected-object context**

Keep dynamic client-only Takeoff3DViewport. Feed:

- activeSheetId;
- selectedMeasurementId;
- selectedConditionVersionId;
- derived scene;
- view state;
- existing per-sheet camera memory.

3D solid selection calls the same Condition/measurement selection path. A 3D issue selects the owning Condition and destination property tab.

- [ ] **Step 6: Pin 3D failure isolation and preview state**

Tests must prove:

- Takeoff3DViewport contains no source quantity/direct-cost computation;
- unavailable/held 3D does not gate rendering of TakeoffDrawingCanvas, ConditionProperties, or TakeoffWorksheet;
- preview scene state renders Preview · unsaved Condition changes;
- saved/partial scene state is distinguishable without turning 3D into authority.

- [ ] **Step 7: Preserve pane collapse state without events**

TakeoffConditionWorkflowShell owns Navigator/Properties collapse state and passes booleans/callbacks to TakeoffSpecialistWorkspace.

Opening Conditions/Properties uses direct callbacks; remove carez:open-conditions from the active specialist path.

- [ ] **Step 8: Run specialist/3D tests and typecheck**

~~~bash
pnpm exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-takeoff-specialist-reference.test.ts tests/qa-condition-workstation.test.ts tests/condition-first-cutover.test.ts tests/derived-3d.test.ts tests/takeoff-3d-selection.test.ts tests/takeoff-3d-camera.test.ts
pnpm typecheck
~~~

Expected: PASS.

- [ ] **Step 9: Commit**

~~~bash
git add components/takeoff/TakeoffSpecialistWorkspace.tsx components/takeoff/TakeoffSpecialistWorkspace.module.css components/takeoff/TakeoffConditionWorkflowShell.tsx components/takeoff/TakeoffConditionWorkflowShell.module.css components/takeoff/3d/Takeoff3DViewport.tsx components/takeoff/3d/Takeoff3DToolbar.tsx tests/ui-takeoff-specialist-reference.test.ts tests/qa-condition-workstation.test.ts tests/condition-first-cutover.test.ts tests/derived-3d.test.ts tests/takeoff-3d-selection.test.ts
git commit -m "refactor: compose specialist takeoff workstation"
~~~
