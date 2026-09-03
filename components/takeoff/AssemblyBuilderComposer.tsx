'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentType,
  type DragEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Box,
  Boxes,
  Braces,
  Check,
  CopyPlus,
  Expand,
  FlaskConical,
  GripHorizontal,
  Hammer,
  Layers3,
  Minimize2,
  Package,
  Plus,
  Search,
  Settings2,
  Sigma,
  Trash2,
  Variable,
  Wrench,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { evaluateTakeoffFormula, takeoffFormulaVariables } from '@/lib/takeoff/formula';
import { compileFormulaExpression, formatFormulaExpression } from '@/lib/takeoff/formulaExpression';
import { evaluateRule } from '@/lib/takeoff/rules';
import {
  deleteAssemblyChild,
  deleteAssemblyComponent,
  deleteAssemblyProperty,
  publishAssemblyDraft,
  reorderAssemblyBlock,
  saveAssemblyChild,
  saveAssemblyComponent,
  saveAssemblyProperty,
} from '@/app/takeoff/[setId]/assemblyActions';
import styles from './AssemblyBuilderComposer.module.css';

type BuilderData = {
  assemblies: any[];
  versions: any[];
  variables: any[];
  components: any[];
  children: any[];
  bindings: any[];
  folders: any[];
  measurements: any[];
};

type Props = {
  setId: string;
  versionId: string;
  builderData: BuilderData;
  focus: boolean;
  onFocusChange: (value: boolean) => void;
  onClose: () => void;
  onCreateAnother: () => void;
};

type IconType = ComponentType<{ size?: number }>;
type EditorKind = 'property' | 'component' | 'child';
type EditorState = { kind: EditorKind; id?: string | null; seed?: Record<string, unknown> } | null;
type DndPayload = { mode?: 'new' | 'existing'; kind?: string; id?: string; versionId?: string; seed?: Record<string, unknown> };
type TestStatus = 'ready' | 'hold' | 'inactive';
type TestRow = {
  id: string;
  label: string;
  type: string;
  quantity: number | null;
  unit: string;
  hours?: number | null;
  status: TestStatus;
  detail?: string;
};

type PropertyForm = {
  key: string;
  label: string;
  valueType: string;
  unit: string;
  defaultValue: string;
  required: boolean;
  propertyGroup: string;
  inputRole: string;
  exposeInTakeoff: boolean;
  allowOverride: boolean;
  options: string;
  sourceNamespace: string;
  sourceKey: string;
};

type ComponentForm = {
  key: string;
  label: string;
  itemType: string;
  resourceBehavior: string;
  outputUnit: string;
  formula: string;
  laborRateFormula: string;
  pricingStrategy: string;
  defaultUnitCost: string;
  conditionProperty: string;
  conditionOperator: string;
  conditionValue: string;
};

type ChildForm = {
  childVersionId: string;
  key: string;
  label: string;
  quantityFormula: string;
  bindings: string;
};

const propertyTypes = ['dimension', 'number', 'percentage', 'boolean', 'enum', 'text'];
const inputRoles = ['plan_fact', 'method_decision', 'production_assumption', 'commercial_assumption', 'derived'];
const commonUnits = ['IN', 'FT', 'LF', 'SF', 'SFCA', 'CF', 'CY', 'EA', 'LB', 'TON', 'GAL', '%', 'HR', 'MH', 'DAY', 'LS', 'LB/LF', 'LB/SF', 'MH/LF', 'MH/SF', 'MH/SFCA', 'MH/LB', 'MH/CY'];

const propertyPalette: Array<{ label: string; icon: IconType; seed: Record<string, unknown> }> = [
  { label: 'Dimension', icon: Variable, seed: { valueType: 'dimension', unit: 'IN', inputRole: 'plan_fact', propertyGroup: 'Plan facts' } },
  { label: 'Number', icon: Sigma, seed: { valueType: 'number', unit: 'EA', inputRole: 'plan_fact', propertyGroup: 'Plan facts' } },
  { label: 'Percentage', icon: Braces, seed: { valueType: 'percentage', unit: '%', inputRole: 'production_assumption', propertyGroup: 'Production' } },
  { label: 'Yes / No', icon: Check, seed: { valueType: 'boolean', unit: '', inputRole: 'method_decision', propertyGroup: 'Means & methods' } },
  { label: 'Choice', icon: Layers3, seed: { valueType: 'enum', unit: '', inputRole: 'method_decision', propertyGroup: 'Means & methods' } },
];

const resourcePalette: Array<{ label: string; icon: IconType; seed: Record<string, unknown> }> = [
  { label: 'Material', icon: Package, seed: { itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'EA', pricingStrategy: 'current_cost' } },
  { label: 'Labor', icon: Hammer, seed: { itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'LF', pricingStrategy: 'current_cost' } },
  { label: 'Owned equipment', icon: Wrench, seed: { itemType: 'equipment', resourceBehavior: 'owned_equipment', outputUnit: 'HR', pricingStrategy: 'current_cost' } },
  { label: 'Rental', icon: Box, seed: { itemType: 'equipment', resourceBehavior: 'rental', outputUnit: 'DAY', pricingStrategy: 'current_cost' } },
  { label: 'Subcontractor', icon: Boxes, seed: { itemType: 'subcontractor', resourceBehavior: 'subcontractor', outputUnit: 'LS', pricingStrategy: 'manual' } },
];

const numberText = (value: unknown, digits = 2) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });
const friendly = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
const sorted = (rows: any[]) => [...rows].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.label || '').localeCompare(String(b.label || '')));
const primaryToken = (unit: string) => unit === 'LF' ? 'Length' : unit === 'SF' ? 'Area' : unit === 'EA' ? 'Count' : unit === 'CY' ? 'Volume' : 'Quantity';
const measuredLabel = (unit: string) => unit === 'LF' ? 'Measured length' : unit === 'SF' ? 'Measured area' : unit === 'EA' ? 'Measured count' : unit === 'CY' ? 'Measured volume' : 'Measured quantity';
const expressionText = (formula: any) => formatFormulaExpression(formula).replaceAll(' × ', ' * ').replaceAll(' ÷ ', ' / ');
const seedString = (seed: Record<string, unknown>, key: string, fallback = '') => typeof seed[key] === 'string' ? String(seed[key]) : fallback;

function conditionFromRule(rule: any) {
  if (!rule?.left?.var || !rule?.right || !('const' in rule.right)) return { property: '', operator: 'eq', value: '' };
  return {
    property: String(rule.left.var).replace(/^properties\./, ''),
    operator: String(rule.op || 'eq'),
    value: String(rule.right.const ?? ''),
  };
}

