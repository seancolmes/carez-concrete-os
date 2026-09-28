import type {Metadata} from 'next';
import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {BrandLogo} from '@/components/brand/BrandLogo';

export const metadata:Metadata={title:'Workspace enrollment | Pourtrace'};

export default function SignupPage(){
  return <main className="min-h-svh bg-[var(--pt-bg)] text-[var(--pt-text)]">
    <header className="border-b border-[var(--pt-line)] bg-[var(--pt-shell)] px-6 py-4 sm:px-10">
      <Link href="/login" className="inline-flex items-center focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--pt-brand)]" aria-label="Pourtrace home"><BrandLogo size="sm"/></Link>
    </header>
    <section className="mx-auto flex min-h-[calc(100svh-65px)] max-w-3xl flex-col justify-center px-6 py-16 sm:px-10" aria-labelledby="signup-heading">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-[var(--pt-text-muted)]">Workspace enrollment</p>
      <h1 id="signup-heading" className="max-w-2xl font-sans text-4xl font-bold tracking-tight sm:text-5xl">One workspace for your whole company.</h1>
      <p className="mt-6 max-w-xl text-base leading-7 text-[var(--pt-text-secondary)]">Pourtrace is being prepared for monthly and annual subscriptions. Self-service enrollment is not available yet, so you cannot create a workspace or start a subscription on this page today.</p>
      <div className="mt-8 border-t border-[var(--pt-line)] pt-6">
        <p className="text-sm text-[var(--pt-text-secondary)]">Already have a workspace?</p>
        <Link href="/login" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--pt-brand)] hover:underline focus-visible:underline"><ArrowLeft size={16} aria-hidden="true"/> Return to sign in</Link>
      </div>
    </section>
  </main>;
}
