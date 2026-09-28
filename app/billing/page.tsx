import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {BillingWorkspace,type BillingRow} from '@/components/billing/BillingWorkspace';
import {createClient} from '@/lib/supabase/server';

const num=(value:unknown)=>Number(value||0);

export default async function BillingPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
  const [{data:billing},{data:invoices},{data:retainage}]=await Promise.all([
    supabase.from('project_billing_summary').select('*'),
    supabase.from('invoice_financial_summary').select('*').eq('company_id',profile.company_id),
    supabase.from('retainage_available_summary').select('*').eq('company_id',profile.company_id),
  ]);
  const source=billing||[];
  const rows:BillingRow[]=source.map(row=>({
    project_id:String(row.project_id),job_number:row.job_number,name:row.name,
    authorized_contract:num(row.authorized_contract),unbilled_contract:num(row.unbilled_contract),
    billed_contract:num(row.billed_contract),outstanding_ar:num(row.outstanding_ar),
    overdue_ar:num(row.overdue_ar),cash_collected:num(row.cash_collected),
  }));
  const summary={
    owed:source.reduce((sum,row)=>sum+num(row.outstanding_ar),0),
    late:source.reduce((sum,row)=>sum+num(row.overdue_ar),0),
    unbilled:source.reduce((sum,row)=>sum+num(row.unbilled_contract),0),
    collected:source.reduce((sum,row)=>sum+num(row.cash_collected),0),
    retainage:(retainage||[]).reduce((sum,row)=>sum+num(row.available_to_release),0),
    drafts:(invoices||[]).filter(row=>row.status==='draft').length,
  };
  return <AppShell userName={profile.full_name||user.email||'Owner'}><BillingWorkspace rows={rows} summary={summary}/></AppShell>;
}