function makeCondition(property: any, operator: string, raw: string) {
  if (!property || raw === '') return null;
  let value: string | number | boolean = raw;
  if (['number', 'dimension', 'percentage'].includes(property.value_type)) value = Number(raw);
  if (property.value_type === 'boolean') value = raw === 'true';
  return { op: operator, left: { var: `properties.${property.variable_key}` }, right: { const: value } };
}

export function AssemblyBuilderComposer({ setId, versionId, builderData, focus, onFocusChange, onClose, onCreateAnother }: Props) {
  const router = useRouter();
  const [height, setHeight] = useState(408);
  const resizeRef = useRef<{ y: number; height: number } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [paletteTab, setPaletteTab] = useState<'blocks' | 'assemblies'>('blocks');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [testOpen, setTestOpen] = useState(true);
  const [testMeasurementId, setTestMeasurementId] = useState('');
  const [testQuantity, setTestQuantity] = useState('100');
  const [testInputs, setTestInputs] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [isPending, startTransition] = useTransition();

  const version = builderData.versions.find(row => row.id === versionId) || null;
  const assembly = version ? builderData.assemblies.find(row => row.id === version.assembly_id) || null : null;
  const properties = useMemo(() => sorted(builderData.variables.filter(row => row.assembly_version_id === versionId)), [builderData.variables, versionId]);
  const components = useMemo(() => sorted(builderData.components.filter(row => row.assembly_version_id === versionId)), [builderData.components, versionId]);
  const children = useMemo(() => sorted(builderData.children.filter(row => row.assembly_version_id === versionId)), [builderData.children, versionId]);
  const bindings = useMemo(() => builderData.bindings.filter(row => row.assembly_version_id === versionId), [builderData.bindings, versionId]);
  const bindingMap = useMemo(() => new Map(bindings.map(row => [row.variable_id, row])), [bindings]);
  const childOptions = useMemo(() => builderData.versions
    .filter(row => row.status === 'published' && row.id !== versionId)
    .map(row => ({ ...row, assembly: builderData.assemblies.find(item => item.id === row.assembly_id) }))
    .filter(row => Boolean(row.assembly)), [builderData.versions, builderData.assemblies, versionId]);
  const readOnly = version?.status !== 'draft';
  const primaryUnit = String(version?.primary_measurement_snapshot || assembly?.primary_measurement || 'LF');

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!resizeRef.current || focus) return;
      const next = resizeRef.current.height + resizeRef.current.y - event.clientY;
      setHeight(Math.max(285, Math.min(window.innerHeight * .72, next)));
    };
    const end = () => { resizeRef.current = null; document.body.style.cursor = ''; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      document.body.style.cursor = '';
    };
  }, [focus]);

  useEffect(() => {
    setTestInputs(current => {
      const next = { ...current };
      for (const property of properties) {
        if (next[property.variable_key] !== undefined) continue;
        if (property.default_value !== null && property.default_value !== undefined) next[property.variable_key] = String(property.default_value);
        else next[property.variable_key] = property.value_type === 'boolean' ? 'false' : '';
      }
      return next;
    });
  }, [properties]);

  const run = (work: () => Promise<any>, success: string, after?: () => void) => {
    setNotice('Saving…');
    startTransition(async () => {
      try {
        await work();
        setNotice(success);
        setEditor(null);
        router.refresh();
        after?.();
      } catch (error: any) {
        setNotice(error?.message || 'Unable to save assembly change.');
      }
    });
  };

  const dragStart = (event: DragEvent<HTMLElement>, payload: DndPayload) => {
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData('application/x-carez-assembly-block', JSON.stringify(payload));
  };

  const readDrop = (event: DragEvent<HTMLElement>): DndPayload => {
    try { return JSON.parse(event.dataTransfer.getData('application/x-carez-assembly-block') || '{}') as DndPayload; }
    catch { return {}; }
  };

  const dropLane = (event: DragEvent<HTMLElement>, kind: EditorKind) => {
    event.preventDefault();
    if (readOnly) return;
    const payload = readDrop(event);
    if (payload.mode === 'new' && payload.kind === kind) setEditor({ kind, seed: payload.seed || {} });
    if (kind === 'child' && payload.kind === 'childVersion' && payload.versionId) {
      const childVersion = builderData.versions.find(row => row.id === payload.versionId);
      const childAssembly = childVersion ? builderData.assemblies.find(row => row.id === childVersion.assembly_id) : null;
      if (childVersion && childAssembly) {
        setEditor({
          kind: 'child',
          seed: {
            childVersionId: childVersion.id,
            label: childAssembly.name,
            key: normalizeKey(childAssembly.code || childAssembly.name),
            quantityFormula: primaryToken(primaryUnit),
          },
        });
      }
    }
  };

  const dropBefore = (event: DragEvent<HTMLElement>, kind: EditorKind, target: any) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDrop(event);
    if (payload.mode === 'existing' && payload.kind === kind && payload.id && payload.id !== target.id) {
      run(
        () => reorderAssemblyBlock(setId, { versionId, kind, id: payload.id as string, sortOrder: Math.max(0, Number(target.sort_order || 10) - 1) }),
        'Reordered',
      );
      return;
    }
    dropLane(event, kind);
  };

  const selectedMeasurement = builderData.measurements.find(row => row.id === testMeasurementId) || null;
  const compatibleMeasurements = builderData.measurements.filter(row => String(row.raw_unit || '').toUpperCase() === primaryUnit);
  const effectiveQuantity = selectedMeasurement ? Number(selectedMeasurement.raw_quantity || 0) : Number(testQuantity || 0);

  const test = useMemo(() => {
    const values: Record<string, number> = { quantity: effectiveQuantity, 'Takeoff.Quantity': effectiveQuantity };
    if (primaryUnit === 'LF') values['Takeoff.Length'] = effectiveQuantity;
    if (primaryUnit === 'SF') values['Takeoff.Area'] = effectiveQuantity;
    if (primaryUnit === 'EA') values['Takeoff.Count'] = effectiveQuantity;
    if (primaryUnit === 'CY') values['Takeoff.Volume'] = effectiveQuantity;
    const perimeter = selectedMeasurement?.variables?.perimeter_lf ?? selectedMeasurement?.variables?.Perimeter;
    if (Number.isFinite(Number(perimeter))) values['Takeoff.Perimeter'] = Number(perimeter);

    const stored: Record<string, string | number | boolean> = {};
    const required: string[] = [];
    for (const property of properties) {
      const raw = testInputs[property.variable_key];
      if ((raw === '' || raw === undefined) && property.required) { required.push(property.label); continue; }
      if (raw === '' || raw === undefined) continue;
      if (['number', 'dimension', 'percentage'].includes(property.value_type)) {
        const value = Number(raw);
        if (!Number.isFinite(value)) continue;
        stored[property.variable_key] = value;
        values[property.variable_key] = value;
        values[`Properties.${property.variable_key}`] = value;
      } else if (property.value_type === 'boolean') stored[property.variable_key] = raw === 'true';
      else stored[property.variable_key] = raw;
    }

    const rows: TestRow[] = [];
    let errors = 0;
    for (const component of components) {
      try {
        const active = !component.activation_rule || evaluateRule(component.activation_rule, { properties: stored });
        if (!active) {
          rows.push({ id: component.id, label: component.label, type: component.estimate_item_type, quantity: 0, unit: component.output_unit, status: 'inactive', detail: 'Conditional branch inactive' });
          continue;
        }
        const missing = takeoffFormulaVariables(component.quantity_formula).filter(key => values[key] === undefined);
        if (missing.length) {
          rows.push({ id: component.id, label: component.label, type: component.estimate_item_type, quantity: null, unit: component.output_unit, status: 'hold', detail: `Needs ${missing.join(', ')}` });
          continue;
        }
        const quantity = evaluateTakeoffFormula(component.quantity_formula, values);
        let hours: number | null = null;
        if (component.estimate_item_type === 'labor' && component.labor_rate_formula) {
          const rateMissing = takeoffFormulaVariables(component.labor_rate_formula).filter(key => values[key] === undefined);
          if (rateMissing.length) {
            rows.push({ id: component.id, label: component.label, type: 'labor', quantity, unit: component.output_unit, status: 'hold', detail: `Production rate needs ${rateMissing.join(', ')}` });
            continue;
          }
          hours = quantity * evaluateTakeoffFormula(component.labor_rate_formula, values);
        }
        rows.push({ id: component.id, label: component.label, type: component.estimate_item_type, quantity, unit: component.output_unit, hours, status: 'ready' });
      } catch (error: any) {
        errors += 1;
        rows.push({ id: component.id, label: component.label, type: component.estimate_item_type, quantity: null, unit: component.output_unit, status: 'hold', detail: error?.message || 'Formula error' });
      }
    }

    for (const child of children) {
      try {
        const missing = takeoffFormulaVariables(child.quantity_formula).filter(key => values[key] === undefined);
        if (missing.length) rows.push({ id: child.id, label: child.label, type: 'child assembly', quantity: null, unit: '×', status: 'hold', detail: `Needs ${missing.join(', ')}` });
        else rows.push({ id: child.id, label: child.label, type: 'child assembly', quantity: evaluateTakeoffFormula(child.quantity_formula, values), unit: '×', status: 'ready', detail: 'Published nested recipe' });
      } catch (error: any) {
        errors += 1;
        rows.push({ id: child.id, label: child.label, type: 'child assembly', quantity: null, unit: '×', status: 'hold', detail: error?.message || 'Child quantity error' });
      }
    }
    return { rows, required, errors };
  }, [effectiveQuantity, primaryUnit, selectedMeasurement, properties, components, children, testInputs]);

  const holds = test.rows.filter(row => row.status === 'hold').length + test.required.length + test.errors;
  const publishReady = !readOnly && components.length + children.length > 0 && test.errors === 0;

  if (!version || !assembly) {
    return <section className={styles.composer} style={{ height: focus ? '100%' : height }}><div className={styles.missing}>Loading assembly draft…</div></section>;
  }

  return <section className={`${styles.composer} ${focus ? styles.focus : ''}`} style={{ height: focus ? '100%' : height }} aria-label="Assembly Builder">
    {!focus && <button
      type="button"
      className={styles.resizeHandle}
      aria-label="Resize Assembly Builder"
      onPointerDown={event => {
        resizeRef.current = { y: event.clientY, height };
        document.body.style.cursor = 'ns-resize';
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
    ><GripHorizontal size={15} /></button>}

    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.builderMark}><Braces size={16} /></div>
        <div><span>Assembly Builder</span><strong>{assembly.code} · {assembly.name}</strong></div>
        <b className={readOnly ? styles.publishedBadge : styles.draftBadge}>{readOnly ? `Published v${version.version_no}` : `Draft v${version.version_no}`}</b>
      </div>
      <div className={styles.headerStatus}>{notice && <span>{notice}</span>}<span className={holds ? styles.holdText : styles.validText}>{holds ? `${holds} test hold${holds === 1 ? '' : 's'}` : 'Test valid'}</span></div>
      <div className={styles.headerActions}>
        <button type="button" onClick={onCreateAnother}><Plus size={14} />New</button>
        <button type="button" onClick={() => setTestOpen(value => !value)}><FlaskConical size={14} />Test</button>
        <button type="button" onClick={() => onFocusChange(!focus)}>{focus ? <Minimize2 size={14} /> : <Expand size={14} />}{focus ? 'Exit focus' : 'Focus Builder'}</button>
        {!readOnly && <button type="button" className={styles.publishButton} disabled={isPending || !publishReady} onClick={() => run(
          () => publishAssemblyDraft(setId, versionId),
          'Published',
          () => { onFocusChange(false); window.setTimeout(onClose, 300); },
        )}><Check size={14} />Publish</button>}
        <button type="button" className={styles.closeButton} onClick={onClose} title="Close Assembly Builder"><X size={15} /></button>
      </div>
    </header>

    <div className={styles.body}>
      <aside className={styles.palette}>
        <div className={styles.paletteTabs}>
          <button type="button" className={paletteTab === 'blocks' ? styles.active : ''} onClick={() => setPaletteTab('blocks')}>Blocks</button>
          <button type="button" className={paletteTab === 'assemblies' ? styles.active : ''} onClick={() => setPaletteTab('assemblies')}>Assemblies</button>
        </div>
        <label className={styles.paletteSearch}><Search size={12} /><input value={paletteQuery} onChange={event => setPaletteQuery(event.target.value)} placeholder="Find a block" /></label>
        <div className={styles.paletteScroll}>
          {paletteTab === 'blocks' ? <>
            <PaletteGroup title="Job inputs">{propertyPalette.filter(item => item.label.toLowerCase().includes(paletteQuery.toLowerCase())).map(item => <PaletteItem key={item.label} label={item.label} icon={item.icon} disabled={readOnly} onDragStart={event => dragStart(event, { mode: 'new', kind: 'property', seed: item.seed })} onClick={() => !readOnly && setEditor({ kind: 'property', seed: item.seed })} />)}</PaletteGroup>
            <PaletteGroup title="Materials, labor & equipment">{resourcePalette.filter(item => item.label.toLowerCase().includes(paletteQuery.toLowerCase())).map(item => <PaletteItem key={item.label} label={item.label} icon={item.icon} disabled={readOnly} onDragStart={event => dragStart(event, { mode: 'new', kind: 'component', seed: item.seed })} onClick={() => !readOnly && setEditor({ kind: 'component', seed: item.seed })} />)}</PaletteGroup>
            <PaletteGroup title="Advanced"><PaletteItem label="Conditional item" icon={Braces} disabled={readOnly} onDragStart={event => dragStart(event, { mode: 'new', kind: 'component', seed: { itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'EA', pricingStrategy: 'current_cost' } })} onClick={() => !readOnly && setEditor({ kind: 'component', seed: { itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'EA', pricingStrategy: 'current_cost' } })} /></PaletteGroup>
          </> : <PaletteGroup title="Published company recipes">
            {childOptions.filter(row => `${row.assembly.code} ${row.assembly.name}`.toLowerCase().includes(paletteQuery.toLowerCase())).map(row => <PaletteItem key={row.id} label={row.assembly.name} meta={`${row.assembly.code} · v${row.version_no}`} icon={CopyPlus} disabled={readOnly || row.assembly_id === assembly.id} onDragStart={event => dragStart(event, { mode: 'new', kind: 'childVersion', versionId: row.id })} onClick={() => !readOnly && row.assembly_id !== assembly.id && setEditor({ kind: 'child', seed: { childVersionId: row.id, label: row.assembly.name, key: normalizeKey(row.assembly.code), quantityFormula: primaryToken(primaryUnit) } })} />)}
            {!childOptions.length && <div className={styles.paletteEmpty}>Publish a reusable company assembly to nest it here.</div>}
          </PaletteGroup>}
        </div>
      </aside>

      <main className={styles.recipe}>
        <div className={styles.recipeTopline}>
          <div><span>Recipe</span><strong>{friendly(assembly.category)} · {primaryUnit} takeoff</strong></div>
          <div className={styles.recipeStats}><span><b>{properties.length}</b> properties</span><span><b>{components.length}</b> outputs</span><span><b>{children.length}</b> children</span></div>
        </div>

        <RecipeLane title="Inputs" subtitle="Dimensions, spacing, waste, and method choices." icon={Variable} empty="Drag an input here" onDrop={event => dropLane(event, 'property')}>
          {properties.map(property => <PropertyBlock key={property.id} row={property} binding={bindingMap.get(property.id)} readOnly={readOnly} onEdit={() => setEditor({ kind: 'property', id: property.id })} onDelete={() => run(() => deleteAssemblyProperty(setId, versionId, property.id), 'Property removed')} onDragStart={event => dragStart(event, { mode: 'existing', kind: 'property', id: property.id })} onDrop={event => dropBefore(event, 'property', property)} />)}
        </RecipeLane>

        <RecipeLane title="Sub-assemblies" subtitle="Optional reusable company recipes." icon={Layers3} empty="Drag a published assembly here" onDrop={event => dropLane(event, 'child')}>
          {children.map(child => <ChildBlock key={child.id} row={child} data={builderData} readOnly={readOnly} onEdit={() => setEditor({ kind: 'child', id: child.id })} onDelete={() => run(() => deleteAssemblyChild(setId, versionId, child.id), 'Child removed')} onDragStart={event => dragStart(event, { mode: 'existing', kind: 'child', id: child.id })} onDrop={event => dropBefore(event, 'child', child)} />)}
        </RecipeLane>

        <RecipeLane title="Materials & labor" subtitle="What this takeoff creates." icon={Package} empty="Drag a material, labor, or equipment block here" onDrop={event => dropLane(event, 'component')}>
          {components.map(component => <ComponentBlock key={component.id} row={component} properties={properties} readOnly={readOnly} onEdit={() => setEditor({ kind: 'component', id: component.id })} onDelete={() => run(() => deleteAssemblyComponent(setId, versionId, component.id), 'Resource removed')} onDragStart={event => dragStart(event, { mode: 'existing', kind: 'component', id: component.id })} onDrop={event => dropBefore(event, 'component', component)} />)}
        </RecipeLane>
      </main>

      {testOpen && <aside className={styles.testBench}>
        <div className={styles.testHeader}><div><FlaskConical size={14} /><strong>Test Bench</strong></div><button type="button" onClick={() => setTestOpen(false)}><X size={13} /></button></div>
        <div className={styles.testSource}>
          <label><span>Test source</span><select value={testMeasurementId} onChange={event => setTestMeasurementId(event.target.value)}><option value="">Sample {primaryUnit}</option>{compatibleMeasurements.map(measurement => <option key={measurement.id} value={measurement.id}>{measurement.name} · {numberText(measurement.raw_quantity)} {measurement.raw_unit}</option>)}</select></label>
          {!selectedMeasurement && <label><span>Quantity</span><div className={styles.unitInput}><input value={testQuantity} onChange={event => setTestQuantity(event.target.value)} inputMode="decimal" /><b>{primaryUnit}</b></div></label>}
        </div>
        <div className={styles.testInputs}>
          <div className={styles.testSectionTitle}><span>Inputs</span><small>{test.required.length ? `${test.required.length} required` : 'resolved'}</small></div>
          {properties.filter(property => property.input_role !== 'derived').map(property => <TestInput key={property.id} property={property} value={testInputs[property.variable_key] || ''} onChange={value => setTestInputs(current => ({ ...current, [property.variable_key]: value }))} />)}
          {!properties.length && <div className={styles.testEmpty}>Add inputs to test the recipe.</div>}
        </div>
        <div className={styles.testResults}>
          <div className={styles.testSectionTitle}><span>Results</span><small className={holds ? styles.warningText : styles.goodText}>{holds ? `${holds} hold${holds === 1 ? '' : 's'}` : 'valid'}</small></div>
          {test.rows.map(row => <div key={`${row.type}-${row.id}`} className={`${styles.testRow} ${row.status === 'ready' ? styles.testReady : row.status === 'hold' ? styles.testHold : styles.testInactive}`}>
            <div><strong>{row.label}</strong><span>{friendly(row.type)}</span></div>
            <div className={styles.testQty}>{row.quantity === null ? 'HOLD' : `${numberText(row.quantity, 3)} ${row.unit}`}{row.hours !== null && row.hours !== undefined && <small>{numberText(row.hours)} MH</small>}</div>
            {row.detail && <p>{row.detail}</p>}
          </div>)}
          {!test.rows.length && <div className={styles.testEmpty}>Add a material, labor item, or sub-assembly to calculate results.</div>}
        </div>
        <div className={styles.validationStrip}><span className={publishReady ? styles.validDot : styles.holdDot} /><div><strong>{publishReady ? 'Ready to publish' : 'Recipe needs work'}</strong><small>{components.length + children.length ? `${components.length + children.length} output item${components.length + children.length === 1 ? '' : 's'}` : 'Add at least one material, labor item, or sub-assembly.'}</small></div></div>
      </aside>}
    </div>

    {editor && <BlockEditor
      editor={editor}
      versionId={versionId}
      setId={setId}
      properties={properties}
      components={components}
      children={children}
      bindings={bindings}
      childOptions={childOptions}
      primaryUnit={primaryUnit}
      isPending={isPending}
      onCancel={() => setEditor(null)}
      onSave={(work, label) => run(work, label)}
    />}
  </section>;
}

