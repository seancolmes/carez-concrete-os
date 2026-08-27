import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { SeedButton } from '@/components/SeedButton';
import { createClient } from '@/lib/supabase/server';
import { signOut,updateLaborBurden } from './actions';

export default async function SettingsPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile,error}=await supabase.from('profiles').select('full_name,role,company_id').eq('id',user.id).maybeSingle();
 const {data:company}=profile?.company_id?await supabase.from('companies').select('labor_burden_percent').eq('id',profile.company_id).maybeSingle():{data:null};
 const name=profile?.full_name||user.email||'Owner';
 return <AppShell userName={name}><h1 className="page-title">Settings</h1><p className="subtitle">Company configuration and integrations.</p>
 <div className="card"><div className="list"><div className="row"><div><div className="title">Database</div><div className="meta">Supabase live database</div></div><span className="status">{!error&&profile?'Connected':'Setup Needed'}</span></div><div className="row"><div><div className="title">Authentication</div><div className="meta">Private owner login</div></div><span className="status">Enabled</span></div><div className="row"><div><div className="title">QuickBooks</div><div className="meta">Accounting integration after core workflow is stable</div></div><span className="status">Later</span></div></div></div>
 <div className="card section"><div className="title">Labor Cost Settings</div><p className="subtitle">Enter the company burden applied above an employee's base hourly rate. Use your actual payroll burden; Carez OS will not assume one.</p><form action={updateLaborBurden} className="form"><label className="field"><span>Labor Burden %</span><input name="labor_burden_percent" type="number" min="0" step="0.01" defaultValue={Number(company?.labor_burden_percent||0)}/></label><button className="button">Save Labor Setting</button></form></div>
 <div className="card section"><div className="title">Initial Setup</div><p className="subtitle">Press this once to add the current starter projects and crew. It is safe to press again.</p><SeedButton/></div><div className="card section"><div className="title">Signed In</div><div className="meta">{name} · {profile?.role||'owner'}</div><form action={signOut} style={{marginTop:14}}><button className="button secondary">Log Out</button></form></div></AppShell>;
}
