import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css=readFileSync('app/globals.css','utf8');
const root=css.match(/:root\s*\{([\s\S]*?)\n\}/)![1];
function token(name:string){const value=root.match(new RegExp(`--${name}: (#[0-9a-f]{6});`,'i'))?.[1];assert.ok(value,`${name} must resolve to a color`);return value;}
function luminance(hex:string){return hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

test('Steam Light workspace and navigation stay light',()=>{
  for(const name of ['background','card','popover','sidebar','secondary','shell-background','shell-surface']) assert.ok(luminance(token(name))>.7,`${name} must remain a light working surface`);
});
test('normal text and interactive labels meet AA contrast',()=>{
  for(const [text,surface]of [['foreground','background'],['card-foreground','card'],['muted-foreground','background'],['primary-foreground','primary'],['secondary-foreground','secondary'],['accent-foreground','accent'],['sidebar-foreground','sidebar'],['primary','background']])assert.ok(contrast(token(text),token(surface))>=4.5,`${text} on ${surface} is unreadable`);
});
test('focus edges contrast with the working surface',()=>{
  assert.ok(contrast(token('ring'),token('card'))>=3);
});
