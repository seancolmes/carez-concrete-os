'use server';

import {createClient} from '@/lib/supabase/server';

export async function signInToWorkspace(email:string,password:string):Promise<{destination?:string;error?:'credentials'|'company'|'profile';authCode?:string;authMessage?:string}>{
  const supabase=await createClient();
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error)return{error:'credentials',authCode:error.code||String(error.status||'auth_error'),authMessage:error.message};
  if(!data.user)return{error:'credentials',authCode:'no_user',authMessage:'The authentication service returned no user.'};
  const {data:profile,error:profileError}=await supabase.from('profiles').select('company_id,role').eq('id',data.user.id).maybeSingle();
  if(profileError)return{error:'profile'};
  if(!profile?.company_id)return{error:'company'};
  return{destination:profile.role==='employee'?'/employee':'/'};
}
