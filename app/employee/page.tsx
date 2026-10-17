import {redirect} from 'next/navigation';
import {Button,Card,CardHeader} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/server';
import {EmployeeClockClient} from '@/components/employee/EmployeeClockClient';
import {signOut} from '@/app/settings/actions';

export default async function EmployeePage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(profile?.role!=='employee')redirect('/');
 const {data,error}=await supabase.rpc('employee_portal_state');
 return <main className="min-h-dvh bg-background text-foreground"><header aria-label="Employee session controls" className="flex items-center justify-end gap-3 border-b border-border px-4 py-2"><form action={signOut}><Button type="submit" appearance="outline" size="small">Sign out</Button></form></header>{error?<div className="px-4 py-8"><Card className="mx-auto max-w-lg border-destructive/30"><CardHeader header={<h3>Employee Clock</h3>}/><div className="p-4"><div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">{error.message}</div></div></Card></div>:<EmployeeClockClient initial={data}/>}</main>;
}
