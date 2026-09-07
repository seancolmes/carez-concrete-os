'use client';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/client';

export function EmployeeJoinForm({token,employeeName}:{token:string;employeeName:string}){
 const router=useRouter();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');const supabase=createClient();const {data,error}=await supabase.auth.signUp({email,password,options:{data:{employee_invite_token:token,full_name:employeeName}}});if(error){setMessage(error.message);setBusy(false);return;}if(data.session){router.push('/employee');router.refresh();return;}setMessage('Account created. Check your email if Carez asks you to confirm it, then log in.');setBusy(false);}
 return <form className="grid gap-4" onSubmit={submit}>
  <div className="grid gap-2"><Label htmlFor="employee-name">Your Name</Label><Input id="employee-name" value={employeeName} disabled/></div>
  <div className="grid gap-2"><Label htmlFor="employee-email">Email</Label><Input id="employee-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div>
  <div className="grid gap-2"><Label htmlFor="employee-password">Create Password</Label><Input id="employee-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required autoComplete="new-password"/></div>
  {message&&<div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-muted-foreground">{message}</div>}
  <Button type="submit" disabled={busy}>{busy?'Creating account...':'Create My Carez Login'}</Button>
 </form>;
}
