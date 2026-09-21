import {notFound,redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {DesignReview} from './review';

// A branch-preview review surface, never a production application route.
export default async function DesignReviewPage(){
  if(process.env.VERCEL_ENV!=='preview')notFound();
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();
  if(!profile?.company_id||profile.role==='employee')notFound();
  return <DesignReview/>;
}
