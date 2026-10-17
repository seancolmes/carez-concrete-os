import {redirect} from 'next/navigation';
import {BillingWorkspace} from '@/components/billing/BillingWorkspace';
import {createClient} from '@/lib/supabase/server';
import {buildBillingReadModel} from './billing-read-model';

export default async function BillingPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
  const [billing,invoices,retainage]=await Promise.all([
    supabase.from('project_billing_summary').select('project_id,job_number,name,original_contract_value,unbilled_contract,billed_amount,outstanding_ar,collected_amount').eq('company_id',profile.company_id),
    supabase.from('invoice_financial_summary').select('project_id,status,collection_status,balance_due').eq('company_id',profile.company_id),
    supabase.from('retainage_available_summary').select('available_to_release').eq('company_id',profile.company_id),
  ]);
  return <BillingWorkspace {...buildBillingReadModel({billing,invoices,retainage})}/>;
}
