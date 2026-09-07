import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PlaidConnectButton,RefreshBankButton } from '@/components/PlaidBankControls';
import { Button,buttonVariants } from '@/components/ui/button';
import { Card,CardContent } from '@/components/ui/card';
import { Empty,EmptyDescription,EmptyHeader,EmptyTitle } from '@/components/ui/empty';
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';
import { plaidConfigured } from '@/lib/plaid';
import { setBankAccountCashUse,setBankTransactionReview } from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const dt=(v:any)=>v?new Date(v).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'Never';

export default async function BankingPage(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');const companyId=profile.company_id;
  const [{data:summary},{data:reconciliation},{data:accounts},{data:transactions},{data:connections},{data:cash}]=await Promise.all([
    supabase.from('plaid_bank_feed_summary').select('*').eq('company_id',companyId).maybeSingle(),
    supabase.from('bank_reconciliation_summary').select('*').eq('company_id',companyId).maybeSingle(),
    supabase.from('plaid_bank_account_summary').select('*').eq('company_id',companyId).order('institution_name').order('name'),
    supabase.from('plaid_transaction_feed').select('*').eq('company_id',companyId).eq('removed',false).order('transaction_date',{ascending:false}).limit(30),
    supabase.from('plaid_connections').select('id,institution_name,status,last_transactions_sync_at,last_accounts_sync_at,last_realtime_balance_at,last_error_code,last_error_message').eq('company_id',companyId).order('created_at',{ascending:false}),
    supabase.from('company_cash_position_summary').select('*').eq('company_id',companyId).maybeSingle()
  ]);
  const s:any=summary||{},r:any=reconciliation||{},c:any=cash||{},configured=plaidConfigured();
  const needs=Number(r.needs_review_count||0),high=Number(r.high_confidence_count||0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Finance</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Banking</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Connected bank balances, transaction feed and reconciliation status feeding Carez automatically.</p></header><div className="flex flex-wrap gap-2"><Link className={buttonVariants()} href="/banking/reconcile">Reconcile Transactions{needs>0?` (${needs})`:''}</Link><PlaidConnectButton configured={configured}/>{Number(s.active_connections||0)>0&&<RefreshBankButton/>}<Link className={buttonVariants({variant:'outline'})} href="/cashflow">Cashflow</Link></div></div>

    {!configured&&<div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"><strong>Plaid code is ready, but credentials are not configured in Vercel yet.</strong> Add PLAID_CLIENT_ID and PLAID_SECRET as server-side environment variables, redeploy, then return here and click Connect Bank Account.</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Connected Cash</div><div className="text-2xl font-semibold tabular-nums">{money(c.bank_cash)}</div><div className="text-xs text-muted-foreground">Checking/savings accounts selected for Cashflow.</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Bank Connections</div><div className="text-2xl font-semibold tabular-nums">{Number(s.active_connections||0)}</div><div className="text-xs text-muted-foreground">{Number(s.linked_accounts||0)} linked account(s)</div></CardContent></Card>
      <Card size="sm"><CardContent className={`h-full space-y-1 ${needs>0?'text-warning':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Needs Reconciliation</div><div className="text-2xl font-semibold tabular-nums">{needs}</div><div className="text-xs text-muted-foreground">{high} high-confidence suggestion(s)</div></CardContent></Card>
      <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Last Transaction Sync</div><div className="text-base font-semibold">{dt(s.last_transactions_sync_at)}</div><div className="text-xs text-muted-foreground">Sync and matching analysis run automatically while Carez is in use.</div></CardContent></Card>
    </div>

    {(connections||[]).some((x:any)=>x.status==='needs_attention')&&<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"><strong>Bank connection needs attention.</strong> {(connections||[]).filter((x:any)=>x.status==='needs_attention').map((x:any)=>`${x.institution_name}: ${x.last_error_message||x.last_error_code||'Reconnect required'}`).join(' · ')}</div>}
    {needs>0&&<div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"><strong className="text-foreground">Reconciliation queue:</strong> Carez has {needs} bank transaction(s) that have not yet been tied to a financial record. <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/banking/reconcile">Review the queue</Link>.</div>}

    <section className="space-y-4" aria-labelledby="connected-accounts-title"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accounts</div><h2 id="connected-accounts-title" className="mt-1 text-lg font-semibold">Connected Accounts</h2><p className="mt-1 text-sm text-muted-foreground">Available balance is preferred for Cashflow when the bank provides it; current balance is the fallback.</p></div>
      {(accounts||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No bank connected yet</EmptyTitle><EmptyDescription>Connect your Carez business bank account to remove manual balance entry.</EmptyDescription></EmptyHeader></Empty>:<div className="overflow-x-auto rounded-lg border border-border"><Table><TableHeader><TableRow><TableHead>Institution / Account</TableHead><TableHead>Type</TableHead><TableHead>Available</TableHead><TableHead>Current</TableHead><TableHead>Balance Updated</TableHead><TableHead>Cashflow</TableHead></TableRow></TableHeader><TableBody>{(accounts||[]).map((a:any)=><TableRow key={a.account_id}><TableCell><div className="font-medium">{a.institution_name||'Bank'} · {a.name}</div><div className="text-xs text-muted-foreground">{a.mask?`•••• ${a.mask}`:''}</div></TableCell><TableCell>{a.account_subtype||a.account_type||'—'}</TableCell><TableCell>{a.available_balance==null?'—':money(a.available_balance)}</TableCell><TableCell>{a.current_balance==null?'—':money(a.current_balance)}</TableCell><TableCell>{dt(a.last_balance_at)}</TableCell><TableCell>{a.account_type==='depository'?<form action={setBankAccountCashUse}><input type="hidden" name="account_id" value={a.account_id}/><input type="hidden" name="include_in_cash" value={a.include_in_cash?'false':'true'}/><Button type="submit" size="sm" variant={a.include_in_cash?'outline':'default'}>{a.include_in_cash?'Included':'Include'}</Button></form>:<span className="text-sm text-muted-foreground">Not cash</span>}</TableCell></TableRow>)}</TableBody></Table></div>}
    </section>

    <section className="space-y-4" aria-labelledby="bank-feed-title"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bank feed</div><h2 id="bank-feed-title" className="mt-1 text-lg font-semibold">Recent Transactions</h2><p className="mt-1 text-sm text-muted-foreground">This is the bank activity ledger. Classification and matching are handled in the reconciliation workspace.</p></div>
      {(transactions||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No transactions imported yet</EmptyTitle><EmptyDescription>After the first connection, Plaid may take a short time to make full history available.</EmptyDescription></EmptyHeader></Empty>:<div className="overflow-x-auto rounded-lg border border-border"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Account</TableHead><TableHead>Category</TableHead><TableHead>Cash Movement</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(transactions||[]).map((t:any)=><TableRow key={t.id}><TableCell>{t.transaction_date}{t.pending&&<div className="text-xs text-muted-foreground">Pending</div>}</TableCell><TableCell><div className="font-medium">{t.merchant_name||t.name}</div><div className="text-xs text-muted-foreground">{t.name!==t.merchant_name?t.name:''}</div></TableCell><TableCell>{t.account_name}<div className="text-xs text-muted-foreground">{t.account_mask?`•••• ${t.account_mask}`:''}</div></TableCell><TableCell>{String(t.category_primary||'Uncategorized').replaceAll('_',' ')}</TableCell><TableCell className={`font-semibold tabular-nums ${Number(t.cash_amount)>=0?'text-success':'text-destructive'}`}>{Number(t.cash_amount)>=0?'+':''}{money(t.cash_amount)}</TableCell><TableCell>{t.pending?<span className="text-sm text-muted-foreground">Pending</span>:t.review_status==='matched'?<span className="text-sm font-medium text-success">Matched</span>:t.review_status==='ignored'?<form action={setBankTransactionReview}><input type="hidden" name="transaction_id" value={t.id}/><input type="hidden" name="review_status" value="unreviewed"/><Button type="submit" size="sm" variant="outline">Ignored · Restore</Button></form>:<Link className={buttonVariants({variant:'outline',size:'sm'})} href="/banking/reconcile">Review</Link>}</TableCell></TableRow>)}</TableBody></Table></div>}
    </section>
  </div></AppShell>;
}
