'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {cn} from '@/lib/utils';

type MetricBentoTileProps={
  title:ReactNode;
  icon:ReactNode;
  value:number|null;
  prefix?:string;
  suffix?:string;
  description:ReactNode;
  tone?:'neutral'|'danger'|'warning'|'success';
};

const tones={
  neutral:'border-[#D4DBD7] bg-[#FFFFFF] text-[#171B19] dark:border-[#343A3F] dark:bg-[#1E2123] dark:text-[#F4F6F5]',
  danger:'border-[#B84558]/50 bg-[#FBECEF] text-[#B84558] dark:border-[#E06B74]/50 dark:bg-[#E06B74]/10 dark:text-[#E06B74]',
  warning:'border-[#8A610B]/50 bg-[#FFF5D9] text-[#8A610B] dark:border-[#D5A94A]/50 dark:bg-[#D5A94A]/10 dark:text-[#D5A94A]',
  success:'border-[#347A46]/50 bg-[#EAF5EC] text-[#347A46] dark:border-[#6DBB77]/50 dark:bg-[#6DBB77]/10 dark:text-[#6DBB77]',
} as const;

export function MetricBentoTile({title,icon,value,prefix='',suffix='',description,tone='neutral'}:MetricBentoTileProps){
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
      setDisplayValue(Math.round(target*(1-(1-progress)**3)));
      if(progress<1)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[value]);

  const formatted=value===null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(displayValue);
  return <div className={cn('min-w-0 rounded-sm border px-3 py-2 shadow-none',tones[tone])}>
    <div className="flex items-start justify-between gap-2">
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div aria-hidden="true" className="shrink-0 [&_svg]:size-4">{icon}</div>
    </div>
    <div className="mt-1 text-3xl font-bold leading-none tabular-nums" aria-label={value===null?'Unavailable':`${prefix}${new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value)}${suffix}`}>
      {value===null?formatted:`${prefix}${formatted}${suffix}`}
    </div>
    <div className="mt-1.5 text-xs leading-4 text-muted-foreground">{description}</div>
  </div>;
}
