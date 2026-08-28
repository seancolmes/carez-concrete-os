import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {EmployeeJoinForm} from '@/components/employee/EmployeeJoinForm';

export default async function EmployeeJoinPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(user)redirect('/');
 const {data}=await supabase.rpc('employee_invite_preview',{p_token:token});
 if(!data)return <main className="login"><div className="login-card"><h1>Employee Invite</h1><div className="alert danger">This invite is invalid, expired, or already used.</div></div></main>;
 return <main className="login"><div className="login-card"><div className="brand">CAREZ CONCRETE</div><h1>Set Up Your Time Clock</h1><p>This login is for your Carez timecard, job clock, tasks and breaks.</p><EmployeeJoinForm token={token} employeeName={data.employee_name}/></div></main>;
}
