import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateTakeoffFormula } from '../lib/takeoff/formula.ts';
import { compileFormulaExpression, formatFormulaExpression, formulaVariableTokens } from '../lib/takeoff/formulaExpression.ts';

test('guided formula expressions keep ordinary concrete math deterministic', () => {
  const formula = compileFormulaExpression('Takeoff.Length * Properties.form_sides');
  assert.equal(evaluateTakeoffFormula(formula, { 'Takeoff.Length': 100, 'Properties.form_sides': 2 }), 200);
  assert.equal(formatFormulaExpression(formula), 'Takeoff.Length × Properties.form_sides');
});

test('guided formula functions compile into the canonical AST', () => {
  const rounded = compileFormulaExpression('ceil(Takeoff.Area / 100)');
  assert.equal(evaluateTakeoffFormula(rounded, { 'Takeoff.Area': 251 }), 3);

  const bounded = compileFormulaExpression('max(Properties.minimum_order, Takeoff.Volume)');
  assert.equal(evaluateTakeoffFormula(bounded, { 'Properties.minimum_order': 10, 'Takeoff.Volume': 7.5 }), 10);
  assert.deepEqual(formulaVariableTokens('max(Properties.minimum_order, Takeoff.Volume)'), ['Properties.minimum_order', 'Takeoff.Volume']);
});

test('unsupported functions fail before publish', () => {
  assert.throws(() => compileFormulaExpression('random(Takeoff.Length)'), /Unsupported formula function/);
  assert.throws(() => compileFormulaExpression('ceil(Takeoff.Length, 2)'), /requires exactly one value/);
});
