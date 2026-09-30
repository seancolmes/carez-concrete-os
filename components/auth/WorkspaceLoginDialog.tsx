'use client';

import {Button,Dialog,DialogSurface,DialogTitle,DialogTrigger} from '@fluentui/react-components';
import { DismissRegular as X } from '@fluentui/react-icons';
import {LoginForm} from '@/components/auth/LoginForm';
import {useGatewayTransition} from '@/components/brand/GatewayTransitionProvider';

export function WorkspaceLoginDialog({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}){
  const {phase}=useGatewayTransition();
  return <Dialog open={open} onOpenChange={(_,data)=>{if(phase==='idle')onOpenChange(data.open);}}>
      <DialogSurface backdrop={{className:'bg-black/60 backdrop-blur-md'}} className="relative z-[81] w-[min(440px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-lg border border-win-stroke bg-win-bg2 p-7 text-win-text shadow-2xl outline-none sm:p-8">
        <DialogTitle className="sr-only">Sign in to Pourtrace</DialogTitle>
        <p className="sr-only">Access your company workspace.</p>
        <DialogTrigger action="close"><Button appearance="subtle" disabled={phase!=='idle'} aria-label="Close sign in" icon={<X fontSize={18} aria-hidden="true"/>} className="absolute right-4 top-4"/></DialogTrigger>
        <LoginForm idPrefix="modal"/>
      </DialogSurface>
  </Dialog>;
}
