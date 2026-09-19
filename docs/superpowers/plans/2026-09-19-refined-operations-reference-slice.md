# Refined Operations Reference Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Subproject 4 Operational Command Spine across Today → Projects → Project Overview without changing existing operational, commercial, project-context, tenant, or calculation authority.

**Architecture:** Keep existing server queries and route/domain derivations authoritative, add only a small shared presentation layer for operational state vocabulary and compact operating metrics, then migrate the three reference surfaces onto the accepted Issue #63/#71/#72 shell and component system. Today becomes exception-first, Projects becomes the canonical select → inspect → act portfolio surface, and Project Overview becomes the full single-job operating record.

**Tech Stack:** Next.js 15.5.24, React 19.2.8, TypeScript 5.9.3, Tailwind CSS v4.3.3, source-owned shadcn/Base UI components, Supabase/PostgreSQL, Node built-in test runner, pnpm 11.19.0.

**Spec:** `docs/superpowers/specs/2026-09-19-refined-operations-reference-slice-design.md`

## Global Constraints

- Start from current `origin/staging`; do not touch `main`.
- Read root `AGENTS.md`, `CODEX.md`, the approved spec, each target file, and direct dependencies before editing.
- Preserve Issue #63 Precision Grid theme/token/density behavior.
- Preserve Issue #71 role-adaptive shell, authoritative project-context route boundary, project switching, navigation personalization, and command-palette behavior.
- Preserve Issue #72 shared state, Data Grid, Inspector, Record Header, empty/error, and accessibility contracts.
- Preserve existing Supabase queries, `company_id` tenant isolation, RLS, Job Spine lineage, and server-authoritative deterministic calculations.
- No schema migration, RLS change, permission redesign, new UI dependency, new AI behavior, Takeoff redesign, Estimate redesign, or unrelated refactor.
- Do not create a second status/badge/color system. Use ADR-024 semantic tokens and shared Carez state components.
- Do not turn unavailable data into zero.
- Do not update `docs/CURRENT_STATE.md` or mark Subproject 4 accepted until authenticated rendered staging QA passes.
- Normal validation is focused tests + `pnpm typecheck`; because this is a cross-route reference slice, final validation also requires `pnpm check`, GitHub Actions, Vercel staging READY, and browser acceptance.
- UI changes are not accepted until browser-tested in representative light/dark and responsive widths.

## File Structure

- Create `lib/ui/operations.ts` — deterministic presentation-only mappings for operational state, priority, and project record status.
- Create `components/carez/operating-metric.tsx` — shared compact metric/metric-strip composition with ADR-024 semantic tokens and no calculation authority.
- Modify `components/carez/index.ts` — export the new shared operating-metric composition.
- Modify `docs/design-system/CAREZ_COMPONENT_PACK.md` — document the new reusable operating-metric composition and Subproject 4 adoption rules.
- Create `tests/ui-refined-operations.test.ts` — pure mapping tests plus source-contract tests for the three reference surfaces.
- Modify `app/page.tsx` — exception-first Today hierarchy and shared state/grid/metric adoption; queries and derivations stay unchanged.
- Preserve `app/projects/page.tsx` unless a compile-only import/type change is required; it remains the server data assembler and direct-job header/action owner.
- Modify `components/projects/JobsOperationsBoard.tsx` — shared Data Grid, status, operating metrics, CarezInspector, responsive persistent/Sheet containment, and action hierarchy.
- Modify `app/projects/[id]/page.tsx` — approved Project Overview operating-record hierarchy using shared components while preserving all current reads and derivations.
- Modify `docs/CURRENT_STATE.md` and `docs/ROADMAP.md` only after the rendered acceptance gate passes.

## Review Focus

1. **Missing summary vs real zero:** a missing budget/forecast/billing/commitment summary must render unavailable/empty language, while an authoritative zero must render as zero. Task 4 adds source-contract assertions for explicit availability guards and the browser matrix checks representative no-data states.
2. **Local Projects selection vs authoritative project context:** selecting a Projects row must not create global project context; only `/projects/[id]` and `/job-setup/[projectId]` remain authoritative. Task 3 adds source tests plus the existing navigation regression suite.
3. **Wide-to-laptop Inspector transition:** a selected project must remain inspectable when the layout moves between persistent desktop Inspector and Sheet containment, without duplicate visible interactive surfaces. Task 3 adds a responsive-source contract and browser checks at 1440/1280/768 widths.
4. **State vocabulary collisions:** project record status, operational readiness, and priority must remain separate and must not silently map unknown values to success. Task 1 pins the three pure mapping functions with unknown-value tests.
5. **Mobile action priority and pointer independence:** Project Overview must move Next Job Action ahead of deep detail on mobile, and Projects must remain operable without hover or double-click. Tasks 3 and 4 add source-contract assertions for Enter/open actions, explicit Inspector actions, and responsive order classes; browser QA verifies real keyboard/mobile behavior.

---

### Task 1: Add shared operational presentation primitives

**Files:**
- Create: `lib/ui/operations.ts`
- Create: `components/carez/operating-metric.tsx`
- Modify: `components/carez/index.ts`
- Modify: `docs/design-system/CAREZ_COMPONENT_PACK.md`
- Create: `tests/ui-refined-operations.test.ts`

**Interfaces:**
- Consumes: `CarezStatusTone` and `CarezVisualTone` from `lib/ui/state.ts`; `cn` from `lib/utils.ts`.
- Produces:
  - `resolveOperationalState(value: unknown): CarezOperationalPresentation | null`
  - `resolvePriority(value: unknown): CarezPriorityPresentation | null`
  - `resolveProjectRecordStatus(value: unknown): CarezRecordStatusPresentation | null`
  - `CarezOperatingMetric`
  - `CarezOperatingMetricStrip`

- [ ] **Step 1: Add failing deterministic mapping tests and shared-component source tests**

Create `tests/ui-refined-operations.test.ts` with this initial content:

```ts
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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-refined-operations.test.ts
```

Expected: FAIL because `lib/ui/operations.ts` and `components/carez/operating-metric.tsx` do not exist.

- [ ] **Step 3: Implement the pure operational presentation mappings**

Create `lib/ui/operations.ts`:

