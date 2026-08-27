import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { SeedButton } from '@/components/SeedButton';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';

export default async function SettingsPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile,error}=await supabase.from('profiles').select('full_name,role').eq('id',user.id).maybeSingle();
 const name=profile?.full_name||user.email||'Owner';
 return <AppShell userName={name}><h1 className="page-title">Settings</h1><p className="subtitle">Company configuration and integrations.</p><div className="card"><div className="list"><div className="row"><div><div className="title">Database</div><div className="meta">Supabase live database</div></div><span className="status">{!error&&profile?'Connected':'Setup Needed'}</span></div><div className="row"><div><div className="title">Authentication</div><div className="meta">Private owner login</div></div><span className="status">Enabled</span></div><div className="row"><div><div className="title">QuickBooks</div><div className="meta">Accounting integration after core workflow is stable</div></div><span className="status">Later</span></div></div></div><div className="card section"><div className="title">Initial Setup</div><p className="subtitle">Press this once to add the current starter projects and crew. It is safe to press again.</p><SeedButton/></div><div className="card section"><div className="title">Signed In</div><div className="meta">{name} · {profile?.role||'owner'}</div><form action={signOut} style={{marginTop:14}}><button className="button secondary">Log Out</button></form></div></AppShell>;
}
