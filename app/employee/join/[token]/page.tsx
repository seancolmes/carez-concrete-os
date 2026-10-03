import {redirect} from 'next/navigation';
import {Card,CardHeader} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/server';
import {EmployeeJoinForm} from '@/components/employee/EmployeeJoinForm';

export default async function EmployeeJoinPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(user)redirect('/');
 const {data}=await supabase.rpc('employee_invite_preview',{p_token:token});

 if(!data)return <main className="flex min-h-dvh items-center justify-center bg-background p-4"><Card className="w-full max-w-md border-destructive/30"><CardHeader><h3>Employee Invite</h3><p>This invite cannot be used.</p></CardHeader><div className="p-4"><div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">This invite is invalid, expired, or already used.</div></div></Card></main>;

 return <main className="flex min-h-dvh items-center justify-center bg-background p-4"><Card className="w-full max-w-md"><CardHeader><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">PourTrace</div><h3>Set Up Your Time Clock</h3><p>This login is for your timecard, job clock, tasks and breaks.</p></CardHeader><div className="p-4"><EmployeeJoinForm token={token} employeeName={data.employee_name}/></div></Card></main>;
}
