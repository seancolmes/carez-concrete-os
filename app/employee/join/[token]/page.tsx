import {redirect} from 'next/navigation';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {createClient} from '@/lib/supabase/server';
import {EmployeeJoinForm} from '@/components/employee/EmployeeJoinForm';

export default async function EmployeeJoinPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(user)redirect('/');
 const {data}=await supabase.rpc('employee_invite_preview',{p_token:token});

 if(!data)return <main className="flex min-h-dvh items-center justify-center bg-background p-4"><Card className="w-full max-w-md border-destructive/30"><CardHeader><CardTitle>Employee Invite</CardTitle><CardDescription>This invite cannot be used.</CardDescription></CardHeader><CardContent><div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">This invite is invalid, expired, or already used.</div></CardContent></Card></main>;

 return <main className="flex min-h-dvh items-center justify-center bg-background p-4"><Card className="w-full max-w-md"><CardHeader><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Carez Concrete</div><CardTitle>Set Up Your Time Clock</CardTitle><CardDescription>This login is for your Carez timecard, job clock, tasks and breaks.</CardDescription></CardHeader><CardContent><EmployeeJoinForm token={token} employeeName={data.employee_name}/></CardContent></Card></main>;
}