```ts
import type {CarezStatusTone} from './state';

export type CarezOperationalState='ready'|'hold'|'planning'|'setup'|'completed';
export type CarezPriority='critical'|'high'|'normal';
export type CarezProjectRecordStatus='active'|'on_hold'|'planning'|'completed';

export type CarezOperationalPresentation={
  kind:CarezOperationalState;
  label:string;
  tone:CarezStatusTone;
};

export type CarezPriorityPresentation={
  kind:CarezPriority;
  label:string;
  tone:CarezStatusTone;
};

export type CarezRecordStatusPresentation={
  kind:CarezProjectRecordStatus;
  label:string;
  tone:CarezStatusTone;
};

const OPERATIONAL_STATE:Record<CarezOperationalState,CarezOperationalPresentation>={
  ready:{kind:'ready',label:'Ready',tone:'success'},
  hold:{kind:'hold',label:'Hold',tone:'blocked'},
  planning:{kind:'planning',label:'In progress',tone:'info'},
  setup:{kind:'setup',label:'Waiting',tone:'warning'},
  completed:{kind:'completed',label:'Complete',tone:'success'},
};

const PRIORITY:Record<CarezPriority,CarezPriorityPresentation>={
  critical:{kind:'critical',label:'Critical',tone:'error'},
  high:{kind:'high',label:'High',tone:'warning'},
  normal:{kind:'normal',label:'Normal',tone:'neutral'},
};

const PROJECT_RECORD_STATUS:Record<CarezProjectRecordStatus,CarezRecordStatusPresentation>={
  active:{kind:'active',label:'Active',tone:'info'},
  on_hold:{kind:'on_hold',label:'On hold',tone:'blocked'},
  planning:{kind:'planning',label:'Planning',tone:'neutral'},
  completed:{kind:'completed',label:'Complete',tone:'success'},
};

function resolveKnown<K extends string,V>(value:unknown,map:Record<K,V>):V|null{
  if(typeof value!=='string')return null;
  return Object.prototype.hasOwnProperty.call(map,value)?map[value as K]:null;
}

export function resolveOperationalState(value:unknown){
  return resolveKnown(value,OPERATIONAL_STATE);
}

export function resolvePriority(value:unknown){
  return resolveKnown(value,PRIORITY);
}

export function resolveProjectRecordStatus(value:unknown){
  return resolveKnown(value,PROJECT_RECORD_STATUS);
}
```

- [ ] **Step 4: Implement the compact operating-metric composition**

Create `components/carez/operating-metric.tsx`:

```tsx
import * as React from 'react';
import type {CarezVisualTone} from '@/lib/ui/state';
import {cn} from '@/lib/utils';

const toneClass:Record<CarezVisualTone,string>={
  neutral:'text-foreground',
  info:'text-info',
  success:'text-success',
  warning:'text-warning',
  error:'text-destructive',
};

const columnClass={
  4:'sm:grid-cols-2 xl:grid-cols-4',
  5:'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5',
  6:'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6',
} as const;

export function CarezOperatingMetric({
  label,value,help,tone='neutral',className,
}:{
  label:string;
  value:React.ReactNode;
  help?:React.ReactNode;
  tone?:CarezVisualTone;
  className?:string;
}){
  return <div
    data-slot="carez-operating-metric"
    className={cn('min-w-0 bg-background px-3 py-3',className)}
  >
    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
    <div className={cn('mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums',toneClass[tone])}>{value}</div>
    {help?<div className="mt-1 text-xs leading-4 text-muted-foreground">{help}</div>:null}
  </div>;
}

export function CarezOperatingMetricStrip({
  columns,children,className,
}:{
  columns:4|5|6;
  children:React.ReactNode;
  className?:string;
}){
  return <section
    data-slot="carez-operating-metric-strip"
    className={cn('grid gap-px overflow-hidden rounded-md border border-border bg-border',columnClass[columns],className)}
  >
    {children}
  </section>;
}
```

Export it from `components/carez/index.ts`:

```ts
export * from './operating-metric';
```

Keep the existing exports unchanged.

- [ ] **Step 5: Document the shared operating-metric contract**

In `docs/design-system/CAREZ_COMPONENT_PACK.md`, add a short subsection under the shared-state/reference-slice material:

```markdown
### Operating Metric

`CarezOperatingMetric` and `CarezOperatingMetricStrip` provide the compact Overview/Record metric treatment for operational reference surfaces. They render caller-supplied label, value, supporting text, and semantic tone only. They never calculate readiness, cost, cash, production, margin, or commercial state. Favor one compact strip over unrelated metric cards when the values describe one operating position.
```

Do not change `docs/CURRENT_STATE.md`.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-refined-operations.test.ts
pnpm typecheck
```

Expected: both PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add lib/ui/operations.ts components/carez/operating-metric.tsx components/carez/index.ts docs/design-system/CAREZ_COMPONENT_PACK.md tests/ui-refined-operations.test.ts
git commit -m "feat: add operational UI presentation primitives"
```

---

### Task 2: Convert Today to the exception-first Overview reference surface

**Files:**
- Modify: `app/page.tsx`
- Modify: `tests/ui-refined-operations.test.ts`

**Interfaces:**
- Consumes: `CarezOperatingMetric`, `CarezOperatingMetricStrip`, `CarezStatus`, `CarezFeedback`, `CarezEmptyState`, `CarezDataGrid` family, and existing Today server-derived values.
- Produces: the accepted Today hierarchy without changing existing Supabase queries or attention/readiness/cash/pipeline calculations.

- [ ] **Step 1: Add failing Today source-contract tests**

Append to `tests/ui-refined-operations.test.ts`:

```ts
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
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-refined-operations.test.ts
```

Expected: FAIL because Today still uses route-local `OperatingMetric`, `StatusBadge`, generic Table/Card presentation, and metrics precede Management Attention.

- [ ] **Step 3: Replace route-local presentation helpers with shared imports**

In `app/page.tsx`, import:

```tsx
import {
  CarezDataGrid,
  CarezDataGridBody,
  CarezDataGridCell,
  CarezDataGridHead,
  CarezDataGridHeaderCell,
  CarezDataGridRow,
  CarezDataGridTable,
  CarezEmptyState,
  CarezOperatingMetric,
  CarezOperatingMetricStrip,
  CarezStatus,
} from '@/components/carez';
```

