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
  neutral:'border-[#D4DBD7] bg-white text-[#171B19] dark:border-[#343A3F] dark:bg-[#181A1B] dark:text-[#F4F6F5]',
  danger:'border-[#B84558]/40 bg-white text-[#B84558] hover:border-[#B84558]/60 dark:border-[#E06B74]/40 dark:bg-[#181A1B] dark:text-[#E06B74] dark:hover:border-[#E06B74]/60',
  warning:'border-[#8A610B]/40 bg-white text-[#8A610B] hover:border-[#8A610B]/60 dark:border-[#D5A94A]/40 dark:bg-[#181A1B] dark:text-[#D5A94A] dark:hover:border-[#D5A94A]/60',
  success:'border-[#347A46]/40 bg-white text-[#347A46] hover:border-[#347A46]/60 dark:border-[#6DBB77]/40 dark:bg-[#181A1B] dark:text-[#6DBB77] dark:hover:border-[#6DBB77]/60',
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
  return <div className={cn('min-w-0 rounded-xl border p-4 shadow-md transition-colors hover:border-[#B9C3BE] hover:bg-[#F5F7F6] dark:hover:border-[#525B62] dark:hover:bg-[#1C1F23] motion-reduce:transition-none',tones[tone])}>
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
