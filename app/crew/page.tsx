import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
export default async function CrewPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const [{data:profile},{data:crew}]=await Promise.all([supabase.from('profiles').select('full_name').eq('id',user.id).maybeSingle(),supabase.from('crew_members').select('*').order('name')]);
 return <AppShell userName={profile?.full_name||user.email||'Owner'}><h1 className="page-title">Crew</h1><p className="subtitle">Core employees and future on-call finishers.</p><div className="card"><div className="list">{(crew||[]).length===0&&<div className="meta">No crew records yet. Open Settings and load starter data.</div>}{(crew||[]).map(c=><div className="row" key={c.id}><div><div className="title">{c.name}</div><div className="meta">{c.role} · {c.employment_type.replace('_',' ')}{c.hourly_rate?` · $${Number(c.hourly_rate).toFixed(2)}/hr`:''}</div></div><span className="status">{c.available?'Available':'Unavailable'}</span></div>)}</div></div><div className="alert warn"><strong>Next crew feature:</strong> On-call finisher bench with skills, ratings, rates and one-tap call/text.</div></AppShell>;
}