Remove the route-local `OperatingMetric` and `StatusBadge` functions.

Keep `money`, `num`, date/time helpers, all Supabase queries, all maps, and all attention/readiness/cash/pipeline derivation code unchanged.

- [ ] **Step 4: Render Management Attention before the metric strip**

Use the existing `attention` array unchanged. Render a compact section before metrics:

```tsx
<section aria-labelledby="today-attention-heading" className="rounded-md border border-border bg-background">
  <div className="flex items-start justify-between gap-4 border-b border-border px-3 py-2.5">
    <div>
      <h2 id="today-attention-heading" className="text-sm font-semibold">Management attention</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Field blockers, cash exceptions, and follow-ups in consequence order.</p>
    </div>
    <CarezStatus tone={attention.length?'error':'neutral'} label={String(attention.length)}/>
  </div>
  {attention.length===0
    ?<div className="p-3"><CarezEmptyState title="No urgent exceptions" description="Today's work can run from the current plan."/></div>
    :<div className="divide-y divide-border">
      {attention.slice(0,8).map((item,index)=><Link
        href={item.href}
        key={item.subject+'-'+index}
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none"
      >
        <CarezStatus tone={item.tone==='danger'?'error':item.tone} label={item.tone==='danger'?'Critical':item.tone==='warning'?'Attention':'Follow up'}/>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{item.subject}</span>
          <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{item.issue}</span>
          <span className="mt-1 block text-[11px] text-muted-foreground">{item.when}</span>
        </span>
        <span className="hidden items-center gap-1 text-xs font-medium text-primary sm:flex">{item.action}<ArrowRight className="size-3"/></span>
      </Link>)}
    </div>}
</section>
```

Do not alter the order in which items are pushed into or sorted within `attention`.

- [ ] **Step 5: Replace five metric cards with one shared operating strip**

Use:

```tsx
<CarezOperatingMetricStrip columns={5} aria-label="Today's operating position">
  <CarezOperatingMetric label="Ready to move" value={String(jobsReady)} help="Jobs with a physical operation ready."/>
  <CarezOperatingMetric label="Hard holds" value={String(jobsHeld)} help="Inspection, setup, or prerequisite blocks work." tone={jobsHeld?'error':'neutral'}/>
  <CarezOperatingMetric label="Field active" value={String(activeFieldJobs)} help={crewWorking+' active field shift'+(crewWorking===1?'':'s')+' right now.'} tone={activeFieldJobs?'info':'neutral'}/>
  <CarezOperatingMetric label="Customers owe" value={money(ar)} help={overdue?money(overdue)+' past due.':'No past-due customer balance.'} tone={overdue?'error':ar?'warning':'neutral'}/>
  <CarezOperatingMetric label="7-day cash" value={money(cashNet)} help={money(cashIn)+' expected in · '+money(cashOut)+' expected out.'} tone={cashNet<0?'warning':'neutral'}/>
</CarezOperatingMetricStrip>
```

- [ ] **Step 6: Move Scheduled Production into the shared Data Grid family**

Preserve current fields, job links, field counts, readiness derivation, and blocked explanation.

The table wrapper becomes:

```tsx
<CarezDataGrid
  isEmpty={todayFieldWork.length===0}
  empty={<CarezEmptyState title="Nothing scheduled today" description="Open Schedule to plan the next ready operation." actions={<Link href="/schedule" className={buttonVariants({variant:'outline',size:'sm'})}>Open schedule</Link>}/>}
>
  <CarezDataGridTable>
    <CarezDataGridHead>
      <CarezDataGridRow>
        <CarezDataGridHeaderCell>Time</CarezDataGridHeaderCell>
        <CarezDataGridHeaderCell>Job</CarezDataGridHeaderCell>
        <CarezDataGridHeaderCell>Operation</CarezDataGridHeaderCell>
        <CarezDataGridHeaderCell>Field</CarezDataGridHeaderCell>
        <CarezDataGridHeaderCell>Readiness</CarezDataGridHeaderCell>
      </CarezDataGridRow>
    </CarezDataGridHead>
    <CarezDataGridBody>
      {todayFieldWork.map(itemRaw=>{
        const item:any=itemRaw;
        const job:any=joinedProject(item);
        const rr:any=item.work_package_operation_id?opReady.get(item.work_package_operation_id):null;
        const readiness=rr?.ready_to_start_all===false?'blocked':rr?.ready_to_start_all===true?'ready':'scheduled';
        const field=fieldMap.get(item.project_id)||{working:0,review:0};
        return <CarezDataGridRow key={item.id}>
          <CarezDataGridCell numeric>{fmtTime(item.start_time)||'—'}</CarezDataGridCell>
          <CarezDataGridCell>{item.project_id?<Link href={'/projects/'+item.project_id} className="font-medium hover:text-primary">{job?.job_number||'Job'}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{job?.name||'Project'}</span></Link>:<span className="font-medium">{job?.job_number||'Job'}</span>}</CarezDataGridCell>
          <CarezDataGridCell><span className="font-medium">{item.title}</span>{readiness==='blocked'&&rr?.start_next_action?<span className="mt-0.5 block max-w-56 whitespace-normal text-xs text-muted-foreground">{rr.start_next_action}</span>:null}</CarezDataGridCell>
          <CarezDataGridCell><span className="font-medium">{field.working?field.working+' working':'—'}</span>{field.review?<span className="mt-0.5 block text-xs text-muted-foreground">{field.review} timecard review</span>:null}</CarezDataGridCell>
          <CarezDataGridCell><CarezStatus tone={readiness==='blocked'?'blocked':readiness==='ready'?'success':'neutral'} label={readiness==='blocked'?'Blocked':readiness==='ready'?'Ready':'Scheduled'}/></CarezDataGridCell>
        </CarezDataGridRow>;
      })}
    </CarezDataGridBody>
  </CarezDataGridTable>
</CarezDataGrid>
```

- [ ] **Step 7: Convert What Moves Next to shared state/grid semantics**

Keep the existing eight-row cap and all existing job/customer/field/budget facts.

Use `CarezStatus` for project/operational state and `CarezDataGrid` for the table wrapper. Keep the current explicit unavailable copy:

```tsx
<span className="text-xs text-muted-foreground">No authoritative budget snapshot</span>
```

