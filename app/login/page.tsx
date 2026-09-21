import { redirect } from 'next/navigation';
import { LoginSpatialBlueprint } from './LoginSpatialBlueprint';
import { GridPattern } from '@/components/ui/grid-pattern';
import { LoginForm } from '@/components/auth/LoginForm';
import { createClient } from '@/lib/supabase/server';

export default async function LoginPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(user){const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();redirect(profile?.role==='employee'?'/employee':'/');}
  return <main className="carez-login">
    <section className="carez-login-intro" aria-label="Carez Concrete OS">
      <GridPattern
        width={44}
        height={44}
        x={-1}
        y={-1}
        strokeDasharray="3 3"
        squares={[[2,3],[3,3],[4,3],[4,4],[4,5],[8,6],[9,6],[10,6],[10,7],[13,3],[13,4]]}
        className="carez-login-grid"
      />
      <span>CAREZ / CONCRETE OPERATIONS</span>
      <div className="carez-login-heading"><p>Built for the work.</p><h1>Plan precisely.<br/>Build confidently.</h1><p>One working record, from your first measurement to the final pour.</p></div>
      <LoginSpatialBlueprint/>
      <footer>Takeoff <span aria-hidden="true">/</span> Estimating <span aria-hidden="true">/</span> Field <span aria-hidden="true">/</span> Finance</footer>
    </section>
    <section className="carez-login-form" aria-label="Sign in"><LoginForm/></section>
  </main>;
}
