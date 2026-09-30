import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css=readFileSync('app/globals.css','utf8');
const root=css.match(/:root\s*\{([\s\S]*?)\n\}/)![1];
function token(source:string,name:string){const value=source.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();assert.ok(value,`${name} must exist`);return value;}
function hex(source:string,name:string){const value=token(source,name);assert.match(value,/^#[0-9a-f]{6}$/i);return value;}
function luminance(value:string){return value.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

test('PourTrace keeps its logo while the Fluent dark workspace uses the approved palette',()=>{
  assert.equal(hex(root,'pt-logo'),'#009966');
  assert.equal(hex(root,'pt-brand'),'#5EA27A');
  assert.equal(hex(root,'pt-bg'),'#121212');
  assert.equal(hex(root,'pt-surface-1'),'#181A19');
  assert.equal(hex(root,'pt-surface-2'),'#202321');
  assert.equal(hex(root,'pt-line'),'#2B302D');
  assert.equal(hex(root,'pt-text'),'#F2F4F3');
  assert.equal(hex(root,'pt-text-secondary'),'#B3BBB6');
  assert.equal(hex(root,'pt-text-muted'),'#7F8A84');
  assert.equal(hex(root,'pt-info'),'#6C9FD8');
  assert.equal(hex(root,'pt-warning'),'#E0A84B');
  assert.equal(hex(root,'pt-danger'),'#D96A6A');
  assert.match(root,/color-scheme: dark/);
});

test('primary controls, ordinary text, and status pairs meet normal text contrast',()=>{
  const pairs:[string,string][]=[
    [hex(root,'pt-brand'),hex(root,'pt-surface-1')],
    [hex(root,'pt-text'),hex(root,'pt-surface-1')],
    [hex(root,'pt-text-secondary'),hex(root,'pt-surface-1')],
    [hex(root,'pt-text'),hex(root,'pt-bg')],
    ...(['success','warning','error','info'] as const).map(status=>[hex(root,`status-${status}-fg`),hex(root,`status-${status}-bg`)] as [string,string]),
  ];
  for(const [foreground,background] of pairs)assert.ok(contrast(foreground,background)>=4.5,`${foreground} on ${background} is below 4.5:1`);
});

test('focus and selection have distinct theme roles',()=>{
  assert.equal(hex(root,'ring'),'#5EA27A');
  assert.equal(token(root,'pt-brand-muted'),'rgb(94 162 122 / .16)');
  assert.equal(token(root,'selection-fill'),'#263B2C');
  assert.equal(token(root,'selection-border'),'#5EA27A');
  assert.match(css,/\.carez-domain-row\[data-active="true"\]\s*\{[^}]*background:var\(--selection-fill\);[^}]*border-left-color:var\(--selection-border\)/);
  assert.doesNotMatch(root,/--steam-/);
});
