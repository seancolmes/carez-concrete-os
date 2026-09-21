'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Layers3,
  Maximize2,
  Move,
  PanelRight,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  createProjectConcreteConditionPilot,
  saveAndRecalculateConcreteConditionPilot,
} from '@/app/takeoff/[setId]/conditionActions';
import {
  CarezConditionTree,
  type CarezConditionTreeNode,
} from '@/components/carez/workspace';
import { CarezNumberField } from '@/components/carez/fields';
import {
  CarezDataGrid,
  CarezDataGridBody,
  CarezDataGridCell,
  CarezDataGridHead,
  CarezDataGridHeaderCell,
  CarezDataGridRow,
  CarezDataGridTable,
} from '@/components/carez/data-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CONDITION_ARCHETYPES, conditionArchetype } from '@/lib/takeoff/conditions/catalog';
import {
  conditionCodeFromName,
  conditionMeasurementMatchesRole,
  prepareConditionAuthoringInputs,
  prepareConditionRoleAssignments,
  type ConditionInputDraft,
} from '@/lib/takeoff/conditions/authoring';
import type {
  ConditionArchetypeKey,
  ConditionInputDefinition,
  ConditionInputGroup,
  ConditionModuleKey,
} from '@/lib/takeoff/conditions/types';
import styles from './ConcreteConditionAuthoring.module.css';

type ConditionSummary = {
  condition_id: string;
  condition_version_id: string;
  code: string;
  name: string;
  revision_no: number;
  version_status: string;
  template_version_id: string;
  archetype_code: ConditionArchetypeKey;
  archetype_name: string;
  measurement_count: number;
  output_count: number;
  held_output_count: number;
  open_hold_count: number;
  direct_cost: number | string;
};

type ConditionVersion = {
  id: string;
  template_version_id: string;
  status: string;
  plan_facts: Record<string, unknown>;
  method_inputs: Record<string, unknown>;
  production_inputs: Record<string, unknown>;
  commercial_inputs: Record<string, unknown>;
  drawing_inputs: Record<string, unknown>;
  updated_at: string;
};

type ConditionAuthoringData = {
  conditions: ConditionSummary[];
  versions: ConditionVersion[];
  templateVersions: Array<{ id: string; legacy_assembly_version_id: string | null }>;
  modules: Array<{
    condition_version_id: string;
    module_key: ConditionModuleKey;
    instance_key: string;
    label: string;
    enabled: boolean;
    input_values: Record<string, unknown>;
    input_provenance: Record<string, unknown>;
    legacy_child_key: string | null;
    sort_order: number;
  }>;
  roles: Array<{
    condition_version_id: string;
    measurement_id: string;
    role_key: string;
    role_instance_key: string;
    sort_order: number;
  }>;
  outputs: Array<{
    id: string;
    condition_version_id: string;
    output_key: string;
    label: string;
    production_quantity: number | string | null;
    production_unit: string;
    status: string;
    direct_cost: number | string;
    pricing_status: string;
    generated_estimate_item_id: string | null;
  }>;
  holds: Array<{
    id: string;
    condition_version_id: string;
    output_id: string | null;
    hold_code: string;
    status: string;
    message: string;
  }>;
  reconciliation: Array<{
    condition_version_id: string;
    output_key: string;
    reconciliation_status: string;
  }>;
};

type Props = {
  setId: string;
  locked: boolean;
  data: ConditionAuthoringData;
  measurements: Array<{
    id: string;
    sheet_id: string | null;
    assembly_version_id: string;
    measurement_type: string;
    raw_quantity: number | string;
    raw_unit: string;
    name: string;
  }>;
  sheets: Array<{ id: string; sheet_number: string | null; title: string | null; page_number: number }>;
  assemblies: Array<{ id: string; name: string; category: string; primary_measurement: string }>;
  assemblyVersions: Array<{ id: string; assembly_id: string; version_no: number }>;
};

type WindowState = { x: number; y: number; width: number; height: number };
type DragState = { x: number; y: number; originX: number; originY: number };
type ResizeState = { x: number; y: number; width: number; height: number };
type EditorTab = ConditionInputGroup;

