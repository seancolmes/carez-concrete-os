'use client';

import * as React from 'react';
import {FileText,LoaderCircle,UploadCloud,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Progress} from '@/components/ui/progress';
import {Skeleton} from '@/components/ui/skeleton';
import {cn} from '@/lib/utils';
import {resolveNumericKind,type CarezNumericKind} from '@/lib/ui/state';
import {combineImperialLength,splitImperialLength,type ImperialCanonicalUnit} from '@/lib/ui/imperialLength';

type NumberInputProps = Omit<React.ComponentProps<'input'>,'type'> & {
  kind?: CarezNumericKind;
  unit?: string;
  prefix?: string;
  derived?: boolean;
};

export function CarezNumberField(input:NumberInputProps){
  const {className,kind='quantity',unit,prefix,derived=false,readOnly,inputMode,...props}=input;
  const metadata=resolveNumericKind(kind);
  const ariaInvalid=props['aria-invalid'];
  return <div
    data-slot="carez-number-field"
    data-numeric-kind={kind}
    data-state={derived?'derived':readOnly?'read-only':'editable'}
    aria-invalid={ariaInvalid}
    className={cn('flex h-[var(--density-control-height)] min-w-0 items-center rounded-md border border-input bg-background/60 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20',derived&&'bg-muted/50',readOnly&&!derived&&'bg-muted/25',ariaInvalid&&'border-destructive',className)}
  >
    {prefix?<span className="pl-2.5 text-xs text-muted-foreground">{prefix}</span>:null}
    <Input {...props} type="number" inputMode={inputMode??metadata?.inputMode} readOnly={readOnly||derived} aria-invalid={ariaInvalid} className="h-[calc(var(--density-control-height)-2px)] flex-1 border-0 bg-transparent px-2 font-mono tabular-nums shadow-none focus-visible:ring-0"/>
    {unit?<span className="pr-2.5 text-xs font-medium text-muted-foreground">{unit}</span>:null}
  </div>;
}

export function CarezFeetInchesField({value,canonicalUnit,onValueChange,disabled=false,ariaLabel,className}:{
  value:string|number;
  canonicalUnit:ImperialCanonicalUnit;
  onValueChange:(value:string)=>void;
  disabled?:boolean;
  ariaLabel:string;
  className?:string;
}){
  const hasValue=value!==''&&Number.isFinite(Number(value));
  const parts=hasValue?splitImperialLength(value,canonicalUnit):{feet:0,inches:0};
  const commit=(feet:string|number,inches:string|number)=>{
    if(feet===''&&inches===''){onValueChange('');return;}
    onValueChange(String(combineImperialLength(feet===''?0:feet,inches===''?0:inches,canonicalUnit)));
  };
  return <div data-slot="carez-feet-inches-field" className={cn('grid min-w-0 grid-cols-2 gap-2',className)}>
    <CarezNumberField value={hasValue?String(parts.feet):''} onChange={event=>commit(event.target.value,parts.inches)} unit="ft" min={0} step={1} disabled={disabled} aria-label={ariaLabel+' feet'}/>
    <CarezNumberField value={hasValue?String(parts.inches):''} onChange={event=>commit(parts.feet,event.target.value)} unit="in" min={0} step="any" disabled={disabled} aria-label={ariaLabel+' inches'}/>
  </div>;
}

export type CarezDateTimeMode='date'|'time'|'datetime-local';

export function CarezDateTimeField({mode='date',className,...props}:Omit<React.ComponentProps<'input'>,'type'>&{mode?:CarezDateTimeMode}){
  return <Input {...props} type={mode} className={cn('h-8 font-mono tabular-nums [color-scheme:dark]',className)}/>;
}

export function CarezDateTimeRange({startName,endName,startValue,endValue,onStartChange,onEndChange,mode='date',className}:{
  startName?:string;endName?:string;startValue?:string;endValue?:string;
  onStartChange?:(value:string)=>void;onEndChange?:(value:string)=>void;
  mode?:CarezDateTimeMode;className?:string;
}){
  const startProps=onStartChange
    ? {value:startValue,onChange:(event:React.ChangeEvent<HTMLInputElement>)=>onStartChange(event.target.value)}
    : {defaultValue:startValue};
  const endProps=onEndChange
    ? {value:endValue,onChange:(event:React.ChangeEvent<HTMLInputElement>)=>onEndChange(event.target.value)}
    : {defaultValue:endValue};
  return <div className={cn('grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2',className)}>
    <CarezDateTimeField name={startName} mode={mode} {...startProps}/>
    <span className="text-xs text-muted-foreground">to</span>
    <CarezDateTimeField name={endName} mode={mode} {...endProps}/>
  </div>;
}

