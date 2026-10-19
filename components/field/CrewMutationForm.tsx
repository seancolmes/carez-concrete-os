'use client';
import {createContext,startTransition,useActionState,useContext,useEffect,useMemo,useRef,type ReactNode} from 'react';
import Link from 'next/link';
import {Button,type ButtonProps} from '@fluentui/react-components';
import {saveCrewForm} from '@/app/crew/actions';
import type {CrewMutation} from '@/lib/crew/administration';
import type {CrewActionState} from '@/lib/crew/actionFeedback';

const initial:CrewActionState={status:'idle',message:''};
const SubmissionLocked=createContext(false);

export function CrewMutationSubmit(props:Pick<ButtonProps,'children'|'appearance'|'className'>){
 return <Button {...props} type="submit" disabled={useContext(SubmissionLocked)}/>;
}

export function CrewMutationForm({operation,children}:{operation:CrewMutation;children:ReactNode}){
 const save=useMemo(()=>saveCrewForm.bind(null,operation),[operation]);
 const [state,action,pending]=useActionState(save,initial);
 const feedback=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(state.status!=='idle')feedback.current?.focus();},[state]);
 return <form action={action} className="grid gap-4" aria-busy={pending} onSubmit={event=>{
  // Manual dispatch avoids React resetting uncontrolled fields after a returned
  // validation error. Keep the same request ID and entered values for review.
  event.preventDefault();if(pending||state.status==='saved')return;
  const values=new FormData(event.currentTarget);startTransition(()=>action(values));
 }}>
  {state.status!=='idle'&&<div ref={feedback} tabIndex={-1} role={state.status==='error'?'alert':'status'} className="space-y-2 break-words border-l-2 border-border bg-muted/20 px-3 py-2 text-sm text-foreground">
   <p>{state.message}</p>
   {state.settingsHref&&<p><Link href={state.settingsHref} className="font-semibold text-primary underline">Open Company operating calendar</Link><span className="text-muted-foreground"> · Owner setup is required before saving Crew terms.</span></p>}
  </div>}
  <SubmissionLocked.Provider value={pending||state.status==='saved'}><fieldset disabled={pending} className="grid min-w-0 gap-4">{children}</fieldset></SubmissionLocked.Provider>
 </form>;
}