const GROUP_LABELS: Record<ConditionInputGroup, string> = {
  planFacts: 'Plan facts',
  methods: 'Methods',
  production: 'Production',
  commercial: 'Commercial',
  drawing: '3D',
};
const MODULE_LABELS: Record<ConditionModuleKey, string> = {
  concrete: 'Concrete',
  forms: 'Forms',
  reinforcing: 'Reinforcing',
  anchors_embeds: 'Anchors / embeds',
  slab_systems: 'Slab systems',
  labor: 'Labor',
};
const DEFAULT_WINDOW: WindowState = { x: 190, y: 54, width: 920, height: 690 };
const WINDOW_KEY = 'carez.concreteCondition.window.v1';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const formatQuantity = (value: number | string | null, unit: string) => value === null
  ? '—'
  : `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 })} ${unit}`;
const formatMoney = (value: number | string) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2,
}).format(Number(value || 0));

function currentConditionRows(rows: ConditionSummary[]) {
  const latest = new Map<string, ConditionSummary>();
  for (const row of rows) {
    const existing = latest.get(row.condition_id);
    if (!existing || Number(row.revision_no) > Number(existing.revision_no)) latest.set(row.condition_id, row);
  }
  return [...latest.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function inputDraft(version: ConditionVersion | null): ConditionInputDraft {
  if (!version) return {};
  return {
    planFacts: { ...(version.plan_facts || {}) } as Record<string, any>,
    methods: { ...(version.method_inputs || {}) } as Record<string, any>,
    production: { ...(version.production_inputs || {}) } as Record<string, any>,
    commercial: { ...(version.commercial_inputs || {}) } as Record<string, any>,
    drawing: { ...(version.drawing_inputs || {}) } as Record<string, any>,
  };
}

export function ConcreteConditionAuthoring({
  setId,
  locked,
  data,
  measurements,
  sheets,
  assemblies,
  assemblyVersions,
}: Props) {
  const router = useRouter();
  const windowRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const [open, setOpen] = useState(false);
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    const openConditions = () => setOpen(true);
    window.addEventListener('carez:open-conditions', openConditions);
    return () => window.removeEventListener('carez:open-conditions', openConditions);
  }, []);
  const [windowState, setWindowState] = useState(DEFAULT_WINDOW);
  const [creating, setCreating] = useState(false);
  const [family, setFamily] = useState<ConditionArchetypeKey>('strip_wall_footing');
  const [createName, setCreateName] = useState('Strip / Wall Footing');
  const [createCode, setCreateCode] = useState('STRIP-WALL-FOOTING');
  const [codeTouched, setCodeTouched] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>('planFacts');
  const [draft, setDraft] = useState<ConditionInputDraft>({});
  const [moduleEnabled, setModuleEnabled] = useState<Record<string, boolean>>({});
  const [roleSelections, setRoleSelections] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const conditions = useMemo(() => currentConditionRows(data.conditions || []), [data.conditions]);
  const selectedSummary = conditions.find(row => row.condition_version_id === selectedVersionId) || null;
  const selectedVersion = data.versions.find(row => row.id === selectedVersionId) || null;
  const definition = selectedSummary ? conditionArchetype(selectedSummary.archetype_code) : null;
  const templateVersion = selectedVersion
    ? data.templateVersions.find(row => row.id === selectedVersion.template_version_id) || null
    : null;
  const compatibilityAssemblyVersionId = templateVersion?.legacy_assembly_version_id || null;
  const selectedModules = selectedVersionId
    ? data.modules.filter(row => row.condition_version_id === selectedVersionId).sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const selectedOutputs = selectedVersionId
    ? data.outputs.filter(row => row.condition_version_id === selectedVersionId)
    : [];
  const selectedHolds = selectedVersionId
    ? data.holds.filter(row => row.condition_version_id === selectedVersionId && row.status === 'open')
    : [];
  const selectedReconciliation = selectedVersionId
    ? data.reconciliation.filter(row => row.condition_version_id === selectedVersionId)
    : [];
  const exactCount = selectedReconciliation.filter(row => ['exact', 'held', 'inactive'].includes(row.reconciliation_status)).length;

  const treeNodes = useMemo<CarezConditionTreeNode[]>(() => {
    const footing = conditions.filter(row => row.archetype_code !== 'slab_on_grade');
    const slabs = conditions.filter(row => row.archetype_code === 'slab_on_grade');
    const child = (row: ConditionSummary): CarezConditionTreeNode => ({
      id: row.condition_version_id,
      label: row.name,
      status: Number(row.open_hold_count) ? `${row.open_hold_count} hold${Number(row.open_hold_count) === 1 ? '' : 's'}` : 'Ready',
      color: row.archetype_code === 'slab_on_grade' ? '#60a5fa' : row.archetype_code === 'pad_column_footing' ? '#f59e0b' : '#34d399',
    });
    return [
      { id: 'condition-group-footings', label: 'Footings', children: footing.map(child) },
      { id: 'condition-group-slabs', label: 'Slabs', children: slabs.map(child) },
    ];
  }, [conditions]);

  useEffect(() => {
    if (!selectedVersionId && conditions[0]) setSelectedVersionId(conditions[0].condition_version_id);
    if (selectedVersionId && !conditions.some(row => row.condition_version_id === selectedVersionId) && conditions[0]) {
      setSelectedVersionId(conditions[0].condition_version_id);
    }
  }, [conditions, selectedVersionId]);

  useEffect(() => {
    if (!selectedVersion) return;
    setDraft(inputDraft(selectedVersion));
    setModuleEnabled(Object.fromEntries(selectedModules.map(module => [module.module_key, Boolean(module.enabled)])));
    const assigned = data.roles.filter(row => row.condition_version_id === selectedVersion.id);
    setRoleSelections(Object.fromEntries(assigned.map(role => [role.role_key, role.measurement_id])));
    setMessage('');
  }, [selectedVersion?.id, selectedVersion?.updated_at]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(WINDOW_KEY) || '{}');
      if ([saved.x, saved.y, saved.width, saved.height].every(value => Number.isFinite(Number(value)))) {
        setWindowState({ x: Number(saved.x), y: Number(saved.y), width: Number(saved.width), height: Number(saved.height) });
      }
      if (typeof saved.floating === 'boolean') setFloating(saved.floating);
    } catch { /* Browser storage is optional. */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(WINDOW_KEY, JSON.stringify({ ...windowState, floating })); }
    catch { /* Browser storage is optional. */ }
  }, [windowState, floating]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (dragRef.current && floating) {
        const next = dragRef.current;
        setWindowState(current => ({
          ...current,
          x: clamp(next.originX + event.clientX - next.x, 8, Math.max(8, window.innerWidth - current.width - 8)),
          y: clamp(next.originY + event.clientY - next.y, 8, Math.max(8, window.innerHeight - current.height - 8)),
        }));
      }
      if (resizeRef.current) {
        const next = resizeRef.current;
        setWindowState(current => ({
          ...current,
          width: clamp(next.width + event.clientX - next.x, 680, Math.max(680, window.innerWidth - 24)),
          height: clamp(next.height + event.clientY - next.y, 480, Math.max(480, window.innerHeight - 24)),
        }));
      }
    };
    const end = () => {
      dragRef.current = null;
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [floating]);

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!floating || event.button !== 0 || (event.target as HTMLElement).closest('button,input,select')) return;
    event.preventDefault();
    dragRef.current = { x: event.clientX, y: event.clientY, originX: windowState.x, originY: windowState.y };
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
  };

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { x: event.clientX, y: event.clientY, width: windowState.width, height: windowState.height };
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  };

  const chooseFamily = (key: ConditionArchetypeKey) => {
    const selected = CONDITION_ARCHETYPES[key];
    setFamily(key);
    setCreateName(selected.name);
    setCreateCode(conditionCodeFromName(selected.name));
    setCodeTouched(false);
  };

  const createCondition = () => {
    setMessage('Creating Concrete Condition…');
    startTransition(async () => {
      try {
        const result = await createProjectConcreteConditionPilot({
          takeoffSetId: setId,
          archetypeKey: family,
          code: createCode,
          name: createName,
        });
        setSelectedVersionId(result.condition_version_id);
        setCreating(false);
        setMessage('Condition created. Draw and assign its primary takeoff.');
        router.refresh();
      } catch (error: any) {
        setMessage(error?.message || 'Could not create Concrete Condition.');
      }
    });
  };

  const updateInput = (input: ConditionInputDefinition, value: string) => {
    const parsed = input.valueType === 'number' || input.valueType === 'integer'
      ? (value === '' ? '' : Number(value))
      : value;
    setDraft(current => ({
      ...current,
      [input.group]: { ...(current[input.group] || {}), [input.key]: parsed },
    }));
  };

  const setRole = (roleKey: string, measurementId: string) => {
    setRoleSelections(current => {
      const next = { ...current };
      if (measurementId) {
        for (const key of Object.keys(next)) if (key !== roleKey && next[key] === measurementId) next[key] = '';
      }
      next[roleKey] = measurementId;
      return next;
    });
  };

  const assemblyVersionForRole = (role: NonNullable<typeof definition>['roles'][number]) => {
    if (role.primary && compatibilityAssemblyVersionId) return compatibilityAssemblyVersionId;
    const conditionAssemblyIds = new Set(assemblies.filter(row => row.category === 'Concrete Conditions' && row.primary_measurement === role.unit).map(row => row.id));
    return assemblyVersions.find(version => conditionAssemblyIds.has(version.assembly_id))?.id
      || assemblyVersions.find(version => assemblies.some(assembly => assembly.id === version.assembly_id && assembly.primary_measurement === role.unit))?.id
      || null;
  };

  const startTakeoff = (role: NonNullable<typeof definition>['roles'][number]) => {
    const assemblyVersionId = assemblyVersionForRole(role);
    if (!assemblyVersionId) {
      setMessage(`No ${role.unit} takeoff recipe is available yet.`);
      return;
    }
    window.dispatchEvent(new CustomEvent('carez:start-condition-takeoff', {
      detail: { assemblyVersionId, name: selectedSummary?.name || definition?.name || 'Concrete Condition', roleLabel: role.label },
    }));
    setMessage(`Drawing ${role.label}. Complete the takeoff on the plan, then reopen Conditions to assign it.`);
    setOpen(false);
  };

  const saveCondition = () => {
    if (!selectedVersion || !definition) return;
    const roles = prepareConditionRoleAssignments(definition.roles, roleSelections);
    const primary = definition.roles.find(role => role.primary);
    const anchorId = primary ? roleSelections[primary.key] : '';
    if (!anchorId) {
      setMessage(`Assign ${primary?.label || 'the primary takeoff'} before calculating.`);
      return;
    }
    const { inputs, provenance } = prepareConditionAuthoringInputs(draft);
    setMessage('Saving and reconciling on the server…');
    startTransition(async () => {
      try {
        const result = await saveAndRecalculateConcreteConditionPilot({
          conditionVersionId: selectedVersion.id,
          inputs,
          inputProvenance: provenance,
          modules: selectedModules.map((module, index) => ({
            moduleKey: module.module_key,
            instanceKey: module.instance_key,
            label: module.label,
            enabled: moduleEnabled[module.module_key] !== false,
            inputValues: module.input_values as Record<string, any>,
            inputProvenance: module.input_provenance as Record<string, any>,
            legacyChildKey: module.legacy_child_key,
            sortOrder: module.sort_order || (index + 1) * 10,
          })),
          measurementRoles: roles,
          compatibilityAnchorMeasurementId: anchorId,
        });
        const reconciled = Object.values(result?.reconciliation || {}).reduce((sum: number, value) => sum + Number(value || 0), 0);
        setMessage(`Saved · ${result?.output_count || 0} outputs · ${reconciled} reconciled`);
        router.refresh();
      } catch (error: any) {
        setMessage(error?.message || 'Could not save Concrete Condition.');
      }
    });
  };

  const windowStyle = floating ? ({
    left: windowState.x,
    top: windowState.y,
    width: windowState.width,
    height: windowState.height,
  } as CSSProperties) : ({ '--condition-dock-width': `${windowState.width}px` } as CSSProperties);

  if (!open) return <Button
    type="button"
    data-testid="condition-launcher"
    className={styles.launcher}
    onClick={() => setOpen(true)}
  ><Layers3 />Conditions{conditions.length ? <span>{conditions.length}</span> : null}</Button>;

  return <section
    ref={windowRef}
    data-testid="condition-window"
    className={`${styles.window} ${floating ? styles.floating : styles.docked}`}
    style={windowStyle}
    aria-label="Concrete Condition Properties"
  >
    <header className={styles.titleBar} onPointerDown={beginDrag}>
      <div className={styles.identity}><Move aria-hidden="true" /><span>Concrete Conditions</span><strong>{creating ? 'New condition' : selectedSummary?.name || 'Condition Properties'}</strong></div>
      <div className={styles.windowActions}>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => setFloating(value => !value)} aria-label={floating ? 'Dock Condition Properties' : 'Float Condition Properties'} title={floating ? 'Dock right' : 'Float window'}>{floating ? <PanelRight /> : <Maximize2 />}</Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => setOpen(false)} aria-label="Close Conditions"><X /></Button>
      </div>
    </header>

    <div className={styles.toolbar}>
      <div><span>Plan-driven scope</span><strong>No formulas required</strong></div>
      <Button type="button" size="sm" onClick={() => { setCreating(true); setMessage(''); }} disabled={locked || isPending}><Plus />New condition</Button>
    </div>

    {creating ? <div className={styles.createSurface}>
      <div className={styles.createIntro}><span>Concrete family</span><h2>Start with a governed Condition</h2><p>Choose the concrete system, name the scope, then connect plan geometry and enter job-specific facts.</p></div>
      <div className={styles.familyGrid}>
        {(Object.keys(CONDITION_ARCHETYPES) as ConditionArchetypeKey[]).map(key => {
          const item = CONDITION_ARCHETYPES[key];
          return <button key={key} type="button" data-testid={`condition-family-${key}`} className={family === key ? styles.familyActive : styles.familyCard} onClick={() => chooseFamily(key)}>
            <span>{item.primaryUnit}</span><strong>{item.name}</strong><small>{item.roles.length} takeoff role{item.roles.length === 1 ? '' : 's'} · {item.defaultModules.length} modules</small>
          </button>;
        })}
      </div>
      <div className={styles.createFields}>
        <label><span>Condition name</span><Input value={createName} onChange={event => { const name = event.target.value; setCreateName(name); if (!codeTouched) setCreateCode(conditionCodeFromName(name)); }} /></label>
        <label><span>Code</span><Input value={createCode} onChange={event => { setCodeTouched(true); setCreateCode(event.target.value.toUpperCase()); }} /></label>
      </div>
      <footer className={styles.createFooter}>
        <span role="status">{message}</span>
        <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
        <Button type="button" data-testid="condition-create" onClick={createCondition} disabled={locked || isPending || !createName.trim() || !createCode.trim()}>{isPending ? <RefreshCw className={styles.spin} /> : <Plus />}Create condition</Button>
      </footer>
    </div> : <div className={styles.body}>
      <aside className={styles.treePane}>
        <div className={styles.paneHeading}><span>Conditions</span><small>{conditions.length} total</small></div>
        {conditions.length ? <div data-testid="condition-tree" style={{ minHeight: 0, flex: 1, display: 'flex' }}><CarezConditionTree
          nodes={treeNodes}
          selectedId={selectedVersionId}
          onSelect={node => { if (conditions.some(row => row.condition_version_id === node.id)) setSelectedVersionId(node.id); }}
          className={styles.tree}
        /></div> : <div className={styles.empty}>
          <Layers3 /><strong>No Conditions yet</strong><span>Add Pad Footing, Strip Footing, or Slab-on-Grade scope.</span><Button type="button" size="sm" onClick={() => setCreating(true)} disabled={locked}><Plus />Add condition</Button>
        </div>}
      </aside>

      <main className={styles.editorPane}>
        {!selectedSummary || !selectedVersion || !definition ? <div className={styles.emptyEditor}><Layers3 /><strong>Select a Condition</strong><span>Properties, measurement roles, outputs, and holds appear here.</span></div> : <>
          <div className={styles.conditionHeader}>
            <div><span>{selectedSummary.archetype_name}</span><h2>{selectedSummary.name}</h2><small><code>{selectedSummary.code}</code> · Revision {selectedSummary.revision_no} · {selectedSummary.version_status}</small></div>
            <div className={styles.headerMetrics}><span><strong>{selectedSummary.measurement_count}</strong>takeoffs</span><span><strong>{selectedSummary.output_count}</strong>outputs</span><span className={Number(selectedSummary.open_hold_count) ? styles.warnMetric : ''}><strong>{selectedSummary.open_hold_count}</strong>holds</span></div>
          </div>

          <div className={styles.scrollArea}>
            <section className={styles.section}>
              <div className={styles.sectionTitle}><div><Ruler /><span>Takeoff roles</span></div><small>Geometry remains authoritative</small></div>
              <div className={styles.roleGrid}>
                {definition.roles.map(role => {
                  const choices = measurements.filter(measurement => conditionMeasurementMatchesRole(measurement, role, compatibilityAssemblyVersionId));
                  return <div className={styles.roleRow} key={role.key}>
                    <div className={styles.roleCopy}><strong>{role.label}</strong><span>{role.unit} · {role.primary ? 'Primary' : 'Optional'}</span></div>
                    <select data-testid={`condition-role-${role.key}`} value={roleSelections[role.key] || ''} onChange={event => setRole(role.key, event.target.value)} disabled={locked || isPending}>
                      <option value="">{role.required ? 'Select takeoff…' : 'Not used'}</option>
                      {choices.map(measurement => {
                        const sheet = sheets.find(item => item.id === measurement.sheet_id);
                        return <option key={measurement.id} value={measurement.id}>{measurement.name} · {formatQuantity(measurement.raw_quantity, measurement.raw_unit)} · {sheet?.sheet_number || `Page ${sheet?.page_number || '?'}`}</option>;
                      })}
                    </select>
                    <Button type="button" size="sm" variant="outline" onClick={() => startTakeoff(role)} disabled={locked || isPending}>Draw {role.unit}</Button>
                    {!choices.length && <small className={styles.roleHint}>Draw a {role.unit} takeoff with the required Concrete Condition geometry, then assign it here.</small>}
                  </div>;
                })}
              </div>
              {selectedSummary.archetype_code === 'slab_on_grade' && <div className={styles.inlineNote}>Slab cutouts stay in the authoritative area geometry and automatically reduce net SF.</div>}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionTitle}><div><Layers3 /><span>Modules</span></div><small>Turn scope systems on or off</small></div>
              <div className={styles.modules}>
                {selectedModules.map(module => <label key={module.module_key} className={moduleEnabled[module.module_key] === false ? styles.moduleOff : styles.moduleOn}>
                  <input type="checkbox" checked={moduleEnabled[module.module_key] !== false} onChange={event => setModuleEnabled(current => ({ ...current, [module.module_key]: event.target.checked }))} disabled={locked || isPending} />
                  <span>{MODULE_LABELS[module.module_key] || module.label}</span>
                </label>)}
              </div>
            </section>

            <section className={styles.section}>
              <Tabs value={tab} onValueChange={value => setTab(value as EditorTab)}>
                <TabsList variant="line" className={styles.tabs}>
                  {(Object.keys(GROUP_LABELS) as EditorTab[]).map(group => <TabsTrigger key={group} value={group}>{GROUP_LABELS[group]}</TabsTrigger>)}
                </TabsList>
                {(Object.keys(GROUP_LABELS) as EditorTab[]).map(group => <TabsContent key={group} value={group} className={styles.tabContent}>
                  <div className={styles.fieldGrid}>
                    {definition.inputs.filter(input => input.group === group).map(input => <label key={`${group}-${input.key}`} className={styles.field}>
                      <span>{input.label}</span>
                      {input.valueType === 'select' ? <select value={String(draft[group]?.[input.key] ?? '')} onChange={event => updateInput(input, event.target.value)} disabled={locked || isPending}>
                        <option value="">Select…</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="project_datum">Project datum</option>
                      </select> : <CarezNumberField
                        value={String(draft[group]?.[input.key] ?? '')}
                        onChange={event => updateInput(input, event.target.value)}
                        unit={input.unit}
                        min={input.minimum}
                        max={input.maximum}
                        step={input.valueType === 'integer' ? 1 : 'any'}
                        disabled={locked || isPending}
                      />}
                    </label>)}
                  </div>
                  {!definition.inputs.some(input => input.group === group) && <div className={styles.emptyGroup}>No inputs for this Condition family.</div>}
                  {group === 'drawing' && <div className={styles.inlineNote}>Elevation facts prepare a future derived 3D result. The plan geometry remains the source of truth.</div>}
                </TabsContent>)}
              </Tabs>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionTitle}><div><CheckCircle2 /><span>Calculated outputs</span></div><small>{selectedReconciliation.length ? `${exactCount}/${selectedReconciliation.length} reconciled` : 'Save to calculate'}</small></div>
              <CarezDataGrid isEmpty={!selectedOutputs.length} empty={<div className={styles.gridEmpty}>Assign the primary takeoff and save to calculate server-authoritative outputs.</div>}>
                <CarezDataGridTable>
                  <CarezDataGridHead><CarezDataGridRow><CarezDataGridHeaderCell>Output</CarezDataGridHeaderCell><CarezDataGridHeaderCell>Status</CarezDataGridHeaderCell><CarezDataGridHeaderCell numeric>Quantity</CarezDataGridHeaderCell><CarezDataGridHeaderCell numeric>Direct cost</CarezDataGridHeaderCell></CarezDataGridRow></CarezDataGridHead>
                  <CarezDataGridBody>{selectedOutputs.map(output => <CarezDataGridRow key={output.id}>
                    <CarezDataGridCell><strong>{output.label}</strong><small className={styles.outputMeta}>{output.pricing_status.replaceAll('_', ' ')}</small></CarezDataGridCell>
                    <CarezDataGridCell><span className={`${styles.status} ${styles[`status${output.status}`] || ''}`}>{output.status}</span></CarezDataGridCell>
                    <CarezDataGridCell numeric>{formatQuantity(output.production_quantity, output.production_unit)}</CarezDataGridCell>
                    <CarezDataGridCell numeric>{formatMoney(output.direct_cost)}</CarezDataGridCell>
                  </CarezDataGridRow>)}</CarezDataGridBody>
                </CarezDataGridTable>
              </CarezDataGrid>
            </section>

            {selectedHolds.length ? <section className={styles.holds}>
              <div className={styles.sectionTitle}><div><AlertTriangle /><span>Open holds</span></div><small>Only dependent outputs are held</small></div>
              {selectedHolds.map(hold => <div key={hold.id}><AlertTriangle /><span><strong>{hold.hold_code.replaceAll('_', ' ')}</strong>{hold.message}</span></div>)}
            </section> : null}
          </div>

          <footer className={styles.footer}>
            <span role="status" data-testid="condition-status">{message}</span>
            <Button type="button" data-testid="condition-save" onClick={saveCondition} disabled={locked || isPending || selectedVersion.status !== 'draft'}>{isPending ? <RefreshCw className={styles.spin} /> : <Save />}Save & recalculate</Button>
          </footer>
        </>}
      </main>
    </div>}
    {floating && <button type="button" className={styles.resizeCorner} onPointerDown={beginResize} aria-label="Resize Condition Properties" />}
  </section>;
}
