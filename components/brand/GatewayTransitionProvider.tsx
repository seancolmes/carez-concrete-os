'use client';

import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {AnimatePresence} from 'framer-motion';
import {SplashScreen} from './SplashScreen';

type Phase='idle'|'zooming'|'awaiting-route'|'arriving';
type GatewayTransition={phase:Phase;begin:(destination:string)=>void};
const GatewayTransitionContext=createContext<GatewayTransition|null>(null);

export function GatewayTransitionProvider({children}:{children:ReactNode}){
  const router=useRouter();
  const pathname=usePathname();
  const [phase,setPhase]=useState<Phase>('idle');
  const destinationRef=useRef<string|null>(null);
  const fallbackTimer=useRef<number|null>(null);

  const begin=useCallback((destination:string)=>{
    if(destinationRef.current)return;
    destinationRef.current=destination;
    setPhase('zooming');
  },[]);

  const finishHandoff=useCallback(()=>{
    const destination=destinationRef.current;
    if(!destination||window.location.pathname!=='/login')return;
    setPhase('awaiting-route');
    router.push(destination);
    fallbackTimer.current=window.setTimeout(()=>{
      if(window.location.pathname==='/login')window.location.assign(destination);
    },5000);
  },[router]);

  useEffect(()=>{
    if(!destinationRef.current||pathname==='/login'||phase==='arriving')return;
    if(fallbackTimer.current!==null)window.clearTimeout(fallbackTimer.current);
    setPhase('arriving');
    const timer=window.setTimeout(()=>{
      destinationRef.current=null;
      setPhase('idle');
    },window.matchMedia('(prefers-reduced-motion: reduce)').matches?100:550);
    return()=>window.clearTimeout(timer);
  },[pathname,phase]);

  useEffect(()=>()=>{
    if(fallbackTimer.current!==null)window.clearTimeout(fallbackTimer.current);
  },[]);

  return <GatewayTransitionContext.Provider value={{phase,begin}}>
    {children}
    <AnimatePresence>{phase==='zooming'||phase==='awaiting-route'?<SplashScreen key="workspace-handoff" kind="handoff" playing onComplete={finishHandoff}/>:null}</AnimatePresence>
  </GatewayTransitionContext.Provider>;
}

export function useGatewayTransition(){
  const transition=useContext(GatewayTransitionContext);
  if(!transition)throw new Error('GatewayTransitionProvider is required');
  return transition;
}
