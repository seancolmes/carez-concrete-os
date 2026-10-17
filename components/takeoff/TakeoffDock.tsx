'use client';

import {useEffect,useState,type MouseEventHandler,type ReactElement,type ReactNode} from 'react';
import {Button,Tooltip,Portal} from '@fluentui/react-components';

type DockButtonProps={
  label:string;
  icon:ReactElement;
  onClick:MouseEventHandler<HTMLButtonElement>;
  active?:boolean;
  pressed?:boolean;
  disabled?:boolean;
  emphasis?:boolean;
  showLabel?:boolean;
};

export function TakeoffDockButton({label,icon,onClick,active=false,pressed,disabled=false,emphasis=false,showLabel=false}:DockButtonProps){
  return <Tooltip content={label} relationship="label"><Button
    type="button"
    appearance={emphasis?'primary':active?'secondary':'subtle'}
    size="small"
    icon={icon}
    aria-label={label}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
    className="h-9 min-w-9 shrink-0"
  >{showLabel?<span className="hidden xl:inline">{label}</span>:null}</Button></Tooltip>;
}

export function TakeoffDock({children}: {children:ReactNode}){
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  if(!mounted)return null;
  return <Portal><nav
    aria-label="Takeoff drawing tools"
    className="fixed bottom-8 left-1/2 z-[45] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-md border border-border bg-surface-raised p-2 text-foreground shadow-lg"
    onKeyDown={event=>event.stopPropagation()}
    onPointerDown={event=>event.stopPropagation()}
    onClick={event=>event.stopPropagation()}
    onDoubleClick={event=>event.stopPropagation()}
  >{children}</nav></Portal>;
}
