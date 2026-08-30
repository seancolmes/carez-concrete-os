export type RuleScalar = number | string | boolean;
export type RuleValue = { var: string } | { const: RuleScalar | RuleScalar[] | null };
export type RuleExpression =
  | { op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; left: RuleValue; right: RuleValue }
  | { op: 'and' | 'or'; args: RuleExpression[] }
  | { op: 'not'; arg: RuleExpression }
  | { op: 'exists'; value: RuleValue }
  | { op: 'in'; value: RuleValue; values: RuleValue[] };
export type RuleContext = Record<string, unknown>;

const resolve = (value: RuleValue, context: RuleContext): RuleScalar | RuleScalar[] | null | undefined => {
  if ('const' in value) return value.const;
  let current: unknown = context;
  for (const part of value.var.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current as RuleScalar | RuleScalar[] | null | undefined;
};
const isValue = (value: unknown): value is RuleValue => Boolean(value && typeof value === 'object' && (typeof (value as { var?: unknown }).var === 'string' || 'const' in value));

export function validateRuleExpression(rule: unknown): asserts rule is RuleExpression {
  if (!rule || typeof rule !== 'object' || typeof (rule as { op?: unknown }).op !== 'string') throw new Error('Invalid activation rule.');
  const source = rule as Record<string, unknown>;
  if (['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(String(source.op))) { if (!isValue(source.left) || !isValue(source.right)) throw new Error('Comparison rules require left and right values.'); return; }
  if (source.op === 'and' || source.op === 'or') { if (!Array.isArray(source.args) || !source.args.length) throw new Error(`${source.op} rules require arguments.`); source.args.forEach(validateRuleExpression); return; }
  if (source.op === 'not') { validateRuleExpression(source.arg); return; }
  if (source.op === 'exists') { if (!isValue(source.value)) throw new Error('Exists rules require a value.'); return; }
  if (source.op === 'in') { if (!isValue(source.value) || !Array.isArray(source.values) || !source.values.every(isValue)) throw new Error('In rules require a value and values.'); return; }
  throw new Error(`Unsupported activation rule operation: ${String(source.op)}.`);
}

export function evaluateRule(rule: RuleExpression | null | undefined, context: RuleContext): boolean {
  if (!rule) return true;
  validateRuleExpression(rule);
  const compare = (left: RuleValue, right: RuleValue, test: (a: RuleScalar, b: RuleScalar) => boolean) => { const a = resolve(left, context), b = resolve(right, context); return a !== null && a !== undefined && b !== null && b !== undefined && !Array.isArray(a) && !Array.isArray(b) && test(a, b); };
  switch (rule.op) {
    case 'eq': return compare(rule.left, rule.right, (a, b) => a === b);
    case 'neq': return compare(rule.left, rule.right, (a, b) => a !== b);
    case 'gt': return compare(rule.left, rule.right, (a, b) => typeof a === 'number' && typeof b === 'number' && a > b);
    case 'gte': return compare(rule.left, rule.right, (a, b) => typeof a === 'number' && typeof b === 'number' && a >= b);
    case 'lt': return compare(rule.left, rule.right, (a, b) => typeof a === 'number' && typeof b === 'number' && a < b);
    case 'lte': return compare(rule.left, rule.right, (a, b) => typeof a === 'number' && typeof b === 'number' && a <= b);
    case 'and': return rule.args.every(child => evaluateRule(child, context));
    case 'or': return rule.args.some(child => evaluateRule(child, context));
    case 'not': return !evaluateRule(rule.arg, context);
    case 'exists': { const value = resolve(rule.value, context); return value !== null && value !== undefined; }
    case 'in': { const actual = resolve(rule.value, context); return actual !== undefined && rule.values.some(value => resolve(value, context) === actual); }
  }
}
