'use client';

import {Dialog as DialogPrimitive} from '@base-ui/react/dialog';
import {X} from 'lucide-react';
import {LoginForm} from '@/components/auth/LoginForm';
import {useGatewayTransition} from '@/components/brand/GatewayTransitionProvider';

export function WorkspaceLoginDialog({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}){
  const {phase}=useGatewayTransition();
  return <DialogPrimitive.Root open={open} onOpenChange={next=>{if(phase==='idle')onOpenChange(next);}}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"/>
      <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-[81] w-[min(440px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[#D4DBD7] bg-white p-7 text-[#171B19] shadow-2xl outline-none dark:border-[#343A3F] dark:bg-[#181A1B] dark:text-[#F4F6F5] sm:p-8">
        <DialogPrimitive.Title className="sr-only">Sign in to Pourtrace</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">Access your company workspace.</DialogPrimitive.Description>
        <DialogPrimitive.Close disabled={phase!=='idle'} aria-label="Close sign in" className="absolute right-4 top-4 rounded-md p-1.5 text-[#525C57] hover:bg-[#EFF2F0] hover:text-[#171B19] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#007A52] disabled:opacity-40 dark:text-[#B6BEBA] dark:hover:bg-[#25292C] dark:hover:text-[#F4F6F5]"><X size={18} aria-hidden="true"/></DialogPrimitive.Close>
        <LoginForm idPrefix="modal"/>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
