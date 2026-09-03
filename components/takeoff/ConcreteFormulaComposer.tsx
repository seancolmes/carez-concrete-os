'use client';

import { useMemo, useState } from 'react';
import { Braces, ChevronDown, CircleAlert, Plus, Sigma, Trash2, Variable } from 'lucide-react';
import {
  analyzeFormulaComposer,
  type FormulaComposerProperty,
  type FormulaComposerStep,
} from '@/lib/takeoff/formulaComposer';
import { compileFormulaExpression, formatFormulaExpression } from '@/lib/takeoff/formulaExpression';
import { enumOptions } from '@/lib/takeoff/assemblyContext';
import styles from './ConcreteFormulaComposer.module.css';

export type FormulaAuthoringConfig = {
  mode?: 'easy' | 'advanced';
  expression?: string;
  steps?: FormulaComposerStep[];
};

export type FormulaCondition = {
  id: string;
  propertyKey: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
  value: string;
};

export type FormulaConditionGroup = {
  match: 'all' | 'any';
  conditions: FormulaCondition[];
};

type Props = {
  title: string;
  value: string;
  onChange: (value: string) => void;
  primaryUnit: string;
  outputUnit?: string | null;
  properties: FormulaComposerProperty[];
  config?: FormulaAuthoringConfig | null;
  onConfigChange?: (value: FormulaAuthoringConfig) => void;
  compact?: boolean;
};

type PatternKind = 'measured' | 'form_contact' | 'volume' | 'locations' | 'stock_laps';

const primaryToken = (unit: string) => unit === 'LF' ? 'Length' : unit === 'SF' ? 'Area' : unit === 'EA' ? 'Count' : unit === 'CY' ? 'Volume' : 'Quantity';
const measuredLabel = (unit: string) => unit === 'LF' ? 'Measured length' : unit === 'SF' ? 'Measured area' : unit === 'EA' ? 'Measured count' : unit === 'CY' ? 'Measured volume' : 'Measured quantity';
const simpleKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'calculation';
const nextStepKey = (steps: FormulaComposerStep[]) => {
  let index = steps.length + 1;
  while (steps.some(step => step.key === `calc_${index}`)) index += 1;
  return `calc_${index}`;
};
const readable = (expression: string) => {
  try { return formatFormulaExpression(compileFormulaExpression(expression || '0')); }
  catch { return expression.replaceAll('*', '×').replaceAll('/', '÷'); }
};
const joinToken = (source: string, token: string) => {
  const trimmed = source.trimEnd();
  const operators = new Set(['+', '-', '*', '/', '(', ')', ',']);
  if (!trimmed) return token;
  if (operators.has(token)) return `${trimmed} ${token} `;
  return `${trimmed}${trimmed.endsWith('(') || trimmed.endsWith(',') ? '' : ' '}${token}`;
};
const isDimension = (property: FormulaComposerProperty) => ['IN', 'FT', 'LF'].includes(String(property.unit || '').toUpperCase());
const isCount = (property: FormulaComposerProperty) => ['EA', ''].includes(String(property.unit || '').toUpperCase()) && ['number', 'dimension'].includes(String(property.value_type || 'number'));
const optionLabel = (property: FormulaComposerProperty) => `${property.label}${property.unit ? ` · ${property.unit}` : ''}`;

