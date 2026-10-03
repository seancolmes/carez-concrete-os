'use client';

import { EyeRegular as Eye, EyeOffRegular as EyeOff } from '@fluentui/react-icons';
import {Button,Input,Label} from '@fluentui/react-components';
import {FormEvent,useState} from 'react';
import {AnimatePresence,motion} from 'framer-motion';
import {signInToWorkspace} from '@/app/login/actions';
import {useGatewayTransition} from '@/components/brand/GatewayTransitionProvider';

export function LoginForm({idPrefix='workspace'}:{idPrefix?:string}){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [authenticated,setAuthenticated]=useState(false);
  const {begin}=useGatewayTransition();

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setMessage('');
    try{
      const result=await signInToWorkspace(email,password);
      if(result.error){
        setMessage(result.error==='company'?'Your account signed in, but it is not linked to a company workspace. Ask a workspace administrator to check your profile.':result.error==='profile'?'Your account signed in, but the workspace profile could not be checked. Please try again.':`The configured authentication service rejected sign-in: ${result.authMessage||'Unknown reason'} (${result.authCode||'unknown'}).`);
        setBusy(false);
        return;
      }
      const readiness=await fetch('/api/auth/workspace-readiness',{cache:'no-store',credentials:'same-origin'});
      if(!readiness.ok){
        const state=await readiness.json() as {reason?:string};
        setMessage(state.reason==='company'?'Your account is not linked to a company workspace. Ask a workspace administrator to check your profile.':state.reason==='profile_error'?'Your account is signed in, but the workspace profile could not be checked. Please try again.':'Your account is signed in, but the server session is missing. Please report this message so we can inspect the local auth cookie handoff.');
        setBusy(false);
        return;
      }
      setAuthenticated(true);
      begin(result.destination||'/');
    }catch{
      setMessage('Your account signed in, but the workspace check could not complete. Please try again.');
      setBusy(false);
    }
  }

  return <div className="w-full max-w-md">
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--pt-brand)]">Workspace sign in</div>
      <div>
        <h2 className="font-sans text-3xl font-semibold tracking-tight">Get back to the job.</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Sign in to your PourTrace workspace.</p>
      </div>
    </div>
    <div className="mt-6">
      <AnimatePresence mode="wait" initial={false}>{authenticated?
        <motion.div key="authenticated" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="flex min-h-[270px] flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite"><span className="inline-flex size-9 items-center justify-center rounded-full border border-success/50 bg-success/10 text-success">✓</span><span className="text-sm font-semibold">Signed in. Opening your workspace…</span></motion.div>
      :<motion.div key="credentials" exit={{opacity:0,y:-8}} transition={{duration:0.16}}><form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-email`}>Email</Label>
          <div className="relative">
            <Input appearance="outline" id={`${idPrefix}-email`} type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="name@company.com" className="h-11 w-full font-sans"/>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-password`}>Password</Label>
          <div className="relative">
            <Input appearance="outline" id={`${idPrefix}-password`} type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" className="h-11 w-full font-sans" contentAfter={<Button type="button" appearance="subtle" size="small" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} icon={showPassword?<EyeOff className="size-4"/>:<Eye className="size-4"/>} onClick={()=>setShowPassword(value=>!value)}/>}/>
          </div>
        </div>
        {message&&<div role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{message}</div>}
        <Button type="submit" appearance="primary" className="mt-1 h-11 w-full" disabled={busy}>{busy?'Signing in...':'Sign in'}</Button>
        <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">Need access? Contact your company&apos;s PourTrace administrator.</p>
      </form></motion.div>}</AnimatePresence>
    </div>
  </div>;
}
