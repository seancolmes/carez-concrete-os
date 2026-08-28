import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { setBankRuleState,updateBankRule } from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const dt=(v:any)=>v?new Date(v).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'Never';
const actionLabel=(v:string)=>v==='company_expense'?'Company Expense':v==='job_cost'?'Job Cost':v==='ignore'?'Ignore / Non-Accounting':v;
const sourceLabel=(v:string)=>v==='auto_rule'?'Auto Rule':v==='approved_rule'?'Approved Rule':v==='learned_rule'?'Learned Rule':v==='manual_classification'?'Manual Review':String(v||'Matched').replaceAll('_',' ');

export default async function BankRulesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');
  const companyId=profile.company_id;
  const [{data:rules},{data:overhead},{data:costCodes},{data:vendors},{data:recent},{data:accounts}]=await Promise.all([
    supabase.from('bank_reconciliation_rules').select('*').eq('company_id',companyId).order('active',{ascending:false}).order('created_at',{ascending:false}),
    supabase.from('overhead_items').select('id,category,name,business_use_percent').eq('company_id',companyId).eq('active',true).order('sort_order'),
    supabase.from('cost_codes').select('id,code,name,cost_type').eq('company_id',companyId).eq('active',true).order('sort_order'),
    supabase.from('vendors').select('id,name').eq('company_id',companyId).eq('active',true).order('name'),
    supabase.from('plaid_transactions').select('id,account_id,transaction_date,name,merchant_name,cash_amount,match_note,reconciled_at,reconciliation_source,reconciliation_confidence,bank_rule_id').eq('company_id',companyId).eq('review_status','matched').not('bank_rule_id','is',null).order('reconciled_at',{ascending:false}).limit(30),
    supabase.from('plaid_accounts').select('id,name,mask').eq('company_id',companyId)
  ]);
  const list:any[]=rules||[],accountMap=new Map((accounts||[]).map((x:any)=>[x.id,x]));
  const active=list.filter(r=>r.active).length,auto=list.filter(r=>r.active&&r.auto_apply).length,paused=list.length-active,uses=list.reduce((s,r)=>s+Number(r.use_count||0),0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="page-heading"><div><h1 className="page-title">Bank Rules</h1><p className="subtitle">Control what Carez has learned from reconciliation and audit what automation has handled.</p></div><div className="action-row"><Link className="button" href="/banking/reconcile">Reconcile Transactions</Link><Link className="button secondary" href="/banking">Banking</Link></div></div>

    <div className="grid grid4">
      <div className="card"><div className="label">Active Rules</div><div className="value">{active}</div><div className="meta">Rules currently participating in matching.</div></div>
      <div className="card"><div className="label">Auto Apply</div><div className="value">{auto}</div><div className="meta">Future matching transactions may post automatically.</div></div>
      <div className="card"><div className="label">Rule Uses</div><div className="value">{uses}</div><div className="meta">Transactions processed through learned rules.</div></div>
      <div className="card"><div className="label">Paused</div><div className="value">{paused}</div><div className="meta">Preserved for audit but excluded from matching.</div></div>
    </div>

    <div className="alert info"><strong>Automation policy:</strong> company-overhead and ignore rules may auto-apply to future matching bank activity. Job-cost rules can remember the merchant and cost code, but Carez still requires a project selection before posting so a purchase cannot silently land on the wrong job.</div>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">Automation</div><div className="section-title">Learned Rules</div><div className="section-heading-meta">Rules are learned from approved reconciliation decisions. Pause or edit them here without deleting the audit history.</div></div></div>
      {list.length===0?<div className="empty-state"><div><div className="title">No bank rules learned yet</div><div className="meta">When you choose “Remember this merchant” during reconciliation, Carez creates the rule here.</div></div></div>:
      <div className="data-table-wrap"><table className="data-table" style={{minWidth:1050}}><thead><tr><th>Rule</th><th>Match</th><th>Action</th><th>Automation</th><th>Uses</th><th>Last Used</th><th>Controls</th></tr></thead><tbody>{list.map((r:any)=><tr key={r.id}>
        <td><strong>{r.name}</strong><div className="meta">{r.active?'Active':'Paused'}</div></td>
        <td><div>{r.merchant_pattern}</div><div className="meta">{r.direction}{r.category_primary?` · ${String(r.category_primary).replaceAll('_',' ')}`:''}</div></td>
        <td><strong>{actionLabel(r.action_type)}</strong><div className="meta">{r.action_type==='company_expense'?(r.expense_category||'Company overhead'):r.action_type==='job_cost'?'Project required before posting':'No financial record created'}</div></td>
        <td>{r.auto_apply?<span className="status completed">Auto Apply</span>:<span className="status">Review</span>}</td>
        <td>{Number(r.use_count||0)}</td><td>{dt(r.last_used_at)}</td>
        <td><div className="action-row" style={{marginTop:0}}>
          <form action={setBankRuleState}><input type="hidden" name="rule_id" value={r.id}/><input type="hidden" name="field" value="active"/><input type="hidden" name="value" value={r.active?'false':'true'}/><button className="button secondary">{r.active?'Pause':'Activate'}</button></form>
          {r.action_type!=='job_cost'&&<form action={setBankRuleState}><input type="hidden" name="rule_id" value={r.id}/><input type="hidden" name="field" value="auto_apply"/><input type="hidden" name="value" value={r.auto_apply?'false':'true'}/><button className="button secondary">{r.auto_apply?'Require Review':'Enable Auto'}</button></form>}
          <details className="controls-disclosure create-disclosure"><summary>Edit Rule</summary><div className="controls-body"><form action={updateBankRule} className="form"><input type="hidden" name="rule_id" value={r.id}/>
            <div className="grid grid2"><label className="field"><span>Rule Name</span><input name="name" defaultValue={r.name} required/></label><label className="field"><span>Merchant Pattern</span><input name="merchant_pattern" defaultValue={r.merchant_pattern} required/></label></div>
            <div className="grid grid3"><label className="field"><span>Direction</span><select name="direction" defaultValue={r.direction}><option value="outflow">Money Out</option><option value="inflow">Money In</option><option value="any">Either</option></select></label><label className="field"><span>Plaid Category</span><input name="category_primary" defaultValue={r.category_primary||''} placeholder="Blank = any category"/></label><label className="field"><span>Action</span><select name="action_type" defaultValue={r.action_type}><option value="company_expense">Company Expense</option><option value="job_cost">Job Cost Suggestion</option><option value="ignore">Ignore / Non-Accounting</option></select></label></div>
            <div className="grid grid2"><label className="field"><span>Overhead Item</span><select name="overhead_item_id" defaultValue={r.overhead_item_id||''}><option value="">None</option>{(overhead||[]).map((o:any)=><option key={o.id} value={o.id}>{o.category} — {o.name}</option>)}</select></label><label className="field"><span>Expense Category</span><input name="expense_category" defaultValue={r.expense_category||''}/></label></div>
            <div className="grid grid3"><label className="field"><span>Business Use %</span><input type="number" min="0" max="100" step="0.01" name="business_use_percent" defaultValue={r.business_use_percent??100}/></label><label className="field"><span>Job Cost Code</span><select name="cost_code_id" defaultValue={r.cost_code_id||''}><option value="">None</option>{(costCodes||[]).map((c:any)=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></label><label className="field"><span>Vendor</span><select name="vendor_id" defaultValue={r.vendor_id||''}><option value="">Use bank merchant</option>{(vendors||[]).map((v:any)=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label></div>
            <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" name="active" defaultChecked={r.active}/> Active rule</label>
            <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" name="auto_apply" defaultChecked={r.auto_apply} disabled={r.action_type==='job_cost'}/> Auto-apply future matches</label>
            <div className="alert info">Changing a rule affects future matching. Carez does not silently rewrite previously reconciled transactions.</div>
            <button className="button">Save Rule</button>
          </form></div></details>
        </div></td>
      </tr>)}</tbody></table></div>}
    </section>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">Audit Trail</div><div className="section-title">Recent Rule Activity</div><div className="section-heading-meta">A visible history of transactions tied to learned rules.</div></div></div>
      {(recent||[]).length===0?<div className="empty-state"><div><div className="title">No rule activity yet</div><div className="meta">Future rule-based reconciliations will appear here.</div></div></div>:
      <div className="data-table-wrap"><table className="data-table" style={{minWidth:900}}><thead><tr><th>Bank Date</th><th>Transaction</th><th>Account</th><th>Amount</th><th>Result</th><th>Source</th><th>Reconciled</th></tr></thead><tbody>{(recent||[]).map((t:any)=>{const a:any=accountMap.get(t.account_id)||{},cash=Number(t.cash_amount||0),rule=list.find((r:any)=>r.id===t.bank_rule_id);return <tr key={t.id}><td>{t.transaction_date}</td><td><strong>{t.merchant_name||t.name}</strong><div className="meta">{rule?.name||'Rule'}</div></td><td>{a.name||'Bank'}<div className="meta">{a.mask?`•••• ${a.mask}`:''}</div></td><td style={{fontWeight:850,color:cash>=0?'#73daa0':'#ff978f'}}>{cash>=0?'+':''}{money(cash)}</td><td>{t.match_note||'Reconciled'}</td><td><span className={`status ${t.reconciliation_source==='auto_rule'?'completed':''}`}>{sourceLabel(t.reconciliation_source)}{t.reconciliation_confidence?` · ${t.reconciliation_confidence}%`:''}</span></td><td>{dt(t.reconciled_at)}</td></tr>})}</tbody></table></div>}
    </section>
  </AppShell>;
}
