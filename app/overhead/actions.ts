'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {confirmItemUpdate, parseItemValues, parsePlanValues, persistPlan, type SaveState} from './save-contract';

async function company(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');
  const {data:profile,error}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(error||!profile?.company_id)throw new Error('Company profile unavailable.');
  return {supabase,companyId:profile.company_id};
}

const failure = (error: unknown): SaveState => ({status:'error', message:error instanceof Error?error.message:'The change could not be saved.'});

export async function updateOverheadItem(_previous:SaveState, formData:FormData):Promise<SaveState>{
  try {
    const values=parseItemValues(formData);
    const {supabase,companyId}=await company();
    await confirmItemUpdate(values.id,async()=>supabase.from('overhead_items').update({
      amount:values.amount,business_use_percent:values.business_use_percent,active:values.active,
    }).eq('id',values.id).eq('company_id',companyId).select('id').maybeSingle());
    revalidatePath('/overhead');
    return {status:'saved',message:'Overhead item saved.'};
  } catch(error) { return failure(error); }
}

export async function updateOverheadPlan(_previous:SaveState, formData:FormData):Promise<SaveState>{
  try {
    const values=parsePlanValues(formData),requestId=String(formData.get('request_id')||''),revision=String(formData.get('expected_revision')||'');
    const {supabase,companyId}=await company();
    await persistPlan(companyId,values,requestId,revision,async args=>supabase.rpc('carez_save_company_plan',args));
    revalidatePath('/overhead');revalidatePath('/field');revalidatePath('/projects');revalidatePath('/crew');
    return {status:'saved',message:'Business plan and owner field rates saved.'};
  } catch(error) {return failure(error);}
}
