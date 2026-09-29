'use client';

import {motion,useReducedMotion} from 'framer-motion';
import {useEffect,useState,type MouseEventHandler,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

type DockButtonProps={
  label:string;
  icon:ReactNode;
  onClick:MouseEventHandler<HTMLButtonElement>;
  active?:boolean;
  pressed?:boolean;
  disabled?:boolean;
  emphasis?:boolean;
  showLabel?:boolean;
};

export function TakeoffDockButton({label,icon,onClick,active=false,pressed,disabled=false,emphasis=false,showLabel=false}:DockButtonProps){
  const reducedMotion=useReducedMotion();
  return <motion.div
    className={`relative shrink-0 overflow-hidden rounded-xl p-px ${active?'bg-[#007A52] dark:bg-[#009966]':'bg-transparent'}`}
    whileHover={disabled||reducedMotion?undefined:{scale:1.12,y:-4}}
    transition={{type:'spring',stiffness:380,damping:25}}
  >
    {active&&!reducedMotion&&<motion.span
      aria-hidden="true"
      className="pointer-events-none absolute -inset-8 bg-[conic-gradient(transparent_0deg,transparent_300deg,#009966_335deg,transparent_360deg)] opacity-70"
      animate={{rotate:360}}
      transition={{duration:3,ease:'linear',repeat:Infinity}}
    />}
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`relative z-10 flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-[11px] px-2.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007A52] disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:outline-[#009966] ${emphasis?'bg-[#007A52] text-white hover:bg-[#009966] dark:bg-[#009966] dark:text-[#121212] dark:hover:bg-[#00AD73]':active?'bg-[#F5F7F6] text-[#007A52] dark:bg-[#181A1B] dark:text-[#009966]':'bg-transparent text-[#525C57] hover:bg-[#EFF2F0] hover:text-[#171B19] dark:text-[#B6BEBA] dark:hover:bg-[#25292C] dark:hover:text-[#F4F6F5]'}`}
    >
      {icon}{showLabel&&<span className="hidden xl:inline">{label}</span>}
    </button>
  </motion.div>;
}

export function TakeoffDock({children}: {children:ReactNode}){
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  if(!mounted)return null;
  return createPortal(<nav
    aria-label="Takeoff drawing tools"
    className="fixed bottom-8 left-1/2 z-[45] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-2xl border border-[#D4DBD7] bg-white/90 p-2 shadow-[0_10px_36px_rgba(0,0,0,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-black/40 dark:shadow-[0_14px_40px_rgba(0,0,0,0.55)]"
    onKeyDown={event=>event.stopPropagation()}
    onPointerDown={event=>event.stopPropagation()}
    onClick={event=>event.stopPropagation()}
    onDoubleClick={event=>event.stopPropagation()}
  >{children}</nav>,document.body);
}
