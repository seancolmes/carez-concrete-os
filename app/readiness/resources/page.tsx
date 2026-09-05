import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {ResourceReadinessWorkspace} from '@/components/readiness/ResourceReadinessWorkspace';
import {createClient} from '@/lib/supabase/server';

export default async function ResourceReadinessPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;

  const [{data:resources},{data:ops},{data:inventory},{data:equipment},{data:vendors},{data:poLines}]=await Promise.all([
    supabase.from('work_package_resource_requirement_status').select('*').eq('company_id',companyId).order('need_by_date',{ascending:true,nullsFirst:false}).order('label'),
    supabase.from('work_package_start_readiness').select('*').eq('company_id',companyId).in('operation_status',['planned','in_progress','on_hold']).order('job_number').order('package_name').order('sequence'),
    supabase.from('inventory_items').select('id,name,unit,quantity_on_hand,storage_location').eq('company_id',companyId).eq('active',true).order('name'),
    supabase.from('equipment_assets').select('id,asset_number,name,status,next_service_date').eq('company_id',companyId).eq('active',true).order('name'),
    supabase.from('vendors').select('id,name,vendor_type').eq('company_id',companyId).eq('active',true).order('name'),
    supabase.from('purchase_order_lines').select('id,description,quantity,unit,work_package_operation_id,purchase_orders!inner(po_number,status,project_id,expected_delivery_date)').eq('company_id',companyId).in('purchase_orders.status',['draft','issued']).order('created_at',{ascending:false}),
  ]);

  const operations=ops||[];
  const byOperation=new Map<string,any>();
  for(const operation of operations)byOperation.set(operation.operation_id,operation);
  const rows=(resources||[]).map((resource:any)=>{
    const operation=byOperation.get(resource.work_package_operation_id)||{};
    return {...resource,job_number:operation.job_number||'',package_name:operation.package_name||'',field_label:operation.field_label||'',task_name:operation.task_name||'',operation_status:operation.operation_status||''};
  });
  const lines=(poLines||[]).map((line:any)=>({...line,purchase_order_number:line.purchase_orders?.po_number||''}));
  const today=new Date().toISOString().slice(0,10);
  const plus7=new Date(Date.now()+7*86400000).toISOString().slice(0,10);

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <ResourceReadinessWorkspace rows={rows} operations={operations} inventory={inventory||[]} equipment={equipment||[]} vendors={vendors||[]} poLines={lines} today={today} plus7={plus7}/>
  </AppShell>;
}
