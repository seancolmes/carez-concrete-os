import {redirect} from 'next/navigation';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {createClient} from '@/lib/supabase/server';
import {EmployeeClockClient} from '@/components/employee/EmployeeClockClient';

export default async function EmployeePage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(profile?.role!=='employee')redirect('/');
 const {data,error}=await supabase.rpc('employee_portal_state');
 if(error)return <main className="min-h-dvh bg-background px-4 py-8"><Card className="mx-auto max-w-lg border-destructive/30"><CardHeader><CardTitle>Employee Clock</CardTitle></CardHeader><CardContent><div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">{error.message}</div></CardContent></Card></main>;
 return <main className="min-h-dvh bg-background"><EmployeeClockClient initial={data}/></main>;
}
