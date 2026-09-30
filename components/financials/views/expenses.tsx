import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Badge,Button,Dialog,DialogTitle,DialogTrigger,Input,Label,DialogBody,DialogContent,DialogSurface,Select} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {addCompanyExpense,markCompanyExpensePaid,voidCompanyExpense} from '@/app/cashflow/actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function CompanyExpensesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:expenses},{data:items},{data:summary}]=await Promise.all([
    supabase.from('company_expenses').select('*').eq('company_id',p.company_id).order('expense_date',{ascending:false}).limit(200),
    supabase.from('overhead_items').select('id,category,name,business_use_percent').eq('company_id',p.company_id).eq('active',true).order('sort_order'),
    supabase.from('company_expense_summary').select('*').eq('company_id',p.company_id).maybeSingle(),
  ]);

  const unpaid=(expenses||[]).filter((e:any)=>e.payment_status==='unpaid');
  const month=num(summary?.current_month_business_expense);
  const ytd=num(summary?.ytd_business_expense);
  const cats=[...new Set((items||[]).map((i:any)=>i.category))];

  return <><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
    <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Company expenses</h1><div className="flex flex-wrap gap-2"><Link className={secondaryLinkClass} href="/cashflow">Cash flow</Link><Dialog><DialogTrigger><Button size="small">Record expense</Button></DialogTrigger><DialogSurface className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogBody><DialogContent><div><DialogTitle>Record company expense</DialogTitle><p>For operating cost that does not belong to a specific job.</p></div><form action={addCompanyExpense} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-date">Date</Label><Input appearance="underline" id="expense-date" type="date" name="expense_date" defaultValue={today()}/></div>
          <div className="grid gap-2"><Label htmlFor="expense-overhead">Planned Overhead Item</Label><Select appearance="outline" id="expense-overhead" className={selectClass} name="overhead_item_id" defaultValue=""><option value="">Other / unplanned</option>{(items||[]).map((i:any)=><option key={i.id} value={i.id}>{i.category} — {i.name}</option>)}</Select></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-category">Category</Label><Select appearance="outline" id="expense-category" className={selectClass} name="category" defaultValue={cats[0]||'Other'}>{cats.map(c=><option key={c} value={c}>{c}</option>)}<option value="Other">Other</option></Select></div>
          <div className="grid gap-2"><Label htmlFor="expense-payee">Who Was Paid?</Label><Input appearance="underline" id="expense-payee" name="payee"/></div>
        </div>
        <div className="grid gap-2"><Label htmlFor="expense-description">What Was It?</Label><Input appearance="underline" id="expense-description" name="description" required/></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-subtotal">Subtotal</Label><Input appearance="underline" id="expense-subtotal" type="number" step="0.01" min="0" name="subtotal" required/></div>
          <div className="grid gap-2"><Label htmlFor="expense-tax">Tax / Fees</Label><Input appearance="underline" id="expense-tax" type="number" step="0.01" min="0" name="sales_tax" defaultValue="0"/></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-business-use">Business Use %</Label><Input appearance="underline" id="expense-business-use" type="number" min="0" max="100" step="0.01" name="business_use_percent"/></div>
          <div className="grid gap-2"><Label htmlFor="expense-source">Paid From</Label><Select appearance="outline" id="expense-source" className={selectClass} name="cash_source" defaultValue="company_account"><option value="company_account">Company account</option><option value="personal">Paid Personally</option><option value="noncash">Non-cash / allocation</option></Select></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-status">Status</Label><Select appearance="outline" id="expense-status" className={selectClass} name="payment_status" defaultValue="paid"><option value="paid">Already Paid</option><option value="unpaid">Still Owed</option></Select></div>
          <div className="grid gap-2"><Label htmlFor="expense-due-date">Due Date if Unpaid</Label><Input appearance="underline" id="expense-due-date" type="date" name="due_date"/></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="expense-paid-date">Paid Date</Label><Input appearance="underline" id="expense-paid-date" type="date" name="paid_date" defaultValue={today()}/></div>
          <div className="grid gap-2"><Label htmlFor="expense-payment-method">How Paid</Label><Select appearance="outline" id="expense-payment-method" className={selectClass} name="payment_method" defaultValue="card"><option value="card">Card</option><option value="ach">ACH</option><option value="check">Check</option><option value="cash">Cash</option><option value="wire">Wire</option><option value="other">Other</option></Select></div>
        </div>
        <div className="grid gap-2"><Label htmlFor="expense-reference">Reference / Receipt</Label><Input appearance="underline" id="expense-reference" name="reference_number"/></div>
        <div className="grid gap-2"><Label htmlFor="expense-notes">Note</Label><Input appearance="underline" id="expense-notes" name="notes"/></div>
        <Button type="submit" appearance="primary" className="w-fit">Record Expense</Button>
      </form></DialogContent></DialogBody></DialogSurface></Dialog></div></header>

    <div className="grid grid-cols-3 divide-x border border-border bg-card/70" aria-label="Expense summary"><div className="px-3 py-2"><span className="text-xs text-muted-foreground">This month</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{money(month)}</strong></div><div className="px-3 py-2"><span className="text-xs text-muted-foreground">This year</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{money(ytd)}</strong></div><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Unpaid bills</span><strong className="block font-mono text-base tabular-nums sm:text-lg">{unpaid.length}</strong></div></div>

    <section className="space-y-4" aria-labelledby="recent-company-expenses">
      <div className="carez-page-heading"><h2 id="recent-company-expenses">Recent company expenses</h2></div>
      {(expenses||[]).length===0?<div className="border border-border"><div><h3>No company expenses yet</h3><p>Operating expenses will appear here after they are recorded.</p></div></div>:<div className="divide-y border border-border">{(expenses||[]).filter((e:any)=>e.payment_status!=='void').map((e:any)=><Dialog key={e.id}><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><strong className="block truncate text-sm">{e.description}</strong><span className="block truncate text-xs text-muted-foreground">{e.expense_date} · {e.category} · {e.payee||'No payee'}</span></div><div className="flex items-center gap-2"><strong className="font-mono text-xs tabular-nums">{money(e.business_expense_amount)}</strong><Badge appearance="outline" className={e.payment_status==='paid'?'border-success/30 bg-success/10 text-success':'border-warning/30 bg-warning/10 text-warning'}>{e.payment_status==='paid'?'Paid':'Still owed'}</Badge><DialogTrigger><Button appearance="outline" size="small">View / Edit</Button></DialogTrigger></div></div><DialogSurface className="w-full overflow-hidden sm:max-w-3xl !fixed !right-0 !top-0 !m-0 !h-dvh !max-h-dvh !rounded-none"><DialogBody><DialogContent><div className="flex justify-end"><DialogTrigger action="close"><Button type="button" appearance="subtle" size="small">Close</Button></DialogTrigger></div><div><DialogTitle>{e.description}</DialogTitle><p>{e.expense_date} · {e.category}</p></div><div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-semibold">{e.description}</div><div className="mt-1 text-sm text-muted-foreground">{e.expense_date} · {e.category} · {e.payee||'No payee'}</div></div><Badge appearance="outline" className={e.payment_status==='paid'?'border-success/30 bg-success/10 text-success':'border-warning/30 bg-warning/10 text-warning'}>{e.payment_status==='paid'?'Paid':'Still Owed'}</Badge></div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-3"><div className="text-sm text-muted-foreground">Business portion {Number(e.business_use_percent||100).toFixed(0)}%</div><strong className="tabular-nums">{money(e.business_expense_amount)}</strong></div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {e.payment_status==='unpaid'&&<Accordion collapsible><AccordionItem value="content" className="w-full rounded-lg border border-border"><AccordionHeader className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Mark Paid</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="border-t border-border p-3"><form action={markCompanyExpensePaid} className="grid gap-3"><input type="hidden" name="expense_id" value={e.id}/><div className="grid gap-2"><Label htmlFor={`expense-paid-${e.id}`}>Paid Date</Label><Input appearance="underline" id={`expense-paid-${e.id}`} type="date" name="paid_date" defaultValue={today()}/></div><div className="grid gap-2"><Label htmlFor={`expense-method-${e.id}`}>How Paid</Label><Select appearance="outline" id={`expense-method-${e.id}`} className={selectClass} name="payment_method"><option value="card">Card</option><option value="ach">ACH</option><option value="check">Check</option><option value="cash">Cash</option></Select></div><div className="grid gap-2"><Label htmlFor={`expense-ref-${e.id}`}>Reference</Label><Input appearance="underline" id={`expense-ref-${e.id}`} name="reference_number"/></div><Button type="submit" appearance="primary" className="w-fit">Mark Paid</Button></form></div></AccordionPanel></AccordionItem></Accordion>}
          <form action={voidCompanyExpense}><input type="hidden" name="expense_id" value={e.id}/><Button type="submit" appearance="outline">Void</Button></form>
        </div>
      </div></DialogContent></DialogBody></DialogSurface></Dialog>)}</div>}
    </section>
  </div></>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
