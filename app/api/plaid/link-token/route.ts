import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidPost } from '@/lib/plaid';
import {providerMutationAllowed,PROVIDER_MUTATION_DENIED_MESSAGE} from '@/lib/provider-mutation-policy';

export const runtime='nodejs';
export async function POST(req:NextRequest){
  if(!providerMutationAllowed())return NextResponse.json({error:PROVIDER_MUTATION_DENIED_MESSAGE},{status:403});
  try{
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();if(!profile?.company_id)return NextResponse.json({error:'Company profile missing'},{status:400});
    const origin=new URL(req.url).origin;
    const data:any=await plaidPost('/link/token/create',{user:{client_user_id:user.id},client_name:'Carez Concrete',products:['transactions'],country_codes:['US'],language:'en',webhook:`${origin}/api/plaid/webhook`,transactions:{days_requested:730}});
    return NextResponse.json({link_token:data.link_token,expiration:data.expiration});
  }catch(e:any){return NextResponse.json({error:e?.message||'Unable to create Plaid Link session'},{status:500});}
}
