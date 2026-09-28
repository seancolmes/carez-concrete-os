'use client';

import {useEffect,useState} from 'react';
import {motion} from 'framer-motion';
import {AnimatedLogo} from '@/components/brand/AnimatedLogo';

const bootMessages=['LOADING_COST_CATALOG...','SYNCING_SITE_CONDITIONS...','READY'] as const;

function playLockClick(){
  try{
    const context=new AudioContext();
    const oscillator=context.createOscillator();
    const gain=context.createGain();
    oscillator.type='triangle';
    oscillator.frequency.setValueAtTime(160,context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(75,context.currentTime+0.09);
    gain.gain.setValueAtTime(0.018,context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,context.currentTime+0.09);
    oscillator.connect(gain).connect(context.destination);
    const expiry=window.setTimeout(()=>{if(context.state==='suspended')void context.close().catch(()=>{});},120);
    void context.resume().then(()=>{
      window.clearTimeout(expiry);
      if(context.state!=='running')return;
      oscillator.start();
      oscillator.stop(context.currentTime+0.09);
      oscillator.onended=()=>{void context.close().catch(()=>{});};
    }).catch(()=>{window.clearTimeout(expiry);if(context.state!=='closed')void context.close().catch(()=>{});});
  }catch{/* Browsers may block audio until the visitor interacts with the page. */}
}

export function SplashScreen({playing,onComplete}:{playing:boolean;onComplete:()=>void}){
  const [messageIndex,setMessageIndex]=useState(0);

  useEffect(()=>{
    if(!playing)return;
    const messages=[window.setTimeout(()=>setMessageIndex(1),480),window.setTimeout(()=>setMessageIndex(2),1120)];
    const finish=window.setTimeout(()=>{playLockClick();onComplete();},1500);
    return()=>{messages.forEach(window.clearTimeout);window.clearTimeout(finish);};
  },[playing,onComplete]);

  return <motion.div className="pt-splash fixed inset-0 z-50 flex items-center justify-center bg-[#121212] px-6" initial={{opacity:1}} exit={{opacity:0}} transition={{duration:0.45}} role="status" aria-live="polite" aria-label="Pourtrace is opening">
    <div className="flex flex-col items-center gap-7">
      <motion.div layoutId="brand-logo" transition={{layout:{duration:0.7,ease:[0.22,1,0.36,1]}}} className="[--ink:#F4F6F5] [--logo:#009966]"><AnimatedLogo size="lg" draw={playing}/></motion.div>
      <div className="min-h-4 font-mono text-[10px] font-semibold tracking-[.2em] text-[#7C8580]">{bootMessages[messageIndex]}<span className="ml-1 animate-pulse text-[#009966] motion-reduce:animate-none" aria-hidden="true">_</span></div>
    </div>
  </motion.div>;
}
