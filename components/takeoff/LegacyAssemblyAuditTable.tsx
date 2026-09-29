'use client';

import {useState} from 'react';

export type LegacyAssemblyAuditRow={
  id:string;
  code:string;
  name:string;
  description:string|null;
  category:string;
  measurement:string;
  versions:{id:string;number:number;source:string;reference:string|null;inputs:{label:string;key:string;unit:string}[];outputs:{label:string;key:string;unit:string;type:string;behavior:string}[]}[];
};

export function LegacyAssemblyAuditTable({rows}:{rows:LegacyAssemblyAuditRow[]}){
  const [expanded,setExpanded]=useState<string|null>(null);

  return <div className="overflow-x-auto bg-[#181A1B]">
    <table className="w-full text-[11px] border-collapse table-fixed text-left">
      <thead><tr className="h-8 border-b border-[#25292C] text-[#8B949E]"><th scope="col" className="w-1/3 px-2 font-medium">ID &amp; Name</th><th scope="col" className="w-1/5 px-2 font-medium">Condition Type</th><th scope="col" className="w-1/5 px-2 font-medium">Versions</th><th scope="col" className="px-2 text-right font-medium">Outputs</th></tr></thead>
      {rows.length===0?<tbody><tr className="h-8 border-b border-[#25292C]"><td colSpan={4} className="px-2 text-[#8B949E]">No published legacy assembly records are available.</td></tr></tbody>:rows.map(row=>{
        const open=expanded===row.id;
        const latest=row.versions[0];
        return <tbody key={row.id}>
          <tr className="h-8 border-b border-[#25292C] hover:bg-[#202427]">
            <td className="w-1/3 max-w-0 truncate px-2 font-mono text-[#E1E7E3]" title={`${row.id} · ${row.code} · ${row.name}${row.description?` · ${row.description}`:''}`}><button type="button" aria-expanded={open} aria-label={`${open?'Collapse':'Inspect'} ${row.name}`} onClick={()=>setExpanded(open?null:row.id)} className="block w-full truncate text-left outline-none focus-visible:ring-1 focus-visible:ring-[#8B949E]"><span className="mr-2 text-[#8B949E]">{open?'▾':'▸'} {row.id.slice(0,8)} · {row.code}</span>{row.name}</button></td>
            <td className="truncate px-2 text-[#8B949E]" title={`${row.category} · ${row.measurement}`}>{row.category} · {row.measurement}</td>
            <td className="truncate px-2 font-mono text-[#525B62]" title={latest?.id||''}>{row.versions.length} published · latest v{latest?.number??'—'}</td>
            <td className="truncate px-2 text-right font-mono text-[#8B949E]" title={latest?.outputs.map(output=>output.label).join(' · ')||'No outputs'}>{latest?.outputs.map(output=>output.label).join(' · ')||'—'}</td>
          </tr>
          {open&&<tr className="border-b border-[#25292C] bg-[#202427]"><td colSpan={4} className="px-2 py-1"><div className="grid gap-1">{row.versions.map(version=><div key={version.id} className="grid gap-1 border-b border-[#25292C] py-1 last:border-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"><div className="min-w-0 font-mono text-[#8B949E]"><div className="truncate text-[#E1E7E3]" title={version.id}>v{version.number} · {version.id}</div><div className="truncate" title={version.reference||undefined}>{version.source}{version.reference?` · ${version.reference}`:''}</div></div><div className="min-w-0 text-[#8B949E]"><span className="text-[#525B62]">Inputs ({version.inputs.length})</span>{version.inputs.map(input=><div key={input.key} className="truncate" title={`${input.key} · ${input.unit}`}>{input.label} <span className="font-mono text-[#525B62]">{input.key} · {input.unit}</span></div>)}</div><div className="min-w-0 text-[#8B949E]"><span className="text-[#525B62]">Outputs ({version.outputs.length})</span>{version.outputs.map(output=><div key={output.key} className="truncate" title={`${output.key} · ${output.unit} · ${output.type} · ${output.behavior}`}>{output.label} <span className="font-mono text-[#525B62]">{output.key} · {output.unit} · {output.type}</span></div>)}</div></div>)}</div></td></tr>}
        </tbody>;
      })}
    </table>
  </div>;
}
