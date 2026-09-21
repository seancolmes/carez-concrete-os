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

test('light theme uses the approved Slate Haze foundation', () => {
  const root = block(':root');
  for (const [token, value] of Object.entries({
    card:'#faf9f5',
    ring:'oklch(0.554 0.046 257.417)',
    input:'oklch(0.922 0 0)',
    muted:'oklch(0.923 0.003 48.717)',
    accent:'#e9e6dc',
    border:'oklch(0.869 0.005 56.366)',
    'chart-1':'oklch(0.809 0.105 251.813)',
    'chart-2':'oklch(0.811 0.111 293.571)',
    'chart-3':'#ded8c4',
    'chart-4':'oklch(0.704 0.04 256.788)',
    'chart-5':'oklch(0.588 0.158 241.966)',
    popover:'#ffffff',
    primary:'oklch(0.704 0.04 256.788)',
    sidebar:'#f5f4ee',
    secondary:'oklch(0.869 0.022 252.894)',
    background:'#faf9f5',
    foreground:'oklch(0.145 0 0)',
    'sidebar-primary':'oklch(0.554 0.046 257.417)',
    'muted-foreground':'oklch(0.553 0.013 58.071)',
    'secondary-foreground':'oklch(0.372 0.044 257.287)',
  })) expectToken(root, token, value);
});

test('dark theme uses the approved Slate Haze foundation', () => {
  const dark = block('\n.dark {');
  for (const [token, value] of Object.entries({
    card:'#262624',
    ring:'oklch(0.869 0.022 252.894)',
    input:'#52514a',
    muted:'#1b1b19',
    accent:'#1a1915',
    border:'#3e3e38',
    'chart-1':'oklch(0.746 0.16 232.661)',
    'chart-2':'oklch(0.811 0.111 293.571)',
    'chart-3':'oklch(0.923 0.003 48.717)',
    'chart-4':'oklch(0.554 0.046 257.417)',
    'chart-5':'oklch(0.956 0.045 203.388)',
    popover:'#30302e',
    primary:'oklch(0.901 0.058 230.902)',
    sidebar:'#1f1e1d',
    secondary:'#faf9f5',
    background:'#262624',
    foreground:'#c3c0b6',
    'muted-foreground':'#b7b5a9',
    'primary-foreground':'oklch(0.145 0 0)',
  })) expectToken(dark, token, value);
});

test('Carez shell and semantic aliases derive from Slate Haze', () => {
  const root = block(':root');
  for (const expected of [
    '--surface-canvas: var(--background);',
    '--surface-panel: var(--card);',
    '--interaction-primary: var(--primary);',
    '--interaction-selection: var(--accent);',
    '--interaction-focus: var(--ring);',
    '--spatial-accent: var(--primary);',
    '--shell-background: #f5f4ee;',
    '--shell-surface: #faf9f5;',
    '--shell-primary: oklch(0.554 0.046 257.417);',
  ]) assert.ok(root.includes(expected), expected);
  assert.equal(css.includes('#c96442'), false, 'superseded amber ring must be removed');
  assert.equal(css.includes('#d97757'), false, 'superseded dark amber ring must be removed');
  const dark = block('\n.dark {');
  assert.ok(dark.includes('--shell-background: #1f1e1d;'));
  assert.ok(dark.includes('--shell-surface: #262624;'));
  assert.ok(dark.includes('--shell-primary: #343434;'));
});
