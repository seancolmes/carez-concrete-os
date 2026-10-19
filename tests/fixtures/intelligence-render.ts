import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {Script} from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as fluent from '@fluentui/react-components';
import ts from 'typescript';
import * as readState from '../../components/opportunities/views/intelligence-read-state.ts';

// Render the actual view locally. Server boundaries are inert: a fixture cannot read or write QA.
const require = createRequire(import.meta.url);
function loadTsx(path: string, suffix = ''): any {
  const filename = resolve(path);
  const source = ts.transpileModule(readFileSync(filename, 'utf8') + suffix, {
    compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS},
  }).outputText;
  const module = {exports: {}};
  const denied = () => {throw new Error('Server action/query invoked by local fixture');};
  const localRequire = (name: string) => {
    if (name.endsWith('.module.css')) return {default: {workspace: 'intelligence-fixture'}};
    if (name === './intelligence-read-state') return readState;
    if (name === './PendingActionButton') return loadTsx('components/opportunities/views/PendingActionButton.tsx');
    if (name === 'next/link') return {default: ({children, ...props}: any) => React.createElement('a', props, children)};
    if (name === 'next/navigation') return {redirect: denied};
    if (name === '@/components/financials/ProcurementForm') return {ProcurementForm: ({children,action,...props}:any) => React.createElement('form', {...props,'data-local-inert':true}, children)};
    if (name.startsWith('@/lib/')) return new Proxy({}, {get: () => denied});
    if (name.startsWith('@/app/')) return new Proxy({}, {get: () => denied});
    return require(name);
  };
  new Script(`(function(require,module,exports){${source}\n})`, {filename})
    .runInThisContext()(localRequire, module, module.exports);
  return module.exports;
}
const {BidIntelligenceContent} = loadTsx('components/opportunities/views/BidIntelligenceView.tsx');
const {ActivityContent} = loadTsx('components/opportunities/views/ActivityView.tsx');
const themes = loadTsx('components/CarezAppearanceProvider.tsx', '\nexport {pourTraceTheme};');

export function renderIntelligence(reads: readState.IntelligenceReads) {
  return renderContent(React.createElement(BidIntelligenceContent, {reads}));
}

export function renderActivity(lead: {id:string;status:string|null;follow_up:string|null}, activities: Array<{id:string;activity_type:string;note:string;activity_date:string;created_at:string}>) {
  return renderContent(React.createElement(ActivityContent, {lead,activities}));
}

function renderContent(content: React.ReactNode) {
  const renderer = fluent.createDOMRenderer();
  const html = renderToStaticMarkup(React.createElement(fluent.RendererProvider, {renderer,
    children: React.createElement(fluent.FluentProvider, {theme: themes.pourTraceTheme},
      content)}));
  const styles = renderToStaticMarkup(React.createElement(React.Fragment, null, ...fluent.renderToStyleElements(renderer)));
  return {html, styles};
}
