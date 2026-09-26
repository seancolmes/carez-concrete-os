'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole, Terminal } from 'lucide-react';
import { loginLandingContent } from './loginLandingContent';
import { LoginForm } from '@/components/auth/LoginForm';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active || !user) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!active) return;
      router.replace(profile?.role === 'employee' ? '/employee' : '/');
      router.refresh();
    });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="carez-auth-shell">
      <div className="carez-auth-window">
        <header className="carez-auth-titlebar">
          <div className="carez-auth-brand"><Terminal aria-hidden="true"/><span>CAREZ // CONCRETE CONTRACTOR OS</span></div>
          <div className="carez-auth-access"><LockKeyhole aria-hidden="true"/><span>WORKSPACE ACCESS</span></div>
        </header>

        <div className="carez-auth-body">
          <section className="carez-auth-intro" aria-labelledby="login-headline">
            <div className="carez-auth-kicker">ENTERPRISE // BLUEPRINT &amp; POUR OPERATIONS</div>
            <div className="carez-auth-copy">
              <h1 id="login-headline">{loginLandingContent.headline}</h1>
              <p>{loginLandingContent.subheadline}</p>
              <div className="carez-auth-actions">
                {loginLandingContent.ctas.map((cta) => (
                  <Link
                    className={buttonVariants({
                      variant: cta.emphasis === 'primary' ? 'default' : 'outline',
                      size: 'sm',
                      className: cta.emphasis === 'primary' ? 'carez-auth-primary-action' : 'carez-auth-secondary-action',
                    })}
                    href={cta.href}
                    key={cta.href}
                  >
                    {cta.label}<ArrowRight aria-hidden="true"/>
                  </Link>
                ))}
              </div>
            </div>
            <footer className="carez-auth-capabilities" aria-label="Platform capabilities">
              {loginLandingContent.categories.map((category, index) => (
                <span key={category}>{index > 0 && <i aria-hidden="true">/</i>}{category}</span>
              ))}
            </footer>
          </section>

          <section className="carez-auth-form-panel" aria-label="Sign in">
            <div className="carez-auth-form-frame">
              <div className="carez-auth-form-label"><LockKeyhole aria-hidden="true"/>SECURE WORKSPACE SIGN IN</div>
              <LoginForm />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
