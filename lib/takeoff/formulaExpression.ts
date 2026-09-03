import type { FormulaValue } from './formula';

type Token = { type: 'number' | 'identifier' | 'operator' | 'paren' | 'comma'; value: string };

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const functionNames = new Set(['ceil', 'floor', 'round', 'min', 'max']);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) { index += 1; continue; }
    if ('+-*/'.includes(char)) { tokens.push({ type: 'operator', value: char }); index += 1; continue; }
    if ('()'.includes(char)) { tokens.push({ type: 'paren', value: char }); index += 1; continue; }
    if (char === ',') { tokens.push({ type: 'comma', value: char }); index += 1; continue; }
    if (/\d|\./.test(char)) {
      let end = index + 1;
      while (end < source.length && /[\d.]/.test(source[end])) end += 1;
      const value = source.slice(index, end);
      if (!/^\d*\.?\d+$/.test(value)) throw new Error(`Invalid number: ${value}`);
      tokens.push({ type: 'number', value });
      index = end;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_.]/.test(source[end])) end += 1;
      const value = source.slice(index, end);
      if (!identifierPattern.test(value)) throw new Error(`Invalid property token: ${value}`);
      tokens.push({ type: 'identifier', value });
      index = end;
      continue;
    }
    throw new Error(`Unsupported formula character: ${char}`);
  }
  return tokens;
}

const opName = (operator: string) => operator === '+' ? 'add' : operator === '-' ? 'sub' : operator === '*' ? 'mul' : 'div';

export function compileFormulaExpression(source: string): FormulaValue {
  const tokens = tokenize(source.trim());
  if (!tokens.length) throw new Error('Formula is required.');
  let cursor = 0;

  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];

  const primary = (): FormulaValue => {
    const token = take();
    if (!token) throw new Error('Formula ended unexpectedly.');
    if (token.type === 'number') return { const: Number(token.value) } as FormulaValue;
    if (token.type === 'identifier') {
      if (peek()?.type === 'paren' && peek().value === '(') {
        if (!functionNames.has(token.value.toLowerCase())) throw new Error(`Unsupported formula function: ${token.value}`);
        take();
        const args: FormulaValue[] = [];
        if (!(peek()?.type === 'paren' && peek().value === ')')) {
          args.push(expression());
          while (peek()?.type === 'comma') {
            take();
            args.push(expression());
          }
        }
        const closing = take();
        if (!closing || closing.type !== 'paren' || closing.value !== ')') throw new Error(`Missing closing parenthesis for ${token.value}.`);
        const fn = token.value.toLowerCase();
        if (['ceil', 'floor', 'round'].includes(fn)) {
          if (args.length !== 1) throw new Error(`${fn}() requires exactly one value.`);
          return { op: fn, value: args[0] } as FormulaValue;
        }
        if (args.length < 1) throw new Error(`${fn}() requires at least one value.`);
        return { op: fn, args } as FormulaValue;
      }
      return { var: token.value } as FormulaValue;
    }
    if (token.type === 'operator' && token.value === '-') {
      return { op: 'mul', args: [{ const: -1 }, primary()] } as FormulaValue;
    }
    if (token.type === 'paren' && token.value === '(') {
      const value = expression();
      const closing = take();
      if (!closing || closing.type !== 'paren' || closing.value !== ')') throw new Error('Missing closing parenthesis.');
      return value;
    }
    throw new Error(`Unexpected formula token: ${token.value}`);
  };

  const product = (): FormulaValue => {
    let left = primary();
    while (peek()?.type === 'operator' && ['*', '/'].includes(peek().value)) {
      const operator = take().value;
      const right = primary();
      left = { op: opName(operator), args: [left, right] } as FormulaValue;
    }
    return left;
  };

  const expression = (): FormulaValue => {
    let left = product();
    while (peek()?.type === 'operator' && ['+', '-'].includes(peek().value)) {
      const operator = take().value;
      const right = product();
      left = { op: opName(operator), args: [left, right] } as FormulaValue;
    }
    return left;
  };

  const result = expression();
  if (cursor !== tokens.length) throw new Error(`Unexpected formula token: ${tokens[cursor].value}`);
  return result;
}

const precedence = (op: string) => op === 'add' || op === 'sub' ? 1 : op === 'mul' || op === 'div' ? 2 : 3;

export function formatFormulaExpression(expr: FormulaValue, parentPrecedence = 0): string {
  if (typeof expr === 'number') return String(expr);
  if (!expr || typeof expr !== 'object') return '';
  if ('const' in expr) return String(expr.const);
  if ('var' in expr) return String(expr.var || '');
  const op = String(expr.op || '');
  const args = Array.isArray(expr.args) ? expr.args : [];
  if (['add', 'sub', 'mul', 'div'].includes(op) && args.length >= 2) {
    const symbol = op === 'add' ? ' + ' : op === 'sub' ? ' - ' : op === 'mul' ? ' × ' : ' ÷ ';
    const own = precedence(op);
    const value = args.map((arg: FormulaValue) => formatFormulaExpression(arg, own)).join(symbol);
    return own < parentPrecedence ? `(${value})` : value;
  }
  if (op === 'round') return `round(${formatFormulaExpression((expr as any).value)})`;
  if (op === 'ceil') return `ceil(${formatFormulaExpression((expr as any).value)})`;
  if (op === 'floor') return `floor(${formatFormulaExpression((expr as any).value)})`;
  if (op === 'min' || op === 'max') return `${op}(${args.map((arg: FormulaValue) => formatFormulaExpression(arg)).join(', ')})`;
  return 'Advanced formula';
}

export function formulaVariableTokens(source: string): string[] {
  return [...new Set(tokenize(source).filter(token => token.type === 'identifier' && !functionNames.has(token.value.toLowerCase())).map(token => token.value))];
}
