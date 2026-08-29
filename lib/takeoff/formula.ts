export type FormulaValue = number | { [key: string]: any };
export type FormulaVariables = Record<string, number>;

function finite(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${label} is not a valid number.`);
  return n;
}

export function evaluateTakeoffFormula(expr: FormulaValue, vars: FormulaVariables): number {
  if (typeof expr === 'number') return finite(expr, 'Formula value');
  if (!expr || typeof expr !== 'object') throw new Error('Invalid takeoff formula.');

  if ('const' in expr) return finite(expr.const, 'Formula constant');
  if ('var' in expr) {
    const key = String(expr.var || '');
    if (!(key in vars)) throw new Error(`Missing assembly input: ${key}`);
    return finite(vars[key], key);
  }

  const op = String(expr.op || '');
  const args = Array.isArray(expr.args) ? expr.args : [];
  const values = () => args.map((arg: FormulaValue) => evaluateTakeoffFormula(arg, vars));

  switch (op) {
    case 'add': return values().reduce((sum: number, n: number) => sum + n, 0);
    case 'sub': {
      const v = values();
      if (!v.length) return 0;
      return v.slice(1).reduce((result: number, n: number) => result - n, v[0]);
    }
    case 'mul': return values().reduce((product: number, n: number) => product * n, 1);
    case 'div': {
      const v = values();
      if (v.length !== 2) throw new Error('Division formulas require exactly two values.');
      if (Math.abs(v[1]) < 1e-12) throw new Error('Assembly formula attempted to divide by zero.');
      return v[0] / v[1];
    }
    case 'min': return Math.min(...values());
    case 'max': return Math.max(...values());
    case 'ceil': return Math.ceil(evaluateTakeoffFormula(expr.value, vars));
    case 'floor': return Math.floor(evaluateTakeoffFormula(expr.value, vars));
    case 'round': {
      const n = evaluateTakeoffFormula(expr.value, vars);
      const digits = Math.max(0, Math.min(6, Number(expr.digits ?? 2)));
      const factor = 10 ** digits;
      return Math.round((n + Number.EPSILON) * factor) / factor;
    }
    case 'piecewise_lte': {
      const value = evaluateTakeoffFormula(expr.value, vars);
      const cases = Array.isArray(expr.cases) ? expr.cases : [];
      for (const entry of cases) {
        const limit = finite(entry?.lte, 'Piecewise limit');
        if (value <= limit) return evaluateTakeoffFormula(typeof entry?.then === 'object' ? entry.then : { const: entry?.then }, vars);
      }
      return evaluateTakeoffFormula(typeof expr.else === 'object' ? expr.else : { const: expr.else ?? 0 }, vars);
    }
    default:
      throw new Error(`Unsupported takeoff formula operation: ${op || 'unknown'}`);
  }
}

export function roundTakeoff(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formulaTrace(expr: FormulaValue, vars: FormulaVariables, result: number) {
  return { formula: expr, inputs: vars, result: roundTakeoff(result, 6) };
}
