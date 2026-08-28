import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {EmployeeClockClient} from '@/components/employee/EmployeeClockClient';

export default async function EmployeePage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(profile?.role!=='employee')redirect('/');
 const {data,error}=await supabase.rpc('employee_portal_state');
 if(error)return <main className="login"><div className="login-card"><h1>Employee Clock</h1><div className="alert danger">{error.message}</div></div></main>;
 return <main className="employee-portal"><EmployeeClockClient initial={data}/></main>;
}
