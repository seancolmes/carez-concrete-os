'use client';

import {useId,type ComponentProps,type ReactNode} from 'react';
import {Input as FluentInput,Radio,RadioGroup} from '@fluentui/react-components';
import {combineImperialLength,splitImperialLength,type ImperialCanonicalUnit} from '@/lib/ui/imperialLength';
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
  const hasValue=value!==''&&Number.isFinite(Number(value));
  const parts=hasValue?splitImperialLength(value,canonicalUnit):{feet:0,inches:0};
  const commit=(feet:string|number,inches:string|number)=>{
    if(feet===''&&inches===''){onValueChange('');return;}
    onValueChange(String(combineImperialLength(feet,inches,canonicalUnit)));
  };
  return <div data-inspector-imperial className={editorStyles.imperialFields} aria-invalid={ariaInvalid||undefined}>
    <FluentInput appearance="underline" size="small" type="number" inputMode="decimal" min={0} step={1} value={hasValue?String(parts.feet):''} onChange={event=>commit(event.target.value,hasValue?parts.inches:'')} disabled={disabled} aria-label={`${ariaLabel} feet`} aria-invalid={ariaInvalid||undefined} contentAfter={<span className={editorStyles.imperialUnit}>ft</span>} className={editorStyles.imperialPart}/>
    <FluentInput appearance="underline" size="small" type="number" inputMode="decimal" min={0} step="any" value={hasValue?String(parts.inches):''} onChange={event=>commit(hasValue?parts.feet:'',event.target.value)} disabled={disabled} aria-label={`${ariaLabel} inches`} aria-invalid={ariaInvalid||undefined} contentAfter={<span className={editorStyles.imperialUnit}>in</span>} className={editorStyles.imperialPart}/>
  </div>;
}

export function InspectorBoolean({id,label,description,checked,onCheckedChange,disabled=false,className='',includeLabel='Include',excludeLabel='Exclude'}:{id:string;label:string;description?:string;checked:boolean;onCheckedChange:(checked:boolean)=>void;disabled?:boolean;className?:string;includeLabel?:string;excludeLabel?:string}){
  return <InspectorRow label={label} hint={description} className={className}>
    <RadioGroup id={id} layout="horizontal" aria-label={label} value={checked?'true':'false'} onChange={(_,data)=>onCheckedChange(data.value==='true')} disabled={disabled} className={editorStyles.booleanGroup}>
      <Radio value="true" label={includeLabel}/><Radio value="false" label={excludeLabel}/>
    </RadioGroup>
  </InspectorRow>;
}
