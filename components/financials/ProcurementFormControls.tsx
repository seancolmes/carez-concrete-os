'use client';
import {useState,useTransition,type FormHTMLAttributes,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
export type ProcurementFormProps=Omit<FormHTMLAttributes<HTMLFormElement>,'action'|'onSubmit'|'children'>&{action:(form:FormData)=>Promise<void>;children:ReactNode};
export function ProcurementFormControls({action,children,...props}:ProcurementFormProps){
 const [pending,startTransition]=useTransition();const [feedback,setFeedback]=useState<{error:boolean;message:string}|null>(null);const router=useRouter();
 return <form {...props} aria-busy={pending} onSubmit={event=>{event.preventDefault();const form=event.currentTarget;const values=new FormData(form);setFeedback(null);startTransition(async()=>{try{await action(values);setFeedback({error:false,message:'Saved.'});router.refresh();}catch(error){setFeedback({error:true,message:error instanceof Error?error.message:'Save was not confirmed. Retry the same form.'});}});}}>
  <fieldset disabled={pending} style={{display:'contents'}}>{children}</fieldset>
  {pending?<p role="status" className="text-xs text-muted-foreground">Saving…</p>:feedback?<p role={feedback.error?'alert':'status'} className={`basis-full text-xs ${feedback.error?'text-destructive':'text-foreground'}`}>{feedback.message}</p>:null}
 </form>;
}
