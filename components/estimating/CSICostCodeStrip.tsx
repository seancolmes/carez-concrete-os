'use client';

import {useEffect,useState} from 'react';
import {ProgressBar} from '@fluentui/react-components';
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
  return <div className="flex h-10 min-w-0 items-center gap-3 border-b border-[#222222] text-xs">
    <span className="shrink-0 border border-[#222222] px-1.5 py-0.5 font-mono text-[10px] text-[#B4B4B4]">[{code}]</span>
    <span className="min-w-0 flex-1 truncate font-medium text-[#EDEDED]">{name}</span>
    <div className="w-24 shrink-0 sm:w-28"><ProgressBar aria-label={`${name}: ${actual} of ${estimated} ${unit}`} value={displayProgress/100} className={animateOnMount?'transition-all duration-700 motion-reduce:duration-0':undefined}/><span className="font-mono text-[10px] text-[#858585]">{actual} / {estimated} {unit}</span></div>
    <span className={cn('shrink-0 rounded-sm px-2 py-0.5 font-mono text-xs tabular-nums',variance>=0?'bg-[#151D13] text-[#A9C79C]':'bg-[#231616] text-[#E48A8A]')}>{variance>=0?'+':'−'}${Math.abs(variance).toLocaleString('en-US')}</span>
  </div>;
}