type PaletteItemProps = {
  label: string;
  meta?: string;
  icon: IconType;
  disabled: boolean;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onClick: () => void;
};

function PaletteGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.paletteGroup}><h4>{title}</h4><div>{children}</div></section>;
}

function PaletteItem({ label, meta, icon: Icon, disabled, onDragStart, onClick }: PaletteItemProps) {
  return <button type="button" draggable={!disabled} disabled={disabled} className={styles.paletteItem} onDragStart={onDragStart} onClick={onClick}><Icon size={14} /><span><strong>{label}</strong>{meta && <small>{meta}</small>}</span><GripHorizontal size={13} /></button>;
}

type RecipeLaneProps = {
  title: string;
  subtitle: string;
  icon: IconType;
  empty: string;
  children: ReactNode;
  onDrop: (event: DragEvent<HTMLElement>) => void;
};

function RecipeLane({ title, subtitle, icon: Icon, empty, children, onDrop }: RecipeLaneProps) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className={styles.lane} onDragOver={event => event.preventDefault()} onDrop={onDrop}><header><Icon size={14} /><div><strong>{title}</strong><span>{subtitle}</span></div></header><div className={styles.laneBody}>{hasChildren ? children : <div className={styles.dropEmpty}><Plus size={13} />{empty}</div>}</div></section>;
}

