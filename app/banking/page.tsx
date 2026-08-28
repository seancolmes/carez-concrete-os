import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PlaidConnectButton,RefreshBankButton } from '@/components/PlaidBankControls';
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
  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="page-heading"><div><h1 className="page-title">Banking</h1><p className="subtitle">Connected bank balances, transaction feed and reconciliation status feeding Carez automatically.</p></div><div className="action-row"><Link className="button" href="/banking/reconcile">Reconcile Transactions{needs>0?` (${needs})`:''}</Link><PlaidConnectButton configured={configured}/>{Number(s.active_connections||0)>0&&<RefreshBankButton/>}<Link className="button secondary" href="/cashflow">Cashflow</Link></div></div>

    {!configured&&<div className="alert warn"><strong>Plaid code is ready, but credentials are not configured in Vercel yet.</strong> Add PLAID_CLIENT_ID and PLAID_SECRET as server-side environment variables, redeploy, then return here and click Connect Bank Account.</div>}
    <div className="grid grid4">
      <div className="card"><div className="label">Connected Cash</div><div className="value">{money(c.bank_cash)}</div><div className="meta">Checking/savings accounts selected for Cashflow.</div></div>
      <div className="card"><div className="label">Bank Connections</div><div className="value">{Number(s.active_connections||0)}</div><div className="meta">{Number(s.linked_accounts||0)} linked account(s)</div></div>
      <div className={`card ${needs>0?'elevated':''}`}><div className="label">Needs Reconciliation</div><div className="value">{needs}</div><div className="meta">{high} high-confidence suggestion(s)</div></div>
      <div className="card"><div className="label">Last Transaction Sync</div><div className="value" style={{fontSize:16}}>{dt(s.last_transactions_sync_at)}</div><div className="meta">Sync and matching analysis run automatically while Carez is in use.</div></div>
    </div>

    {(connections||[]).some((x:any)=>x.status==='needs_attention')&&<div className="alert danger"><strong>Bank connection needs attention.</strong> {(connections||[]).filter((x:any)=>x.status==='needs_attention').map((x:any)=>`${x.institution_name}: ${x.last_error_message||x.last_error_code||'Reconnect required'}`).join(' · ')}</div>}
    {needs>0&&<div className="alert info"><strong>Reconciliation queue:</strong> Carez has {needs} bank transaction(s) that have not yet been tied to a financial record. <Link href="/banking/reconcile">Review the queue</Link>.</div>}

    <section className="section"><div className="section-heading"><div><div className="section-kicker">Accounts</div><div className="section-title">Connected Accounts</div><div className="section-heading-meta">Available balance is preferred for Cashflow when the bank provides it; current balance is the fallback.</div></div></div>
      {(accounts||[]).length===0?<div className="empty-state"><div><div className="title">No bank connected yet</div><div className="meta">Connect your Carez business bank account to remove manual balance entry.</div></div></div>:<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Institution / Account</th><th>Type</th><th>Available</th><th>Current</th><th>Balance Updated</th><th>Cashflow</th></tr></thead><tbody>{(accounts||[]).map((a:any)=><tr key={a.account_id}><td><strong>{a.institution_name||'Bank'} · {a.name}</strong><div className="meta">{a.mask?`•••• ${a.mask}`:''}</div></td><td>{a.account_subtype||a.account_type||'—'}</td><td>{a.available_balance==null?'—':money(a.available_balance)}</td><td>{a.current_balance==null?'—':money(a.current_balance)}</td><td>{dt(a.last_balance_at)}</td><td>{a.account_type==='depository'?<form action={setBankAccountCashUse}><input type="hidden" name="account_id" value={a.account_id}/><input type="hidden" name="include_in_cash" value={a.include_in_cash?'false':'true'}/><button className={`button ${a.include_in_cash?'secondary':''}`}>{a.include_in_cash?'Included':'Include'}</button></form>:<span className="meta">Not cash</span>}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">Bank Feed</div><div className="section-title">Recent Transactions</div><div className="section-heading-meta">This is the bank activity ledger. Classification and matching are handled in the reconciliation workspace.</div></div></div>
      {(transactions||[]).length===0?<div className="empty-state"><div><div className="title">No transactions imported yet</div><div className="meta">After the first connection, Plaid may take a short time to make full history available.</div></div></div>:<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Category</th><th>Cash Movement</th><th>Status</th></tr></thead><tbody>{(transactions||[]).map((t:any)=><tr key={t.id}><td>{t.transaction_date}{t.pending&&<div className="meta">Pending</div>}</td><td><strong>{t.merchant_name||t.name}</strong><div className="meta">{t.name!==t.merchant_name?t.name:''}</div></td><td>{t.account_name}<div className="meta">{t.account_mask?`•••• ${t.account_mask}`:''}</div></td><td>{String(t.category_primary||'Uncategorized').replaceAll('_',' ')}</td><td style={{fontWeight:850,color:Number(t.cash_amount)>=0?'#73daa0':'#ff978f'}}>{Number(t.cash_amount)>=0?'+':''}{money(t.cash_amount)}</td><td>{t.pending?<span className="status">Pending</span>:t.review_status==='matched'?<span className="status completed">Matched</span>:t.review_status==='ignored'?<form action={setBankTransactionReview}><input type="hidden" name="transaction_id" value={t.id}/><input type="hidden" name="review_status" value="unreviewed"/><button className="button secondary">Ignored · Restore</button></form>:<Link className="button secondary" href="/banking/reconcile">Review</Link>}</td></tr>)}</tbody></table></div>}
    </section>
  </AppShell>;
}
