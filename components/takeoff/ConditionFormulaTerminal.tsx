'use client';

import {Accordion,AccordionHeader,AccordionItem,AccordionPanel} from '@fluentui/react-components';
import type {ConditionOutputTrace} from '@/lib/takeoff/conditions/types';

type TraceOutput = {
  output_key: string;
  label: string;
  calculation_trace?: ConditionOutputTrace | null;
};

/** A read-only rendering of engine evidence; never evaluates or edits formulas. */
export function ConditionFormulaTerminal({outputs, pending=false}: {outputs: TraceOutput[]; pending?: boolean}) {
  const traces=outputs.filter(output=>output.calculation_trace);
  return <section aria-label="Calculation traces" className="bg-[#0A0A0C] border border-[#1C1F23] rounded-[4px] p-3 mt-4 font-mono text-[10px] leading-[1.4] tabular-nums overflow-x-auto">
    <h3 className="mb-1 text-[10px] uppercase tracking-widest text-[#A1A1AA]">{pending?'Draft calculation preview':'Saved calculation traces'}</h3>
    {!traces.length?<p className="text-[#A1A1AA]">No calculation trace available. Link a measured takeoff to calculate.</p>:<Accordion collapsible defaultOpenItems={['concrete.installed_cy']}>{traces.map(output=>{
      const trace=output.calculation_trace!;
      const tokens=String(trace.algorithm||'').split(/([+\-*/=()]|\b\d+(?:\.\d+)?\b|[a-zA-Z_][a-zA-Z_0-9.]*)/g);
      return <AccordionItem value={output.output_key} key={output.output_key} className="border-t border-[#1C1F23] py-1 first-of-type:border-0">
        <AccordionHeader>{output.label}</AccordionHeader><AccordionPanel>
        <code className="mt-1 block whitespace-pre-wrap break-words text-[#A1A1AA]">{tokens.map((token,index)=>
          /^[+\-*/=()]$/.test(token)?<span key={index} className="text-[#8B949E]">{token}</span>:
          /^\d+(?:\.\d+)?$/.test(token)?<span key={index} className="text-[#E97832]">{token}</span>:
          /^[a-zA-Z_][a-zA-Z_0-9.]*$/.test(token)?<span key={index} className="bg-[#141618] border border-[#25292C] text-[#6CB6FF] px-1 rounded-[2px]">{token}</span>:token
        )}</code>
        <dl className="mt-1 space-y-0.5">{(trace.values||[]).map((value,index)=><div key={`${value.key}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <dt className="break-words text-[#6CB6FF]" title={value.sourceLabel}>{value.key}</dt><dd className="text-[#E97832]">{String(value.value)}</dd>
        </div>)}</dl>
        <p className="mt-1 text-white">Derived quantity <span className="text-[#8B949E]">=</span> <span className="text-[#E97832]">{trace.derivedQuantity===null?'Held':trace.derivedQuantity}</span></p>
        {trace.override?<p className="mt-2 text-[#A1A1AA]">Explicit override: {trace.override.quantity} · {trace.override.reason}</p>:null}
        </AccordionPanel></AccordionItem>;
    })}</Accordion>}
  </section>;
}
