import type {Metadata} from 'next';
import Link from 'next/link';
import {CompanySignupForm} from '@/components/auth/CompanySignupForm';
import {BrandLogo} from '@/components/brand/BrandLogo';

export const metadata:Metadata={title:'Workspace enrollment | Pourtrace'};

export default async function SignupPage({searchParams}:{searchParams:Promise<{confirmation?:string}>}){
  const {confirmation}=await searchParams;
  const timezones=['UTC',...Intl.supportedValuesOf('timeZone')];
  return <main className="min-h-svh bg-[var(--pt-bg)] text-[var(--pt-text)]">
    <header className="border-b border-[var(--pt-line)] bg-[var(--pt-shell)] px-6 py-4 sm:px-10">
      <Link href="/login" className="inline-flex items-center focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--pt-brand)]" aria-label="Pourtrace home"><BrandLogo size="sm" idPrefix="signup-navigation"/></Link>
    </header>
    <section className="mx-auto flex min-h-[calc(100svh-65px)] max-w-3xl flex-col justify-center px-6 py-16 sm:px-10" aria-labelledby="signup-heading">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-[var(--pt-text-muted)]">Workspace enrollment</p>
      <h1 id="signup-heading" className="max-w-2xl font-sans text-4xl font-bold tracking-tight sm:text-5xl">One workspace for your whole company.</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Create your company workspace, then add your own people, jobs, drawings and financial settings.</p>
      <div className="mt-6 w-full max-w-lg"><CompanySignupForm timezones={timezones} confirmationFailed={confirmation==='failed'}/></div>
    </section>
  </main>;
}
