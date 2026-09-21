import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync('app/globals.css', 'utf8');
const layout = readFileSync('app/layout.tsx', 'utf8');

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

test('light theme uses the approved Indigo Harbor foundation', () => {
  const root = block(':root');
  for (const [token, value] of Object.entries({
    card:'#ffffff',
    ring:'#324f9a',
    input:'#ffffff',
    muted:'#f5f5f5',
    accent:'#19398d',
    border:'#e3e3e3',
    'chart-1':'#0159b7',
    'chart-2':'#13c9aa',
    'chart-3':'#cf3fd9',
    'chart-4':'#8f3c1e',
    'chart-5':'#17ab92',
    popover:'#ffffff',
    primary:'#19398d',
    sidebar:'#001B3C',
    secondary:'#0a0a0a',
    background:'#f3f5fb',
    foreground:'#010101',
    destructive:'#9b0033',
    'sidebar-primary':'#19398d',
    'muted-foreground':'#454545',
    'primary-foreground':'#f3f5f9',
  })) expectToken(root, token, value);
  expectToken(root, 'spacing', '0.24rem');
});

test('dark theme uses the approved Indigo Harbor foundation', () => {
  const dark = block('\n.dark {');
  for (const [token, value] of Object.entries({
    card:'#0a0a0a',
    ring:'#6a8dd8',
    input:'#121212',
    muted:'#262626',
    accent:'#404040',
    border:'#282828',
    'chart-1':'#6a8dd8',
    'chart-2':'#2062ce',
    'chart-3':'#4c5f00',
    'chart-4':'#cc7455',
    'chart-5':'#4bb3a1',
    popover:'#171717',
    primary:'#6a8dd8',
    sidebar:'#0a0a0a',
    secondary:'#171717',
    background:'#050505',
    foreground:'#fafafa',
    destructive:'#cd6e7b',
    'sidebar-primary':'#6a8dd8',
    'muted-foreground':'#a1a1a1',
    'primary-foreground':'#0a0a0a',
  })) expectToken(dark, token, value);
  expectToken(dark, 'spacing', '0.24rem');
});

test('Carez semantic and shell aliases derive from Indigo Harbor', () => {
  const root = block(':root');
  for (const expected of [
    '--surface-canvas: var(--background);',
    '--surface-panel: var(--card);',
    '--text-secondary: var(--muted-foreground);',
    '--interaction-primary: var(--primary);',
    '--interaction-selection: var(--accent);',
    '--interaction-focus: var(--ring);',
    '--spatial-accent: var(--primary);',
    '--shell-background: #001B3C;',
    '--shell-surface: #001B3C;',
    '--shell-primary: #19398d;',
  ]) assert.ok(root.includes(expected), expected);
  const dark = block('\n.dark {');
  assert.ok(dark.includes('--shell-background: #0a0a0a;'));
  assert.ok(dark.includes('--shell-surface: #0a0a0a;'));
  assert.ok(dark.includes('--shell-primary: #6a8dd8;'));
});

test('Indigo Harbor uses Inter with IBM Plex Mono reserved for technical text', () => {
  assert.match(css, /--font-sans: var\(--font-inter\);/);
  assert.match(css, /--font-mono: var\(--font-ibm-plex-mono\);/);
  assert.match(layout, /IBM_Plex_Mono, Inter/);
  assert.match(layout, /variable: '--font-inter'/);
  assert.equal(layout.includes('Manrope'), false);
});
