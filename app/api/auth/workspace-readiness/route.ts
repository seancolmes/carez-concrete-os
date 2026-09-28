import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

export async function GET(){
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({reason:'session'}, {status:401,headers:{'Cache-Control':'no-store'}});
  const {data:profile,error:profileError}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();
  if(profileError)return NextResponse.json({reason:'profile_error'}, {status:503,headers:{'Cache-Control':'no-store'}});
  if(!profile?.company_id)return NextResponse.json({reason:'company'}, {status:403,headers:{'Cache-Control':'no-store'}});
  return NextResponse.json({destination:profile.role==='employee'?'/employee':'/'},{headers:{'Cache-Control':'no-store'}});
}
