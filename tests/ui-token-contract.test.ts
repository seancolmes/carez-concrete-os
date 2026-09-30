import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const globals = readFileSync(new URL('app/globals.css', root), 'utf8');
const layout = readFileSync(new URL('app/layout.tsx', root), 'utf8');
const block = (pattern: RegExp, source: string) => source.match(pattern)?.[1] ?? '';
const token = (source:string,name:string) => source.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6});`,'i'))?.[1] ?? '';
const luminance = (hex:string) => hex.slice(1).match(/../g)!.map(part=>parseInt(part,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
const contrast = (left:string,right:string) => {const a=luminance(left),b=luminance(right);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};

const inheritedSemanticTokens = [
  '--surface-canvas', '--surface-panel', '--surface-raised',
  '--text-primary', '--text-secondary', '--text-muted',
  '--border-default', '--border-strong',
  '--interaction-primary', '--interaction-selection', '--interaction-focus',
  '--status-success', '--status-warning', '--status-error', '--status-info',
];

const requiredModeTokens = [
  '--background', '--foreground', '--card', '--card-foreground',
  '--popover', '--popover-foreground', '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
  '--accent', '--accent-foreground', '--destructive', '--destructive-foreground',
  '--success', '--success-foreground', '--warning', '--warning-foreground',
  '--info', '--info-foreground', '--border', '--input', '--ring',
];

test('charcoal fallback and light workspace share complete semantic roles', () => {
  assert.doesNotMatch(globals, /:root\s*,\s*\.dark/);
  const dark = block(/:root\s*\{([\s\S]*?)\n\}/, globals);
  const light = block(/html\[data-theme=['"]light['"]\]\s*\{([\s\S]*?)\n\}/, globals);
  assert.ok(dark.length > 0);
  assert.ok(light.length > 0);
  for (const token of inheritedSemanticTokens) assert.match(dark, new RegExp(`${token}:`));
  for (const token of requiredModeTokens) {
    assert.match(dark, new RegExp(`${token}:`));
  }
  for (const token of ['--pt-bg','--pt-shell','--pt-surface-1','--pt-surface-2','--pt-surface-3','--pt-line','--pt-line-strong','--pt-text','--pt-text-secondary','--pt-success','--pt-warning','--pt-danger','--pt-info','--selection-fill','--metal-top','--status-error-bg']) {
    assert.match(light, new RegExp(`${token}:`));
  }
});

test('light workbench text, status, and control boundaries meet contrast targets', () => {
  const light = block(/html\[data-theme=['"]light['"]\]\s*\{([\s\S]*?)\n\}/, globals);
  const panel=token(light,'--pt-surface-1');
  for(const name of ['--pt-text','--pt-text-secondary','--pt-text-muted']){
    assert.ok(contrast(token(light,name),panel)>=4.5,`${name} must meet normal-text contrast`);
  }
  for(const state of ['success','warning','error','info']){
    assert.ok(contrast(token(light,`--status-${state}-fg`),token(light,`--status-${state}-bg`))>=4.5,`${state} status must meet normal-text contrast`);
  }
  assert.ok(contrast(token(light,'--pt-line-strong'),panel)>=3,'panel controls need a visible border');
  assert.ok(contrast(token(light,'--pt-brand'),panel)>=3,'focus needs a visible outline');
});

test('density and typography contracts are present', () => {
  assert.match(globals, /--density-control-height:/);
  assert.match(globals, /--density-row-height:/);
  assert.match(globals, /--density-workspace-gap:/);
  assert.match(globals, /html\[data-density=['"]compact['"]\]/);
  assert.match(globals, /html\[data-density=['"]comfortable['"]\]/);
  assert.match(globals, /--font-mono:\s*var\(--font-source-code-pro\)/);
  assert.match(globals, /:root\s*\{[\s\S]*?color-scheme:\s*dark/);
  assert.match(globals, /html\.dark\s*\{[\s\S]*?color-scheme:\s*dark/);
  assert.match(globals, /html\[data-theme=['"]light['"]\]\s*\{[\s\S]*?color-scheme:\s*light/);
});

test('layout bootstraps the saved workspace theme before hydration', () => {
  assert.match(layout, /Source_Code_Pro/);
  assert.match(layout, /--font-source-code-pro/);
  assert.match(layout, /CAREZ_APPEARANCE_BOOT_SCRIPT/);
  assert.match(layout, /CarezAppearanceProvider/);
  const provider = readFileSync(new URL('components/CarezAppearanceProvider.tsx', root), 'utf8');
  assert.match(provider, /FluentProvider/);
  assert.match(provider, /webLightTheme/);
  assert.match(provider, /webDarkTheme/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.doesNotMatch(layout, /GeistMono/);
  assert.match(layout, /data-theme="light"/);
  assert.doesNotMatch(layout, /className=\{[^\n]*\bdark\b/);
});
