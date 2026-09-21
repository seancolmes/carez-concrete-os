import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StructuralDraftingCanvas } from './StructuralDraftingCanvas';
import { loginLandingContent } from './loginLandingContent';
import { LoginForm } from '@/components/auth/LoginForm';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export default async function LoginPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(user){const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();redirect(profile?.role==='employee'?'/employee':'/');}
  return <main className="carez-login bg-neutral-950">
    <StructuralDraftingCanvas/>
    <section className="carez-login-intro lg:border-r border-neutral-900" aria-label="Carez">
      <header>CAREZ / PROJECT OPERATING SYSTEM</header>
      <div className="carez-login-heading">
        <h1>{loginLandingContent.headline}</h1>
        <p>{loginLandingContent.subheadline}</p>
        <div className="carez-login-actions">
          {loginLandingContent.ctas.map((cta)=><Link
            className={buttonVariants({
              variant:cta.emphasis==='primary'?'default':'outline',
              size:'lg',
              className:cta.emphasis==='secondary'?'carez-login-secondary-action':'carez-login-primary-action',
            })}
            href={cta.href}
            key={cta.href}
          >{cta.label}</Link>)}
        </div>
      </div>
    </section>
    <section className="carez-login-form" id="sign-in" aria-label="Sign in"><LoginForm/></section>
    <footer className="carez-login-capabilities border-t border-neutral-900 pt-4" aria-label="Platform capabilities">
      {loginLandingContent.categories.map((category,index)=><span key={category}>{index>0&&<i aria-hidden="true">/</i>}{category}</span>)}
    </footer>
  </main>;
}
