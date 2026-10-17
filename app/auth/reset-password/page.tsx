import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import Link from 'next/link';
import {PasswordRecoveryReset} from '@/components/auth/PasswordRecoveryForm';
import {createRecoveryClient,recoveryConfiguration} from '@/lib/auth/recovery.server';
import {RECOVERY_RESET_COOKIE} from '@/lib/auth/recoveryContext';
import {verifiedResetContext} from '@/lib/auth/recoveryFlow';
export const metadata:Metadata={title:'Choose new password | PourTrace',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function ResetPasswordPage(){
 let verified=false;
 try{const {key}=recoveryConfiguration(),store=await cookies();await verifiedResetContext(await createRecoveryClient(),store.get(RECOVERY_RESET_COOKIE)?.value,key);verified=true;}catch{/* Ordinary sessions do not establish recovery authority. */}
 return <main className="flex min-h-svh items-center justify-center bg-background px-5 py-10"><section className="grid w-full max-w-md gap-5 rounded-lg border border-border bg-card p-6"><div><p className="text-xs font-semibold text-primary">PourTrace</p><h1 className="mt-2 text-2xl font-semibold">Choose your new password.</h1></div>{verified?<PasswordRecoveryReset/>:<div className="grid gap-4"><p role="status" className="text-sm text-muted-foreground">A current verified password-reset link is required. Your normal sign-in session cannot replace it.</p><Link href="/auth/forgot-password" className="text-sm underline">Request a password-reset link</Link><Link href="/login" className="text-sm underline">Return to sign in</Link></div>}</section></main>;
}
