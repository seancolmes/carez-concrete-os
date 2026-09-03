import type { FormulaValue } from './formula.ts';
import { enumOptions } from './assemblyContext.ts';
import { compileFormulaExpression, formulaVariableTokens } from './formulaExpression.ts';

export type FormulaComposerStep = {
  id: string;
  key: string;
  label: string;
  expression: string;
};

export type FormulaComposerProperty = {
  variable_key: string;
  label: string;
  value_type?: string | null;
  unit?: string | null;
  options?: unknown;
};

export type FormulaComposerIssue = {
  kind: 'unknown_variable' | 'duplicate_step' | 'step_cycle' | 'invalid_step' | 'unit_mismatch' | 'formula';
  message: string;
};

export type FormulaComposerAnalysis = {
  ast: FormulaValue | null;
  expandedExpression: string;
  issues: FormulaComposerIssue[];
  resultDimension: string | null;
  expectedDimension: string | null;
};

const builtInFunctions = new Set(['ceil', 'floor', 'round', 'min', 'max']);
const identifierRegex = /[A-Za-z_][A-Za-z0-9_.]*/g;
const safeStepKey = /^[A-Za-z_][A-Za-z0-9_]*$/;

const identifiers = (source: string) => [...new Set((source.match(identifierRegex) || [])
  .filter(token => !builtInFunctions.has(token.toLowerCase())))];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function expandNamedSteps(steps: FormulaComposerStep[], resultExpression: string) {
  const issues: FormulaComposerIssue[] = [];
  const byKey = new Map<string, FormulaComposerStep>();
  for (const step of steps) {
    const key = String(step.key || '').trim();
    if (!safeStepKey.test(key)) {
      issues.push({ kind: 'invalid_step', message: `Calculation step “${step.label || key || 'Unnamed step'}” needs a simple name.` });
      continue;
    }
    if (byKey.has(key)) issues.push({ kind: 'duplicate_step', message: `Calculation step “${step.label || key}” uses the same key as another step.` });
    byKey.set(key, step);
  }

  const memo = new Map<string, string>();
  const visiting = new Set<string>();
  const expandStep = (key: string): string => {
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const step = byKey.get(key);
    if (!step) return key;
    if (visiting.has(key)) {
      issues.push({ kind: 'step_cycle', message: `Calculation steps contain a dependency cycle at “${step.label || key}”.` });
      return key;
    }
    visiting.add(key);
    let expanded = String(step.expression || '').trim();
    for (const token of identifiers(expanded)) {
      if (!byKey.has(token)) continue;
      const replacement = expandStep(token);
      expanded = expanded.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'g'), `(${replacement})`);
    }
    visiting.delete(key);
    memo.set(key, expanded);
    return expanded;
  };

  for (const key of byKey.keys()) expandStep(key);
  let expandedResult = String(resultExpression || '').trim();
  for (const token of identifiers(expandedResult)) {
    if (!byKey.has(token)) continue;
    expandedResult = expandedResult.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'g'), `(${expandStep(token)})`);
  }
  return { expression: expandedResult, issues };
}

type Dimension = Record<'L' | 'M' | 'T', number>;
const scalar = (): Dimension => ({ L: 0, M: 0, T: 0 });
const dimension = (L = 0, M = 0, T = 0): Dimension => ({ L, M, T });
const addDimension = (a: Dimension, b: Dimension, direction = 1): Dimension => ({ L: a.L + b.L * direction, M: a.M + b.M * direction, T: a.T + b.T * direction });
const sameDimension = (a: Dimension, b: Dimension) => a.L === b.L && a.M === b.M && a.T === b.T;
const dimensionLabel = (value: Dimension | null) => {
  if (!value) return null;
  if (sameDimension(value, scalar())) return 'scalar/count';
  if (sameDimension(value, dimension(1))) return 'length';
  if (sameDimension(value, dimension(2))) return 'area';
  if (sameDimension(value, dimension(3))) return 'volume';
  if (sameDimension(value, dimension(0, 1))) return 'weight';
  if (sameDimension(value, dimension(0, 0, 1))) return 'time';
  if (sameDimension(value, dimension(-1, 1))) return 'weight per length';
  if (sameDimension(value, dimension(-1, 0, 1))) return 'time per length';
  if (sameDimension(value, dimension(-2, 0, 1))) return 'time per area';
  if (sameDimension(value, dimension(-3, 0, 1))) return 'time per volume';
  if (sameDimension(value, dimension(0, -1, 1))) return 'time per weight';
  return `L^${value.L} M^${value.M} T^${value.T}`;
};

