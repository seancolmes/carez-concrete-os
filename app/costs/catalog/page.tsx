import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {CatalogPilot} from './CatalogPilot';

export default async function CostCatalogPage(){
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await db.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
  const {data:codes}=await db.from('cost_codes').select('id,code,name').eq('company_id',profile.company_id).eq('active',true).order('sort_order');
  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
    <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><div><h1>Cost catalog</h1><p className="mt-1 text-sm text-muted-foreground">Company cost items available to job cost and estimating workflows.</p></div><Link className="text-sm text-primary hover:underline" href="/costs">Job costs</Link></header>
    <CatalogPilot codes={codes||[]}/>
  </div></AppShell>;
}
