import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css=readFileSync('app/globals.css','utf8');
const root=css.match(/:root\s*\{([\s\S]*?)\n\}/)![1];
const dark=css.match(/\.dark\s*\{([\s\S]*?)\n\}/)![1];
function token(source:string,name:string){const value=source.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();assert.ok(value,`${name} must exist`);return value;}
function hex(source:string,name:string){const value=token(source,name);assert.match(value,/^#[0-9a-f]{6}$/i);return value;}
function luminance(value:string){return value.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

test('PourTrace palettes retain the supplied anchors and light/dark roles',()=>{
  assert.equal(hex(root,'pt-logo'),'#009966');
  assert.equal(hex(root,'pt-brand'),'#007A52');
  assert.equal(hex(root,'pt-brand-hover'),'#00AD73');
  assert.equal(hex(root,'pt-bg'),'#F5F7F6');
  assert.equal(hex(dark,'pt-bg'),'#121212');
  assert.equal(hex(root,'pt-surface-1'),'#FFFFFF');
  assert.equal(hex(dark,'pt-surface-1'),'#1E2123');
  assert.equal(hex(root,'pt-line'),'#D4DBD7');
  assert.equal(hex(dark,'pt-line'),'#343A3F');
  assert.equal(hex(root,'pt-link'),'#007A52');
  assert.equal(hex(dark,'pt-link'),'#6F9FC6');
});

test('primary controls, ordinary text, and status pairs meet normal text contrast',()=>{
  const pairs:[string,string][]=[
    ['#FFFFFF',hex(root,'pt-brand')],
    [hex(root,'pt-text'),hex(root,'pt-surface-1')],
    [hex(root,'pt-text-secondary'),hex(root,'pt-surface-1')],
    [hex(dark,'pt-text'),hex(dark,'pt-bg')],
    [hex(dark,'pt-text-secondary'),hex(dark,'pt-surface-1')],
    ...(['success','warning','error','info'] as const).map(status=>[hex(root,`status-${status}-fg`),hex(root,`status-${status}-bg`)] as [string,string]),
  ];
  for(const [foreground,background] of pairs)assert.ok(contrast(foreground,background)>=4.5,`${foreground} on ${background} is below 4.5:1`);
});

test('focus and selection have distinct theme roles',()=>{
  assert.equal(token(root,'ring'),'var(--pt-brand)');
  assert.equal(token(dark,'ring'),'var(--pt-logo)');
  assert.equal(token(root,'pt-brand-muted'),'rgba(0,153,102,.10)');
  assert.match(css,/\.carez-domain-row\[data-active="true"\]\s*\{[^}]*var\(--pt-brand-muted\)/);
  assert.doesNotMatch(root,/--steam-/);
});