export function unitDimension(unit: string | null | undefined): Dimension | null {
  const normalized = String(unit || '').trim().toUpperCase();
  if (!normalized) return null;
  if (['IN', 'FT', 'LF'].includes(normalized)) return dimension(1);
  if (['SF', 'SFCA'].includes(normalized)) return dimension(2);
  if (['CF', 'CY'].includes(normalized)) return dimension(3);
  if (['LB', 'TON'].includes(normalized)) return dimension(0, 1);
  if (['HR', 'MH', 'DAY'].includes(normalized)) return dimension(0, 0, 1);
  if (['EA', 'LS', '%', 'GAL'].includes(normalized)) return scalar();
  const [numerator, denominator, ...rest] = normalized.split('/');
  if (denominator && !rest.length) {
    const top = unitDimension(numerator);
    const bottom = unitDimension(denominator);
    if (top && bottom) return addDimension(top, bottom, -1);
  }
  return null;
}

const measuredDimension = (key: string, primaryUnit: string) => {
  if (key === 'Takeoff.Length' || key === 'Takeoff.Perimeter') return dimension(1);
  if (key === 'Takeoff.Area') return dimension(2);
  if (key === 'Takeoff.Volume') return dimension(3);
  if (key === 'Takeoff.Count') return scalar();
  if (key === 'Takeoff.Quantity' || key === 'quantity') return unitDimension(primaryUnit) || scalar();
  return null;
};

const allowedMeasurements = (primaryUnit: string, perimeterAvailable: boolean) => {
  const allowed = new Set(['Takeoff.Quantity', 'quantity']);
  if (primaryUnit === 'LF') allowed.add('Takeoff.Length');
  if (primaryUnit === 'SF') allowed.add('Takeoff.Area');
  if (primaryUnit === 'EA') allowed.add('Takeoff.Count');
  if (primaryUnit === 'CY') allowed.add('Takeoff.Volume');
  if (perimeterAvailable) allowed.add('Takeoff.Perimeter');
  return allowed;
};

function propertyDimension(token: string, properties: FormulaComposerProperty[]) {
  const key = token.replace(/^Properties\./, '');
  const [variableKey, attribute] = key.split('.', 2);
  const property = properties.find(item => item.variable_key === variableKey);
  if (!property) return null;
  if (attribute) {
    const optionAttributes = enumOptions(property.options).flatMap(option => Object.keys(option.attributes || {}));
    if (!optionAttributes.includes(attribute)) return null;
    if (attribute === 'lb_per_ft') return dimension(-1, 1);
    return scalar();
  }
  return unitDimension(property.unit) || scalar();
}

