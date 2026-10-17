import type {Metadata} from 'next';
import {PasswordRecoveryRequest} from '@/components/auth/PasswordRecoveryForm';
import {recoveryConfiguration} from '@/lib/auth/recovery.server';
export const metadata:Metadata={title:'Reset password | PourTrace',robots:{index:false,follow:false}};
export default async function ForgotPasswordPage({searchParams}:{searchParams:Promise<{recovery?:string}>}){
 let available=true;try{recoveryConfiguration();}catch{available=false;}
 const {recovery}=await searchParams;
 return <main className="flex min-h-svh items-center justify-center bg-background px-5 py-10"><section className="grid w-full max-w-md gap-5 rounded-lg border border-border bg-card p-6"><div><p className="text-xs font-semibold text-primary">PourTrace</p><h1 className="mt-2 text-2xl font-semibold">Get back into your workspace.</h1><p className="mt-2 text-sm text-muted-foreground">Request a private link to reset your account password.</p></div>{recovery==='failed'?<p role="alert" className="text-sm text-destructive">This link is invalid, expired, already used, or was opened in a different browser. Request a new link.</p>:null}<PasswordRecoveryRequest available={available}/></section></main>;
}