export function ConcreteFormulaComposer({ title, value, onChange, primaryUnit, outputUnit, properties, config, onConfigChange, compact = false }: Props) {
  const [mode, setMode] = useState<'easy' | 'advanced'>(config?.mode || 'easy');
  const [steps, setSteps] = useState<FormulaComposerStep[]>(Array.isArray(config?.steps) ? config!.steps! : []);
  const [activeTarget, setActiveTarget] = useState<string>('result');
  const [pattern, setPattern] = useState<PatternKind | null>(null);
  const [patternInputs, setPatternInputs] = useState<Record<string, string>>({});
  const measurement = primaryToken(primaryUnit);
  const analysis = useMemo(() => analyzeFormulaComposer({
    expression: value || '0',
    steps,
    properties,
    primaryUnit,
    outputUnit,
    perimeterAvailable: primaryUnit === 'SF',
  }), [value, steps, properties, primaryUnit, outputUnit]);

  const emitConfig = (nextMode = mode, nextSteps = steps, nextExpression = value) => onConfigChange?.({ mode: nextMode, steps: nextSteps, expression: nextExpression });
  const changeMode = (next: 'easy' | 'advanced') => { setMode(next); emitConfig(next, steps, value); };
  const changeResult = (next: string) => { onChange(next); emitConfig(mode, steps, next); };
  const changeSteps = (next: FormulaComposerStep[]) => { setSteps(next); emitConfig(mode, next, value); };
  const updateTarget = (next: string) => {
    if (activeTarget === 'result') { changeResult(next); return; }
    changeSteps(steps.map(step => step.id === activeTarget ? { ...step, expression: next } : step));
  };
  const targetValue = activeTarget === 'result' ? value : steps.find(step => step.id === activeTarget)?.expression || '';
  const insert = (token: string) => updateTarget(joinToken(targetValue, token));
  const wrapTarget = (name: 'ceil' | 'floor' | 'round') => updateTarget(`${name}(${targetValue || measurement})`);
  const addStep = () => {
    const key = nextStepKey(steps);
    const step = { id: `${Date.now()}-${key}`, key, label: `Calculation ${steps.length + 1}`, expression: measurement };
    const next = [...steps, step];
    changeSteps(next);
    setActiveTarget(step.id);
  };
  const removeStep = (id: string) => {
    const step = steps.find(item => item.id === id);
    const next = steps.filter(item => item.id !== id);
    changeSteps(next);
    if (step && value.includes(step.key)) changeResult(value.replace(new RegExp(`\\b${step.key}\\b`, 'g'), '0'));
    if (activeTarget === id) setActiveTarget('result');
  };
  const renameStep = (id: string, label: string) => changeSteps(steps.map(step => step.id === id ? { ...step, label } : step));

  const measuredTokens = [{ token: measurement, label: measuredLabel(primaryUnit) }];
  if (primaryUnit === 'SF') measuredTokens.push({ token: 'Perimeter', label: 'Measured perimeter' });

  const dimensionProperties = properties.filter(isDimension);
  const countProperties = properties.filter(isCount);
  const selected = (name: string) => properties.find(property => property.variable_key === patternInputs[name]);
  const withUnitConversion = (token: string, property?: FormulaComposerProperty) => String(property?.unit || '').toUpperCase() === 'IN' ? `(${token} / 12)` : token;

  const applyPattern = () => {
    let expression = measurement;
    if (pattern === 'form_contact') {
      const height = selected('height'); const sides = selected('sides');
      if (!height || !sides) return;
      expression = `${measurement} * ${withUnitConversion(height.variable_key, height)} * ${sides.variable_key}`;
    }
    if (pattern === 'volume') {
      const depth = selected('depth');
      if (!depth) return;
      if (primaryUnit === 'SF') expression = `Area * ${withUnitConversion(depth.variable_key, depth)} / 27`;
      else if (primaryUnit === 'LF') {
        const width = selected('width');
        if (!width) return;
        expression = `Length * ${withUnitConversion(width.variable_key, width)} * ${withUnitConversion(depth.variable_key, depth)} / 27`;
      }
    }
    if (pattern === 'locations') {
      const spacing = selected('spacing');
      if (!spacing) return;
      const numerator = String(spacing.unit || '').toUpperCase() === 'IN' && primaryUnit === 'LF' ? `${measurement} * 12` : measurement;
      expression = `ceil(${numerator} / ${spacing.variable_key})`;
    }
    if (pattern === 'stock_laps') {
      const stock = selected('stock'); const lap = selected('lap'); const count = selected('count');
      if (!stock || !lap || !count) return;
      const stockToken = withUnitConversion(stock.variable_key, stock);
      const lapToken = withUnitConversion(lap.variable_key, lap);
      expression = `(${measurement} + max(0, ceil(${measurement} / ${stockToken}) - 1) * ${lapToken}) * ${count.variable_key}`;
    }
    updateTarget(expression);
    setPattern(null);
    setPatternInputs({});
  };

  const patternReady = pattern === 'measured'
    || pattern === 'form_contact' && selected('height') && selected('sides')
    || pattern === 'volume' && selected('depth') && (primaryUnit !== 'LF' || selected('width'))
    || pattern === 'locations' && selected('spacing')
    || pattern === 'stock_laps' && selected('stock') && selected('lap') && selected('count');

  return <section className={`${styles.composer} ${compact ? styles.compact : ''}`}>
    <div className={styles.header}>
      <div>
        <span className={styles.eyebrow}>Calculation</span>
        <strong>{title}</strong>
      </div>
      <div className={styles.modeSwitch}>
        <button type="button" className={mode === 'easy' ? styles.activeMode : ''} onClick={() => changeMode('easy')}>Easy</button>
        <button type="button" className={mode === 'advanced' ? styles.activeMode : ''} onClick={() => changeMode('advanced')}>Advanced</button>
      </div>
    </div>

    {mode === 'easy' ? <>
      <div className={styles.reading}>
        <span>Reads as</span>
        <strong>{readable(analysis.expandedExpression || value || '0')}</strong>
        {outputUnit && <em>{outputUnit}</em>}
      </div>

      <div className={styles.patternBar}>
        <span>Start from</span>
        <button type="button" onClick={() => { setPattern('measured'); updateTarget(measurement); }}>Measured quantity</button>
        {primaryUnit === 'LF' && <button type="button" onClick={() => setPattern('form_contact')}>Form contact</button>}
        {['LF', 'SF'].includes(primaryUnit) && <button type="button" onClick={() => setPattern('volume')}>Concrete volume</button>}
        {['LF', 'SF'].includes(primaryUnit) && <button type="button" onClick={() => setPattern('locations')}>Locations @ spacing</button>}
        {primaryUnit === 'LF' && <button type="button" onClick={() => setPattern('stock_laps')}>Stock runs + laps</button>}
      </div>

      {pattern && pattern !== 'measured' && <div className={styles.patternPanel}>
        <div className={styles.patternTitle}><Braces size={14} /><strong>{pattern === 'form_contact' ? 'Form contact area' : pattern === 'volume' ? 'Concrete volume' : pattern === 'locations' ? 'Locations at spacing' : 'Stock runs + laps'}</strong></div>
        {pattern === 'form_contact' && <>
          <PatternSelect label="Height / depth" value={patternInputs.height || ''} options={dimensionProperties} onChange={value => setPatternInputs(current => ({ ...current, height: value }))} />
          <PatternSelect label="Sides formed" value={patternInputs.sides || ''} options={countProperties} onChange={value => setPatternInputs(current => ({ ...current, sides: value }))} />
        </>}
        {pattern === 'volume' && <>
          {primaryUnit === 'LF' && <PatternSelect label="Width" value={patternInputs.width || ''} options={dimensionProperties} onChange={value => setPatternInputs(current => ({ ...current, width: value }))} />}
          <PatternSelect label={primaryUnit === 'SF' ? 'Thickness' : 'Depth / height'} value={patternInputs.depth || ''} options={dimensionProperties} onChange={value => setPatternInputs(current => ({ ...current, depth: value }))} />
        </>}
        {pattern === 'locations' && <PatternSelect label="Spacing" value={patternInputs.spacing || ''} options={dimensionProperties} onChange={value => setPatternInputs(current => ({ ...current, spacing: value }))} />}
        {pattern === 'stock_laps' && <>
          <PatternSelect label="Stock length" value={patternInputs.stock || ''} options={dimensionProperties} onChange={value => setPatternInputs(current => ({ ...current, stock: value }))} />
          <PatternSelect label="Lap / added length" value={patternInputs.lap || ''} options={dimensionProperties} onChange={value => setPatternInputs(current => ({ ...current, lap: value }))} />
          <PatternSelect label="Runs / bars" value={patternInputs.count || ''} options={countProperties} onChange={value => setPatternInputs(current => ({ ...current, count: value }))} />
        </>}
        <div className={styles.patternActions}><button type="button" onClick={() => setPattern(null)}>Cancel</button><button type="button" disabled={!patternReady} className={styles.primaryButton} onClick={applyPattern}>Use calculation</button></div>
      </div>}

      {steps.length > 0 && <div className={styles.steps}>
        <div className={styles.sectionTitle}><span>Calculation steps</span><small>Break complicated math into named pieces.</small></div>
        {steps.map((step, index) => <div key={step.id} className={`${styles.stepRow} ${activeTarget === step.id ? styles.activeStep : ''}`}>
          <span className={styles.stepNumber}>{index + 1}</span>
          <div className={styles.stepFields}>
            <input className={styles.stepLabel} value={step.label} onChange={event => renameStep(step.id, event.target.value)} onFocus={() => setActiveTarget(step.id)} aria-label="Calculation step name" />
            <input className={styles.expressionLine} value={step.expression} onChange={event => changeSteps(steps.map(item => item.id === step.id ? { ...item, expression: event.target.value } : item))} onFocus={() => setActiveTarget(step.id)} aria-label={`${step.label} calculation`} />
            <span className={styles.stepPreview}>{readable(step.expression)}</span>
          </div>
          <button type="button" className={styles.iconButton} onClick={() => removeStep(step.id)} title="Remove calculation step"><Trash2 size={14} /></button>
        </div>)}
      </div>}

      <div className={`${styles.resultRow} ${activeTarget === 'result' ? styles.activeStep : ''}`}>
        <span className={styles.resultBadge}>Result</span>
        <div className={styles.stepFields}>
          <input className={styles.expressionLine} value={value} onChange={event => changeResult(event.target.value)} onFocus={() => setActiveTarget('result')} aria-label={`${title} result calculation`} />
          <span className={styles.stepPreview}>{readable(value)}</span>
        </div>
      </div>

      <div className={styles.tokenSections}>
        <div className={styles.tokenGroup}><span>Measured</span><div>{measuredTokens.map(item => <button type="button" key={item.token} onClick={() => insert(item.token)}>{item.label}</button>)}</div></div>
        {properties.length > 0 && <div className={styles.tokenGroup}><span>Recipe variables</span><div>{properties.map(property => <button type="button" key={property.variable_key} onClick={() => insert(property.variable_key)}>{property.label}{property.unit ? <small>{property.unit}</small> : null}</button>)}</div></div>}
        {steps.length > 0 && <div className={styles.tokenGroup}><span>Named steps</span><div>{steps.map(step => <button type="button" key={step.id} disabled={step.id === activeTarget} onClick={() => insert(step.key)}>{step.label}</button>)}</div></div>}
        <div className={styles.tokenGroup}><span>Math</span><div>{['+', '-', '*', '/', '(', ')'].map(token => <button type="button" key={token} onClick={() => insert(token)}>{token === '*' ? '×' : token === '/' ? '÷' : token}</button>)}<button type="button" onClick={() => wrapTarget('ceil')}>Round up</button><button type="button" onClick={() => wrapTarget('round')}>Round</button><button type="button" onClick={() => insert('max(0, )')}>Minimum 0</button></div></div>
      </div>

      <div className={styles.easyActions}>
        <button type="button" onClick={addStep}><Plus size={13} /> Add named step</button>
        <button type="button" onClick={() => updateTarget('')} className={styles.quietButton}>Clear selected line</button>
      </div>
    </> : <div className={styles.advanced}>
      <label>Advanced expression<textarea value={value} onChange={event => changeResult(event.target.value)} spellCheck={false} /></label>
      <p>Use measured names such as <code>{measurement}</code>, recipe variable keys, arithmetic, <code>ceil()</code>, <code>round()</code>, <code>min()</code>, and <code>max()</code>. This compiles to the same deterministic Carez calculation as Easy mode.</p>
    </div>}

    <div className={`${styles.analysis} ${analysis.issues.length ? styles.analysisError : styles.analysisGood}`}>
      {analysis.issues.length ? <><CircleAlert size={14} /><div>{analysis.issues.slice(0, 3).map((issue, index) => <span key={`${issue.kind}-${index}`}>{issue.message}</span>)}</div></> : <><Sigma size={14} /><div><strong>Calculation valid</strong>{analysis.resultDimension && <span>{analysis.resultDimension}{analysis.expectedDimension ? ` → ${analysis.expectedDimension}` : ''}</span>}</div></>}
    </div>
  </section>;
}

