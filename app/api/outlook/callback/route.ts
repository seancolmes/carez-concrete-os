import crypto from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createOutlookSubscription,encryptOutlookToken,exchangeOutlookCode,graphRequest,syncOutlookMailbox} from '@/lib/outlook';

export const runtime='nodejs';

export async function GET(req:NextRequest){
  const url=new URL(req.url),origin=url.origin,error=url.searchParams.get('error'),code=url.searchParams.get('code'),state=url.searchParams.get('state');
  if(error)return NextResponse.redirect(new URL(`/leads/inbox?error=${encodeURIComponent(error)}`,origin));
  const expected=req.cookies.get('carez_outlook_oauth_state')?.value;
  if(!code||!state||!expected||state!==expected)return NextResponse.redirect(new URL('/leads/inbox?error=outlook_state_mismatch',origin));
  try{
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.redirect(new URL('/login',origin));
    const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');
    const tokens:any=await exchangeOutlookCode(code,origin);if(!tokens.refresh_token)throw new Error('Microsoft did not return an offline refresh token.');
    const me:any=await graphRequest(tokens.access_token,'/me?$select=id,displayName,mail,userPrincipalName');
    const access=encryptOutlookToken(tokens.access_token),refresh=encryptOutlookToken(tokens.refresh_token),expiresAt=new Date(Date.now()+Number(tokens.expires_in||3600)*1000).toISOString();
    const clientState=crypto.randomBytes(32).toString('hex');let subscription:any=null,subscriptionError:string|null=null;
    try{subscription=await createOutlookSubscription(tokens.access_token,origin,clientState);}catch(e:any){subscriptionError=e?.message||'Could not start Outlook background notifications.';}
    const row={company_id:p.company_id,microsoft_user_id:me.id||null,mailbox_email:me.mail||me.userPrincipalName||null,mailbox_name:me.displayName||null,access_token_ciphertext:access.ciphertext,access_token_iv:access.iv,access_token_auth_tag:access.authTag,refresh_token_ciphertext:refresh.ciphertext,refresh_token_iv:refresh.iv,refresh_token_auth_tag:refresh.authTag,token_expires_at:expiresAt,subscription_id:subscription?.id||null,subscription_client_state:subscription?.id?clientState:null,subscription_expires_at:subscription?.expirationDateTime||null,last_error:subscriptionError,status:'active',created_by:user.id,updated_at:new Date().toISOString()};
    const {data:connection,error:saveError}=await supabase.from('outlook_connections').upsert(row,{onConflict:'company_id'}).select('*').single();if(saveError||!connection)throw new Error(saveError?.message||'Could not save Outlook connection.');
    try{await syncOutlookMailbox(supabase,p.company_id,connection);}catch(e:any){await supabase.from('outlook_connections').update({last_error:e?.message||'Initial Outlook sync failed',updated_at:new Date().toISOString()}).eq('id',connection.id);}
    const res=NextResponse.redirect(new URL('/leads/inbox?connected=1',origin));res.cookies.delete('carez_outlook_oauth_state');return res;
  }catch(e:any){return NextResponse.redirect(new URL(`/leads/inbox?error=${encodeURIComponent(e?.message||'outlook_connect_failed')}`,origin));}
}
