'use client';

import {useEffect} from 'react';
import {motion} from 'framer-motion';
import {AnimatedLogo} from '@/components/brand/AnimatedLogo';

export function SplashScreen({playing,onComplete,kind='entry'}:{playing:boolean;onComplete:()=>void;kind?:'entry'|'handoff'}){
  useEffect(()=>{
    if(!playing)return;
    const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?150:1500;
    const finish=window.setTimeout(onComplete,duration);
    return()=>window.clearTimeout(finish);
  },[playing,onComplete]);

  return <motion.div className={`${kind==='entry'?'pt-splash':'pt-gateway-splash'} fixed inset-0 z-[100] flex items-center justify-center bg-[#111416] px-6`} initial={{opacity:1}} exit={{opacity:0}} transition={{duration:0.45}} role="status" aria-live="polite" aria-label="Pourtrace is opening">
    <div className="flex flex-col items-center gap-7">
      <div className="[--ink:#F2F0EA] [--logo:var(--pt-logo)]"><AnimatedLogo size="lg" draw={playing} idPrefix={`splash-${kind}`}/></div>
      <div role="progressbar" aria-label="Opening Pourtrace" className="h-1 w-44 overflow-hidden rounded-full bg-white/15">
        <motion.div className="h-full w-full origin-left rounded-full bg-[var(--pt-logo)] motion-reduce:transform-none" initial={{scaleX:0}} animate={{scaleX:playing?1:0}} transition={{duration:1.45,ease:'linear'}}/>
      </div>
    </div>
  </motion.div>;
}
