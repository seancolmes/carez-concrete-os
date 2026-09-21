import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync('app/globals.css', 'utf8');

function block(selector: string) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, selector + ' block is missing');
  const open = css.indexOf('{', start);
  const close = css.indexOf('\n}', open);
  assert.ok(open >= 0 && close > open, selector + ' block is incomplete');
  return css.slice(open + 1, close);
}

function expectToken(source: string, token: string, value: string) {
  assert.ok(source.includes('--' + token + ': ' + value + ';'), '--' + token + ' must be ' + value);
}

test('light theme uses the approved Claude Amber Remix foundation', () => {
  const root = block(':root');
  for (const [token, value] of Object.entries({
    card:'#f5f4ef',
    ring:'#c96442',
    input:'#b4b2a7',
    muted:'#ede9de',
    accent:'#e9e6dc',
    border:'#dad9d4',
    'chart-1':'#b05730',
    'chart-2':'#9c87f5',
    'chart-3':'#ded8c4',
    'chart-4':'#dbd3f0',
    'chart-5':'#b4552d',
    popover:'#ffffff',
    primary:'#000000',
    sidebar:'#f5f4ee',
    secondary:'#e9e6dc',
    background:'#faf9f5',
    foreground:'#3d3929',
    destructive:'#141413',
    'sidebar-primary':'#c96442',
    'muted-foreground':'#6e6d68',
    'accent-foreground':'#28261b',
    'popover-foreground':'#28261b',
    'primary-foreground':'#ffffff',
    'secondary-foreground':'#535146',
  })) expectToken(root, token, value);
});

test('dark theme uses the approved Claude Amber Remix foundation', () => {
  const dark = block('\n.dark {');
  for (const [token, value] of Object.entries({
    card:'#2c2c2b',
    ring:'#d97757',
    input:'#52514a',
    muted:'#1b1b19',
    accent:'#1a1915',
    border:'#3e3e38',
    'chart-1':'#b05730',
    'chart-2':'#9c87f5',
    'chart-3':'#1a1915',
    'chart-4':'#2f2b48',
    'chart-5':'#b4552d',
    popover:'#30302e',
    primary:'#ffffff',
    sidebar:'#1f1e1d',
    secondary:'#faf9f5',
    background:'#262624',
    foreground:'#f1f1ef',
    destructive:'#ef4444',
    'sidebar-primary':'#343434',
    'muted-foreground':'#b7b5a9',
    'accent-foreground':'#f5f4ee',
    'popover-foreground':'#e5e5e2',
    'primary-foreground':'#141413',
    'secondary-foreground':'#30302e',
  })) expectToken(dark, token, value);
});

test('Carez semantic aliases derive from the theme instead of a hard-coded Cobalt palette', () => {
  const root = block(':root');
  for (const expected of [
    '--surface-canvas: var(--background);',
    '--surface-panel: var(--card);',
    '--surface-raised: var(--popover);',
    '--text-primary: var(--foreground);',
    '--text-muted: var(--muted-foreground);',
    '--border-default: var(--border);',
    '--interaction-primary: var(--ring);',
    '--interaction-selection: var(--accent);',
    '--interaction-focus: var(--ring);',
    '--spatial-accent: var(--ring);',
  ]) assert.ok(root.includes(expected), expected);
  assert.equal(css.includes('#0047AB'), false, 'Cobalt runtime color must be removed');
  assert.equal(css.includes('#82C8E5'), false, 'Cobalt ice runtime color must be removed');
});