type BlockProps = {
  row: any;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
};

function BlockActions({ readOnly, onEdit, onDelete }: Pick<BlockProps, 'readOnly' | 'onEdit' | 'onDelete'>) {
  return <div className={styles.blockActions}>{!readOnly && <><button type="button" onClick={onEdit} title="Edit block"><Settings2 size={13} /></button><button type="button" className={styles.deleteButton} onClick={onDelete} title="Delete block"><Trash2 size={13} /></button></>}</div>;
}

function PropertyBlock({ row, binding, ...props }: BlockProps & { binding: any }) {
  const source = binding ? `${friendly(binding.source_namespace)} · ${binding.source_key}` : row.default_value !== null && row.default_value !== undefined ? 'Default value' : 'Estimator input';
  return <article className={styles.block} draggable={!props.readOnly} onDragStart={props.onDragStart} onDragOver={event => event.preventDefault()} onDrop={props.onDrop}><div className={styles.blockGrip}><GripHorizontal size={13} /></div><div className={`${styles.blockIcon} ${styles.propertyIcon}`}><Variable size={14} /></div><div className={styles.blockMain}><span>Input</span><strong>{row.label}</strong><small>{source}</small></div><div className={styles.blockMeta}>{row.unit && <b>{row.unit}</b>}<span>{friendly(row.value_type)}</span></div><BlockActions {...props} /></article>;
}

