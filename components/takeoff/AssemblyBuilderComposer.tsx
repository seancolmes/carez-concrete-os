'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle, Box, Boxes, Braces, Check, ChevronDown, ChevronRight, CircleDollarSign, CopyPlus,
  Expand, FlaskConical, GripHorizontal, Hammer, Layers3, Minimize2, Package, Plus, Search, Settings2,
  Sigma, Sparkles, Trash2, Variable, Wrench, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { evaluateTakeoffFormula, takeoffFormulaVariables } from '@/lib/takeoff/formula';
import { compileFormulaExpression, formatFormulaExpression } from '@/lib/takeoff/formulaExpression';
import { evaluateRule } from '@/lib/takeoff/rules';
import {
  deleteAssemblyChild, deleteAssemblyComponent, deleteAssemblyProperty, publishAssemblyDraft,
  reorderAssemblyBlock, saveAssemblyChild, saveAssemblyComponent, saveAssemblyProperty,
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

type EditorKind = 'property' | 'component' | 'child';
type EditorState = { kind: EditorKind; id?: string | null; seed?: any } | null;

type TestRow = {
  id: string;
  label: string;
  type: string;
  quantity: number | null;
  unit: string;
  hours?: number | null;
  status: 'ready' | 'hold' | 'inactive';
  detail?: string;
};

const num = (value: unknown, digits = 2) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });
const friendlyType = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const sortRows = (rows: any[]) => [...rows].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.label || '').localeCompare(String(b.label || '')));
const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
const inputRoles = ['plan_fact', 'method_decision', 'production_assumption', 'commercial_assumption', 'derived'] as const;
const propertyTypes = ['dimension', 'number', 'percentage', 'boolean', 'enum', 'text'] as const;
const units = ['IN', 'FT', 'LF', 'SF', 'SFCA', 'CF', 'CY', 'EA', 'LB', 'TON', 'GAL', '%', 'HR', 'MH', 'LB/LF', 'LB/SF', 'MH/LF', 'MH/SF', 'MH/SFCA', 'MH/LB', 'MH/CY'];

const propertyPalette = [
  { label: 'Dimension', icon: Variable, seed: { valueType: 'dimension', unit: 'IN', inputRole: 'plan_fact', propertyGroup: 'Plan facts' } },
  { label: 'Number', icon: Sigma, seed: { valueType: 'number', unit: 'EA', inputRole: 'plan_fact', propertyGroup: 'Plan facts' } },
  { label: 'Percentage', icon: CircleDollarSign, seed: { valueType: 'percentage', unit: '%', inputRole: 'production_assumption', propertyGroup: 'Production' } },
  { label: 'Yes / No', icon: Check, seed: { valueType: 'boolean', unit: '', inputRole: 'method_decision', propertyGroup: 'Means & methods' } },
  { label: 'Choice', icon: Layers3, seed: { valueType: 'enum', unit: '', inputRole: 'method_decision', propertyGroup: 'Means & methods' } },
];

const resourcePalette = [
  { label: 'Material', icon: Package, seed: { itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'EA', pricingStrategy: 'current_cost' } },
  { label: 'Labor', icon: Hammer, seed: { itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'MH', pricingStrategy: 'current_cost' } },
  { label: 'Owned equipment', icon: Wrench, seed: { itemType: 'equipment', resourceBehavior: 'owned_equipment', outputUnit: 'HR', pricingStrategy: 'current_cost' } },
  { label: 'Rental', icon: Box, seed: { itemType: 'equipment', resourceBehavior: 'rental', outputUnit: 'DAY', pricingStrategy: 'current_cost' } },
  { label: 'Subcontractor', icon: Boxes, seed: { itemType: 'subcontractor', resourceBehavior: 'subcontractor', outputUnit: 'LS', pricingStrategy: 'manual' } },
];

function conditionFromRule(rule: any) {
  if (!rule || !rule.op || !rule.left?.var || !('const' in (rule.right || {}))) return { property: '', operator: 'eq', value: '' };
  return { property: String(rule.left.var).replace(/^properties\./, ''), operator: String(rule.op), value: String(rule.right.const ?? '') };
}

function makeCondition(property: any, operator: string, raw: string) {
  if (!property || !raw.trim()) return null;
  let value: any = raw;
  if (['number', 'dimension', 'percentage'].includes(property.value_type)) value = Number(raw);
  if (property.value_type === 'boolean') value = raw === 'true';
  return { op: operator, left: { var: `properties.${property.variable_key}` }, right: { const: value } };
}

function primaryTakeoffToken(unit: string) {
  if (unit === 'LF') return 'Takeoff.Length';
  if (unit === 'SF') return 'Takeoff.Area';
  if (unit === 'EA') return 'Takeoff.Count';
  if (unit === 'CY') return 'Takeoff.Volume';
  return 'Takeoff.Quantity';
}

