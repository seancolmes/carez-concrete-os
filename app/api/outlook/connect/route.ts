import crypto from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {outlookAuthorizeUrl,outlookConfigured} from '@/lib/outlook';
import {providerMutationAllowed,PROVIDER_MUTATION_DENIED_MESSAGE} from '@/lib/provider-mutation-policy';

export const runtime='nodejs';

export async function GET(req:NextRequest){
  if(!providerMutationAllowed())return NextResponse.json({error:PROVIDER_MUTATION_DENIED_MESSAGE},{status:403});
  if(!outlookConfigured())return NextResponse.redirect(new URL('/leads/inbox?error=outlook_not_configured',req.url));
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.redirect(new URL('/login',req.url));
  const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')return NextResponse.redirect(new URL('/',req.url));
  const state=crypto.randomBytes(24).toString('hex'),origin=new URL(req.url).origin;
  const res=NextResponse.redirect(outlookAuthorizeUrl(origin,state));
  res.cookies.set('carez_outlook_oauth_state',state,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});
  return res;
}