function ComponentBlock({ row, properties, ...props }: BlockProps & { properties: any[] }) {
  const condition = conditionFromRule(row.activation_rule);
  return <article className={styles.block} draggable={!props.readOnly} onDragStart={props.onDragStart} onDragOver={event => event.preventDefault()} onDrop={props.onDrop}><div className={styles.blockGrip}><GripHorizontal size={13} /></div><div className={`${styles.blockIcon} ${row.estimate_item_type === 'labor' ? styles.laborIcon : styles.resourceIcon}`}>{row.estimate_item_type === 'labor' ? <Hammer size={14} /> : <Package size={14} />}</div><div className={styles.blockMain}><span>{friendly(row.estimate_item_type)}</span><strong>{row.label}</strong><small>{formatFormulaExpression(row.quantity_formula)}</small></div>{condition.property && <div className={styles.conditionChip}><Braces size={11} />If {properties.find(property => property.variable_key === condition.property)?.label || condition.property}</div>}<div className={styles.blockMeta}><b>{row.output_unit}</b><span>{row.estimate_item_type === 'labor' && row.labor_rate_formula ? `${formatFormulaExpression(row.labor_rate_formula)} MH/unit` : friendly(row.pricing_strategy || 'current_cost')}</span></div><BlockActions {...props} /></article>;
}

function ChildBlock({ row, data, ...props }: BlockProps & { data: BuilderData }) {
  const version = data.versions.find(item => item.id === row.child_assembly_version_id);
  const assembly = version ? data.assemblies.find(item => item.id === version.assembly_id) : null;
  return <article className={styles.block} draggable={!props.readOnly} onDragStart={props.onDragStart} onDragOver={event => event.preventDefault()} onDrop={props.onDrop}><div className={styles.blockGrip}><GripHorizontal size={13} /></div><div className={`${styles.blockIcon} ${styles.childIcon}`}><Layers3 size={14} /></div><div className={styles.blockMain}><span>Sub-assembly</span><strong>{row.label}</strong><small>{assembly ? `${assembly.code} · ${assembly.name}` : 'Nested recipe'} · {formatFormulaExpression(row.quantity_formula)}</small></div><div className={styles.blockMeta}><b>{assembly?.primary_measurement || '×'}</b><span>{Object.keys(row.variable_bindings || {}).length} mapped inputs</span></div><BlockActions {...props} /></article>;
}

function TestInput({ property, value, onChange }: { property: any; value: string; onChange: (value: string) => void }) {
  const options: any[] = Array.isArray(property.options) ? property.options : [];
  return <label className={styles.testInput}><span>{property.label}{property.unit ? ` · ${property.unit}` : ''}{property.required && <i>*</i>}</span>{property.value_type === 'boolean' ? <select value={value} onChange={event => onChange(event.target.value)}><option value="false">No</option><option value="true">Yes</option></select> : property.value_type === 'enum' ? <select value={value} onChange={event => onChange(event.target.value)}><option value="">Select…</option>{options.map(option => <option value={option.value} key={option.value}>{option.label || option.value}</option>)}</select> : <input value={value} onChange={event => onChange(event.target.value)} placeholder={property.required ? 'Required' : 'Optional'} />}</label>;
}