export function AssemblyBuilderComposer({ setId, versionId, builderData, focus, onFocusChange, onClose, onCreateAnother }: Props) {
  const router = useRouter();
  const [height, setHeight] = useState(408);
  const dragResize = useRef<{ y: number; height: number } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteSection, setPaletteSection] = useState<'blocks' | 'assemblies'>('blocks');
  const [testMeasurementId, setTestMeasurementId] = useState('');
  const [testQuantity, setTestQuantity] = useState('100');
  const [testInputs, setTestInputs] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [isPending, startTransition] = useTransition();
  const [testOpen, setTestOpen] = useState(true);

  const version = builderData.versions.find(row => row.id === versionId) || null;
  const assembly = version ? builderData.assemblies.find(row => row.id === version.assembly_id) || null : null;
  const properties = useMemo(() => sortRows(builderData.variables.filter(row => row.assembly_version_id === versionId)), [builderData.variables, versionId]);
  const components = useMemo(() => sortRows(builderData.components.filter(row => row.assembly_version_id === versionId)), [builderData.components, versionId]);
  const children = useMemo(() => sortRows(builderData.children.filter(row => row.assembly_version_id === versionId)), [builderData.children, versionId]);
  const bindingByVariable = useMemo(() => new Map(builderData.bindings.filter(row => row.assembly_version_id === versionId).map(row => [row.variable_id, row])), [builderData.bindings, versionId]);
  const publishedChildVersions = useMemo(() => builderData.versions.filter(row => row.status === 'published' && row.id !== versionId).map(row => ({ ...row, assembly: builderData.assemblies.find(item => item.id === row.assembly_id) })).filter(row => row.assembly), [builderData.versions, builderData.assemblies, versionId]);
  const readOnly = version?.status !== 'draft';
  const primaryUnit = String(version?.primary_measurement_snapshot || assembly?.primary_measurement || 'LF');

  useEffect(() => {
    if (!properties.length) return;
    setTestInputs(current => {
      const next = { ...current };
      for (const property of properties) {
        if (next[property.variable_key] !== undefined) continue;
        if (property.default_value !== null && property.default_value !== undefined) next[property.variable_key] = String(property.default_value);
        else if (property.value_type === 'boolean') next[property.variable_key] = 'false';
        else next[property.variable_key] = '';
      }
      return next;
    });
  }, [properties]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragResize.current || focus) return;
      const next = dragResize.current.height + dragResize.current.y - event.clientY;
      setHeight(Math.max(280, Math.min(window.innerHeight * .72, next)));
    };
    const end = () => { dragResize.current = null; document.body.style.cursor = ''; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); document.body.style.cursor = ''; };
  }, [focus]);

  const run = (work: () => Promise<any>, success?: string, after?: (value: any) => void) => {
    setNotice('Saving…');
    startTransition(async () => {
      try {
        const value = await work();
        setNotice(success || 'Saved');
        setEditor(null);
        after?.(value);
        router.refresh();
      } catch (error: any) {
        setNotice(error?.message || 'Unable to save assembly change.');
      }
    });
  };

  const startDrag = (event: React.DragEvent, payload: any) => {
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData('application/x-carez-assembly-block', JSON.stringify(payload));
  };
  const payloadFromDrop = (event: React.DragEvent) => {
    try { return JSON.parse(event.dataTransfer.getData('application/x-carez-assembly-block') || '{}'); } catch { return {}; }
  };
  const dropNew = (event: React.DragEvent, lane: 'property' | 'component' | 'child') => {
    event.preventDefault();
    if (readOnly) return;
    const payload = payloadFromDrop(event);
    if (payload.kind === lane && payload.mode === 'new') setEditor({ kind: lane, seed: payload.seed || {} });
    if (lane === 'child' && payload.kind === 'childVersion') {
      const childVersion = builderData.versions.find(row => row.id === payload.versionId);
      const childAssembly = childVersion ? builderData.assemblies.find(row => row.id === childVersion.assembly_id) : null;
      if (childVersion && childAssembly) setEditor({ kind: 'child', seed: { childVersionId: childVersion.id, label: childAssembly.name, key: normalizeKey(childAssembly.code || childAssembly.name), quantityFormula: primaryTakeoffToken(primaryUnit) } });
    }
  };
  const dropBefore = (event: React.DragEvent, kind: EditorKind, target: any) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = payloadFromDrop(event);
    if (payload.mode === 'existing' && payload.kind === kind && payload.id !== target.id) {
      run(() => reorderAssemblyBlock(setId, { versionId, kind, id: payload.id, sortOrder: Math.max(0, Number(target.sort_order || 10) - 1) }), 'Reordered');
      return;
    }
    dropNew(event, kind);
  };

  const selectedMeasurement = builderData.measurements.find(row => row.id === testMeasurementId) || null;
  const compatibleMeasurements = builderData.measurements.filter(row => String(row.raw_unit || '').toUpperCase() === primaryUnit);
  const effectiveQuantity = selectedMeasurement ? Number(selectedMeasurement.raw_quantity || 0) : Number(testQuantity || 0);

  const testResult = useMemo(() => {
    const stored: Record<string, any> = {};
    const formulaValues: Record<string, number> = { quantity: effectiveQuantity, 'Takeoff.Quantity': effectiveQuantity };
    if (primaryUnit === 'LF') formulaValues['Takeoff.Length'] = effectiveQuantity;
    if (primaryUnit === 'SF') formulaValues['Takeoff.Area'] = effectiveQuantity;
    if (primaryUnit === 'EA') formulaValues['Takeoff.Count'] = effectiveQuantity;
    if (primaryUnit === 'CY') formulaValues['Takeoff.Volume'] = effectiveQuantity;
    const perimeter = selectedMeasurement?.variables?.perimeter_lf ?? selectedMeasurement?.variables?.Perimeter;
    if (Number.isFinite(Number(perimeter))) formulaValues['Takeoff.Perimeter'] = Number(perimeter);

    const missing: string[] = [];
    for (const property of properties) {
      const raw = testInputs[property.variable_key];
      if ((raw === '' || raw === undefined) && property.required) { missing.push(property.label); continue; }
      if (raw === '' || raw === undefined) continue;
      if (['number', 'dimension', 'percentage'].includes(property.value_type)) {
        const value = Number(raw);
        if (Number.isFinite(value)) {
          stored[property.variable_key] = value;
          formulaValues[property.variable_key] = value;
          formulaValues[`Properties.${property.variable_key}`] = value;
        }
      } else if (property.value_type === 'boolean') stored[property.variable_key] = raw === 'true';
      else stored[property.variable_key] = raw;
    }

    const rows: TestRow[] = [];
    let errors = 0;
    for (const component of components) {
      try {
        const active = !component.activation_rule || evaluateRule(component.activation_rule, { properties: stored });
        if (!active) { rows.push({ id: component.id, label: component.label, type: component.estimate_item_type, quantity: 0, unit: component.output_unit, status: 'inactive', detail: 'Condition inactive' }); continue; }
        const formulaMissing = takeoffFormulaVariables(component.quantity_formula).filter(key => formulaValues[key] === undefined);
        if (formulaMissing.length) {
          rows.push({ id: component.id, label: component.label, type: component.estimate_item_type, quantity: null, unit: component.output_unit, status: 'hold', detail: `Needs ${formulaMissing.join(', ')}` });
          continue;
        }
        const quantity = evaluateTakeoffFormula(component.quantity_formula, formulaValues);
        let hours: number | null = null;
        if (component.estimate_item_type === 'labor' && component.labor_rate_formula) {
          const rateMissing = takeoffFormulaVariables(component.labor_rate_formula).filter(key => formulaValues[key] === undefined);
          if (rateMissing.length) {
            rows.push({ id: component.id, label: component.label, type: component.estimate_item_type, quantity, unit: component.output_unit, hours: null, status: 'hold', detail: `Rate needs ${rateMissing.join(', ')}` });
            continue;
          }
          hours = quantity * evaluateTakeoffFormula(component.labor_rate_formula, formulaValues);
        }
        rows.push({ id: component.id, label: component.label, type: component.estimate_item_type, quantity, unit: component.output_unit, hours, status: 'ready' });
      } catch (error: any) {
        errors += 1;
        rows.push({ id: component.id, label: component.label, type: component.estimate_item_type, quantity: null, unit: component.output_unit, status: 'hold', detail: error?.message || 'Formula error' });
      }
    }
    for (const child of children) {
      try {
        const formulaMissing = takeoffFormulaVariables(child.quantity_formula).filter(key => formulaValues[key] === undefined);
        if (formulaMissing.length) rows.push({ id: child.id, label: child.label, type: 'child assembly', quantity: null, unit: '×', status: 'hold', detail: `Needs ${formulaMissing.join(', ')}` });
        else rows.push({ id: child.id, label: child.label, type: 'child assembly', quantity: evaluateTakeoffFormula(child.quantity_formula, formulaValues), unit: '×', status: 'ready', detail: 'Published nested recipe' });
      } catch (error: any) {
        errors += 1;
        rows.push({ id: child.id, label: child.label, type: 'child assembly', quantity: null, unit: '×', status: 'hold', detail: error?.message || 'Child quantity error' });
      }
    }
    return { rows, missing, errors, formulaValues };
  }, [effectiveQuantity, primaryUnit, selectedMeasurement, properties, components, children, testInputs]);

  const holdCount = testResult.rows.filter(row => row.status === 'hold').length + testResult.missing.length + testResult.errors;
  const publishReady = !readOnly && (components.length + children.length > 0) && testResult.errors === 0;

  if (!version || !assembly) return <section className={styles.composer} style={{ height: focus ? '100%' : height }}><div className={styles.missing}>Loading assembly draft…</div></section>;

  return <section className={`${styles.composer} ${focus ? styles.focus : ''}`} style={{ height: focus ? '100%' : height }} aria-label="Assembly Builder">
    {!focus && <button type="button" className={styles.resizeHandle} aria-label="Resize Assembly Builder" onPointerDown={event => {
      dragResize.current = { y: event.clientY, height };
      document.body.style.cursor = 'ns-resize';
      event.currentTarget.setPointerCapture(event.pointerId);
    }}><GripHorizontal size={15} /></button>}

    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.builderMark}><Braces size={16} /></div>
        <div><span>Assembly Builder</span><strong>{assembly.code} · {assembly.name}</strong></div>
        <b className={readOnly ? styles.publishedBadge : styles.draftBadge}>{readOnly ? `Published v${version.version_no}` : `Draft v${version.version_no}`}</b>
      </div>
      <div className={styles.headerStatus}>{notice && <span>{notice}</span>}<span className={holdCount ? styles.holdText : styles.validText}>{holdCount ? `${holdCount} test hold${holdCount === 1 ? '' : 's'}` : 'Test valid'}</span></div>
      <div className={styles.headerActions}>
        <button type="button" onClick={onCreateAnother}><Plus size={14} />New</button>
        <button type="button" onClick={() => setTestOpen(value => !value)}><FlaskConical size={14} />Test</button>
        <button type="button" onClick={() => onFocusChange(!focus)}>{focus ? <Minimize2 size={14} /> : <Expand size={14} />}{focus ? 'Exit focus' : 'Focus Builder'}</button>
        {!readOnly && <button type="button" className={styles.publishButton} disabled={isPending || !publishReady} title={!publishReady ? 'Add a valid resource or child assembly before publishing.' : 'Publish immutable assembly version'} onClick={() => run(
          () => publishAssemblyDraft(setId, versionId),
          'Published',
          () => { onFocusChange(false); window.setTimeout(onClose, 350); },
        )}><Check size={14} />Publish</button>}
        <button type="button" className={styles.closeButton} onClick={onClose} title="Close Assembly Builder"><X size={15} /></button>
      </div>
    </header>

    <div className={styles.body}>
      <aside className={styles.palette}>
        <div className={styles.paletteTabs}><button type="button" className={paletteSection === 'blocks' ? styles.active : ''} onClick={() => setPaletteSection('blocks')}>Blocks</button><button type="button" className={paletteSection === 'assemblies' ? styles.active : ''} onClick={() => setPaletteSection('assemblies')}>Assemblies</button></div>
        <label className={styles.paletteSearch}><Search size={12} /><input value={paletteQuery} onChange={event => setPaletteQuery(event.target.value)} placeholder="Find a block" /></label>
        {paletteSection === 'blocks' ? <div className={styles.paletteScroll}>
          <PaletteGroup title="Inputs & properties">
            {propertyPalette.filter(item => item.label.toLowerCase().includes(paletteQuery.toLowerCase())).map(item => <PaletteItem key={item.label} label={item.label} icon={item.icon} disabled={readOnly} onDragStart={event => startDrag(event, { mode: 'new', kind: 'property', seed: item.seed })} onClick={() => !readOnly && setEditor({ kind: 'property', seed: item.seed })} />)}
          </PaletteGroup>
          <PaletteGroup title="Resource outputs">
            {resourcePalette.filter(item => item.label.toLowerCase().includes(paletteQuery.toLowerCase())).map(item => <PaletteItem key={item.label} label={item.label} icon={item.icon} disabled={readOnly} onDragStart={event => startDrag(event, { mode: 'new', kind: 'component', seed: item.seed })} onClick={() => !readOnly && setEditor({ kind: 'component', seed: item.seed })} />)}
          </PaletteGroup>
          <PaletteGroup title="Logic">
            <PaletteItem label="Conditional output" icon={Braces} disabled={readOnly} onDragStart={event => startDrag(event, { mode: 'new', kind: 'component', seed: { itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'EA', pricingStrategy: 'current_cost', condition: true } })} onClick={() => !readOnly && setEditor({ kind: 'component', seed: { itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'EA', pricingStrategy: 'current_cost', condition: true } })} />
          </PaletteGroup>
        </div> : <div className={styles.paletteScroll}>
          <PaletteGroup title="Published company recipes">
            {publishedChildVersions.filter(row => `${row.assembly.code} ${row.assembly.name} ${row.assembly.category}`.toLowerCase().includes(paletteQuery.toLowerCase())).map(row => <PaletteItem key={row.id} label={row.assembly.name} meta={`${row.assembly.code} · v${row.version_no}`} icon={CopyPlus} disabled={readOnly || row.assembly_id === assembly.id} onDragStart={event => startDrag(event, { kind: 'childVersion', mode: 'new', versionId: row.id })} onClick={() => !readOnly && row.assembly_id !== assembly.id && setEditor({ kind: 'child', seed: { childVersionId: row.id, label: row.assembly.name, key: normalizeKey(row.assembly.code || row.assembly.name), quantityFormula: primaryTakeoffToken(primaryUnit) } })} />)}
            {!publishedChildVersions.length && <div className={styles.paletteEmpty}>Publish a reusable company assembly to nest it here.</div>}
          </PaletteGroup>
        </div>}
      </aside>

      <main className={styles.recipe}>
        <div className={styles.recipeTopline}>
          <div><span>Recipe</span><strong>{friendlyType(assembly.category)} · {primaryUnit} takeoff</strong></div>
          <div className={styles.recipeStats}><span><b>{properties.length}</b> properties</span><span><b>{components.length}</b> outputs</span><span><b>{children.length}</b> children</span></div>
        </div>

        <RecipeLane title="Inputs & properties" subtitle="Plan facts, estimator decisions, production assumptions, and reusable bindings." icon={Variable} empty="Drag a property block here" onDrop={event => dropNew(event, 'property')}>
          {properties.map(property => <PropertyBlock key={property.id} property={property} binding={bindingByVariable.get(property.id)} readOnly={readOnly} onEdit={() => setEditor({ kind: 'property', id: property.id })} onDelete={() => run(() => deleteAssemblyProperty(setId, versionId, property.id), 'Property removed')} onDragStart={event => startDrag(event, { mode: 'existing', kind: 'property', id: property.id })} onDrop={event => dropBefore(event, 'property', property)} />)}
        </RecipeLane>

        <RecipeLane title="Logic & child assemblies" subtitle="Compose reusable concrete systems without duplicating the recipe." icon={Layers3} empty="Drag a published child assembly here" onDrop={event => dropNew(event, 'child')}>
          {children.map(child => <ChildBlock key={child.id} child={child} builderData={builderData} readOnly={readOnly} onEdit={() => setEditor({ kind: 'child', id: child.id })} onDelete={() => run(() => deleteAssemblyChild(setId, versionId, child.id), 'Child removed')} onDragStart={event => startDrag(event, { mode: 'existing', kind: 'child', id: child.id })} onDrop={event => dropBefore(event, 'child', child)} />)}
        </RecipeLane>

        <RecipeLane title="Resource outputs & production" subtitle="Materials, inventory demand, labor, equipment, rentals, and subcontract scope." icon={Package} empty="Drag a resource block here" onDrop={event => dropNew(event, 'component')}>
          {components.map(component => <ComponentBlock key={component.id} component={component} properties={properties} readOnly={readOnly} onEdit={() => setEditor({ kind: 'component', id: component.id })} onDelete={() => run(() => deleteAssemblyComponent(setId, versionId, component.id), 'Resource removed')} onDragStart={event => startDrag(event, { mode: 'existing', kind: 'component', id: component.id })} onDrop={event => dropBefore(event, 'component', component)} />)}
        </RecipeLane>
      </main>

      {testOpen && <aside className={styles.testBench}>
        <div className={styles.testHeader}><div><FlaskConical size={14} /><strong>Test Bench</strong></div><button type="button" onClick={() => setTestOpen(false)}><X size={13} /></button></div>
        <div className={styles.testSource}>
          <label><span>Test source</span><select value={testMeasurementId} onChange={event => setTestMeasurementId(event.target.value)}><option value="">Sample {primaryUnit}</option>{compatibleMeasurements.map(measurement => <option key={measurement.id} value={measurement.id}>{measurement.name} · {num(measurement.raw_quantity)} {measurement.raw_unit}</option>)}</select></label>
          {!selectedMeasurement && <label><span>Quantity</span><div className={styles.unitInput}><input value={testQuantity} onChange={event => setTestQuantity(event.target.value)} inputMode="decimal" /><b>{primaryUnit}</b></div></label>}
        </div>
        <div className={styles.testInputs}>
          <div className={styles.testSectionTitle}><span>Properties</span><small>{testResult.missing.length ? `${testResult.missing.length} required` : 'resolved'}</small></div>
          {properties.filter(property => property.input_role !== 'derived').map(property => <TestInput key={property.id} property={property} value={testInputs[property.variable_key] ?? ''} onChange={value => setTestInputs(current => ({ ...current, [property.variable_key]: value }))} />)}
          {!properties.length && <div className={styles.testEmpty}>Add properties to test job inputs.</div>}
        </div>
        <div className={styles.testResults}>
          <div className={styles.testSectionTitle}><span>Live outputs</span><small className={holdCount ? styles.warningText : styles.goodText}>{holdCount ? `${holdCount} hold${holdCount === 1 ? '' : 's'}` : 'valid'}</small></div>
          {testResult.rows.map(row => <div key={`${row.type}-${row.id}`} className={`${styles.testRow} ${styles[`test${row.status[0].toUpperCase()}${row.status.slice(1)}`]}`}>
            <div><strong>{row.label}</strong><span>{friendlyType(row.type)}</span></div>
            <div className={styles.testQty}>{row.quantity === null ? 'HOLD' : `${num(row.quantity, 3)} ${row.unit}`}{row.hours !== null && row.hours !== undefined && <small>{num(row.hours, 2)} MH</small>}</div>
            {row.detail && <p>{row.detail}</p>}
          </div>)}
          {!testResult.rows.length && <div className={styles.testEmpty}>Add a resource or child assembly to calculate outputs.</div>}
        </div>
        <div className={styles.validationStrip}><span className={publishReady ? styles.validDot : styles.holdDot} /> <div><strong>{publishReady ? 'Recipe can be published' : 'Recipe needs work'}</strong><small>{components.length + children.length ? `${components.length + children.length} output block${components.length + children.length === 1 ? '' : 's'} · deterministic formula preview` : 'At least one output or child assembly is required.'}</small></div></div>
      </aside>}
    </div>

    {editor && <BlockEditor
      editor={editor}
      versionId={versionId}
      setId={setId}
      properties={properties}
      components={components}
      children={children}
      bindings={builderData.bindings}
      publishedChildVersions={publishedChildVersions}
      primaryUnit={primaryUnit}
      isPending={isPending}
      onCancel={() => setEditor(null)}
      onNotice={setNotice}
      onSaved={() => { setEditor(null); setNotice('Saved'); router.refresh(); }}
    />}
  </section>;
}

function PaletteGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={styles.paletteGroup}><h4>{title}</h4><div>{children}</div></section>;
}

function PaletteItem({ label, meta, icon: Icon, disabled, onDragStart, onClick }: any) {
  return <button type="button" draggable={!disabled} disabled={disabled} className={styles.paletteItem} onDragStart={onDragStart} onClick={onClick}><Icon size={14} /><span><strong>{label}</strong>{meta && <small>{meta}</small>}</span><GripHorizontal size={13} /></button>;
}

function RecipeLane({ title, subtitle, icon: Icon, empty, children, onDrop }: any) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className={styles.lane} onDragOver={(event: React.DragEvent) => event.preventDefault()} onDrop={onDrop}>
    <header><Icon size={14} /><div><strong>{title}</strong><span>{subtitle}</span></div></header>
    <div className={styles.laneBody}>{hasChildren ? children : <div className={styles.dropEmpty}><Plus size={13} />{empty}</div>}</div>
  </section>;
}

function PropertyBlock({ property, binding, readOnly, onEdit, onDelete, onDragStart, onDrop }: any) {
  const source = binding ? `${friendlyType(binding.source_namespace)} · ${binding.source_key}` : property.default_value !== null && property.default_value !== undefined ? 'Default value' : 'Estimator / project input';
  return <article className={styles.block} draggable={!readOnly} onDragStart={onDragStart} onDragOver={(event: React.DragEvent) => event.preventDefault()} onDrop={onDrop}>
    <div className={styles.blockGrip}><GripHorizontal size={13} /></div>
    <div className={`${styles.blockIcon} ${styles.propertyIcon}`}><Variable size={14} /></div>
    <div className={styles.blockMain}><span>{friendlyType(property.input_role || 'property')}</span><strong>{property.label}</strong><small>{source}</small></div>
    <div className={styles.blockMeta}>{property.unit && <b>{property.unit}</b>}<span>{friendlyType(property.value_type)}</span></div>
    <BlockActions readOnly={readOnly} onEdit={onEdit} onDelete={onDelete} />
  </article>;
}

