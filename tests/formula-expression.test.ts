import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateTakeoffFormula } from '../lib/takeoff/formula.ts';
import { compileFormulaExpression, formatFormulaExpression, formulaVariableTokens } from '../lib/takeoff/formulaExpression.ts';

test('guided formula expressions hide internal namespaces but keep canonical variables', () => {
  const formula = compileFormulaExpression('Length * form_sides');
  assert.equal(evaluateTakeoffFormula(formula, { 'Takeoff.Length': 100, 'Properties.form_sides': 2 }), 200);
  assert.equal(formatFormulaExpression(formula), 'Length × form_sides');
  assert.deepEqual(formulaVariableTokens('Length * form_sides'), ['Takeoff.Length', 'Properties.form_sides']);
});

test('legacy explicit namespaces remain accepted', () => {
  const formula = compileFormulaExpression('Takeoff.Length * Properties.form_sides');
  assert.equal(evaluateTakeoffFormula(formula, { 'Takeoff.Length': 75, 'Properties.form_sides': 2 }), 150);
  assert.equal(formatFormulaExpression(formula), 'Length × form_sides');
});

test('guided formula functions compile into the canonical AST', () => {
  const rounded = compileFormulaExpression('ceil(Area / 100)');
  assert.equal(evaluateTakeoffFormula(rounded, { 'Takeoff.Area': 251 }), 3);

  const bounded = compileFormulaExpression('max(minimum_order, Volume)');
  assert.equal(evaluateTakeoffFormula(bounded, { 'Properties.minimum_order': 10, 'Takeoff.Volume': 7.5 }), 10);
  assert.deepEqual(formulaVariableTokens('max(minimum_order, Volume)'), ['Properties.minimum_order', 'Takeoff.Volume']);
});

test('unsupported functions fail before publish', () => {
  assert.throws(() => compileFormulaExpression('random(Length)'), /Unsupported formula function/);
  assert.throws(() => compileFormulaExpression('ceil(Length, 2)'), /requires exactly one value/);
});
