'use client';

import {Eye,EyeOff} from 'lucide-react';
import {FormEvent,useState} from 'react';
import {AnimatePresence,motion} from 'framer-motion';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
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

  return <Card className="w-full max-w-md border-0 bg-transparent shadow-none" style={{backgroundColor:'transparent',padding:0}}>
    <CardHeader className="space-y-4 px-0">
      <div className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Workspace access</div>
      <div>
        <CardTitle className="font-sans text-2xl font-semibold tracking-tight">Sign in to Pourtrace</CardTitle>
        <CardDescription className="mt-2 max-w-sm text-sm leading-6">Sign in to Pourtrace with the account associated with your organization.</CardDescription>
      </div>
    </CardHeader>
    <CardContent className="px-0">
      <AnimatePresence mode="wait" initial={false}>{authenticated?
        <motion.div key="authenticated" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="flex min-h-[270px] flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite"><span className="inline-flex size-9 items-center justify-center rounded-full border border-[#009966]/40 bg-[#009966]/10 text-[#009966]">✓</span><span className="font-mono text-sm font-semibold tracking-wide text-[#171B19] dark:text-[#F4F6F5]">AUTHENTICATED...<br/>ROUTING_TO_WORKSPACE<span className="animate-pulse text-[#009966] motion-reduce:animate-none" aria-hidden="true">_</span></span></motion.div>
      :<motion.div key="credentials" exit={{opacity:0,y:-8}} transition={{duration:0.16}}><form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-email`}>Email</Label>
          <div className="relative">
            <Input id={`${idPrefix}-email`} type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="name@company.com" className="h-11 rounded-lg border border-[#D4DBD7] bg-[#EFF2F0] px-3 font-sans text-[#171B19] dark:border-[#343A3F] dark:bg-[#25292C] dark:text-[#F4F6F5]"/>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3"><Label htmlFor={`${idPrefix}-password`}>Password</Label><span className="text-[11px] text-muted-foreground">Case sensitive</span></div>
          <div className="relative">
            <Input id={`${idPrefix}-password`} type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" className="h-11 rounded-lg border border-[#D4DBD7] bg-[#EFF2F0] px-3 pr-11 font-sans text-[#171B19] dark:border-[#343A3F] dark:bg-[#25292C] dark:text-[#F4F6F5]"/>
            <button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
              {showPassword?<EyeOff className="size-4"/>:<Eye className="size-4"/>}
            </button>
          </div>
        </div>
        {message&&<div role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{message}</div>}
        <Button type="submit" className="mt-1 h-11 w-full rounded-lg" disabled={busy}>{busy?'Signing in...':'Sign in'}</Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">Don't have a workspace? <Link href="/signup" className="font-medium text-[#007A52] underline-offset-4 hover:underline focus-visible:underline dark:text-[#009966]">Sign up here</Link></p>
        <p className="text-center text-[11px] leading-5 text-muted-foreground">Your organization controls access to this workspace.</p>
      </form></motion.div>}</AnimatePresence>
    </CardContent>
  </Card>;
}