function ComponentBlock({ component, properties, readOnly, onEdit, onDelete, onDragStart, onDrop }: any) {
  const condition = conditionFromRule(component.activation_rule);
  return <article className={styles.block} draggable={!readOnly} onDragStart={onDragStart} onDragOver={(event: React.DragEvent) => event.preventDefault()} onDrop={onDrop}>
    <div className={styles.blockGrip}><GripHorizontal size={13} /></div>
    <div className={`${styles.blockIcon} ${component.estimate_item_type === 'labor' ? styles.laborIcon : styles.resourceIcon}`}>{component.estimate_item_type === 'labor' ? <Hammer size={14} /> : <Package size={14} />}</div>
    <div className={styles.blockMain}><span>{friendlyType(component.resource_behavior || component.estimate_item_type)}</span><strong>{component.label}</strong><small>{formatFormulaExpression(component.quantity_formula)}</small></div>
    {condition.property && <div className={styles.conditionChip}><Braces size={11} />If {properties.find((row: any) => row.variable_key === condition.property)?.label || condition.property}</div>}
    <div className={styles.blockMeta}><b>{component.output_unit}</b>{component.estimate_item_type === 'labor' && component.labor_rate_formula ? <span>{formatFormulaExpression(component.labor_rate_formula)} MH/unit</span> : <span>{friendlyType(component.pricing_strategy || 'current_cost')}</span>}</div>
    <BlockActions readOnly={readOnly} onEdit={onEdit} onDelete={onDelete} />
  </article>;
}

