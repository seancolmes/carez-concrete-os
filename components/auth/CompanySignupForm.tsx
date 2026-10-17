'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Button,Input,Label,Select} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/client';
import {PASSWORD_MIN_LENGTH,validateNewPassword} from '@/lib/auth/passwordPolicy';

export function CompanySignupForm({timezones,confirmationFailed}:{timezones:string[];confirmationFailed:boolean}){
 const router=useRouter();const [timezone,setTimezone]=useState('');const [email,setEmail]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState(confirmationFailed?'Confirmation did not complete. Use the latest email link, try signing in, or request a new confirmation email.':'');
 useEffect(()=>{const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;if(timezones.includes(zone))setTimezone(zone);},[timezones]);
 const callback=()=>new URL('/auth/confirm?next=/dashboard',location.origin).href;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const values=new FormData(event.currentTarget);setBusy(true);setMessage('');
  try{const result=await createClient().auth.signUp({email:email.trim(),password:validateNewPassword(values.get('password')),options:{emailRedirectTo:callback(),data:{company_name:String(values.get('company_name')||'').trim(),full_name:String(values.get('full_name')||'').trim(),operating_timezone:timezone}}});
   if(result.error)throw result.error;
   if(result.data.session){router.replace('/dashboard');router.refresh();return;}
   setMessage('Check your email to confirm your account, then sign in. Your company workspace starts without sample jobs or financial settings.');
  }catch(error){setMessage(error instanceof Error?error.message:'Workspace creation is unavailable. Your existing account and records were not replaced.');}finally{setBusy(false);}
 }
 async function resend(){
  if(!email.trim()){setMessage('Enter your account email before requesting another confirmation.');return;}setBusy(true);
  try{const result=await createClient().auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:callback()}});if(result.error)throw result.error;setMessage('If this account needs confirmation, a new email has been requested. Use the latest link.');}catch(error){setMessage(error instanceof Error?error.message:'Confirmation email is unavailable. Try again later.');}finally{setBusy(false);}
 }
 return <form onSubmit={event=>void submit(event)} className="grid gap-4" aria-busy={busy}>
  <div className="grid gap-1"><Label htmlFor="signup-company">Company name</Label><Input id="signup-company" name="company_name" autoComplete="organization" required maxLength={160} disabled={busy}/></div>
  <div className="grid gap-1"><Label htmlFor="signup-name">Your name</Label><Input id="signup-name" name="full_name" autoComplete="name" required maxLength={120} disabled={busy}/></div>
  <div className="grid gap-1"><Label htmlFor="signup-timezone">Company time zone</Label><Select id="signup-timezone" value={timezone} required disabled={busy} onChange={event=>setTimezone(event.target.value)}><option value="">Choose a time zone</option>{timezones.map(zone=><option key={zone} value={zone}>{zone.replaceAll('_',' ')}</option>)}</Select><p className="text-xs text-muted-foreground">Review the suggested time zone. It defines company work dates; jobs may have their own locations.</p></div>
  <div className="grid gap-1"><Label htmlFor="signup-email">Work email</Label><Input id="signup-email" name="email" type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required disabled={busy}/></div>
  <div className="grid gap-1"><Label htmlFor="signup-password">Create password</Label><Input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={1024} disabled={busy}/><p className="text-xs text-muted-foreground">Use at least 12 characters.</p></div>
  {message&&<p role="status" className="break-words text-sm text-muted-foreground">{message}</p>}
  <Button type="submit" appearance="primary" disabled={busy}>{busy?'Please wait…':'Create company workspace'}</Button>
  <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><Link href="/login" className="underline">Already registered? Sign in</Link><Button type="button" appearance="subtle" size="small" disabled={busy} onClick={()=>void resend()}>Resend confirmation email</Button></div>
 </form>;
}
