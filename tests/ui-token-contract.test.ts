import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const globals = readFileSync(new URL('app/globals.css', root), 'utf8');
const layout = readFileSync(new URL('app/layout.tsx', root), 'utf8');
const block = (pattern: RegExp, source: string) => source.match(pattern)?.[1] ?? '';

const requiredThemeTokens = [
  '--surface-canvas', '--surface-panel', '--surface-raised',
  '--text-primary', '--text-secondary', '--text-muted',
  '--border-default', '--border-strong',
  '--interaction-primary', '--interaction-selection', '--interaction-focus',
  '--status-success', '--status-warning', '--status-error', '--status-info',
];

test('light and dark token blocks are independent and complete', () => {
  assert.doesNotMatch(globals, /:root\s*,\s*\.dark/);
  const light = block(/:root\s*\{([\s\S]*?)\n\}/, globals);
  const dark = block(/\.dark\s*\{([\s\S]*?)\n\}/, globals);
  assert.ok(light.length > 0);
  assert.ok(dark.length > 0);
  for (const token of requiredThemeTokens) {
    assert.match(light, new RegExp(`${token}:`));
    assert.match(dark, new RegExp(`${token}:`));
  }
});

test('density and typography contracts are present', () => {
  assert.match(globals, /--density-control-height:/);
  assert.match(globals, /--density-row-height:/);
  assert.match(globals, /--density-workspace-gap:/);
  assert.match(globals, /html\[data-density=['"]compact['"]\]/);
  assert.match(globals, /html\[data-density=['"]comfortable['"]\]/);
  assert.match(globals, /--font-mono:\s*var\(--font-ibm-plex-mono\)/);
  assert.match(globals, /html\s*\{[\s\S]*?color-scheme:\s*light/);
  assert.match(globals, /html\.dark\s*\{[\s\S]*?color-scheme:\s*dark/);
});

test('layout bootstraps appearance without a forced dark server class', () => {
  assert.match(layout, /IBM_Plex_Mono/);
  assert.match(layout, /--font-ibm-plex-mono/);
  assert.match(layout, /CAREZ_APPEARANCE_BOOT_SCRIPT/);
  assert.match(layout, /CarezAppearanceProvider/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.doesNotMatch(layout, /GeistMono/);
  assert.doesNotMatch(layout, /className=\{[^\n]*\bdark\b/);
});