function ChildBlock({ child, builderData, readOnly, onEdit, onDelete, onDragStart, onDrop }: any) {
  const version = builderData.versions.find((row: any) => row.id === child.child_assembly_version_id);
  const assembly = version ? builderData.assemblies.find((row: any) => row.id === version.assembly_id) : null;
  return <article className={styles.block} draggable={!readOnly} onDragStart={onDragStart} onDragOver={(event: React.DragEvent) => event.preventDefault()} onDrop={onDrop}>
    <div className={styles.blockGrip}><GripHorizontal size={13} /></div>
    <div className={`${styles.blockIcon} ${styles.childIcon}`}><Layers3 size={14} /></div>
    <div className={styles.blockMain}><span>Child assembly · published v{version?.version_no || '—'}</span><strong>{child.label}</strong><small>{assembly ? `${assembly.code} · ${assembly.name}` : 'Nested recipe'} · {formatFormulaExpression(child.quantity_formula)}</small></div>
    <div className={styles.blockMeta}><b>{assembly?.primary_measurement || '×'}</b><span>{Object.keys(child.variable_bindings || {}).length} bindings</span></div>
    <BlockActions readOnly={readOnly} onEdit={onEdit} onDelete={onDelete} />
  </article>;
}

function BlockActions({ readOnly, onEdit, onDelete }: any) {
  return <div className={styles.blockActions}>{!readOnly && <><button type="button" onClick={onEdit}><Settings2 size={13} /></button><button type="button" className={styles.deleteButton} onClick={onDelete}><Trash2 size={13} /></button></>}</div>;
}

function TestInput({ property, value, onChange }: any) {
  const options = Array.isArray(property.options) ? property.options : [];
  return <label className={styles.testInput}><span>{property.label}{property.unit ? ` · ${property.unit}` : ''}{property.required && <i>*</i>}</span>{property.value_type === 'boolean' ? <select value={value} onChange={event => onChange(event.target.value)}><option value="false">No</option><option value="true">Yes</option></select> : property.value_type === 'enum' ? <select value={value} onChange={event => onChange(event.target.value)}><option value="">Select…</option>{options.map((option: any) => <option value={option.value} key={option.value}>{option.label || option.value}</option>)}</select> : <input value={value} onChange={event => onChange(event.target.value)} inputMode={['number', 'dimension', 'percentage'].includes(property.value_type) ? 'decimal' : undefined} placeholder={property.required ? 'Required' : 'Optional'} />}</label>;
}

