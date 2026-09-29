'use client';

import {useEffect} from 'react';
import {motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring} from 'framer-motion';

/** Ambient workspace light; motion values avoid a React render for every pointer event. */
export function CursorGlow() {
  const reducedMotion=useReducedMotion();
  const x=useMotionValue(-500);
  const y=useMotionValue(-500);
  const opacity=useMotionValue(0);
  const springX=useSpring(x,{stiffness:180,damping:32});
  const springY=useSpring(y,{stiffness:180,damping:32});
  const backgroundImage=useMotionTemplate`radial-gradient(400px circle at ${springX}px ${springY}px, rgba(0,153,102,0.12), transparent 70%)`;

  useEffect(()=>{
    if(reducedMotion||!window.matchMedia('(pointer: fine)').matches)return;
    const move=(event:PointerEvent)=>{
      if(event.pointerType!=='mouse')return;
      x.set(event.clientX);
      y.set(event.clientY);
      opacity.set(1);
    };
    const hide=()=>opacity.set(0);
    window.addEventListener('pointermove',move,{passive:true});
    window.addEventListener('blur',hide);
    document.addEventListener('pointerleave',hide);
    return()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('blur',hide);
      document.removeEventListener('pointerleave',hide);
    };
  },[opacity,reducedMotion,x,y]);

  if(reducedMotion)return null;
  return <motion.div aria-hidden="true" className="carez-cursor-glow pointer-events-none fixed inset-0 z-[-1] hidden dark:block motion-reduce:hidden" style={{backgroundImage,opacity}}/>;
}
