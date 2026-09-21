import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { createClient } from '@/lib/supabase/server';

export default async function LoginPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(user){const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();redirect(profile?.role==='employee'?'/employee':'/');}
  return <main className="carez-login">
    <section className="carez-login-intro" aria-label="Carez Concrete OS"><span>CAREZ / CONCRETE OPERATIONS</span><div><p>Built for the work.</p><h1>Plan precisely.<br/>Build confidently.</h1><p>One working record, from your first measurement to the final pour.</p></div><footer>TAKEOFF · ESTIMATING · FIELD · FINANCE</footer></section>
    <section className="carez-login-form" aria-label="Sign in"><LoginForm/></section>
  </main>;
}