function inferDimension(expr: FormulaValue, variableDimensions: Map<string, Dimension>, issues: FormulaComposerIssue[]): Dimension | null {
  if (typeof expr === 'number') return scalar();
  if (!expr || typeof expr !== 'object') return null;
  if ('const' in expr) return scalar();
  if ('var' in expr) return variableDimensions.get(String(expr.var || '')) || null;
  const op = String(expr.op || '');
  const args = Array.isArray((expr as { args?: FormulaValue[] }).args) ? (expr as { args: FormulaValue[] }).args : [];
  if (['add', 'sub', 'min', 'max'].includes(op)) {
    const dimensions = args.map(arg => inferDimension(arg, variableDimensions, issues)).filter(Boolean) as Dimension[];
    if (!dimensions.length) return null;
    if (dimensions.some(item => !sameDimension(item, dimensions[0]))) {
      issues.push({ kind: 'unit_mismatch', message: `${op === 'add' || op === 'sub' ? 'Addition/subtraction' : 'Min/max'} combines incompatible units.` });
      return null;
    }
    return dimensions[0];
  }
  if (op === 'mul') {
    const dimensions = args.map(arg => inferDimension(arg, variableDimensions, issues));
    if (dimensions.some(item => !item)) return null;
    return (dimensions as Dimension[]).reduce((acc, item) => addDimension(acc, item), scalar());
  }
  if (op === 'div' && args.length === 2) {
    const left = inferDimension(args[0], variableDimensions, issues);
    const right = inferDimension(args[1], variableDimensions, issues);
    return left && right ? addDimension(left, right, -1) : null;
  }
  if (['ceil', 'floor', 'round'].includes(op) && 'value' in expr) return inferDimension((expr as { value: FormulaValue }).value, variableDimensions, issues);
  return null;
}

export function analyzeFormulaComposer(input: {
  expression: string;
  steps?: FormulaComposerStep[];
  properties: FormulaComposerProperty[];
  primaryUnit: string;
  outputUnit?: string | null;
  perimeterAvailable?: boolean;
}): FormulaComposerAnalysis {
  const expanded = expandNamedSteps(input.steps || [], input.expression);
  const issues = [...expanded.issues];
  let ast: FormulaValue | null = null;
  try {
    ast = compileFormulaExpression(expanded.expression);
  } catch (error) {
    issues.push({ kind: 'formula', message: error instanceof Error ? error.message : 'Formula is invalid.' });
    return { ast: null, expandedExpression: expanded.expression, issues, resultDimension: null, expectedDimension: dimensionLabel(unitDimension(input.outputUnit)) };
  }

  const measurements = allowedMeasurements(input.primaryUnit, Boolean(input.perimeterAvailable));
  for (const token of formulaVariableTokens(expanded.expression)) {
    if (measurements.has(token)) continue;
    if (token.startsWith('Properties.')) {
      const key = token.slice('Properties.'.length);
      const [propertyKey, attribute] = key.split('.', 2);
      const property = input.properties.find(item => item.variable_key === propertyKey);
      if (property && (!attribute || enumOptions(property.options).some(option => Object.prototype.hasOwnProperty.call(option.attributes || {}, attribute)))) continue;
    }
    issues.push({ kind: 'unknown_variable', message: `Unknown measurement or recipe variable “${token.replace(/^Properties\./, '')}”.` });
  }

  const dimensions = new Map<string, Dimension>();
  for (const measurement of measurements) {
    const value = measuredDimension(measurement, input.primaryUnit);
    if (value) dimensions.set(measurement, value);
  }
  for (const property of input.properties) {
    const value = propertyDimension(`Properties.${property.variable_key}`, input.properties);
    if (value) dimensions.set(`Properties.${property.variable_key}`, value);
    for (const attribute of enumOptions(property.options).flatMap(option => Object.keys(option.attributes || {}))) {
      const attributeDimension = propertyDimension(`Properties.${property.variable_key}.${attribute}`, input.properties);
      if (attributeDimension) dimensions.set(`Properties.${property.variable_key}.${attribute}`, attributeDimension);
    }
  }
  const result = inferDimension(ast, dimensions, issues);
  const expected = unitDimension(input.outputUnit);
  if (result && expected && !sameDimension(result, expected)) {
    issues.push({ kind: 'unit_mismatch', message: `Calculation resolves to ${dimensionLabel(result)}, but the output unit ${input.outputUnit} is ${dimensionLabel(expected)}.` });
  }
  return {
    ast,
    expandedExpression: expanded.expression,
    issues,
    resultDimension: dimensionLabel(result),
    expectedDimension: dimensionLabel(expected),
  };
}

export function defaultFormulaSteps(expression: string): FormulaComposerStep[] {
  return expression.trim() ? [{ id: 'result', key: 'result', label: 'Result', expression }] : [];
}
