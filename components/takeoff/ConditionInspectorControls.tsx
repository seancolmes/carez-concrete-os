'use client';

import {useId,type ComponentProps,type ReactNode} from 'react';
import {combineImperialLength,splitImperialLength,type ImperialCanonicalUnit} from '@/lib/ui/imperialLength';

export const inspectorInputClass='h-6 w-full bg-[#121212] border border-[#25292C] hover:border-[#343A3F] focus:border-[#009966] focus:ring-1 focus:ring-[#009966] text-white text-[11px] px-2 rounded-[3px] transition-colors outline-none shadow-inner disabled:cursor-not-allowed disabled:opacity-60';
export const inspectorSelectClass='h-6 w-full bg-[#121212] border border-[#25292C] hover:border-[#343A3F] data-[state=open]:border-[#009966] data-open:border-[#009966] text-white text-[11px] px-2 rounded-[3px] flex items-center justify-between shadow-inner';

export function InspectorRow({label,htmlFor,children,hint,error,className=''}:{label:string;htmlFor?:string;children:ReactNode;hint?:string;error?:string;className?:string}){
  const labelId=useId();
  return <div className={className} data-inspector-row>
    <div className="flex items-center justify-between w-full min-h-[28px] py-[2px]" role="group" aria-labelledby={labelId}>
      <div className="flex-none w-[35%] pr-4 flex items-center"><label id={labelId} htmlFor={htmlFor} title={hint?`${label} · ${hint}`:label} className="text-[11px] font-medium text-[#8B949E] select-none truncate">{label}</label></div>
      <div className="flex-1 w-[65%] flex items-center justify-end min-w-0">{children}</div>
    </div>
    {error?<p role="alert" className="ml-[35%] pb-1 text-[10px] text-destructive">{error}</p>:null}
  </div>;
}

export function InspectorInput({className='',...props}:ComponentProps<'input'>){
  return <input {...props} className={`${inspectorInputClass} ${className}`}/>;
}

export function InspectorNumberInput({unit,className='',...props}:Omit<ComponentProps<'input'>,'type'>&{unit?:string}){
  return <div className="relative w-full min-w-0">
    <InspectorInput {...props} type="number" inputMode="decimal" className={`font-mono tabular-nums tracking-tight text-right ${unit?'pr-6':''} ${className}`}/>
    {unit?<span data-inspector-unit className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#525B62] pointer-events-none">{unit}</span>:null}
  </div>;
}

/** Uses the same canonical conversion as the existing Carez dimension fields. */
export function InspectorImperialInput({value,canonicalUnit,onValueChange,disabled=false,ariaLabel,ariaInvalid=false}:{value:string|number;canonicalUnit:ImperialCanonicalUnit;onValueChange:(value:string)=>void;disabled?:boolean;ariaLabel:string;ariaInvalid?:boolean}){
  const hasValue=value!==''&&Number.isFinite(Number(value));
  const parts=hasValue?splitImperialLength(value,canonicalUnit):{feet:0,inches:0};
  const commit=(feet:string|number,inches:string|number)=>{
    if(feet===''&&inches===''){onValueChange('');return;}
    onValueChange(String(combineImperialLength(feet,inches,canonicalUnit)));
  };
  const inputClass='flex-1 min-w-0 w-0 bg-transparent border-none text-white text-right text-[11px] px-1 outline-none font-mono tabular-nums disabled:opacity-60';
  return <div data-inspector-imperial className="flex items-center w-full bg-[#121212] border border-[#25292C] hover:border-[#343A3F] focus-within:border-[#009966] focus-within:ring-1 focus-within:ring-[#009966] rounded-[3px] overflow-hidden transition-colors h-6" aria-invalid={ariaInvalid||undefined}>
    <input data-imperial-part type="number" inputMode="decimal" min={0} step={1} value={hasValue?parts.feet:''} onChange={event=>commit(event.target.value,hasValue?parts.inches:'')} disabled={disabled} aria-label={`${ariaLabel} feet`} aria-invalid={ariaInvalid||undefined} className={inputClass}/>
    <span className="text-[9px] text-[#525B62] pr-1.5 select-none">ft</span>
    <span className="w-px h-3 bg-[#343A3F]" aria-hidden="true"/>
    <input data-imperial-part type="number" inputMode="decimal" min={0} step="any" value={hasValue?parts.inches:''} onChange={event=>commit(hasValue?parts.feet:'',event.target.value)} disabled={disabled} aria-label={`${ariaLabel} inches`} aria-invalid={ariaInvalid||undefined} className={inputClass}/>
    <span className="text-[9px] text-[#525B62] pr-1.5 select-none">in</span>
  </div>;
}

export function InspectorBoolean({id,label,description,checked,onCheckedChange,disabled=false,className='',includeLabel='Include',excludeLabel='Exclude'}:{id:string;label:string;description?:string;checked:boolean;onCheckedChange:(checked:boolean)=>void;disabled?:boolean;className?:string;includeLabel?:string;excludeLabel?:string}){
  const choose=(value:boolean,element:HTMLButtonElement)=>{onCheckedChange(value);element.parentElement?.querySelector<HTMLButtonElement>(`[data-value="${value}"]`)?.focus();};
  return <InspectorRow label={label} hint={description} className={className}>
    <div id={id} role="radiogroup" aria-label={label} aria-disabled={disabled||undefined} className="relative flex p-[1px] bg-[#121212] border border-[#25292C] rounded-[4px] h-5 w-[100px] shrink-0 ml-auto">
      <span aria-hidden="true" className={`absolute inset-y-[1px] left-[1px] w-[calc(50%-1px)] rounded-[3px] shadow-sm transition-transform duration-150 motion-reduce:transition-none ${checked?'bg-[#007A52]':'translate-x-full bg-[#25292C]'}`}/>
      {[true,false].map(value=><button key={String(value)} type="button" role="radio" data-value={value} aria-checked={checked===value} tabIndex={checked===value?0:-1} disabled={disabled} onClick={()=>onCheckedChange(value)} onKeyDown={event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
        event.preventDefault();event.stopPropagation();choose(event.key==='Home'?true:event.key==='End'?false:!checked,event.currentTarget);
      }} className={`relative flex-1 flex items-center justify-center text-[9px] uppercase tracking-wider rounded-[3px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009966] disabled:opacity-60 disabled:cursor-not-allowed ${checked===value?'font-semibold text-white':'font-medium text-[#8B949E] hover:text-white'}`}>{value?includeLabel:excludeLabel}</button>)}
    </div>
  </InspectorRow>;
}