Do not introduce a Today Inspector.

- [ ] **Step 8: Keep pipeline and cash as secondary supporting panels**

Keep the current data and route links. Reduce nested metric-card visual weight using bordered sections and tabular values, but do not change:

```text
Open leads
Proposals out
Needs reply
Proposal value
Next follow-up
Customers owe
Past due
7-day expected in
7-day expected out
7-day net
```

- [ ] **Step 9: Run focused test and typecheck**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-refined-operations.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit Task 2**

```bash
git add app/page.tsx tests/ui-refined-operations.test.ts
git commit -m "refactor: align Today with operational command spine"
```

---

### Task 3: Convert Projects to the canonical select → inspect → act control surface

**Files:**
- Modify: `components/projects/JobsOperationsBoard.tsx`
- Preserve unless compile requires otherwise: `app/projects/page.tsx`
- Modify: `tests/ui-refined-operations.test.ts`

**Interfaces:**
- Consumes: Task 1 operational-state helpers and metric components; Issue #72 `CarezDataGrid`, `CarezStatus`, `CarezInspector`, `CarezEmptyState`; existing `JobsBoardRow` and `JobsBoardMetrics`.
- Produces: selected-row portfolio grid plus shared Inspector with primary/contextual actions and responsive persistent/Sheet containment.

- [ ] **Step 1: Add failing Projects source-contract tests**

Append:

```ts
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
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-refined-operations.test.ts
```

Expected: FAIL because Projects still uses route-local `ToneBadge`, `Kpi`, shadcn Table, and Sheet-only inspector composition.

- [ ] **Step 3: Replace route-local status/KPI/table presentation with shared components**

In `components/projects/JobsOperationsBoard.tsx`, import:

```tsx
import {
  CarezDataGrid,
  CarezDataGridBody,
  CarezDataGridCell,
  CarezDataGridHead,
  CarezDataGridHeaderCell,
  CarezDataGridRow,
  CarezDataGridTable,
  CarezEmptyState,
  CarezInspector,
  CarezInspectorBody,
  CarezInspectorFooter,
  CarezInspectorHeader,
  CarezInspectorSection,
  CarezOperatingMetric,
  CarezOperatingMetricStrip,
  CarezStatus,
} from '@/components/carez';
import {resolveOperationalState,resolvePriority} from '@/lib/ui/operations';
```

Remove route-local `stateMeta`, `ToneBadge`, and `Kpi`.

Keep `priorityFor(row)` only as the domain-neutral choice of `critical | high | normal`, or replace it with:

```ts
function priorityKindFor(row:JobsBoardRow){
  if(row.state==='hold')return 'critical' as const;
  if(row.attention)return 'high' as const;
  return 'normal' as const;
}
```

Presentation labels/tones come from `resolvePriority`.

- [ ] **Step 4: Replace the Projects metric cards with the shared five-column strip**

Use:

```tsx
<CarezOperatingMetricStrip columns={5} aria-label="Job operations metrics">
  <CarezOperatingMetric label="Ready to move" value={String(metrics.ready)} help="Jobs with a physical operation ready to start."/>
  <CarezOperatingMetric label="Hard holds" value={String(metrics.holds)} help="Setup, inspection or prerequisites block work." tone={metrics.holds?'error':'neutral'}/>
  <CarezOperatingMetric label="Needs attention" value={String(metrics.attention)} help="Field, labor, billing or budget exceptions." tone={metrics.attention?'warning':'neutral'}/>
  <CarezOperatingMetric label="Field active" value={String(metrics.fieldJobs)} help={metrics.activeShifts+' active field shift'+(metrics.activeShifts===1?'':'s')+' right now.'} tone={metrics.fieldJobs?'info':'neutral'}/>
  <CarezOperatingMetric label="Customers owe" value={money(metrics.customersOwe)} help={metrics.overdue?money(metrics.overdue)+' is past due.':'No overdue customer balance.'} tone={metrics.overdue?'error':metrics.customersOwe?'warning':'neutral'}/>
</CarezOperatingMetricStrip>
```

- [ ] **Step 5: Convert the primary project table to `CarezDataGrid`**

Preserve all current filtering, sorting, row data, dropdown actions, Enter behavior, and double-click convenience.

Use `CarezDataGridRow selected={selectedRow}` so `aria-selected` comes from the shared component:

```tsx
<CarezDataGridRow
  key={row.id}
  selected={selectedRow}
  className="cursor-pointer"
  onClick={()=>setSelectedId(row.id)}
  onDoubleClick={()=>router.push('/projects/'+row.id)}
  tabIndex={0}
  onKeyDown={event=>{if(event.key==='Enter')router.push('/projects/'+row.id)}}
>
```

For state and priority:

```tsx
const state=resolveOperationalState(row.state);
const priority=resolvePriority(priorityKindFor(row));

<CarezDataGridCell>
  {state?<CarezStatus tone={state.tone} label={state.label}/>:<CarezStatus tone="neutral" label="Unknown"/>}
</CarezDataGridCell>

<CarezDataGridCell>
  {priority?<CarezStatus tone={priority.tone} label={priority.label}/>:<CarezStatus tone="neutral" label="Unknown"/>}
</CarezDataGridCell>
```

Unknown presentation must remain neutral and explicit; never default to success.

Use `CarezEmptyState` for the filtered no-result case.

- [ ] **Step 6: Implement responsive persistent Inspector vs Sheet containment**

Add:

```tsx
const [wideInspector,setWideInspector]=useState(false);

useEffect(()=>{
  const media=window.matchMedia('(min-width: 1536px)');
  const update=()=>setWideInspector(media.matches);
  update();
  media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
},[]);
```

Add `useEffect` to the React import.

Wrap the grid/Inspector relationship:

```tsx
<div className={cn('grid min-w-0 gap-4',selected&&wideInspector&&'2xl:grid-cols-[minmax(0,1fr)_22rem]')}>
  <div className="min-w-0">{/* CarezDataGrid */}</div>
  {selected&&wideInspector?<JobInspector row={selected}/>:null}
</div>

<Sheet
  open={Boolean(selected&&!wideInspector)}
  onOpenChange={open=>{if(!open)setSelectedId(null)}}
>
  {selected&&!wideInspector?<SheetContent className="w-[94vw] overflow-y-auto p-0 sm:max-w-md"><JobInspector row={selected}/></SheetContent>:null}
</Sheet>
```

