'use client';

import Image from 'next/image';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/client';

export function LoginForm(){
  const router=useRouter();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setMessage('');
    const supabase=createClient();
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error){setMessage('Login failed. Check your email and password.');setBusy(false);return;}
    const userId=data.user?.id;
    if(userId){
      const {data:profile}=await supabase.from('profiles').select('role').eq('id',userId).maybeSingle();
      router.push(profile?.role==='employee'?'/employee':'/');
    }else router.push('/');
    router.refresh();
  }

  return <Card className="w-full max-w-md shadow-xl shadow-slate-950/5">
    <CardHeader className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-sidebar text-sm font-bold text-sidebar-foreground">C</span>
        <div className="min-w-0">
          <Image src="/brand/carez-wordmark.png" alt="Carez Concrete" width={146} height={54} priority className="h-7 w-auto object-contain object-left brightness-[.22]"/>
          <p className="mt-0.5 text-xs text-muted-foreground">Concrete OS</p>
        </div>
      </div>
      <div>
        <CardTitle className="text-xl font-semibold tracking-tight">Sign in</CardTitle>
        <CardDescription className="mt-1">Owner and authorized crew access only.</CardDescription>
      </div>
    </CardHeader>
    <CardContent>
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="name@company.com"/>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/>
        </div>
        {message&&<div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{message}</div>}
        <Button type="submit" className="w-full" disabled={busy}>{busy?'Signing in...':'Sign in'}</Button>
      </form>
    </CardContent>
  </Card>;
}
