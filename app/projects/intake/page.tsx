import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {ExternalJobIntakeForm} from '@/components/projects/ExternalJobIntakeForm';
export default async function ExternalJobIntakePage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('company_id,role,full_name').eq('id',user.id).single();if(!profile?.company_id||!['owner','office'].includes(profile.role))redirect('/projects');
 const {data:customers,error}=await supabase.from('customers').select('id,name,contact_name,email,phone').eq('company_id',profile.company_id).eq('active',true).order('name');
 return <AppShell userName={profile.full_name||user.email||''}><div className="mx-auto w-full max-w-4xl space-y-4 p-3 text-foreground"><Link href="/projects" className="text-sm underline">Projects</Link><header className="border-b border-border pb-3"><p className="font-mono text-xs text-primary">EXISTING EXTERNAL JOB</p><h1 className="text-xl font-semibold">Bring an awarded job into PourTrace</h1><p className="mt-2 text-sm text-muted-foreground">Record the original identity and source evidence. This does not create a lead, internal proposal, accepted baseline, or authorization to start.</p></header>{error?<p role="alert">Customer list unavailable. No intake can be saved until this read recovers.</p>:<ExternalJobIntakeForm customers={customers||[]} requestId={randomUUID()}/>}</div></AppShell>;
}