Only one visible/interactive Inspector containment is rendered for the active viewport mode.

- [ ] **Step 7: Rebuild `JobInspector` using the shared Inspector composition**

Use:

```tsx
function JobInspector({row}:{row:JobsBoardRow}){
  const state=resolveOperationalState(row.state);
  const priority=resolvePriority(priorityKindFor(row));
  const contextualAction=row.state==='hold'
    ?{label:'Clear hold',href:'/readiness'}
    :row.pendingTimecards>0
      ?{label:'Review time',href:'/field/review'}
      :null;

  return <CarezInspector className="h-full">
    <CarezInspectorHeader
      title={row.name}
      description={(row.jobNumber||'No job number')+' · '+row.customer}
      status={<div className="flex flex-wrap gap-2">
        {state?<CarezStatus tone={state.tone} label={state.label}/>:<CarezStatus tone="neutral" label="Unknown"/>}
        {priority?<CarezStatus tone={priority.tone} label={priority.label}/>:null}
      </div>}
    />
    <CarezInspectorBody>
      <CarezInspectorSection title="Next operation">
        <div className="text-sm font-medium">{row.nextStep}</div>
        <div className="mt-1 text-xs text-muted-foreground">{row.scheduleDate?shortDate(row.scheduleDate):'Not scheduled'}</div>
      </CarezInspectorSection>

      {row.reasons.length?<CarezInspectorSection title="Current constraints">
        <div className="space-y-2">{row.reasons.map((reason,index)=><p key={index} className="text-xs leading-5 text-muted-foreground">{reason}</p>)}</div>
      </CarezInspectorSection>:null}

      <CarezInspectorSection title="Readiness">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div><dt className="text-muted-foreground">Ready ops</dt><dd className="font-mono text-lg font-semibold tabular-nums">{row.readyOperations}</dd></div>
          <div><dt className="text-muted-foreground">On hold</dt><dd className="font-mono text-lg font-semibold tabular-nums">{row.blockedOperations}</dd></div>
          <div><dt className="text-muted-foreground">Open ops</dt><dd className="font-mono text-lg font-semibold tabular-nums">{row.openOperations}</dd></div>
          <div><dt className="text-muted-foreground">Timecards</dt><dd className="font-mono text-lg font-semibold tabular-nums">{row.pendingTimecards}</dd></div>
        </dl>
      </CarezInspectorSection>

      <CarezInspectorSection title="Field">
        <dl className="space-y-2 text-xs">
          <InspectorRow label="Active shifts">{String(row.activeShifts)}</InspectorRow>
          <InspectorRow label="GPS exceptions">{String(row.gpsExceptions)}</InspectorRow>
          <InspectorRow label="Time review">{String(row.pendingTimecards)}</InspectorRow>
        </dl>
      </CarezInspectorSection>

      <CarezInspectorSection title="Financial position">
        <dl className="space-y-2 text-xs">
          <InspectorRow label="Contract amount">{money(row.contractValue)}</InspectorRow>
          <InspectorRow label="Budget used">{row.budgetUsed?row.budgetUsed.toFixed(1)+'%':'Not available'}</InspectorRow>
          <InspectorRow label="Labor remaining">{row.laborRemaining?row.laborRemaining.toFixed(1)+' MH':'Not available'}</InspectorRow>
          <InspectorRow label="Customer balance">{money(row.customerOwed)}</InspectorRow>
          <InspectorRow label="Past due">{money(row.overdue)}</InspectorRow>
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Approved change orders, committed cost and actual cost are not exposed by the current Jobs summary query, so this inspector does not fabricate them.</p>
      </CarezInspectorSection>
    </CarezInspectorBody>

    <CarezInspectorFooter>
      <Link href={'/projects/'+row.id} className={buttonVariants({size:'sm'})}>Open Project</Link>
      {contextualAction?<Link href={contextualAction.href} className={buttonVariants({variant:'outline',size:'sm'})}>{contextualAction.label}</Link>:null}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm"/>}>More</DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={()=>router.push('/schedule')}>Schedule</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>router.push('/field')}>Field</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>router.push('/billing')}>Billing</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>router.push('/cashflow')}>Cashflow</DropdownMenuItem>
          <DropdownMenuSeparator/>
          <DropdownMenuItem onClick={()=>router.push('/takeoff')}>Takeoff</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>router.push('/estimates')}>Estimates</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CarezInspectorFooter>
  </CarezInspector>;
}
```

Because `router` is local to `JobsOperationsBoard`, either pass `onNavigate:(href:string)=>void` into `JobInspector` or move the Inspector function inside the board component. Prefer the explicit prop:

```ts
function JobInspector({row,onNavigate}:{row:JobsBoardRow;onNavigate:(href:string)=>void})
```

and call `onNavigate('/schedule')`, etc. Do not call `useRouter` from a non-component utility.

- [ ] **Step 8: Run focused tests plus existing navigation/shared-component regressions**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-refined-operations.test.ts tests/ui-navigation.test.ts tests/ui-shared-components.test.ts tests/ui-shared-state.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add components/projects/JobsOperationsBoard.tsx tests/ui-refined-operations.test.ts
git commit -m "refactor: align Projects with select inspect act"
```

---

### Task 4: Recompose Project Overview as the full operating record

**Files:**
- Modify: `app/projects/[id]/page.tsx`
- Modify: `tests/ui-refined-operations.test.ts`

**Interfaces:**
- Consumes: `CarezRecordHeader`, `CarezOperatingMetricStrip`, `CarezOperatingMetric`, `CarezStatus`, `CarezFeedback`, `CarezEmptyState`, `CarezDataGrid`, and `resolveProjectRecordStatus`.
- Produces: the approved full single-job operating record with unchanged server reads and derivations.

- [ ] **Step 1: Add failing Project Overview source-contract tests**

Append:

```ts
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

  assert.match(page,/order-3 lg:order-6/);
  assert.match(page,/order-4 lg:order-3/);
  assert.match(page,/No authoritative budget snapshot|Approve an estimate to establish the baseline/);
  assert.match(page,/Need Progress/);

  for(const href of ['/field/review','/pour-control','/procurement','/forecast','/billing','/change-orders']){
    assert.match(page,new RegExp('href=[{"]?[\x60\'"]?'+href.replace('/','\\/') ));
  }

  assert.doesNotMatch(page,/function Metric/);
  assert.doesNotMatch(page,/amber-|red-|green-|blue-/);
});
```

If the href assertion proves too syntactically brittle for JSX template forms, replace it before committing with exact `page.includes("href=\"/field/review\"")` style assertions for the six static destinations. Do not weaken the contract by removing destination checks.

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-refined-operations.test.ts
```

