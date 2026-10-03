'use client';

import {useCallback,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';

const clips=[
  {video:'/videos/pouring-ground.mp4',poster:'/videos/pouring-ground-poster.webp'},
  {video:'/videos/mixer-discharge.mp4',poster:'/videos/mixer-discharge-poster.webp'},
  {video:'/videos/field-crew-pour.mp4',poster:'/videos/field-crew-pour-poster.webp'},
];

export function FieldFootage(){
  const [current,setCurrent]=useState(0);
  const [failed,setFailed]=useState(false);
  const reduceMotion=useReducedMotion();
  const startVideo=useCallback((video:HTMLVideoElement|null)=>{
    if(!video)return;
    video.defaultMuted=true;
    video.muted=true;
    if(reduceMotion){video.pause();return;}
    void video.play().catch(error=>{if(!(error instanceof DOMException&&error.name==='AbortError'))setFailed(true);});
  },[reduceMotion]);

  return <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#111416]" aria-hidden="true">
    <div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage:`url(${clips[current].poster})`}}/>
    {!reduceMotion&&!failed?<AnimatePresence initial={false}>
      <motion.video
        key={clips[current].video}
        ref={startVideo}
        src={clips[current].video}
        poster={clips[current].poster}
        autoPlay
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        style={{filter:'saturate(.82) contrast(1.04)'}}
        initial={{opacity:0}}
        animate={{opacity:1}}
        exit={{opacity:0}}
        transition={{duration:reduceMotion?0:1.1}}
        onEnded={()=>setCurrent(index=>(index+1)%clips.length)}
        onError={()=>setFailed(true)}
      />
    </AnimatePresence>:null}
  </div>;
}
