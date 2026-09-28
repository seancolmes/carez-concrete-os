'use client';

import {Eye,EyeOff,LockKeyhole,Mail} from 'lucide-react';
import {FormEvent,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {signInToWorkspace} from '@/app/login/actions';

export function LoginForm(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

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
      window.location.assign(result.destination||'/');
    }catch{
      setMessage('Your account signed in, but the workspace check could not complete. Please try again.');
      setBusy(false);
    }
  }

  return <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
    <CardHeader className="space-y-4 px-0">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Secure workspace access</div>
      <div>
        <CardTitle className="text-3xl font-semibold tracking-tight">Sign in to Pourtrace</CardTitle>
        <CardDescription className="mt-2 max-w-sm text-sm leading-6">Use the account associated with your organization to continue to your workspace.</CardDescription>
      </div>
    </CardHeader>
    <CardContent className="px-0">
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true"/>
            <Input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="name@company.com" className="pl-9"/>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3"><Label htmlFor="password">Password</Label><span className="text-[11px] text-muted-foreground">Case sensitive</span></div>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true"/>
            <Input id="password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" className="px-9"/>
            <button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
              {showPassword?<EyeOff className="size-4"/>:<Eye className="size-4"/>}
            </button>
          </div>
        </div>
        {message&&<div role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{message}</div>}
        <Button type="submit" className="mt-1 w-full" disabled={busy}>{busy?'Signing in...':'Sign in'}</Button>
        <p className="text-center text-[11px] leading-5 text-muted-foreground">Your organization controls access to this workspace.</p>
      </form>
    </CardContent>
  </Card>;
}
