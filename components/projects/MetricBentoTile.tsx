'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {cn} from '@/lib/utils';

type MetricBentoTileProps={
  title:ReactNode;
  icon:ReactNode;
  value:number|null;
  prefix?:string;
  suffix?:string;
  precision?:0|1|2;
  description:ReactNode;
  tone?:'neutral'|'danger'|'warning'|'success';
};

const tones={
  neutral:'border-border bg-card text-foreground',
  danger:'border-destructive/40 bg-card text-destructive',
  warning:'border-warning/40 bg-card text-warning',
  success:'border-success/40 bg-card text-success',
} as const;

export function MetricBentoTile({title,icon,value,prefix='',suffix='',precision=0,description,tone='neutral'}:MetricBentoTileProps){
  const [displayValue,setDisplayValue]=useState(0);

  useEffect(()=>{
    if(value===null){setDisplayValue(0);return;}
    const target=Number.isFinite(value)?value:0;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      setDisplayValue(target);
      return;
    }
    let frame=0;
    let start:number|undefined;
    const tick=(time:number)=>{
      start??=time;
      const progress=Math.min((time-start)/1500,1);
      setDisplayValue(target*(1-(1-progress)**3));
      if(progress<1)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[value]);

  const formatter=new Intl.NumberFormat('en-US',{minimumFractionDigits:precision,maximumFractionDigits:precision});
  const formatted=value===null?'—':formatter.format(displayValue);
  return <div className={cn('min-w-0 rounded-lg border p-4 shadow-sm transition-colors hover:border-[var(--border-strong)] motion-reduce:transition-none',tones[tone])}>
    <div className="flex items-start justify-between gap-2">
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div aria-hidden="true" className="shrink-0 [&_svg]:size-4">{icon}</div>
    </div>
    <div className="mt-1 text-3xl font-bold leading-none tabular-nums" aria-label={value===null?'Unavailable':`${prefix}${formatter.format(value)}${suffix}`}>
      {value===null?formatted:`${prefix}${formatted}${suffix}`}
    </div>
    <div className="mt-1.5 text-xs leading-4 text-muted-foreground">{description}</div>
  </div>;
}