function PatternSelect({ label, value, options, onChange }: { label: string; value: string; options: FormulaComposerProperty[]; onChange: (value: string) => void }) {
  return <label className={styles.patternField}><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}><option value="">Choose variable…</option>{options.map(option => <option key={option.variable_key} value={option.variable_key}>{optionLabel(option)}</option>)}</select></label>;
}

export function FormulaConditionBuilder({ properties, value, onChange }: { properties: FormulaComposerProperty[]; value: FormulaConditionGroup; onChange: (value: FormulaConditionGroup) => void }) {
  const add = () => onChange({ ...value, conditions: [...value.conditions, { id: `${Date.now()}-${value.conditions.length + 1}`, propertyKey: '', operator: 'eq', value: '' }] });
  const update = (id: string, patch: Partial<FormulaCondition>) => onChange({ ...value, conditions: value.conditions.map(condition => condition.id === id ? { ...condition, ...patch } : condition) });
  const remove = (id: string) => onChange({ ...value, conditions: value.conditions.filter(condition => condition.id !== id) });
  return <section className={styles.conditions}>
    <div className={styles.conditionHeader}><div><span className={styles.eyebrow}>Use only when</span><strong>Conditions</strong></div>{value.conditions.length > 1 && <select value={value.match} onChange={event => onChange({ ...value, match: event.target.value as 'all' | 'any' })}><option value="all">All conditions are true</option><option value="any">Any condition is true</option></select>}</div>
    {value.conditions.length === 0 ? <button type="button" className={styles.addCondition} onClick={add}><Plus size={13} /> Add condition</button> : <div className={styles.conditionList}>
      {value.conditions.map((condition, index) => {
        const property = properties.find(item => item.variable_key === condition.propertyKey);
        return <div key={condition.id} className={styles.conditionRow}>
          <span className={styles.conditionWord}>{index === 0 ? 'When' : value.match === 'all' ? 'And' : 'Or'}</span>
          <select value={condition.propertyKey} onChange={event => update(condition.id, { propertyKey: event.target.value, value: '' })}><option value="">Choose variable…</option>{properties.map(item => <option key={item.variable_key} value={item.variable_key}>{item.label}</option>)}</select>
          <select value={condition.operator} onChange={event => update(condition.id, { operator: event.target.value as FormulaCondition['operator'] })}><option value="eq">is</option><option value="neq">is not</option><option value="gt">greater than</option><option value="gte">at least</option><option value="lt">less than</option><option value="lte">at most</option></select>
          <ConditionValue property={property} value={condition.value} onChange={next => update(condition.id, { value: next })} />
          <button type="button" className={styles.iconButton} onClick={() => remove(condition.id)} title="Remove condition"><Trash2 size={14} /></button>
        </div>;
      })}
      <button type="button" className={styles.addCondition} onClick={add}><Plus size={13} /> Add {value.match === 'all' ? 'AND' : 'OR'} condition</button>
    </div>}
  </section>;
}

function ConditionValue({ property, value, onChange }: { property?: FormulaComposerProperty; value: string; onChange: (value: string) => void }) {
  if (property?.value_type === 'boolean') return <select value={value} onChange={event => onChange(event.target.value)}><option value="">Choose…</option><option value="true">Yes</option><option value="false">No</option></select>;
  if (property?.value_type === 'enum') return <select value={value} onChange={event => onChange(event.target.value)}><option value="">Choose…</option>{enumOptions(property.options).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  return <input value={value} onChange={event => onChange(event.target.value)} inputMode={['number', 'dimension', 'percentage'].includes(String(property?.value_type || '')) ? 'decimal' : 'text'} placeholder="Value" />;
}
