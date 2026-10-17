'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type CalendarState={status:'idle'|'saved'|'error';message:string};
export async function saveOperatingCalendar(_prior:CalendarState,form:FormData):Promise<CalendarState>{
 try{
  const request=String(form.get('calendar_request_id')||'');
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(request))throw new Error('Reload the calendar form before saving.');
  const project=String(form.get('project_id')||'').trim()||null;
  const zone=String(form.get('operating_timezone')||'').trim()||null;
  const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sign in before saving the calendar.');
  const {data,error}=await client.rpc('carez_set_operating_calendar',{p_request_id:request,p_timezone:zone,p_project_id:project});
  if(error||!data?.id)throw new Error(error?.message||'Calendar save was not confirmed. Retry the same form.');
  for(const path of ['/settings','/crew','/employee','/field'])revalidatePath(path);
  if(project)revalidatePath(`/job-setup/${project}`);
  return{status:'saved',message:'Calendar saved for future shifts. Recorded work dates and costs were preserved.'};
 }catch(error){return{status:'error',message:error instanceof Error?error.message:'Calendar save is unavailable. Retry this same form.'};}
}
