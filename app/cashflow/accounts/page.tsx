import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {addCashAccount,recordCashBalance} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const today=()=>new Date().toISOString().slice(0,10);
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function CashAccountsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:accounts},{data:balances},{data:plaid}]=await Promise.all([
    supabase.from('company_cash_accounts').select('*').eq('company_id',p.company_id).order('active',{ascending:false}).order('name'),
    supabase.from('company_cash_balance_snapshots').select('*').eq('company_id',p.company_id).order('balance_date',{ascending:false}).order('created_at',{ascending:false}),
    supabase.from('plaid_bank_account_summary').select('*').eq('company_id',p.company_id),
  ]);

  const latest=new Map<string,any>();
  for(const b of balances||[])if(!latest.has(b.cash_account_id))latest.set(b.cash_account_id,b);
  const connected=(plaid||[]).filter((a:any)=>a.include_in_cash!==false&&a.active!==false);
  const manualActive=(accounts||[]).filter((a:any)=>a.active);

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Finance</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Cash Accounts</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Plaid-connected bank accounts should normally update Carez automatically. Manual cash accounts are only the fallback for cash or accounts we cannot connect.</p></header>
      <div className="flex flex-wrap gap-2"><Link className={buttonVariants()} href="/banking">Connected Banking</Link><Link className={buttonVariants({variant:'outline'})} href="/cashflow">Back to Cash</Link></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <Card size="sm"><CardContent className={`h-full space-y-1 ${connected.length?'text-success':'text-warning'}`}><div className="text-xs font-medium text-muted-foreground">Connected Bank Accounts</div><div className="text-2xl font-semibold tabular-nums">{connected.length}</div><div className="text-xs text-muted-foreground">Preferred source for current balances.</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Manual Accounts</div><div className="text-2xl font-semibold tabular-nums">{manualActive.length}</div><div className="text-xs text-muted-foreground">Use for cash or unsupported accounts only.</div></CardContent></Card>
    </div>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card><CardContent className="space-y-4"><div><h2 className="font-semibold">Add Manual Account</h2><p className="mt-1 text-sm text-muted-foreground">Do not duplicate an account that is already connected through Banking.</p></div><form action={addCashAccount} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="cash-account-name">Account Name</Label><Input id="cash-account-name" name="name" required placeholder="Petty Cash"/></div>
        <div className="grid gap-2"><Label htmlFor="cash-account-type">Type</Label><select id="cash-account-type" className={selectClass} name="account_type"><option value="cash">Cash</option><option value="checking">Checking</option><option value="savings">Savings</option><option value="other">Other</option></select></div>
        <div className="grid gap-2"><Label htmlFor="cash-account-note">Note</Label><Input id="cash-account-note" name="notes"/></div>
        <Button type="submit" className="w-fit">Add Manual Account</Button>
      </form></CardContent></Card>

      <Card><CardContent className="space-y-4"><div><h2 className="font-semibold">Update Manual Balance</h2><p className="mt-1 text-sm text-muted-foreground">Only needed when Carez cannot read the balance automatically.</p></div><form action={recordCashBalance} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="cash-balance-account">Account</Label><select id="cash-balance-account" className={selectClass} name="cash_account_id" required defaultValue=""><option value="" disabled>Choose account</option>{manualActive.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="cash-balance-date">Date</Label><Input id="cash-balance-date" type="date" name="balance_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor="cash-balance-value">Current Balance</Label><Input id="cash-balance-value" type="number" step="0.01" name="balance" required/></div></div>
        <div className="grid gap-2"><Label htmlFor="cash-balance-note">Note</Label><Input id="cash-balance-note" name="notes"/></div>
        <Button type="submit" className="w-fit">Save Balance</Button>
      </form></CardContent></Card>
    </section>

    <section className="space-y-4" aria-labelledby="manual-account-balances">
      <div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manual cash</div><h2 id="manual-account-balances" className="mt-1 text-lg font-semibold">Manual Account Balances</h2></div>
      {(accounts||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No manual cash accounts</EmptyTitle><EmptyDescription>That is fine if all Carez accounts are connected through Banking.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-3">{(accounts||[]).map((a:any)=>{const b=latest.get(a.id);return <Card key={a.id}><CardContent className="space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-semibold">{a.name}</div><div className="mt-1 text-sm text-muted-foreground">{a.account_type} · {a.active?'active':'inactive'}</div></div><strong className="tabular-nums">{b?money(b.balance):'No Balance'}</strong></div>{b&&<div className="border-t border-border pt-3 text-sm text-muted-foreground">Balance entered {b.balance_date}</div>}</CardContent></Card>})}</div>}
    </section>
  </div></AppShell>;
}
