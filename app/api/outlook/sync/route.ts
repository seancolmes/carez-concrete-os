import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {outlookConfigured,syncOutlookMailbox} from '@/lib/outlook';

export const runtime='nodejs';

export async function POST(){
  if(!outlookConfigured())return NextResponse.json({configured:false,error:'Outlook is not configured'},{status:400});
  try{
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')return NextResponse.json({error:'Owner access required'},{status:403});
    const {data:connection}=await supabase.from('outlook_connections').select('*').eq('company_id',p.company_id).eq('status','active').maybeSingle();if(!connection)return NextResponse.json({error:'Connect Outlook first'},{status:400});
    const result=await syncOutlookMailbox(supabase,p.company_id,connection);return NextResponse.json({ok:true,...result});
  }catch(e:any){return NextResponse.json({error:e?.message||'Outlook sync failed'},{status:500});}
}
