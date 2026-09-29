import {redirect} from 'next/navigation';
import Link from 'next/link';
import {Button,buttonVariants} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {addCashAccount,recordCashBalance} from '@/app/cashflow/actions';

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

  return <><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
    <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Cash accounts</h1><div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/banking">Connected banking</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/cashflow">Cash flow</Link><Dialog><DialogTrigger render={<Button variant="outline" size="sm"/>}>Update balance</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Update manual balance</DialogTitle><DialogDescription>Use for cash or an account that cannot be connected to Banking.</DialogDescription></DialogHeader><form action={recordCashBalance} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="cash-balance-account">Account</Label><select id="cash-balance-account" className={selectClass} name="cash_account_id" required defaultValue=""><option value="" disabled>Choose account</option>{manualActive.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="cash-balance-date">Date</Label><Input id="cash-balance-date" type="date" name="balance_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor="cash-balance-value">Current Balance</Label><Input id="cash-balance-value" type="number" step="0.01" name="balance" required/></div></div>
        <div className="grid gap-2"><Label htmlFor="cash-balance-note">Note</Label><Input id="cash-balance-note" name="notes"/></div>
        <Button type="submit" className="w-fit">Save Balance</Button>
      </form></DialogContent></Dialog><Dialog><DialogTrigger render={<Button size="sm"/>}>Add manual account</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add manual account</DialogTitle><DialogDescription>Check that this account is not already connected through Banking.</DialogDescription></DialogHeader><form action={addCashAccount} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="cash-account-name">Account Name</Label><Input id="cash-account-name" name="name" required placeholder="Petty Cash"/></div>
        <div className="grid gap-2"><Label htmlFor="cash-account-type">Type</Label><select id="cash-account-type" className={selectClass} name="account_type"><option value="cash">Cash</option><option value="checking">Checking</option><option value="savings">Savings</option><option value="other">Other</option></select></div>
        <div className="grid gap-2"><Label htmlFor="cash-account-note">Note</Label><Input id="cash-account-note" name="notes"/></div>
        <Button type="submit" className="w-fit">Add Manual Account</Button>
      </form></DialogContent></Dialog></div></header>

    <div className="grid grid-cols-2 divide-x border border-border bg-card/70" aria-label="Cash account summary"><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Connected banks</span><strong className="block font-mono text-lg tabular-nums">{connected.length}</strong></div><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Manual accounts</span><strong className="block font-mono text-lg tabular-nums">{manualActive.length}</strong></div></div>

    <section className="space-y-2" aria-labelledby="manual-account-balances"><div className="carez-page-heading"><h2 id="manual-account-balances">Manual account balances</h2></div>
      {(accounts||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No manual cash accounts</EmptyTitle><EmptyDescription>Connected bank balances appear in Banking.</EmptyDescription></EmptyHeader></Empty>:<div className="divide-y border border-border">{(accounts||[]).map((a:any)=>{const b=latest.get(a.id);return <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><strong className="block truncate text-sm">{a.name}</strong><span className="block text-xs text-muted-foreground">{a.account_type} · {a.active?'Active':'Inactive'}{b?` · Updated ${b.balance_date}`:''}</span></div><strong className="font-mono text-sm tabular-nums">{b?money(b.balance):'No balance'}</strong></div>})}</div>}
    </section>
  </div></>;
}