Expected: FAIL because Project Overview still renders metrics first, uses route-local `Metric`, generic Table/Card surfaces, and does not expose the approved section structure.

- [ ] **Step 3: Keep every current server read and derivation unchanged**

The Promise.all source list must remain:

```ts
[
  supabase.from('projects'),
  supabase.from('project_financial_summary'),
  supabase.from('project_budget_actual_summary'),
  supabase.from('project_billing_summary'),
  supabase.from('project_commitment_summary'),
  supabase.from('project_cost_to_complete_summary'),
  supabase.from('production_rate_history'),
  supabase.from('employee_shift_sessions'),
  supabase.from('change_orders'),
  supabase.from('pour_plans'),
]
```

Keep the existing tenant/project filters, current `warnings` pushes, `budgetUsed`, `laborUsed`, `forecastVariance`, `forecastMargin`, `targetMargin`, `activeCO`, `approvedCO`, and `nextPour` derivations.

Do not introduce browser-side recalculation of these values.

- [ ] **Step 4: Add shared imports and project-record status to the Record Header**

Import the shared components from `@/components/carez` and:

```ts
import {resolveProjectRecordStatus} from '@/lib/ui/operations';
```

Resolve status:

```ts
const projectStatus=resolveProjectRecordStatus(p.status);
```

Render:

```tsx
<CarezRecordHeader
  eyebrow={<span className="font-mono text-xs font-semibold text-muted-foreground">{p.job_number}</span>}
  title={p.name}
  description={<>{[p.address,p.city,p.state].filter(Boolean).join(', ')||'Job address not entered'}{p.customers?.name?' · '+p.customers.name:''}</>}
  status={projectStatus?<CarezStatus tone={projectStatus.tone} label={projectStatus.label}/>:<CarezStatus tone="neutral" label={String(p.status||'Unknown')}/>}
  actions={<>
    <Link className={buttonVariants({size:'sm'})} href="/field/review">Review Crew Time</Link>
    <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/pour-control">Plan Pour</Link>
    <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/procurement">Order Materials</Link>
  </>}
/>
```

Record status is not the same as readiness or priority.

- [ ] **Step 5: Put Attention first and use shared semantic feedback**

Wrap the main route content after the Record Header in a mobile-first ordered container:

```tsx
<div className="flex flex-col gap-6">
  <section className="order-1" aria-labelledby="project-attention-heading">{/* Attention */}</section>
  <section className="order-2" aria-labelledby="project-operating-heading">{/* Operating Position */}</section>
  <section className="order-3 lg:order-6" aria-labelledby="project-next-action-heading">{/* Next Job Action */}</section>
  <section className="order-4 lg:order-3" aria-labelledby="project-field-production-heading">{/* Field & Production */}</section>
  <section className="order-5 lg:order-4" aria-labelledby="project-cost-forecast-heading">{/* Cost & Forecast */}</section>
  <section className="order-6 lg:order-5" aria-labelledby="project-commercial-heading">{/* Commercial & Billing */}</section>
</div>
```

For warnings:

```tsx
{warnings.length===0
  ?<CarezFeedback tone="success" title="Nothing urgent on this job">No payroll, GPS, budget, collections or change-order warnings are showing.</CarezFeedback>
  :<div className="space-y-2">{warnings.map((warning,index)=><CarezFeedback
      key={index}
      tone={warning.tone==='bad'?'error':'warning'}
      title={warning.title}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{warning.copy}</span>
        <Link className={buttonVariants({variant:'outline',size:'sm'})} href={warning.href}>{warning.action}</Link>
      </div>
    </CarezFeedback>)}</div>}
```

Do not alter how `warnings` is derived.

- [ ] **Step 6: Replace six metric cards with the shared operating strip**

Use the current values unchanged:

```tsx
<CarezOperatingMetricStrip columns={6}>
  <CarezOperatingMetric label="Contract" value={money(f.adjusted_contract||p.contract_value)} help="Original contract plus approved changes."/>
  <CarezOperatingMetric label="Budget Used" value={pct(budgetUsed)} help={b.project_id?(b.label?'Against '+b.label+'.':'Current approved budget position.'):'Approve an estimate to establish the baseline.'} tone={!b.project_id?'neutral':budgetUsed>=100?'error':budgetUsed>=85?'warning':'neutral'}/>
  <CarezOperatingMetric label="Labor Hours Used" value={num(b.budget_labor_hours)>0?pct(laborUsed):'No Budget'} help={hrs(b.actual_labor_hours)+' used · '+hrs(b.labor_hours_remaining)+' remaining.'} tone={laborUsed>=100?'error':laborUsed>=85?'warning':'neutral'}/>
  <CarezOperatingMetric label="Customer Owes Us" value={money(bill.outstanding_ar)} help={num(bill.overdue_ar)>0?money(bill.overdue_ar)+' is past due.':'No overdue customer balance.'} tone={num(bill.overdue_ar)>0?'error':num(bill.outstanding_ar)>0?'warning':'neutral'}/>
  <CarezOperatingMetric label="Money Already Ordered" value={money(commit.open_po_commitments)} help={num(commit.open_po_count)+' open purchase order'+(num(commit.open_po_count)===1?'':'s')+'.'}/>
  <CarezOperatingMetric label="Where Job Is Headed" value={fc.project_id?forecastMargin.toFixed(1)+'% margin':'Need Progress'} help={fc.project_id?money(forecastVariance)+' vs budget at completion.':'Update scope progress to build a forecast.'} tone={!fc.project_id?'neutral':forecastVariance<0?'error':forecastMargin<targetMargin?'warning':'neutral'}/>
</CarezOperatingMetricStrip>
```

Do not infer an unavailable forecast or budget from zero-valued fallback objects.

