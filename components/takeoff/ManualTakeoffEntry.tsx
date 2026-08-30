'use client';

import {useMemo,useState} from 'react';
import {ChevronDown,Ruler} from 'lucide-react';
import {createAssemblyMeasurement} from '@/app/takeoff/actions';
import {enumOptions,isAssemblyVariableActive} from '@/lib/takeoff/assemblyContext';

type Props={
  takeoffSetId:string;
  assemblies:any[];
  versions:any[];
  variables:any[];
  sections:any[];
  riskClasses:any[];
};

export function ManualTakeoffEntry({takeoffSetId,assemblies,versions,variables,sections,riskClasses}:Props){
  const latestByAssembly=useMemo(()=>{const map=new Map<string,any>();for(const version of versions)if(!map.has(version.assembly_id))map.set(version.assembly_id,version);return map;},[versions]);
  const available=useMemo(()=>assemblies.map(a=>({assembly:a,version:latestByAssembly.get(a.id)})).filter(x=>x.version),[assemblies,latestByAssembly]);
  const [assemblyId,setAssemblyId]=useState(available[0]?.assembly.id||'');
  const selected=available.find(x=>x.assembly.id===assemblyId)||available[0];
  const assembly=selected?.assembly;
  const version=selected?.version;
  const assemblyVariables=version?variables.filter(v=>v.assembly_version_id===version.id):[];

  if(!selected)return <div className="empty-state"><div><div className="title">No published concrete assemblies</div><div className="meta">Publish an assembly before entering a manual quantity.</div></div></div>;

  return <form action={createAssemblyMeasurement} className="manual-takeoff-form">
    <input type="hidden" name="takeoff_set_id" value={takeoffSetId}/>
    <input type="hidden" name="assembly_version_id" value={version.id}/>
    <div className="manual-takeoff-primary">
      <label className="field"><span>Concrete assembly</span><div className="select-with-icon"><Ruler size={15}/><select value={assemblyId} onChange={e=>setAssemblyId(e.target.value)}>{available.map(({assembly:a})=><option key={a.id} value={a.id}>{a.name} · {a.primary_measurement}</option>)}</select><ChevronDown size={14}/></div></label>
      <label className="field"><span>Measured quantity</span><div className="quantity-with-unit"><input name="raw_quantity" type="number" min="0" step="0.01" inputMode="decimal" required placeholder="0.00"/><b>{assembly.primary_measurement}</b></div></label>
    </div>
    <div className="manual-takeoff-secondary">
      <label className="field"><span>Location <em>optional</em></span><input name="location" placeholder="Garage · north wall · Area A"/></label>
      <label className="field"><span>Name <em>optional — Carez will name it</em></span><input name="name" placeholder={`${assembly.name} 1`}/></label>
    </div>
    {assemblyVariables.length>0&&<div className="manual-takeoff-variables">{assemblyVariables.filter(v=>isAssemblyVariableActive(v,{})).map(v=><label className="field" key={v.id}><span>{v.label}{v.required?' *':''}{v.unit?` · ${v.unit}`:''}</span>{v.value_type==='boolean'?<input name={`var_${v.variable_key}`} type="checkbox" value="true" defaultChecked={v.default_value===true}/>:v.value_type==='enum'?<select name={`var_${v.variable_key}`} required={Boolean(v.required&&v.default_value===null)} defaultValue={v.default_value===null?'':String(v.default_value)}><option value="">Select…</option>{enumOptions(v.options).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:<input name={`var_${v.variable_key}`} type={['number','dimension','percentage'].includes(v.value_type)?'number':'text'} step="any" min={v.min_value??undefined} max={v.max_value??undefined} required={Boolean(v.required&&v.default_value===null)} defaultValue={v.default_value===null?undefined:String(v.default_value)} placeholder={v.default_value===null?'Required':'Optional'}/>} {v.help_text&&<small>{v.help_text}</small>}</label>)}</div>}
    <details className="manual-takeoff-advanced"><summary>Advanced coding</summary><div className="manual-takeoff-secondary"><label className="field"><span>Estimate scope area</span><select name="estimate_section_id" defaultValue=""><option value="">Automatic / unassigned</option>{sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field"><span>L&I phase</span><select name="risk_class_code" defaultValue={version.default_risk_class_code||''}><option value="">Assembly default</option>{riskClasses.map(r=><option key={`${r.code}-${r.tax_year}`} value={r.code}>{r.code} — {r.name}</option>)}</select></label><label className="field"><span>Source reference</span><input name="drawing_reference" placeholder="Field measure · sketch · S2.1"/></label></div></details>
    <button className="button">Add Manual Takeoff</button>
  </form>;
}
