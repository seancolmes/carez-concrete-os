import 'server-only';
import {cache} from 'react';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {timedFieldRead} from './readTiming';

// React cache is scoped to this server render, not shared between users/requests.
export const getFieldContext=cache(async()=>{
 const supabase=await createClient();
 const {data:{user}}=await timedFieldRead('auth',()=>supabase.auth.getUser());
 if(!user)redirect('/login');
 const {data:profile}=await timedFieldRead('profile',()=>supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single());
 if(!profile?.company_id)redirect('/login');
 if(profile.role==='employee')redirect('/employee');
 return {supabase,user,profile};
});
