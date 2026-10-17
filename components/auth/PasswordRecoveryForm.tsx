'use client';
import {useActionState} from 'react';
import Link from 'next/link';
import {Button,Input,Label} from '@fluentui/react-components';
import {requestPasswordRecovery,saveRecoveredPassword} from '@/app/auth/recovery-actions';
import {PASSWORD_MIN_LENGTH} from '@/lib/auth/passwordPolicy';
const initial={status:'idle',message:''};
export function PasswordRecoveryRequest({available}:{available:boolean}){
 const [state,action,pending]=useActionState(requestPasswordRecovery,initial);
 return <form action={action} className="grid gap-4" aria-busy={pending}>
  <div className="grid gap-2"><Label htmlFor="recovery-email">Account email</Label><Input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending||!available}/></div>
  {!available?<p role="status" className="text-sm text-muted-foreground">Password recovery is unavailable. Contact your workspace administrator or try again later.</p>:null}
  {state.message?<p role={state.status==='error'?'alert':'status'} className="break-words text-sm text-muted-foreground">{state.message}</p>:null}
  <Button type="submit" appearance="primary" disabled={pending||!available}>{pending?'Requesting…':'Send password-reset email'}</Button>
  <Link href="/login" className="text-sm underline">Return to sign in</Link>
 </form>;
}
export function PasswordRecoveryReset(){
 const [state,action,pending]=useActionState(saveRecoveredPassword,initial);
 if(state.status==='saved')return <div className="grid gap-4"><p role="status" className="text-sm">{state.message}</p><Link href="/login" className="carez-button-primary inline-flex min-h-10 items-center justify-center rounded-md px-4">Sign in</Link></div>;
 return <form action={action} className="grid gap-4" aria-busy={pending}>
  <div className="grid gap-2"><Label htmlFor="recovery-password">New password</Label><Input id="recovery-password" name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={1024} required disabled={pending}/></div>
  <div className="grid gap-2"><Label htmlFor="recovery-confirmation">Confirm new password</Label><Input id="recovery-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={1024} required disabled={pending}/></div>
  <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>
  {state.message?<p role="alert" className="break-words text-sm text-destructive">{state.message}</p>:null}
  <Button type="submit" appearance="primary" disabled={pending}>{pending?'Updating…':'Set new password'}</Button>
  <Link href="/auth/forgot-password" className="text-sm underline">Request a new link</Link>
 </form>;
}
