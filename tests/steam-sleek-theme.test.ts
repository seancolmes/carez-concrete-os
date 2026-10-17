import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css=readFileSync('app/globals.css','utf8');
const root=css.match(/:root\s*\{([\s\S]*?)\n\}/)![1];
function token(source:string,name:string){const value=source.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();assert.ok(value,`${name} must exist`);return value;}
function hex(source:string,name:string,seen=new Set<string>()):string{assert.ok(!seen.has(name),'theme token cycle');seen.add(name);const value=token(source,name);const reference=value.match(/^var\(--([^,)]+)\)$/);if(reference)return hex(source,reference[1],seen);assert.match(value,/^#[0-9a-f]{6}$/i);return value;}
function luminance(value:string){return value.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

test('PourTrace keeps its logo while the light-only workspace uses the approved palette',()=>{
  assert.equal(hex(root,'pt-logo'),'#E97832');
  assert.equal(hex(root,'pt-brand'),'#1A2B55');
  assert.equal(hex(root,'pt-bg'),'#F2F5F9');
  assert.equal(hex(root,'pt-surface-1'),'#FFFFFF');
  assert.equal(hex(root,'pt-surface-2'),'#F2F5F9');
  assert.equal(hex(root,'pt-surface-3'),'#F1F5F9');
  assert.equal(hex(root,'pt-line'),'#E0E6EF');
  assert.equal(hex(root,'pt-text'),'#232F3E');
  assert.equal(hex(root,'pt-text-secondary'),'#37475A');
  assert.equal(hex(root,'pt-text-muted'),'#6B7280');
  assert.match(root,/color-scheme: only light/);
});

test('primary controls, ordinary text, and status pairs meet normal text contrast',()=>{
  const pairs:[string,string][]=[
    ['#FFFFFF',hex(root,'pt-brand')],
    [hex(root,'pt-text'),hex(root,'pt-surface-1')],
    [hex(root,'pt-text-secondary'),hex(root,'pt-surface-1')],
    [hex(root,'pt-text'),hex(root,'pt-bg')],
    ...(['success','warning','error','info'] as const).map(status=>[hex(root,`status-${status}-fg`),hex(root,`status-${status}-bg`)] as [string,string]),
  ];
  for(const [foreground,background] of pairs)assert.ok(contrast(foreground,background)>=4.5,`${foreground} on ${background} is below 4.5:1`);
});

test('focus and selection have distinct theme roles',()=>{
  assert.equal(token(root,'ring'),'var(--pt-brand)');
  assert.equal(token(root,'pt-brand-muted'),'#EEF2F8');
  assert.equal(token(root,'selection-fill'),'#EEF2F8');
  assert.equal(token(root,'selection-border'),'var(--pt-brand)');
  assert.match(css,/\.carez-domain-row\[data-active="true"\]\s*\{[^}]*background:var\(--selection-fill\);[^}]*border-left-color:var\(--selection-border\)/);
  assert.doesNotMatch(root,/--steam-/);
});
