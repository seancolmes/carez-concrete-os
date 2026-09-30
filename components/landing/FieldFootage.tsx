'use client';

import {useCallback,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';

const clips=[
  '/videos/pouring-ground.mp4',
  '/videos/mixer-discharge.mp4',
  '/videos/field-crew-pour.mp4',
];

export function FieldFootage(){
  const [current,setCurrent]=useState(0);
  const reduceMotion=useReducedMotion();
  const startVideo=useCallback((video:HTMLVideoElement|null)=>{
    if(!video)return;
    video.defaultMuted=true;
    video.muted=true;
    void video.play().catch(()=>{});
  },[]);

  return <div className="relative h-full min-h-[310px] w-full overflow-hidden bg-[#0A0A0A] max-[760px]:min-h-[240px]" aria-label="Concrete field work footage">
    <AnimatePresence initial={false}>
      <motion.video
        key={clips[current]}
        ref={startVideo}
        src={clips[current]}
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover grayscale contrast-125"
        initial={{opacity:0}}
        animate={{opacity:1}}
        exit={{opacity:0}}
        transition={{duration:reduceMotion?0:0.55}}
        onEnded={()=>setCurrent(index=>(index+1)%clips.length)}
      />
    </AnimatePresence>
    <div className="pointer-events-none absolute inset-0 bg-[#000000]/20" aria-hidden="true"/>
  </div>;
}
