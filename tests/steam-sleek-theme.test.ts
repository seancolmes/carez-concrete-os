import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css=readFileSync('app/globals.css','utf8');
const root=css.match(/:root\s*\{([\s\S]*?)\n\}/)![1];
function token(name:string){const value=root.match(new RegExp(`--${name}: (#[0-9a-f]{6});`,'i'))?.[1];assert.ok(value,`${name} must resolve to a color`);return value;}
function luminance(hex:string){return hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

test('Steam Sleek workspace and navigation stay dark',()=>{
  for(const name of ['background','card','popover','sidebar','secondary','shell-background','shell-surface']) assert.ok(luminance(token(name))<.08,`${name} must remain a dark working surface`);
});
test('normal text and interactive labels meet AA contrast',()=>{
  for(const [text,surface]of [['foreground','background'],['card-foreground','card'],['muted-foreground','background'],['primary-foreground','primary'],['secondary-foreground','secondary'],['accent-foreground','accent'],['sidebar-foreground','sidebar'],['primary','background'],['success','card'],['warning','card'],['destructive','card'],['info','card']])assert.ok(contrast(token(text),token(surface))>=4.5,`${text} on ${surface} is unreadable`);
});
test('focus edges contrast with the working surface',()=>{
  assert.ok(contrast(token('ring'),token('card'))>=3);
});

test('Steam chrome includes layered surfaces and persistent labelled navigation',()=>{
  for(const name of ['sidebar-surface','panel-surface','table-head','table-row','control-surface','control-hover','header-surface','page-gradient']) assert.match(root,new RegExp(`--steam-${name}:`));
  const shell=readFileSync('components/AppShell.tsx','utf8');
  assert.match(shell,/h-8 w-full items-center justify-start/);
  assert.match(shell,/<span className="text-xs font-semibold">\{item.label\}<\/span>/);
  assert.match(css,/inset 2px 0 var\(--steam-cyan\)/);
  assert.doesNotMatch(root,/#(?:f3f7fa|e7eef3|e2eaf0|b8c8d3|c6d3dc)\b/i);
  assert.equal(token('primary'),'#66c0f4');
  assert.equal(token('ring'),'#8ed8ff');
});

test('representative application routes retain the shared Steam shell',()=>{
  for(const route of ['page','leads/page','takeoff/page','takeoff/[setId]/page','estimates/page','estimates/[estimateId]/page','proposals/page','projects/page','projects/[id]/page','production/work-packages/page','change-orders/page','field/page','production/page','billing/page','billing/retainage/page','settings/page']){
    const source=readFileSync(`app/${route}.tsx`,'utf8');
    assert.match(source,/AppShell/,`${route} must retain the shared presentation owner`);
    assert.doesNotMatch(source,/bg-(?:white|slate-50|gray-50)\b/,`${route} must not restore a pale canvas`);
  }
});

test('Steam login and Change Orders keep dark tokens, visible focus, and narrow layouts',()=>{
  for(const color of ['#f3f7fa','#e7eef3','#e2eaf0','#b8c8d3','#c6d3dc']) assert.doesNotMatch(css,new RegExp(color,'i'));
  assert.match(css,/color-scheme:\s*dark/);
  assert.match(css,/:where\(a,button,summary,select\):focus-visible/);
  assert.match(css,/@media\(max-width:680px\)[\s\S]*\.carez-auth-shell/);
  assert.match(css,/@media\(max-width:520px\)[\s\S]*\.carez-co-row-summary/);
  const login=readFileSync('app/login/page.tsx','utf8');
  const changeOrders=readFileSync('app/change-orders/page.tsx','utf8');
  assert.match(login,/LoginForm/);
  assert.match(changeOrders,/className="carez-co-row"/);
  assert.match(changeOrders,/approveChangeOrder|rejectChangeOrder|updateChangeOrder/);
});
