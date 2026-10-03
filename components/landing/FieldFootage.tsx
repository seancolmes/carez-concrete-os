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
    if(reduceMotion){video.pause();return;}
    void video.play().catch(()=>{});
  },[reduceMotion]);

  return <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#111416]" aria-hidden="true">
    <AnimatePresence initial={false}>
      <motion.video
        key={clips[current]}
        ref={startVideo}
        src={clips[current]}
        autoPlay={!reduceMotion}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{filter:'saturate(.82) contrast(1.04)'}}
        initial={{opacity:0}}
        animate={{opacity:1}}
        exit={{opacity:0}}
        transition={{duration:reduceMotion?0:1.1}}
        onEnded={()=>setCurrent(index=>(index+1)%clips.length)}
      />
    </AnimatePresence>
  </div>;
}