- [ ] **Step 7: Build Field & Production from existing facts**

Keep Crew Today values/actions, Next Pour facts, and production history.

Use `CarezDataGrid` for production:

```tsx
<CarezDataGrid
  isEmpty={prod.length===0}
  empty={<CarezEmptyState title="No measured production yet" description="When employees clock tasks and you verify quantities, the actual rates appear here."/>}
>
  <CarezDataGridTable>
    <CarezDataGridHead>
      <CarezDataGridRow>
        <CarezDataGridHeaderCell>Date</CarezDataGridHeaderCell>
        <CarezDataGridHeaderCell>Task</CarezDataGridHeaderCell>
        <CarezDataGridHeaderCell numeric>Built</CarezDataGridHeaderCell>
        <CarezDataGridHeaderCell numeric>Crew MH</CarezDataGridHeaderCell>
        <CarezDataGridHeaderCell numeric>Rate</CarezDataGridHeaderCell>
        <CarezDataGridHeaderCell numeric>Estimating Factor</CarezDataGridHeaderCell>
      </CarezDataGridRow>
    </CarezDataGridHead>
    <CarezDataGridBody>
      {prod.map(row=><CarezDataGridRow key={row.work_date+'-'+row.production_task_id}>
        <CarezDataGridCell>{row.work_date}</CarezDataGridCell>
        <CarezDataGridCell>{row.task_name}</CarezDataGridCell>
        <CarezDataGridCell numeric>{num(row.quantity_completed).toFixed(1)} {row.unit}</CarezDataGridCell>
        <CarezDataGridCell numeric>{num(row.man_hours).toFixed(1)} MH</CarezDataGridCell>
        <CarezDataGridCell numeric>{num(row.units_per_man_hour).toFixed(2)} {row.unit}/MH</CarezDataGridCell>
        <CarezDataGridCell numeric>{num(row.man_hours_per_unit).toFixed(3)} MH/{row.unit}</CarezDataGridCell>
      </CarezDataGridRow>)}
    </CarezDataGridBody>
  </CarezDataGridTable>
</CarezDataGrid>
```

Next Pour retains `nextPour.name`, `scheduled_date`, `expected_concrete_yards`, `status`, and `/pour-control`.

- [ ] **Step 8: Recompose Cost & Forecast without changing source values**

Render aligned Actual/Budget rows:

```tsx
const costRows=[
  ['Labor',num(b.actual_direct_labor_cost),num(b.budget_direct_labor_cost)],
  ['Materials',num(b.actual_material_cost),num(b.budget_material_cost)],
  ['Equipment',num(b.actual_equipment_cost),num(b.budget_equipment_cost)],
  ['Subs / Other',num(b.actual_subcontractor_cost)+num(b.actual_other_direct_cost),num(b.budget_subcontractor_cost)+num(b.budget_other_direct_cost)],
  ['Total Company Cost',num(b.actual_total_company_cost),num(b.budget_total_company_cost)],
] as const;
```

Render those values as three aligned columns: label, Actual, Budget. This is display formatting only.

Forecast uses existing `fc.project_id` as the availability guard. If false, render `CarezEmptyState` or neutral `CarezFeedback` with:

```text
Need Progress
Update scope progress to build a forecast.
```

If true, show forecast margin, target margin, variance to budget, and the existing `/forecast` action.

- [ ] **Step 9: Recompose Commercial & Billing**

Preserve billing facts:

```text
Authorized Work
Billed
Not Yet Billed
Cash Collected
Still Owed
```

Preserve current change-order rows and counts.

Use `CarezStatus` for change-order status:

```tsx
<CarezStatus
  tone={co.status==='approved'?'success':co.status==='submitted'?'info':'neutral'}
  label={String(co.status||'Unknown').replace(/_/g,' ')}
/>
```

Do not add approval mutation behavior.

- [ ] **Step 10: Move Next Job Action upward on mobile and keep related workflows compact**

The `order-3 lg:order-6` wrapper places Next Job Action after Operating Position on mobile and last on desktop.

Render the authoritative value:

```tsx
<section className="order-3 lg:order-6" aria-labelledby="project-next-action-heading">
  <div className="rounded-md border border-border bg-muted/15 px-4 py-4">
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Next Job Action</div>
    <h2 id="project-next-action-heading" className="mt-2 text-lg font-semibold tracking-tight">{p.next_action||'No next action entered yet.'}</h2>
  </div>
  <div className="mt-3 flex flex-wrap gap-2" aria-label="Related workflows">
    <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/field/review">Review Crew Time</Link>
    <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/procurement">Procurement</Link>
    <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/change-orders">Change Orders</Link>
    <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/forecast">Forecast</Link>
    <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/billing">Billing</Link>
    <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/pour-control">Pour Control</Link>
  </div>
</section>
```

Do not infer or rewrite `p.next_action`.

- [ ] **Step 11: Run focused tests plus accepted UI regressions**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-refined-operations.test.ts tests/ui-navigation.test.ts tests/ui-shared-components.test.ts tests/ui-shared-state.test.ts tests/ui-authority-contract.test.ts tests/ui-token-contract.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 12: Commit Task 4**

```bash
git add app/projects/[id]/page.tsx tests/ui-refined-operations.test.ts
git commit -m "refactor: align project overview operating record"
```

---

### Task 5: Cross-route regression hardening, full validation, staging delivery, and rendered acceptance

**Files:**
- Modify if required by review only: `tests/ui-refined-operations.test.ts`
- Modify after browser acceptance only: `docs/CURRENT_STATE.md`
- Modify after browser acceptance only: `docs/ROADMAP.md`
- Modify after browser acceptance only if the implemented contract changed materially: `docs/design-system/CAREZ_COMPONENT_PACK.md`

**Interfaces:**
- Consumes: all Task 1–4 changes and the approved Subproject 4 spec.
- Produces: a validated staging implementation and, only after rendered QA passes, canonical acceptance documentation.

- [ ] **Step 1: Add final cross-route trust and scope assertions**

Append:

```ts
test('reference slice preserves unavailable-state language and route boundaries',()=>{
  const today=read('app/page.tsx');
  const projects=read('components/projects/JobsOperationsBoard.tsx');
  const overview=read('app/projects/[id]/page.tsx');

  assert.match(today,/No authoritative budget snapshot/);
  assert.match(overview,/Need Progress/);
  assert.match(projects,/does not fabricate them/);

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
```

