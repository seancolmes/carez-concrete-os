'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Crosshair } from 'lucide-react';
import { StructuralDraftingCanvas } from './StructuralDraftingCanvas';
import { loginLandingContent } from './loginLandingContent';
import { LoginForm } from '@/components/auth/LoginForm';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [coords, setCoords] = useState({ x: 0, y: 0 });

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

  useEffect(() => {
    let frame = 0;
    let pending = { x: 0, y: 0 };

    const handleMouseMove = (event: MouseEvent) => {
      pending = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        setCoords(pending);
        frame = 0;
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className="relative grid min-h-screen w-full grid-cols-1 bg-neutral-950 font-sans text-white select-none overflow-x-hidden lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)_auto] lg:overflow-hidden">
      <StructuralDraftingCanvas />

      <div
        className="pointer-events-none absolute z-0 hidden h-full w-px bg-cyan-500/5 transition-all duration-75 lg:block"
        style={{ left: `${coords.x}px`, top: 0 }}
      />
      <div
        className="pointer-events-none absolute z-0 hidden h-px w-full bg-cyan-500/5 transition-all duration-75 lg:block"
        style={{ top: `${coords.y}px`, left: 0 }}
      />

      <section className="relative z-10 flex h-full min-h-[50vh] w-full flex-col justify-between p-8 sm:p-12 md:p-16 lg:min-h-0 lg:border-r border-neutral-900 lg:p-24">
        <header className="flex w-full items-center justify-between font-mono text-[10px] tracking-widest text-neutral-500">
          <span className="font-semibold text-neutral-400">CAREZ // PROJECT OPERATING SYSTEM</span>
          <span className="hidden items-center gap-1.5 rounded border border-neutral-800/60 bg-neutral-900/40 px-2 py-0.5 font-mono text-[9px] text-cyan-400 sm:flex">
            <Crosshair size={9} className="animate-spin" style={{ animationDuration: '6s' }} />
            X:{coords.x.toFixed(0)} Y:{coords.y.toFixed(0)}
          </span>
        </header>

        <div className="my-auto flex max-w-xl flex-col justify-center space-y-5 py-12 text-left lg:py-0">
          <div className="inline-flex w-fit items-center gap-1.5 rounded border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-emerald-400">
            <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
            SYS // OPTIMAL_YIELD_ENGINE
          </div>

          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-100 sm:text-4xl lg:text-[40px]">
            {loginLandingContent.headline}
          </h1>

          <p className="max-w-md text-sm leading-relaxed text-neutral-400">
            {loginLandingContent.subheadline}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {loginLandingContent.ctas.map((cta) => (
              <Link
                className={buttonVariants({
                  variant: cta.emphasis === 'primary' ? 'default' : 'outline',
                  size: 'default',
                  className:
                    cta.emphasis === 'primary'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-2 transition-all duration-200 cursor-pointer shadow-lg shadow-blue-950/40'
                      : 'border-neutral-800 text-neutral-300 hover:bg-neutral-900 font-medium text-xs px-4 py-2 transition-all duration-200 cursor-pointer',
                })}
                href={cta.href}
                key={cta.href}
              >
                {cta.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative z-10 flex h-full min-h-[50vh] w-full items-center justify-center bg-neutral-950 p-8 sm:p-12 md:p-16 lg:min-h-0 lg:p-24"
        id="sign-in"
        aria-label="Sign in"
      >
        <div className="pointer-events-auto w-full max-w-sm">
          <LoginForm />
        </div>
      </section>

      <footer
        className="relative z-10 w-full border-t border-neutral-900 pt-4 pb-6 px-8 sm:px-12 md:px-16 lg:col-span-2 lg:px-24 bg-neutral-950/90 font-mono text-[10px] tracking-wider text-neutral-500 flex flex-wrap gap-x-2 gap-y-1"
        aria-label="Platform capabilities"
      >
        {loginLandingContent.categories.map((category, index) => (
          <span key={category} className="text-neutral-500">
            {index > 0 && <i aria-hidden="true" className="mx-2 font-normal text-neutral-800">/</i>}
            {category}
          </span>
        ))}
      </footer>
    </main>
  );
}