function formatBytes(bytes:number){
  if(bytes<1024)return bytes+' B';
  if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB';
  return (bytes/(1024*1024)).toFixed(1)+' MB';
}

export function CarezFileUpload({files,onFilesChange,accept,multiple=false,maxBytes,disabled=false,label='Add file',hint,required=false,capture,className}:{
  files:File[];
  onFilesChange:(files:File[])=>void;
  accept?:string;
  multiple?:boolean;
  maxBytes?:number;
  disabled?:boolean;
  label?:string;
  hint?:string;
  required?:boolean;
  capture?:React.InputHTMLAttributes<HTMLInputElement>['capture'];
  className?:string;
}){
  const inputRef=React.useRef<HTMLInputElement|null>(null);
  const [dragging,setDragging]=React.useState(false);
  const [error,setError]=React.useState('');

  const commit=(incoming:File[])=>{
    const next=incoming.filter(file=>!maxBytes||file.size<=maxBytes);
    if(maxBytes&&next.length!==incoming.length)setError('One or more files exceed '+formatBytes(maxBytes)+'.');else setError('');
    onFilesChange(multiple?next:next.slice(0,1));
  };

  const openPicker=()=>{if(!disabled)inputRef.current?.click();};

  return <div className={cn('space-y-2',className)}>
    <input ref={inputRef} type="file" className="sr-only" accept={accept} multiple={multiple} required={required&&!files.length} capture={capture} disabled={disabled} onChange={event=>commit(Array.from(event.target.files||[]))}/>
    <button
      type="button"
      disabled={disabled}
      onClick={openPicker}
      onDragEnter={event=>{event.preventDefault();if(!disabled)setDragging(true)}}
      onDragOver={event=>{event.preventDefault();if(!disabled)setDragging(true)}}
      onDragLeave={event=>{event.preventDefault();if(event.currentTarget===event.target)setDragging(false)}}
      onDrop={event=>{event.preventDefault();setDragging(false);if(!disabled)commit(Array.from(event.dataTransfer.files||[]))}}
      className={cn('flex min-h-24 w-full items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/15 px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50',dragging&&'border-foreground/50 bg-muted/35')}
    >
      <UploadCloud className="size-5 shrink-0 text-muted-foreground"/>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint?<span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>:null}
      </span>
    </button>
    {files.length?<div className="divide-y rounded-md border border-border/80 bg-card/40">
      {files.map((file,index)=><div key={file.name+'-'+file.lastModified+'-'+index} className="flex items-center gap-2 px-3 py-2">
        <FileText className="size-4 shrink-0 text-muted-foreground"/>
        <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{file.name}</div><div className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</div></div>
        <Button type="button" variant="ghost" size="icon-xs" onClick={()=>onFilesChange(files.filter((_,i)=>i!==index))} disabled={disabled} aria-label={'Remove '+file.name}><X/></Button>
      </div>)}
    </div>:null}
    {error?<div role="alert" className="text-xs text-destructive">{error}</div>:null}
  </div>;
}

export function CarezLoadingState({label='Loading',progress,className}:{label?:string;progress?:number|null;className?:string}){
  const determinate=typeof progress==='number'&&Number.isFinite(progress);
  const bounded=determinate?Math.max(0,Math.min(100,progress!)):null;
  return <div className={cn('space-y-2',className)} role="status" aria-live="polite">
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none"/><span>{label}</span>{bounded!=null?<span className="ml-auto font-mono tabular-nums">{bounded}%</span>:null}</div>
    {bounded!=null?<Progress value={bounded}/>:<div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 animate-[carez-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-foreground/65 motion-reduce:animate-none"/></div>}
  </div>;
}

export function CarezLoadingSkeleton({rows=4,className}:{rows?:number;className?:string}){
  return <div className={cn('space-y-2',className)} aria-hidden="true">{Array.from({length:rows}).map((_,index)=><Skeleton key={index} className="h-[var(--density-row-height)] w-full rounded-md"/>)}</div>;
}