- [ ] **Step 2: Run focused and full local validation**

Run exactly:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-refined-operations.test.ts
pnpm typecheck
pnpm check
```

Expected: all PASS.

- [ ] **Step 3: Verify implementation scope before push**

Run:

```bash
git status --short
git diff --name-only 5daf31811242514d585477765aef7051eb74a2a7...HEAD
```

Expected implementation-path set is limited to:

```text
lib/ui/operations.ts
components/carez/operating-metric.tsx
components/carez/index.ts
components/projects/JobsOperationsBoard.tsx
app/page.tsx
app/projects/[id]/page.tsx
tests/ui-refined-operations.test.ts
docs/design-system/CAREZ_COMPONENT_PACK.md
```

`app/projects/page.tsx` may appear only if a compile-required import/type/header cleanup was necessary and did not change queries or direct-job behavior.

No Takeoff, Estimate, migration, RLS, auth, shell-navigation, or `main` files should appear.

- [ ] **Step 4: Push bounded implementation commits to `staging`**

Run:

```bash
git push origin staging
```

Do not push or merge `main`.

- [ ] **Step 5: Confirm post-push CI and deployed staging authority**

Verify the pushed head receives:

```text
GitHub Actions
- Typecheck: SUCCESS
- Domain/UI tests: SUCCESS
- Build: SUCCESS

Vercel
- matching staging commit: READY
```

If CI or Vercel fails, fix only the root cause within Subproject 4 scope, rerun the relevant focused test plus `pnpm check`, commit the bounded fix, and reverify.

- [ ] **Step 6: Execute the authenticated browser acceptance matrix**

Verify these viewport/theme combinations:

```text
Wide desktop      1440 × 900 or wider
Standard laptop   1280 × 800 class
Tablet/narrow      768 × 1024 class
Mobile             390 × 844 class

Theme
- Light
- Dark
```

Run the continuous journey:

```text
Today
→ Management Attention first
→ Operating Position
→ Scheduled Production
→ What Moves Next

Projects
→ search/filter/sort
→ row selection does not navigate
→ selected state is visible and semantic
→ Inspector matches selected job
→ keyboard Enter opens project
→ Open Project is primary
→ no fabricated unavailable facts

Project Overview
→ Project Context identifies the same project
→ Record Header identifies the same project
→ Attention
→ Operating Position
→ Field & Production
→ Cost & Forecast
→ Commercial & Billing
→ Next Job Action / related workflows

Project switch
→ /projects/[newId]
→ all displayed facts belong to the new project
→ no stale previous-project state
```

Also verify:

- visible keyboard focus;
- Sheet focus/escape behavior at non-wide widths;
- no hover-only or double-click-only essential action;
- no page-level horizontal overflow;
- Data Grid horizontal containment where needed;
- mobile Next Job Action appears before deep Field/Cost/Commercial detail;
- reduced-motion preference does not remove meaning;
- light/dark semantic contrast is coherent;
- Projects grid remains usable at 1280px.

- [ ] **Step 7: Stop if rendered acceptance has not explicitly passed**

Do not update `docs/CURRENT_STATE.md`, do not close the eventual Subproject 4 tracking issue, and do not describe the slice as accepted until the browser matrix has explicitly passed.

- [ ] **Step 8: After explicit browser acceptance, reconcile canonical state**

Update `docs/CURRENT_STATE.md` to record:

```markdown
Subproject 4 — refined-operations reference slice `Today → Projects → Project Overview` — is accepted on staging at the accepted implementation SHA. The Operational Command Spine now proves the Overview/Record archetypes, shared semantic state, Projects select → inspect → act workflow, Project Context continuity, responsive behavior, and dual-theme Precision Grid presentation across the reference path.
```

Update `docs/ROADMAP.md` so the next UI/UX redesign gate is Subproject 5 — Project → Takeoff specialist reference — and explicitly preserve Issues #63, #71, #72, and Subproject 4 as accepted prerequisites.

Do not restate historical implementation detail beyond what canonical current state and sequence require.

- [ ] **Step 9: Validate and commit the post-acceptance docs only**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Then:

```bash
git add docs/CURRENT_STATE.md docs/ROADMAP.md docs/design-system/CAREZ_COMPONENT_PACK.md
git commit -m "docs: record refined operations acceptance"
git push origin staging
```

If `CAREZ_COMPONENT_PACK.md` did not require a post-acceptance wording change, omit it from `git add`.

Verify matching GitHub Actions success and Vercel staging READY for the documentation commit.

---

## Implementation Commit Sequence

Use these bounded commits unless a task produces no source change:

```text
feat: add operational UI presentation primitives
refactor: align Today with operational command spine
refactor: align Projects with select inspect act
refactor: align project overview operating record
docs: record refined operations acceptance
```

A small root-cause fix discovered during validation may use one additional bounded `fix:` commit. Do not squash unrelated accepted work.

## Final Acceptance Checklist

- [ ] Today is exception-first and no longer reads primarily as a generic card dashboard.
- [ ] Today preserves all existing query/calculation behavior.
- [ ] Projects preserves search/filter/sort and uses shared Data Grid/status/Inspector components.
- [ ] Projects preserves select → inspect → act.
- [ ] Projects selection remains local workspace state and does not establish project context.
- [ ] Project Overview preserves all existing server reads and warning/financial/production derivations.
- [ ] Project Overview follows the approved operating-record order.
- [ ] Mobile Project Overview promotes Next Job Action before deep detail.
- [ ] Unavailable values remain distinguishable from authoritative zero.
- [ ] No route-local hard-coded semantic palette remains on the migrated surfaces.
- [ ] No new runtime UI dependency exists.
- [ ] No database, RLS, authorization, domain-calculation, Takeoff, or Estimate behavior changed.
- [ ] Focused tests pass.
- [ ] Existing UI contract tests pass.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm check` passes.
- [ ] GitHub Actions passes.
- [ ] Matching Vercel staging deployment is READY.
- [ ] Authenticated browser acceptance matrix passes.
- [ ] `CURRENT_STATE.md` is reconciled only after rendered acceptance.
- [ ] `main` remains untouched.
