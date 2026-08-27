import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { SeedButton } from '@/components/SeedButton';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';

export default async function SettingsPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile,error}=await supabase.from('profiles').select('full_name,role,company_id').eq('id',user.id).maybeSingle();
 const [{data:tax},{data:risks}]=profile?.company_id?await Promise.all([
   supabase.from('labor_tax_settings').select('*').eq('company_id',profile.company_id).eq('tax_year',2026).maybeSingle(),
   supabase.from('li_risk_classes').select('code,name,employer_rate_per_hour').eq('company_id',profile.company_id).eq('tax_year',2026).eq('active',true).order('code')
 ]):[{data:null},{data:[]}];
 const name=profile?.full_name||user.email||'Owner';
 return <AppShell userName={name}><h1 className="page-title">Settings</h1><p className="subtitle">Company configuration and integrations.</p>
 <div className="card"><div className="list"><div className="row"><div><div className="title">Database</div><div className="meta">Supabase live database</div></div><span className="status">{!error&&profile?'Connected':'Setup Needed'}</span></div><div className="row"><div><div className="title">Authentication</div><div className="meta">Private owner login</div></div><span className="status">Enabled</span></div><div className="row"><div><div className="title">QuickBooks</div><div className="meta">Accounting integration after core workflow is stable</div></div><span className="status">Later</span></div></div></div>
 <div className="card section"><div className="title">2026 Labor Engine</div><p className="subtitle">The old single burden percentage is retired. Timecards now snapshot payroll taxes, L&I risk-class cost and sick-leave reserve.</p>{tax?<div className="list"><div className="row"><span>Employer Social Security</span><strong>{(Number(tax.social_security_rate)*100).toFixed(2)}%</strong></div><div className="row"><span>Employer Medicare</span><strong>{(Number(tax.medicare_rate)*100).toFixed(2)}%</strong></div><div className="row"><span>WA SUI / EAF</span><strong>{(Number(tax.wa_sui_rate)*100).toFixed(2)}%</strong></div><div className="row"><span>FUTA while applicable</span><strong>{(Number(tax.futa_rate)*100).toFixed(2)}%</strong></div><div className="row"><span>Sick leave accrual reserve</span><strong>1 hr / 40 hr</strong></div></div>:<div className="alert danger">2026 tax settings missing.</div>}
 <div className="list section">{(risks||[]).map(r=><div className="row" key={r.code}><div><div className="title">{r.code}</div><div className="meta">{r.name}</div></div><strong>${Number(r.employer_rate_per_hour).toFixed(5)}/hr ER</strong></div>)}</div></div>
 <div className="card section"><div className="title">Overhead & Pricing</div><p className="subtitle">Manage owner compensation, capacity, fleet and recurring overhead in the dedicated engine.</p><Link className="button" href="/overhead">Open Overhead Engine</Link></div>
 <div className="card section"><div className="title">Initial Setup</div><p className="subtitle">Press this once to add starter projects and crew. It is safe to press again.</p><SeedButton/></div><div className="card section"><div className="title">Signed In</div><div className="meta">{name} · {profile?.role||'owner'}</div><form action={signOut} style={{marginTop:14}}><button className="button secondary">Log Out</button></form></div></AppShell>;
}
