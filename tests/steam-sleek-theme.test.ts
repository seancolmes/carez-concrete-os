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
  assert.equal(hex(root,'trace-green-500'),'#13A95A');
  assert.equal(hex(root,'trace-green-700'),'#08783F');
  assert.equal(hex(root,'concrete-900'),'#2B3033');
  assert.equal(hex(root,'concrete-950'),'#191F21');
  assert.equal(hex(root,'blueprint-700'),'#195570');
  assert.equal(hex(root,'amber-700'),'#805100');
  assert.equal(token(root,'pt-bg'),'var(--concrete-50)');
  assert.equal(token(dark,'pt-bg'),'var(--concrete-950)');
  assert.equal(token(root,'pt-brand'),'var(--trace-green-700)');
  assert.equal(token(dark,'pt-brand'),'var(--trace-green-300)');
  assert.equal(token(root,'pt-link'),'var(--blueprint-700)');
  assert.equal(token(dark,'pt-link'),'var(--blueprint-300)');
});

test('primary controls, ordinary text, and status pairs meet normal text contrast',()=>{
  const pairs:[string,string][]=[
    ['#FFFFFF',hex(root,'trace-green-700')],
    [hex(root,'concrete-950'),hex(root,'trace-green-300')],
    [hex(root,'concrete-900'),'#FFFFFF'],
    [hex(root,'concrete-600'),'#FFFFFF'],
    ...(['success','warning','error','info'] as const).map(status=>[hex(root,`status-${status}-fg`),hex(root,`status-${status}-bg`)] as [string,string]),
  ];
  for(const [foreground,background] of pairs)assert.ok(contrast(foreground,background)>=4.5,`${foreground} on ${background} is below 4.5:1`);
});

test('focus and selection have distinct theme roles',()=>{
  assert.equal(token(root,'ring'),'var(--trace-green-700)');
  assert.equal(token(dark,'ring'),'var(--trace-green-300)');
  assert.equal(token(root,'pt-brand-muted'),'var(--trace-green-50)');
  assert.equal(token(dark,'pt-brand-muted'),'var(--concrete-900)');
  assert.match(css,/\.carez-domain-row\[data-active="true"\]\s*\{[^}]*var\(--pt-brand-muted\)/);
  assert.doesNotMatch(root,/--steam-/);
});
