import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';

// Isolated hook harness: executes the real boundary without an app, database, or DOM.
function boundaryHarness(initialDesktop:boolean){
  const require=createRequire(import.meta.url),state:any[]=[],effects:Array<()=>void|(()=>void)>=[];
  let cursor=0,initialized=false,listener:(()=>void)|undefined,removed=false;
  const host={hidden:true,removed:false,remove(){this.removed=true;}};
  const document={createElement:(name:string)=>{assert.equal(name,'div');return host;},body:{appendChild:(node:unknown)=>assert.equal(node,host)}};
  const query={matches:initialDesktop,addEventListener:(event:string,fn:()=>void)=>{assert.equal(event,'change');listener=fn;},removeEventListener:(event:string,fn:()=>void)=>{assert.equal(event,'change');removed=fn===listener;}};
  const hooks={...React,useState:(initial:any)=>{
    const index=cursor++;
    if(!(index in state))state[index]=initial;
    return [state[index],(value:any)=>{state[index]=typeof value==='function'?value(state[index]):value;}];
  },useEffect:(effect:()=>void|(()=>void))=>{if(!initialized)effects.push(effect);}};
  const module={exports:{} as any};
  const source=ts.transpileModule(readFileSync('components/takeoff/TakeoffDesktopBoundary.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
  const localRequire=(name:string)=>name==='react'?hooks:name==='next/link'?{default:({children,...props}:any)=>React.createElement('a',props,children)}:require(name);
  new Script(`(function(require,module,exports){${source}\n})`).runInNewContext({document,window:{matchMedia:(value:string)=>{assert.equal(value,'(min-width: 1024px)');return query;}}})(localRequire,module,module.exports);
  let childRenders=0;
  function Workstation(){childRenders++;return React.createElement('input',{defaultValue:'Unsaved desktop input'});}
  const child=React.createElement(Workstation);
  const render=()=>{cursor=0;const tree=module.exports.TakeoffDesktopBoundary({children:child,returnHref:'/opportunities?estimate=revision-1',returnLabel:'Return to estimate'});initialized=true;return tree as React.ReactElement<any>;};
  return {render,child,host,get childRenders(){return childRenders;},mount(){return effects.map(effect=>effect());},resize(desktop:boolean){query.matches=desktop;listener?.();},get removed(){return removed;}};
}

test('a narrow Takeoff load never mounts child tools and provides a context return',()=>{
  const harness=boundaryHarness(false);
  assert.match(renderToStaticMarkup(harness.render()),/Loading Takeoff/);
  harness.mount();
  const html=renderToStaticMarkup(harness.render());
  assert.match(html,/Takeoff requires a desktop/);
  assert.match(html,/href="\/opportunities\?estimate=revision-1"/);
  assert.doesNotMatch(html,/<input/);
  assert.equal(harness.childRenders,0);
  assert.equal(harness.host.hidden,true);
});

test('a previously opened desktop retains the same child tree while narrow and restores it',()=>{
  const harness=boundaryHarness(true);
  harness.render();
  const cleanup=harness.mount();
  const desktopProvider=harness.render().props.children[1];
  const desktop=desktopProvider.props.children;
  assert.equal(desktopProvider.props.value,harness.host);
  assert.equal(harness.host.hidden,false);
  assert.equal(desktop.props.children,harness.child);
  assert.equal(desktop.props.hidden,false);
  harness.resize(false);
  const narrowProvider=harness.render().props.children[1];
  const narrow=narrowProvider.props.children;
  assert.equal(narrowProvider.props.value,desktopProvider.props.value);
  assert.equal(harness.host.hidden,true);
  assert.equal(narrow.type,desktop.type);
  assert.equal(narrow.props.children,desktop.props.children);
  assert.equal(narrow.props.hidden,true);
  harness.resize(true);
  assert.equal(harness.render().props.children[1].props.children.props.hidden,false);
  assert.equal(harness.host.hidden,false);
  cleanup.forEach(dispose=>dispose?.());
  assert.equal(harness.removed,true);
  assert.equal(harness.host.removed,true);
});

test('both Takeoff entries gate upload, automatic sheet naming, and the workstation together',()=>{
  for(const path of ['app/takeoff/[setId]/page.tsx','components/opportunities/views/TakeoffView.tsx']){
    const source=readFileSync(path,'utf8');
    const opening=source.indexOf('<TakeoffDesktopBoundary '),closing=source.indexOf('</TakeoffDesktopBoundary>');
    assert.ok(opening>=0&&closing>opening,path);
    for(const control of ['<TakeoffPlanUpload ','<TakeoffSheetAutoNaming ','<TakeoffConditionWorkflowShell ']){
      const index=source.indexOf(control);
      assert.ok(index>opening&&index<closing,`${path}: ${control} must remain inside the desktop boundary`);
    }
  }
  assert.match(readFileSync('components/takeoff/TakeoffConditionWorkflowShell.tsx','utf8'),/mobileReview=\{false\}/);
  assert.match(readFileSync('app/takeoff/[setId]/error.tsx','utf8'),/<TakeoffDesktopBoundary/);
});