type BlockEditorProps = {
  editor: NonNullable<EditorState>;
  versionId: string;
  setId: string;
  properties: any[];
  components: any[];
  children: any[];
  bindings: any[];
  childOptions: any[];
  primaryUnit: string;
  isPending: boolean;
  onCancel: () => void;
  onSave: (work: () => Promise<any>, label: string) => void;
};

function BlockEditor({ editor, versionId, setId, properties, components, children, bindings, childOptions, primaryUnit, isPending, onCancel, onSave }: BlockEditorProps) {
  const existingProperty = editor.kind === 'property' ? properties.find(row => row.id === editor.id) : null;
  const existingComponent = editor.kind === 'component' ? components.find(row => row.id === editor.id) : null;
  const existingChild = editor.kind === 'child' ? children.find(row => row.id === editor.id) : null;
  const seed = editor.seed || {};
  const binding = existingProperty ? bindings.find(row => row.variable_id === existingProperty.id) : null;
  const condition = conditionFromRule(existingComponent?.activation_rule);
  const [error, setError] = useState('');

  const [property, setProperty] = useState<PropertyForm>({
    key: existingProperty?.variable_key || seedString(seed, 'key'),
    label: existingProperty?.label || seedString(seed, 'label'),
    valueType: existingProperty?.value_type || seedString(seed, 'valueType', 'dimension'),
    unit: existingProperty?.unit || seedString(seed, 'unit', 'IN'),
    defaultValue: existingProperty?.default_value === null || existingProperty?.default_value === undefined ? '' : String(existingProperty.default_value),
    required: existingProperty?.required ?? true,
    propertyGroup: existingProperty?.property_group || seedString(seed, 'propertyGroup', 'Plan facts'),
    inputRole: existingProperty?.input_role || seedString(seed, 'inputRole', 'plan_fact'),
    exposeInTakeoff: existingProperty?.expose_in_takeoff ?? true,
    allowOverride: existingProperty?.allow_override ?? true,
    options: Array.isArray(existingProperty?.options) ? existingProperty.options.map((option: any) => `${option.value}:${option.label || option.value}`).join(', ') : '',
    sourceNamespace: binding?.source_namespace || '',
    sourceKey: binding?.source_key || '',
  });

  const [component, setComponent] = useState<ComponentForm>({
    key: existingComponent?.component_key || seedString(seed, 'key'),
    label: existingComponent?.label || seedString(seed, 'label'),
    itemType: existingComponent?.estimate_item_type || seedString(seed, 'itemType', 'material'),
    resourceBehavior: existingComponent?.resource_behavior || seedString(seed, 'resourceBehavior', 'consumed_material'),
    outputUnit: existingComponent?.output_unit || seedString(seed, 'outputUnit', 'EA'),
    formula: existingComponent?.quantity_formula ? expressionText(existingComponent.quantity_formula) : seedString(seed, 'formula', primaryToken(primaryUnit)),
    laborRateFormula: existingComponent?.labor_rate_formula ? expressionText(existingComponent.labor_rate_formula) : seedString(seed, 'laborRateFormula'),
    pricingStrategy: existingComponent?.pricing_strategy || seedString(seed, 'pricingStrategy', 'current_cost'),
    defaultUnitCost: existingComponent?.default_unit_cost ? String(existingComponent.default_unit_cost) : '',
    conditionProperty: condition.property,
    conditionOperator: condition.operator,
    conditionValue: condition.value,
  });

  const [child, setChild] = useState<ChildForm>({
    childVersionId: existingChild?.child_assembly_version_id || seedString(seed, 'childVersionId'),
    key: existingChild?.child_key || seedString(seed, 'key'),
    label: existingChild?.label || seedString(seed, 'label'),
    quantityFormula: existingChild?.quantity_formula ? expressionText(existingChild.quantity_formula) : seedString(seed, 'quantityFormula', primaryToken(primaryUnit)),
    bindings: existingChild ? Object.entries(existingChild.variable_bindings || {}).map(([key, value]) => `${key} = ${expressionText(value)}`).join('\n') : '',
  });

  const save = () => {
    setError('');
    if (editor.kind === 'property') {
      const options = property.valueType === 'enum'
        ? String(property.options).split(',').map((item: string) => item.trim()).filter(Boolean).map((item: string) => {
          const [value, ...label] = item.split(':');
          return { value: normalizeKey(value) || value.trim(), label: label.join(':').trim() || value.trim() };
        })
        : null;
      let defaultValue: unknown = property.defaultValue;
      if (['number', 'dimension', 'percentage'].includes(property.valueType)) defaultValue = property.defaultValue === '' ? null : Number(property.defaultValue);
      if (property.valueType === 'boolean') defaultValue = property.defaultValue === '' ? null : property.defaultValue === 'true';
      onSave(() => saveAssemblyProperty(setId, {
        versionId,
        id: existingProperty?.id || null,
        key: property.key || normalizeKey(property.label),
        label: property.label,
        valueType: property.valueType as any,
        unit: property.unit || null,
        defaultValue,
        required: property.required,
        propertyGroup: property.propertyGroup,
        inputRole: property.inputRole as any,
        exposeInTakeoff: property.exposeInTakeoff,
        allowOverride: property.allowOverride,
        options,
        sourceNamespace: (property.sourceNamespace || null) as any,
        sourceKey: property.sourceKey || null,
      }), 'Property saved');
      return;
    }

    if (editor.kind === 'component') {
      try {
        compileFormulaExpression(component.formula);
        if (component.itemType === 'labor' && component.laborRateFormula) compileFormulaExpression(component.laborRateFormula);
      } catch (caught: any) {
        setError(caught.message);
        return;
      }
      const conditionProperty = properties.find(row => row.variable_key === component.conditionProperty);
      onSave(() => saveAssemblyComponent(setId, {
        versionId,
        id: existingComponent?.id || null,
        key: component.key || normalizeKey(component.label),
        label: component.label,
        itemType: component.itemType as any,
        resourceBehavior: component.resourceBehavior as any,
        outputUnit: component.outputUnit,
        formula: component.formula,
        laborRateFormula: component.itemType === 'labor' ? component.laborRateFormula || null : null,
        pricingStrategy: component.pricingStrategy as any,
        defaultUnitCost: component.defaultUnitCost ? Number(component.defaultUnitCost) : null,
        activationRule: makeCondition(conditionProperty, component.conditionOperator, component.conditionValue),
      }), 'Resource saved');
      return;
    }

    const variableBindings: Record<string, string> = {};
    for (const line of String(child.bindings).split('\n').map((value: string) => value.trim()).filter(Boolean)) {
      const separator = line.indexOf('=');
      if (separator < 1) { setError(`Invalid binding: ${line}`); return; }
      variableBindings[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    try {
      compileFormulaExpression(child.quantityFormula);
      Object.values(variableBindings).forEach(value => compileFormulaExpression(value));
    } catch (caught: any) {
      setError(caught.message);
      return;
    }
    onSave(() => saveAssemblyChild(setId, {
      versionId,
      id: existingChild?.id || null,
      childVersionId: child.childVersionId,
      key: child.key || normalizeKey(child.label),
      label: child.label,
      quantityFormula: child.quantityFormula,
      variableBindings,
    }), 'Child assembly saved');
  };

  const title = editor.kind === 'property'
    ? existingProperty ? 'Edit input' : 'Add input'
    : editor.kind === 'component'
      ? existingComponent ? 'Edit material / labor item' : 'Add material / labor item'
      : existingChild ? 'Edit sub-assembly' : 'Add sub-assembly';

  return <div className={styles.editorBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className={styles.editorSheet} role="dialog" aria-modal="true" aria-label={title}>
      <header><div><span>Recipe item</span><strong>{title}</strong></div><button type="button" onClick={onCancel}><X size={15} /></button></header>
      <div className={styles.editorBody}>
        {editor.kind === 'property' && <>
          <div className={styles.editorGrid}>
            <Field label="Label" wide><input value={property.label} onChange={event => setProperty(value => ({ ...value, label: event.target.value, key: existingProperty ? value.key : normalizeKey(event.target.value) }))} /></Field>
            <Field label="Key"><input value={property.key} onChange={event => setProperty(value => ({ ...value, key: event.target.value }))} /></Field>
            <Field label="Type"><select value={property.valueType} onChange={event => setProperty(value => ({ ...value, valueType: event.target.value }))}>{propertyTypes.map(type => <option key={type} value={type}>{friendly(type)}</option>)}</select></Field>
            <Field label="Unit"><input list="carez-builder-units" value={property.unit} onChange={event => setProperty(value => ({ ...value, unit: event.target.value.toUpperCase() }))} /></Field>
            <Field label="Input role"><select value={property.inputRole} onChange={event => setProperty(value => ({ ...value, inputRole: event.target.value }))}>{inputRoles.map(role => <option key={role} value={role}>{friendly(role)}</option>)}</select></Field>
            <Field label="Group"><input value={property.propertyGroup} onChange={event => setProperty(value => ({ ...value, propertyGroup: event.target.value }))} /></Field>
            <Field label="Default · optional">{property.valueType === 'boolean' ? <select value={property.defaultValue} onChange={event => setProperty(value => ({ ...value, defaultValue: event.target.value }))}><option value="">No default</option><option value="true">Yes</option><option value="false">No</option></select> : <input value={property.defaultValue} onChange={event => setProperty(value => ({ ...value, defaultValue: event.target.value }))} placeholder="No company default" />}</Field>
            {property.valueType === 'enum' && <Field label="Choices · value:label, comma separated" wide><input value={property.options} onChange={event => setProperty(value => ({ ...value, options: event.target.value }))} /></Field>}
          </div>
          <div className={styles.editorSection}><div><strong>Auto-fill from another source</strong><span>Optional. Most inputs can stay as estimator inputs.</span></div><div className={styles.bindingRow}><select value={property.sourceNamespace} onChange={event => setProperty(value => ({ ...value, sourceNamespace: event.target.value }))}><option value="">Estimator input</option><option value="takeoff">Takeoff</option><option value="plan_fact">Plan fact</option><option value="project">Project</option><option value="parent">Parent assembly</option><option value="property">Another input</option></select><input value={property.sourceKey} onChange={event => setProperty(value => ({ ...value, sourceKey: event.target.value }))} placeholder="Perimeter or width_in" /></div></div>
          <div className={styles.checkRow}><label><input type="checkbox" checked={property.required} onChange={event => setProperty(value => ({ ...value, required: event.target.checked }))} />Required</label><label><input type="checkbox" checked={property.exposeInTakeoff} onChange={event => setProperty(value => ({ ...value, exposeInTakeoff: event.target.checked }))} />Show in Takeoff</label><label><input type="checkbox" checked={property.allowOverride} onChange={event => setProperty(value => ({ ...value, allowOverride: event.target.checked }))} />Estimator may override</label></div>
        </>}

        {editor.kind === 'component' && <>
          <div className={styles.editorGrid}>
            <Field label="Item name" wide><input value={component.label} onChange={event => setComponent(value => ({ ...value, label: event.target.value, key: existingComponent ? value.key : normalizeKey(event.target.value) }))} /></Field>
            <Field label="Key"><input value={component.key} onChange={event => setComponent(value => ({ ...value, key: event.target.value }))} /></Field>
            <Field label="Type"><select value={component.itemType} onChange={event => setComponent(value => ({ ...value, itemType: event.target.value, resourceBehavior: event.target.value === 'labor' ? 'labor' : value.resourceBehavior }))}><option value="material">Material</option><option value="labor">Labor</option><option value="equipment">Equipment</option><option value="subcontractor">Subcontractor</option><option value="other">Other</option></select></Field>
            <Field label="Behavior"><select value={component.resourceBehavior} onChange={event => setComponent(value => ({ ...value, resourceBehavior: event.target.value }))}><option value="consumed_material">Used up on job</option><option value="reusable_inventory">Reusable forms / inventory</option><option value="labor">Labor</option><option value="owned_equipment">Owned equipment</option><option value="rental">Rental</option><option value="subcontractor">Subcontractor</option><option value="readiness_resource">Readiness item</option><option value="legacy_other">Other</option></select></Field>
            <Field label="Output unit"><input list="carez-builder-units" value={component.outputUnit} onChange={event => setComponent(value => ({ ...value, outputUnit: event.target.value.toUpperCase() }))} /></Field>
          </div>
          <FormulaField title="Quantity math" value={component.formula} onChange={value => setComponent(current => ({ ...current, formula: value }))} primaryUnit={primaryUnit} properties={properties} />
          {component.itemType === 'labor' && <FormulaField title="Labor hours per output unit" value={component.laborRateFormula} onChange={value => setComponent(current => ({ ...current, laborRateFormula: value }))} primaryUnit={primaryUnit} properties={properties} compact />}
          <div className={styles.editorSection}><div><strong>Use only when</strong><span>Optional. Example: add vapor barrier only when Vapor barrier = Yes.</span></div><div className={styles.conditionBuilder}><select value={component.conditionProperty} onChange={event => setComponent(value => ({ ...value, conditionProperty: event.target.value }))}><option value="">Always use</option>{properties.map(row => <option key={row.id} value={row.variable_key}>{row.label}</option>)}</select><select value={component.conditionOperator} disabled={!component.conditionProperty} onChange={event => setComponent(value => ({ ...value, conditionOperator: event.target.value }))}><option value="eq">is</option><option value="neq">is not</option><option value="gt">greater than</option><option value="gte">at least</option><option value="lt">less than</option><option value="lte">at most</option></select><ConditionInput property={properties.find(row => row.variable_key === component.conditionProperty)} value={component.conditionValue} onChange={value => setComponent(current => ({ ...current, conditionValue: value }))} /></div></div>
          <div className={styles.editorGrid}><Field label="Pricing"><select value={component.pricingStrategy} onChange={event => setComponent(value => ({ ...value, pricingStrategy: event.target.value }))}><option value="current_cost">Current company cost</option><option value="catalog">Catalog</option><option value="manual">Estimator/manual</option><option value="none">Not priced</option></select></Field><Field label="Draft unit cost · optional"><input value={component.defaultUnitCost} onChange={event => setComponent(value => ({ ...value, defaultUnitCost: event.target.value }))} inputMode="decimal" /></Field></div>
        </>}

        {editor.kind === 'child' && <>
          <div className={styles.editorGrid}>
            <Field label="Published sub-assembly" wide><select value={child.childVersionId} onChange={event => { const selected = childOptions.find(row => row.id === event.target.value); setChild(value => ({ ...value, childVersionId: event.target.value, label: selected?.assembly?.name || value.label, key: normalizeKey(selected?.assembly?.code || value.key) })); }}><option value="">Select published assembly…</option>{childOptions.map(row => <option key={row.id} value={row.id}>{row.assembly.code} · {row.assembly.name} · v{row.version_no}</option>)}</select></Field>
            <Field label="Key"><input value={child.key} onChange={event => setChild(value => ({ ...value, key: event.target.value }))} /></Field>
            <Field label="Label in this recipe" wide><input value={child.label} onChange={event => setChild(value => ({ ...value, label: event.target.value }))} /></Field>
          </div>
          <FormulaField title="How many / how much" value={child.quantityFormula} onChange={value => setChild(current => ({ ...current, quantityFormula: value }))} primaryUnit={primaryUnit} properties={properties} />
          <div className={styles.editorSection}><div><strong>Map parent inputs to child inputs</strong><span>Optional. One per line: child_input = parent_input</span></div><textarea className={styles.bindingArea} value={child.bindings} onChange={event => setChild(value => ({ ...value, bindings: event.target.value }))} rows={5} placeholder={'width_in = wall_width_in\nplacement_method = placement_method'} /></div>
        </>}

        {error && <div className={styles.editorError}><AlertTriangle size={14} />{error}</div>}
      </div>
      <footer><span>Draft changes are not used in Takeoff until published.</span><div><button type="button" onClick={onCancel}>Cancel</button><button type="button" className={styles.saveButton} disabled={isPending} onClick={save}><Check size={14} />Save item</button></div></footer>
      <datalist id="carez-builder-units">{commonUnits.map(unit => <option key={unit} value={unit} />)}</datalist>
    </section>
  </div>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? styles.span2 : undefined}><span>{label}</span>{children}</label>;
}

function FormulaField({ title, value, onChange, primaryUnit, properties, compact = false }: { title: string; value: string; onChange: (value: string) => void; primaryUnit: string; properties: any[]; compact?: boolean }) {
  const [constant, setConstant] = useState('');
  let status = 'Formula valid';
  let preview = '';
  try { preview = formatFormulaExpression(compileFormulaExpression(value || '0')); }
  catch (error: any) { status = error.message; }
  const append = (token: string) => onChange(`${value}${value && !value.endsWith(' ') ? ' ' : ''}${token}`);
  const wrap = (fn: string) => onChange(`${fn}(${value || primaryToken(primaryUnit)})`);
  const addConstant = () => {
    const number = Number(constant);
    if (!Number.isFinite(number)) return;
    append(String(number));
    setConstant('');
  };
  return <div className={`${styles.formulaEditor} ${compact ? styles.formulaCompact : ''}`}>
    <div className={styles.formulaHead}><div><Sigma size={14} /><strong>{title}</strong></div><span className={status === 'Formula valid' ? styles.formulaGood : styles.formulaBad}>{status}</span></div>
    <textarea value={value} onChange={event => onChange(event.target.value)} rows={compact ? 2 : 3} spellCheck={false} placeholder={`${measuredLabel(primaryUnit)} × input ÷ number`} />
    <div className={styles.tokenTray}>
      <button type="button" onClick={() => append(primaryToken(primaryUnit))}>{measuredLabel(primaryUnit)}</button>
      {primaryUnit === 'SF' && <button type="button" onClick={() => append('Perimeter')}>Measured perimeter</button>}
      {properties.map(property => <button type="button" key={property.id} onClick={() => append(property.variable_key)}>+ {property.label}</button>)}
    </div>
    <div className={styles.formulaTools}>
      <div className={styles.operatorTray}><span>Math</span>{['+', '-', '*', '/', '(', ')'].map(operator => <button type="button" key={operator} onClick={() => append(operator)}>{operator === '*' ? '×' : operator === '/' ? '÷' : operator}</button>)}</div>
      <div className={styles.numberTray}><input value={constant} onChange={event => setConstant(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addConstant(); } }} inputMode="decimal" placeholder="Number" /><button type="button" onClick={addConstant}>Add</button></div>
      <div className={styles.shortcutTray}><button type="button" onClick={() => append('/ 12')}>in → ft</button><button type="button" onClick={() => append('/ 27')}>CF → CY</button><button type="button" onClick={() => wrap('ceil')}>Round up</button><button type="button" onClick={() => wrap('round')}>Round</button><button type="button" onClick={() => onChange('')}>Clear</button></div>
    </div>
    {preview && status === 'Formula valid' && <div className={styles.formulaPreview}><span>Reads as</span><code>{preview}</code></div>}
  </div>;
}

function ConditionInput({ property, value, onChange }: { property: any; value: string; onChange: (value: string) => void }) {
  if (!property) return <input value="" disabled placeholder="Value" />;
  if (property.value_type === 'boolean') return <select value={value} onChange={event => onChange(event.target.value)}><option value="">Select…</option><option value="true">Yes</option><option value="false">No</option></select>;
  if (property.value_type === 'enum') return <select value={value} onChange={event => onChange(event.target.value)}><option value="">Select…</option>{(Array.isArray(property.options) ? property.options : []).map((option: any) => <option key={option.value} value={option.value}>{option.label || option.value}</option>)}</select>;
  return <input value={value} onChange={event => onChange(event.target.value)} placeholder="Value" />;
}
