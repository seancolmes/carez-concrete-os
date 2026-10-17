import {redirect} from 'next/navigation';
import {Card,CardHeader} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/server';
import {EmployeeJoinForm} from '@/components/employee/EmployeeJoinForm';

export default async function EmployeeJoinPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(user)redirect('/');
 const {data,error}=await supabase.rpc('employee_invite_preview',{p_token:token});

 if(error)return <main className="flex min-h-dvh items-center justify-center bg-background p-4"><Card className="w-full max-w-md"><CardHeader header={<h1 className="text-lg font-semibold">Employee invite unavailable</h1>} description="The invite could not be checked. Retry after the connection recovers; this does not establish that the invitation is invalid."/><a href="/login" className="underline">Return to sign in</a></Card></main>;
 if(!data)return <main className="flex min-h-dvh items-center justify-center bg-background p-4"><Card className="w-full max-w-md border-destructive/30"><CardHeader header={<h1 className="text-lg font-semibold">Employee invite</h1>} description="This invite cannot be used."/><div className="p-4"><div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">This invite is invalid, expired, or already used.</div></div></Card></main>;

 return <main className="flex min-h-dvh items-center justify-center bg-background p-4"><Card className="w-full max-w-md"><CardHeader header={<h1 className="text-lg font-semibold">Set up your PourTrace time clock</h1>} description="This login is for your timecard, job clock, tasks and breaks."/><div className="p-4"><EmployeeJoinForm token={token} employeeName={data.employee_name}/></div></Card></main>;
}
