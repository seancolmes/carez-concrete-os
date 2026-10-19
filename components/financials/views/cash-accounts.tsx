import {ProcurementForm} from '@/components/financials/ProcurementForm';
import {financialMoney} from '@/lib/financials/amount';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Button,Dialog,DialogTitle,DialogTrigger,Input,Label,DialogBody,DialogContent,DialogSurface,Select} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {addCashAccount,recordCashBalance} from '@/app/cashflow/actions';

const money=financialMoney;
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function CashAccountsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:accounts,error:accountsError},{data:balances,error:balancesError},{data:plaid,error:plaidError}]=await Promise.all([
    supabase.from('company_cash_accounts').select('*').eq('company_id',p.company_id).order('active',{ascending:false}).order('name'),
    supabase.from('company_cash_balance_snapshots').select('*').eq('company_id',p.company_id).order('balance_date',{ascending:false}).order('created_at',{ascending:false}),
    supabase.from('plaid_bank_account_summary').select('*').eq('company_id',p.company_id),
  ]);

  const latest=new Map<string,any>();
  for(const b of balances||[])if(!latest.has(b.cash_account_id))latest.set(b.cash_account_id,b);
  const connected=(plaid||[]).filter((a:any)=>a.include_in_cash!==false&&a.active!==false);
  const manualActive=(accounts||[]).filter((a:any)=>a.active);

  return <><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
    <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Cash accounts</h1><div className="flex flex-wrap gap-2"><Link className={secondaryLinkClass} href="/banking">Connected banking</Link><Link className={secondaryLinkClass} href="/cashflow">Cash flow</Link><Dialog><DialogTrigger><Button appearance="outline" size="small" disabled={Boolean(accountsError||balancesError)}>Record balance</Button></DialogTrigger><DialogSurface className="pt-dialog"><DialogBody><DialogContent><div><DialogTitle>Update manual balance</DialogTitle><p>Record a new dated balance. Use Correct balance below to amend the latest existing entry.</p></div><ProcurementForm action={recordCashBalance} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="cash-balance-account">Account</Label><Select appearance="outline" id="cash-balance-account" className={selectClass} name="cash_account_id" required defaultValue=""><option value="" disabled>Choose account</option>{manualActive.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</Select></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="cash-balance-date">Date</Label><Input appearance="underline" id="cash-balance-date" type="date" name="balance_date" required/></div><div className="grid gap-2"><Label htmlFor="cash-balance-value">Current Balance</Label><Input appearance="underline" id="cash-balance-value" type="number" step="0.01" name="balance" required/></div></div>
        <div className="grid gap-2"><Label htmlFor="cash-balance-note">Note</Label><Input appearance="underline" id="cash-balance-note" name="notes"/></div>
        <Button type="submit" appearance="primary" className="w-fit">Save Balance</Button>
      <DialogTrigger action="close"><Button type="button" appearance="secondary">Cancel</Button></DialogTrigger></ProcurementForm></DialogContent></DialogBody></DialogSurface></Dialog><Dialog><DialogTrigger><Button size="small">Add manual account</Button></DialogTrigger><DialogSurface className="pt-dialog"><DialogBody><DialogContent><div><DialogTitle>Add manual account</DialogTitle><p>Check that this account is not already connected through Banking.</p></div><ProcurementForm action={addCashAccount} className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="cash-account-name">Account Name</Label><Input appearance="underline" id="cash-account-name" name="name" required placeholder="Petty Cash"/></div>
        <div className="grid gap-2"><Label htmlFor="cash-account-type">Type</Label><Select appearance="outline" id="cash-account-type" className={selectClass} name="account_type"><option value="cash">Cash</option><option value="checking">Checking</option><option value="savings">Savings</option><option value="other">Other</option></Select></div>
        <div className="grid gap-2"><Label htmlFor="cash-account-note">Note</Label><Input appearance="underline" id="cash-account-note" name="notes"/></div>
        <Button type="submit" appearance="primary" className="w-fit">Add Manual Account</Button>
      <DialogTrigger action="close"><Button type="button" appearance="secondary">Cancel</Button></DialogTrigger></ProcurementForm></DialogContent></DialogBody></DialogSurface></Dialog></div></header>

    <div className="grid grid-cols-2 divide-x border border-border bg-card/70" aria-label="Cash account summary"><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Connected banks</span><strong className="block font-mono text-lg tabular-nums">{plaidError?'Unavailable':connected.length}</strong></div><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Manual accounts</span><strong className="block font-mono text-lg tabular-nums">{accountsError?'Unavailable':manualActive.length}</strong></div></div>

    {balancesError&&<p role="status" className="text-sm text-muted-foreground">Recorded balances unavailable. Correction controls are disabled.</p>}
    <section className="space-y-2" aria-labelledby="manual-account-balances"><div className="carez-page-heading"><h2 id="manual-account-balances">Manual account balances</h2></div>
      {accountsError?<p role="status" className="p-3 text-sm text-muted-foreground">Manual accounts unavailable; this is not a confirmed empty list.</p>:(accounts||[]).length===0?<div className="border border-border"><div><h3>No manual cash accounts</h3><p>Connected bank balances appear in Banking.</p></div></div>:<div className="divide-y border border-border">{(accounts||[]).map((a:any)=>{const b=latest.get(a.id);return <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><strong className="block break-words text-sm">{a.name}</strong><span className="block text-xs text-muted-foreground">{a.account_type} · {a.active?'Active':'Inactive'}{b?` · Updated ${b.balance_date}`:''}</span></div><strong className="font-mono text-sm tabular-nums">{balancesError?'Unavailable':b?money(b.balance):'Not recorded'}</strong>{b&&!balancesError&&a.active&&<Accordion collapsible className="basis-full"><AccordionItem value="correct"><AccordionHeader>Correct balance</AccordionHeader><AccordionPanel><ProcurementForm key={`${b.id}:${b.revision}`} action={recordCashBalance} className="grid gap-3 py-2"><input type="hidden" name="cash_account_id" value={a.id}/><input type="hidden" name="balance_date" value={b.balance_date}/><input type="hidden" name="expected_snapshot_id" value={b.id}/><input type="hidden" name="expected_revision" value={b.revision}/><p className="text-xs text-muted-foreground">Correction to {b.balance_date}. The prior amount remains in the save audit.</p><Label htmlFor={`balance-correct-${a.id}`}>Correct balance</Label><Input appearance="underline" id={`balance-correct-${a.id}`} name="balance" type="number" step="0.01" defaultValue={b.balance} required/><Label htmlFor={`balance-note-${a.id}`}>Correction note</Label><Input appearance="underline" id={`balance-note-${a.id}`} name="notes" required/><Button appearance="primary" type="submit">Save correction</Button></ProcurementForm></AccordionPanel></AccordionItem></Accordion>}</div>})}</div>}
    </section>
  </div></>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
