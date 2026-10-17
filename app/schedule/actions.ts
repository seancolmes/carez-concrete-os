'use server';
import {revalidateFieldWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import {createClient} from '@/lib/supabase/server';
import {scheduleCommand,type ScheduleCommand,type ScheduleFormState} from '@/lib/field/scheduleCommand';
const refresh=()=>{for(const path of ['/schedule','/readiness','/readiness/resources','/look-ahead','/projects','/employee','/production','/production/work-packages','/'])revalidatePath(path);};
async function execute(form:FormData,command:ScheduleCommand){
 const {requestId,payload}=scheduleCommand(form,command);
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in before changing the schedule.');
 const {data,error}=await supabase.rpc('carez_schedule_command_v1',{p_request_id:requestId,p_command:command,p_payload:payload});
 if(error||!data?.ok||!data?.id)throw new Error(error?.message||'The schedule save was not confirmed. Retry the same request.');
 refresh();
}
export async function createScheduleItem(_state:ScheduleFormState,form:FormData):Promise<ScheduleFormState>{
 try{await execute(form,'create');return{status:'saved',message:'Scheduled work and crew assignments saved.'};}
 catch(error){return{status:'error',message:error instanceof Error?error.message:'Scheduling is unavailable. Retry this same form.'};}
}
export async function updateScheduleStatus(form:FormData){await execute(form,'status');}
export async function deleteScheduleItem(form:FormData){await execute(form,'delete');}
export async function rescheduleScheduleItem(form:FormData){await execute(form,'reschedule');}
