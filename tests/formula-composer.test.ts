import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeFormulaComposer } from '../lib/takeoff/formulaComposer.ts';

const properties = [
  { variable_key: 'form_height_ft', label: 'Form height', value_type: 'dimension', unit: 'FT' },
  { variable_key: 'sides_formed', label: 'Sides formed', value_type: 'number', unit: 'EA' },
  { variable_key: 'stock_length_ft', label: 'Stock length', value_type: 'dimension', unit: 'FT' },
  { variable_key: 'lap_length_ft', label: 'Lap length', value_type: 'dimension', unit: 'FT' },
  { variable_key: 'bars_in_run', label: 'Bars in run', value_type: 'number', unit: 'EA' },
];

test('named calculation steps inline into one deterministic AST', () => {
  const analysis = analyzeFormulaComposer({
    primaryUnit: 'LF',
    outputUnit: 'LF',
    properties,
    steps: [
      { id: 's1', key: 'splices', label: 'Splices per run', expression: 'max(0, ceil(Length / stock_length_ft) - 1)' },
      { id: 's2', key: 'added_lap', label: 'Added lap', expression: 'splices * lap_length_ft' },
      { id: 's3', key: 'bar_length', label: 'Bar length', expression: 'Length + added_lap' },
    ],
    expression: 'bar_length * bars_in_run',
  });
  assert.equal(analysis.issues.length, 0);
  assert.ok(analysis.ast);
  assert.match(analysis.expandedExpression, /ceil\(Length \/ stock_length_ft\)/);
});

test('unknown recipe variable is rejected before save', () => {
  const analysis = analyzeFormulaComposer({
    primaryUnit: 'LF',
    outputUnit: 'LF',
    properties,
    expression: 'Length * missing_bar_count',
  });
  assert.ok(analysis.issues.some(issue => issue.kind === 'unknown_variable'));
});

test('named step cycles are rejected', () => {
  const analysis = analyzeFormulaComposer({
    primaryUnit: 'LF',
    outputUnit: 'LF',
    properties,
    steps: [
      { id: 'a', key: 'step_a', label: 'Step A', expression: 'step_b + Length' },
      { id: 'b', key: 'step_b', label: 'Step B', expression: 'step_a + Length' },
    ],
    expression: 'step_a',
  });
  assert.ok(analysis.issues.some(issue => issue.kind === 'step_cycle'));
});

test('unit analysis rejects adding length and area', () => {
  const analysis = analyzeFormulaComposer({
    primaryUnit: 'SF',
    outputUnit: 'SF',
    perimeterAvailable: true,
    properties,
    expression: 'Area + Perimeter',
  });
  assert.ok(analysis.issues.some(issue => issue.kind === 'unit_mismatch'));
});

test('form contact math resolves to area', () => {
  const analysis = analyzeFormulaComposer({
    primaryUnit: 'LF',
    outputUnit: 'SFCA',
    properties,
    expression: 'Length * form_height_ft * sides_formed',
  });
  assert.equal(analysis.resultDimension, 'area');
  assert.equal(analysis.issues.length, 0);
});
