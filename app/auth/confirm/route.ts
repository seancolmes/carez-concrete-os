import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

export async function GET(request:Request){
 const url=new URL(request.url),client=await createClient();const code=url.searchParams.get('code');
 if(!code)return NextResponse.redirect(new URL('/signup?confirmation=failed',url.origin));
 const result=await client.auth.exchangeCodeForSession(code);
 if(result.error||!result.data.user)return NextResponse.redirect(new URL('/signup?confirmation=failed',url.origin));
 const profile=await client.from('profiles').select('company_id,role').eq('id',result.data.user.id).maybeSingle();
 if(profile.error||!profile.data?.company_id)return NextResponse.redirect(new URL('/login',url.origin));
 // No arbitrary return URL or metadata role is accepted from an email link.
 return NextResponse.redirect(new URL(profile.data.role==='employee'?'/employee':'/dashboard',url.origin));
}
