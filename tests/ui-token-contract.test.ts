import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const globals = readFileSync(new URL('app/globals.css', root), 'utf8');
const layout = readFileSync(new URL('app/layout.tsx', root), 'utf8');
const block = (pattern: RegExp, source: string) => source.match(pattern)?.[1] ?? '';
const token = (source:string,name:string):string => {
  const value=source.match(new RegExp(`${name}:\\s*([^;]+);`,'i'))?.[1].trim()??'';
  const alias=value.match(/^var\((--[\w-]+)\)$/)?.[1];
  return alias?token(source,alias):value;
};
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

test('one authoritative light workspace supplies complete semantic roles', () => {
  assert.doesNotMatch(globals, /:root\s*,\s*\.dark/);
  const light = block(/:root\s*\{([\s\S]*?)\n\}/, globals);
  assert.ok(light.length > 0);
  assert.doesNotMatch(globals,/html\[data-theme=['"]light['"]\]\s*\{/);
  for (const token of [...inheritedSemanticTokens,...requiredModeTokens]) assert.match(light,new RegExp(`${token}:`));
  for (const token of ['--pt-bg','--pt-shell','--pt-surface-1','--pt-surface-2','--pt-surface-3','--pt-line','--pt-line-strong','--pt-text','--pt-text-secondary','--pt-success','--pt-warning','--pt-danger','--pt-info','--selection-fill','--metal-top','--status-error-bg']) {
    assert.match(light, new RegExp(`${token}:`));
  }
});

test('light workbench text, status, and control boundaries meet contrast targets', () => {
  const light = block(/:root\s*\{([\s\S]*?)\n\}/, globals);
  const panel=token(light,'--pt-surface-1');
  for(const name of ['--pt-text','--pt-text-secondary','--pt-text-muted']){
    assert.ok(contrast(token(light,name),panel)>=4.5,`${name} must meet normal-text contrast`);
  }
  for(const state of ['success','warning','error','info']){
    assert.ok(contrast(token(light,`--status-${state}-fg`),token(light,`--status-${state}-bg`))>=4.5,`${state} status must meet normal-text contrast`);
  }
  assert.ok(contrast(token(light,'--pt-line-strong'),panel)>=3,'panel controls need a visible border');
  assert.ok(contrast(token(light,'--ring'),panel)>=3,'focus needs a visible outline');
});

test('density and typography contracts are present', () => {
  assert.match(globals, /--density-control-height:/);
  assert.match(globals, /--density-row-height:/);
  assert.match(globals, /--density-workspace-gap:/);
  assert.match(globals, /html\[data-density=['"]compact['"]\]/);
  assert.match(globals, /html\[data-density=['"]comfortable['"]\]/);
  assert.match(globals, /--font-mono:\s*var\(--font-source-code-pro\)/);
  assert.match(globals,/--pourtrace-ui-font:\s*var\(--font-inter\)/);
  assert.match(globals,/:root\s*\{\s*color-scheme:\s*only light/);
  assert.doesNotMatch(globals,/color-scheme:\s*dark|html\.dark\s*\{/);
});

test('layout supplies Inter and light prepaint while preserving the SSR provider', () => {
  assert.match(layout, /Source_Code_Pro/);
  assert.match(layout, /--font-source-code-pro/);
  assert.match(layout, /CAREZ_APPEARANCE_BOOT_SCRIPT/);
  assert.match(layout, /CarezAppearanceProvider/);
  const provider = readFileSync(new URL('components/CarezAppearanceProvider.tsx', root), 'utf8');
  assert.match(provider, /FluentProvider/);
  assert.match(provider, /webLightTheme/);
  assert.match(provider,/SSRProvider/);
  assert.doesNotMatch(provider,/webDarkTheme/);
  assert.match(layout,/Inter/);
  assert.match(layout,/colorScheme:'only light'/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.doesNotMatch(layout, /GeistMono/);
  assert.match(layout, /data-theme="light"/);
  assert.doesNotMatch(layout, /className=\{[^\n]*\bdark\b/);
});

test('the user-pinned reference palette has one CSS owner',()=>{
  const light=block(/:root\s*\{([\s\S]*?)\n\}/,globals);
  for(const [name,value] of Object.entries({'--pt-brand':'#1A2B55','--pt-amber':'#FEBD69','--pt-shell':'#FFFFFF','--pt-bg':'#F2F5F9','--pt-surface-3':'#F1F5F9','--pt-line':'#E0E6EF','--pt-text':'#232F3E','--pt-text-secondary':'#37475A','--pt-text-muted':'#6B7280'}))assert.equal(token(light,name),value);
  const provider=readFileSync(new URL('components/CarezAppearanceProvider.tsx',root),'utf8');
  assert.match(provider,/colorBrandBackground:'var\(--pt-brand\)'/);
  assert.match(provider,/fontFamilyBase:'var\(--pourtrace-ui-font\)'/);
});
