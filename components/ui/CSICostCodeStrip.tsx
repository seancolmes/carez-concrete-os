'use client';

import {useEffect,useState} from 'react';
import {Progress} from '@/components/ui/progress';
import {cn} from '@/lib/utils';

export type CSICostCodeStripProps={
  code:string;
  name:string;
  estimated:number;
  actual:number;
  unit:string;
  budget:number;
  spent:number;
  animateOnMount?:boolean;
};

export function CSICostCodeStrip({code,name,estimated,actual,unit,budget,spent,animateOnMount=false}:CSICostCodeStripProps){
  const progress=estimated>0?Math.min(100,Math.max(0,actual/estimated*100)):0;
  const variance=budget-spent;
  const [displayProgress,setDisplayProgress]=useState(animateOnMount?0:progress);
  useEffect(()=>{
    if(!animateOnMount||window.matchMedia('(prefers-reduced-motion: reduce)').matches){setDisplayProgress(progress);return;}
    let nextFrame=0;
    const firstFrame=requestAnimationFrame(()=>{nextFrame=requestAnimationFrame(()=>setDisplayProgress(progress));});
    return()=>{cancelAnimationFrame(firstFrame);cancelAnimationFrame(nextFrame);};
  },[animateOnMount,progress]);
  return <div className="flex h-10 min-w-0 items-center gap-3 border-b border-[#D4DBD7] text-xs dark:border-[#343A3F]">
    <span className="shrink-0 border border-[#D4DBD7] px-1.5 py-0.5 font-mono text-[10px] text-[#525C57] dark:border-[#343A3F] dark:text-[#B6BEBA]">[{code}]</span>
    <span className="min-w-0 flex-1 truncate font-medium text-[#171B19] dark:text-[#F4F6F5]">{name}</span>
    <div className="w-24 shrink-0 sm:w-28"><Progress aria-label={`${name}: ${actual} of ${estimated} ${unit}`} value={displayProgress} className={animateOnMount?'[&_[data-slot=progress-indicator]]:duration-700 motion-reduce:[&_[data-slot=progress-indicator]]:duration-0':undefined}/><span className="font-mono text-[10px] text-[#7B8580] dark:text-[#7C8580]">{actual} / {estimated} {unit}</span></div>
    <span className={cn('shrink-0 rounded-sm px-2 py-0.5 font-mono text-xs tabular-nums',variance>=0?'bg-[#EAF5EC] text-[#347A46] dark:bg-[#009966]/10 dark:text-[#6DBB77]':'bg-[#FBECEF] text-[#B84558] dark:bg-[#E06B74]/10 dark:text-[#E06B74]')}>{variance>=0?'+':'−'}${Math.abs(variance).toLocaleString('en-US')}</span>
  </div>;
}
