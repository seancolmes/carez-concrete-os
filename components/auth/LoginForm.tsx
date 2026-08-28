'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
    if(userId){const {data:profile}=await supabase.from('profiles').select('role').eq('id',userId).maybeSingle();router.push(profile?.role==='employee'?'/employee':'/');}
    else router.push('/');
    router.refresh();
  }

  return <div className="login-card">
    <div className="brand">CAREZ CONCRETE OS</div>
    <h1>Private Login</h1>
    <p>Owner and authorized crew access only.</p>
    <form className="form" onSubmit={submit}>
      <label className="field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>
      <label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
      {message&&<div className="alert danger">{message}</div>}
      <button className="button" disabled={busy}>{busy?'Signing in...':'Log In'}</button>
    </form>
  </div>;
}
