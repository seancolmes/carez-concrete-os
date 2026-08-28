'use client';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';

export function EmployeeJoinForm({token,employeeName}:{token:string;employeeName:string}){
 const router=useRouter();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');const supabase=createClient();const {data,error}=await supabase.auth.signUp({email,password,options:{data:{employee_invite_token:token,full_name:employeeName}}});if(error){setMessage(error.message);setBusy(false);return;}if(data.session){router.push('/employee');router.refresh();return;}setMessage('Account created. Check your email if Carez asks you to confirm it, then log in.');setBusy(false);}
 return <form className="form" onSubmit={submit}>
  <label className="field"><span>Your Name</span><input value={employeeName} disabled/></label>
  <label className="field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>
  <label className="field"><span>Create Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required autoComplete="new-password"/></label>
  {message&&<div className="alert info">{message}</div>}
  <button className="button" disabled={busy}>{busy?'Creating account...':'Create My Carez Login'}</button>
 </form>;
}
