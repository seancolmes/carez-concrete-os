'use client';

import {useEffect,useId,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import {Button,Input as FluentInput,Radio,RadioGroup} from '@fluentui/react-components';
import {DismissRegular} from '@fluentui/react-icons';
import {imperialEntryValue,splitImperialLength,type ImperialCanonicalUnit} from '@/lib/ui/imperialLength';
import editorStyles from './ConditionEditorFields.module.css';

export const inspectorInputClass=editorStyles.fluentInput;
export const inspectorSelectClass='flex h-7 w-full items-center justify-between border-0 border-b border-[var(--pt-line)] bg-transparent px-2 text-[11px] text-[var(--pt-text)] outline-none focus-visible:border-[var(--pt-brand)]';

export function InspectorRow({label,htmlFor,children,hint,error,className=''}:{label:string;htmlFor?:string;children:ReactNode;hint?:string;error?:string;className?:string}){
  const labelId=useId();
  return <div className={className} data-inspector-row>
    <div className="flex w-full min-h-[31px] items-center justify-between border-b border-[var(--pt-line-soft)] py-[2px]" role="group" aria-labelledby={labelId}>
      <div className="flex w-[42%] flex-none items-center pr-3"><label id={labelId} htmlFor={htmlFor} title={hint?`${label} · ${hint}`:label} className="truncate select-none text-[11px] font-medium text-[var(--pt-text-secondary)]">{label}</label></div>
      <div className="flex w-[58%] min-w-0 flex-1 items-center justify-end">{children}</div>
    </div>
    {error?<p role="alert" className="ml-[42%] pb-1 text-[10px] text-[var(--pt-danger)]">{error}</p>:null}
  </div>;
}

export function InspectorInput({className='',...props}:ComponentProps<typeof FluentInput>){
  return <FluentInput {...props} appearance="underline" size="small" className={`${inspectorInputClass} ${className}`}/>;
}

export function InspectorNumberInput({unit,className='',...props}:Omit<ComponentProps<typeof FluentInput>,'type'>&{unit?:string}){
  return <div className="relative w-full min-w-0">
    <InspectorInput {...props} type="number" inputMode="decimal" className={`${editorStyles.numericInput} ${className}`}/>
    {unit?<span data-inspector-unit className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[var(--pt-text-muted)]">{unit}</span>:null}
  </div>;
}

/** Uses the same canonical conversion as the existing Carez dimension fields. */
export function InspectorImperialInput({value,canonicalUnit,onValueChange,disabled=false,ariaLabel,ariaInvalid=false}:{value:string|number;canonicalUnit:ImperialCanonicalUnit;onValueChange:(value:string)=>void;disabled?:boolean;ariaLabel:string;ariaInvalid?:boolean}){
  const displayParts=()=>{
    if(value===''||!Number.isFinite(Number(value)))return {feet:'',inches:''};
    const parts=splitImperialLength(value,canonicalUnit);return {feet:String(parts.feet),inches:String(parts.inches)};
  };
  const [parts,setParts]=useState(displayParts);const editing=useRef(false);
  useEffect(()=>{if(!editing.current)setParts(displayParts());},[value,canonicalUnit]);
  const change=(part:'feet'|'inches',text:string)=>{
    const next={...parts,[part]:text};setParts(next);onValueChange(imperialEntryValue(next.feet,next.inches,canonicalUnit,part));
  };
  return <div data-inspector-imperial className={editorStyles.imperialFields} aria-invalid={ariaInvalid||undefined}
    onFocusCapture={()=>{editing.current=true;}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget)){editing.current=false;setParts(displayParts());}}}>
    <FluentInput appearance="underline" size="small" type="number" inputMode="decimal" min={0} step={1} value={parts.feet} onChange={event=>change('feet',event.target.value)} disabled={disabled} aria-label={`${ariaLabel} feet`} aria-invalid={ariaInvalid||undefined} contentAfter={<span className={editorStyles.imperialUnit}>ft</span>} className={editorStyles.imperialPart}/>
    <FluentInput appearance="underline" size="small" type="number" inputMode="decimal" min={0} step="any" value={parts.inches} onChange={event=>change('inches',event.target.value)} disabled={disabled} aria-label={`${ariaLabel} inches`} aria-invalid={ariaInvalid||undefined} contentAfter={<span className={editorStyles.imperialUnit}>in</span>} className={editorStyles.imperialPart}/>
    {parts.feet!==''||parts.inches!==''?<Button type="button" appearance="subtle" size="small" icon={<DismissRegular/>} aria-label={`Clear ${ariaLabel}`} title={`Clear ${ariaLabel}`} disabled={disabled} onClick={()=>{setParts({feet:'',inches:''});onValueChange('');}} style={{minWidth:28,width:28,padding:0}}/>:null}
  </div>;
}

export function InspectorBoolean({id,label,description,checked,onCheckedChange,disabled=false,className='',includeLabel='Include',excludeLabel='Exclude'}:{id:string;label:string;description?:string;checked:boolean;onCheckedChange:(checked:boolean)=>void;disabled?:boolean;className?:string;includeLabel?:string;excludeLabel?:string}){
  return <InspectorRow label={label} hint={description} className={className}>
    <RadioGroup id={id} layout="horizontal" aria-label={label} value={checked?'true':'false'} onChange={(_,data)=>onCheckedChange(data.value==='true')} disabled={disabled} className={editorStyles.booleanGroup}>
      <Radio value="true" label={includeLabel}/><Radio value="false" label={excludeLabel}/>
    </RadioGroup>
  </InspectorRow>;
}