function BlockEditor({ editor, versionId, setId, properties, components, children, bindings, publishedChildVersions, primaryUnit, isPending, onCancel, onNotice, onSaved }: any) {
  const existingProperty = editor.kind === 'property' ? properties.find((row: any) => row.id === editor.id) : null;
  const existingComponent = editor.kind === 'component' ? components.find((row: any) => row.id === editor.id) : null;
  const existingChild = editor.kind === 'child' ? children.find((row: any) => row.id === editor.id) : null;
  const seed = editor.seed || {};
  const binding = existingProperty ? bindings.find((row: any) => row.variable_id === existingProperty.id) : null;
  const initialCondition = conditionFromRule(existingComponent?.activation_rule);

  const [propertyForm, setPropertyForm] = useState(() => ({
    key: existingProperty?.variable_key || seed.key || '', label: existingProperty?.label || seed.label || '', valueType: existingProperty?.value_type || seed.valueType || 'dimension', unit: existingProperty?.unit || seed.unit || 'IN', defaultValue: existingProperty?.default_value === null || existingProperty?.default_value === undefined ? '' : String(existingProperty.default_value), required: existingProperty?.required ?? true, propertyGroup: existingProperty?.property_group || seed.propertyGroup || 'Plan facts', inputRole: existingProperty?.input_role || seed.inputRole || 'plan_fact', exposeInTakeoff: existingProperty?.expose_in_takeoff ?? true, allowOverride: existingProperty?.allow_override ?? true, options: Array.isArray(existingProperty?.options) ? existingProperty.options.map((option: any) => `${option.value}:${option.label || option.value}`).join(', ') : '', sourceNamespace: binding?.source_namespace || '', sourceKey: binding?.source_key || '',
  }));
  const [componentForm, setComponentForm] = useState(() => ({
    key: existingComponent?.component_key || seed.key || '', label: existingComponent?.label || seed.label || '', itemType: existingComponent?.estimate_item_type || seed.itemType || 'material', resourceBehavior: existingComponent?.resource_behavior || seed.resourceBehavior || 'consumed_material', outputUnit: existingComponent?.output_unit || seed.outputUnit || 'EA', formula: existingComponent?.quantity_formula ? formatFormulaExpression(existingComponent.quantity_formula).replaceAll(' × ', ' * ').replaceAll(' ÷ ', ' / ') : seed.formula || primaryTakeoffToken(primaryUnit), laborRateFormula: existingComponent?.labor_rate_formula ? formatFormulaExpression(existingComponent.labor_rate_formula).replaceAll(' × ', ' * ').replaceAll(' ÷ ', ' / ') : seed.laborRateFormula || '', pricingStrategy: existingComponent?.pricing_strategy || seed.pricingStrategy || 'current_cost', defaultUnitCost: existingComponent?.default_unit_cost || '', conditionProperty: initialCondition.property || '', conditionOperator: initialCondition.operator || 'eq', conditionValue: initialCondition.value || '',
  }));
  const [childForm, setChildForm] = useState(() => ({
    childVersionId: existingChild?.child_assembly_version_id || seed.childVersionId || '', key: existingChild?.child_key || seed.key || '', label: existingChild?.label || seed.label || '', quantityFormula: existingChild?.quantity_formula ? formatFormulaExpression(existingChild.quantity_formula).replaceAll(' × ', ' * ').replaceAll(' ÷ ', ' / ') : seed.quantityFormula || primaryTakeoffToken(primaryUnit), bindings: existingChild ? Object.entries(existingChild.variable_bindings || {}).map(([key, value]: any) => `${key} = ${formatFormulaExpression(value).replaceAll(' × ', ' * ').replaceAll(' ÷ ', ' / ')}`).join('\n') : '',
  }));
  const [formulaError, setFormulaError] = useState('');

  const insertToken = (token: string, target: 'formula' | 'labor') => {
    setComponentForm((current: any) => ({ ...current, [target === 'formula' ? 'formula' : 'laborRateFormula']: `${current[target === 'formula' ? 'formula' : 'laborRateFormula']}${current[target === 'formula' ? 'formula' : 'laborRateFormula'] ? ' ' : ''}${token}` }));
  };

  const save = () => {
    onNotice('Saving…');
    setFormulaError('');
    if (editor.kind === 'property') {
      const options = propertyForm.valueType === 'enum' ? propertyForm.options.split(',').map((item: string) => item.trim()).filter(Boolean).map((item: string) => { const [value, ...label] = item.split(':'); return { value: normalizeKey(value) || value.trim(), label: label.join(':').trim() || value.trim() }; }) : null;
      let defaultValue: any = propertyForm.defaultValue;
      if (['number', 'dimension', 'percentage'].includes(propertyForm.valueType)) defaultValue = propertyForm.defaultValue === '' ? null : Number(propertyForm.defaultValue);
      if (propertyForm.valueType === 'boolean') defaultValue = propertyForm.defaultValue === '' ? null : propertyForm.defaultValue === 'true';
      startTransitionAction(async () => saveAssemblyProperty(setId, { versionId, id: existingProperty?.id || null, key: propertyForm.key || normalizeKey(propertyForm.label), label: propertyForm.label, valueType: propertyForm.valueType, unit: propertyForm.unit || null, defaultValue, required: propertyForm.required, propertyGroup: propertyForm.propertyGroup, inputRole: propertyForm.inputRole, exposeInTakeoff: propertyForm.exposeInTakeoff, allowOverride: propertyForm.allowOverride, options, sourceNamespace: propertyForm.sourceNamespace || null, sourceKey: propertyForm.sourceKey || null }), onSaved, setFormulaError);
      return;
    }
    if (editor.kind === 'component') {
      try { compileFormulaExpression(componentForm.formula); if (componentForm.itemType === 'labor' && componentForm.laborRateFormula) compileFormulaExpression(componentForm.laborRateFormula); } catch (error: any) { setFormulaError(error.message); return; }
      const conditionProperty = properties.find((row: any) => row.variable_key === componentForm.conditionProperty);
      const activationRule = makeCondition(conditionProperty, componentForm.conditionOperator, componentForm.conditionValue);
      startTransitionAction(async () => saveAssemblyComponent(setId, { versionId, id: existingComponent?.id || null, key: componentForm.key || normalizeKey(componentForm.label), label: componentForm.label, itemType: componentForm.itemType, resourceBehavior: componentForm.resourceBehavior, outputUnit: componentForm.outputUnit, formula: componentForm.formula, laborRateFormula: componentForm.itemType === 'labor' ? componentForm.laborRateFormula || null : null, pricingStrategy: componentForm.pricingStrategy, defaultUnitCost: componentForm.defaultUnitCost === '' ? null : Number(componentForm.defaultUnitCost), activationRule }), onSaved, setFormulaError);
      return;
    }
    const variableBindings: Record<string, string> = {};
    for (const line of childForm.bindings.split('\n').map((value: string) => value.trim()).filter(Boolean)) {
      const split = line.indexOf('=');
      if (split < 1) { setFormulaError(`Invalid child binding: ${line}`); return; }
      variableBindings[line.slice(0, split).trim()] = line.slice(split + 1).trim();
    }
    try { compileFormulaExpression(childForm.quantityFormula); Object.values(variableBindings).forEach(value => compileFormulaExpression(value)); } catch (error: any) { setFormulaError(error.message); return; }
    startTransitionAction(async () => saveAssemblyChild(setId, { versionId, id: existingChild?.id || null, childVersionId: childForm.childVersionId, key: childForm.key || normalizeKey(childForm.label), label: childForm.label, quantityFormula: childForm.quantityFormula, variableBindings }), onSaved, setFormulaError);
  };

  function startTransitionAction(work: () => Promise<any>, done: () => void, setError: (value: string) => void) {
    work().then(done).catch((error: any) => setError(error?.message || 'Unable to save block.'));
  }

  const title = editor.kind === 'property' ? existingProperty ? 'Edit property' : 'Add property' : editor.kind === 'component' ? existingComponent ? 'Edit resource output' : 'Add resource output' : existingChild ? 'Edit child assembly' : 'Add child assembly';
  return <div className={styles.editorBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className={styles.editorSheet} role="dialog" aria-modal="true" aria-label={title}>
      <header><div><span>Assembly block</span><strong>{title}</strong></div><button type="button" onClick={onCancel}><X size={15} /></button></header>
      <div className={styles.editorBody}>
        {editor.kind === 'property' && <>
          <div className={styles.editorGrid}><label className={styles.span2}><span>Label</span><input value={propertyForm.label} onChange={event => setPropertyForm(value => ({ ...value, label: event.target.value, key: existingProperty ? value.key : normalizeKey(event.target.value) }))} placeholder="Footing width" /></label><label><span>Property key</span><input value={propertyForm.key} onChange={event => setPropertyForm(value => ({ ...value, key: event.target.value }))} /></label><label><span>Type</span><select value={propertyForm.valueType} onChange={event => setPropertyForm(value => ({ ...value, valueType: event.target.value }))}>{propertyTypes.map(type => <option value={type} key={type}>{friendlyType(type)}</option>)}</select></label><label><span>Unit</span><input list="carez-units" value={propertyForm.unit} onChange={event => setPropertyForm(value => ({ ...value, unit: event.target.value.toUpperCase() }))} /></label><label><span>Input role</span><select value={propertyForm.inputRole} onChange={event => setPropertyForm(value => ({ ...value, inputRole: event.target.value }))}>{inputRoles.map(role => <option value={role} key={role}>{friendlyType(role)}</option>)}</select></label><label><span>Group</span><input value={propertyForm.propertyGroup} onChange={event => setPropertyForm(value => ({ ...value, propertyGroup: event.target.value }))} /></label><label><span>Default <em>optional</em></span>{propertyForm.valueType === 'boolean' ? <select value={propertyForm.defaultValue} onChange={event => setPropertyForm(value => ({ ...value, defaultValue: event.target.value }))}><option value="">No default</option><option value="true">Yes</option><option value="false">No</option></select> : <input value={propertyForm.defaultValue} onChange={event => setPropertyForm(value => ({ ...value, defaultValue: event.target.value }))} placeholder="No company default" />}</label>{propertyForm.valueType === 'enum' && <label className={styles.span2}><span>Choices <em>value:label, separated by commas</em></span><input value={propertyForm.options} onChange={event => setPropertyForm(value => ({ ...value, options: event.target.value }))} placeholder="line_pump:Line Pump, chute:Direct Chute" /></label>}</div>
          <div className={styles.editorSection}><div><strong>Source binding</strong><span>Optional. Bind this property to authoritative Takeoff, project, parent, plan-fact, or sibling data.</span></div><div className={styles.bindingRow}><select value={propertyForm.sourceNamespace} onChange={event => setPropertyForm(value => ({ ...value, sourceNamespace: event.target.value }))}><option value="">Estimator / project input</option><option value="takeoff">Takeoff</option><option value="plan_fact">Plan fact</option><option value="project">Project</option><option value="parent">Parent assembly</option><option value="property">Sibling property</option></select><input value={propertyForm.sourceKey} onChange={event => setPropertyForm(value => ({ ...value, sourceKey: event.target.value }))} placeholder="e.g. Takeoff.Perimeter or width_in" /></div></div>
          <div className={styles.checkRow}><label><input type="checkbox" checked={propertyForm.required} onChange={event => setPropertyForm(value => ({ ...value, required: event.target.checked }))} />Required for calculation</label><label><input type="checkbox" checked={propertyForm.exposeInTakeoff} onChange={event => setPropertyForm(value => ({ ...value, exposeInTakeoff: event.target.checked }))} />Expose in Takeoff</label><label><input type="checkbox" checked={propertyForm.allowOverride} onChange={event => setPropertyForm(value => ({ ...value, allowOverride: event.target.checked }))} />Estimator may override</label></div>
        </>}
        {editor.kind === 'component' && <>
          <div className={styles.editorGrid}><label className={styles.span2}><span>Resource / operation label</span><input value={componentForm.label} onChange={event => setComponentForm(value => ({ ...value, label: event.target.value, key: existingComponent ? value.key : normalizeKey(event.target.value) }))} placeholder="Ready-mix concrete" /></label><label><span>Resource key</span><input value={componentForm.key} onChange={event => setComponentForm(value => ({ ...value, key: event.target.value }))} /></label><label><span>Estimate type</span><select value={componentForm.itemType} onChange={event => setComponentForm(value => ({ ...value, itemType: event.target.value, resourceBehavior: event.target.value === 'labor' ? 'labor' : value.resourceBehavior }))}><option value="material">Material</option><option value="labor">Labor</option><option value="equipment">Equipment</option><option value="subcontractor">Subcontractor</option><option value="other">Other</option></select></label><label><span>Resource behavior</span><select value={componentForm.resourceBehavior} onChange={event => setComponentForm(value => ({ ...value, resourceBehavior: event.target.value }))}><option value="consumed_material">Consumed material</option><option value="reusable_inventory">Reusable inventory</option><option value="labor">Labor</option><option value="owned_equipment">Owned equipment</option><option value="rental">Rental</option><option value="subcontractor">Subcontractor</option><option value="readiness_resource">Readiness resource</option><option value="legacy_other">Other</option></select></label><label><span>Output unit</span><input list="carez-units" value={componentForm.outputUnit} onChange={event => setComponentForm(value => ({ ...value, outputUnit: event.target.value.toUpperCase() }))} /></label></div>
          <FormulaEditor title="Quantity formula" value={componentForm.formula} onChange={(value: string) => setComponentForm(current => ({ ...current, formula: value }))} primaryUnit={primaryUnit} properties={properties} onToken={(token: string) => insertToken(token, 'formula')} />
          {componentForm.itemType === 'labor' && <FormulaEditor title="Production rate · MH per output unit" value={componentForm.laborRateFormula} onChange={(value: string) => setComponentForm(current => ({ ...current, laborRateFormula: value }))} primaryUnit={primaryUnit} properties={properties} onToken={(token: string) => insertToken(token, 'labor')} compact />}
          <div className={styles.editorSection}><div><strong>Conditional activation</strong><span>Use a simple method/property decision to turn this resource branch on or off.</span></div><div className={styles.conditionBuilder}><select value={componentForm.conditionProperty} onChange={event => setComponentForm(value => ({ ...value, conditionProperty: event.target.value }))}><option value="">Always active</option>{properties.map((property: any) => <option value={property.variable_key} key={property.id}>{property.label}</option>)}</select><select value={componentForm.conditionOperator} disabled={!componentForm.conditionProperty} onChange={event => setComponentForm(value => ({ ...value, conditionOperator: event.target.value }))}><option value="eq">is</option><option value="neq">is not</option><option value="gt">is greater than</option><option value="gte">is at least</option><option value="lt">is less than</option><option value="lte">is at most</option></select><ConditionValue property={properties.find((property: any) => property.variable_key === componentForm.conditionProperty)} value={componentForm.conditionValue} onChange={(value: string) => setComponentForm(current => ({ ...current, conditionValue: value }))} /></div></div>
          <div className={styles.editorGrid}><label><span>Pricing source</span><select value={componentForm.pricingStrategy} onChange={event => setComponentForm(value => ({ ...value, pricingStrategy: event.target.value }))}><option value="current_cost">Current company cost</option><option value="catalog">Catalog</option><option value="manual">Estimator/manual</option><option value="none">Not priced</option></select></label><label><span>Draft unit cost <em>optional</em></span><input value={componentForm.defaultUnitCost} onChange={event => setComponentForm(value => ({ ...value, defaultUnitCost: event.target.value }))} inputMode="decimal" placeholder="No embedded price" /></label></div>
        </>}
        {editor.kind === 'child' && <>
          <div className={styles.editorGrid}><label className={styles.span2}><span>Published child assembly</span><select value={childForm.childVersionId} onChange={event => { const selected = publishedChildVersions.find((row: any) => row.id === event.target.value); setChildForm(value => ({ ...value, childVersionId: event.target.value, label: selected?.assembly?.name || value.label, key: normalizeKey(selected?.assembly?.code || value.key) })); }}><option value="">Select published assembly…</option>{publishedChildVersions.map((row: any) => <option value={row.id} key={row.id}>{row.assembly.code} · {row.assembly.name} · v{row.version_no}</option>)}</select></label><label><span>Child key</span><input value={childForm.key} onChange={event => setChildForm(value => ({ ...value, key: event.target.value }))} /></label><label className={styles.span2}><span>Label in this recipe</span><input value={childForm.label} onChange={event => setChildForm(value => ({ ...value, label: event.target.value }))} /></label></div>
          <FormulaEditor title="Child quantity formula" value={childForm.quantityFormula} onChange={(value: string) => setChildForm(current => ({ ...current, quantityFormula: value }))} primaryUnit={primaryUnit} properties={properties} onToken={() => {}} />
          <div className={styles.editorSection}><div><strong>Explicit child property bindings</strong><span>One per line: <code>child_property = Parent.Property</code>. Leave empty when the child needs no mapped parent values.</span></div><textarea className={styles.bindingArea} value={childForm.bindings} onChange={event => setChildForm(value => ({ ...value, bindings: event.target.value }))} rows={5} placeholder={'width_in = Properties.width_in\nplacement_method = Properties.placement_method'} /></div>
        </>}
        {formulaError && <div className={styles.editorError}><AlertTriangle size={14} />{formulaError}</div>}
      </div>
      <footer><span>{isPending ? 'Working…' : 'Draft changes remain company-owned until you publish.'}</span><div><button type="button" onClick={onCancel}>Cancel</button><button type="button" className={styles.saveButton} disabled={isPending} onClick={save}><Check size={14} />Save block</button></div></footer>
      <datalist id="carez-units">{units.map(unit => <option value={unit} key={unit} />)}</datalist>
    </section>
  </div>;
}

function FormulaEditor({ title, value, onChange, primaryUnit, properties, onToken, compact }: any) {
  let preview = '';
  let error = '';
  try { preview = formatFormulaExpression(compileFormulaExpression(value || '0')); } catch (caught: any) { error = caught.message; }
  return <div className={`${styles.formulaEditor} ${compact ? styles.formulaCompact : ''}`}><div className={styles.formulaHead}><div><Sigma size={14} /><strong>{title}</strong></div><span className={error ? styles.formulaBad : styles.formulaGood}>{error || 'Deterministic AST'}</span></div><textarea value={value} onChange={event => onChange(event.target.value)} rows={compact ? 2 : 3} spellCheck={false} /><div className={styles.tokenTray}><button type="button" onClick={() => onToken(primaryTakeoffToken(primaryUnit))}>{primaryTakeoffToken(primaryUnit)}</button>{primaryUnit === 'SF' && <button type="button" onClick={() => onToken('Takeoff.Perimeter')}>Takeoff.Perimeter</button>}{properties.slice(0, 8).map((property: any) => <button type="button" key={property.id} onClick={() => onToken(`Properties.${property.variable_key}`)}>+ {property.label}</button>)}</div>{preview && !error && <div className={styles.formulaPreview}><span>Preview</span><code>{preview}</code></div>}</div>;
}

function ConditionValue({ property, value, onChange }: any) {
  if (!property) return <input value="" disabled placeholder="Value" />;
  if (property.value_type === 'boolean') return <select value={value} onChange={event => onChange(event.target.value)}><option value="">Select…</option><option value="true">Yes</option><option value="false">No</option></select>;
  if (property.value_type === 'enum') return <select value={value} onChange={event => onChange(event.target.value)}><option value="">Select…</option>{(Array.isArray(property.options) ? property.options : []).map((option: any) => <option key={option.value} value={option.value}>{option.label || option.value}</option>)}</select>;
  return <input value={value} onChange={event => onChange(event.target.value)} inputMode={['number', 'dimension', 'percentage'].includes(property.value_type) ? 'decimal' : undefined} placeholder="Value" />;
}
